import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parents[1]
SCRIPTS = str(SKILL_DIR / "scripts")
if SCRIPTS not in sys.path:
    sys.path.insert(0, SCRIPTS)


@pytest.fixture
def skill_dir() -> Path:
    return SKILL_DIR


def git(cwd: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(cwd), *args], check=True, capture_output=True, text=True).stdout.strip()


@pytest.fixture
def git_env(tmp_path, monkeypatch):
    """Git that ignores the user's own config, so signing hooks or a default branch name can't interfere."""
    config = tmp_path / "gitconfig"
    config.write_text("")
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", str(config))
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")
    for role in ("AUTHOR", "COMMITTER"):
        monkeypatch.setenv(f"GIT_{role}_NAME", "Test")
        monkeypatch.setenv(f"GIT_{role}_EMAIL", "test@example.com")


@pytest.fixture
def checkout(tmp_path, git_env) -> Path:
    """A one-commit checkout of this repo, on main, with origin/main at HEAD."""
    repo = tmp_path / "skills-repo"
    skill = repo / "skills" / "teaching" / "demo"
    skill.mkdir(parents=True)
    (skill / "SKILL.md").write_text("---\nname: demo\ndescription: Demo skill.\n---\n# Demo\n")
    git(tmp_path, "init", "-q", "-b", "main", str(repo))
    git(repo, "remote", "add", "origin", "https://github.com/ArrayaWongsaita/skills.git")
    git(repo, "add", ".")
    git(repo, "commit", "-qm", "init")
    git(repo, "update-ref", "refs/remotes/origin/main", "HEAD")
    return repo


@pytest.fixture
def installed(tmp_path, checkout) -> Path:
    """The demo skill installed the usual way: a symlink into the checkout."""
    link = tmp_path / "installed" / "demo"
    link.parent.mkdir()
    link.symlink_to(checkout / "skills" / "teaching" / "demo", target_is_directory=True)
    return link


ENTRY = {"kind": "bug", "title": "validate_deck counts the newline in Items", "what_happened": "A 2-item list failed the limit.",
         "expected": "Each item is measured on its own.", "steps": ["Assemble the deck", "Run validate_deck.py"],
         "evidence": [{"label": "validator output", "text": "error: 1-006: too long"}],
         "suggested_fix": "Measure items without the newline.", "harness": "Claude Code", "model": "claude-opus-5-5"}
TODAY = "2026-11-23"


FAKE_GH = """#!{python}
import json, os, sys
args = sys.argv[1:]
stdin = sys.stdin.buffer.read().decode("utf-8") if sys.stdin and not sys.stdin.isatty() else ""
with open(os.environ["FAKE_GH_LOG"], "a", encoding="utf-8") as log:
    log.write(json.dumps({{"args": args, "stdin": stdin}}) + "\\n")
rules = []
if os.path.exists(os.environ["FAKE_GH_RULES"]):
    with open(os.environ["FAKE_GH_RULES"], encoding="utf-8") as handle:
        rules = json.load(handle)
for rule in rules:
    if args[:len(rule["match"])] == rule["match"]:
        sys.stdout.write(rule["stdout"])
        sys.stderr.write(rule["stderr"])
        sys.exit(rule["code"])
"""


class FakeGh:
    """Records every call; answers with the first rule whose `match` is a prefix of the args (default: exit 0, no output)."""

    def __init__(self, root: Path):
        self.log = root / "gh-calls.jsonl"
        self.rules_file = root / "gh-rules.json"
        self.rules: list[dict] = []

    def rule(self, match: list[str], stdout: str = "", stderr: str = "", code: int = 0) -> None:
        self.rules.append({"match": match, "stdout": stdout, "stderr": stderr, "code": code})
        self.rules_file.write_text(json.dumps(self.rules), encoding="utf-8")

    def calls(self) -> list[dict]:
        if not self.log.exists():
            return []
        return [json.loads(line) for line in self.log.read_text(encoding="utf-8").splitlines()]


@pytest.fixture
def fake_gh(tmp_path, monkeypatch) -> FakeGh:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    gh = bin_dir / "gh"
    gh.write_text(FAKE_GH.format(python=sys.executable), encoding="utf-8")
    gh.chmod(0o755)
    fake = FakeGh(tmp_path)
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")
    monkeypatch.setenv("FAKE_GH_LOG", str(fake.log))
    monkeypatch.setenv("FAKE_GH_RULES", str(fake.rules_file))
    return fake
