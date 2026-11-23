"""Validate one Part's deck (slide-design/deck@2) against its Part.

Checks structure, the unit map and the unit structure (unit_checks.py: the
map slide, a topic slide per unit, the chapter and Part assemblies), text lengths, visuals, diagrams and their build states,
coverage of every filled Part slot and snippet, and fidelity: code, output,
commands, error messages, inline code and URLs must come from the Part
verbatim. A deck whose Part changed after assembly is reported as stale and
checked no further. `--plan` checks the storyboard before the gate: its
diagrams (_work/part-NN/diagrams.md) and its unit map (_work/part-NN/units.json).
`--diagrams` checks the diagrams alone.

CLI:
    python3 validate_deck.py <course_dir> <part> [--plan | --diagrams] [--json]
Exit 1 if any error, else 0.
"""

import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from contract import (  # noqa: E402
    CLOSING,
    DECK_FRONTMATTER_KEYS,
    DECK_TEMPLATE_ID,
    DIAGRAMS_HEADING,
    EMPTY_SLOT,
    FALLBACK_KINDS,
    FIELD_LIMITS,
    ITEM_COUNTS,
    LAYOUT_META_KEYS,
    LAYOUTS,
    LISTINGS_HEADING,
    META_KEYS,
    NOTES_HEADING,
    NOTICE_LIMIT,
    OPENING,
    PURPOSE_LIMIT,
    SLIDES_DIR,
    TITLE_LIMIT,
    UNITS_FILE,
    UNITS_HEADING,
    VISUAL_KINDS,
    VOCABULARY_FILE,
    WORK_DIR,
)
from deck import Deck, Slide, parse_deck, parse_diagrams, slide_units  # noqa: E402
from diagram_checks import check_diagram, check_states  # noqa: E402
from mdtext import inline_code, urls, visible_length  # noqa: E402
from part_reader import Part, PartError, digest, find_part, read_part  # noqa: E402
from unit_checks import check_structure  # noqa: E402
from units import UnitsError, check_units, load_units, units_by_id  # noqa: E402
from vocabulary import Vocabulary, VocabularyError, add_concepts, init_vocabulary, vocabulary_path  # noqa: E402
from vocabulary import load as load_vocabulary  # noqa: E402


@dataclass(frozen=True)
class Issue:
    level: str  # "error" | "warning"
    where: str
    message: str


def _error(where: str, message: str) -> Issue:
    return Issue("error", where, message)


def _work(course_dir: Path, part: int) -> Path:
    return Path(course_dir) / SLIDES_DIR / WORK_DIR / f"part-{int(part):02d}"


# --- deck-level checks -----------------------------------------------------


def _stale(deck: Deck, source: Part) -> str:
    """Why the deck no longer matches its Part, or "" when it does."""
    generated = source.meta.get("generated")
    if deck.meta.get("source_generated") != generated:
        return f"Part generated {generated}"
    if deck.meta.get("source_sha256") != digest(source.path):
        return f"Part generated {generated}, but its text changed"
    return ""


def _frontmatter(deck: Deck, source: Part, vocab: Vocabulary | None) -> list[Issue]:
    meta, issues = deck.meta, []
    if tuple(meta) != DECK_FRONTMATTER_KEYS:
        issues.append(_error("frontmatter", f"frontmatter keys must be {', '.join(DECK_FRONTMATTER_KEYS)}, in that order"))
    expected = {
        "template": DECK_TEMPLATE_ID,
        "course": source.meta.get("course"),
        "part": source.number,
        "title": source.title,
        "source_file": source.path.name,
        "vocabulary": VOCABULARY_FILE,
        "slide_count": len(deck.slides()),
        "code_status": source.meta.get("code_status"),
    }
    for key, value in expected.items():
        if meta.get(key) != value:
            issues.append(_error("frontmatter", f"frontmatter {key} should be {value}"))
    for key in ("language", "generated"):
        if not isinstance(meta.get(key), str) or not meta.get(key):
            issues.append(_error("frontmatter", f"frontmatter {key} must be a non-empty string"))
    if vocab is not None:
        version, low = meta.get("vocabulary_version"), min(1, vocab.version)
        if not isinstance(version, int) or isinstance(version, bool) or not low <= version <= vocab.version:
            issues.append(_error("frontmatter", f"frontmatter vocabulary_version should be between {low} and {vocab.version}"))
    return issues


def _headings(deck: Deck, source: Part) -> list[Issue]:
    issues = []
    expected = [NOTES_HEADING, OPENING, *[f"{s.key} {s.title}" for s in source.subtopics], CLOSING, UNITS_HEADING, DIAGRAMS_HEADING, LISTINGS_HEADING]
    if deck.headings != expected:
        issues.append(_error("deck", f"sections must be: {', '.join(expected)}"))
    if not deck.notes.split("\n### ", 1)[0].strip() or deck.notes.startswith("### "):
        issues.append(_error("deck", "deck notes must not be empty: write the learner profile and Part gaps before the generated lists"))
    return issues


def _units(deck: Deck, source: Part) -> list[Issue]:
    if deck.units is None:
        return [_error("deck", "a deck@2 deck needs its Units section")]
    problems = check_units(deck.units, [s.key for s in source.subtopics])
    if problems:
        return [_error("units", message) for message in problems]
    return [_error(where, message) for where, message in check_structure(deck.sections, deck.units)]


def _listings(deck: Deck, source: Part, used: list[str]) -> list[Issue]:
    issues = []
    if list(deck.listings) != used:
        issues.append(_error("listings", f"code listings must be exactly the snippets the slides use, in Part order: {', '.join(used) or 'none'}"))
    for snippet_id, listing in deck.listings.items():
        snippet = source.snippets.get(snippet_id)
        if snippet is None:
            continue
        if listing.code is None or listing.code.text != snippet.code or listing.code.lang != snippet.lang:
            issues.append(_error("listings", f"listing {snippet_id} differs from the Part"))
        if listing.meta.get("status") != snippet.status or listing.meta.get("reason") != snippet.reason:
            issues.append(_error("listings", f"listing status for {snippet_id} should be {snippet.status} ({snippet.reason or 'no reason'})"))
    return issues


def _diagrams(deck: Deck, vocab: Vocabulary | None) -> list[Issue]:
    concepts = set(vocab.concepts) if vocab else set()
    issues = [_error(diagram_id, message) for diagram_id, diagram in deck.diagrams.items() for message in check_diagram(diagram, concepts)]
    issues += [_error(slide_id, message) for slide_id, message in check_states(deck.slides(), deck.diagrams)]
    used = set()
    for slide in deck.slides():
        visual = slide.visual or {}
        for state in (visual, visual.get("fallback")):
            if isinstance(state, dict) and state.get("kind") == "diagram":
                used.add(state.get("diagram"))
    issues += [Issue("warning", diagram_id, "unused diagram") for diagram_id in deck.diagrams if diagram_id not in used]
    return issues


# --- slide-level checks ----------------------------------------------------


def _too_long(name: str, text: str, limit: int) -> str | None:
    length = visible_length(text)
    return f"too long: {name} has {length} characters, limit {limit}" if length > limit else None


def _ranges(value, size: int) -> list[tuple[int, int]] | None:
    """Ascending, non-overlapping 1-based [first, last] ranges inside 1..size, else None."""
    if not isinstance(value, list) or not value:
        return None
    ranges, previous = [], 0
    for item in value:
        if not (isinstance(item, list) and len(item) == 2 and all(isinstance(n, int) and not isinstance(n, bool) for n in item)):
            return None
        first, last = item
        if not previous < first <= last <= size:
            return None
        ranges.append((first, last))
        previous = last
    return ranges


def _code(slide: Slide, source: Part) -> list[str]:
    messages = []
    layout = LAYOUTS[slide.layout]
    snippet_id = slide.meta.get("snippet")
    snippet = source.snippets.get(snippet_id)
    if snippet is None:
        return [f"{slide.layout} slide needs a snippet from the Part, got {snippet_id!r}"]
    if len(slide.blocks) != 1:
        return [f"{slide.layout} slide holds exactly one block"]
    block = slide.blocks[0]
    if layout.content in ("code", "assembly"):
        if block.lang != snippet.lang:
            messages.append(f"code block language should be {snippet.lang}")
        lines = snippet.code.split("\n")
        shown = _ranges(slide.meta.get("lines"), len(lines))
        if shown is None:
            messages.append(f"lines must be ascending, non-overlapping [first, last] ranges inside snippet {snippet_id} (1–{len(lines)})")
        else:
            highlight = slide.meta.get("highlight", [])
            marked = _ranges(highlight, len(lines)) if highlight else []
            if marked is None or any(not any(a <= first and last <= b for a, b in shown) for first, last in marked):
                messages.append("highlight must be ascending ranges inside the shown lines")
            excerpt = "\n".join(line for first, last in shown for line in lines[first - 1:last])
            if block.text != excerpt:
                messages.append(f"code excerpt differs from snippet {snippet_id}")
    else:
        if snippet.expected is None:
            messages.append(f"snippet {snippet_id} has no expected output in the Part")
        elif block.text != snippet.expected or block.info != snippet.expected_info:
            messages.append(f"output differs from the Part for snippet {snippet_id}")
    if snippet.status != "verified" and "Notice" not in slide.fields:
        messages.append(f"needs a Notice: snippet {snippet_id} is {snippet.status}")
    return messages


def _visual(slide: Slide, source: Part, vocab: Vocabulary | None) -> list[str]:
    mode, visual = LAYOUTS[slide.layout].visual, slide.visual
    if visual is None:
        return ["needs a visual"] if mode == "required" else []
    if mode == "none":
        return ["takes no visual"]
    kind = visual.get("kind")
    if kind not in VISUAL_KINDS:
        return [f"unknown visual kind {kind!r}"]
    messages = []
    if kind == "illustration":
        messages += [f"illustration needs {key}" for key in ("description", "prompt", "alt") if not str(visual.get(key, "")).strip()]
        if vocab and vocab.style and not str(visual.get("prompt", "")).rstrip().endswith(vocab.style.strip()):
            messages.append("prompt must end with the illustration style")
    if kind == "screenshot":
        if visual.get("url") not in source.urls:
            messages.append(f"screenshot url not in the Part: {visual.get('url')}")
        if not str(visual.get("capture", "")).strip():
            messages.append("screenshot needs capture")
    if kind in ("illustration", "screenshot"):
        fallback = visual.get("fallback")
        if not isinstance(fallback, dict) or fallback.get("kind") not in FALLBACK_KINDS:
            messages.append(f"needs a fallback ({' or '.join(FALLBACK_KINDS)})")
        elif fallback["kind"] == "text" and not str(fallback.get("text", "")).strip():
            messages.append("text fallback needs text")
    return messages


def _fields(slide: Slide) -> list[str]:
    layout, messages = LAYOUTS[slide.layout], []
    messages += [f"missing field {name}" for name in layout.required if name not in slide.fields]
    allowed = set(layout.required) | set(layout.optional)
    messages += [f"field {name} not allowed in {slide.layout}" for name in slide.fields if name not in allowed]
    items = slide.fields.get("Items")
    if items is not None and not items.items:
        messages.append("Items must be a numbered or bulleted list")
    if slide.layout in ITEM_COUNTS and items is not None:
        low, high = ITEM_COUNTS[slide.layout]
        if not low <= len(items.items) <= high:
            messages.append(f"{slide.layout} needs {low} to {high} items, has {len(items.items)}")
    if slide.layout == "error" and "Symptom" not in slide.fields and not slide.blocks:
        messages.append("an error slide needs a Symptom field or an error block")
    for name, field in slide.fields.items():
        if name == "Title":
            limit = TITLE_LIMIT
        elif name == "Notice":
            limit = NOTICE_LIMIT
        else:
            limit = FIELD_LIMITS.get((slide.layout, name))
        if limit is None:
            continue
        if name == "Items":
            for number, item in enumerate(field.items, start=1):
                message = _too_long(f"Items item {number}", item, limit)
                messages += [message] if message else []
        else:
            message = _too_long(name, field.text, limit)
            messages += [message] if message else []
    return messages


def _fidelity(slide: Slide, source: Part) -> list[str]:
    messages = []
    content = LAYOUTS[slide.layout].content
    blocks = list(slide.blocks) + [block for field in slide.fields.values() for block in field.blocks]
    if content in ("setup", "error", "panels"):
        messages += ["block not in the Part" for block in blocks if block.text.strip() not in source.body]
    elif content == "none" and blocks:
        messages.append(f"{slide.layout} slides take no code blocks")
    for field in slide.fields.values():
        for span in inline_code(field.text):
            if span not in source.body:
                messages.append(f"inline code not in the Part: `{span}`")
    sources = slide.meta.get("sources", [])
    found = (sources if isinstance(sources, list) else []) + [url for field in slide.fields.values() for url in urls(field.text)]
    for url in dict.fromkeys(found):
        if url not in source.urls:
            messages.append(f"source not in the Part: {url}")
    return messages


def _meta(slide: Slide, source: Part, earlier: set[str], moved_from: str | None = None) -> list[str]:
    meta, messages = slide.meta, []
    allowed = set(META_KEYS) | set(LAYOUT_META_KEYS.get(slide.layout, ()))
    messages += [f"unknown slide key {key!r}" for key in meta if key not in allowed]
    purpose = meta.get("purpose")
    if not isinstance(purpose, str) or not purpose.strip():
        messages.append("purpose is missing")
    else:
        message = _too_long("purpose", purpose, PURPOSE_LIMIT)
        messages += [message] if message else []
    refs = meta.get("from")
    if not isinstance(refs, list) or not refs or not all(isinstance(ref, str) for ref in refs):
        messages.append("from must list at least one Part ref")
        refs = []
    for ref in refs:
        text = source.ref_text(ref)
        if text is None:
            messages.append(f"unknown ref {ref!r}")
        elif text == EMPTY_SLOT:
            messages.append(f"ref points to an empty slot: {ref}")
        if "/" in ref and ref.split("/", 1)[0] not in (slide.section, moved_from):
            messages.append(f"content from {ref.split('/', 1)[0]} in section {slide.section}")
    if "sources" in meta and not isinstance(meta["sources"], list):
        messages.append("sources must be a list of URLs")
    if "revisit" in meta and meta["revisit"] not in earlier:
        messages.append("revisit must point to an earlier slide")
    return messages


def _slides(deck: Deck, source: Part, vocab: Vocabulary | None) -> tuple[list[Issue], list[str]]:
    issues: list[Issue] = []
    slides = deck.slides()
    expected_ids = [f"{source.number}-{n:03d}" for n in range(1, len(slides) + 1)]
    if [slide.id for slide in slides] != expected_ids:
        issues.append(_error("deck", f"slide ids must be sequential from {source.number}-001"))
    earlier: set[str] = set()
    unit_of, by_id = slide_units(deck.sections), units_by_id(deck.units or {})
    for slide in slides:
        layout = slide.meta.get("layout")
        moved_from = (by_id.get(unit_of.get(slide.id)) or {}).get("moved_from")
        messages = []
        if layout not in LAYOUTS:
            messages.append(f"unknown layout {layout!r}")
        if slide.layout != layout:
            messages.append(f"the heading says {slide.layout} but the slide block says {layout}")
        if not messages:
            messages += _meta(slide, source, earlier, moved_from)
            messages += _fields(slide)
            messages += _visual(slide, source, vocab)
            messages += _fidelity(slide, source)
            if LAYOUTS[layout].content in ("code", "output") or (layout == "assemble" and "snippet" in slide.meta):
                messages += _code(slide, source)
        issues += [_error(slide.id, message) for message in messages]
        earlier.add(slide.id)
    return issues, slides


def _coverage(slides: list[Slide], source: Part) -> tuple[list[Issue], list[str]]:
    covered = {ref for slide in slides for ref in (slide.meta.get("from") or []) if isinstance(ref, str)}
    issues = [_error("coverage", f"not covered: {ref}") for ref in source.slot_refs() if ref not in covered]
    in_code = {slide.meta.get("snippet") for slide in slides if slide.layout in ("code", "assemble")}
    issues += [_error("coverage", f"not covered: snippet {snippet_id}") for snippet_id in source.snippets if snippet_id not in in_code]
    referenced = {slide.meta.get("snippet") for slide in slides if slide.layout in ("code", "output", "assemble")}
    return issues, [snippet_id for snippet_id in source.snippets if snippet_id in referenced]


# --- entry points ----------------------------------------------------------


def validate(course_dir: Path, part: int) -> list[Issue]:
    course_dir = Path(course_dir)
    try:
        source = read_part(find_part(course_dir, part))
    except PartError as error:
        return [_error("part", str(error))]
    deck_path = course_dir / SLIDES_DIR / source.path.name
    if not deck_path.exists():
        return [_error("deck", f"no deck at {deck_path}: run assemble_deck.py first")]
    issues: list[Issue] = []
    try:
        vocab = load_vocabulary(course_dir)
    except VocabularyError as error:
        vocab = None
        issues.append(_error("vocabulary", str(error)))
    deck = parse_deck(deck_path.read_text(encoding="utf-8"))
    issues += [_error(f"line {line}", message) for line, message in deck.errors]
    stale = _stale(deck, source)
    if stale:
        issues.append(_error("frontmatter", f"stale: the Part changed after this deck ({stale}); redo the storyboard and assemble again"))
        return issues
    issues += _frontmatter(deck, source, vocab)
    issues += _headings(deck, source)
    issues += _units(deck, source)
    slide_issues, slides = _slides(deck, source, vocab)
    issues += slide_issues
    coverage, used = _coverage(slides, source)
    issues += coverage
    issues += _listings(deck, source, used)
    issues += _diagrams(deck, vocab)
    return issues


def validate_diagrams(course_dir: Path, part: int) -> list[Issue]:
    course_dir, work = Path(course_dir), _work(course_dir, part)
    path = work / "diagrams.md"
    if not path.exists():
        return [_error("diagrams", f"no diagrams file at {path}")]
    diagrams, _, errors = parse_diagrams(path.read_text(encoding="utf-8"))
    issues = [_error(f"line {line}", message) for line, message in errors]
    try:
        base = load_vocabulary(course_dir) if vocabulary_path(course_dir).exists() else init_vocabulary("", "")
    except VocabularyError as error:
        return issues + [_error("vocabulary", str(error))]
    new_path = work / "new-concepts.json"
    try:
        new = json.loads(new_path.read_text(encoding="utf-8")) if new_path.exists() else []
        concepts = set(add_concepts(base, new, int(part)).concepts)
    except (json.JSONDecodeError, VocabularyError, TypeError, AttributeError) as error:
        issues.append(_error("new-concepts.json", str(error)))
        concepts = set(base.concepts)
    for diagram_id, diagram in diagrams.items():
        issues += [_error(diagram_id, message) for message in check_diagram(diagram, concepts)]
    return issues


def validate_plan(course_dir: Path, part: int) -> list[Issue]:
    """The storyboard's diagrams and unit map, before the gate."""
    issues = validate_diagrams(course_dir, part)
    try:
        data = load_units(_work(course_dir, part) / UNITS_FILE)
        source = read_part(find_part(Path(course_dir), part))
    except UnitsError as error:
        return issues + [_error(UNITS_FILE, str(error))]
    except PartError as error:
        return issues + [_error("part", str(error))]
    return issues + [_error(UNITS_FILE, message) for message in check_units(data, [sub.key for sub in source.subtopics])]


def main(argv: list[str]) -> int:
    flags = {arg for arg in argv if arg.startswith("--")}
    args = [arg for arg in argv if not arg.startswith("--")]
    if len(args) != 2 or flags - {"--plan", "--diagrams", "--json"} or {"--plan", "--diagrams"} <= flags:
        print("usage: validate_deck.py <course_dir> <part> [--plan | --diagrams] [--json]", file=sys.stderr)
        return 2
    course_dir, part = Path(args[0]), int(args[1])
    if "--plan" in flags:
        issues = validate_plan(course_dir, part)
    elif "--diagrams" in flags:
        issues = validate_diagrams(course_dir, part)
    else:
        issues = validate(course_dir, part)
    if "--json" in flags:
        print(json.dumps([asdict(issue) for issue in issues], ensure_ascii=False))
    else:
        for issue in issues:
            print(f"{issue.level}: {issue.where}: {issue.message}")
        errors = sum(issue.level == "error" for issue in issues)
        print(f"{errors} error(s), {len(issues) - errors} warning(s)")
    return 1 if any(issue.level == "error" for issue in issues) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
