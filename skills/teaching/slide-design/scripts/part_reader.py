"""Read course-research Part and overview files (part@1, overview@1).

The skill's own parser of its input contract, so slide-design installs and
runs without course-research. It exposes what the deck needs: the Part's
sections and sub-topic slots, its snippets with their check status and
expected output, and every URL it cites. Stdlib only.
"""

import hashlib
import re
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import frontmatter  # noqa: E402
from contract import (  # noqa: E402
    ATTR_RE,
    COVERED_SECTIONS,
    COVERED_SLOTS,
    EMPTY_SLOT,
    EXPECTED_OUTPUT_LABEL,
    OVERVIEW_FILE,
    OVERVIEW_TEMPLATE_ID,
    PART_FILE_RE,
    PART_SECTIONS,
    PART_TEMPLATE_ID,
    SNIPPET_MARKER_RE,
    UNVERIFIED_PREFIX,
)
from mdtext import Doc, scan, urls  # noqa: E402

SUBTOPIC_RE = re.compile(r"^(?P<key>\d+\.\d+) (?P<title>.+)$")


class PartError(ValueError):
    pass


@dataclass(frozen=True)
class Snippet:
    id: str
    lang: str
    code: str
    status: str
    reason: str
    subtopic: str
    expected: str | None
    expected_info: str


@dataclass(frozen=True)
class SubTopic:
    key: str
    title: str
    slots: dict[str, str]


@dataclass(frozen=True)
class Part:
    path: Path
    meta: dict
    number: int
    title: str
    body: str
    sections: dict[str, str]
    subtopics: list[SubTopic]
    snippets: dict[str, Snippet]
    urls: frozenset[str]

    def section_keys(self) -> list[str]:
        return ["opening", *[subtopic.key for subtopic in self.subtopics], "closing"]

    def slot_refs(self) -> list[str]:
        refs: list[str] = []
        for name in PART_SECTIONS:
            if name == "Sub-topics":
                for subtopic in self.subtopics:
                    refs += [f"{subtopic.key}/{slot}" for slot in COVERED_SLOTS if _filled(subtopic.slots.get(slot))]
            elif name in COVERED_SECTIONS and _filled(self.sections.get(name)):
                refs.append(name)
        return refs

    def ref_text(self, ref: str) -> str | None:
        if "/" not in ref:
            return self.sections.get(ref)
        key, slot = ref.split("/", 1)
        for subtopic in self.subtopics:
            if subtopic.key == key:
                return subtopic.slots.get(slot)
        return None


@dataclass(frozen=True)
class Overview:
    meta: dict
    title: str
    glossary: list[tuple[str, str, str]]


def _filled(text: str | None) -> bool:
    return bool(text) and text != EMPTY_SLOT


def _region(doc: Doc, heading) -> str:
    return "\n".join(doc.lines[heading.line + 1:doc.end_of(heading)]).strip()


def _skip_blank(lines: list[str], index: int) -> int:
    while index < len(lines) and not lines[index].strip():
        index += 1
    return index


def digest(path: Path) -> str:
    """SHA-256 of a Part file, so an edit that keeps its generated date still shows."""
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def find_part(course_dir: Path, number: int) -> Path:
    matches = sorted(p for p in Path(course_dir).glob(f"part-{number:02d}-*.md") if PART_FILE_RE.match(p.name))
    if not matches:
        raise PartError(f"no file for part {number} in {course_dir}")
    if len(matches) > 1:
        raise PartError(f"several files for part {number}: {', '.join(p.name for p in matches)}")
    return matches[0]


def _read(path: Path, template: str) -> tuple[dict, str]:
    if not path.exists():
        raise PartError(f"{path} does not exist")
    meta, body = frontmatter.parse(path.read_text(encoding="utf-8"))
    if meta.get("template") != template:
        raise PartError(f"{path.name}: template must be {template!r}, got {meta.get('template')!r}")
    return meta, body


def _snippets(doc: Doc) -> dict[str, Snippet]:
    found: dict[str, Snippet] = {}
    subtopic = ""
    headings = {heading.line: heading for heading in doc.headings}
    for index, line in enumerate(doc.lines):
        heading = headings.get(index)
        if heading and heading.level == 3 and SUBTOPIC_RE.match(heading.text):
            subtopic = SUBTOPIC_RE.match(heading.text).group("key")
        match = SNIPPET_MARKER_RE.match(line.strip())
        block = doc.block_at(_skip_blank(doc.lines, index + 1)) if match else None
        if not block:
            continue
        attrs = {key: value.replace("&quot;", '"') for key, value in ATTR_RE.findall(match.group("attrs"))}
        if attrs.get("skip"):
            status, reason = "skipped", attrs["skip"]
        elif attrs.get("status"):
            status, reason = attrs["status"], attrs.get("reason", "")
        else:
            status, reason = "unverified", "not checked"
        expected = _expected(doc, block.end)
        found[attrs.get("id", "")] = Snippet(
            id=attrs.get("id", ""),
            lang=block.lang,
            code=doc.block_text(block),
            status=status,
            reason=reason,
            subtopic=subtopic,
            expected=doc.block_text(expected) if expected else None,
            expected_info=expected.info if expected else "",
        )
    return found


def _expected(doc: Doc, closing_fence: int):
    lines = doc.lines
    after = _skip_blank(lines, closing_fence + 1)
    if after < len(lines) and lines[after].startswith(UNVERIFIED_PREFIX):
        after = _skip_blank(lines, after + 1)
    if after >= len(lines) or lines[after].strip() != EXPECTED_OUTPUT_LABEL:
        return None
    return doc.block_at(_skip_blank(lines, after + 1))


def read_part(path: Path) -> Part:
    path = Path(path)
    meta, body = _read(path, PART_TEMPLATE_ID)
    doc = scan(body)
    sections = {h.text: _region(doc, h) for h in doc.headings if h.level == 2}
    missing = [name for name in PART_SECTIONS if name not in sections]
    if missing:
        raise PartError(f"{path.name}: missing sections {', '.join(missing)}")
    subtopics = []
    for heading in doc.headings:
        match = SUBTOPIC_RE.match(heading.text) if heading.level == 3 else None
        if not match:
            continue
        end = doc.end_of(heading)
        slots = {h.text: _region(doc, h) for h in doc.headings if h.level == 4 and heading.line < h.line < end}
        subtopics.append(SubTopic(key=match.group("key"), title=match.group("title"), slots=slots))
    return Part(
        path=path,
        meta=meta,
        number=meta.get("part"),
        title=meta.get("title", ""),
        body=body,
        sections=sections,
        subtopics=subtopics,
        snippets=_snippets(doc),
        urls=frozenset(urls(body)),
    )


def read_overview(course_dir: Path) -> Overview:
    meta, body = _read(Path(course_dir) / OVERVIEW_FILE, OVERVIEW_TEMPLATE_ID)
    doc = scan(body)
    glossary: list[tuple[str, str, str]] = []
    for heading in doc.headings:
        if heading.level == 2 and heading.text == "Glossary":
            rows = [line.strip() for line in _region(doc, heading).split("\n") if line.strip().startswith("|")]
            for row in rows[2:]:  # skip the header row and the |---| separator
                cells = [cell.strip() for cell in row.strip("|").split("|")]
                if len(cells) >= 3:
                    glossary.append((cells[0], cells[1], cells[2]))
    return Overview(meta=meta, title=meta.get("title", ""), glossary=glossary)
