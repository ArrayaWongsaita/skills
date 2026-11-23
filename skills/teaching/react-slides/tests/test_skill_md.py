import re

import pytest

import frontmatter
from conftest import SKILL_DIR


@pytest.fixture
def skill_md() -> str:
    return (SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")


def test_frontmatter_name_and_description(skill_md):
    data, _ = frontmatter.parse(skill_md)
    assert data["name"] == "react-slides" == SKILL_DIR.name
    assert 0 < len(data["description"]) <= 1024
    assert "slide-design" in data["description"] and "Do not use" in data["description"]


@pytest.mark.parametrize("needle", [
    "scripts/build_part.py <course_dir> <N>", "--all", "--force", "--skip-install",
    "npm --prefix <course_dir>/web run build", "npm --prefix <course_dir>/web run preview",
    "http://localhost:4173/#/check/part-NN", "__reactSlidesCheck", "visuals.json",
])
def test_skill_md_names_every_command(skill_md, needle):
    assert needle in skill_md


def test_links_every_reference(skill_md):
    names = sorted(p.name for p in (SKILL_DIR / "references").glob("*.md"))
    assert names == ["components.md", "illustrator.md", "visual-check.md"]
    assert [n for n in names if f"references/{n}" not in skill_md] == []
    assert [n for n in set(re.findall(r"references/([a-z-]+\.md)", skill_md)) if n not in names] == []


def test_illustrator_dispatch(skill_md):
    assert 'subagent_type="general-purpose"' in skill_md
    assert "As a first step, read <skill>/references/illustrator.md and follow it." in skill_md
    assert "<course_dir>/web/_work/part-NN/visuals.json" in skill_md


def test_skill_md_has_reporting_hook(skill_md):
    section = skill_md.split("## Reporting problems with this skill", 1)[1]
    assert "web/_work/part-NN/skill-problems.md" in section
    assert "report-skill-issue" in section and "Skill problem:" in section


def test_screenshot_rules(skill_md):
    assert "never sign in" in skill_md and "credentials" in skill_md


def test_never_deploys_and_never_changes_text(skill_md):
    assert "Never deploy" in skill_md
    assert "never changes slide text" in skill_md


def test_without_tools(skill_md):
    assert "## Without a subagent tool" in skill_md and "## Without a browser tool" in skill_md


def test_acceptance_maps_every_spec_check():
    text = (SKILL_DIR / "evals" / "acceptance.md").read_text(encoding="utf-8")
    for check in ("1", "2", "3", "4", "5", "5a", "6", "7", "8", "9", "10", "11"):
        assert re.search(rf"^\| {check} \|", text, re.M), check
    assert "test_app_build.py" in text and "verbatim.test.tsx" in text


def test_agents_md_lists_react_slides_tests():
    text = (SKILL_DIR.parents[2] / "AGENTS.md").read_text(encoding="utf-8")
    assert "# react-slides" in text
    assert "pytest skills/teaching/react-slides/tests -q" in text
    assert "npm --prefix skills/teaching/react-slides/template ci" in text


def test_skill_md_tells_each_exit_status_1_apart():
    text = (SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")
    for case in ("no JSON report", "`errors`", "`--all`", "major template upgrade", "`install` is `failed`", "Node.js 20"):
        assert case in text, case
    assert "the deck cannot be read, so nothing was written" not in text
