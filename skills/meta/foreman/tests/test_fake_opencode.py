import os
import subprocess
import sys

from conftest import SKILL_DIR

FIXTURE = SKILL_DIR / "evals" / "fixtures" / "fake_opencode.py"


def run(tmp_path, session, mode, message="write the answer", **env):
    work = tmp_path / "work"
    work.mkdir(exist_ok=True)
    full_env = {**os.environ, "FAKE_STATE": str(tmp_path / "state"), "FAKE_MODE": mode, **env}
    result = subprocess.run(
        [sys.executable, str(FIXTURE), "run", "--auto", "-s", session, "--model", "p/m", message],
        cwd=work, env=full_env, capture_output=True, text=True, timeout=30,
    )
    answer = work / "answer.txt"
    return result, answer.read_text(encoding="utf-8").strip() if answer.exists() else None


def test_claims_done_writes_a_wrong_answer_first_and_the_right_one_after_a_second_call_in_the_same_session(tmp_path):
    first, answer = run(tmp_path, "ses_a", "claims-done")
    assert first.returncode == 0 and "Done. The check passes." in first.stdout
    assert answer == "41"
    _, answer = run(tmp_path, "ses_a", "claims-done")
    assert answer == "42"
    _, answer = run(tmp_path, "ses_b", "claims-done")
    assert answer == "41"


def test_slow_waits_then_writes_the_right_answer(tmp_path):
    result, answer = run(tmp_path, "ses_a", "slow", FAKE_SECONDS="0.2")
    assert result.returncode == 0 and "Done." in result.stdout
    assert answer == "42"


def test_needs_token_fails_a_task_that_mentions_the_partner_service_and_does_the_rest(tmp_path):
    failed, answer = run(tmp_path, "ses_b", "needs-token", message="Refresh reference.txt from the Partner Service")
    assert failed.returncode == 1 and "API token" in failed.stdout
    assert answer is None
    ok, answer = run(tmp_path, "ses_a", "needs-token", message="write the answer")
    assert ok.returncode == 0
    assert answer == "42"


def test_commands_other_than_run_print_a_note_and_exit_0(tmp_path):
    """The delegate skill runs `opencode --version`, `opencode run --help` and `opencode session ...` too."""
    for argv in (["--version"], ["models"], ["session", "export", "ses_a"]):
        result = subprocess.run([sys.executable, str(FIXTURE), *argv], capture_output=True, text=True, timeout=30)
        assert result.returncode == 0 and "stand-in" in result.stdout


def test_an_unknown_mode_is_an_error(tmp_path):
    result, _ = run(tmp_path, "ses_a", "nope")
    assert result.returncode == 2 and "unknown FAKE_MODE" in result.stderr
