import re
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture
def skill_md() -> str:
    return (SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")


def frontmatter(text: str) -> dict:
    block = re.match(r"---\n(.*?)\n---\n", text, re.S).group(1)
    return dict(line.split(": ", 1) for line in block.split("\n"))


def test_frontmatter_names_the_folder_and_says_when_to_use_it(skill_md):
    data = frontmatter(skill_md)
    assert data["name"] == "opencode-delegate" == SKILL_DIR.name
    assert data["description"].startswith("Use when")
    assert len(data["description"]) <= 1024
    assert "waiting for N background job" in data["description"]


def test_every_script_the_skill_names_exists(skill_md):
    named = set(re.findall(r"<skill>/(scripts/[\w.]+)", skill_md))
    assert named == {"scripts/opencode_turn.py"}
    assert all((SKILL_DIR / path).is_file() for path in named)


@pytest.mark.parametrize("flag", ["--dir", "--session", "--out", "--model", "--title", "--archived", "--grace", "--timeout", "--status-file", "--detach"])
def test_every_flag_the_skill_shows_is_one_the_script_takes(skill_md, flag):
    assert flag in skill_md
    assert f'"{flag}"' in (SKILL_DIR / "scripts" / "opencode_turn.py").read_text(encoding="utf-8")


def test_the_skill_says_to_check_the_work_itself(skill_md):
    assert "Check its work yourself" in skill_md
    assert "opencode session export" in skill_md


def test_the_skill_warns_that_opencode_follows_PWD(skill_md):
    assert "$PWD" in skill_md


def test_the_skill_says_a_detached_server_outlives_the_turn(skill_md):
    assert "nohup" in skill_md and "outlives the turn" in skill_md


def test_the_skill_no_longer_tells_the_reader_to_wait_for_the_harness_to_report(skill_md):
    assert "read `<log>` when it reports" not in skill_md


def test_the_skill_shows_how_to_start_wait_for_and_cancel_a_detached_turn(skill_md):
    for needle in ("--detach", "status file", "kill -TERM", "status=cancelled", ".err"):
        assert needle in skill_md, needle
