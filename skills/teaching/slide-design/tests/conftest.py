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
