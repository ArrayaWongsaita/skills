import pytest

from conftest import edit
from part_reader import PartError, find_part, read_overview, read_part


def test_reads_fixture_part(course):
    part = read_part(find_part(course, 1))
    assert (part.number, part.title) == (1, "Agent ตัวแรกด้วย create_agent")
    assert part.section_keys() == ["opening", "1.1", "1.2", "closing"]


def test_slot_refs_skip_empty_slots(course):
    assert read_part(find_part(course, 1)).slot_refs() == [
        "Objectives", "Prerequisites and setup", "Key terms", "Core mental model", "Real-world task",
        "1.1/Core knowledge", "1.1/Worked example", "1.1/Misconceptions", "1.1/Common errors and fixes", "1.1/Self-check",
        "1.2/Core knowledge", "1.2/Worked example", "1.2/Analogy", "1.2/Misconceptions", "1.2/Common errors and fixes", "1.2/Self-check",
        "Practice material", "Bridge to next part", "Further reading", "Sources"]


def test_snippet_code_status_and_expected_output(course):
    snippet = read_part(find_part(course, 1)).snippets["1.1-a"]
    assert snippet.code.splitlines()[0] == "from langchain.chat_models import init_chat_model"
    assert len(snippet.code.splitlines()) == 5
    assert (snippet.lang, snippet.status, snippet.subtopic, snippet.expected_info) == ("python", "verified", "1.1", "text illustrative")
    assert snippet.expected.startswith("(ตัวอย่าง")


@pytest.mark.parametrize("marker,status,reason", [
    ('<!-- snippet id="1.1-a" status="unverified" reason="boom" -->', "unverified", "boom"),
    ('<!-- snippet id="1.1-a" skip="needs a key" -->', "skipped", "needs a key"),
    ('<!-- snippet id="1.1-a" -->', "unverified", "not checked"),
])
def test_snippet_status_mapping(course, marker, status, reason):
    path = find_part(course, 1)
    edit(path, '<!-- snippet id="1.1-a" status="verified" checked="2026-11-22" -->', marker)
    snippet = read_part(path).snippets["1.1-a"]
    assert (snippet.status, snippet.reason) == (status, reason)


def test_expected_output_after_an_unverified_line(course):
    path = find_part(course, 1)
    edit(path, 'print(model.invoke("สวัสดี").content)\n```\n', 'print(model.invoke("สวัสดี").content)\n```\n\n> ⚠️ Unverified: boom\n')
    assert read_part(path).snippets["1.1-a"].expected.startswith("(ตัวอย่าง")


def test_ref_text_and_urls(course):
    part = read_part(find_part(course, 1))
    assert part.ref_text("1.2/Analogy").startswith("เหมือนพนักงาน")
    assert part.ref_text("1.1/Analogy") == "_None._" and part.ref_text("9.9/Analogy") is None
    assert part.ref_text("Objectives").startswith("- O1")
    assert "https://docs.langchain.com/oss/python/langchain/models" in part.urls


def test_rejects_other_template(course):
    path = find_part(course, 1)
    edit(path, '"course-research/part@1"', '"course-research/part@2"')
    with pytest.raises(PartError, match="course-research/part@1"):
        read_part(path)


def test_find_part_missing(course):
    with pytest.raises(PartError, match="part 3"):
        find_part(course, 3)


def test_read_overview(course):
    overview = read_overview(course)
    assert overview.title == "LangChain และ LangGraph สำหรับผู้เริ่มต้น"
    assert overview.glossary == [("เอเจนต์", "โมเดลที่ตัดสินใจเรียก tool เองเป็นวงรอบ", "Agent")]


def test_rejects_other_overview_template(course):
    edit(course / "00-overview.md", '"course-research/overview@1"', '"x"')
    with pytest.raises(PartError, match="course-research/overview@1"):
        read_overview(course)
