#!/usr/bin/env python3
"""Check a course's playground repo against the exercise convention, whatever its stack.

    check_playground.py <course_dir> [--chapter NN] [--no-run] [--save-output DIR]

It checks each built chapter (status pilot, building, review or done in course.md), or only --chapter:
- the tree of each branch: a folder per chapter, an exercise file with as many `แนวทาง:` hints and `👉` lines as it
  has numbered exercises on `main`, no `👉` left on `solutions`, and a README that names every chapter;
- unless --no-run, the commands recorded in course.md: install, the setup check on `main`, and the chapter's run on
  both branches. Each branch is checked out in a temporary worktree, so the user's checkout is never switched.

It prints one line per finding and exits 1 if there is any (an `uncommitted` note alone does not fail), else prints
`ok`. With --save-output, each chapter run's output is written to DIR/<NN>-<branch>.txt for the slides.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import tempfile
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

sys.path.insert(0, str(Path(__file__).resolve().parent))

import course_md  # noqa: E402
from course_md import BUILT, Course, CourseError  # noqa: E402

EXERCISE_RE = re.compile(r"ข้อ\s*(\d+)\s*:")
HINT = "แนวทาง:"
MARKER = "👉"
BRANCHES = ("main", "solutions")
NOTES = {"uncommitted"}
TAIL_LINES = 20


@dataclass(frozen=True)
class Finding:
    kind: str
    chapter: str | None
    branch: str | None
    detail: str

    def line(self) -> str:
        return f"{self.kind} {self.chapter or '-'} {self.branch or '-'}: {self.detail}"


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace").replace("\r\n", "\n")


def exercise_shape(text: str) -> tuple[int, int, int]:
    """(numbered exercises, hints, markers) in an exercise file."""
    text = text.replace("\r\n", "\n")
    return len(set(EXERCISE_RE.findall(text))), text.count(HINT), text.count(MARKER)


def exercise_file(folder: Path) -> Path | None:
    """The file of a chapter that holds its numbered exercises."""
    for path in sorted(p for p in folder.rglob("*") if p.is_file()):
        if EXERCISE_RE.search(_text(path)):
            return path
    return None


def _checked(course: Course, only: str | None) -> list[course_md.Chapter]:
    if only is not None:
        return [course.chapter(only)]
    return [chapter for chapter in course.chapters if chapter.status in BUILT]


def check_tree(root: Path, course: Course, branch: str, only: str | None = None) -> list[Finding]:
    found: list[Finding] = []
    chapters = _checked(course, only)
    for chapter in chapters:
        folder = root / course.chapters_dir / chapter.folder_name
        if not folder.is_dir():
            found.append(Finding("missing-folder", chapter.nn, branch, f"{course.chapters_dir}/{chapter.folder_name} does not exist"))
            continue
        exercise = exercise_file(folder)
        if exercise is None:
            found.append(Finding("no-exercise", chapter.nn, branch, f"no file in {course.chapters_dir}/{chapter.folder_name} has numbered exercises (ข้อ 1: …)"))
            continue
        exercises, hints, markers = exercise_shape(_text(exercise))
        name = exercise.relative_to(root).as_posix()
        if branch == "main" and not (exercises >= 1 and hints == exercises and markers == exercises):
            found.append(Finding("exercise-shape", chapter.nn, branch, f"{name}: {exercises} exercises, {hints} hints, {markers} markers; each exercise needs one {HINT} and one {MARKER}"))
        if branch == "solutions" and markers:
            found.append(Finding("leftover-marker", chapter.nn, branch, f"{name} still has {markers} {MARKER} line(s): the solution is not written there"))
    readme = root / "README.md"
    text = _text(readme) if readme.is_file() else ""
    missing = [chapter.folder_name for chapter in chapters if chapter.folder_name not in text]
    if missing:
        found.append(Finding("readme", None, branch, f"README.md does not name {', '.join(missing)}"))
    return found


def _git(repo: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True)


@contextmanager
def worktree(repo: Path, branch: str) -> Iterator[Path]:
    """A temporary checkout of `branch`, removed afterwards: the user's own checkout is never switched."""
    holder = Path(tempfile.mkdtemp(prefix="playground-"))
    path = holder / branch
    result = _git(repo, "worktree", "add", "--detach", str(path), branch)
    if result.returncode != 0:
        raise CourseError(f"cannot check out {branch}: {result.stderr.strip()}")
    try:
        yield path
    finally:
        _git(repo, "worktree", "remove", "--force", str(path))
        _git(repo, "worktree", "prune")
        subprocess.run(["rm", "-rf", str(holder)])


def run(cmd: str, cwd: Path, timeout: int = 900) -> tuple[int, str]:
    try:
        result = subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return 124, f"timed out after {timeout} s: {cmd}"
    return result.returncode, (result.stdout or "") + (result.stderr or "")


def _tail(output: str) -> str:
    return "\n".join(output.rstrip().splitlines()[-TAIL_LINES:])


def run_chapter(tree: Path, course: Course, chapter: course_md.Chapter, branch: str, save_output: Path | None = None) -> list[Finding]:
    code, output = run(course_md.chapter_command(course, chapter), tree)
    if save_output is not None:
        save_output.mkdir(parents=True, exist_ok=True)
        (save_output / f"{chapter.nn}-{branch}.txt").write_text(output, encoding="utf-8")
    if code != 0:
        return [Finding("run-failed", chapter.nn, branch, f"`{course_md.chapter_command(course, chapter)}` exited {code}:\n{_tail(output)}")]
    return []


def check_branch_tree(tree: Path, course: Course, branch: str, chapter: str | None, run_commands: bool, save_output: Path | None) -> list[Finding]:
    """Everything check() does for one branch, on a tree that is already checked out."""
    found = check_tree(tree, course, branch, only=chapter)
    if not run_commands:
        return found
    code, output = run(course.commands["install"], tree)
    if code != 0:
        return found + [Finding("run-failed", None, branch, f"`{course.commands['install']}` exited {code}:\n{_tail(output)}")]
    if branch == "main":
        code, output = run(course.commands["setup"], tree)
        if code != 0:
            found.append(Finding("run-failed", None, branch, f"`{course.commands['setup']}` exited {code}:\n{_tail(output)}"))
    for each in _checked(course, chapter):
        if (tree / course.chapters_dir / each.folder_name).is_dir():
            found.extend(run_chapter(tree, course, each, branch, save_output))
    return found


def check(course_dir: Path, chapter: str | None = None, run_commands: bool = True, save_output: Path | None = None) -> list[Finding]:
    course = course_md.read(course_dir)
    repo = Path(course_dir) / "playground"
    if not (repo / ".git").exists():
        raise CourseError(f"{repo} is not a git repository: run init_playground.py first")
    found: list[Finding] = []
    if _git(repo, "rev-parse", "--verify", "--quiet", "refs/heads/solutions").returncode != 0:
        return [Finding("no-solutions-branch", None, None, "the playground has no `solutions` branch")]
    for branch in BRANCHES:
        with worktree(repo, branch) as tree:
            found.extend(check_branch_tree(tree, course, branch, chapter, run_commands, save_output))
    if _git(repo, "status", "--porcelain").stdout.strip():
        found.append(Finding("uncommitted", None, None, "the playground has uncommitted changes; they were not checked (only committed branches are)"))
    return found


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Check a course's playground repo against the exercise convention.")
    parser.add_argument("course_dir", type=Path)
    parser.add_argument("--chapter", help="check only this chapter, such as 03")
    parser.add_argument("--no-run", action="store_true", help="check the structure only, run no command")
    parser.add_argument("--save-output", type=Path, help="write each chapter run's output to DIR/<NN>-<branch>.txt")
    args = parser.parse_args(argv)
    try:
        found = check(args.course_dir, args.chapter, not args.no_run, args.save_output)
    except CourseError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    for finding in found:
        print(finding.line())
    if not found:
        print("ok")
    return 1 if any(f.kind not in NOTES for f in found) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
