import json
import subprocess
import sys

import pytest

import course_state
from course_state import StateError, next_action, reset_parts, set_part, set_parts, transition


def state(stage, parts=None):
    return {"stage": stage, "parts": dict(parts or {}), "updated": "2026-11-22"}


def run_cli(skill_dir, *args):
    return subprocess.run(
        [sys.executable, str(skill_dir / "scripts" / "course_state.py"), *map(str, args)],
        capture_output=True,
        text=True,
    )


def test_init_and_show(skill_dir, tmp_path):
    assert run_cli(skill_dir, "init", tmp_path).returncode == 0
    shown = run_cli(skill_dir, "show", tmp_path)
    assert shown.returncode == 0
    assert json.loads(shown.stdout) == {
        "stage": "scope",
        "parts": {},
        "next_action": "interview the user and write _work/scope.md",
    }


def test_forward_one_step_only():
    with pytest.raises(StateError):
        transition(state("scope"), "broad-research")
    assert transition(state("scope"), "scope-confirmed")["stage"] == "scope-confirmed"


def test_outline_gate():
    with pytest.raises(StateError):
        transition(state("outline-draft"), "deep-research")
    approved = set_parts(state("outline-approved"), 3)
    assert approved["parts"] == {"1": "pending", "2": "pending", "3": "pending"}
    assert transition(approved, "deep-research")["stage"] == "deep-research"


def test_deep_research_needs_parts():
    with pytest.raises(StateError):
        transition(state("outline-approved"), "deep-research")


def test_backward_to_outline_draft_keeps_part_statuses():
    parts = {"1": "written", "2": "researched"}
    moved = transition(state("writing", parts), "outline-draft")
    assert moved["stage"] == "outline-draft"
    assert moved["parts"] == parts


def test_backward_elsewhere_is_rejected():
    with pytest.raises(StateError):
        transition(state("writing", {"1": "written"}), "broad-research")


def test_writing_requires_all_researched():
    with pytest.raises(StateError):
        transition(state("deep-research", {"1": "researched", "2": "pending"}), "writing")
    assert transition(state("deep-research", {"1": "researched", "2": "checked"}), "writing")["stage"] == "writing"


def test_set_part_forward_one_status():
    with pytest.raises(StateError):
        set_part(state("deep-research", {"1": "pending"}), 1, "written")
    assert set_part(state("deep-research", {"1": "pending"}), 1, "researched")["parts"]["1"] == "researched"


def test_set_part_rejected_outside_work_stages():
    with pytest.raises(StateError):
        set_part(state("outline-draft", {"1": "pending"}), 1, "researched")


def test_reset_parts():
    reset = reset_parts(state("verifying", {"1": "checked", "2": "written"}), [1])
    assert reset["parts"] == {"1": "pending", "2": "written"}


def test_redo_part_from_done():
    done = state("done", {"1": "checked", "2": "checked", "3": "checked"})
    with pytest.raises(StateError):
        transition(done, "deep-research")
    redo = transition(reset_parts(done, [2]), "deep-research")
    assert redo["stage"] == "deep-research"
    assert redo["parts"]["2"] == "pending"


def test_set_parts_keeps_remaining_statuses():
    resized = set_parts(state("outline-approved", {"1": "checked", "2": "written", "3": "checked"}), 2)
    assert resized["parts"] == {"1": "checked", "2": "written"}


def test_next_action_deep_research():
    parts = {"1": "researched", "2": "pending", "3": "pending"}
    assert next_action(state("deep-research", parts)) == "research parts 2, 3"


def test_next_action_other_stages():
    assert next_action(state("scope")) == "interview the user and write _work/scope.md"
    assert next_action(state("writing", {"1": "researched", "2": "written"})) == "write parts 1"
    assert next_action(state("verifying", {"1": "written", "2": "checked"})) == "check parts 1"
    assert next_action(state("done", {"1": "checked"})) == "nothing left; report to the user"
    for stage in ("scope-confirmed", "broad-research", "outline-draft", "outline-approved"):
        assert next_action(state(stage))


def test_state_file_roundtrip_has_table(tmp_path):
    saved = state("deep-research", {"1": "pending", "2": "researched"})
    course_state.save_state(tmp_path, saved)
    assert course_state.load_state(tmp_path) == saved
    assert "| 1 | pending |" in (tmp_path / course_state.STATE_PATH).read_text(encoding="utf-8")


def test_show_without_state_exits_1(skill_dir, tmp_path):
    shown = run_cli(skill_dir, "show", tmp_path)
    assert shown.returncode == 1
    assert shown.stderr.startswith("error: ")


def test_cli_rejects_skipping_the_gate(skill_dir, tmp_path):
    run_cli(skill_dir, "init", tmp_path)
    result = run_cli(skill_dir, "set-stage", tmp_path, "deep-research")
    assert result.returncode == 1
    assert json.loads(run_cli(skill_dir, "show", tmp_path).stdout)["stage"] == "scope"


def test_restart_clears_parts():
    assert transition(state("done", {"1": "checked", "2": "checked"}), "scope")["parts"] == {}


def test_next_action_broad_research_checks_for_missing_notes():
    assert "missing" in next_action(state("broad-research"))
