import hashlib

import contract
import deck
import mdtext
from conftest import FIXTURE, SCRIPTS, SLIDE_DESIGN_SCRIPTS


def _path(part: int):
    return next((FIXTURE / "slides").glob(f"part-{part:02d}-*.md"))


def _deck(part: int) -> deck.Deck:
    return deck.parse_deck(_path(part).read_text(encoding="utf-8"))


def _meta(part: int) -> dict:
    return _deck(part).meta


def test_shared_modules_match_slide_design():
    for name in ("frontmatter.py", "mdtext.py", "contract.py", "deck.py"):
        assert (SCRIPTS / name).read_bytes() == (SLIDE_DESIGN_SCRIPTS / name).read_bytes(), name


def test_fixture_decks_parse_cleanly():
    for path in sorted((FIXTURE / "slides").glob("part-*.md")):
        assert deck.parse_deck(path.read_text(encoding="utf-8")).errors == [], path.name


def test_part_one_uses_every_layout_and_visual_kind():
    slides = _deck(1).slides()
    assert {s.layout for s in slides} == set(contract.LAYOUTS)
    assert {s.visual["kind"] for s in slides if s.visual} == {"diagram", "illustration", "screenshot"}


def test_part_one_covers_the_text_cases():
    text = _path(1).read_text(encoding="utf-8")
    for needle in ("{", "}", "<", ">", "&", "**", "](https://", "~~", "่", "```text illustrative", '"unverified"'):
        assert needle in text, needle


def test_fixture_respects_contract_limits():
    for slide in _deck(1).slides():
        for name, field in slide.fields.items():
            limit = contract.FIELD_LIMITS.get((slide.layout, name)) or (contract.TITLE_LIMIT if name == "Title" else None)
            for text in field.items if name == "Items" else [field.text]:
                assert limit is None or mdtext.visible_length(text) <= limit, (slide.id, name)


def test_part_one_sha_matches_and_part_two_is_stale():
    assert _meta(1)["source_sha256"] == hashlib.sha256((FIXTURE / "part-01-first-agent.md").read_bytes()).hexdigest()
    assert _meta(2)["source_sha256"] == "0" * 64


def test_slide_count_matches():
    for part in (1, 2):
        assert _meta(part)["slide_count"] == len(_deck(part).slides())


def test_part_one_is_deck_at_2_with_units():
    d = _deck(1)
    assert d.meta["template"] == "slide-design/deck@2"
    assert [c["id"] for c in d.units["chapters"]] == ["1.1", "1.2"]


def test_part_two_is_deck_at_1():
    assert _meta(2)["template"] == "slide-design/deck@1" and _deck(2).units is None
