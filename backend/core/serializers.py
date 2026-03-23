import uuid

from rest_framework import serializers

from core.models import Agent, Case, CaseAssignment, CaseTypeDefinition, ExternalEvent, Program


class CaseTypeDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseTypeDefinition
        fields = ["id", "program_id", "name", "slug", "schema", "validation_rules"]


class ActivityItemSerializer(serializers.Serializer):
    client_activity_id = serializers.CharField(max_length=128)
    case_id = serializers.IntegerField()
    activity_type = serializers.CharField(max_length=64)
    payload = serializers.JSONField(required=False)
    client_reported_at = serializers.DateTimeField()


class SyncPushSerializer(serializers.Serializer):
    program_id = serializers.IntegerField()
    agent_id = serializers.IntegerField()
    request_id = serializers.CharField(max_length=64, required=False, allow_blank=True)
    session_id = serializers.CharField(max_length=64, required=False, allow_blank=True)
    activities = ActivityItemSerializer(many=True)

    def validate(self, attrs):
        request_id = attrs.get("request_id") or attrs.get("session_id")
        if not request_id or not request_id.strip():
            import uuid

            attrs["request_id"] = str(uuid.uuid4())
            attrs["session_id"] = attrs["request_id"]
        return attrs


class SyncPullSerializer(serializers.Serializer):
    program_id = serializers.IntegerField()
    agent_id = serializers.IntegerField()
    since_token = serializers.CharField(required=False, allow_blank=True)
    cursor = serializers.CharField(required=False, allow_blank=True)

    def get_assigned_cases(self):
        data = self.validated_data
        assignment_qs = CaseAssignment.objects.filter(
            agent_id=data["agent_id"],
            case__program_id=data["program_id"],
            active=True,
        ).select_related("case", "case__case_type", "case__program").prefetch_related(
            "case__assignments"
        )
        return [assignment.case for assignment in assignment_qs]


class CaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Case
        fields = [
            "id",
            "program",
            "case_type",
            "title",
            "data",
            "status",
            "version",
            "server_updated_at",
            "created_at",
        ]
        read_only_fields = ["version", "server_updated_at", "created_at"]

    def validate(self, attrs):
        case_type = attrs.get("case_type")
        program = attrs.get("program")
        if case_type and program and case_type.program_id != program.id:
            raise serializers.ValidationError("case_type must belong to the same program.")
        return attrs


class CaseListSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()
    programId = serializers.IntegerField(source="program_id")
    caseType = serializers.CharField(source="case_type.slug")
    priority = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    assignedAgentId = serializers.SerializerMethodField()
    version = serializers.IntegerField()
    updatedAt = serializers.DateTimeField(source="server_updated_at")

    def get_priority(self, obj):
        data = obj.data or {}
        return data.get("priority", "medium")

    def get_status(self, obj):
        s = obj.status or "active"
        if s == "active":
            return "in_progress"
        if s == "closed":
            return "closed"
        return "open"

    def get_assignedAgentId(self, obj):
        assignment = obj.assignments.filter(active=True).values_list("agent_id", flat=True).first()
        return assignment


class CaseCreateInputSerializer(serializers.Serializer):
    programId = serializers.IntegerField()
    caseType = serializers.CharField()
    title = serializers.CharField()
    priority = serializers.ChoiceField(choices=["low", "medium", "high"], default="medium", required=False)


class CaseUpdateSerializer(serializers.ModelSerializer):
    client_version = serializers.IntegerField(required=True)

    class Meta:
        model = Case
        fields = ["title", "data", "status", "client_version"]


class CaseAssignmentSerializer(serializers.Serializer):
    agent = serializers.PrimaryKeyRelatedField(queryset=Agent.objects.all(), required=False)
    agent_id = serializers.IntegerField(write_only=True, required=False)
    agentId = serializers.IntegerField(write_only=True, required=False)

    def validate(self, attrs):
        agent = attrs.get("agent")
        agent_id = attrs.get("agent_id") or attrs.get("agentId")
        if agent_id and not agent:
            try:
                attrs["agent"] = Agent.objects.get(id=agent_id)
            except Agent.DoesNotExist as exc:
                raise serializers.ValidationError({"agentId": "Agent not found."}) from exc
        return attrs


class AgentCreateSerializer(serializers.Serializer):
    program_id = serializers.IntegerField(required=False)
    programId = serializers.IntegerField(required=False)
    name = serializers.CharField(max_length=255)
    external_id = serializers.CharField(required=False, allow_blank=True, max_length=128)
    externalId = serializers.CharField(required=False, allow_blank=True, max_length=128)

    def validate(self, attrs):
        program_id = attrs.get("program_id") or attrs.get("programId")
        if not program_id:
            raise serializers.ValidationError({"program_id": "program_id is required."})

        try:
            program = Program.objects.get(id=program_id)
        except Program.DoesNotExist as exc:
            raise serializers.ValidationError({"program_id": f"Program {program_id} not found."}) from exc

        external_id = attrs.get("external_id") or attrs.get("externalId")
        if not external_id:
            external_id = f"agt-{uuid.uuid4().hex[:8]}"

        if Agent.objects.filter(program_id=program_id, external_id=external_id).exists():
            raise serializers.ValidationError({"external_id": "external_id already exists for this program."})

        attrs["program"] = program
        attrs["resolved_external_id"] = external_id
        return attrs


class CaseTimelineQuerySerializer(serializers.Serializer):
    limit = serializers.IntegerField(required=False, min_value=1, max_value=500, default=100)


class ExternalEventIngestSerializer(serializers.Serializer):
    program_id = serializers.IntegerField()
    case_id = serializers.IntegerField(required=False, allow_null=True)
    case_ref = serializers.CharField(required=False, allow_blank=True)
    source = serializers.CharField(max_length=64)
    external_event_id = serializers.CharField(max_length=128)
    event_type = serializers.CharField(max_length=64)
    payload = serializers.JSONField(required=False)
    client_reported_at = serializers.DateTimeField(required=False, allow_null=True)
    event_occurred_at = serializers.DateTimeField(required=False, allow_null=True)


class ExternalEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExternalEvent
        fields = [
            "id",
            "program",
            "case",
            "source",
            "external_event_id",
            "event_type",
            "payload",
            "client_reported_at",
            "server_received_at",
        ]
