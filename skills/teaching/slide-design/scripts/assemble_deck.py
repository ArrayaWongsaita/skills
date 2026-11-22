"""Assemble one Part's section drafts into its deck file (slide-design/deck@1).

Reads <course_dir>/slides/_work/part-NN/: sections/<key>.md for every
section in Part order, diagrams.md and the optional deck-notes.md. Writes
<course_dir>/slides/<the Part's file name>. Slide ids are renumbered in deck
order (a writer's split ids such as 1-007a become plain numbers), answer
`revisit` pointers follow, and the deck notes, diagrams and code listings
are generated. Assembling the same inputs twice gives the same file.

CLI:
    python3 assemble_deck.py <course_dir> <part>
"""

import datetime
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import frontmatter  # noqa: E402
from contract import (  # noqa: E402
    CLOSING,
    DECK_FRONTMATTER_KEYS,
    DECK_TEMPLATE_ID,
    DIAGRAMS_HEADING,
    DRAFT_ID_RE,
    LISTINGS_HEADING,
    NOTES_HEADING,
    OPENING,
    SLIDES_DIR,
    VOCABULARY_FILE,
    WORK_DIR,
)
from deck import Section, meta_block, parse_diagrams, parse_sections  # noqa: E402
from deck_state import StateError, load_state  # noqa: E402
from mdtext import scan  # noqa: E402
from part_reader import Part, PartError, find_part, read_part  # noqa: E402
from vocabulary import VocabularyError  # noqa: E402
from vocabulary import load as load_vocabulary  # noqa: E402

BACKTICKS_RE = re.compile(r"`{3,}")
NOTES_FILE = "deck-notes.md"


class AssembleError(ValueError):
    pass


def work_dir(course_dir: Path, part: int) -> Path:
    return Path(course_dir) / SLIDES_DIR / WORK_DIR / f"part-{int(part):02d}"


def renumber(sections: list[Section], part: int) -> dict[str, str]:
    mapping: dict[str, str] = {}
    seen: set[str] = set()
    number = 0
    for section in sections:
        for slide in section.slides:
            match = DRAFT_ID_RE.match(slide.id)
            if not match or int(match.group("part")) != int(part):
                raise AssembleError(f"slide id {slide.id} must look like {part}-NNN, or {part}-NNNa for a split slide")
            if slide.id in seen:
                raise AssembleError(f"duplicate slide id {slide.id}")
            seen.add(slide.id)
            number += 1
            final = f"{part}-{number:03d}"
            mapping[slide.id] = final
            mapping.setdefault(f"{match.group('part')}-{match.group('n')}", final)
    return mapping


def _heading(part: Part, key: str) -> str:
    if key == "opening":
        return f"## {OPENING}"
    if key == "closing":
        return f"## {CLOSING}"
    title = next(subtopic.title for subtopic in part.subtopics if subtopic.key == key)
    return f"## {key} {title}"


def _read_drafts(work: Path, part: Part) -> list[tuple[str, str, Section]]:
    drafts = []
    for key in part.section_keys():
        path = work / "sections" / f"{key}.md"
        if not path.exists():
            raise AssembleError(f"missing section draft: {key}")
        text = path.read_text(encoding="utf-8")
        sections, errors = parse_sections(text)
        if errors:
            raise AssembleError(f"sections/{key}.md: " + "; ".join(f"line {line}: {message}" for line, message in errors))
        if [section.key for section in sections] != [key]:
            raise AssembleError(f"sections/{key}.md must hold exactly one section, headed {_heading(part, key)!r}")
        if not sections[0].slides:
            raise AssembleError(f"sections/{key}.md has no slides")
        drafts.append((key, text, sections[0]))
    return drafts


def _rewrite(text: str, section: Section, heading: str, mapping: dict[str, str]) -> str:
    """Rewrite one draft: Part heading, final slide ids, re-emitted slide blocks; every other line verbatim."""
    lines = text.split("\n")
    doc = scan(text)
    start = section.line - 1
    end = doc.end_of(next(h for h in doc.headings if h.line == start))
    replacements: list[tuple[int, int, list[str]]] = [(start, start + 1, [heading])]
    for slide in section.slides:
        replacements.append((slide.line - 1, slide.line, [f"### {mapping[slide.id]} · {slide.layout}"]))
        meta = dict(slide.meta)
        if "revisit" in meta:
            if meta["revisit"] not in mapping:
                raise AssembleError(f"slide {slide.id}: revisit {meta['revisit']!r} is not a slide in this deck")
            meta["revisit"] = mapping[meta["revisit"]]
        opened, closed = slide.meta_lines
        replacements.append((opened - 1, closed, meta_block(meta).split("\n")))
    for first, last, new in sorted(replacements, reverse=True):
        lines[first:last] = new  # every replacement lies inside [start, end), so only end moves
        end += len(new) - (last - first)
    return "\n".join(lines[start:end]).strip()


def _notes(work: Path) -> str:
    path = work / NOTES_FILE
    if not path.exists():
        return ""
    lines = path.read_text(encoding="utf-8").strip().split("\n")
    if lines and lines[0].strip() == f"# {NOTES_HEADING}":
        lines = lines[1:]
    if any(heading.text for heading in scan("\n".join(lines)).headings):
        raise AssembleError(f"{NOTES_FILE} must not contain headings: write paragraphs and lists only")
    return "\n".join(lines).strip()


def _fence(text: str) -> str:
    longest = max((len(run) for run in BACKTICKS_RE.findall(text)), default=0)
    return "`" * max(3, longest + 1)


def assemble(course_dir: Path, part: int, today: str | None = None) -> Path:
    course_dir = Path(course_dir)
    source = read_part(find_part(course_dir, part))
    state = load_state(course_dir, part)
    try:
        vocabulary = load_vocabulary(course_dir)
    except VocabularyError as error:
        raise AssembleError(str(error)) from None
    work = work_dir(course_dir, part)

    drafts = _read_drafts(work, source)
    mapping = renumber([section for _, _, section in drafts], part)
    texts = [_rewrite(text, section, _heading(source, key), mapping) for key, text, section in drafts]
    slides = [(mapping[slide.id], slide) for _, _, section in drafts for slide in section.slides]

    referenced: set[str] = set()
    visuals = []
    for final, slide in slides:
        snippet = slide.meta.get("snippet")
        if slide.layout in ("code", "output") and snippet is not None:
            if snippet not in source.snippets:
                raise AssembleError(f"slide {slide.id}: unknown snippet {snippet!r}")
            referenced.add(snippet)
        visual = slide.visual or {}
        if visual.get("kind") == "illustration":
            visuals.append(f"- {final} illustration: {visual.get('description', '')}")
        elif visual.get("kind") == "screenshot":
            visuals.append(f"- {final} screenshot: {visual.get('capture', '')}")
    used = [snippet for snippet in source.snippets.values() if snippet.id in referenced]
    status = [f"- {s.id} {s.status}: {s.reason}" for s in used if s.status != "verified"]

    diagrams_path = work / "diagrams.md"
    if not diagrams_path.exists():
        raise AssembleError(f"missing {diagrams_path.name}: the storyboard's diagrams must be written first")
    _, raw_diagrams, errors = parse_diagrams(diagrams_path.read_text(encoding="utf-8"))
    if errors:
        raise AssembleError("diagrams.md: " + "; ".join(f"line {line}: {message}" for line, message in errors))

    listings = []
    for snippet in used:
        fence = _fence(snippet.code)
        meta = json.dumps({"snippet": snippet.id, "status": snippet.status, "reason": snippet.reason}, ensure_ascii=False)
        listings.append(f"### {snippet.id}\n\n```listing\n{meta}\n```\n\n{fence}{snippet.lang}\n{snippet.code}\n{fence}")

    data = {
        "template": DECK_TEMPLATE_ID,
        "course": source.meta.get("course"),
        "part": source.number,
        "title": source.title,
        "source_file": source.path.name,
        "source_generated": source.meta.get("generated"),
        "language": state["language"],
        "vocabulary": VOCABULARY_FILE,
        "vocabulary_version": vocabulary.version,
        "slide_count": len(slides),
        "code_status": source.meta.get("code_status"),
        "generated": today or datetime.date.today().isoformat(),
    }
    assert tuple(data) == DECK_FRONTMATTER_KEYS
    notes = _notes(work)
    parts = [
        f"# Part {source.number}: {source.title}",
        f"## {NOTES_HEADING}",
        *([notes] if notes else []),
        "### Visuals to produce",
        "\n".join(visuals) or "_None._",
        "### Code status",
        "\n".join(status) or "_None._",
        *texts,
        f"## {DIAGRAMS_HEADING}",
        "\n\n".join(raw_diagrams) or "_None._",
        f"## {LISTINGS_HEADING}",
        "\n\n".join(listings) or "_None._",
    ]
    out = Path(course_dir) / SLIDES_DIR / source.path.name
    out.write_text(frontmatter.render(data) + "\n\n".join(parts) + "\n", encoding="utf-8")
    return out


if __name__ == "__main__":
    try:
        if len(sys.argv) != 3:
            raise AssembleError("usage: assemble_deck.py <course_dir> <part>")
        print(assemble(Path(sys.argv[1]), int(sys.argv[2])))
    except (AssembleError, PartError, StateError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        sys.exit(1)
