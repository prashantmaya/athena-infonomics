from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Case, CaseTypeDefinition, Program


class Phase4TimelineTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.program = Program.objects.create(name="Program A", code="program-a")
        self.case_type = CaseTypeDefinition.objects.create(
            program=self.program, name="Home Visit", slug="home-visit", schema={}, validation_rules={}
        )
        self.case = Case.objects.create(program=self.program, case_type=self.case_type, title="Case 1", data={})

    def test_timeline_endpoint_smoke(self):
        response = self.client.get(f"/api/cases/{self.case.id}/timeline/")
        self.assertEqual(response.status_code, 200)
