import json
import subprocess
import sys
from pathlib import Path

import pytest

from assemble_deck import assemble
from conftest import add_field, drop_slide, edit, set_field, set_meta, set_visual
from part_reader import find_part
from validate_deck import validate, validate_diagrams, validate_plan

SCRIPT = str(Path(__file__).resolve().parents[1] / "scripts" / "validate_deck.py")
WORK = "slides/_work/part-01"
MODELS = "https://docs.langchain.com/oss/python/langchain/models"


def errors(course):
    return [f"{i.where}: {i.message}" for i in validate(course, 1) if i.level == "error"]


def run_cli(*args):
    return subprocess.run([sys.executable, SCRIPT, *map(str, args)], capture_output=True, text=True)


def visual_of(path, slide_id):
    from deck import parse_deck

    return next(s for s in parse_deck(path.read_text(encoding="utf-8")).slides() if s.id == slide_id).visual


def test_assembled_fixture_is_valid(course, assembled):
    assert errors(course) == []
    assert [i for i in validate(course, 1) if i.level == "warning"] == []


CODE_1_011 = 'model = init_chat_model("openai:gpt-5")'


@pytest.mark.parametrize("old,new,message", [
    (CODE_1_011, 'model = init_chat_model("openai:gpt-4")', "1-011: code excerpt differs from snippet 1.1-a"),
    ('"at": [5, 4]', '"at": [5, 1]', "nodes overlap: n-model, n-tool"),
    ('"concept": "tool"', '"concept": "robot"', "unknown concept 'robot'"),
    ('"layout": "summary"', '"layout": "summery"', "unknown layout 'summery'"),
    ('"revisit": "1-018"', '"revisit": "1-035"', "1-030: revisit must point to an earlier slide"),
    ('slide_count: 35', 'slide_count: 36', "frontmatter slide_count should be 35"),
    ('(ตัวอย่าง คำตอบจริงจาก LLM จะต่างไป) สวัสดีครับ', 'สวัสดีครับ', "1-012: output differs from the Part for snippet 1.1-a"),
    ('"lines": [[3, 5]]', '"lines": [[3, 9]]', "1-011: lines must be ascending"),
    ('pip install langchain==1.5.2', 'pip install langchain==0.3', "1-005: block not in the Part"),
    ('## Closing', '## Ending', "sections must be"),
    ('**Cause:** ชื่อโมเดล', '**Why:** ชื่อโมเดล', "1-014: missing field Cause"),
    ('"snippet": "1.2-a", "status": "verified"', '"snippet": "1.2-a", "status": "skipped"', "listing status"),
])
def test_mutations_are_caught(course, assembled, old, new, message):
    edit(assembled, old, new, first=True)
    assert any(message in e for e in errors(course)), errors(course)


def test_missing_slot(course, assembled):
    assembled.write_text(drop_slide(assembled.read_text(encoding="utf-8"), "1-013"), encoding="utf-8")
    assert "coverage: not covered: 1.1/Misconceptions" in errors(course)


def test_new_mismatch(course, assembled):
    set_visual(assembled, "1-022", {**visual_of(assembled, "1-022"), "new": ["n-tool"]})
    assert "1-022: `new` does not match what this slide adds: expected [e-call, n-tool]" in errors(course)


def test_text_over_limit(course, assembled):
    set_field(assembled, "1-009", "Body", "ก" * 421)
    assert "1-009: too long: Body has 421 characters, limit 420" in errors(course)


def test_thai_marks_do_not_count(course, assembled):
    set_field(assembled, "1-009", "Body", "ที่" * 140)
    assert not any("too long" in e for e in errors(course))


def test_item_over_limit(course, assembled):
    edit(assembled, "1. คิด: model", "1. " + "ก" * 81 + " model", first=True)
    assert any(e.startswith("1-007: too long: Items item 1 has") for e in errors(course))


def test_stale_part(course, assembled):
    edit(find_part(course, 1), 'generated: "2026-11-22"', 'generated: "2026-12-01"')
    assert any("stale: the Part changed after this deck (Part generated 2026-12-01)" in e for e in errors(course))


def test_stale_when_the_part_text_changes_on_the_same_day(course, assembled):
    edit(find_part(course, 1), "## Practice material\n", "## Practice material\n\nแก้ไขเพิ่มเติม\n")
    assert errors(course) == ["frontmatter: stale: the Part changed after this deck (Part generated 2026-11-22, but its text changed); "
                              "redo the storyboard and assemble again"]


def test_inline_code_not_in_part(course, assembled):
    from deck import parse_deck

    body = next(s for s in parse_deck(assembled.read_text(encoding="utf-8")).slides() if s.id == "1-021").fields["Body"].text
    set_field(assembled, "1-021", "Body", body + ' `get_weather("Bangkok")`')
    assert '1-021: inline code not in the Part: `get_weather("Bangkok")`' in errors(course)


def test_unverified_snippet_needs_notice(course):
    edit(find_part(course, 1), '<!-- snippet id="1.1-a" status="verified" checked="2026-11-22" -->', '<!-- snippet id="1.1-a" status="unverified" reason="boom" -->')
    assemble(course, 1)
    assert "1-010: needs a Notice: snippet 1.1-a is unverified" in errors(course)
    draft = course / WORK / "sections/1.1.md"
    for slide_id in ("1-010", "1-010a", "1-011"):
        add_field(draft, slide_id, "Notice", "โค้ดนี้ยังไม่ได้ทดสอบรันจริง")
    assemble(course, 1)
    assert not any("needs a Notice" in e for e in errors(course)), errors(course)


def test_source_not_in_part(course, assembled):
    set_meta(assembled, "1-009", "sources", [MODELS, "https://example.com/x"])
    assert "1-009: source not in the Part: https://example.com/x" in errors(course)


def test_cross_section_ref(course, assembled):
    set_meta(assembled, "1-012", "from", ["1.2/Worked example"])
    assert "1-012: content from 1.2 in section 1.1" in errors(course)


@pytest.mark.parametrize("ref,message", [("1.1/Analogy", "ref points to an empty slot"), ("9.9/Analogy", "unknown ref")])
def test_bad_refs(course, assembled, ref, message):
    set_meta(assembled, "1-009", "from", ["1.1/Core knowledge", ref])
    assert any(e.startswith("1-009: " + message) for e in errors(course))


def test_illustration_rules(course, assembled):
    visual = visual_of(assembled, "1-025")
    set_visual(assembled, "1-025", {k: v for k, v in visual.items() if k != "fallback"})
    assert any(e.startswith("1-025: needs a fallback") for e in errors(course))
    set_visual(assembled, "1-025", {**visual, "prompt": "An office worker opens a manual."})
    assert "1-025: prompt must end with the illustration style" in errors(course)


def test_layout_visual_rules(course, assembled):
    set_visual(assembled, "1-009", {"kind": "chart"})
    assert "1-009: unknown visual kind 'chart'" in errors(course)
    edit(assembled, "```visual\n" + json.dumps(visual_of(assembled, "1-009"), ensure_ascii=False) + "\n```\n", "")
    assert "1-009: needs a visual" in errors(course)


def test_unused_diagram_is_a_warning(course, assembled):
    edit(assembled, '"diagram": "d-init"', '"diagram": "d-agent-loop"', first=True)
    issues = validate(course, 1)
    assert any(i.level == "warning" and i.where == "d-init" and i.message == "unused diagram" for i in issues)


def test_diagrams_mode(course):
    assert validate_diagrams(course, 1) == []
    edit(course / WORK / "diagrams.md", '"concept": "tool"', '"concept": "graph"')
    assert any("unknown concept 'graph'" in i.message for i in validate_diagrams(course, 1))
    (course / WORK / "new-concepts.json").write_text(json.dumps([{"id": "graph", "meaning": "x", "shape": "box", "role": "secondary", "icon": ""}]), encoding="utf-8")
    assert validate_diagrams(course, 1) == []


def test_diagrams_mode_refuses_a_changed_concept(course):
    (course / WORK / "new-concepts.json").write_text(json.dumps([{"id": "model", "meaning": "x", "shape": "box", "role": "accent", "icon": ""}]), encoding="utf-8")
    assert any("append-only" in i.message for i in validate_diagrams(course, 1))


def test_diagrams_mode_without_a_vocabulary(course):
    (course / "slides/visual-vocabulary.md").unlink()
    assert any("unknown concept 'model'" in i.message for i in validate_diagrams(course, 1))


def test_missing_deck(course):
    assert any("run assemble_deck.py" in i.message for i in validate(course, 1))


def test_cli_exit_codes(course, assembled):
    clean = run_cli(course, 1)
    assert clean.returncode == 0, clean.stdout
    assert run_cli(course, 1, "--diagrams").returncode == 0
    edit(assembled, '"at": [5, 4]', '"at": [5, 1]', first=True)
    broken = run_cli(course, 1)
    assert broken.returncode == 1 and "error: d-agent-loop: nodes overlap: n-model, n-tool" in broken.stdout
    listed = json.loads(run_cli(course, 1, "--json").stdout)
    assert {"level": "error", "where": "d-agent-loop", "message": "nodes overlap: n-model, n-tool"} in listed


def test_plan_mode(course):
    assert [i for i in validate_plan(course, 1) if i.level == "error"] == []


def test_plan_without_units_file(course):  # Review Focus 2
    (course / WORK / "units.json").unlink()
    assert any("no unit map" in i.message and i.where == "units.json" for i in validate_plan(course, 1))


def test_plan_reports_unit_errors(course):
    edit(course / WORK / "units.json", '"needs": ["u-tool"]', '"needs": ["u-nope"]')
    assert any("needs must name earlier units, not u-nope" in i.message for i in validate_plan(course, 1))


def test_plan_reports_diagram_errors_too(course):
    edit(course / WORK / "diagrams.md", '"d-init"', '"d-Init"', first=True)
    assert any(i.where != "units.json" for i in validate_plan(course, 1) if i.level == "error")


def test_cli_plan_flag(course):
    assert run_cli(course, 1, "--plan").returncode == 0
    (course / WORK / "units.json").unlink()
    assert run_cli(course, 1, "--plan").returncode == 1
