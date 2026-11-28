#!/usr/bin/env python3
"""Make the playground skeleton the agent wrote into a git repository with `main` and `solutions`.

    init_playground.py <course_dir>

<course_dir>/playground must hold the skeleton (package files, the test tool's config, the setup check, the README,
the cheatsheet, a .gitignore) and must not be a git repository yet. It runs the install and setup-check commands
from course.md first; only when they pass does it run `git init -b main`, commit everything as
"chore: playground skeleton" and create `solutions` at the same commit. It never pushes.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import course_md  # noqa: E402
from check_playground import _git, _tail, run  # noqa: E402
from course_md import CourseError  # noqa: E402

# The lockfile an install writes is part of the skeleton: it is committed, never ignored.
LOCKFILES = {"pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lock", "bun.lockb", "uv.lock", "poetry.lock", "Pipfile.lock", "Cargo.lock", "go.sum", "Gemfile.lock", "composer.lock"}
# Folders an install or a test run makes; they must be git-ignored before the first commit.
MADE_BY_TOOLS = {"node_modules", ".venv", "venv", "__pycache__", ".pytest_cache", "target", "dist", "build", "coverage", "test-results", "playwright-report", ".pnpm-store"}


def init(course_dir: Path) -> None:
    course = course_md.read(course_dir)
    course_md.require_commands(course)
    repo = Path(course_dir) / "playground"
    if not repo.is_dir():
        raise CourseError(f"{repo} does not exist: write the playground skeleton first")
    if (repo / ".git").exists():
        raise CourseError(f"{repo} is already a git repository")
    before = {p.name for p in repo.iterdir()}
    for name in ("install", "setup"):
        code, output = run(course.commands[name], repo)
        if code != 0:
            raise CourseError(f"`{course.commands[name]}` exited {code}; nothing was committed:\n{_tail(output)}")
    made = sorted(p.name for p in repo.iterdir() if (p.name not in before or p.name in MADE_BY_TOOLS) and p.name not in LOCKFILES)
    result = _git(repo, "init", "-q", "-b", "main")
    if result.returncode != 0:
        raise CourseError(f"git init failed: {result.stderr.strip()}")
    unignored = [name for name in made if _git(repo, "check-ignore", "-q", name).returncode != 0]
    if unignored:
        shutil.rmtree(repo / ".git")
        raise CourseError(f"the install or the setup check made {', '.join(unignored)}, which .gitignore does not leave out; add it there, nothing was committed")
    for args in (("add", "-A"), ("commit", "-q", "-m", "chore: playground skeleton"), ("branch", "solutions")):
        result = _git(repo, *args)
        if result.returncode != 0:
            raise CourseError(f"git {' '.join(args)} failed: {result.stderr.strip()}")


def main(argv: list[str]) -> int:
    if len(argv) != 1 or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0 if argv[:1] in (["-h"], ["--help"]) else 2
    try:
        init(Path(argv[0]))
    except CourseError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print("playground ready: main and solutions")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
