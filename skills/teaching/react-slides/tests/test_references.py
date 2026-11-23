import pytest

import tsx_writer
from conftest import SKILL_DIR, TEMPLATE

REFS = SKILL_DIR / "references"


def _read(name: str) -> str:
    return (REFS / name).read_text(encoding="utf-8")


def test_components_md_lists_every_component():
    text = _read("components.md")
    for name in [*tsx_writer.COMPONENTS.values(), *tsx_writer.TEXT_COMPONENTS, "Deck", "SlideFrame", "Field"]:
        assert f"`{name}`" in text, name


def test_components_md_names_only_exported_sketch_primitives():
    exported = (TEMPLATE / "src" / "components" / "index.ts").read_text(encoding="utf-8")
    text = _read("components.md")
    for name in ("SketchRect", "SketchEllipse", "SketchLine", "SketchPath", "SketchArrow", "roleColour"):
        assert name in exported and f"`{name}`" in text, name


def test_components_md_warns_about_edits():
    text = _read("components.md")
    assert "skipped" in text and "--force" in text and "`id`" in text


def test_illustrator_brief():
    text = _read("illustrator.md")
    for needle in ("Sketch", "roleColour", 'viewBox="0 0 480 270"', "seedKey", "24 characters", "Skipped:", "Drawn:", "Skill problem:",
                   "from '../../components'", "Redo mode"):
        assert needle in text, needle


def test_visual_check_brief_covers_every_finding_kind():
    text = _read("visual-check.md")
    for kind in ("prose-overflow", "out-of-canvas", "fallback", "font-missing", "console-error", "scrolling-block"):
        assert f"`{kind}`" in text, kind
    assert "one redo round" in text.lower() and "never" in text


@pytest.mark.parametrize("name", ["components.md", "illustrator.md", "visual-check.md"])
def test_references_ask_for_skill_problem_lines_or_point_to_them(name):
    assert "Skill problem:" in _read(name) or "skill-problems.md" in _read(name)
