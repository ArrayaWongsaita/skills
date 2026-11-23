import re

import pytest

import deck_reader
from conftest import replace


def _deck(course):
    return course / "slides" / "part-01-first-agent.md"


def test_load_fixture_part_one(course):
    loaded = deck_reader.load(course, 1)
    assert loaded.stale is False
    assert loaded.vocabulary.style.startswith("Hand-drawn")
    assert loaded.vocabulary.roles["primary"] == "#1A73E8"
    assert {c["id"] for c in loaded.vocabulary.concepts} >= {"user", "model", "tool"}
    assert len(loaded.deck.slides()) == loaded.deck.meta["slide_count"] == 25
    assert len(loaded.sha256) == 64


def test_stale_and_missing_part_file(course):
    assert deck_reader.load(course, 2).stale is True
    (course / "part-01-first-agent.md").unlink()
    assert deck_reader.load(course, 1).stale is None


PART2 = "slides/part-02-graphs.md"


def test_wrong_templates_are_refused(course):
    assert deck_reader.load(course, 2).deck.meta["template"] == "slide-design/deck@1"
    replace(course / PART2, '"slide-design/deck@1"', '"slide-design/deck@9"')
    with pytest.raises(deck_reader.DeckError) as raised:
        deck_reader.load(course, 2)
    assert "slide-design/deck@9" in str(raised.value)
    assert "slide-design/deck@1" in str(raised.value) and "slide-design/deck@2" in str(raised.value)


def test_vocabulary_template_is_checked(course):
    replace(course / "slides" / "visual-vocabulary.md", "vocabulary@1", "vocabulary@9")
    with pytest.raises(deck_reader.DeckError, match="vocabulary@9"):
        deck_reader.read_vocabulary(course)


def test_missing_deck_is_named(course):
    with pytest.raises(deck_reader.DeckError, match="part-03"):
        deck_reader.find_deck(course, 3)


@pytest.mark.parametrize("old,new,message", [
    ("### 1-008 · explain", "### 1-008 · fancy", "unknown layout fancy"),
    ('"revisit": "1-014"', '"revisit": "9-911"', "revisit"),
    ('"diagram": "d-agent-loop", "show": ["n-user", "n-model", "e-ask", "e-answer"], "new"', '"diagram": "d-missing", "show": ["n-user"], "new"', "d-missing"),
    ('"snippet": "1.2-a", "lines"', '"snippet": "nope", "lines"', "nope"),
    ('"lines": [[1, 2], [5, 6]]', '"lines": [[5, 6], [1, 2]]', "lines"),
    ('"highlight": [[5, 5]]', '"highlight": [[3, 3]]', "highlight"),
    ('"show": ["n-user", "n-model", "e-ask", "e-answer"], "new"', '"show": ["n-user", "n-ghost"], "new"', "n-ghost"),
    ('"status": "unverified"', '"status": "maybe"', "maybe"),
    ('"text": "วนจนได้คำตอบ", "near": "e-call"', '"text": "วนจนได้คำตอบ", "near": "e-nowhere"', "e-nowhere"),
])
def test_render_errors_name_the_problem(course, old, new, message):
    replace(_deck(course), old, new)
    with pytest.raises(deck_reader.DeckError) as info:
        deck_reader.load(course, 1)
    assert message in str(info.value)


def test_error_lines_name_the_line_and_slide(course):
    replace(_deck(course), '"revisit": "1-014"', '"revisit": "9-911"')
    with pytest.raises(deck_reader.DeckError) as info:
        deck_reader.load(course, 1)
    assert any(error.startswith("line ") and ": 1-021: " in error for error in info.value.errors)


def test_excerpt_differing_from_snippet_is_refused(course):
    replace(_deck(course), "def get_weather(city: str) -> str:\n```", "def get_weather(city: str) -> int:\n```")
    with pytest.raises(deck_reader.DeckError, match="excerpt"):
        deck_reader.load(course, 1)


def test_missing_required_field_is_refused(course):
    replace(_deck(course), "**Body:** หน้าเอกสารนี้อธิบายพารามิเตอร์ทั้งหมดของ `create_agent`\n", "")
    with pytest.raises(deck_reader.DeckError, match="Body"):
        deck_reader.load(course, 1)


def test_field_outside_the_layout_is_refused(course):
    replace(_deck(course), "**Title:** สรุป\n", "**Title:** สรุป\n\n**Answer:** ไม่ควรอยู่ตรงนี้\n")
    with pytest.raises(deck_reader.DeckError, match="Answer"):
        deck_reader.load(course, 1)


def test_missing_required_visual_is_refused(course):
    text = _deck(course).read_text(encoding="utf-8")
    start = text.index("```visual\n{\"kind\": \"screenshot\"")
    end = text.index("```\n", start + 10) + 4
    _deck(course).write_text(text[:start] + text[end:], encoding="utf-8")
    with pytest.raises(deck_reader.DeckError, match="visual"):
        deck_reader.load(course, 1)


def test_every_error_is_reported(course):
    replace(_deck(course), "### 1-008 · explain", "### 1-008 · fancy")
    replace(_deck(course), '"revisit": "1-014"', '"revisit": "9-911"')
    with pytest.raises(deck_reader.DeckError) as info:
        deck_reader.load(course, 1)
    assert len(info.value.errors) >= 2
    assert "unknown layout fancy" in str(info.value) and "9-911" in str(info.value)


def test_excerpt_joins_the_listed_lines():
    assert deck_reader.excerpt("a\nb\nc\nd\ne\nf", [[1, 2], [5, 6]]) == "a\nb\ne\nf"


def test_course_title_and_parts(course):
    assert deck_reader.read_course_title(course) == "สร้าง AI agent ด้วย LangChain + LangGraph"
    assert deck_reader.deck_parts(course) == [1, 2]
    (course / "00-overview.md").unlink()
    assert deck_reader.read_course_title(course) == "langchain-agents"


def test_text_outside_items_is_refused(course):
    deck = course / "slides/part-01-first-agent.md"
    replace(deck, "**Items:**\n- agent คือ model", "**Items:**\nสิ่งที่ได้เรียน:\n- agent คือ model")
    with pytest.raises(deck_reader.DeckError) as caught:
        deck_reader.load(course, 1)
    assert any("1-024" in e and "outside its list items" in e and "สิ่งที่ได้เรียน:" in e for e in caught.value.errors)


def test_block_with_no_place_on_its_layout_is_refused(course):
    deck = course / "slides/part-01-first-agent.md"
    replace(deck, "**Left:**", "```text\nstray\n```\n\n**Left:**")
    replace(deck, "**Title:** สรุป\n", "**Title:** สรุป\n\n```bash\necho hi\n```\n")
    with pytest.raises(deck_reader.DeckError) as caught:
        deck_reader.load(course, 1)
    errors = caught.value.errors
    assert any("1-010" in e and "content block" in e for e in errors)
    assert any("1-024" in e and "content block" in e for e in errors)


def test_deck_at_1_loads_without_units(course):  # Review Focus 1
    assert deck_reader.load(course, 2).deck.units is None


def test_deck_at_1_refuses_new_layouts(course):  # Review Focus 1
    text = (course / PART2).read_text(encoding="utf-8")
    head = text.index("### 2-002 · explain")
    rest = text[head:].replace("### 2-002 · explain", "### 2-002 · topic", 1).replace('"layout": "explain"', '"layout": "topic", "unit": "u-x"', 1)
    (course / PART2).write_text(text[:head] + rest, encoding="utf-8")
    with pytest.raises(deck_reader.DeckError, match="a topic slide needs slide-design/deck@2") as info:
        deck_reader.load(course, 2)
    assert "Units" not in str(info.value)


def test_deck_at_2_needs_units(course):
    replace(course / PART2, '"slide-design/deck@1"', '"slide-design/deck@2"')
    with pytest.raises(deck_reader.DeckError, match="Units: a deck@2 deck needs its unit map"):
        deck_reader.load(course, 2)


@pytest.mark.parametrize("old,new,message", [
    ('"unit": "u-what-agent"}', '"unit": "u-nope"}', "topic unit 'u-nope' is not in Units"),
    ('"assembles": "part"', '"assembles": "9.9"', "assembles '9.9' is not a chapter in Units"),
    ('"lines": [[10, 11]]}', '"lines": [[90, 91]]}', "label lines [[90, 91]] are not inside the shown lines"),
    ('{"unit": "u-run-agent", "lines"', '{"unit": "u-gone", "lines"', "label names unknown unit 'u-gone'"),
    ('{"chapter": "1.2", "elements"', '{"chapter": "7.7", "elements"', "label names unknown chapter '7.7'"),
    ('"elements": ["n-tool", "e-call", "e-result"]', '"elements": ["n-tool", "n-ghost"]', "label elements of d-agent-loop are unknown: n-ghost"),
    ('"labels": [{"unit": "u-declare-tool", "lines": [[4, 8]]}, {"unit": "u-run-agent", "lines": [[10, 11]]}]', '"labels": []', "labels must be a non-empty list of objects"),
    ('"lines": [[1, 11]]}', '"lines": [[1, 10]]}', "the code block is not the excerpt of 1.2-a"),
    ('"unit": "u-what-agent"}', '"unit": ["u-what-agent"]}', "topic unit ['u-what-agent'] is not in Units"),
    ('"assembles": "part"', '"assembles": ["part"]', "assembles ['part'] is not a chapter in Units"),
    ('{"unit": "u-run-agent", "lines"', '{"unit": ["u-run-agent"], "lines"', "label names unknown unit ['u-run-agent']"),
    ('{"chapter": "1.2", "elements"', '{"chapter": ["1.2"], "elements"', "label names unknown chapter ['1.2']"),
    ('"elements": ["n-tool", "e-call", "e-result"]', '"elements": [["n-tool"]]', "label elements of d-agent-loop are unknown: ['n-tool']"),
    ('"id": "1.1"', '"id": ["1.1"]', "label names unknown chapter '1.1'"),
])
def test_unit_render_errors(course, old, new, message):
    replace(_deck(course), old, new)
    with pytest.raises(deck_reader.DeckError, match=re.escape(message)):
        deck_reader.load(course, 1)


def test_assembly_shows_code_or_a_diagram_not_both(course):
    visual = '```visual\n{"kind": "diagram", "diagram": "d-init", "show": ["n-start"], "new": [], "highlight": [], "dim": []}\n```'
    replace(_deck(course), "### 1-018 · output", visual + "\n\n### 1-018 · output")
    with pytest.raises(deck_reader.DeckError, match="an assemble slide shows code or a diagram, not both"):
        deck_reader.load(course, 1)


def test_assembly_without_code_needs_a_diagram(course):
    text = _deck(course).read_text(encoding="utf-8")
    head = text.index("### 1-022 · assemble")
    start = text.index("```visual", head)
    end = text.index("```\n", start + 10) + 4
    _deck(course).write_text(text[:start] + text[end:], encoding="utf-8")
    with pytest.raises(deck_reader.DeckError, match="an assemble slide without a snippet needs a diagram visual"):
        deck_reader.load(course, 1)
