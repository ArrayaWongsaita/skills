import copy
import json
from pathlib import Path

import pytest

from units import UnitsError, chapter_list, check_units, load_units, unit_chapters, units_by_id

FIXTURE = Path(__file__).resolve().parent / "fixtures/course/slides/_work/part-01/units.json"
VALID = json.loads(FIXTURE.read_text(encoding="utf-8"))
KEYS = ["1.1", "1.2"]


def mutate(fn) -> dict:
    data = copy.deepcopy(VALID)
    fn(data)
    return data


def test_valid_map_has_no_errors():
    assert check_units(VALID, KEYS) == []


@pytest.mark.parametrize(
    "change,message",
    [
        (lambda d: d["chapters"][0]["units"][0].update(id="init"), "unit init: id must look like u-<words>"),
        (lambda d: d["chapters"][1]["units"][1].update(id="u-tool"), "duplicate unit u-tool"),
        (lambda d: d["chapters"][1]["units"][0].update(title="ก" * 41), "unit u-tool: title has 41 characters, limit 40"),
        (lambda d: d["chapters"][1]["units"][0].update(goal="ก" * 121), "unit u-tool: goal has 121 characters, limit 120"),
        (lambda d: d["chapters"][1]["units"][0].update(needs=["u-agent"]), "unit u-tool: needs must name earlier units, not u-agent"),
        (lambda d: d["chapters"][1]["units"][0].update(needs=["u-tool"]), "unit u-tool: needs must name earlier units, not u-tool"),
        (lambda d: d["chapters"].pop(1), "sub-topic 1.2 has no chapter"),
        (lambda d: d["chapters"].reverse(), "chapter 1.1: chapters must follow the Part's sub-topic order"),
        (lambda d: d["chapters"][0].update(id="1.1a"), "chapter 1.1a: id must be 1.1 for a single chapter"),
        (lambda d: d["chapters"][0].update(section="1.2"), "chapter 1.1: id must start with its section 1.2"),
        (
            lambda d: d["chapters"][1]["units"].extend({"id": f"u-x{i}", "title": "t", "goal": "g", "needs": []} for i in range(5)),
            "chapter 1.2: a chapter has 1 to 6 units, has 7",
        ),
        (lambda d: d["chapters"][1]["units"][0].update(moved_from="1.1", reason="r"), "unit u-tool: moved_from must be a later sub-topic than 1.2"),
        (lambda d: d["chapters"][0]["units"][0].update(moved_from="1.2"), "unit u-init-model: a moved unit needs a reason"),
        (lambda d: d["chapters"][0]["units"][0].update(reason="r"), "unit u-init-model: reason is only for a moved unit"),
        (lambda d: d["chapters"][0].update(colour="red"), "chapter 1.1: unknown key 'colour'"),
        (lambda d: d.update(chapters=[]), "the unit map has no chapters"),
    ],
)
def test_bad_maps_are_caught(change, message):
    found = check_units(mutate(change), KEYS)
    assert message in found, found


SPLIT = {
    "chapters": [
        VALID["chapters"][0],
        {"id": "1.2a", "section": "1.2", "title": "a", "units": [VALID["chapters"][1]["units"][0]]},
        {"id": "1.2b", "section": "1.2", "title": "b", "units": [VALID["chapters"][1]["units"][1]]},
    ]
}


def test_split_chapters_take_letters_in_order():
    assert check_units(SPLIT, KEYS) == []
    renamed = copy.deepcopy(SPLIT)
    renamed["chapters"][2]["id"] = "1.2c"
    assert "chapter 1.2c: split chapters of 1.2 must be 1.2a, 1.2b, … in order" in check_units(renamed, KEYS)
    plain = copy.deepcopy(SPLIT)
    plain["chapters"][1]["id"] = "1.2"
    assert "chapter 1.2: id must carry a letter when 1.2 has 2 chapters" in check_units(plain, KEYS)


def test_thai_marks_do_not_count_in_titles():  # Review Focus 5
    title = "ที่" * 20  # 40 visible characters, 60 code points
    assert len(title) == 60
    assert check_units(mutate(lambda d: d["chapters"][1]["units"][0].update(title=title)), KEYS) == []


def test_load_units_errors(tmp_path):
    with pytest.raises(UnitsError, match="no unit map at .*units.json: write it at Stage 1, or redo the storyboard"):
        load_units(tmp_path / "units.json")
    (tmp_path / "units.json").write_text("{", encoding="utf-8")
    with pytest.raises(UnitsError, match="units.json is not valid JSON"):
        load_units(tmp_path / "units.json")
    (tmp_path / "units.json").write_text("[]", encoding="utf-8")
    with pytest.raises(UnitsError, match="units.json must hold a JSON object"):
        load_units(tmp_path / "units.json")


def test_load_units_reads_the_fixture():
    assert load_units(FIXTURE) == VALID


def test_helpers():
    assert unit_chapters(VALID) == {"u-init-model": "1.1", "u-tool": "1.2", "u-agent": "1.2"}
    assert list(units_by_id(VALID)) == ["u-init-model", "u-tool", "u-agent"]
    assert [c["id"] for c in chapter_list(VALID)] == ["1.1", "1.2"]
