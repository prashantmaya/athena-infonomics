from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Program


class Phase2ApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.program = Program.objects.create(name="Program A", code="program-a")

    def test_health_endpoint(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)

    def test_case_types_requires_program_id(self):
        response = self.client.get("/api/case-types/")
        self.assertEqual(response.status_code, 400)
