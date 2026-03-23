from core.models import QualityIssue


def quality_score_from_issue_counts(warning_count: int, critical_count: int) -> int:
    return max(0, 100 - (warning_count * 2) - (critical_count * 10))


def create_activity_quality_issues(activity) -> None:
    payload = activity.payload or {}
    issues = []

    if not payload.get("notes"):
        issues.append(
            QualityIssue(
                program=activity.program,
                case=activity.case,
                issue_type="missing_notes",
                message="Activity payload is missing notes.",
                severity=QualityIssue.Severity.WARNING,
                metadata={"client_activity_id": activity.client_activity_id},
            )
        )

    if payload.get("duration_minutes") is not None and payload.get("duration_minutes", 0) < 0:
        issues.append(
            QualityIssue(
                program=activity.program,
                case=activity.case,
                issue_type="invalid_duration",
                message="Activity duration cannot be negative.",
                severity=QualityIssue.Severity.CRITICAL,
                metadata={"client_activity_id": activity.client_activity_id},
            )
        )

    if issues:
        QualityIssue.objects.bulk_create(issues)


def create_conflict_issue(case, client_version: int, server_version: int) -> None:
    QualityIssue.objects.create(
        program=case.program,
        case=case,
        issue_type="version_conflict",
        message="Offline edit conflicted with a newer server version.",
        severity=QualityIssue.Severity.WARNING,
        metadata={
            "client_version": client_version,
            "server_version": server_version,
        },
    )
