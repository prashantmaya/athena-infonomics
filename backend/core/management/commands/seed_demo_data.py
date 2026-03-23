import json
from pathlib import Path

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.dateparse import parse_datetime

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
    help = "Seed demo data via the shared core command surface."

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            dest="file",
            default="fixtures/seed_demo_data.json",
            help="Path to seed data JSON, relative to backend/ or absolute.",
        )

    def _resolve_seed_path(self, file_arg: str) -> Path:
        candidate = Path(file_arg)
        if candidate.is_absolute():
            return candidate
        return Path.cwd() / candidate

    def _load_seed_payload(self, seed_path: Path) -> dict:
        raw = seed_path.read_text(encoding="utf-8")
        decoder = json.JSONDecoder()
        idx = 0
        payloads = []
        while idx < len(raw):
            while idx < len(raw) and raw[idx].isspace():
                idx += 1
            if idx >= len(raw):
                break
            payload, consumed = decoder.raw_decode(raw, idx)
            payloads.append(payload)
            idx = consumed
        if not payloads:
            raise CommandError(f"No valid JSON payload found in: {seed_path}")
        if not isinstance(payloads[0], dict):
            raise CommandError("Seed payload root must be a JSON object.")
        return payloads[0]

    @transaction.atomic
    def handle(self, *args, **options):
        seed_path = self._resolve_seed_path(options["file"])
        if not seed_path.exists():
            raise CommandError(f"Seed file does not exist: {seed_path}")

        seed = self._load_seed_payload(seed_path)
        programs_by_code = {}
        agents_by_key = {}
        cases_by_key = {}
        case_types_by_key = {}

        for item in seed.get("programs", []):
            program, _ = Program.objects.get_or_create(code=item["code"], defaults={"name": item["name"]})
            if program.name != item["name"]:
                program.name = item["name"]
                program.save(update_fields=["name"])
            programs_by_code[program.code] = program

        for item in seed.get("users", []):
            program = programs_by_code[item["program_code"]]
            user, created = User.objects.get_or_create(
                username=item["username"], defaults={"email": item.get("email", "")}
            )
            if created:
                user.set_password(item.get("password", "password123"))
                user.save(update_fields=["password"])
            UserProfile.objects.update_or_create(user=user, program=program, defaults={"role": item["role"]})

        for item in seed.get("agents", []):
            program = programs_by_code[item["program_code"]]
            linked_user = User.objects.get(username=item["username"]) if item.get("username") else None
            agent, _ = Agent.objects.update_or_create(
                program=program,
                external_id=item["external_id"],
                defaults={"name": item["name"], "user": linked_user},
            )
            agents_by_key[f"{program.code}:{agent.external_id}"] = agent

        for item in seed.get("supervisors", []):
            program = programs_by_code[item["program_code"]]
            linked_user = User.objects.get(username=item["username"]) if item.get("username") else None
            Supervisor.objects.update_or_create(program=program, name=item["name"], defaults={"user": linked_user})

        for item in seed.get("case_types", []):
            program = programs_by_code[item["program_code"]]
            case_type, _ = CaseTypeDefinition.objects.update_or_create(
                program=program,
                slug=item["slug"],
                defaults={
                    "name": item["name"],
                    "schema": item.get("schema", {}),
                    "validation_rules": item.get("validation_rules", {}),
                },
            )
            case_types_by_key[f"{program.code}:{case_type.slug}"] = case_type

        for item in seed.get("cases", []):
            program = programs_by_code[item["program_code"]]
            case_type = case_types_by_key[f"{program.code}:{item['case_type_slug']}"]
            case, _ = Case.objects.update_or_create(
                program=program,
                title=item["title"],
                defaults={"case_type": case_type, "data": item.get("data", {}), "status": item.get("status", Case.Status.ACTIVE)},
            )
            cases_by_key[f"{program.code}:{case.title}"] = case

        for item in seed.get("assignments", []):
            case = cases_by_key[f"{item['program_code']}:{item['case_title']}"]
            agent = agents_by_key[f"{item['program_code']}:{item['agent_external_id']}"]
            CaseAssignment.objects.filter(case=case, active=True).exclude(agent=agent).update(active=False)
            CaseAssignment.objects.get_or_create(case=case, agent=agent, active=True)

        for item in seed.get("activities", []):
            program = programs_by_code[item["program_code"]]
            case = cases_by_key[f"{item['program_code']}:{item['case_title']}"]
            agent = agents_by_key[f"{item['program_code']}:{item['agent_external_id']}"]
            Activity.objects.get_or_create(
                program=program,
                case=case,
                agent=agent,
                client_activity_id=item["client_activity_id"],
                defaults={
                    "activity_type": item["activity_type"],
                    "payload": item.get("payload", {}),
                    "client_reported_at": parse_datetime(item["client_reported_at"]),
                },
            )

        for item in seed.get("external_events", []):
            program = programs_by_code[item["program_code"]]
            case = cases_by_key.get(f"{item['program_code']}:{item['case_title']}")
            ExternalEvent.objects.get_or_create(
                program=program,
                source=item["source"],
                external_event_id=item["external_event_id"],
                defaults={
                    "case": case,
                    "event_type": item["event_type"],
                    "payload": item.get("payload", {}),
                    "client_reported_at": parse_datetime(item["client_reported_at"]) if item.get("client_reported_at") else None,
                },
            )

        self.stdout.write(self.style.SUCCESS("Demo seed data loaded successfully."))
