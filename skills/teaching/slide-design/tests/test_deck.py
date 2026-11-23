import json

import pytest

from deck import meta_block, parse_deck, parse_diagrams, parse_sections, section_key, slide_units

SLIDE = '''## 1.1 เรียกโมเดล

### 1-007 · explain

```slide
{"layout": "explain", "purpose": "รู้ว่า init_chat_model ทำอะไร", "from": ["1.1/Core knowledge"], "sources": []}
```

**Title:** สร้างโมเดลจากชื่อ

**Body:** ย่อหน้าแรก

ย่อหน้าที่สอง

```visual
{"kind": "diagram", "diagram": "d-init", "show": ["n-name"], "new": ["n-name"], "highlight": [], "dim": []}
```
'''


def test_parse_slide_fields_and_visual():
    sections, errors = parse_sections(SLIDE)
    slide = sections[0].slides[0]
    assert errors == [] and sections[0].key == "1.1"
    assert (slide.id, slide.layout, slide.section) == ("1-007", "explain", "1.1")
    assert slide.fields["Body"].text == "ย่อหน้าแรก\n\nย่อหน้าที่สอง"
    assert slide.visual["diagram"] == "d-init" and slide.meta["from"] == ["1.1/Core knowledge"]
    assert (slide.line, slide.meta_lines) == (3, (5, 7))


def test_first_line_offsets_line_numbers():
    sections, _ = parse_sections(SLIDE, first_line=11)
    assert sections[0].slides[0].line == 13


def test_items_and_panels():
    text = ("## Opening\n\n### 1-001 · compare\n\n```slide\n{\"layout\": \"compare\"}\n```\n\n"
            "**Left:** บทความเก่า\n\n```python\nold()\n```\n\n**Right:** ปัจจุบัน\n\n**Takeaway:** ใช้แบบใหม่\n\n"
            "**Items:**\n1. หนึ่ง\n2. สอง\n- [doc](https://x.y)\n")
    slide = parse_sections(text)[0][0].slides[0]
    assert slide.fields["Left"].blocks[0].text == "old()" and slide.blocks == []
    assert slide.fields["Left"].text == "บทความเก่า"
    assert slide.fields["Items"].items == ["หนึ่ง", "สอง", "[doc](https://x.y)"]


def test_slide_level_content_block():
    text = "## Opening\n\n### 1-001 · code\n\n```slide\n{\"layout\": \"code\"}\n```\n\n**Title:** t\n\n**Body:** b\n\n```python\nx = 1\n```\n"
    slide = parse_sections(text)[0][0].slides[0]
    assert [(b.lang, b.text) for b in slide.blocks] == [("python", "x = 1")]
    assert slide.fields["Body"].text == "b"


@pytest.mark.parametrize("bad,message", [
    ("```slide\n{not json}\n```", "slide block is not valid JSON"),
    ("```slide\n{}\n```\n\n**Title:** a\n\n**Title:** b", "repeated field Title"),
    ("```slide\n{}\n```\n\n**Colour:** x", "unknown field Colour"),
    ("**Title:** no slide block", "missing slide block"),
    ("```slide\n{}\n```\n\n```visual\n[oops\n```", "visual block is not valid JSON"),
    ("```slide\n{}\n```\n\nstray text", "text outside any field"),
])
def test_parse_errors_carry_line_numbers(bad, message):
    _, errors = parse_sections("## Opening\n\n### 1-001 · cover\n\n" + bad + "\n")
    assert any(message in text and line > 0 for line, text in errors), errors


def test_section_key():
    assert [section_key(h) for h in ("Opening", "1.2 สร้าง agent", "Closing", "Diagrams")] == ["opening", "1.2", "closing", None]


def test_meta_block_is_one_line_unescaped():
    assert meta_block({"layout": "cover", "purpose": "เปิด"}) == '```slide\n{"layout": "cover", "purpose": "เปิด"}\n```'


def test_parse_diagrams_keeps_raw_blocks_and_order():
    text = '# Diagrams\n\n```diagram\n{"id": "d-b"}\n```\n\n```diagram\n{"id": "d-a"}\n```\n'
    diagrams, raw, errors = parse_diagrams(text)
    assert errors == [] and list(diagrams) == ["d-b", "d-a"] and raw[0] == '```diagram\n{"id": "d-b"}\n```'
    _, _, errors = parse_diagrams('```diagram\n{"id": "d-a"}\n```\n```diagram\n{"id": "d-a"}\n```\n')
    assert any("duplicate diagram d-a" in m for _, m in errors)


DECK = '''---
template: "slide-design/deck@1"
part: 1
---
# Part 1: ชื่อ

## Deck notes

ผู้เรียนอ่านเอง

### Code status

_None._

## Opening

### 1-001 · cover

```slide
{"layout": "cover"}
```

**Title:** เปิด

## Closing

### 1-002 · sources

```slide
{"layout": "sources"}
```

**Title:** แหล่งอ้างอิง

## Diagrams

```diagram
{"id": "d-x"}
```

## Code listings

### 1.1-a

```listing
{"snippet": "1.1-a", "status": "verified", "reason": ""}
```

```python
print(1)
```
'''


def test_parse_deck():
    deck = parse_deck(DECK)
    assert deck.errors == []
    assert deck.meta["part"] == 1 and deck.title == "Part 1: ชื่อ"
    assert deck.notes.startswith("ผู้เรียนอ่านเอง") and "### Code status" in deck.notes
    assert [s.key for s in deck.sections] == ["opening", "closing"] and [s.id for s in deck.slides()] == ["1-001", "1-002"]
    assert deck.headings == ["Deck notes", "Opening", "Closing", "Diagrams", "Code listings"]
    assert list(deck.diagrams) == ["d-x"]
    listing = deck.listings["1.1-a"]
    assert listing.meta["status"] == "verified" and listing.code.text == "print(1)" and listing.code.lang == "python"
    assert deck.slides()[1].line == 27


MINIMAL_DECK = DECK


def draft(key: str, rows: list[tuple[str, str, dict]]) -> str:
    """A section draft: `## <key> T` and one slide per (id, layout, extra meta) row."""
    parts = [f"## {key} T"]
    for slide_id, layout, meta in rows:
        block = json.dumps({"layout": layout, "purpose": "p", "from": [], "sources": [], **meta}, ensure_ascii=False)
        parts.append(f"### {slide_id} · {layout}\n\n```slide\n{block}\n```\n\n**Title:** t\n\n**Body:** b")
    return "\n\n".join(parts) + "\n"


def test_units_section_is_parsed():
    deck = parse_deck(MINIMAL_DECK.replace("## Diagrams", '## Units\n\n```units\n{"chapters": []}\n```\n\n## Diagrams'))
    assert deck.units == {"chapters": []} and deck.errors == []
    assert "Units" in deck.headings


def test_units_section_without_a_block():
    deck = parse_deck(MINIMAL_DECK.replace("## Diagrams", "## Units\n\n## Diagrams"))
    assert any("Units: missing the units block" in m for _, m in deck.errors)


def test_units_section_with_bad_json():
    deck = parse_deck(MINIMAL_DECK.replace("## Diagrams", "## Units\n\n```units\n{\n```\n\n## Diagrams"))
    assert any("Units: the units block is not valid JSON" in m for _, m in deck.errors)


def test_deck_without_units_section_has_none():
    assert parse_deck(MINIMAL_DECK).units is None


def test_slide_units_follow_topics_and_reset_at_assembly():
    sections, _ = parse_sections(draft("1.2", [("1-001", "topic", {"unit": "u-a"}), ("1-002", "explain", {}),
                                              ("1-003", "topic", {"unit": "u-b"}), ("1-004", "code", {}),
                                              ("1-005", "assemble", {}), ("1-006", "compare", {})]))
    assert slide_units(sections) == {"1-001": "u-a", "1-002": "u-a", "1-003": "u-b", "1-004": "u-b", "1-005": None, "1-006": None}


def test_slide_units_follow_split_ids():  # Review Focus 3
    sections, _ = parse_sections(draft("1.2", [("1-001", "topic", {"unit": "u-a"}), ("1-001a", "code", {})]))
    assert slide_units(sections) == {"1-001": "u-a", "1-001a": "u-a"}


def test_slide_units_reset_per_section():
    text = draft("1.1", [("1-001", "topic", {"unit": "u-a"})]) + "\n\n" + draft("1.2", [("1-002", "explain", {})])
    sections, _ = parse_sections(text)
    assert slide_units(sections)["1-002"] is None
