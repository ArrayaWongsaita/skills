import re

import pytest

from conftest import SKILL_DIR

REFERENCES = {"references/intake.md", "references/run-loop.md", "references/waiting.md"}


@pytest.fixture
def skill_md() -> str:
    return (SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")


@pytest.fixture
def everything(skill_md) -> str:
    """SKILL.md and every reference, as one text."""
    parts = [skill_md] + [path.read_text(encoding="utf-8") for path in sorted((SKILL_DIR / "references").glob("*.md"))]
    return "\n".join(parts)


def frontmatter(text: str) -> dict:
    block = re.match(r"---\n(.*?)\n---\n", text, re.S).group(1)
    return dict(line.split(": ", 1) for line in block.split("\n"))


def test_frontmatter_names_the_folder_and_says_when_to_use_it(skill_md):
    data = frontmatter(skill_md)
    assert data["name"] == "foreman" == SKILL_DIR.name
    assert data["description"].startswith("Use when")
    assert len(data["description"]) <= 1024
    assert "serious problem" in data["description"]


def test_every_script_the_skill_names_exists(everything):
    named = set(re.findall(r"<skill>/(scripts/[\w.]+)", everything))
    assert named == {"scripts/wait_status.py"}
    assert all((SKILL_DIR / path).is_file() for path in named)


def test_every_reference_the_skill_links_exists_and_there_are_exactly_three(skill_md):
    linked = set(re.findall(r"references/[\w.-]+\.md", skill_md))
    assert linked == REFERENCES
    assert all((SKILL_DIR / path).is_file() for path in linked)
    assert {f"references/{path.name}" for path in (SKILL_DIR / "references").glob("*.md")} == REFERENCES


@pytest.mark.parametrize("flag", ["--status-file", "--log", "--max", "--stall"])
def test_every_wait_status_flag_the_references_show_is_one_the_script_takes(everything, flag):
    assert flag in everything
    assert f'"{flag}"' in (SKILL_DIR / "scripts" / "wait_status.py").read_text(encoding="utf-8")


def test_the_waiting_reference_shows_how_to_start_and_cancel_a_detached_turn():
    waiting = (SKILL_DIR / "references" / "waiting.md").read_text(encoding="utf-8")
    for needle in ("--detach", "--status-file", "kill -TERM"):
        assert needle in waiting, needle


@pytest.mark.parametrize("needle", [
    "Status: go", "brief.md", "progress.md", "decisions.md", "40 minutes", "never end your turn", "blocked", "serious problem",
])
def test_the_skill_carries_the_rules_of_the_design(everything, needle):
    assert needle in everything


def test_skill_md_is_short(skill_md):
    assert len(skill_md.splitlines()) <= 120


def test_the_skill_has_the_reporting_section(skill_md):
    assert "## Reporting problems with this skill" in skill_md
