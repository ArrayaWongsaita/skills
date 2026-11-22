"""Structural validator for a course-research output folder.

Checks what a script can check: the Part and overview templates from
contract.py, slot rules per delivery mode, citations-as-URLs, snippet
markers, outcome coverage, prerequisite order and file numbering. Semantic
checks (do bridges match, is every claim cited) belong to the consistency
review subagent.

CLI:
    python3 validate_course.py <course_dir> [--json]
Exit 1 when any error is found, else 0. Stdlib only.
"""

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import frontmatter  # noqa: E402
from contract import (  # noqa: E402
    ALWAYS_REQUIRED_SLOTS,
    CODE_LANGS,
    CODE_STATUSES,
    DELIVERY_MODES,
    EMPTY_SLOT,
    EXPECTED_OUTPUT_LABEL,
    OVERVIEW_FILE,
    OVERVIEW_FRONTMATTER_KEYS,
    OVERVIEW_SECTIONS,
    OVERVIEW_TEMPLATE_ID,
    PART_FILE_RE,
    PART_FRONTMATTER_KEYS,
    PART_SECTIONS,
    PART_TEMPLATE_ID,
    PYTHON_LANGS,
    SCOPE_KEYS,
    SELF_PACED_REQUIRED_SECTIONS,
    SELF_PACED_REQUIRED_SLOTS,
    SIZES,
    SNIPPET_ID_RE,
    SNIPPET_MARKER_RE,
    SUBTOPIC_SLOTS,
    TECHNICAL_ONLY_OVERVIEW_SECTIONS,
    UNVERIFIED_PREFIX,
)

SCOPE_FILE = "_work/scope.md"
HEADING_RE = re.compile(r"^(#{1,6}) (.+?)\s*$")
ATTR_RE = re.compile(r'([a-z_]+)="([^"]*)"')
URL_RE = re.compile(r"https?://")


@dataclass(frozen=True)
class Issue:
    level: str  # "error" | "warning"
    file: str
    where: str
    message: str


def parse_marker(line: str) -> dict[str, str] | None:
    match = SNIPPET_MARKER_RE.match(line.strip())
    if not match:
        return None
    return {key: value.replace("&quot;", '"') for key, value in ATTR_RE.findall(match.group("attrs"))}


def computed_code_status(markers: list[dict]) -> str:
    if not markers:
        return "none"
    verified = sum(1 for marker in markers if marker.get("status") == "verified")
    if verified == len(markers):
        return "verified"
    return "unverified" if verified == 0 else "partial"


# --- markdown model -------------------------------------------------------


@dataclass(frozen=True)
class Heading:
    level: int
    text: str
    line: int


@dataclass(frozen=True)
class Block:
    lang: str
    start: int  # index of the opening fence
    end: int  # index of the closing fence


@dataclass
class Doc:
    lines: list[str]
    headings: list[Heading] = field(default_factory=list)
    blocks: list[Block] = field(default_factory=list)

    def next_heading(self, after: int, max_level: int = 6) -> int:
        for heading in self.headings:
            if heading.line > after and heading.level <= max_level:
                return heading.line
        return len(self.lines)

    def content(self, start: int, end: int) -> list[str]:
        """Non-blank lines in (start, end), stopping at any heading."""
        stop = min(end, self.next_heading(start))
        return [line.strip() for line in self.lines[start + 1:stop] if line.strip()]

    def text(self, start: int, end: int) -> str:
        return "\n".join(self.lines[start + 1:end])


def scan(body: str) -> Doc:
    doc = Doc(lines=body.split("\n"))
    fence, lang, opened = None, "", 0
    for index, line in enumerate(doc.lines):
        stripped = line.strip()
        if fence:
            if stripped.startswith(fence) and not stripped.lstrip(fence[0]):
                doc.blocks.append(Block(lang=lang, start=opened, end=index))
                fence = None
            continue
        if stripped.startswith(("```", "~~~")):
            char = stripped[0]
            fence = char * (len(stripped) - len(stripped.lstrip(char)))
            info = stripped[len(fence):].strip().split()
            lang, opened = (info[0].lower() if info else ""), index
            continue
        match = HEADING_RE.match(line)
        if match:
            doc.headings.append(Heading(level=len(match.group(1)), text=match.group(2), line=index))
    return doc


def _skip_blank(lines: list[str], index: int) -> int:
    while index < len(lines) and not lines[index].strip():
        index += 1
    return index


# --- one part -------------------------------------------------------------


@dataclass
class PartInfo:
    number: int | None
    title: str | None
    outcomes: list
    prerequisites: list
    snippet_ids: list[str]


def _analyze_part(path: Path, scope: dict) -> tuple[list[Issue], PartInfo]:
    name = path.name
    issues: list[Issue] = []

    def error(where: str, message: str) -> None:
        issues.append(Issue("error", name, where, message))

    info = PartInfo(number=None, title=None, outcomes=[], prerequisites=[], snippet_ids=[])
    try:
        data, body = frontmatter.parse(path.read_text(encoding="utf-8"))
    except frontmatter.FrontmatterError as problem:
        error("frontmatter", str(problem))
        return issues, info

    missing = [key for key in PART_FRONTMATTER_KEYS if key not in data]
    extra = [key for key in data if key not in PART_FRONTMATTER_KEYS]
    if missing:
        error("frontmatter", f"missing keys: {', '.join(missing)}")
    if extra:
        error("frontmatter", f"unexpected keys: {', '.join(extra)}")
    if data.get("template") != PART_TEMPLATE_ID:
        error("frontmatter", f"template must be {PART_TEMPLATE_ID!r}")
    number = data.get("part")
    file_match = PART_FILE_RE.match(name)
    if file_match and number != int(file_match.group(1)):
        error("frontmatter", f"part is {number!r} but the filename says {int(file_match.group(1))}")
    if data.get("course") != scope.get("course"):
        error("frontmatter", f"course is {data.get('course')!r} but scope says {scope.get('course')!r}")
    technical = bool(scope.get("technical"))
    versions = data.get("versions")
    if technical and not (isinstance(versions, dict) and versions):
        error("frontmatter", "versions must name the pinned packages for a technical course")
    if not technical and versions != {}:
        error("frontmatter", "versions must be {} for a non-technical course")

    info.number = number if isinstance(number, int) else None
    info.title = data.get("title")
    info.outcomes = data.get("outcomes") or []
    info.prerequisites = data.get("prerequisite_parts") or []

    doc = scan(body)
    h1 = [h for h in doc.headings if h.level == 1]
    if not h1 or h1[0].text != f"Part {number}: {info.title}":
        error("heading", f"the H1 must be '# Part {number}: {info.title}'")

    self_paced = scope.get("delivery_mode") == "self-paced"
    _check_sections(doc, self_paced, error)
    _check_subtopics(doc, number, self_paced, error)
    markers = _check_code(doc, number, technical, self_paced, error)
    info.snippet_ids = [marker.get("id", "") for marker in markers]

    status = data.get("code_status")
    if status not in CODE_STATUSES:
        error("frontmatter", f"code_status must be one of {', '.join(CODE_STATUSES)}")
    elif status != computed_code_status(markers):
        error("frontmatter", f"code_status is {status!r} but the snippet markers say {computed_code_status(markers)!r}")
    return issues, info


def _check_sections(doc: Doc, self_paced: bool, error) -> None:
    found = [h for h in doc.headings if h.level == 2]
    names = [h.text for h in found]
    for section in PART_SECTIONS:
        if section not in names:
            error(f"section {section}", "missing")
    for section in names:
        if section not in PART_SECTIONS:
            error(f"section {section}", "unexpected section")
    present = [n for n in names if n in PART_SECTIONS]
    if present != [s for s in PART_SECTIONS if s in present]:
        error("sections", f"out of order; expected: {', '.join(PART_SECTIONS)}")
    for heading in found:
        if heading.text == "Sub-topics" or heading.text not in PART_SECTIONS:
            continue
        end = doc.next_heading(heading.line, max_level=2)
        content = doc.content(heading.line, end)
        if not content:
            error(f"section {heading.text}", "empty section")
        elif self_paced and heading.text in SELF_PACED_REQUIRED_SECTIONS and content == [EMPTY_SLOT]:
            error(f"section {heading.text}", "required for self-paced courses")
        if heading.text == "Sources" and not URL_RE.search(doc.text(heading.line, end)):
            error("section Sources", "needs at least one http(s) URL")


def _check_subtopics(doc: Doc, number, self_paced: bool, error) -> None:
    holder = next((h for h in doc.headings if h.level == 2 and h.text == "Sub-topics"), None)
    if holder is None:
        return
    end = doc.next_heading(holder.line, max_level=2)
    subtopics = [h for h in doc.headings if h.level == 3 and holder.line < h.line < end]
    if not subtopics:
        error("section Sub-topics", "needs at least one '### N.k' sub-topic")
        return
    required = set(ALWAYS_REQUIRED_SLOTS) | (set(SELF_PACED_REQUIRED_SLOTS) if self_paced else set())
    pattern = re.compile(rf"^{number}\.(\d+) \S")
    for expected, heading in enumerate(subtopics, start=1):
        match = pattern.match(heading.text)
        if not match:
            error(f"sub-topic {heading.text}", f"expected '### {number}.<k> <title>'")
            continue
        label = f"{number}.{match.group(1)}"
        if int(match.group(1)) != expected:
            error(f"sub-topic {label}", f"numbering gap: expected {number}.{expected}")
        sub_end = min(doc.next_heading(heading.line, max_level=3), end)
        slots = [h for h in doc.headings if h.level == 4 and heading.line < h.line < sub_end]
        if [s.text for s in slots] != list(SUBTOPIC_SLOTS):
            missing = [s for s in SUBTOPIC_SLOTS if s not in [x.text for x in slots]]
            error(f"sub-topic {label}", f"slots must be, in order: {', '.join(SUBTOPIC_SLOTS)}" + (f" (missing {', '.join(missing)})" if missing else ""))
        for slot in slots:
            slot_end = min(doc.next_heading(slot.line), sub_end)
            content = doc.content(slot.line, slot_end)
            where = f"sub-topic {label} / {slot.text}"
            if not content:
                error(where, f"empty slot; write '{EMPTY_SLOT}' when there is intentionally nothing")
            elif content == [EMPTY_SLOT] and slot.text in required:
                error(where, "required slot is empty")
            if slot.text == "Sources" and not URL_RE.search(doc.text(slot.line, slot_end)):
                error(where, "needs at least one http(s) URL")


def snippet_markers(doc: Doc) -> list[tuple[int, dict, Block | None]]:
    """(line, attrs, block) for every snippet marker outside code; block is None when no code block follows."""
    starts = {block.start: block for block in doc.blocks}
    inside = {i for block in doc.blocks for i in range(block.start, block.end + 1)}
    found = []
    for index, line in enumerate(doc.lines):
        if index in inside:
            continue
        attrs = parse_marker(line)
        if attrs is not None:
            found.append((index, attrs, starts.get(_skip_blank(doc.lines, index + 1))))
    return found


def _check_code(doc: Doc, number, technical: bool, self_paced: bool, error) -> list[dict]:
    lines = doc.lines
    starts = {block.start: block for block in doc.blocks}
    markers: list[dict] = []
    attached: set[int] = set()
    for _index, marker, block in snippet_markers(doc):
        markers.append(marker)
        label = f"snippet {marker.get('id', '?')}"
        if block is None:
            error(label, "marker is not followed by a code block")
            continue
        attached.add(block.start)
        if not technical:
            continue
        id_match = SNIPPET_ID_RE.match(marker.get("id", ""))
        if not id_match or int(id_match.group("part")) != number:
            error(label, f"id must look like '{number}.<k>-<x>'")
        if block.lang not in PYTHON_LANGS and "skip" not in marker:
            error(label, 'non-Python snippet needs skip="<reason>"')
        if self_paced:
            after = _skip_blank(lines, block.end + 1)
            if after < len(lines) and lines[after].startswith(UNVERIFIED_PREFIX):
                after = _skip_blank(lines, after + 1)
            label_ok = after < len(lines) and lines[after].strip() == EXPECTED_OUTPUT_LABEL
            if not label_ok or _skip_blank(lines, after + 1) not in starts:
                error(label, f"missing '{EXPECTED_OUTPUT_LABEL}' block after the code")
    if technical:
        for block in doc.blocks:
            if block.lang in CODE_LANGS and block.start not in attached:
                error(f"line {block.start + 1}", "code block without a snippet marker")
    return markers


def validate_part(path: Path, scope: dict) -> list[Issue]:
    return _analyze_part(path, scope)[0]


# --- whole course ---------------------------------------------------------


def _check_scope(scope: dict, error) -> None:
    missing = [key for key in SCOPE_KEYS if key not in scope]
    if missing:
        error("frontmatter", f"missing scope keys: {', '.join(missing)}")
    if scope.get("delivery_mode") not in DELIVERY_MODES:
        error("delivery_mode", f"must be one of {', '.join(DELIVERY_MODES)}")
    if scope.get("size") not in SIZES:
        error("size", f"must be one of {', '.join(SIZES)}")
    if not isinstance(scope.get("technical"), bool):
        error("technical", "must be true or false")
    outcomes = scope.get("outcomes")
    if not (isinstance(outcomes, dict) and outcomes and all(re.fullmatch(r"O\d+", k) for k in outcomes)):
        error("outcomes", 'must be a non-empty map like {"O1": "..."}')
    packages = scope.get("packages")
    if not isinstance(packages, list):
        error("packages", "must be a list")
    elif scope.get("technical"):
        for package in packages:
            if "==" not in str(package):
                error("packages", f"package {package!r} is not pinned with '=='")


def _check_overview(path: Path, scope: dict, titles: list[str], issues: list[Issue]) -> None:
    def error(where: str, message: str) -> None:
        issues.append(Issue("error", OVERVIEW_FILE, where, message))

    if not path.exists():
        error("file", "missing")
        return
    try:
        data, body = frontmatter.parse(path.read_text(encoding="utf-8"))
    except frontmatter.FrontmatterError as problem:
        error("frontmatter", str(problem))
        return
    missing = [key for key in OVERVIEW_FRONTMATTER_KEYS if key not in data]
    if missing:
        error("frontmatter", f"missing keys: {', '.join(missing)}")
    if data.get("template") != OVERVIEW_TEMPLATE_ID:
        error("frontmatter", f"template must be {OVERVIEW_TEMPLATE_ID!r}")
    if data.get("course") != scope.get("course"):
        error("frontmatter", f"course is {data.get('course')!r} but scope says {scope.get('course')!r}")
    doc = scan(body)
    sections = [h for h in doc.headings if h.level == 2]
    names = [h.text for h in sections]
    allowed = [list(OVERVIEW_SECTIONS)]
    if not scope.get("technical"):
        allowed.append([s for s in OVERVIEW_SECTIONS if s not in TECHNICAL_ONLY_OVERVIEW_SECTIONS])
    if names not in allowed:
        error("sections", f"H2 sections must be, in order: {', '.join(OVERVIEW_SECTIONS)}")
    by_name = {h.text: h for h in sections}

    def section_text(name: str) -> str:
        heading = by_name.get(name)
        return doc.text(heading.line, doc.next_heading(heading.line, max_level=2)) if heading else ""

    outcomes_text = section_text("Learning outcomes")
    for outcome in scope.get("outcomes") or {}:
        if not re.search(rf"\b{re.escape(outcome)}\b", outcomes_text):
            error("section Learning outcomes", f"outcome {outcome} is not listed")
    map_text = section_text("Part map")
    for title in titles:
        if title and title not in map_text:
            error("section Part map", f"missing part title {title!r}")


def validate_course(course_dir: Path) -> list[Issue]:
    course_dir = Path(course_dir)
    issues: list[Issue] = []
    scope_path = course_dir / SCOPE_FILE
    if not scope_path.exists():
        return [Issue("error", SCOPE_FILE, "file", "missing")]
    try:
        scope, _ = frontmatter.parse(scope_path.read_text(encoding="utf-8"))
    except frontmatter.FrontmatterError as problem:
        return [Issue("error", SCOPE_FILE, "frontmatter", str(problem))]
    _check_scope(scope, lambda where, message: issues.append(Issue("error", SCOPE_FILE, where, message)))

    part_paths = []
    for path in sorted(course_dir.glob("*.md")):
        if path.name == OVERVIEW_FILE:
            continue
        if not PART_FILE_RE.match(path.name):
            issues.append(Issue("error", path.name, "filename", "top-level files must be 00-overview.md or part-NN-<slug>.md"))
            continue
        part_paths.append(path)
    numbers = [int(PART_FILE_RE.match(p.name).group(1)) for p in part_paths]
    for expected, (number, path) in enumerate(zip(numbers, part_paths), start=1):
        if number != expected:
            issues.append(Issue("error", path.name, "filename", f"parts must be numbered 01..n without gaps; expected {expected:02d}"))

    infos: list[tuple[str, PartInfo]] = []
    for path in part_paths:
        part_issues, info = _analyze_part(path, scope)
        issues.extend(part_issues)
        infos.append((path.name, info))

    known = set(scope.get("outcomes") or {})
    covered: set = set()
    existing = {info.number for _, info in infos}
    owners: dict[str, list[str]] = {}
    for name, info in infos:
        if not info.outcomes:
            issues.append(Issue("error", name, "outcomes", "a part must serve at least one outcome"))
        for outcome in info.outcomes:
            if outcome not in known:
                issues.append(Issue("error", name, "outcomes", f"unknown outcome {outcome}"))
        covered.update(info.outcomes)
        for prerequisite in info.prerequisites:
            if not isinstance(prerequisite, int) or info.number is None or prerequisite >= info.number or prerequisite not in existing:
                issues.append(Issue("error", name, "prerequisite_parts", f"prerequisite {prerequisite!r} must be an earlier existing part"))
        for snippet_id in info.snippet_ids:
            owners.setdefault(snippet_id, []).append(name)
    for outcome in sorted(known - covered):
        issues.append(Issue("error", SCOPE_FILE, "outcomes", f"outcome {outcome} is not covered by any part"))
    for snippet_id, files in owners.items():
        if len(files) > 1:
            issues.append(Issue("error", files[0], f"snippet {snippet_id}", f"duplicate snippet id (also in {', '.join(files[1:])})"))

    _check_overview(course_dir / OVERVIEW_FILE, scope, [info.title for _, info in infos], issues)
    return issues


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Validate a course-research output folder.")
    parser.add_argument("course_dir", type=Path)
    parser.add_argument("--json", action="store_true", help="print issues as JSON")
    args = parser.parse_args(argv)
    issues = validate_course(args.course_dir)
    if args.json:
        print(json.dumps([asdict(issue) for issue in issues], ensure_ascii=False, indent=2))
    else:
        for issue in issues:
            print(f"{issue.level.upper()} {issue.file}:{issue.where}: {issue.message}")
        if not issues:
            print("OK: no issues")
    return 1 if any(issue.level == "error" for issue in issues) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
