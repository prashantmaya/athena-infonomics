from django.contrib.auth.models import User
from django.db import models
from django.db.models import Q


class Program(models.Model):
    name = models.CharField(max_length=255)
    code = models.SlugField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


class UserProfile(models.Model):
    class Role(models.TextChoices):
        COORDINATOR = "coordinator", "Coordinator"
        AGENT = "agent", "Agent"
        SUPERVISOR = "supervisor", "Supervisor"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name="user_profiles")
    role = models.CharField(max_length=24, choices=Role.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "program")

    def __str__(self) -> str:
        return f"{self.user.username} - {self.role}"


class Agent(models.Model):
    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name="agents")
    user = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        related_name="agent_profile",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=255)
    external_id = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("program", "external_id")

    def __str__(self) -> str:
        return f"{self.name} [{self.program.code}]"


class Supervisor(models.Model):
    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name="supervisors")
    user = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        related_name="supervisor_profile",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.name} [{self.program.code}]"


class CaseTypeDefinition(models.Model):
    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name="case_type_definitions")
    name = models.CharField(max_length=255)
    slug = models.SlugField()
    schema = models.JSONField(default=dict)
    validation_rules = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("program", "slug")

    def __str__(self) -> str:
        return f"{self.program.code}:{self.slug}"


class Case(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        CLOSED = "closed", "Closed"

    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name="cases")
    case_type = models.ForeignKey(
        CaseTypeDefinition,
        on_delete=models.PROTECT,
        related_name="cases",
    )
    title = models.CharField(max_length=255)
    data = models.JSONField(default=dict)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE)
    version = models.PositiveIntegerField(default=1)
    server_updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.program.code}:{self.id}:{self.title}"


class CaseAssignment(models.Model):
    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name="assignments")
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name="assignments")
    active = models.BooleanField(default=True)
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["case"],
                condition=Q(active=True),
                name="core_unique_active_assignment_per_case",
            ),
        ]

    def __str__(self) -> str:
        return f"Case {self.case_id} -> Agent {self.agent_id}"


class SyncSession(models.Model):
    class Status(models.TextChoices):
        STARTED = "started", "Started"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name="sync_sessions")
    agent = models.ForeignKey(
        Agent,
        on_delete=models.SET_NULL,
        related_name="sync_sessions",
        null=True,
        blank=True,
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.STARTED)
    request_id = models.CharField(max_length=64, unique=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"{self.request_id} [{self.status}]"


class Activity(models.Model):
    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name="activities")
    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name="activities")
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name="activities")
    sync_session = models.ForeignKey(
        SyncSession,
        on_delete=models.SET_NULL,
        related_name="activities",
        null=True,
        blank=True,
    )
    client_activity_id = models.CharField(max_length=128)
    activity_type = models.CharField(max_length=64)
    payload = models.JSONField(default=dict)
    client_reported_at = models.DateTimeField()
    server_received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["program", "agent", "client_activity_id"],
                name="core_unique_activity_client_key",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.client_activity_id} ({self.activity_type})"


class SyncState(models.Model):
    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name="sync_states")
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name="sync_states")
    updates_token = models.CharField(max_length=128, blank=True, default="")
    last_pull_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("program", "agent")

    def __str__(self) -> str:
        return f"{self.program.code}:{self.agent_id}"


class ExternalEvent(models.Model):
    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name="external_events")
    case = models.ForeignKey(
        Case,
        on_delete=models.SET_NULL,
        related_name="external_events",
        null=True,
        blank=True,
    )
    source = models.CharField(max_length=64)
    external_event_id = models.CharField(max_length=128)
    event_type = models.CharField(max_length=64)
    payload = models.JSONField(default=dict)
    client_reported_at = models.DateTimeField(null=True, blank=True)
    server_received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["program", "source", "external_event_id"],
                name="core_unique_external_event_key",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.source}:{self.external_event_id}"


class QualityIssue(models.Model):
    class Severity(models.TextChoices):
        WARNING = "warning", "Warning"
        CRITICAL = "critical", "Critical"

    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name="quality_issues")
    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name="quality_issues")
    issue_type = models.CharField(max_length=64)
    message = models.CharField(max_length=512)
    severity = models.CharField(max_length=16, choices=Severity.choices, default=Severity.WARNING)
    metadata = models.JSONField(default=dict)
    resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.issue_type}:{self.case_id}"

