import os
import re
import threading
import time

import pytest

import wait_status

DONE = "status=done exit=0 log=/somewhere/turn.log"


def check(status, *extra):
    return wait_status.main(["--status-file", str(status), *extra])


def make_old(path, seconds):
    path.write_text("some output\n", encoding="utf-8")
    then = time.time() - seconds
    os.utime(path, (then, then))


@pytest.mark.parametrize("line", [DONE, "status=failed exit=1 log=/somewhere/turn.log"])
def test_a_finished_turn_prints_its_status_line_and_exits_0(line, tmp_path, capsys):
    status = tmp_path / "turn.status"
    status.write_text(line + "\n", encoding="utf-8")
    assert check(status) == 0
    assert capsys.readouterr().out == line + "\n"


def test_an_empty_status_file_counts_as_running(tmp_path, capsys):
    status = tmp_path / "turn.status"
    status.write_text("", encoding="utf-8")
    assert check(status) == 10
    assert capsys.readouterr().out.startswith("running")


def test_no_status_file_and_max_0_is_an_instant_running_check_exit_10(tmp_path, capsys):
    assert check(tmp_path / "turn.status") == 10
    assert capsys.readouterr().out == "running log-age=unknown\n"


def test_with_a_log_the_running_line_says_how_old_the_log_is(tmp_path, capsys):
    log = tmp_path / "turn.log"
    log.write_text("working\n", encoding="utf-8")
    assert check(tmp_path / "turn.status", "--log", str(log)) == 10
    assert re.fullmatch(r"running log-age=\d+s\n", capsys.readouterr().out)


def test_a_log_older_than_the_stall_limit_is_stalled_exit_11(tmp_path, capsys):
    log = tmp_path / "turn.log"
    make_old(log, 100)
    assert check(tmp_path / "turn.status", "--log", str(log), "--stall", "50") == 11
    match = re.fullmatch(r"stalled log-age=(\d+)s\n", capsys.readouterr().out)
    assert match and int(match.group(1)) >= 100


def test_stalled_wins_over_max_being_reached_and_is_reported_without_waiting_for_max(tmp_path):
    log = tmp_path / "turn.log"
    make_old(log, 100)
    began = time.monotonic()
    code = check(tmp_path / "turn.status", "--log", str(log), "--stall", "50", "--max", "5", "--poll", "0.1")
    assert code == 11
    assert time.monotonic() - began < 2


def test_the_status_file_wins_over_a_stale_log(tmp_path, capsys):
    log = tmp_path / "turn.log"
    make_old(log, 1000)
    status = tmp_path / "turn.status"
    status.write_text(DONE + "\n", encoding="utf-8")
    assert check(status, "--log", str(log), "--stall", "50") == 0
    assert capsys.readouterr().out == DONE + "\n"


def test_a_log_that_does_not_exist_yet_is_not_stalled_before_the_limit_and_does_not_crash(tmp_path, capsys):
    assert check(tmp_path / "turn.status", "--log", str(tmp_path / "no-log-yet"), "--stall", "100") == 10
    assert re.fullmatch(r"running log-age=\d+s\n", capsys.readouterr().out)


def test_a_log_that_never_appears_is_stalled_once_the_limit_has_passed_since_the_call_began(tmp_path):
    code = check(tmp_path / "turn.status", "--log", str(tmp_path / "no-log-yet"), "--stall", "0.3", "--max", "5", "--poll", "0.1")
    assert code == 11


def test_a_positive_max_returns_as_soon_as_the_status_file_appears(tmp_path, capsys):
    status = tmp_path / "turn.status"
    threading.Timer(0.3, lambda: status.write_text(DONE + "\n", encoding="utf-8")).start()
    began = time.monotonic()
    assert check(status, "--max", "5", "--poll", "0.1") == 0
    assert time.monotonic() - began < 2
    assert capsys.readouterr().out == DONE + "\n"


def test_a_positive_max_that_never_sees_the_file_returns_running_after_max(tmp_path, capsys):
    began = time.monotonic()
    assert check(tmp_path / "turn.status", "--max", "1", "--poll", "0.1") == 10
    assert time.monotonic() - began >= 1
    assert capsys.readouterr().out.startswith("running")


def test_stall_without_log_is_exit_3_with_a_message(tmp_path, capsys):
    assert check(tmp_path / "turn.status", "--stall", "50") == 3
    assert "--log" in capsys.readouterr().err
