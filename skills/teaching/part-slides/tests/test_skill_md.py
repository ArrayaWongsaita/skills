import re

SKILL_MD_MAX_LINES = 160


def _text(skill_dir):
    return (skill_dir / "SKILL.md").read_text(encoding="utf-8")


def _frontmatter(text: str) -> dict[str, str]:
    match = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    assert match, "SKILL.md has no frontmatter"
    return dict(line.split(": ", 1) for line in match.group(1).splitlines() if ": " in line)


def test_frontmatter_names_the_skill_after_its_folder(skill_dir):
    front = _frontmatter(_text(skill_dir))
    assert front["name"] == skill_dir.name == "part-slides"
    assert front["description"].startswith("Use when")
    assert len(front["description"]) < 1024


def test_the_description_says_when_not_to_use_it(skill_dir):
    assert "Do not use" in _frontmatter(_text(skill_dir))["description"]


def test_it_has_the_reporting_section_with_its_own_work_folder(skill_dir):
    text = _text(skill_dir)
    assert "## Reporting problems with this skill" in text
    assert "`<course_dir>/skill-problems.md`" in text


def test_every_linked_reference_exists_and_every_reference_is_linked(skill_dir):
    text = _text(skill_dir)
    linked = set(re.findall(r"`(references/[a-z-]+\.md)`", text))
    on_disk = {f"references/{p.name}" for p in (skill_dir / "references").glob("*.md")}
    assert linked == on_disk
    assert len(on_disk) == 5


def test_it_stays_short(skill_dir):
    assert len(_text(skill_dir).splitlines()) <= SKILL_MD_MAX_LINES


def test_it_does_not_depend_on_the_old_pipeline(skill_dir):
    for path in [skill_dir / "SKILL.md", *(skill_dir / "references").glob("*.md")]:
        text = path.read_text(encoding="utf-8")
        for name in ("course-research", "slide-design", "react-slides", "deck@"):
            assert name not in text, f"{path.name} mentions {name}"
