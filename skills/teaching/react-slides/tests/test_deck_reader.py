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
    assert len(loaded.deck.slides()) == loaded.deck.meta["slide_count"] == 19
    assert len(loaded.sha256) == 64


def test_stale_and_missing_part_file(course):
    assert deck_reader.load(course, 2).stale is True
    (course / "part-01-first-agent.md").unlink()
    assert deck_reader.load(course, 1).stale is None


def test_wrong_templates_are_refused(course):
    replace(_deck(course), '"slide-design/deck@1"', '"slide-design/deck@2"')
    with pytest.raises(deck_reader.DeckError, match="slide-design/deck@2"):
        deck_reader.load(course, 1)


def test_vocabulary_template_is_checked(course):
    replace(course / "slides" / "visual-vocabulary.md", "vocabulary@1", "vocabulary@9")
    with pytest.raises(deck_reader.DeckError, match="vocabulary@9"):
        deck_reader.read_vocabulary(course)


def test_missing_deck_is_named(course):
    with pytest.raises(deck_reader.DeckError, match="part-03"):
        deck_reader.find_deck(course, 3)


@pytest.mark.parametrize("old,new,message", [
    ("### 1-006 · explain", "### 1-006 · fancy", "unknown layout fancy"),
    ('"revisit": "1-011"', '"revisit": "9-911"', "revisit"),
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
    replace(_deck(course), '"revisit": "1-011"', '"revisit": "9-911"')
    with pytest.raises(deck_reader.DeckError) as info:
        deck_reader.load(course, 1)
    assert any(error.startswith("line ") and ": 1-016: " in error for error in info.value.errors)


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
    replace(_deck(course), "### 1-006 · explain", "### 1-006 · fancy")
    replace(_deck(course), '"revisit": "1-011"', '"revisit": "9-911"')
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
    assert any("1-018" in e and "outside its list items" in e and "สิ่งที่ได้เรียน:" in e for e in caught.value.errors)


def test_block_with_no_place_on_its_layout_is_refused(course):
    deck = course / "slides/part-01-first-agent.md"
    replace(deck, "**Left:**", "```text\nstray\n```\n\n**Left:**")
    replace(deck, "**Title:** สรุป\n", "**Title:** สรุป\n\n```bash\necho hi\n```\n")
    with pytest.raises(deck_reader.DeckError) as caught:
        deck_reader.load(course, 1)
    errors = caught.value.errors
    assert any("1-008" in e and "content block" in e for e in errors)
    assert any("1-018" in e and "content block" in e for e in errors)
