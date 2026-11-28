#!/usr/bin/env python3
"""Bring one worker's chapter into the playground, on both branches, only when it passes.

    apply_unit.py <course_dir> <NN> [--check] [--save-output DIR]
    apply_unit.py <course_dir> finish [--check]

A worker writes the chapter's files as they should be on each branch into <course_dir>/units/<NN>/main/ and
<course_dir>/units/<NN>/solutions/, with paths relative to the playground root. This script copies each into a
temporary worktree of its branch (the chapter's folder is replaced, not merged), checks the chapter's shape and runs
its commands there. Only when both branches pass does it commit "feat: chapter <NN> <slug>" on each branch that
changed and set the chapter's status in course.md to `review`. If either branch fails, nothing is committed.
With --check it does every check and commits nothing: the done-command a worker runs on its own chapter.
With --save-output DIR it writes the chapter's run on each branch to DIR/<NN>-<branch>.txt, as check_playground.py
does, so a worker sees its chapter's real output before the chapter is applied.
A unit that changes a file outside its chapter's folder (a shared module, another chapter's file, the README) can
break other chapters: then every built chapter and `Run all` are run on both branches too, and the paths are named.
`finish` applies <course_dir>/units/finish/ (the README and the cheatsheet at the end), checks every built chapter,
commits "docs: finish the course" and changes no status.

The user's own checkout is never switched. If it is on one of the two branches, it is moved forward like a
fast-forward pull; a unit that changes a file the user has uncommitted edits in is refused before anything moves.
It never pushes.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from contextlib import ExitStack
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import course_md  # noqa: E402
from check_playground import BRANCHES, NOTES, _git, check_branch_tree, worktree  # noqa: E402
from course_md import CourseError  # noqa: E402


class ApplyError(Exception):
    pass


def _out(repo: Path, *args: str) -> str:
    result = _git(repo, *args)
    if result.returncode != 0:
        raise ApplyError(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout.strip()


def _copy_unit(unit: Path, tree: Path, chapter_folder: str | None) -> None:
    if chapter_folder and (unit / chapter_folder).is_dir() and (tree / chapter_folder).exists():
        shutil.rmtree(tree / chapter_folder)
    shutil.copytree(unit, tree, dirs_exist_ok=True)


def _dirty_paths(repo: Path) -> set[str]:
    paths = set()
    # Not _out(): stripping the output would cut the first status column of the first line.
    for line in _git(repo, "status", "--porcelain", "--untracked-files=all").stdout.splitlines():
        path = line[3:]
        paths.update(part.strip('"') for part in path.split(" -> "))
    return paths


def outside_paths(tree: Path, folder: str) -> set[str]:
    """The paths a staged unit changes outside its chapter's folder."""
    return {path for path in _out(tree, "diff", "--cached", "--name-only").splitlines() if path and not path.startswith(folder + "/")}


def apply(course_dir: Path, nn: str, commit: bool = True, save_output: Path | None = None, notes: list[str] | None = None) -> str:
    """"committed", "unchanged", or with commit=False "passed"; raises ApplyError when a branch fails. A line for the
    user, such as which shared paths the unit changed, is appended to `notes`."""
    course_dir = Path(course_dir)
    finish = nn == "finish"
    try:
        course = course_md.read(course_dir)
        course_md.require_commands(course)
        chapter = None if finish else course.chapter(nn)
    except CourseError as error:
        raise ApplyError(str(error)) from error
    repo = course_dir / "playground"
    units = {branch: course_dir / "units" / nn / branch for branch in BRANCHES}
    for branch, unit in units.items():
        if not unit.is_dir():
            raise ApplyError(f"units/{nn}/{branch} does not exist: the worker writes the chapter's files there")

    folder = None if chapter is None else course_md.chapter_folder(course, chapter)
    message = "docs: finish the course" if chapter is None else f"feat: chapter {nn} {chapter.slug}"
    current = _git(repo, "symbolic-ref", "-q", "--short", "HEAD").stdout.strip()

    with ExitStack() as stack:
        trees = {branch: stack.enter_context(worktree(repo, branch)) for branch in BRANCHES}
        changed, shared = [], set()
        for branch in BRANCHES:
            _copy_unit(units[branch], trees[branch], folder)
            _out(trees[branch], "add", "-A")
            if _out(trees[branch], "status", "--porcelain"):
                changed.append(branch)
            if folder is not None:
                shared |= outside_paths(trees[branch], folder)
        if not changed and commit:
            return "unchanged"
        if shared and notes is not None:
            notes.append(f"note: this unit changes files outside its chapter folder ({', '.join(sorted(shared))}), so every built chapter and Run all were run too")

        found = []
        for branch in BRANCHES:
            found.extend(f for f in check_branch_tree(trees[branch], course, branch, None if finish else nn, True, save_output, others=bool(shared)) if f.kind not in NOTES)
        if found:
            raise ApplyError("nothing was committed:\n" + "\n".join(f.line() for f in found))
        if not commit:
            return "passed"

        commits = {}
        for branch in changed:
            old = _out(repo, "rev-parse", f"refs/heads/{branch}")
            _out(trees[branch], "commit", "-q", "-m", message)
            commits[branch] = (old, _out(trees[branch], "rev-parse", "HEAD"))

        if current in commits:
            old, new = commits[current]
            touched = set(_out(repo, "diff", "--name-only", old, new).splitlines())
            clash = sorted(touched & _dirty_paths(repo))
            if clash:
                raise ApplyError(f"nothing was committed: the playground's checkout of {current} has uncommitted changes in files this chapter changes: {', '.join(clash)}")

        for branch, (old, new) in commits.items():
            if branch == current:
                _out(repo, "merge", "--ff-only", "-q", new)
            else:
                _out(repo, "update-ref", f"refs/heads/{branch}", new, old)

    if not finish:
        course_md.set_status(course_dir, nn, "review")
    return "committed"


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Bring one worker's chapter into the playground, on both branches, only when it passes.")
    parser.add_argument("course_dir", type=Path)
    parser.add_argument("nn", help="the chapter, such as 03, or finish")
    parser.add_argument("--check", action="store_true", help="do every check and commit nothing")
    parser.add_argument("--save-output", type=Path, help="write the chapter's run on each branch to DIR/<NN>-<branch>.txt")
    args = parser.parse_args(argv)
    notes: list[str] = []
    try:
        result = apply(args.course_dir, args.nn, commit=not args.check, save_output=args.save_output, notes=notes)
    except (ApplyError, CourseError) as error:
        for note in notes:
            print(note)
        print(f"error: {error}", file=sys.stderr)
        return 1
    for note in notes:
        print(note)
    print(f"chapter {args.nn}: {result}")
    if result == "committed":
        repo = args.course_dir / "playground"
        for branch in ("main", "solutions"):
            print(f"{branch} {_out(repo, 'log', '-1', '--format=%h %s', branch)}")
    if _dirty_paths(args.course_dir / "playground"):
        print("note: the playground has uncommitted changes; they were not checked (only committed branches are)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
