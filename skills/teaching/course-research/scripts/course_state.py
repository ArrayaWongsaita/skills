"""Resumable run state for one course folder.

The state lives in <course_dir>/_work/state.md: frontmatter (stage, parts,
updated) plus a human-readable table regenerated on every save. The
transition rules enforce the skill's gates, so the coordinator cannot reach
deep research without an approved outline.

CLI:
    python3 course_state.py init        <course_dir>
    python3 course_state.py show        <course_dir>
    python3 course_state.py set-stage   <course_dir> <stage>
    python3 course_state.py set-parts   <course_dir> <n>
    python3 course_state.py set-part    <course_dir> <part> <status>
    python3 course_state.py reset-parts <course_dir> <part> [<part> ...]
"""

import copy
import datetime
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import frontmatter  # noqa: E402
from contract import PART_STATUSES, STAGES  # noqa: E402

STATE_PATH = Path("_work/state.md")
WORK_STAGES = ("deep-research", "writing", "verifying")
BACKWARD_TARGETS = ("scope", "outline-draft")
REDO_SOURCES = ("writing", "verifying", "done")
# Stage you move into -> the part status every part must have reached first.
ENTRY_REQUIREMENTS = {"writing": "researched", "verifying": "written", "done": "checked"}
STAGE_WORK = {
    "scope": "interview the user and write _work/scope.md",
    "scope-confirmed": "dispatch the broad researchers",
    "broad-research": "re-dispatch any missing broad research notes, then build the outline from them",
    "outline-draft": "present the outline and get the user's approval",
    "outline-approved": "set the parts and start deep research",
}
STAGE_VERBS = {"deep-research": ("pending", "research"), "writing": ("researched", "write"), "verifying": ("written", "check")}


class StateError(ValueError):
    pass


def _today() -> str:
    return datetime.date.today().isoformat()


def new_state() -> dict:
    return {"stage": "scope", "parts": {}, "updated": _today()}


def load_state(course_dir: Path) -> dict:
    path = Path(course_dir) / STATE_PATH
    if not path.exists():
        raise StateError("no state: run init")
    data, _ = frontmatter.parse(path.read_text(encoding="utf-8"))
    return {"stage": data["stage"], "parts": data["parts"], "updated": data["updated"]}


def save_state(course_dir: Path, state: dict) -> None:
    path = Path(course_dir) / STATE_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = "".join(f"| {part} | {status} |\n" for part, status in _sorted_parts(state["parts"]))
    body = f"\n# Run state\n\nStage: **{state['stage']}**\n\n| Part | Status |\n|---|---|\n{rows}"
    data = {"stage": state["stage"], "parts": state["parts"], "updated": state["updated"]}
    path.write_text(frontmatter.render(data) + body, encoding="utf-8")


def _sorted_parts(parts: dict) -> list[tuple[str, str]]:
    return sorted(parts.items(), key=lambda item: int(item[0]))


def _rank(status: str) -> int:
    return PART_STATUSES.index(status)


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
    parts = state["parts"]
    if there == here + 1:
        if new_stage == "deep-research" and not parts:
            raise StateError("deep research needs parts: run set-parts first")
        needed = ENTRY_REQUIREMENTS.get(new_stage)
        if needed:
            behind = [p for p, s in _sorted_parts(parts) if _rank(s) < _rank(needed)]
            if behind:
                raise StateError(f"cannot enter {new_stage}: parts {', '.join(behind)} are not {needed} yet")
        return _touched(state, stage=new_stage)
    if there < here and new_stage in BACKWARD_TARGETS:
        # A restart writes a new outline, so no old part status may carry over.
        cleared = {"parts": {}} if new_stage == "scope" else {}
        return _touched(state, stage=new_stage, **cleared)
    if new_stage == "deep-research" and current in REDO_SOURCES:
        if not any(s == "pending" for s in parts.values()):
            raise StateError("redo needs at least one pending part: run reset-parts first")
        return _touched(state, stage=new_stage)
    raise StateError(f"cannot move from {current} to {new_stage}")


def set_parts(state: dict, n: int) -> dict:
    if state["stage"] != "outline-approved":
        raise StateError("set-parts is only allowed at stage outline-approved")
    if n < 1:
        raise StateError("a course needs at least one part")
    parts = {str(i): state["parts"].get(str(i), "pending") for i in range(1, n + 1)}
    return _touched(state, parts=parts)


def set_part(state: dict, part: int, status: str) -> dict:
    if state["stage"] not in WORK_STAGES:
        raise StateError(f"set-part is only allowed at stages {', '.join(WORK_STAGES)}")
    key = str(part)
    if key not in state["parts"]:
        raise StateError(f"unknown part {part}")
    if status not in PART_STATUSES:
        raise StateError(f"unknown status {status!r}")
    if _rank(status) != _rank(state["parts"][key]) + 1:
        raise StateError(f"part {part} is {state['parts'][key]}; it can only move to the next status")
    return _touched(state, parts={**state["parts"], key: status})


def reset_parts(state: dict, parts: list[int]) -> dict:
    updated = dict(state["parts"])
    for part in parts:
        if str(part) not in updated:
            raise StateError(f"unknown part {part}")
        updated[str(part)] = "pending"
    return _touched(state, parts=updated)


def next_action(state: dict) -> str:
    stage = state["stage"]
    if stage == "done":
        return "nothing left; report to the user"
    if stage in STAGE_VERBS:
        waiting, verb = STAGE_VERBS[stage]
        todo = [p for p, s in _sorted_parts(state["parts"]) if s == waiting]
        if todo:
            return f"{verb} parts {', '.join(todo)}"
        following = STAGES[STAGES.index(stage) + 1]
        return f"move to stage {following}"
    return STAGE_WORK[stage]


def _cli(argv: list[str]) -> int:
    if len(argv) < 2:
        raise StateError("usage: course_state.py <command> <course_dir> [args]")
    command, course_dir, args = argv[0], Path(argv[1]), argv[2:]
    if command == "init":
        save_state(course_dir, new_state())
        return 0
    state = load_state(course_dir)
    if command == "show":
        print(json.dumps({"stage": state["stage"], "parts": state["parts"], "next_action": next_action(state)}, ensure_ascii=False))
        return 0
    if command == "set-stage" and len(args) == 1:
        state = transition(state, args[0])
    elif command == "set-parts" and len(args) == 1:
        state = set_parts(state, int(args[0]))
    elif command == "set-part" and len(args) == 2:
        state = set_part(state, int(args[0]), args[1])
    elif command == "reset-parts" and args:
        state = reset_parts(state, [int(a) for a in args])
    else:
        raise StateError(f"unknown command or wrong arguments: {command} {' '.join(args)}")
    save_state(course_dir, state)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(_cli(sys.argv[1:]))
    except (StateError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        sys.exit(1)
