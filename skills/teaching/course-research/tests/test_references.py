import re

import pytest

import frontmatter
from contract import OVERVIEW_FRONTMATTER_KEYS, OVERVIEW_SECTIONS, PART_FRONTMATTER_KEYS, PART_SECTIONS, SUBTOPIC_SLOTS
from validate_course import scan


def read(skill_dir, name: str) -> str:
    return (skill_dir / "references" / name).read_text(encoding="utf-8")


def skeleton(text: str, kind: str) -> str:
    match = re.search(rf"<!-- skeleton:{kind} -->\n(.*?)\n<!-- /skeleton:{kind} -->", text, re.S)
    assert match, f"no {kind} skeleton"
    lines = match.group(1).strip("\n").split("\n")
    if lines[0].startswith("````"):
        lines = lines[1:-1]
    return "\n".join(lines) + "\n"


def headings(body: str, level: int) -> list[str]:
    return [h.text for h in scan(body).headings if h.level == level]


def test_part_skeleton_matches_contract(skill_dir):
    data, body = frontmatter.parse(skeleton(read(skill_dir, "part-template.md"), "part"))
    assert tuple(data) == PART_FRONTMATTER_KEYS
    assert tuple(headings(body, 2)) == PART_SECTIONS
    doc = scan(body)
    first = next(h for h in doc.headings if h.level == 3)
    second = next((h.line for h in doc.headings if h.level <= 3 and h.line > first.line), len(doc.lines))
    slots = [h.text for h in doc.headings if h.level == 4 and first.line < h.line < second]
    assert tuple(slots) == SUBTOPIC_SLOTS


def test_overview_skeleton_matches_contract(skill_dir):
    data, body = frontmatter.parse(skeleton(read(skill_dir, "part-template.md"), "overview"))
    assert tuple(data) == OVERVIEW_FRONTMATTER_KEYS
    assert tuple(headings(body, 2)) == OVERVIEW_SECTIONS


@pytest.mark.parametrize("needle", ["init_chat_model", 'skip="', '"responses"', "results.json", "check_code.py", "InMemoryVectorStore", "response_format"])
def test_code_check_doc_names_conventions(skill_dir, needle):
    assert needle in read(skill_dir, "code-check.md")
