import json
from pathlib import Path

from django.core.management.base import BaseCommand

from core.models import (
    Activity,
    Agent,
    Case,
    CaseAssignment,
    CaseTypeDefinition,
    ExternalEvent,
    Program,
    Supervisor,
    UserProfile,
)


class Command(BaseCommand):
    help = "Export cleaned demo seed data from current database state."

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            dest="file",
            default="fixtures/seed_demo_data.json",
            help="Output path for seed JSON, relative to backend/ or absolute.",
        )

    def _resolve_output_path(self, file_arg: str) -> Path:
        candidate = Path(file_arg)
        if candidate.is_absolute():
            return candidate
        return Path.cwd() / candidate

    def _normalize_json(self, value):
        """
        Remove accidental nested wrappers like {"schema": {...}} introduced by
        manual edits, while preserving plain JSON payloads.
        """
        if not isinstance(value, dict):
            return value
        current = value
        # Unwrap repeatedly for both wrapper key variants.
        while (
            isinstance(current, dict)
            and len(current) == 1
            and next(iter(current.keys())) in {"schema", "validation_rules"}
            and isinstance(next(iter(current.values())), dict)
        ):
            current = next(iter(current.values()))
        return current

    def handle(self, *args, **options):
        output_path = self._resolve_output_path(options["file"])
        output_path.parent.mkdir(parents=True, exist_ok=True)

        programs = list(Program.objects.order_by("id"))
        agents = list(Agent.objects.select_related("program", "user").order_by("id"))
        supervisors = list(Supervisor.objects.select_related("program", "user").order_by("id"))
        case_types = list(CaseTypeDefinition.objects.select_related("program").order_by("id"))
        cases = list(Case.objects.select_related("program", "case_type").order_by("id"))

        active_assignments = list(
            CaseAssignment.objects.filter(active=True)
            .select_related("case__program", "agent__program")
            .order_by("id")
        )

        activities_qs = Activity.objects.select_related("program", "case__program", "agent__program").order_by("id")
        cleaned_activities = []
        for activity in activities_qs:
            # Clean out cross-program inconsistencies.
            if activity.program_id != activity.case.program_id:
                continue
            if activity.program_id != activity.agent.program_id:
                continue
            cleaned_activities.append(activity)

        external_events_qs = ExternalEvent.objects.select_related("program", "case__program").order_by("id")
        cleaned_external_events = []
        for event in external_events_qs:
            if event.case_id and event.program_id != event.case.program_id:
                continue
            cleaned_external_events.append(event)

        users = []
        profiles = UserProfile.objects.select_related("user", "program").order_by("id")
        for profile in profiles:
            users.append(
                {
                    "username": profile.user.username,
                    # Password hashes are not reversible; use demo default.
                    "password": "password123",
                    "email": profile.user.email or f"{profile.user.username}@example.com",
                    "program_code": profile.program.code,
                    "role": profile.role,
                }
            )

        payload = {
            "programs": [{"code": p.code, "name": p.name} for p in programs],
            "users": users,
            "agents": [
                {
                    "program_code": a.program.code,
                    "external_id": a.external_id,
                    "name": a.name,
                    "username": a.user.username if a.user else None,
                }
                for a in agents
            ],
            "supervisors": [
                {
                    "program_code": s.program.code,
                    "name": s.name,
                    "username": s.user.username if s.user else None,
                }
                for s in supervisors
            ],
            "case_types": [
                {
                    "program_code": ct.program.code,
                    "slug": ct.slug,
                    "name": ct.name,
                    "schema": self._normalize_json(ct.schema or {}),
                    "validation_rules": self._normalize_json(ct.validation_rules or {}),
                }
                for ct in case_types
            ],
            "cases": [
                {
                    "program_code": c.program.code,
                    "case_type_slug": c.case_type.slug,
                    "title": c.title,
                    "status": c.status,
                    "data": c.data or {},
                }
                for c in cases
            ],
            "assignments": [
                {
                    "program_code": a.case.program.code,
                    "case_title": a.case.title,
                    "agent_external_id": a.agent.external_id,
                }
                for a in active_assignments
                if a.case.program_id == a.agent.program_id
            ],
            "activities": [
                {
                    "program_code": a.program.code,
                    "agent_external_id": a.agent.external_id,
                    "case_title": a.case.title,
                    "client_activity_id": a.client_activity_id,
                    "activity_type": a.activity_type,
                    "client_reported_at": a.client_reported_at.isoformat().replace("+00:00", "Z"),
                    "payload": a.payload or {},
                }
                for a in cleaned_activities
            ],
            "external_events": [
                {
                    "program_code": e.program.code,
                    "case_title": e.case.title if e.case else None,
                    "source": e.source,
                    "external_event_id": e.external_event_id,
                    "event_type": e.event_type,
                    "client_reported_at": (
                        e.client_reported_at.isoformat().replace("+00:00", "Z")
                        if e.client_reported_at
                        else None
                    ),
                    "payload": e.payload or {},
                }
                for e in cleaned_external_events
            ],
        }

        # Remove null case titles for optional case linkage.
        payload["external_events"] = [
            {k: v for k, v in item.items() if not (k == "case_title" and v is None)}
            for item in payload["external_events"]
        ]

        output_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"Exported cleaned demo seed data to {output_path}"))
