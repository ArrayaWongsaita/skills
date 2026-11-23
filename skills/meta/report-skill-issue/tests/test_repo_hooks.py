HOOK = "## Reporting problems with this skill"


def test_every_skill_has_the_reporting_hook(skill_dir):
    skills_root = skill_dir.parents[1]
    found = sorted(skills_root.glob("*/*/SKILL.md"))
    assert len(found) >= 3
    assert [str(p.relative_to(skills_root)) for p in found if HOOK not in p.read_text(encoding="utf-8")] == []
