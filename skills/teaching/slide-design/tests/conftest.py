import shutil
import sys
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parents[1]
FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
SCRIPTS = str(SKILL_DIR / "scripts")
if SCRIPTS not in sys.path:
    sys.path.insert(0, SCRIPTS)


@pytest.fixture
def skill_dir() -> Path:
    return SKILL_DIR


@pytest.fixture
def fixtures_dir() -> Path:
    return FIXTURES_DIR


@pytest.fixture
def course(tmp_path) -> Path:
    target = tmp_path / "course"
    shutil.copytree(FIXTURES_DIR / "course", target)
    return target


def edit(path: Path, old: str, new: str, first: bool = False) -> None:
    """Replace `old` in the file: exactly one occurrence, or only the first one when `first`."""
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if first:
        assert count >= 1, f"{old!r} not found in {path.name}"
    else:
        assert count == 1, f"{old!r} occurs {count} times in {path.name}"
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def drop_slide(text: str, slide_id: str) -> str:
    """Remove one slide (its ### heading up to the next ### or ## heading) from deck or draft text."""
    lines = text.split("\n")
    start = next(i for i, line in enumerate(lines) if line.startswith(f"### {slide_id} · "))
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith(("### ", "## "))), len(lines))
    return "\n".join(lines[:start] + lines[end:])


@pytest.fixture
def assembled(course) -> Path:
    from assemble_deck import assemble

    return assemble(course, 1, today="2026-11-30")


def _find_slide(path: Path, slide_id: str):
    from deck import parse_deck

    return next(s for s in parse_deck(path.read_text(encoding="utf-8")).slides() if s.id == slide_id)


def _replace_lines(path: Path, first: int, last: int, new: list[str]) -> None:
    """Replace 1-based lines first..last (inclusive) of the file."""
    lines = path.read_text(encoding="utf-8").split("\n")
    lines[first - 1:last] = new
    path.write_text("\n".join(lines), encoding="utf-8")


def set_field(path: Path, slide_id: str, field: str, value: str) -> None:
    current = _find_slide(path, slide_id).fields[field]
    assert "\n" not in current.text, "set_field handles one-line fields only"
    _replace_lines(path, current.line, current.line, [f"**{field}:** {value}"])


def add_field(path: Path, slide_id: str, field: str, value: str) -> None:
    title = _find_slide(path, slide_id).fields["Title"]
    _replace_lines(path, title.line, title.line - 1, [f"**{field}:** {value}", ""])


def set_meta(path: Path, slide_id: str, key: str, value) -> None:
    from deck import meta_block

    slide = _find_slide(path, slide_id)
    first, last = slide.meta_lines
    _replace_lines(path, first, last, meta_block({**slide.meta, key: value}).split("\n"))


def set_visual(path: Path, slide_id: str, visual: dict) -> None:
    import json

    slide = _find_slide(path, slide_id)
    old = json.dumps(slide.visual, ensure_ascii=False)
    lines = path.read_text(encoding="utf-8").split("\n")
    index = next(i for i in range(slide.line, len(lines)) if lines[i] == old)
    _replace_lines(path, index + 1, index + 1, [json.dumps(visual, ensure_ascii=False)])
