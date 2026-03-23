from django.urls import path

from core.views import (
    AgentListAPIView,
    AssignCaseAPIView,
    CaseDetailAPIView,
    CaseListCreateAPIView,
    CaseTimelineAPIView,
    CaseTypeListAPIView,
    DashboardMetricsAPIView,
    ExternalEventIngestAPIView,
    HealthAPIView,
    ProgramListAPIView,
    QualityIssueListAPIView,
    SyncPullAPIView,
    SyncPushAPIView,
)

urlpatterns = [
    path("health/", HealthAPIView.as_view(), name="health"),
    path("programs/", ProgramListAPIView.as_view(), name="program-list"),
    path("case-types/", CaseTypeListAPIView.as_view(), name="case-type-list"),
    path("cases/", CaseListCreateAPIView.as_view(), name="case-list-create"),
    path("cases/<int:case_id>/", CaseDetailAPIView.as_view(), name="case-detail"),
    path("cases/<int:case_id>/assign/", AssignCaseAPIView.as_view(), name="case-assign"),
    path("cases/<int:case_id>/timeline/", CaseTimelineAPIView.as_view(), name="case-timeline"),
    path("sync/push/", SyncPushAPIView.as_view(), name="sync-push"),
    path("sync/pull/", SyncPullAPIView.as_view(), name="sync-pull"),
    path("agent/sync/push/", SyncPushAPIView.as_view(), name="agent-sync-push"),
    path("agent/sync/pull/", SyncPullAPIView.as_view(), name="agent-sync-pull"),
    path("events/ingest/", ExternalEventIngestAPIView.as_view(), name="external-event-ingest"),
    path("external-events/ingest/", ExternalEventIngestAPIView.as_view(), name="external-event-ingest-alias"),
    path("dashboard/metrics/", DashboardMetricsAPIView.as_view(), name="dashboard-metrics"),
    path("quality/issues/", QualityIssueListAPIView.as_view(), name="quality-issues"),
    path("programs/agents/", AgentListAPIView.as_view(), name="program-agents"),
]
