#!/usr/bin/env python3
"""Report a problem with one of this repo's skills as an issue in the private skills-issues repo.

Subcommands: info, draft, similar, post. SKILL.md has the procedure.
"""
from __future__ import annotations

import argparse
import dataclasses
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import frontmatter

SOURCE_REPO = "ArrayaWongsaita/skills"
ISSUES_REPO = "ArrayaWongsaita/skills-issues"
UNKNOWN = "unknown"

_ORIGIN = re.compile(r"(?:https://(?:[^@/]+@)?github\.com/|git@github\.com:|ssh://git@github\.com/)"
                     r"([^/]+)/([^/]+?)(?:\.git)?/?", re.I)


class IssueError(Exception):
    """A problem the user can act on. The CLI prints it as `error: <message>` and exits 1."""


@dataclass(frozen=True)
class SkillInfo:
    name: str
    path: str
    commit: str
    dirty: bool | None
    branch: str
    on_main: bool | None
    source: str  # "git" or "copy"


def origin_matches(url: str) -> bool:
    """True when the remote URL is this repo on GitHub, in its HTTPS or SSH form."""
    match = _ORIGIN.fullmatch(url.strip())
    return bool(match) and f"{match[1]}/{match[2]}".lower() == SOURCE_REPO.lower()


def _git(directory: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", "-C", str(directory), *args], capture_output=True, text=True)


def _skill_name(skill_md: Path, fallback: str) -> str:
    try:
        data, _ = frontmatter.parse(skill_md.read_text(encoding="utf-8"))
    except frontmatter.FrontmatterError:
        return fallback
    name = data.get("name")
    return name if isinstance(name, str) and name else fallback


def skill_info(skill_dir: Path, allow_copy: bool = False) -> SkillInfo:
    """Which skill this is and which commit of this repo it runs from. Symlinks are followed."""
    directory = Path(skill_dir).resolve()
    skill_md = directory / "SKILL.md"
    if not skill_md.is_file():
        raise IssueError(f"no SKILL.md in {skill_dir}")
    name = _skill_name(skill_md, directory.name)
    copy = SkillInfo(name, UNKNOWN, UNKNOWN, None, UNKNOWN, None, "copy")
    top = _git(directory, "rev-parse", "--show-toplevel")
    if top.returncode != 0:
        if allow_copy:
            return copy
        raise IssueError(f"{skill_dir} is not a git checkout; if the user confirms it is a copy of a skill "
                         f"from {SOURCE_REPO}, pass --allow-copy")
    origin = _git(directory, "remote", "get-url", "origin")
    url = origin.stdout.strip() if origin.returncode == 0 else ""
    if not origin_matches(url):
        # A copy can sit inside the user's own git project (a project's .claude/skills/, say).
        if allow_copy:
            return copy
        raise IssueError(f"{skill_dir} comes from {url or 'a repo with no origin'}, not {SOURCE_REPO}; "
                         "only this repo's skills can be reported")
    root = Path(top.stdout.strip()).resolve()
    branch = _git(directory, "rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
    on_main = None
    if _git(directory, "rev-parse", "--verify", "--quiet", "refs/remotes/origin/main").returncode == 0:
        on_main = _git(directory, "merge-base", "--is-ancestor", "HEAD", "refs/remotes/origin/main").returncode == 0
    return SkillInfo(
        name=name,
        path=directory.relative_to(root).as_posix(),
        commit=_git(directory, "rev-parse", "HEAD").stdout.strip(),
        dirty=bool(_git(directory, "status", "--porcelain", "--", ".").stdout.strip()),
        branch="detached" if branch == "HEAD" else branch,
        on_main=on_main,
        source="git",
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="skill_issue.py", description=__doc__.splitlines()[0])
    commands = parser.add_subparsers(dest="command", required=True)
    info = commands.add_parser("info", help="identify a skill and the commit it runs from")
    info.add_argument("skill_dir", type=Path)
    info.add_argument("--allow-copy", action="store_true", help="the user confirmed it is a copy of this repo's skill")
    args = parser.parse_args(argv)
    try:
        if args.command == "info":
            print(json.dumps(dataclasses.asdict(skill_info(args.skill_dir, args.allow_copy)), indent=2))
    except IssueError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
