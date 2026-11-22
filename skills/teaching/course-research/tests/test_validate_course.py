import shutil
import subprocess
import sys
from pathlib import Path

import pytest

import frontmatter
from validate_course import computed_code_status, parse_marker, validate_course

FIXTURE = Path(__file__).parent / "fixtures" / "valid-course"
PART1 = "part-01-first-agent.md"
PART2 = "part-02-graphs.md"
SCOPE = "_work/scope.md"


@pytest.fixture
def course(tmp_path) -> Path:
    target = tmp_path / "course"
    shutil.copytree(FIXTURE, target)
    return target


def edit(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    assert text.count(old) == 1, f"{old!r} must occur exactly once in {path.name}"
    path.write_text(text.replace(old, new), encoding="utf-8")


def edit_frontmatter(path: Path, **changes) -> None:
    text = path.read_text(encoding="utf-8")
    data, _ = frontmatter.parse(text)
    data.update(changes)
    path.write_text(frontmatter.replace(text, data), encoding="utf-8")


def errors(course_dir: Path):
    return [issue for issue in validate_course(course_dir) if issue.level == "error"]


def assert_error(course_dir: Path, *needles: str) -> None:
    found = errors(course_dir)
    text = [f"{i.file}:{i.where}: {i.message}" for i in found]
    assert any(all(n in line for n in needles) for line in text), text


def test_valid_course_has_no_issues():
    assert validate_course(FIXTURE) == []


def test_parse_marker_decodes_quotes():
    line = '<!-- snippet id="1.1-a" status="unverified" reason="KeyError: &quot;x&quot;" -->'
    assert parse_marker(line) == {"id": "1.1-a", "status": "unverified", "reason": 'KeyError: "x"'}
    assert parse_marker("```python") is None


def test_computed_code_status():
    assert computed_code_status([]) == "none"
    assert computed_code_status([{"status": "verified"}, {"status": "verified"}]) == "verified"
    assert computed_code_status([{"status": "verified"}, {}]) == "partial"
    assert computed_code_status([{"status": "unverified"}, {}]) == "unverified"


def test_missing_section(course):
    edit(course / PART1, "## Core mental model\n", "")
    assert_error(course, PART1, "Core mental model")


def test_sections_out_of_order(course):
    path = course / PART1
    edit(path, "## Context\n", "## SWAP\n")
    edit(path, "## Key terms\n", "## Context\n")
    edit(path, "## SWAP\n", "## Key terms\n")
    assert_error(course, PART1, "section")


def test_subtopic_numbering_gap(course):
    edit(course / PART1, "### 1.2 ", "### 1.3 ")
    assert_error(course, PART1, "1.3")


def test_self_paced_requires_self_check(course):
    edit(course / PART1, "1. ทำไมต้องใส่ `openai:` หน้าชื่อโมเดล? — เฉลย: เพื่อบอกว่าใช้ผู้ให้บริการไหน", "_None._")
    assert_error(course, PART1, "Self-check")
    edit_frontmatter(course / SCOPE, delivery_mode="instructor-led")
    assert errors(course) == []


def test_required_slot_cannot_be_empty_marker(course):
    edit(course / PART2, "`StateGraph` รับชนิดของ state แล้วเพิ่ม node และ edge ([Source](https://docs.langchain.com/oss/python/langgraph/graph-api))", "_None._")
    assert_error(course, PART2, "Core knowledge")


def test_subtopic_sources_need_url(course):
    edit(course / PART1, "- [LangChain models guide](https://docs.langchain.com/oss/python/langchain/models)", "- เอกสาร models")
    assert_error(course, PART1, "1.1", "Sources")


def test_python_block_without_marker(course):
    edit(course / PART1, '<!-- snippet id="1.1-a" status="verified" checked="2026-11-22" -->\n', "")
    assert_error(course, PART1, "marker")


def test_hash_comment_in_code_is_not_a_heading():
    text = (FIXTURE / PART1).read_text(encoding="utf-8")
    assert "# เลือกผู้ให้บริการด้วย prefix" in text
    assert validate_course(FIXTURE) == []


def test_expected_output_required_when_self_paced(course):
    edit(course / PART2, "**Expected output:**\n", "")
    assert_error(course, PART2, "Expected output")


def test_non_python_block_needs_skip(course):
    edit(course / PART2, "```python\nfrom typing import TypedDict", "```javascript\nfrom typing import TypedDict")
    assert_error(course, PART2, "skip")


def test_code_status_must_match_markers(course):
    edit(course / PART1, '<!-- snippet id="1.2-a" status="verified"', '<!-- snippet id="1.2-a" status="unverified"')
    assert_error(course, PART1, "code_status", "partial")


def test_snippet_id_must_name_its_part(course):
    edit(course / PART2, 'id="2.1-a"', 'id="1.9-a"')
    assert_error(course, PART2, "1.9-a")


def test_outcome_not_covered(course):
    scope = course / SCOPE
    data, _ = frontmatter.parse(scope.read_text(encoding="utf-8"))
    edit_frontmatter(scope, outcomes={**data["outcomes"], "O4": "ข้อใหม่"})
    assert_error(course, "O4", "not covered")


def test_part_outcome_unknown(course):
    edit_frontmatter(course / PART2, outcomes=["O9"])
    assert_error(course, PART2, "O9")


def test_forward_prerequisite(course):
    edit_frontmatter(course / PART1, prerequisite_parts=[2])
    assert_error(course, PART1, "prerequisite")


def test_part_numbering_gap(course):
    (course / PART2).rename(course / "part-03-graphs.md")
    assert_error(course, "part-03-graphs.md")


def test_unpinned_package(course):
    edit_frontmatter(course / SCOPE, packages=["langchain"])
    assert_error(course, "scope", "==")


def test_duplicate_snippet_id(course):
    edit(course / PART1, 'id="1.2-a"', 'id="1.1-a"')
    assert_error(course, "1.1-a", "duplicate")


def test_overview_missing_part_title(course):
    edit(course / "00-overview.md", "| 2 | เปิดดูข้างในด้วย StateGraph |", "| 2 | กราฟ |")
    assert_error(course, "00-overview.md", "Part map")


def test_cli_exit_codes(course, skill_dir):
    script = skill_dir / "scripts" / "validate_course.py"
    ok = subprocess.run([sys.executable, str(script), str(course)], capture_output=True, text=True)
    assert ok.returncode == 0, ok.stdout + ok.stderr
    edit(course / PART1, "## Core mental model\n", "")
    bad = subprocess.run([sys.executable, str(script), str(course)], capture_output=True, text=True)
    assert bad.returncode == 1
    assert bad.stdout.startswith("ERROR ")
