"""Resumable run state for one Part's deck.

The state lives in <course_dir>/slides/_work/part-NN/state.md: frontmatter
(stage, sections, language, updated) plus a table regenerated on every
save. The transition rules hold the storyboard gate: no writing before the
storyboard is approved.

CLI:
    python3 deck_state.py init           <course_dir> <part> --language <code> [--force]
    python3 deck_state.py show           <course_dir> <part>
    python3 deck_state.py set-stage      <course_dir> <part> <stage>
    python3 deck_state.py set-section    <course_dir> <part> <key> <status>
    python3 deck_state.py reset-sections <course_dir> <part> (<key> ... | --all)
"""

import copy
import datetime
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import frontmatter  # noqa: E402
from contract import SECTION_STATUSES, SLIDES_DIR, STAGES, WORK_DIR  # noqa: E402
from part_reader import PartError, find_part, read_part  # noqa: E402

REDO_SOURCES = ("checking", "reviewing", "done")
# Stage you move into -> the status every section must have reached first.
ENTRY_REQUIREMENTS = {"checking": "written", "done": "checked"}
STAGE_WORK = {
    "storyboard": "plan the storyboard and diagrams, run validate_deck.py --diagrams, and present them at the gate",
    "storyboard-approved": "add the new concepts to the vocabulary, then move to stage writing",
    "checking": "assemble the deck and run validate_deck.py until it exits 0, then move to stage reviewing",
    "done": "nothing left; report to the user",
}


class StateError(ValueError):
    pass


def _today() -> str:
    return datetime.date.today().isoformat()


def state_path(course_dir: Path, part: int) -> Path:
    return Path(course_dir) / SLIDES_DIR / WORK_DIR / f"part-{int(part):02d}" / "state.md"


def new_state(sections: list[str], language: str) -> dict:
    return {"stage": "storyboard", "sections": {key: "pending" for key in sections}, "language": language, "updated": _today()}


def load_state(course_dir: Path, part: int) -> dict:
    path = state_path(course_dir, part)
    if not path.exists():
        raise StateError(f"no state for part {part}: run init")
    data, _ = frontmatter.parse(path.read_text(encoding="utf-8"))
    return {key: data[key] for key in ("stage", "sections", "language", "updated")}


def save_state(course_dir: Path, part: int, state: dict) -> None:
    path = state_path(course_dir, part)
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = "".join(f"| {key} | {status} |\n" for key, status in state["sections"].items())
    body = f"\n# Deck state\n\nStage: **{state['stage']}**\n\n| Section | Status |\n|---|---|\n{rows}"
    data = {key: state[key] for key in ("stage", "sections", "language", "updated")}
    path.write_text(frontmatter.render(data) + body, encoding="utf-8")


def _rank(status: str) -> int:
    return SECTION_STATUSES.index(status)


def _touched(state: dict, **changes) -> dict:
    result = copy.deepcopy(state)
    result.update(changes)
    result["updated"] = _today()
    return result


def transition(state: dict, new_stage: str) -> dict:
    if new_stage not in STAGES:
        raise StateError(f"unknown stage {new_stage!r}")
    current = state["stage"]
    if new_stage == current:
        return copy.deepcopy(state)
    here, there = STAGES.index(current), STAGES.index(new_stage)
    sections = state["sections"]
    if there == here + 1:
        needed = ENTRY_REQUIREMENTS.get(new_stage)
        if needed:
            behind = [key for key, status in sections.items() if _rank(status) < _rank(needed)]
            if behind:
                raise StateError(f"cannot enter {new_stage}: sections {', '.join(behind)} are not {needed} yet")
        return _touched(state, stage=new_stage)
    if new_stage == "storyboard":
        return _touched(state, stage=new_stage)
    if new_stage == "writing" and current in REDO_SOURCES:
        if "pending" not in sections.values():
            raise StateError("redo needs at least one pending section: run reset-sections first")
        return _touched(state, stage=new_stage)
    raise StateError(f"cannot move from {current} to {new_stage}")


def set_section(state: dict, key: str, status: str) -> dict:
    sections = state["sections"]
    if key not in sections:
        raise StateError(f"unknown section {key!r}")
    if status not in SECTION_STATUSES or status == "pending":
        raise StateError(f"status must be written or checked, got {status!r}; use reset-sections for pending")
    stage, before = ("writing", "pending") if status == "written" else ("reviewing", "written")
    if state["stage"] != stage:
        raise StateError(f"a section can become {status} only at stage {stage}")
    if sections[key] != before:
        raise StateError(f"section {key} is {sections[key]}; it can become {status} only from {before}")
    return _touched(state, sections={**sections, key: status})


def reset_sections(state: dict, keys: list[str]) -> dict:
    sections = dict(state["sections"])
    for key in keys:
        if key not in sections:
            raise StateError(f"unknown section {key!r}")
        sections[key] = "pending"
    return _touched(state, sections=sections)


def next_action(state: dict) -> str:
    stage, sections = state["stage"], state["sections"]
    if stage == "writing":
        todo = [key for key, status in sections.items() if status == "pending"]
        return f"write sections {', '.join(todo)}" if todo else "move to stage checking"
    if stage == "reviewing":
        todo = [key for key, status in sections.items() if status != "checked"]
        return f"review the deck, then mark sections {', '.join(todo)} checked" if todo else "move to stage done"
    return STAGE_WORK[stage]


def _cli(argv: list[str]) -> int:
    if len(argv) < 3:
        raise StateError("usage: deck_state.py <command> <course_dir> <part> [args]")
    command, course_dir, part, args = argv[0], Path(argv[1]), int(argv[2]), argv[3:]
    if command == "init":
        if "--language" not in args or args.index("--language") + 1 >= len(args):
            raise StateError("init needs --language <code>")
        language = args[args.index("--language") + 1]
        if state_path(course_dir, part).exists() and "--force" not in args:
            raise StateError(f"state exists at {state_path(course_dir, part)}: use show, or init --force to start over")
        sections = read_part(find_part(course_dir, part)).section_keys()
        save_state(course_dir, part, new_state(sections, language))
        return 0
    state = load_state(course_dir, part)
    if command == "show":
        shown = {"stage": state["stage"], "sections": state["sections"], "language": state["language"], "next_action": next_action(state)}
        print(json.dumps(shown, ensure_ascii=False))
        return 0
    if command == "set-stage" and len(args) == 1:
        state = transition(state, args[0])
    elif command == "set-section" and len(args) == 2:
        state = set_section(state, args[0], args[1])
    elif command == "reset-sections" and args:
        state = reset_sections(state, list(state["sections"]) if args == ["--all"] else args)
    else:
        raise StateError(f"unknown command or wrong arguments: {command} {' '.join(args)}")
    save_state(course_dir, part, state)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(_cli(sys.argv[1:]))
    except (StateError, PartError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        sys.exit(1)
