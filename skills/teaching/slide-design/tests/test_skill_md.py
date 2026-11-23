import re

import pytest

import frontmatter
from contract import STAGES


@pytest.fixture
def skill_md(skill_dir) -> str:
    return (skill_dir / "SKILL.md").read_text(encoding="utf-8")


def test_frontmatter_name_matches_dir(skill_dir, skill_md):
    data, _ = frontmatter.parse(skill_md)
    assert data["name"] == "slide-design" == skill_dir.name
    assert 0 < len(data["description"]) <= 1024 and "course-research" in data["description"]


def test_links_every_reference(skill_dir, skill_md):
    assert [p.name for p in sorted((skill_dir / "references").glob("*.md")) if f"references/{p.name}" not in skill_md] == []


def test_links_only_existing_references(skill_dir, skill_md):
    assert [n for n in set(re.findall(r"references/([a-z-]+\.md)", skill_md)) if not (skill_dir / "references" / n).exists()] == []


@pytest.mark.parametrize("needle", ["scripts/deck_state.py", "scripts/vocabulary.py", "scripts/assemble_deck.py", "scripts/validate_deck.py", "--diagrams", "--language", "stale",
                                    "--plan", "units.json", "Part ordering problems", "unit map"])
def test_mentions_every_script_and_flag(skill_md, needle):
    assert needle in skill_md


def test_mentions_every_stage_and_the_gate(skill_md):
    assert [s for s in STAGES if f"`{s}`" not in skill_md] == []
    assert "Never dispatch writers before the user approves the storyboard" in skill_md


def test_prompts_point_at_their_briefs(skill_md):
    assert "read <skill>/references/section-writer.md and follow it" in skill_md
    assert "read <skill>/references/learner-review.md and follow it" in skill_md
    assert 'subagent_type="general-purpose"' in skill_md


def test_acceptance_lists_the_spec_checks(skill_dir):
    text = (skill_dir / "evals" / "acceptance.md").read_text(encoding="utf-8")
    assert [n for n in ("exit 0", "overlapping node", "unknown concept", "missing slot", "`new`", "over its limit", "reuses the vocabulary", "learner pass") if n not in text] == []


def test_reporting_hook(skill_md):
    section = skill_md.split("## Reporting problems with this skill", 1)[1]
    assert "<work>/skill-problems.md" in section and "report-skill-issue" in section and "Skill problem:" in section
    assert " → not reported (<date>)" in section


def test_unit_map_rules_after_the_gate(skill_md):
    assert "inside one chapter" in skill_md and "never after the gate" in skill_md


def test_acceptance_lists_the_unit_checks(skill_dir):
    text = (skill_dir / "evals" / "acceptance.md").read_text(encoding="utf-8")
    assert [n for n in ("unit map", "topic slide", "assemble slide", "Part assembly", "moved unit") if n not in text] == []
