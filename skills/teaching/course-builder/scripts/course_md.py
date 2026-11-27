#!/usr/bin/env python3
"""Read and update a course's `course.md`: the playground's commands and the outline of chapters.

    course_md.py <course_dir>                       print the outline as JSON
    course_md.py <course_dir> --set NN STATUS       change one chapter's status

`course.md` is the one place a chapter's order and scope are decided; course-builder writes it, and its scripts and
part-slides read it. The format is in references/outline.md.
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

STATUSES = ("outline", "pilot", "building", "review", "done")
BUILT = ("pilot", "building", "review", "done")
COMMAND_KEYS = {"Install": "install", "Setup check": "setup", "Run chapter": "chapter"}
OPTIONAL_KEYS = {"Run all": "all"}
COLUMNS = ("NN", "slug", "title", "practises", "builds on", "under test", "status")
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
NN_RE = re.compile(r"^\d{2,3}$")


class CourseError(Exception):
    pass


@dataclass(frozen=True)
class Chapter:
    nn: str
    slug: str
    title: str
    practises: str
    builds_on: str
    under_test: str
    status: str

    @property
    def folder_name(self) -> str:
        return f"{self.nn}-{self.slug}"


@dataclass(frozen=True)
class Course:
    chapters_dir: str
    commands: dict[str, str]
    chapters: list[Chapter]

    def chapter(self, nn: str) -> Chapter:
        for chapter in self.chapters:
            if chapter.nn == nn:
                return chapter
        raise CourseError(f"course.md has no chapter {nn}")


def _section(lines: list[str], heading: str) -> list[str]:
    """The lines under `## heading`, up to the next `## `."""
    out: list[str] = []
    inside = False
    for line in lines:
        if line.startswith("## "):
            inside = line[3:].strip().lower() == heading.lower()
            continue
        if inside:
            out.append(line)
    return out


def _cells(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def parse(text: str) -> Course:
    lines = text.replace("\r\n", "\n").split("\n")
    settings: dict[str, str] = {}
    for line in _section(lines, "Playground"):
        key, sep, value = line.partition(":")
        if sep and key.strip():
            settings[key.strip()] = value.strip()
    chapters_dir = settings.get("Chapters folder", "")
    if not chapters_dir:
        raise CourseError("course.md, ## Playground: 'Chapters folder:' is missing")
    commands = {}
    for key, name in COMMAND_KEYS.items():
        if not settings.get(key):
            raise CourseError(f"course.md, ## Playground: '{key}:' is missing")
        commands[name] = settings[key]
    for key, name in OPTIONAL_KEYS.items():
        if settings.get(key):
            commands[name] = settings[key]

    table = [line for line in _section(lines, "Outline") if line.strip().startswith("|")]
    if len(table) < 2 or tuple(c.lower() for c in _cells(table[0])) != tuple(c.lower() for c in COLUMNS):
        raise CourseError(f"course.md, ## Outline: the table must have the columns {' | '.join(COLUMNS)}")
    chapters = []
    for line in table[2:]:
        cells = _cells(line)
        if len(cells) != len(COLUMNS):
            raise CourseError(f"course.md, ## Outline: a row has {len(cells)} cells, not {len(COLUMNS)}: {line.strip()}")
        chapter = Chapter(*cells)
        if not NN_RE.match(chapter.nn):
            raise CourseError(f"course.md, ## Outline: '{chapter.nn}' is not a chapter number such as 01")
        if not SLUG_RE.match(chapter.slug):
            raise CourseError(f"course.md, chapter {chapter.nn}: slug '{chapter.slug}' must be lowercase letters, digits and hyphens")
        if chapter.status not in STATUSES:
            raise CourseError(f"course.md, chapter {chapter.nn}: status '{chapter.status}' is not one of {', '.join(STATUSES)}")
        chapters.append(chapter)
    return Course(chapters_dir=chapters_dir, commands=commands, chapters=chapters)


def read(course_dir: Path) -> Course:
    path = Path(course_dir) / "course.md"
    if not path.is_file():
        raise CourseError(f"{path} does not exist")
    return parse(path.read_text(encoding="utf-8"))


def set_status(course_dir: Path, nn: str, status: str) -> None:
    """Rewrite only the status cell of chapter `nn`."""
    if status not in STATUSES:
        raise CourseError(f"status '{status}' is not one of {', '.join(STATUSES)}")
    path = Path(course_dir) / "course.md"
    course = parse(path.read_text(encoding="utf-8"))
    course.chapter(nn)
    raw = path.read_bytes().decode("utf-8")
    out = []
    for line in raw.splitlines(keepends=True):
        body = line.rstrip("\r\n")
        cells = _cells(body) if body.strip().startswith("|") else []
        if len(cells) == len(COLUMNS) and cells[0] == nn:
            cut = body.rstrip().rstrip("|").rstrip()
            start = cut.rfind("|")
            body = f"{cut[:start]}| {status} |"
        out.append(body + line[len(line.rstrip("\r\n")):])
    path.write_text("".join(out), encoding="utf-8", newline="")


def chapter_folder(course: Course, chapter: Chapter) -> str:
    return f"{course.chapters_dir}/{chapter.folder_name}"


def chapter_command(course: Course, chapter: Chapter) -> str:
    # str.replace, not str.format: a shell variable such as ${PLAYGROUND_PORT} must pass through untouched.
    command = course.commands["chapter"]
    for key, value in (("{folder}", chapter_folder(course, chapter)), ("{nn}", chapter.nn), ("{slug}", chapter.slug)):
        command = command.replace(key, value)
    return command


def main(argv: list[str]) -> int:
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0 if argv else 2
    try:
        if len(argv) == 4 and argv[1] == "--set":
            set_status(Path(argv[0]), argv[2], argv[3])
            print(f"chapter {argv[2]}: {argv[3]}")
            return 0
        course = read(Path(argv[0]))
    except CourseError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(json.dumps({"chapters_dir": course.chapters_dir, "commands": course.commands, "chapters": [asdict(c) for c in course.chapters]}, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
