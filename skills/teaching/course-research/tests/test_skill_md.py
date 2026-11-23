import pytest

import frontmatter
from contract import STAGES


@pytest.fixture
def skill_md(skill_dir) -> str:
    return (skill_dir / "SKILL.md").read_text(encoding="utf-8")


def test_frontmatter_name_matches_dir(skill_dir, skill_md):
    data, _ = frontmatter.parse(skill_md)
    assert data["name"] == "course-research" == skill_dir.name
    assert 0 < len(data["description"]) <= 1024


def test_links_every_reference(skill_dir, skill_md):
    missing = [p.name for p in sorted((skill_dir / "references").glob("*.md")) if f"references/{p.name}" not in skill_md]
    assert missing == []


@pytest.mark.parametrize("script", ["scripts/course_state.py", "scripts/validate_course.py", "scripts/code_check/setup_env.py", "scripts/code_check/check_code.py"])
def test_mentions_every_script_cli(skill_md, script):
    assert script in skill_md


def test_mentions_every_stage(skill_md):
    assert [stage for stage in STAGES if f"`{stage}`" not in skill_md and f" {stage}" not in skill_md] == []
    assert "scope-confirmed" in skill_md and "outline-approved" in skill_md


@pytest.mark.parametrize("needle", ["renumbered", "dropped", "not yet checked", "part-*.md"])
def test_resume_paths_cover_stale_parts(skill_md, needle):
    assert needle in skill_md


def test_part_slugs_fixed_in_outline(skill_dir):
    assert "part-01-<slug>.md" in (skill_dir / "references" / "outline.md").read_text(encoding="utf-8")


def test_reporting_hook(skill_md):
    section = skill_md.split("## Reporting problems with this skill", 1)[1]
    assert "<course_dir>/_work/skill-problems.md" in section and "report-skill-issue" in section and "Skill problem:" in section
    assert " → not reported (<date>)" in section


def test_consistency_skill_rows_go_to_the_problems_file(skill_md):
    stage5 = skill_md.split("## Stage 5", 1)[1].split("\n## ", 1)[0]
    assert "`skill |` rows" in stage5 and "_work/skill-problems.md" in stage5
