import json

from deck import parse_sections
from unit_checks import check_structure

SNIPPET = "\n".join(f"line_{n} = {n}" for n in range(1, 7))
VISUAL = {"kind": "diagram", "diagram": "d-one", "show": ["n-one"], "new": [], "highlight": [], "dim": []}


def units_map(chapters: dict[str, list[str]]) -> dict:
    """A valid unit map, every chapter in section 1.2; titles equal the unit ids, goals are "g"."""
    return {"chapters": [{"id": cid, "section": "1.2", "title": cid, "units": [{"id": u, "title": u, "goal": "g", "needs": []} for u in uids]}
                         for cid, uids in chapters.items()]}


def topic(uid, title=None, body="g"):
    return ("topic", {"unit": uid}, {"Title": title or uid, "Body": body}, ())


def assemble(chapter, uids, *, code=True):
    if code:
        labels = [{"unit": u, "lines": [[n, n]]} for n, u in enumerate(uids, start=1)]
        return ("assemble", {"assembles": chapter, "snippet": "s", "lines": [[1, 6]], "labels": labels}, {"Title": "t", "Body": "b"}, ("code",))
    labels = [{"unit": u, "elements": ["n-one"]} for u in uids]
    return ("assemble", {"assembles": chapter, "labels": labels}, {"Title": "t", "Body": "b"}, ("visual",))


def part_assembly(chapters):
    labels = [{"chapter": c, "elements": ["n-one"]} for c in chapters]
    return ("assemble", {"assembles": "part", "labels": labels}, {"Title": "t", "Body": "b"}, ("visual",))


MAP = ("map", {}, {"Title": "t"}, ())
EXPLAIN = ("explain", {}, {"Title": "t", "Body": "b"}, ())


def _slide(slide_id, row):
    layout, meta, fields, extras = row
    block = json.dumps({"layout": layout, "purpose": "p", "from": [], "sources": [], **meta}, ensure_ascii=False)
    parts = [f"### {slide_id} · {layout}", f"```slide\n{block}\n```", *[f"**{k}:** {v}" for k, v in fields.items()]]
    if "code" in extras:
        parts.append(f"```python\n{SNIPPET}\n```")
    if "visual" in extras:
        parts.append(f"```visual\n{json.dumps(VISUAL)}\n```")
    return "\n\n".join(parts)


def deck_sections(rows, *, chapters=None, opening=None, closing=None):
    """Opening (1-001 map), `## 1.2 T` (rows from 1-100) and Closing (1-201, a Part assembly of `chapters`)."""
    if chapters is None:
        chapters = list(dict.fromkeys(row[1]["assembles"] for row in rows if row[0] == "assemble" and row[1].get("assembles") != "part")) or ["1.2"]
    opening = [MAP] if opening is None else opening
    closing = [part_assembly(chapters)] if closing is None else closing
    text = "\n\n".join([
        "## Opening", *[_slide(f"1-{n:03d}", row) for n, row in enumerate(opening, start=1)],
        "## 1.2 T", *[_slide(f"1-{n}", row) for n, row in enumerate(rows, start=100)],
        "## Closing", *[_slide(f"1-{n}", row) for n, row in enumerate(closing, start=201)],
    ]) + "\n"
    sections, errors = parse_sections(text)
    assert errors == []
    return sections


TWO = units_map({"1.2": ["u-a", "u-b"]})
VALID = [topic("u-a"), topic("u-b"), assemble("1.2", ["u-a", "u-b"])]


def test_a_valid_part_has_no_problems():
    assert check_structure(deck_sections(VALID), TWO) == []
    assert check_structure(deck_sections([topic("u-a"), topic("u-b"), assemble("1.2", ["u-a", "u-b"], code=False)]), TWO) == []


def test_label_scope_in_split_chapters():  # Review Focus 4
    units = units_map({"1.2a": ["u-a", "u-b"], "1.2b": ["u-c", "u-d"]})  # both chapters in section 1.2
    rows = [topic("u-a"), topic("u-b"), assemble("1.2a", ["u-a", "u-b"]),
            topic("u-c"), topic("u-d"), assemble("1.2b", ["u-a", "u-b", "u-c", "u-d"])]
    assert check_structure(deck_sections(rows), units) == []
    rows[2] = assemble("1.2a", ["u-a", "u-b", "u-c"])
    assert ("1-102", "label names u-c from a later chapter") in check_structure(deck_sections(rows), units)


def test_label_from_another_section():
    units = units_map({"1.2": ["u-a", "u-b"]})
    units["chapters"].insert(0, {"id": "1.1", "section": "1.1", "title": "1.1", "units": [{"id": "u-z", "title": "u-z", "goal": "g", "needs": []}]})
    rows = [topic("u-a"), topic("u-b"), assemble("1.2", ["u-a", "u-b", "u-z"])]
    assert ("1-102", "label names u-z from another section") in check_structure(deck_sections(rows, chapters=["1.1", "1.2"]), units)


def test_opening_needs_exactly_one_map():
    assert ("deck", "the opening needs exactly one map slide") in check_structure(deck_sections(VALID, opening=[]), TWO)
    assert ("deck", "the opening needs exactly one map slide") in check_structure(deck_sections(VALID, opening=[MAP, MAP]), TWO)


def test_map_and_topic_belong_in_their_sections():
    rows = [topic("u-a"), MAP, topic("u-b"), assemble("1.2", ["u-a", "u-b"])]
    assert ("1-101", "a map slide does not belong in 1.2 T") in check_structure(deck_sections(rows), TWO)
    found = check_structure(deck_sections(VALID, opening=[MAP, topic("u-a")]), TWO)
    assert ("1-002", "a topic slide does not belong in Opening") in found
    found = check_structure(deck_sections(VALID, closing=[topic("u-b"), part_assembly(["1.2"])]), TWO)
    assert ("1-201", "a topic slide does not belong in Closing") in found


def test_sub_topic_section_starts_with_a_topic():
    assert ("1-100", "a sub-topic section starts with a topic slide") in check_structure(deck_sections([EXPLAIN, *VALID]), TWO)


def test_topics_follow_the_unit_map():
    rows = [topic("u-b"), topic("u-a"), assemble("1.2", ["u-a", "u-b"])]
    assert ("1-100", "expected unit u-a here, in unit-map order") in check_structure(deck_sections(rows), TWO)


def test_unit_without_a_topic():
    rows = [topic("u-a"), assemble("1.2", ["u-a", "u-b"])]
    assert ("deck", "unit u-b has no topic slide") in check_structure(deck_sections(rows), TWO)


def test_topic_title_and_body_come_from_the_map():
    rows = [topic("u-a", title="other"), topic("u-b", body="other"), assemble("1.2", ["u-a", "u-b"])]
    found = check_structure(deck_sections(rows), TWO)
    assert ("1-100", "topic title must equal the unit title") in found
    assert ("1-101", "topic body must equal the unit goal") in found


def test_assembly_names_the_current_chapter():
    units = units_map({"1.2a": ["u-a", "u-b"], "1.2b": ["u-c", "u-d"]})
    rows = [topic("u-a"), topic("u-b"), assemble("1.2b", ["u-a", "u-b"]), topic("u-c"), topic("u-d"), assemble("1.2b", ["u-c", "u-d"])]
    assert ("1-102", "assembles 1.2b, but the current chapter is 1.2a") in check_structure(deck_sections(rows), units)


def test_topic_after_its_chapters_assembly():
    rows = [topic("u-a"), assemble("1.2", ["u-a"]), topic("u-b"), assemble("1.2", ["u-a", "u-b"])]
    assert ("1-102", "a chapter's assemble slides come after its last unit") in check_structure(deck_sections(rows), TWO)


def test_chapter_of_two_units_needs_an_assembly():
    assert ("deck", "chapter 1.2 has 2 units and needs an assemble slide") in check_structure(deck_sections([topic("u-a"), topic("u-b")]), TWO)


def test_single_unit_chapter_takes_no_assembly():
    units = units_map({"1.2": ["u-a"]})
    found = check_structure(deck_sections([topic("u-a"), assemble("1.2", ["u-a"])]), units)
    assert ("1-101", "chapter 1.2 has one unit and takes no assemble slide") in found
    assert check_structure(deck_sections([topic("u-a")]), units) == []


def test_assembly_labels_every_unit():
    rows = [topic("u-a"), topic("u-b"), assemble("1.2", ["u-a"])]
    assert ("deck", "chapter 1.2: assembly does not label u-b") in check_structure(deck_sections(rows), TWO)


def test_moved_unit_is_exempt_from_coverage():
    units = units_map({"1.2": ["u-a", "u-b"]})
    units["chapters"][0]["units"][1].update(moved_from="1.3", reason="r")
    rows = [topic("u-a"), topic("u-b"), assemble("1.2", ["u-a"])]
    assert check_structure(deck_sections(rows), units) == []


def test_label_lines_lie_inside_the_shown_lines():
    layout, meta, fields, extras = assemble("1.2", ["u-a", "u-b"])
    meta = {**meta, "labels": [{"unit": "u-a", "lines": [[1, 2]]}, {"unit": "u-b", "lines": [[6, 7]]}]}
    rows = [topic("u-a"), topic("u-b"), (layout, meta, fields, extras)]
    assert ("1-102", "label lines must lie inside the shown lines") in check_structure(deck_sections(rows), TWO)


def test_label_ranges_do_not_overlap():
    layout, meta, fields, extras = assemble("1.2", ["u-a", "u-b"])
    meta = {**meta, "labels": [{"unit": "u-a", "lines": [[1, 3]]}, {"unit": "u-b", "lines": [[3, 4]]}]}
    rows = [topic("u-a"), topic("u-b"), (layout, meta, fields, extras)]
    assert ("1-102", "label ranges overlap") in check_structure(deck_sections(rows), TWO)


def test_label_elements_must_be_shown():
    layout, meta, fields, extras = assemble("1.2", ["u-a", "u-b"], code=False)
    meta = {**meta, "labels": [{"unit": "u-a", "elements": ["n-one"]}, {"unit": "u-b", "elements": ["n-two"]}]}
    rows = [topic("u-a"), topic("u-b"), (layout, meta, fields, extras)]
    assert ("1-102", "label elements must be shown") in check_structure(deck_sections(rows), TWO)


def test_assembly_shows_code_or_a_diagram():
    layout, meta, fields, _ = assemble("1.2", ["u-a", "u-b"])
    both = [topic("u-a"), topic("u-b"), (layout, meta, fields, ("code", "visual"))]
    assert ("1-102", "an assemble slide shows code or a diagram, not both") in check_structure(deck_sections(both), TWO)
    layout, meta, fields, _ = assemble("1.2", ["u-a", "u-b"], code=False)
    neither = [topic("u-a"), topic("u-b"), (layout, meta, fields, ())]
    assert ("1-102", "an assemble slide shows code or a diagram, and has neither") in check_structure(deck_sections(neither), TWO)


def test_closing_needs_a_part_assembly():
    assert ("deck", "the closing needs an assemble slide for the whole Part") in check_structure(deck_sections(VALID, closing=[]), TWO)


def test_part_assembly_must_label_every_chapter():
    units = units_map({"1.2a": ["u-a", "u-b"], "1.2b": ["u-c", "u-d"]})
    rows = [topic("u-a"), topic("u-b"), assemble("1.2a", ["u-a", "u-b"]), topic("u-c"), topic("u-d"), assemble("1.2b", ["u-c", "u-d"])]
    assert ("1-201", "the Part assembly does not label chapter 1.2b") in check_structure(deck_sections(rows, chapters=["1.2a"]), units)


def test_part_assembly_belongs_in_the_closing():
    rows = [*VALID, part_assembly(["1.2"])]
    assert ("1-103", "a Part assembly belongs in the closing") in check_structure(deck_sections(rows), TWO)
