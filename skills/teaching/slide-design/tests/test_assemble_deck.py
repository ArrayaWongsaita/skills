import hashlib
import json

import pytest

import frontmatter
from assemble_deck import AssembleError, assemble, renumber
from conftest import edit
from contract import DECK_FRONTMATTER_KEYS
from deck import parse_deck, parse_sections
from part_reader import find_part, read_part

WORK = "slides/_work/part-01"
DRAFTS = f"{WORK}/sections"


def test_frontmatter(assembled):
    meta, _ = frontmatter.parse(assembled.read_text(encoding="utf-8"))
    digest = hashlib.sha256((assembled.parents[1] / "part-01-first-agent.md").read_bytes()).hexdigest()
    assert list(meta) == list(DECK_FRONTMATTER_KEYS)
    assert meta == {"template": "slide-design/deck@2", "course": "langchain-langgraph", "part": 1, "title": "Agent ตัวแรกด้วย create_agent",
                    "source_file": "part-01-first-agent.md", "source_generated": "2026-11-22", "source_sha256": digest, "language": "th",
                    "vocabulary": "visual-vocabulary.md", "vocabulary_version": 1, "slide_count": 35, "code_status": "verified", "generated": "2026-11-30"}


def test_writes_next_to_the_vocabulary(course, assembled):
    assert assembled == course / "slides" / "part-01-first-agent.md"


def test_ids_renumbered_and_revisit_rewritten(assembled):
    deck = parse_deck(assembled.read_text(encoding="utf-8"))
    assert deck.errors == [] and [s.key for s in deck.sections] == ["opening", "1.1", "1.2", "closing"]
    assert [s.id for s in deck.slides()] == [f"1-{n:03d}" for n in range(1, 36)]
    by_id = {s.id: s for s in deck.slides()}
    assert by_id["1-016"].meta["revisit"] == "1-009" and by_id["1-030"].meta["revisit"] == "1-018"
    assert by_id["1-011"].meta["lines"] == [[3, 5]] and by_id["1-012"].layout == "output"


def test_deck_order(assembled):
    deck = parse_deck(assembled.read_text(encoding="utf-8"))
    assert deck.title == "Part 1: Agent ตัวแรกด้วย create_agent"
    assert deck.headings == ["Deck notes", "Opening", "1.1 เรียกโมเดลด้วย init_chat_model", "1.2 สร้าง agent ที่เรียก tool", "Closing", "Units", "Diagrams", "Code listings"]
    assert list(deck.diagrams) == ["d-agent-loop", "d-init"]


def test_listings_and_generated_notes(assembled):
    deck = parse_deck(assembled.read_text(encoding="utf-8"))
    assert list(deck.listings) == ["1.1-a", "1.2-a"] and deck.listings["1.1-a"].meta["status"] == "verified"
    assert deck.listings["1.2-a"].code.text == read_part(find_part(assembled.parents[1], 1)).snippets["1.2-a"].code
    assert "1-025 illustration:" in deck.notes and "### Code status\n\n_None._" in deck.notes
    assert deck.notes.startswith("- ผู้เรียน")


def test_assembling_twice_is_identical(course):
    first = assemble(course, 1, today="2026-11-30").read_text(encoding="utf-8")
    assert assemble(course, 1, today="2026-11-30").read_text(encoding="utf-8") == first


def test_missing_draft(course):
    (course / DRAFTS / "closing.md").unlink()
    with pytest.raises(AssembleError, match="missing section draft: closing"):
        assemble(course, 1)


def test_draft_with_parse_errors(course):
    edit(course / DRAFTS / "1.1.md", "**Cause:**", "**Reason:**")
    with pytest.raises(AssembleError, match="unknown field Reason"):
        assemble(course, 1)


def test_draft_for_the_wrong_section(course):
    edit(course / DRAFTS / "1.1.md", "## 1.1 ", "## 1.2 ")
    with pytest.raises(AssembleError, match="sections/1.1.md"):
        assemble(course, 1)


def test_section_headings_come_from_the_part(course):
    edit(course / DRAFTS / "1.1.md", "## 1.1 เรียกโมเดลด้วย init_chat_model", "## 1.1 ชื่อที่พิมพ์ผิด")
    assert "## 1.1 เรียกโมเดลด้วย init_chat_model\n" in assemble(course, 1).read_text(encoding="utf-8")


def test_revisit_to_an_unknown_slide(course):
    edit(course / DRAFTS / "1.2.md", '"revisit": "1-017"', '"revisit": "1-099"')
    with pytest.raises(AssembleError, match="revisit '1-099'"):
        assemble(course, 1)


def test_duplicate_draft_id(course):
    edit(course / DRAFTS / "1.1.md", "### 1-010a · code", "### 1-010 · code")
    with pytest.raises(AssembleError, match="duplicate slide id 1-010"):
        assemble(course, 1)


def test_renumber_maps_split_base_ids():
    text = "## Opening\n\n" + "".join(f"### {i} · cover\n\n```slide\n{{\"layout\": \"cover\"}}\n```\n\n**Title:** {i}\n\n" for i in ("1-001", "1-002a", "1-002b", "1-003"))
    sections, _ = parse_sections(text)
    assert renumber(sections, 1) == {"1-001": "1-001", "1-002a": "1-002", "1-002": "1-002", "1-002b": "1-003", "1-003": "1-004"}


def test_renumber_rejects_another_parts_ids():
    sections, _ = parse_sections("## Opening\n\n### 2-001 · cover\n\n```slide\n{\"layout\": \"cover\"}\n```\n")
    with pytest.raises(AssembleError, match="2-001"):
        renumber(sections, 1)


def test_skipped_snippet_is_listed(course):
    edit(find_part(course, 1), '<!-- snippet id="1.2-a" status="verified" checked="2026-11-22" -->', '<!-- snippet id="1.2-a" skip="needs an OpenAI key" -->')
    deck = parse_deck(assemble(course, 1).read_text(encoding="utf-8"))
    assert deck.listings["1.2-a"].meta["status"] == "skipped" and "- 1.2-a skipped: needs an OpenAI key" in deck.notes


def test_deck_is_deck_at_2_with_its_units(course, assembled):
    deck = parse_deck(assembled.read_text(encoding="utf-8"))
    assert deck.meta["template"] == "slide-design/deck@2"
    assert deck.units == json.loads((course / WORK / "units.json").read_text(encoding="utf-8"))
    assert deck.headings[-3:] == ["Units", "Diagrams", "Code listings"]


def test_part_ordering_problems_list_moved_units(course):
    edit(course / WORK / "units.json", '"needs": []}]}', '"needs": [], "moved_from": "1.2", "reason": "1.1 needs it"}]}', first=True)
    text = assemble(course, 1, today="2026-11-30").read_text(encoding="utf-8")
    assert "### Part ordering problems\n\n- u-init-model (สร้างโมเดลจากชื่อ): from 1.2 to 1.1: 1.1 needs it" in text


def test_no_moves_writes_none(assembled):
    assert "### Part ordering problems\n\n_None._" in assembled.read_text(encoding="utf-8")


def test_missing_units_file_is_named(course):  # Review Focus 2
    (course / WORK / "units.json").unlink()
    with pytest.raises(AssembleError, match="units.json: write it at Stage 1, or redo the storyboard"):
        assemble(course, 1, today="2026-11-30")


def test_assemble_snippets_are_listed(course):
    path = course / DRAFTS / "1.2.md"
    text = path.read_text(encoding="utf-8").replace('"snippet": "1.2-a"', '"snippet": "1.1-a"')
    path.write_text(text.replace('"assembles": "1.2", "snippet": "1.1-a"', '"assembles": "1.2", "snippet": "1.2-a"'), encoding="utf-8")
    deck = parse_deck(assemble(course, 1, today="2026-11-30").read_text(encoding="utf-8"))
    assert list(deck.listings) == ["1.1-a", "1.2-a"]
