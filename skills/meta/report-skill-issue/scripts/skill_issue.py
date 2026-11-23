#!/usr/bin/env python3
"""Report a problem with one of this repo's skills as an issue in the private skills-issues repo.

Subcommands: info, draft, similar, post. SKILL.md has the procedure.
"""
from __future__ import annotations

import argparse
import dataclasses
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Mapping

sys.path.insert(0, str(Path(__file__).resolve().parent))

import frontmatter
from secrets_scan import scrub

SOURCE_REPO = "ArrayaWongsaita/skills"
ISSUES_REPO = "ArrayaWongsaita/skills-issues"
UNKNOWN = "unknown"
KIND_LABELS = {"bug": "bug", "improvement": "enhancement", "docs": "documentation"}
REQUIRED_FIELDS = ("skill_dir", "kind", "title", "what_happened", "expected", "steps", "evidence", "harness")
TEXT_FIELDS = ("skill_dir", "title", "what_happened", "expected", "harness")
OPTIONAL_TEXT_FIELDS = ("suggested_fix", "model")
DRAFT_TEMPLATE = "report-skill-issue/draft@1"

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


def validate_entry(entry: dict) -> None:
    """Refuse an entry a fixer could not act on. Checks presence and types only."""
    if not isinstance(entry, dict):
        raise IssueError("the entry must be a JSON object")
    missing = [field for field in REQUIRED_FIELDS
               if entry.get(field) is None or (isinstance(entry[field], str) and not entry[field].strip())]
    if missing:
        raise IssueError(f"entry is missing: {', '.join(missing)}")
    if entry["kind"] not in KIND_LABELS:
        raise IssueError(f"kind must be one of {', '.join(KIND_LABELS)}, not {entry['kind']!r}")
    for field in TEXT_FIELDS:
        if not isinstance(entry[field], str):
            raise IssueError(f"{field} must be a string")
    for field in OPTIONAL_TEXT_FIELDS:
        if entry.get(field) is not None and not isinstance(entry[field], str):
            raise IssueError(f"{field} must be a string")
    steps = entry["steps"]
    if not isinstance(steps, list) or not steps or not all(isinstance(s, str) and s.strip() for s in steps):
        raise IssueError("steps must be a non-empty list of strings")
    evidence = entry["evidence"]
    if not isinstance(evidence, list) or not evidence or not all(
            isinstance(item, dict) and isinstance(item.get("text"), str) and item["text"].strip() for item in evidence):
        raise IssueError('evidence must be a non-empty list of {"label"?, "text", "lang"?} objects')


def _skill_line(info: SkillInfo) -> str:
    if info.source == "copy":
        return f"**Skill:** {info.name} @ unknown (copied install)"
    parts = ["uncommitted changes" if info.dirty else "clean"]
    if info.branch != "main":
        parts.append(f"branch {info.branch}")
    parts.append({True: "on main", False: "not on main", None: "main unknown"}[info.on_main])
    return f"**Skill:** {info.name} · `{info.path}` @ {info.commit[:7]} ({', '.join(parts)})"


def _evidence(item: dict) -> str:
    text = item["text"].strip("\n")
    longest = max((len(run) for run in re.findall(r"`+", text)), default=0)
    fence = "`" * max(3, longest + 1)
    block = f"{fence}{item.get('lang') or ''}\n{text}\n{fence}"
    return f"**{item['label']}**\n\n{block}" if item.get("label") else block


def render(entry: dict, info: SkillInfo, today: str) -> tuple[str, str, list[str]]:
    """The issue's title, body and labels, before the secret scan."""
    title = f"[{info.name}] {' '.join(entry['title'].split())}"
    labels = [KIND_LABELS[entry["kind"]], f"skill:{info.name}"]
    model = (entry.get("model") or "").strip()
    reported = f"**Reported:** {today} · {entry['harness'].strip()}" + (f" ({model})" if model else "")
    steps = "\n".join(f"{number}. {step.strip()}" for number, step in enumerate(entry["steps"], 1))
    blocks = [
        _skill_line(info),
        reported,
        f"## What happened\n\n{entry['what_happened'].strip()}",
        f"## Expected\n\n{entry['expected'].strip()}",
        f"## Steps to reproduce\n\n{steps}",
        "## Evidence\n\n" + "\n\n".join(_evidence(item) for item in entry["evidence"]),
    ]
    fix = (entry.get("suggested_fix") or "").strip()
    if fix:
        blocks.append(f"## Suggested fix\n\n{fix}")
    return title, "\n\n".join(blocks) + "\n", labels


@dataclass(frozen=True)
class Draft:
    path: Path
    repo: str
    title: str
    labels: list[str]
    body: str


def drafts_dir() -> Path:
    return Path(tempfile.gettempdir()) / "report-skill-issue"


def sha256_of(path: Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def _slug(title: str) -> str:
    return "-".join(re.findall(r"[a-z0-9]+", title.lower()))[:40].strip("-") or "issue"


def _write_new(directory: Path, stem: str, text: str) -> Path:
    """Write to <stem>.md, or <stem>-2.md and so on, never over an existing draft."""
    for number in range(1, 1000):
        path = directory / (f"{stem}.md" if number == 1 else f"{stem}-{number}.md")
        try:
            with path.open("x", encoding="utf-8") as handle:
                handle.write(text)
            return path
        except FileExistsError:
            continue
    raise IssueError(f"too many drafts named {stem} in {directory}")


def make_draft(entry: dict, environ: Mapping[str, str], today: str | None = None) -> dict:
    """Check, render, scrub and write one draft. Returns its path, SHA-256, title, labels and what was redacted."""
    validate_entry(entry)
    info = skill_info(Path(entry["skill_dir"]).expanduser(), bool(entry.get("allow_copy", False)))
    title, body, labels = render(entry, info, today or date.today().isoformat())
    title, title_kinds = scrub(title, environ)
    body, body_kinds = scrub(body, environ)
    directory = drafts_dir()
    directory.mkdir(parents=True, exist_ok=True)
    header = frontmatter.render({"template": DRAFT_TEMPLATE, "repo": ISSUES_REPO, "title": title, "labels": labels})
    path = _write_new(directory, f"{datetime.now():%Y%m%d-%H%M%S}-{_slug(entry['title'])}", header + body)
    return {"draft": str(path), "sha256": sha256_of(path), "title": title, "labels": labels,
            "redacted": list(dict.fromkeys(title_kinds + body_kinds))}


def read_draft(path: Path) -> Draft:
    try:
        data, body = frontmatter.parse(Path(path).read_text(encoding="utf-8"))
    except (OSError, frontmatter.FrontmatterError) as error:
        raise IssueError(f"cannot read the draft {path}: {error}") from None
    if data.get("template") != DRAFT_TEMPLATE:
        raise IssueError(f"{path} is not a report-skill-issue draft")
    return Draft(Path(path), data["repo"], data["title"], list(data["labels"]), body)


def _read_entry(source: str) -> dict:
    try:
        text = sys.stdin.read() if source == "-" else Path(source).read_text(encoding="utf-8")
        return json.loads(text)
    except OSError as error:
        raise IssueError(f"cannot read the entry: {error}") from None
    except json.JSONDecodeError as error:
        raise IssueError(f"the entry is not valid JSON: {error}") from None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="skill_issue.py", description=__doc__.splitlines()[0])
    commands = parser.add_subparsers(dest="command", required=True)
    info = commands.add_parser("info", help="identify a skill and the commit it runs from")
    info.add_argument("skill_dir", type=Path)
    info.add_argument("--allow-copy", action="store_true", help="the user confirmed it is a copy of this repo's skill")
    draft = commands.add_parser("draft", help="check, render, scrub and write an issue draft")
    draft.add_argument("entry", help="the entry JSON file, or - for stdin")
    args = parser.parse_args(argv)
    try:
        if args.command == "info":
            print(json.dumps(dataclasses.asdict(skill_info(args.skill_dir, args.allow_copy)), indent=2))
        elif args.command == "draft":
            print(json.dumps(make_draft(_read_entry(args.entry), os.environ), ensure_ascii=False, indent=2))
    except IssueError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
