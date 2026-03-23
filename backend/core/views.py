from datetime import datetime, timezone

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone as dj_timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import (
    Activity,
    Agent,
    Case,
    CaseAssignment,
    CaseTypeDefinition,
    ExternalEvent,
    Program,
    QualityIssue,
    SyncSession,
    SyncState,
)
from core.serializers import (
    AgentCreateSerializer,
    CaseAssignmentSerializer,
    CaseCreateInputSerializer,
    CaseListSerializer,
    CaseSerializer,
    CaseTimelineQuerySerializer,
    CaseTypeDefinitionSerializer,
    CaseUpdateSerializer,
    ExternalEventIngestSerializer,
    ExternalEventSerializer,
    SyncPullSerializer,
    SyncPushSerializer,
)
from core.services import (
    create_activity_quality_issues,
    create_conflict_issue,
    quality_score_from_issue_counts,
)


class CaseTypeListAPIView(APIView):
    def get(self, request):
        program_id = request.query_params.get("program_id")
        if not program_id:
            return Response({"detail": "program_id is required."}, status=400)
        case_types = CaseTypeDefinition.objects.filter(program_id=program_id).order_by("name")
        return Response(CaseTypeDefinitionSerializer(case_types, many=True).data)


class HealthAPIView(APIView):
    def get(self, request):
        return Response({"status": "ok"})


class ProgramListAPIView(APIView):
    def get(self, request):
        programs = Program.objects.all().order_by("name")
        return Response([{"id": program.id, "name": program.name, "code": program.code} for program in programs])


class CaseListCreateAPIView(APIView):
    def get(self, request):
        program_id = request.query_params.get("program_id")
        queryset = Case.objects.select_related("case_type", "program").prefetch_related("assignments").all()
        if program_id:
            queryset = queryset.filter(program_id=program_id)
        cases = list(queryset.order_by("-created_at"))
        return Response(CaseListSerializer(cases, many=True).data)

    def post(self, request):
        serializer = CaseCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            program = Program.objects.get(id=data["programId"])
        except Program.DoesNotExist:
            return Response({"detail": f"Program {data['programId']} not found."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            case_type = CaseTypeDefinition.objects.get(program=program, slug=data["caseType"])
        except CaseTypeDefinition.DoesNotExist:
            available = list(CaseTypeDefinition.objects.filter(program=program).values_list("slug", flat=True))
            return Response(
                {
                    "detail": f"Case type '{data['caseType']}' not found for this program. "
                    f"Available: {available or '(none - run seed: python manage.py seed_demo_data)'}"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        case = Case.objects.create(
            program=program,
            case_type=case_type,
            title=data["title"],
            data={"priority": data.get("priority", "medium")},
            status=Case.Status.ACTIVE,
        )
        return Response(CaseListSerializer(case).data, status=status.HTTP_201_CREATED)


class CaseDetailAPIView(APIView):
    def get(self, request, case_id: int):
        case = get_object_or_404(
            Case.objects.select_related("program", "case_type").prefetch_related("assignments"),
            id=case_id,
        )
        return Response(CaseListSerializer(case).data)

    def put(self, request, case_id: int):
        case = get_object_or_404(Case, id=case_id)
        serializer = CaseUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        client_version = serializer.validated_data.pop("client_version")
        if client_version != case.version:
            create_conflict_issue(case, client_version=client_version, server_version=case.version)
            return Response(
                {
                    "conflict": True,
                    "detail": "Conflict flagged for supervisor review. Server data unchanged.",
                    "server_case": CaseSerializer(case).data,
                },
                status=status.HTTP_202_ACCEPTED,
            )

        for field, value in serializer.validated_data.items():
            setattr(case, field, value)
        case.version += 1
        case.save()
        return Response(CaseSerializer(case).data)


class AssignCaseAPIView(APIView):
    def post(self, request, case_id: int):
        payload = {**request.data, "case": case_id}
        if "agentId" in request.data and "agent_id" not in request.data:
            payload["agent_id"] = request.data["agentId"]
        serializer = CaseAssignmentSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        agent = serializer.validated_data["agent"]
        case = get_object_or_404(Case, id=case_id)
        if case.program_id != agent.program_id:
            return Response(
                {"detail": "Case and agent must belong to the same program."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        CaseAssignment.objects.filter(case_id=case_id, active=True).update(active=False)
        CaseAssignment.objects.create(case_id=case_id, agent=agent, active=True)
        case = get_object_or_404(
            Case.objects.select_related("program", "case_type").prefetch_related("assignments"),
            id=case_id,
        )
        return Response(CaseListSerializer(case).data, status=status.HTTP_200_OK)


class CaseTimelineAPIView(APIView):
    def get(self, request, case_id: int):
        query_serializer = CaseTimelineQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        limit = query_serializer.validated_data["limit"]

        activities = [
            {
                "id": f"act-{item.id}",
                "kind": "activity",
                "title": item.activity_type.replace("_", " ").title(),
                "description": (item.payload or {}).get("notes", "") or str(item.payload or ""),
                "client_reported_at": item.client_reported_at,
                "server_received_at": item.server_received_at,
            }
            for item in Activity.objects.filter(case_id=case_id).order_by("-server_received_at", "-id")
        ]
        events = [
            {
                "id": f"evt-{item.id}",
                "kind": "external_event",
                "title": item.event_type.replace("_", " ").title(),
                "description": str(item.payload or ""),
                "client_reported_at": item.client_reported_at,
                "server_received_at": item.server_received_at,
            }
            for item in ExternalEvent.objects.filter(case_id=case_id).order_by("-server_received_at", "-id")
        ]
        merged = sorted([*activities, *events], key=lambda item: (item["server_received_at"], item["id"]), reverse=True)
        result = []
        for m in merged[:limit]:
            result.append(
                {
                    "id": m["id"],
                    "kind": m["kind"],
                    "type": m["kind"],
                    "title": m["title"],
                    "description": m["description"],
                    "serverReceivedAt": m["server_received_at"].isoformat() if m["server_received_at"] else "",
                    "clientReportedAt": m["client_reported_at"].isoformat() if m.get("client_reported_at") else None,
                }
            )
        return Response(result)


class SyncPushAPIView(APIView):
    def post(self, request):
        serializer = SyncPushSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        request_id = data.get("request_id") or data.get("session_id")
        agent = Agent.objects.filter(id=data["agent_id"], program_id=data["program_id"]).first()
        if not agent:
            return Response(
                {"detail": "Invalid agent_id for given program_id."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session, _ = SyncSession.objects.get_or_create(
            request_id=request_id,
            defaults={
                "program_id": data["program_id"],
                "agent_id": agent.id,
                "status": SyncSession.Status.STARTED,
            },
        )

        created_count = 0
        duplicates = []
        accepted = []
        rejected = []
        for item in data["activities"]:
            case = Case.objects.filter(id=item["case_id"], program_id=data["program_id"]).first()
            if not case:
                rejected.append(
                    {
                        "client_activity_id": item["client_activity_id"],
                        "reason": "invalid_case_for_program",
                    }
                )
                continue
            if not CaseAssignment.objects.filter(case_id=case.id, agent_id=agent.id, active=True).exists():
                rejected.append(
                    {
                        "client_activity_id": item["client_activity_id"],
                        "reason": "case_not_assigned_to_agent",
                    }
                )
                continue
            activity, created = Activity.objects.get_or_create(
                program_id=data["program_id"],
                agent_id=agent.id,
                client_activity_id=item["client_activity_id"],
                defaults={
                    "case_id": case.id,
                    "sync_session": session,
                    "activity_type": item["activity_type"],
                    "payload": item.get("payload", {}),
                    "client_reported_at": item["client_reported_at"],
                },
            )
            if created:
                created_count += 1
                accepted.append(activity.client_activity_id)
                create_activity_quality_issues(activity)
            else:
                duplicates.append(item["client_activity_id"])

        session.status = SyncSession.Status.COMPLETED
        session.completed_at = dj_timezone.now()
        session.save(update_fields=["status", "completed_at"])

        return Response(
            {
                "request_id": request_id,
                "session_id": request_id,
                "accepted_count": created_count,
                "accepted_ids": accepted,
                "duplicate_ids": duplicates,
                "rejected_items": rejected,
            },
            status=status.HTTP_200_OK,
        )


class SyncPullAPIView(APIView):
    def get(self, request):
        serializer = SyncPullSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        agent = Agent.objects.filter(id=data["agent_id"], program_id=data["program_id"]).first()
        if not agent:
            return Response(
                {"detail": "Invalid agent_id for given program_id."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assigned_cases = serializer.get_assigned_cases()
        since_token = data.get("since_token") or data.get("cursor")
        if since_token:
            normalized = since_token.replace("Z", "+00:00")
            since = datetime.fromisoformat(normalized)
            assigned_cases = [case for case in assigned_cases if case.server_updated_at > since]

        sorted_cases = sorted(assigned_cases, key=lambda case: (case.server_updated_at, case.id), reverse=True)
        updates_token = (
            sorted_cases[0].server_updated_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
            if sorted_cases
            else (since_token or "")
        )

        SyncState.objects.update_or_create(
            program_id=data["program_id"],
            agent_id=agent.id,
            defaults={"updates_token": updates_token, "last_pull_at": dj_timezone.now()},
        )

        serialized_cases = CaseListSerializer(sorted_cases, many=True).data
        return Response(
            {
                "updates_token": updates_token,
                "cursor": updates_token,
                "nextCursor": updates_token,
                "cases": serialized_cases,
                "assigned_cases": serialized_cases,
                "assignedCases": serialized_cases,
            }
        )


class ExternalEventIngestAPIView(APIView):
    def post(self, request):
        serializer = ExternalEventIngestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        case_id = data.get("case_id")
        case_ref = data.get("case_ref")
        if not case_id and case_ref and case_ref.isdigit():
            case_id = int(case_ref)
        if case_id:
            case_id = Case.objects.filter(id=case_id, program_id=data["program_id"]).values_list("id", flat=True).first()

        event, created = ExternalEvent.objects.get_or_create(
            program_id=data["program_id"],
            source=data["source"],
            external_event_id=data["external_event_id"],
            defaults={
                "case_id": case_id,
                "event_type": data["event_type"],
                "payload": data.get("payload", {}),
                "client_reported_at": data.get("client_reported_at") or data.get("event_occurred_at"),
            },
        )
        return Response(
            {
                "created": created,
                "duplicate": not created,
                "status": "accepted" if created else "duplicate",
                "event": ExternalEventSerializer(event).data,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class DashboardMetricsAPIView(APIView):
    def get(self, request):
        program_id = request.query_params.get("program_id", "1")
        total_cases = Case.objects.filter(program_id=program_id).count()
        active_cases = Case.objects.filter(program_id=program_id, status=Case.Status.ACTIVE).count()
        pending_sync = SyncSession.objects.filter(program_id=program_id, status=SyncSession.Status.STARTED).count()
        issue_counts = QualityIssue.objects.filter(program_id=program_id).aggregate(
            warning=Count("id", filter=Q(severity=QualityIssue.Severity.WARNING, resolved=False)),
            critical=Count("id", filter=Q(severity=QualityIssue.Severity.CRITICAL, resolved=False)),
        )
        warning = issue_counts["warning"] or 0
        critical = issue_counts["critical"] or 0
        quality_score = quality_score_from_issue_counts(warning, critical)
        return Response(
            {
                "program_id": int(program_id),
                "totalCases": total_cases,
                "activeCases": active_cases,
                "pendingSyncItems": pending_sync,
                "open_quality_issues": warning + critical,
                "qualityScore": quality_score,
            }
        )


class QualityIssueListAPIView(APIView):
    def get(self, request):
        program_id = request.query_params.get("program_id", "1")
        issues = QualityIssue.objects.filter(program_id=program_id, resolved=False).select_related("case").order_by(
            "-created_at"
        )[:100]
        return Response(
            [
                {
                    "id": f"qi-{q.id}",
                    "caseId": q.case_id,
                    "severity": "high" if q.severity == QualityIssue.Severity.CRITICAL else "medium",
                    "message": q.message,
                    "createdAt": q.created_at.isoformat() if q.created_at else "",
                }
                for q in issues
            ]
        )


class AgentListAPIView(APIView):
    def get(self, request):
        program_id = request.query_params.get("program_id")
        if not program_id:
            return Response({"detail": "program_id is required."}, status=400)
        agents = Agent.objects.filter(program_id=program_id).order_by("name")
        return Response([{"id": a.id, "name": a.name, "externalId": a.external_id} for a in agents])

    def post(self, request):
        serializer = AgentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        program = serializer.validated_data["program"]
        external_id = serializer.validated_data["resolved_external_id"]
        agent = Agent.objects.create(
            program=program,
            name=serializer.validated_data["name"],
            external_id=external_id,
        )
        return Response(
            {"id": agent.id, "name": agent.name, "externalId": agent.external_id},
            status=status.HTTP_201_CREATED,
        )
