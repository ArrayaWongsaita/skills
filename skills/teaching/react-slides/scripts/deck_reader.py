"""Load a slide-design deck and check what rendering it needs.

`load` reads one Part's deck, the course vocabulary and the Part file's
hash, and refuses a deck that cannot be rendered: every problem is
reported at once, each as `line N: <slide id>: <message>`. Content rules
(lengths, fidelity to the Part) are slide-design's job; this module checks
only what the React build relies on. A slide-design/deck@2 deck also
carries its unit map; a deck@1 deck renders as before, with no units. Stdlib
only.
"""

import hashlib
import json
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import contract  # noqa: E402
import deck as deckmod  # noqa: E402
import frontmatter  # noqa: E402
import inline  # noqa: E402
from mdtext import scan  # noqa: E402

# Layouts that show slide-level content blocks; on the others a block would be dropped.
BLOCK_CONTENT = ("code", "output", "error", "setup", "assembly")
DECK_AT_1 = contract.DECK_TEMPLATE_IDS[0]  # the deck template with no unit map


class DeckError(Exception):
    def __init__(self, errors: list[str]):
        self.errors = list(errors)
        super().__init__("\n".join(self.errors))


@dataclass(frozen=True)
class Vocabulary:
    course: str
    version: int
    roles: dict
    concepts: list
    style: str


@dataclass(frozen=True)
class Loaded:
    path: Path
    sha256: str
    deck: deckmod.Deck
    vocabulary: Vocabulary
    stale: bool | None  # None when the Part file is missing


def find_deck(course_dir: Path, part: int) -> Path:
    pattern = f"part-{part:02d}-*.md"
    matches = sorted((course_dir / contract.SLIDES_DIR).glob(pattern))
    if not matches:
        raise DeckError([f"no deck for Part {part}: expected {contract.SLIDES_DIR}/{pattern} in {course_dir}"])
    if len(matches) > 1:
        raise DeckError([f"more than one deck for Part {part}: " + ", ".join(path.name for path in matches)])
    return matches[0]


def deck_parts(course_dir: Path) -> list[int]:
    parts = set()
    for path in (course_dir / contract.SLIDES_DIR).glob("part-*.md"):
        match = contract.PART_FILE_RE.match(path.name)
        if match:
            parts.add(int(match.group(1)))
    return sorted(parts)


def _block_json(doc, lang: str, name: str, errors: list[str]):
    for block in doc.blocks:
        if block.lang == lang:
            try:
                return json.loads(doc.block_text(block))
            except json.JSONDecodeError as error:
                errors.append(f"{name}: the {lang} block is not valid JSON ({error})")
                return None
    errors.append(f"{name}: missing the {lang} block")
    return None


def read_vocabulary(course_dir: Path) -> Vocabulary:
    path = course_dir / contract.SLIDES_DIR / contract.VOCABULARY_FILE
    if not path.exists():
        raise DeckError([f"missing the vocabulary file {path}"])
    try:
        meta, body = frontmatter.parse(path.read_text(encoding="utf-8"))
    except ValueError as error:
        raise DeckError([f"{path.name}: {error}"]) from None
    if meta.get("template") != contract.VOCABULARY_TEMPLATE_ID:
        raise DeckError([f"{path.name}: template is {meta.get('template')!r}, expected {contract.VOCABULARY_TEMPLATE_ID!r}"])
    doc, errors = scan(body), []
    roles = _block_json(doc, "roles", path.name, errors)
    concepts = _block_json(doc, "concepts", path.name, errors)
    style = _block_json(doc, "style", path.name, errors)
    if roles is not None and not isinstance(roles, dict):
        errors.append(f"{path.name}: roles is not a JSON object")
    if concepts is not None and not (isinstance(concepts, list) and all(isinstance(c, dict) and "id" in c for c in concepts)):
        errors.append(f"{path.name}: concepts is not a JSON list of objects with an id")
    if style is not None and not isinstance(style, str):
        errors.append(f"{path.name}: style is not a JSON string")
    if errors:
        raise DeckError(errors)
    version = meta.get("version")
    return Vocabulary(course=str(meta.get("course", "")), version=version if isinstance(version, int) else 0,
                      roles=roles, concepts=concepts, style=style)


def read_course_title(course_dir: Path) -> str:
    path = course_dir / contract.OVERVIEW_FILE
    try:
        meta, _ = frontmatter.parse(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return course_dir.name
    title = meta.get("title")
    return title if isinstance(title, str) and title.strip() else course_dir.name


def excerpt(code: str, lines: list[list[int]]) -> str:
    rows = code.split("\n")
    return "\n".join(row for first, last in lines for row in rows[first - 1:last])


def _ranges(value, size: int) -> list[tuple[int, int]] | None:
    """Ascending, non-overlapping 1-based ranges inside 1..size, or None."""
    if not isinstance(value, list) or not value:
        return None
    ranges, previous = [], 0
    for item in value:
        if not (isinstance(item, list) and len(item) == 2 and all(type(n) is int for n in item)):
            return None
        first, last = item
        if not (previous < first <= last <= size):
            return None
        ranges.append((first, last))
        previous = last
    return ranges


def _element_ids(diagram: dict) -> set[str]:
    return {item.get("id") for key in ("nodes", "edges", "groups", "badges", "notes") for item in diagram.get(key, []) if isinstance(item, dict)}


def _diagram_state(visual: dict, diagrams: dict, where: str) -> list[str]:
    name = visual.get("diagram")
    if name not in diagrams:
        return [f"{where} names unknown diagram {name!r}"]
    known, errors = _element_ids(diagrams[name]), []
    for key in ("show", "new", "highlight", "dim"):
        value = visual.get(key, [])
        if key == "show" and not value:
            errors.append(f"{where}: show is empty")
        if not isinstance(value, list):
            errors.append(f"{where}: {key} is not a list")
            continue
        unknown = [element for element in value if element not in known]
        if unknown:
            errors.append(f"{where}: {key} names unknown elements of {name}: {', '.join(map(str, unknown))}")
    return errors


def _fallback(value, diagrams: dict) -> list[str]:
    if not isinstance(value, dict) or value.get("kind") not in contract.FALLBACK_KINDS:
        return [f"the fallback must be an object of kind {' or '.join(contract.FALLBACK_KINDS)}"]
    if value["kind"] == "text":
        return [] if isinstance(value.get("text"), str) and value["text"].strip() else ["the text fallback has no text"]
    return _diagram_state(value, diagrams, "the fallback")


def _visual(slide: deckmod.Slide, layout: contract.Layout, diagrams: dict) -> list[str]:
    visual = slide.visual
    if visual is None:
        return ["a visual is required on this layout"] if layout.visual == "required" else []
    if layout.visual == "none":
        return [f"a {slide.layout} slide takes no visual"]
    kind = visual.get("kind")
    if kind not in contract.VISUAL_KINDS:
        return [f"unknown visual kind {kind!r}"]
    if kind == "diagram":
        return _diagram_state(visual, diagrams, "the visual")
    keys = ("description", "prompt", "alt") if kind == "illustration" else ("url", "capture")
    errors = [f"the {kind} has no {key}" for key in keys if not (isinstance(visual.get(key), str) and visual[key].strip())]
    return errors + _fallback(visual.get("fallback"), diagrams)


def _shown_lines(slide: deckmod.Slide, listings: dict) -> set[int] | None:
    """The snippet lines a code or code assembly slide shows, or None when its ranges are not valid."""
    listing = listings.get(slide.meta.get("snippet"))
    if listing is None or listing.code is None:
        return None
    lines = _ranges(slide.meta.get("lines"), len(listing.code.text.split("\n")))
    return None if lines is None else {n for first, last in lines for n in range(first, last + 1)}


def _code(slide: deckmod.Slide, listings: dict) -> list[str]:
    errors, snippet = [], slide.meta.get("snippet")
    listing = listings.get(snippet)
    if listing is None:
        errors.append(f"snippet {snippet!r} is not in {contract.LISTINGS_HEADING}")
    if len(slide.blocks) != 1:
        errors.append(f"a {slide.layout} slide needs exactly one content block, found {len(slide.blocks)}")
    if slide.layout not in ("code", "assemble") or listing is None or listing.code is None:
        return errors
    code, size = listing.code.text, len(listing.code.text.split("\n"))
    lines = _ranges(slide.meta.get("lines"), size)
    if lines is None:
        errors.append(f"lines {slide.meta.get('lines')!r} are not ascending, non-overlapping ranges inside 1..{size}")
        return errors
    shown = {n for first, last in lines for n in range(first, last + 1)}
    highlight = slide.meta.get("highlight", [])
    marked = _ranges(highlight, size) if highlight else []
    if marked is None or any(n not in shown for first, last in marked for n in range(first, last + 1)):
        errors.append(f"highlight {highlight!r} is not a list of ranges inside the shown lines")
    if len(slide.blocks) == 1 and slide.blocks[0].text != excerpt(code, [list(r) for r in lines]):
        errors.append(f"the code block is not the excerpt of {snippet} at lines {slide.meta.get('lines')}")
    return errors


def _meta(slide: deckmod.Slide) -> list[str]:
    errors = []
    if slide.meta and slide.meta.get("layout") != slide.layout:
        errors.append(f"the slide block layout {slide.meta.get('layout')!r} does not match the heading's {slide.layout!r}")
    for key in ("from", "sources"):
        value = slide.meta.get(key, [])
        if not (isinstance(value, list) and all(isinstance(item, str) for item in value)):
            errors.append(f"{key} is not a list of strings")
    return errors


def _unit_ids(units: dict) -> tuple[set, set]:
    """The unit and chapter ids of the unit map; ids that are not strings are left out."""
    chapters = units.get("chapters")
    chapters = [c for c in chapters if isinstance(c, dict)] if isinstance(chapters, list) else []
    unit_ids = {u["id"] for c in chapters if isinstance(c.get("units"), list) for u in c["units"]
                if isinstance(u, dict) and isinstance(u.get("id"), str)}
    return unit_ids, {c["id"] for c in chapters if isinstance(c.get("id"), str)}


def _known(value, ids: set) -> bool:
    """Membership for a value read from JSON, which may be a list or an object."""
    return isinstance(value, str) and value in ids


def _assembly(slide: deckmod.Slide, d: deckmod.Deck, unit_ids: set, chapter_ids: set) -> list[str]:
    errors, meta = [], slide.meta
    assembles = meta.get("assembles")
    if assembles != contract.PART_ASSEMBLY and not _known(assembles, chapter_ids):
        errors.append(f"assembles {assembles!r} is not a chapter in {contract.UNITS_HEADING}")
    labels = meta.get("labels")
    if not (isinstance(labels, list) and labels and all(isinstance(label, dict) for label in labels)):
        return errors + ["labels must be a non-empty list of objects"]
    for label in labels:
        if "unit" in label:
            if not _known(label["unit"], unit_ids):
                errors.append(f"label names unknown unit {label['unit']!r}")
        elif "chapter" in label:
            if not _known(label["chapter"], chapter_ids):
                errors.append(f"label names unknown chapter {label['chapter']!r}")
        else:
            errors.append("a label names a unit or a chapter")
    visual = slide.visual
    if "snippet" in meta:
        if visual is not None:
            return errors + ["an assemble slide shows code or a diagram, not both"]
        errors += _code(slide, d.listings)
        shown = _shown_lines(slide, d.listings)
        if shown is not None:
            for label in labels:
                ranges = _ranges(label.get("lines"), max(shown))
                if ranges is None or any(n not in shown for first, last in ranges for n in range(first, last + 1)):
                    errors.append(f"label lines {label.get('lines')!r} are not inside the shown lines")
        return errors
    if slide.blocks:
        errors.append(f"an assemble slide without a snippet has no place for a content block ({len(slide.blocks)} found)")
    if visual is None or visual.get("kind") != "diagram":
        return errors + ["an assemble slide without a snippet needs a diagram visual"]
    diagram = d.diagrams.get(visual.get("diagram"))
    if diagram is not None:
        known = _element_ids(diagram)
        for label in labels:
            elements = label.get("elements")
            if not (isinstance(elements, list) and elements):
                errors.append(f"label {label.get('unit') or label.get('chapter')!r} has no elements")
                continue
            unknown = [element for element in elements if not _known(element, known)]
            if unknown:
                errors.append(f"label elements of {diagram.get('id')} are unknown: {', '.join(map(str, unknown))}")
    return errors


def _units(slide: deckmod.Slide, d: deckmod.Deck, template: str) -> list[str]:
    """What a slide's units rely on: a deck@2 deck and, there, units the unit map names."""
    if slide.layout not in contract.UNIT_LAYOUTS:
        return []
    if template == DECK_AT_1:
        return [f"a {slide.layout} slide needs {contract.DECK_TEMPLATE_IDS[1]}"]
    if not isinstance(d.units, dict):
        return []  # reported once for the deck
    unit_ids, chapter_ids = _unit_ids(d.units)
    if slide.layout == "topic" and not _known(slide.meta.get("unit"), unit_ids):
        return [f"topic unit {slide.meta.get('unit')!r} is not in {contract.UNITS_HEADING}"]
    if slide.layout == "assemble":
        return _assembly(slide, d, unit_ids, chapter_ids)
    return []


def _slide(slide: deckmod.Slide, d: deckmod.Deck, ids: set[str]) -> list[str]:
    layout = contract.LAYOUTS.get(slide.layout)
    if layout is None:
        return [f"unknown layout {slide.layout}"]
    errors = _meta(slide)
    errors += [f"missing field {name}" for name in layout.required if name not in slide.fields]
    allowed = set(layout.required) | set(layout.optional)
    errors += [f"field {name} does not belong on a {slide.layout} slide" for name in slide.fields if name not in allowed]
    if "Items" in slide.fields:
        items, stray = inline.parse_items(slide.fields["Items"].text)
        if not items:
            errors.append("Items has no list items (use '1. ' or '- ')")
        errors += [f"Items has text outside its list items, which no layout can show: {line!r} "
                   "(make it an item, or move it to another field)" for line in stray]
    if slide.blocks and layout.content not in BLOCK_CONTENT:
        errors.append(f"a {slide.layout} slide has no place for a content block outside its fields "
                      f"({len(slide.blocks)} found); on a compare slide a block goes right after **Left:** or **Right:**"
                      if layout.content == "panels" else
                      f"a {slide.layout} slide has no place for a content block ({len(slide.blocks)} found)")
    errors += _visual(slide, layout, d.diagrams)
    if layout.content in ("code", "output"):
        errors += _code(slide, d.listings)
    errors += _units(slide, d, d.meta.get("template"))
    if slide.layout == "answer" and slide.meta.get("revisit") not in ids:
        errors.append(f"revisit {slide.meta.get('revisit')!r} is not a slide in this deck")
    return errors


def _diagram(diagram: dict) -> list[str]:
    name, known = diagram.get("id"), _element_ids(diagram)
    nodes = {node.get("id") for node in diagram.get("nodes", []) if isinstance(node, dict)}
    errors = []
    for edge in diagram.get("edges", []):
        for end in ("from", "to"):
            if edge.get(end) not in known:
                errors.append(f"diagram {name}: edge {edge.get('id')} {end} names unknown element {edge.get(end)!r}")
    for key in ("badges", "notes"):
        for item in diagram.get(key, []):
            if item.get("near") not in known:
                errors.append(f"diagram {name}: {key[:-1]} {item.get('id')} is near unknown element {item.get('near')!r}")
    for group in diagram.get("groups", []):
        missing = [member for member in group.get("members", []) if member not in nodes]
        if missing:
            errors.append(f"diagram {name}: group {group.get('id')} has members that are not nodes: {', '.join(map(str, missing))}")
    return errors


def render_errors(d: deckmod.Deck, part: int) -> list[str]:
    errors = [f"line {line}: {message}" for line, message in d.errors]
    template = d.meta.get("template")
    if template not in contract.DECK_TEMPLATE_IDS:
        accepted = " or ".join(repr(known) for known in contract.DECK_TEMPLATE_IDS)
        return errors + [f"line 1: template is {template!r}, expected {accepted}"]
    if d.meta.get("part") != part:
        errors.append(f"line 1: part is {d.meta.get('part')!r}, expected {part}")
    if template != DECK_AT_1 and d.units is None and contract.UNITS_HEADING not in d.headings:
        errors.append(f"{contract.UNITS_HEADING}: a deck@2 deck needs its unit map (a ## {contract.UNITS_HEADING} section)")
    slides = d.slides()
    ids = {slide.id for slide in slides}
    for slide in slides:
        errors += [f"line {slide.line}: {slide.id}: {message}" for message in _slide(slide, d, ids)]
    for listing in d.listings.values():
        status = listing.meta.get("status")
        if status not in contract.SNIPPET_STATUSES:
            errors.append(f"line {listing.line}: listing {listing.snippet}: unknown status {status!r}")
    for diagram in d.diagrams.values():
        errors += [f"{contract.DIAGRAMS_HEADING}: {message}" for message in _diagram(diagram)]
    return errors


def load(course_dir: Path, part: int) -> Loaded:
    path = find_deck(course_dir, part)
    raw = path.read_bytes()
    d = deckmod.parse_deck(raw.decode("utf-8"))
    vocabulary = read_vocabulary(course_dir)
    errors = render_errors(d, part)
    if errors:
        raise DeckError(errors)
    source = course_dir / str(d.meta.get("source_file", ""))
    stale = None
    if d.meta.get("source_file") and source.is_file():
        stale = hashlib.sha256(source.read_bytes()).hexdigest() != d.meta.get("source_sha256")
    return Loaded(path=path, sha256=hashlib.sha256(raw).hexdigest(), deck=d, vocabulary=vocabulary, stale=stale)
