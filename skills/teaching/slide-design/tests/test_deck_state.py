import json
import subprocess
import sys

import pytest

from conftest import edit
from deck_state import StateError, new_state, next_action, reset_sections, set_section, state_path, transition
from part_reader import find_part

SCRIPT = str(__import__("pathlib").Path(__file__).resolve().parents[1] / "scripts" / "deck_state.py")


def run_cli(*args, check=True):
    result = subprocess.run([sys.executable, SCRIPT, *map(str, args)], capture_output=True, text=True)
    if check:
        assert result.returncode == 0, result.stderr
    return result


def walk(state, *stages):
    for stage in stages:
        state = transition(state, stage)
    return state


def done_state(sections):
    state = walk(new_state(sections, "th"), "storyboard-approved", "writing")
    for key in sections:
        state = set_section(state, key, "written")
    state = walk(state, "checking", "reviewing")
    for key in sections:
        state = set_section(state, key, "checked")
    return transition(state, "done")


def test_init_reads_sections_from_the_part(course):
    state_path(course, 1).unlink(missing_ok=True)  # Task 7 adds a fixture state
    run_cli("init", course, "1", "--language", "th")
    shown = json.loads(run_cli("show", course, "1").stdout)
    assert shown["stage"] == "storyboard" and shown["language"] == "th"
    assert shown["sections"] == {"opening": "pending", "1.1": "pending", "1.2": "pending", "closing": "pending"}
    assert shown["next_action"].startswith("plan the storyboard")


def test_init_refuses_existing_state(course):
    state_path(course, 1).unlink(missing_ok=True)
    run_cli("init", course, "1", "--language", "th")
    result = run_cli("init", course, "1", "--language", "th", check=False)
    assert result.returncode == 1 and "state exists" in result.stderr
    assert run_cli("init", course, "1", "--language", "en", "--force").returncode == 0


def test_state_path(course):
    assert state_path(course, 1) == course / "slides" / "_work" / "part-01" / "state.md"


def test_gate_cannot_be_skipped():
    with pytest.raises(StateError, match="cannot move from storyboard to writing"):
        transition(new_state(["opening"], "th"), "writing")


def test_checking_needs_every_section_written():
    state = walk(new_state(["opening", "1.1"], "th"), "storyboard-approved", "writing")
    state = set_section(state, "opening", "written")
    with pytest.raises(StateError, match="1.1"):
        transition(state, "checking")


def test_status_moves_only_at_their_stage():
    state = walk(new_state(["opening"], "th"), "storyboard-approved", "writing")
    with pytest.raises(StateError):
        set_section(state, "opening", "checked")
    state = walk(set_section(state, "opening", "written"), "checking", "reviewing")
    assert set_section(state, "opening", "checked")["sections"]["opening"] == "checked"


def test_done_needs_every_section_checked():
    state = walk(new_state(["opening"], "th"), "storyboard-approved", "writing")
    state = walk(set_section(state, "opening", "written"), "checking", "reviewing")
    with pytest.raises(StateError, match="opening"):
        transition(state, "done")


def test_redo_a_section_and_back_to_storyboard():
    state = done_state(["opening", "1.1"])
    with pytest.raises(StateError, match="pending"):
        transition(state, "writing")
    redo = transition(reset_sections(state, ["1.1"]), "writing")
    assert redo["sections"] == {"opening": "checked", "1.1": "pending"}
    assert transition(state, "storyboard")["sections"] == state["sections"]


def test_back_to_storyboard_takes_the_parts_sections():
    keys = ["opening", "1.1", "1.3", "closing"]
    state = done_state(["opening", "1.1", "1.2", "closing"])
    assert transition(state, "storyboard", sections=keys)["sections"] == dict.fromkeys(keys, "pending")
    fresh = new_state(["opening", "closing"], "th")
    assert transition(fresh, "storyboard", sections=keys)["sections"] == dict.fromkeys(keys, "pending")


def test_cli_storyboard_resyncs_sections_with_the_part(course):
    edit(find_part(course, 1), "### 1.2 ", "### 1.3 ")
    run_cli("set-stage", course, "1", "storyboard")
    assert json.loads(run_cli("show", course, "1").stdout)["sections"] == dict.fromkeys(["opening", "1.1", "1.3", "closing"], "pending")


def test_next_action_lists_pending_sections():
    state = walk(new_state(["opening", "1.1", "closing"], "th"), "storyboard-approved", "writing")
    assert next_action(set_section(state, "opening", "written")) == "write sections 1.1, closing"


def test_cli_set_stage_and_reset_all(course):
    state_path(course, 1).unlink(missing_ok=True)
    run_cli("init", course, "1", "--language", "th")
    assert run_cli("set-stage", course, "1", "writing", check=False).returncode == 1
    run_cli("set-stage", course, "1", "storyboard-approved")
    run_cli("set-stage", course, "1", "writing")
    run_cli("set-section", course, "1", "opening", "written")
    run_cli("reset-sections", course, "1", "--all")
    assert set(json.loads(run_cli("show", course, "1").stdout)["sections"].values()) == {"pending"}
