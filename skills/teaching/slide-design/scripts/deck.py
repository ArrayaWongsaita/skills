"""Parse deck files (slide-design/deck@1 and deck@2), section drafts and diagram files.

A slide is a `### <id> · <layout>` block: a ```slide JSON block, labelled
fields (`**Title:** …`), an optional ```visual JSON block and content
blocks (code, output, panels). Parsing never raises on bad content: every
problem becomes an error with its 1-based file line, for the validator to
report. A deck@2 deck also carries its unit map in a `## Units` section,
and `slide_units` tells which unit each slide belongs to. Stdlib only.
"""

import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import frontmatter  # noqa: E402
from contract import CLOSING, DIAGRAMS_HEADING, FIELD_RE, FIELDS, LISTINGS_HEADING, NOTES_HEADING, OPENING, SLIDE_HEADING_RE, UNITS_HEADING  # noqa: E402
from mdtext import Doc, scan  # noqa: E402

SUBTOPIC_HEADING_RE = re.compile(r"^(?P<key>\d+\.\d+) .+$")
ITEM_RE = re.compile(r"^\s*(?:\d+\.|-)\s+(?P<text>.*)$")
PANELS = ("Left", "Right")

Errors = list[tuple[int, str]]


@dataclass
class CodeBlock:
    lang: str
    info: str
    text: str
    line: int  # 1-based line of the opening fence


@dataclass
class Field:
    name: str
    text: str
    items: list[str]
    blocks: list[CodeBlock]
    line: int


@dataclass
class Slide:
    id: str
    layout: str
    line: int
    section: str
    meta: dict = field(default_factory=dict)
    fields: dict[str, Field] = field(default_factory=dict)
    visual: dict | None = None
    blocks: list[CodeBlock] = field(default_factory=list)
    meta_lines: tuple[int, int] = (0, 0)  # 1-based lines of the ```slide opening and closing fences


@dataclass
class Section:
    heading: str
    key: str | None
    line: int
    slides: list[Slide] = field(default_factory=list)


@dataclass
class Listing:
    snippet: str
    meta: dict
    code: CodeBlock | None
    line: int


@dataclass
class Deck:
    meta: dict
    title: str
    notes: str
    sections: list[Section]
    diagrams: dict[str, dict]
    diagram_blocks: list[str]
    listings: dict[str, Listing]
    headings: list[str]
    errors: Errors
    units: dict | None = None  # the `## Units` map; None when the deck has no such section

    def slides(self) -> list[Slide]:
        return [slide for section in self.sections for slide in section.slides]


def section_key(heading: str) -> str | None:
    if heading == OPENING:
        return "opening"
    if heading == CLOSING:
        return "closing"
    match = SUBTOPIC_HEADING_RE.match(heading)
    return match.group("key") if match else None


def meta_block(meta: dict) -> str:
    return "```slide\n" + json.dumps(meta, ensure_ascii=False) + "\n```"


def _json(text: str):
    try:
        return json.loads(text), None
    except json.JSONDecodeError as error:
        return None, error


def _code_block(doc: Doc, block, first_line: int) -> CodeBlock:
    return CodeBlock(lang=block.lang, info=block.info, text=doc.block_text(block), line=block.start + first_line)


def _finish(raw: list[str]) -> tuple[str, list[str]]:
    text = "\n".join(raw).strip()
    items = [match.group("text").strip() for line in raw if (match := ITEM_RE.match(line))]
    return text, items


def _slide(doc: Doc, heading, end: int, key: str, first_line: int, errors: Errors) -> Slide:
    match = SLIDE_HEADING_RE.match(doc.lines[heading.line])
    slide = Slide(id=match.group("id"), layout=match.group("layout"), line=heading.line + first_line, section=key)
    raw: dict[str, list[str]] = {}
    current: str | None = None  # field collecting text
    panel: Field | None = None  # Left/Right field collecting blocks
    absorbing = False  # after an unknown or repeated field, swallow its text
    has_meta = missing_reported = False

    def missing_meta(line: int) -> None:
        nonlocal missing_reported
        if not has_meta and not missing_reported:
            errors.append((line, f"{slide.id}: missing slide block (it must come first)"))
            missing_reported = True

    index = heading.line + 1
    while index < end:
        line, number = doc.lines[index], index + first_line
        block = doc.block_at(index)
        if block:
            current, absorbing = None, False
            text = doc.block_text(block)
            if block.lang == "slide" and not has_meta and not missing_reported:
                value, error = _json(text)
                if error or not isinstance(value, dict):
                    errors.append((number, f"{slide.id}: slide block is not valid JSON ({error or 'not an object'})"))
                else:
                    slide.meta = value
                has_meta, slide.meta_lines = True, (number, block.end + first_line)
            elif block.lang == "slide":
                errors.append((number, f"{slide.id}: more than one slide block"))
            elif block.lang == "visual":
                missing_meta(number)
                value, error = _json(text)
                if slide.visual is not None:
                    errors.append((number, f"{slide.id}: more than one visual block"))
                elif error or not isinstance(value, dict):
                    errors.append((number, f"{slide.id}: visual block is not valid JSON ({error or 'not an object'})"))
                else:
                    slide.visual = value
            else:
                missing_meta(number)
                code = _code_block(doc, block, first_line)
                (panel.blocks if panel else slide.blocks).append(code)
            index = block.end + 1
            continue
        found = FIELD_RE.match(line)
        if found:
            missing_meta(number)
            name, current, panel, absorbing = found.group("name"), None, None, True
            if name not in FIELDS:
                errors.append((number, f"{slide.id}: unknown field {name}"))
            elif name in slide.fields:
                errors.append((number, f"{slide.id}: repeated field {name}"))
            else:
                slide.fields[name] = Field(name=name, text="", items=[], blocks=[], line=number)
                raw[name] = [found.group("rest")]
                current, absorbing = name, False
                panel = slide.fields[name] if name in PANELS else None
        elif current:
            raw[current].append(line)
        elif line.strip() and not absorbing:
            errors.append((number, f"{slide.id}: text outside any field"))
        index += 1
    if not has_meta:
        missing_meta(slide.line)
    for name, lines in raw.items():
        slide.fields[name].text, slide.fields[name].items = _finish(lines)
    return slide


def _section(doc: Doc, heading, first_line: int, errors: Errors) -> Section:
    key = section_key(heading.text)
    section = Section(heading=heading.text, key=key, line=heading.line + first_line)
    end = doc.end_of(heading)
    inner = [h for h in doc.headings if heading.line < h.line < end and h.level == 3]
    first_slide = inner[0].line if inner else end
    if any(line.strip() for line in doc.lines[heading.line + 1:first_slide]):
        errors.append((heading.line + first_line + 1, f"section {heading.text}: text before the first slide"))
    for position, sub in enumerate(inner):
        stop = inner[position + 1].line if position + 1 < len(inner) else end
        if not SLIDE_HEADING_RE.match(doc.lines[sub.line]):
            errors.append((sub.line + first_line, f"not a slide heading: {doc.lines[sub.line]!r}"))
            continue
        section.slides.append(_slide(doc, sub, stop, key, first_line, errors))
    return section


def parse_sections(text: str, first_line: int = 1) -> tuple[list[Section], Errors]:
    doc, errors = scan(text), []
    sections = []
    for heading in doc.headings:
        if heading.level != 2:
            continue
        if section_key(heading.text) is None:
            errors.append((heading.line + first_line, f"unknown section heading {heading.text!r}"))
            continue
        sections.append(_section(doc, heading, first_line, errors))
    return sections, errors


def _diagrams(doc: Doc, start: int, end: int, first_line: int) -> tuple[dict[str, dict], list[str], Errors]:
    diagrams, raw, errors = {}, [], []
    for block in doc.blocks:
        if not (start <= block.start < end) or block.lang != "diagram":
            continue
        number = block.start + first_line
        value, error = _json(doc.block_text(block))
        if error or not isinstance(value, dict) or not isinstance(value.get("id"), str):
            errors.append((number, f"diagram block is not a JSON object with an id ({error or 'no id'})"))
            continue
        if value["id"] in diagrams:
            errors.append((number, f"duplicate diagram {value['id']}"))
            continue
        diagrams[value["id"]] = value
        raw.append("\n".join(doc.lines[block.start:block.end + 1]))
    return diagrams, raw, errors


def _units(doc: Doc, heading, first_line: int, errors: Errors) -> dict | None:
    end = doc.end_of(heading)
    block = next((b for b in doc.blocks if heading.line < b.start < end and b.lang == "units"), None)
    if block is None:
        errors.append((heading.line + first_line, "Units: missing the units block"))
        return None
    value, error = _json(doc.block_text(block))
    if error:
        errors.append((block.start + first_line, f"Units: the units block is not valid JSON ({error})"))
        return None
    if not isinstance(value, dict):
        errors.append((block.start + first_line, "Units: the units block is not a JSON object"))
        return None
    return value


def slide_units(sections: list[Section]) -> dict[str, str | None]:
    """Each slide's unit: the nearest `topic` slide before it in its section, reset by an `assemble` slide."""
    units: dict[str, str | None] = {}
    for section in sections:
        current = None
        for slide in section.slides:
            if slide.layout == "topic":
                unit = slide.meta.get("unit")
                current = unit if isinstance(unit, str) else None
            elif slide.layout == "assemble":
                current = None
            units[slide.id] = current
    return units


def parse_diagrams(text: str, first_line: int = 1) -> tuple[dict[str, dict], list[str], Errors]:
    doc = scan(text)
    return _diagrams(doc, 0, len(doc.lines), first_line)


def _listings(doc: Doc, heading, first_line: int, errors: Errors) -> dict[str, Listing]:
    listings: dict[str, Listing] = {}
    end = doc.end_of(heading)
    inner = [h for h in doc.headings if heading.line < h.line < end and h.level == 3]
    for position, sub in enumerate(inner):
        stop = inner[position + 1].line if position + 1 < len(inner) else end
        blocks = [b for b in doc.blocks if sub.line < b.start < stop]
        number = sub.line + first_line
        if not blocks or blocks[0].lang != "listing":
            errors.append((number, f"listing {sub.text}: missing listing block"))
            continue
        meta, error = _json(doc.block_text(blocks[0]))
        if error or not isinstance(meta, dict):
            errors.append((number, f"listing {sub.text}: listing block is not valid JSON"))
            meta = {}
        code = _code_block(doc, blocks[1], first_line) if len(blocks) > 1 else None
        if code is None:
            errors.append((number, f"listing {sub.text}: missing code block"))
        listings[sub.text] = Listing(snippet=sub.text, meta=meta, code=code, line=number)
    return listings


def parse_deck(text: str) -> Deck:
    errors: Errors = []
    try:
        meta, body = frontmatter.parse(text)
        lines = text.split("\n")
        first_line = lines.index("---", 1) + 2
    except ValueError as error:
        meta, body, first_line = {}, text, 1
        errors.append((1, str(error)))
    doc = scan(body)
    title = next((h.text for h in doc.headings if h.level == 1), "")
    deck = Deck(meta=meta, title=title, notes="", sections=[], diagrams={}, diagram_blocks=[], listings={}, headings=[], errors=errors)
    for heading in doc.headings:
        if heading.level != 2:
            continue
        deck.headings.append(heading.text)
        if heading.text == NOTES_HEADING:
            deck.notes = "\n".join(doc.lines[heading.line + 1:doc.end_of(heading)]).strip()
        elif heading.text == DIAGRAMS_HEADING:
            diagrams, raw, found = _diagrams(doc, heading.line + 1, doc.end_of(heading), first_line)
            deck.diagrams.update(diagrams)
            deck.diagram_blocks += raw
            errors += found
        elif heading.text == LISTINGS_HEADING:
            deck.listings.update(_listings(doc, heading, first_line, errors))
        elif heading.text == UNITS_HEADING:
            deck.units = _units(doc, heading, first_line, errors)
        elif section_key(heading.text) is not None:
            deck.sections.append(_section(doc, heading, first_line, errors))
        else:
            errors.append((heading.line + first_line, f"unknown section heading {heading.text!r}"))
    return deck
