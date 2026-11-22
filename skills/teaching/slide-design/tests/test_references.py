import pytest

from contract import DECK_TEMPLATE_ID, FIELD_LIMITS, FIELDS, LAYOUTS, SHAPES, VISUAL_KINDS, VOCABULARY_TEMPLATE_ID
from deck import parse_sections


def read(skill_dir, name):
    return (skill_dir / "references" / name).read_text(encoding="utf-8")


def test_deck_template_names_the_whole_contract(skill_dir):
    text = read(skill_dir, "deck-template.md")
    assert DECK_TEMPLATE_ID in text and VOCABULARY_TEMPLATE_ID in text
    assert [layout for layout in LAYOUTS if f"`{layout}`" not in text] == []
    assert [field for field in FIELDS if f"**{field}:**" not in text] == []
    assert [key for key, value in FIELD_LIMITS.items() if f"| `{key[0]}` | {key[1]} | {value} |" not in text] == []


def test_deck_template_example_parses(skill_dir):
    text = read(skill_dir, "deck-template.md")
    example = text.split("<!-- example:deck -->")[1].split("<!-- /example:deck -->")[0]
    example = example.split("````markdown\n", 1)[1].rsplit("````", 1)[0]
    sections, errors = parse_sections(example)
    assert errors == [] and len({s.layout for s in sections[0].slides}) >= 3


@pytest.mark.parametrize("name,needles", [
    ("storyboard.md", ["prior knowledge", "Part gap", "at most 5 terms", "_None._", "diagrams.md", "new-concepts.json", "deck-notes.md", "--diagrams"]),
    ("visuals.md", [*SHAPES, *VISUAL_KINDS, "fallback", "Mermaid", "build step", "highlight"]),
    ("section-writer.md", ["Revision mode", "sections/<key>.md", "1-007a", "Notice", "no new facts"]),
    ("learner-review.md", ["Blocking", "Minor", "Round 2", "Part gap", "review.md", "prior knowledge"]),
])
def test_briefs_carry_their_rules(skill_dir, name, needles):
    text = read(skill_dir, name)
    assert [n for n in needles if n not in text] == []


@pytest.mark.parametrize("name", ["deck-template.md", "storyboard.md", "visuals.md", "section-writer.md", "learner-review.md"])
def test_briefs_link_only_existing_references(skill_dir, name):
    import re

    linked = set(re.findall(r"references/([a-z-]+\.md)", read(skill_dir, name)))
    assert [n for n in linked if not (skill_dir / "references" / n).exists()] == []
