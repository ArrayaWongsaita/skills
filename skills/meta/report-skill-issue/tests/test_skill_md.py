import json
import re

import pytest

import frontmatter
from skill_issue import validate_entry


@pytest.fixture
def skill_md(skill_dir):
    return (skill_dir / "SKILL.md").read_text(encoding="utf-8")


def test_frontmatter(skill_dir, skill_md):
    data, _ = frontmatter.parse(skill_md)
    assert data["name"] == "report-skill-issue" == skill_dir.name
    assert 0 < len(data["description"]) <= 1024 and "skills-issues" in data["description"]


@pytest.mark.parametrize("needle", ["skill_issue.py info", "skill_issue.py similar", "skill_issue.py draft",
                                    "skill_issue.py post", "--sha", "--comment", "--allow-copy", "skill-problems.md"])
def test_mentions_every_command(skill_md, needle):
    assert needle in skill_md


def test_approval_rule(skill_md):
    assert "Never run `post` before the user approves the exact draft" in skill_md


def test_entry_example_is_valid(skill_md):
    section = skill_md.split("## The entry", 1)[1]
    validate_entry(json.loads(re.search(r"```json\n(.*?)\n```", section, re.S).group(1)))


def test_has_its_own_hook(skill_md):
    assert "## Reporting problems with this skill" in skill_md


def test_acceptance_lists_the_checks(skill_dir):
    text = (skill_dir / "evals" / "acceptance.md").read_text(encoding="utf-8")
    assert [n for n in ("fake gh", "skills-issues", "Closes ArrayaWongsaita/skills-issues#") if n not in text] == []
