"""Read and check a Part's unit map (slides/_work/part-NN/units.json).

The unit map splits every sub-topic of a Part into one or more chapters of
small learning units, in the order a learner needs them. Stage 1 writes it,
the gate approves it, and assemble_deck.py copies it into the deck's
`## Units` section. `needs` names earlier units only. A unit may sit in an
earlier sub-topic than the Part put it, for a prerequisite reason: it then
carries `moved_from` (the sub-topic it came from) and a `reason`.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from contract import (  # noqa: E402
    CHAPTER_ID_RE,
    CHAPTER_KEYS,
    CHAPTER_UNITS_MAX,
    UNIT_GOAL_LIMIT,
    UNIT_ID_RE,
    UNIT_KEYS,
    UNIT_TITLE_LIMIT,
)
from mdtext import visible_length  # noqa: E402

REQUIRED_UNIT_KEYS = ("id", "title", "goal", "needs")


class UnitsError(ValueError):
    """The unit map file is missing or is not a JSON object."""


def load_units(path: Path) -> dict:
    path = Path(path)
    if not path.exists():
        raise UnitsError(f"no unit map at {path}: write it at Stage 1, or redo the storyboard")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise UnitsError(f"{path.name} is not valid JSON ({error})") from None
    if not isinstance(data, dict):
        raise UnitsError(f"{path.name} must hold a JSON object")
    return data


def chapter_list(data: dict) -> list[dict]:
    chapters = data.get("chapters") if isinstance(data, dict) else None
    return [chapter for chapter in chapters if isinstance(chapter, dict)] if isinstance(chapters, list) else []


def _units_of(chapter: dict) -> list[dict]:
    units = chapter.get("units")
    return [unit for unit in units if isinstance(unit, dict)] if isinstance(units, list) else []


def units_by_id(data: dict) -> dict[str, dict]:
    return {unit.get("id"): unit for chapter in chapter_list(data) for unit in _units_of(chapter)}


def unit_chapters(data: dict) -> dict[str, str]:
    return {unit.get("id"): chapter.get("id") for chapter in chapter_list(data) for unit in _units_of(chapter)}


def _text(value) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _check_unit(unit: dict, section, order: dict[str, int], earlier: set[str]) -> list[str]:
    uid = unit.get("id")
    name = f"unit {uid}"
    problems = [f"{name}: unknown key {key!r}" for key in unit if key not in UNIT_KEYS]
    problems += [f"{name}: missing {key}" for key in REQUIRED_UNIT_KEYS if key not in unit]
    if not isinstance(uid, str) or not UNIT_ID_RE.match(uid):
        problems.append(f"{name}: id must look like u-<words>")
    elif uid in earlier:
        problems.append(f"duplicate unit {uid}")
    for key, limit in (("title", UNIT_TITLE_LIMIT), ("goal", UNIT_GOAL_LIMIT)):
        if key not in unit:
            continue
        if not _text(unit[key]):
            problems.append(f"{name}: {key} must be text")
        elif visible_length(unit[key]) > limit:
            problems.append(f"{name}: {key} has {visible_length(unit[key])} characters, limit {limit}")
    needs = unit.get("needs", [])
    if not isinstance(needs, list) or not all(isinstance(need, str) for need in needs):
        problems.append(f"{name}: needs must be a list of unit ids")
    else:
        problems += [f"{name}: needs must name earlier units, not {need}" for need in needs if need not in earlier]
    if "moved_from" in unit:
        moved = unit["moved_from"]
        if moved not in order or section not in order or order[moved] <= order[section]:
            problems.append(f"{name}: moved_from must be a later sub-topic than {section}")
        if not _text(unit.get("reason")):
            problems.append(f"{name}: a moved unit needs a reason")
    elif "reason" in unit:
        problems.append(f"{name}: reason is only for a moved unit")
    return problems


def _check_letters(section: str, ids: list[str]) -> list[str]:
    if len(ids) == 1:
        return [] if ids[0] == section else [f"chapter {ids[0]}: id must be {section} for a single chapter"]
    problems = []
    for index, chapter_id in enumerate(ids):
        if chapter_id == section:
            problems.append(f"chapter {chapter_id}: id must carry a letter when {section} has {len(ids)} chapters")
        elif chapter_id != f"{section}{chr(ord('a') + index)}":
            problems.append(f"chapter {chapter_id}: split chapters of {section} must be {section}a, {section}b, … in order")
    return problems


def check_units(data: dict, subtopic_keys: list[str]) -> list[str]:
    """Every problem with the unit map, in map order; empty when it is valid."""
    if not isinstance(data, dict) or not isinstance(data.get("chapters"), list):
        return ["the unit map needs a chapters list"]
    problems = [f"the unit map: unknown key {key!r}" for key in data if key != "chapters"]
    if not data["chapters"]:
        return problems + ["the unit map has no chapters"]
    order = {key: index for index, key in enumerate(subtopic_keys)}
    earlier: set[str] = set()
    ids_by_section: dict[str, list[str]] = {}
    furthest = -1
    for chapter in data["chapters"]:
        if not isinstance(chapter, dict):
            problems.append("every chapter must be a JSON object")
            continue
        chapter_id, section = chapter.get("id"), chapter.get("section")
        name = f"chapter {chapter_id}"
        problems += [f"{name}: unknown key {key!r}" for key in chapter if key not in CHAPTER_KEYS]
        problems += [f"{name}: missing {key}" for key in CHAPTER_KEYS if key not in chapter]
        match = CHAPTER_ID_RE.match(chapter_id) if isinstance(chapter_id, str) else None
        if section not in order:
            problems.append(f"{name}: section {section} is not a sub-topic of this Part")
        else:
            if order[section] < furthest:
                problems.append(f"{name}: chapters must follow the Part's sub-topic order")
            furthest = max(furthest, order[section])
            if match and match["section"] == section:
                ids_by_section.setdefault(section, []).append(chapter_id)
        if not match:
            problems.append(f"{name}: id must be a sub-topic key, with a letter when the sub-topic is split")
        elif match["section"] != section:
            problems.append(f"{name}: id must start with its section {section}")
        if "title" in chapter and not _text(chapter["title"]):
            problems.append(f"{name}: title must be text")
        units = chapter.get("units")
        if not isinstance(units, list):
            problems.append(f"{name}: units must be a list")
            continue
        if not 1 <= len(units) <= CHAPTER_UNITS_MAX:
            problems.append(f"{name}: a chapter has 1 to {CHAPTER_UNITS_MAX} units, has {len(units)}")
        for unit in units:
            if not isinstance(unit, dict):
                problems.append(f"{name}: every unit must be a JSON object")
                continue
            problems += _check_unit(unit, section, order, earlier)
            if isinstance(unit.get("id"), str):
                earlier.add(unit["id"])
    seen = {chapter.get("section") for chapter in chapter_list(data)}
    problems += [f"sub-topic {key} has no chapter" for key in subtopic_keys if key not in seen]
    for section, ids in ids_by_section.items():
        problems += _check_letters(section, ids)
    return problems
