#!/usr/bin/env python3
"""Valida el modelo CRM con JSON Schema 2020-12 y controles de referencias."""
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "compradores.json"
SCHEMA_PATH = ROOT / "compradores.schema.json"
EXPECTED_BUYERS = [
    ("restaurante", "restaurantes"),
    ("hotel", "hoteles"),
    ("cafeteria", "cafeterias"),
    ("oficina", "oficinas"),
    ("eventos", "eventos-catering"),
    ("conveniencia", "conveniencia"),
    ("panaderia", "panaderias"),
]
EXPECTED_STAGES = [
    "lead", "MQL", "SQL", "propuesta", "cierre", "alta", "activa",
    "reposición", "en_riesgo", "reactivación", "promotora",
]

def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)

schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema, format_checker=FormatChecker())
errors = sorted(validator.iter_errors(data), key=lambda e: list(e.absolute_path))
if errors:
    for error in errors:
        path = ".".join(map(str, error.absolute_path)) or "$"
        print(f"{path}: {error.message}", file=sys.stderr)
    raise SystemExit(1)

buyers = data["buyers"]
actual_buyers = [(b["code"], b["slug"]) for b in buyers]
if actual_buyers != EXPECTED_BUYERS:
    fail(f"códigos/slugs fuera de orden o distintos: {actual_buyers}")

stages = [item["stage"] for item in data["funnel"]]
if stages != EXPECTED_STAGES:
    fail(f"orden del embudo inesperado: {stages}")

source_ids = {item["id"] for item in data["source_catalog"]}
resource_ids = {item["id"] for item in data["resource_catalog"]}
email_ids = {item["id"] for item in data["email_catalog"]}
web_events = set(data["event_catalog"]["web"])
crm_events = set(data["event_catalog"]["crm"])
all_events = web_events | crm_events

if len(source_ids) != len(data["source_catalog"]):
    fail("hay source IDs duplicados")
if len(resource_ids) != len(data["resource_catalog"]):
    fail("hay resource IDs duplicados")
if len(email_ids) != len(data["email_catalog"]):
    fail("hay IDs de correo duplicados")

for buyer in buyers:
    refs = set(buyer["role_source_ids"])
    for role in buyer["roles"]:
        refs.update(role["source_ids"])
    for item in buyer["pain_points"]:
        refs.update(item["source_ids"])
    for item in buyer["objections"]:
        refs.update(item["source_ids"])
    missing = refs - source_ids
    if missing:
        fail(f"{buyer['code']}: fuentes no definidas {sorted(missing)}")

    for stage, content in buyer["content_by_stage"].items():
        missing_resources = set(content["resource_ids"]) - resource_ids
        missing_emails = set(content["email_ids"]) - email_ids
        if missing_resources:
            fail(f"{buyer['code']}/{stage}: recursos no definidos {sorted(missing_resources)}")
        if missing_emails:
            fail(f"{buyer['code']}/{stage}: correos no definidos {sorted(missing_emails)}")

    if set(buyer["next_best_action_by_state"]) != set(EXPECTED_STAGES):
        fail(f"{buyer['code']}: falta siguiente mejor acción por estado")
    missing_indicators = set(buyer["indicator_ids"]) - {i["id"] for i in data["indicator_definitions"]}
    if missing_indicators:
        fail(f"{buyer['code']}: indicadores no definidos {sorted(missing_indicators)}")

for item in data["funnel"]:
    if set(item["events"]) - all_events:
        fail(f"evento fuera de MAPA.md en etapa {item['stage']}: {sorted(set(item['events']) - all_events)}")
for item in data["indicator_definitions"]:
    if set(item["events"]) - all_events:
        fail(f"evento fuera de MAPA.md en indicador {item['id']}: {sorted(set(item['events']) - all_events)}")

print("PASS · JSON Schema 2020-12 y referencias semánticas")
print(f"PASS · {len(buyers)} compradores, {len(stages)} etapas, {len(data['recovery_scenarios'])} escenarios, {len(data['assistant_flows'])} asistentes")
print("PASS · fuentes, guías/soluciones, correos e indicadores referenciados")
