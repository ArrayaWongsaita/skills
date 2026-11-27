import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL_DIR / "scripts"))

import shutil
import subprocess

import pytest

COURSE_MD = """# A made-up course

Learner: new to testing
Goal: writes a first test

## Playground

Chapters folder: lessons
Install: true
Setup check: python3 check_setup.py
Run chapter: python3 run_chapter.py {folder}

## Outline

| NN | slug | title | practises | builds on | under test | status |
|---|---|---|---|---|---|---|
| 01 | first | First | one thing | – | thing.ts | pilot |
| 02 | second | Second | another | 01 | other.ts | outline |
"""

RUN_CHAPTER = """import pathlib, sys
folder = pathlib.Path(sys.argv[1])
bad = [p for p in folder.rglob('*') if p.is_file() and 'FAIL' in p.read_text(encoding='utf-8')]
print('ran', folder, 'failing:', [p.name for p in bad])
sys.exit(1 if bad else 0)
"""

EXERCISE = """// บทที่ {nn}
// ข้อ 1: แรก
// แนวทาง: ลอง
test.todo("one");
// 👉 เขียนตรงนี้
"""
SOLVED = """// บทที่ {nn}
// ข้อ 1: แรก
// แนวทาง: ลอง
test("one", () => {{}});
"""


def git(repo: Path, *args: str) -> str:
    result = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True)
    return result.stdout.strip()


def write_chapter(root: Path, folder: str, text: str) -> None:
    (root / "lessons" / folder).mkdir(parents=True, exist_ok=True)
    (root / "lessons" / folder / "thing.test.ts").write_text(text, encoding="utf-8")


@pytest.fixture
def git_playground(tmp_path):
    """<course_dir> with course.md and a playground repo: chapter 01 on main (pending) and on solutions (written)."""
    course_dir = tmp_path / "course"
    repo = course_dir / "playground"
    repo.mkdir(parents=True)
    (course_dir / "course.md").write_text(COURSE_MD, encoding="utf-8")
    (repo / "run_chapter.py").write_text(RUN_CHAPTER, encoding="utf-8")
    (repo / "check_setup.py").write_text("print('setup ok')\n", encoding="utf-8")
    (repo / "README.md").write_text("| 01 | `01-first` |\n| 02 | `02-second` |\n", encoding="utf-8")
    write_chapter(repo, "01-first", EXERCISE.format(nn="01"))
    git(repo, "init", "-q", "-b", "main")
    git(repo, "config", "user.email", "test@example.com")
    git(repo, "config", "user.name", "Test")
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", "main")
    git(repo, "checkout", "-q", "-b", "solutions")
    write_chapter(repo, "01-first", SOLVED.format(nn="01"))
    git(repo, "commit", "-qam", "solution")
    git(repo, "checkout", "-q", "main")
    return course_dir
