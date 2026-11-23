import shutil
import sys
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parents[1]
SCRIPTS = SKILL_DIR / "scripts"
FIXTURE = Path(__file__).resolve().parent / "fixtures" / "courses" / "langchain-agents"
SLIDE_DESIGN_SCRIPTS = SKILL_DIR.parent / "slide-design" / "scripts"
TEMPLATE = SKILL_DIR / "template"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))


@pytest.fixture
def course(tmp_path) -> Path:
    """A copy of the fixture course at tmp_path/courses/langchain-agents."""
    target = tmp_path / "courses" / "langchain-agents"
    shutil.copytree(FIXTURE, target)
    return target


def replace(path: Path, old: str, new: str, count: int = 1) -> None:
    """Replace `old` in the file; with count=1 it must occur exactly once."""
    text = path.read_text(encoding="utf-8")
    found = text.count(old)
    assert found == count if count == 1 else found >= 1, f"{old!r} occurs {found} times in {path.name}"
    path.write_text(text.replace(old, new, count), encoding="utf-8")
