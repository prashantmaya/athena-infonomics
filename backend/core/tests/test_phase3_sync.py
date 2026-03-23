from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Agent, Case, CaseAssignment, CaseTypeDefinition, Program


class Phase3SyncTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.program = Program.objects.create(name="Program A", code="program-a")
        self.agent = Agent.objects.create(program=self.program, name="Agent One", external_id="agent-1")
        self.case_type = CaseTypeDefinition.objects.create(
            program=self.program, name="Home Visit", slug="home-visit", schema={}, validation_rules={}
        )
        self.case = Case.objects.create(program=self.program, case_type=self.case_type, title="Case 1", data={})
        CaseAssignment.objects.create(case=self.case, agent=self.agent, active=True)

    def test_sync_push_smoke(self):
        payload = {
            "program_id": self.program.id,
            "agent_id": self.agent.id,
            "request_id": "sync-smoke",
            "activities": [
                {
                    "client_activity_id": "activity-1",
                    "case_id": self.case.id,
                    "activity_type": "visit_completed",
                    "payload": {"notes": "ok"},
                    "client_reported_at": timezone.now().isoformat(),
                }
            ],
        }
        response = self.client.post("/api/sync/push/", payload, format="json")
        self.assertEqual(response.status_code, 200)
