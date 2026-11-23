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
