from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Program


class Phase6QualityDashboardTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.program = Program.objects.create(name="Program A", code="program-a")

    def test_dashboard_metrics_smoke(self):
        response = self.client.get(f"/api/dashboard/metrics/?program_id={self.program.id}")
        self.assertEqual(response.status_code, 200)

    def test_quality_issues_smoke(self):
        response = self.client.get(f"/api/quality/issues/?program_id={self.program.id}")
        self.assertEqual(response.status_code, 200)
