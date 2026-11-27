import re
import signal
import subprocess
import sys
import time
from pathlib import Path
from types import SimpleNamespace

import pytest

import opencode_turn
from conftest import alive, wait_until

WAITING = r"print('\x1b[90mwaiting for 1 background job\x1b[0m', flush=True)"


def turn(fake, project, tmp_path, *extra, message="do the thing"):
    log = tmp_path / "turn.log"
    code = opencode_turn.main(["--opencode", str(fake), "--dir", str(project), "--session", "ses_x", "--out", str(log), *extra, message])
    return code, log.read_text(encoding="utf-8")


def test_it_runs_opencode_in_the_project_with_the_session_model_title_and_message(fake_opencode, project, tmp_path, capsys):
    fake = fake_opencode("print('ARGV', sys.argv[1:], flush=True); print('CWD', os.getcwd(), flush=True)")
    code, text = turn(fake, project, tmp_path, "--model", "prov/model#max", "--title", "a test", "--archived")
    assert code == 0
    assert "ARGV ['run', '--auto', '-s', 'ses_x', '--model', 'prov/model#max', '--title', 'a test', '--archived', 'do the thing']" in text
    assert f"CWD {project.resolve()}" in text
    assert "status=done" in capsys.readouterr().out


def test_a_run_that_fails_exits_1_and_keeps_its_output(fake_opencode, project, tmp_path, capsys):
    fake = fake_opencode("print('partial work', flush=True); sys.exit(3)")
    code, text = turn(fake, project, tmp_path)
    assert code == 1
    assert "partial work" in text
    assert "status=failed" in capsys.readouterr().out


def test_a_run_that_only_waits_for_its_own_background_job_is_stopped_after_the_grace(fake_opencode, project, tmp_path, capsys, monkeypatch):
    fake = fake_opencode(f"print('all done', flush=True); {WAITING}; open(os.environ['PIDFILE'], 'w').write(str(os.getpid())); time.sleep(60)")
    pidfile = tmp_path / "pid"
    monkeypatch.setenv("PIDFILE", str(pidfile))
    started = time.time()
    code, text = turn(fake, project, tmp_path, "--grace", "0.5")
    assert code == 0 and time.time() - started < 20
    assert "all done" in text and "stopped by opencode_turn" in text
    assert "status=stopped" in capsys.readouterr().out
    pid = int(pidfile.read_text())
    time.sleep(0.3)
    assert not alive(pid)


def test_a_run_that_keeps_working_after_the_wait_line_is_not_stopped(fake_opencode, project, tmp_path, capsys):
    fake = fake_opencode(f"{WAITING}; time.sleep(0.4); print('AFTER', flush=True)")
    code, text = turn(fake, project, tmp_path, "--grace", "1.5")
    assert code == 0
    assert "AFTER" in text and "stopped by opencode_turn" not in text
    assert "status=done" in capsys.readouterr().out


def test_what_the_run_started_in_the_background_dies_with_it(fake_opencode, project, tmp_path, monkeypatch):
    fake = fake_opencode(
        f"child = subprocess.Popen(['sleep', '60']); open(os.environ['CHILDFILE'], 'w').write(str(child.pid)); {WAITING}; time.sleep(60)"
    )
    childfile = tmp_path / "child"
    monkeypatch.setenv("CHILDFILE", str(childfile))
    code, _ = turn(fake, project, tmp_path, "--grace", "0.5")
    assert code == 0
    pid = int(childfile.read_text())
    time.sleep(0.3)
    assert not alive(pid)


def test_a_run_that_does_not_finish_times_out_with_exit_2(fake_opencode, project, tmp_path, capsys, monkeypatch):
    fake = fake_opencode("print('start', flush=True); open(os.environ['PIDFILE'], 'w').write(str(os.getpid())); time.sleep(60)")
    pidfile = tmp_path / "pid"
    monkeypatch.setenv("PIDFILE", str(pidfile))
    code, text = turn(fake, project, tmp_path, "--timeout", "1")
    assert code == 2
    assert "start" in text
    assert "status=timeout" in capsys.readouterr().out
    time.sleep(0.3)
    assert not alive(int(pidfile.read_text()))


def test_a_missing_opencode_is_exit_3_with_a_clear_message(project, tmp_path, capsys):
    log = tmp_path / "turn.log"
    code = opencode_turn.main(["--opencode", str(tmp_path / "nope"), "--dir", str(project), "--session", "ses_x", "--out", str(log), "hi"])
    assert code == 3
    assert "not found" in capsys.readouterr().err


def test_a_project_folder_that_does_not_exist_is_exit_3(fake_opencode, tmp_path, capsys):
    fake = fake_opencode("pass")
    code = opencode_turn.main(["--opencode", str(fake), "--dir", str(tmp_path / "missing"), "--session", "ses_x", "--out", str(tmp_path / "l"), "hi"])
    assert code == 3
    assert "missing" in capsys.readouterr().err


@pytest.mark.parametrize("session", ["s", "my-task", "SES_x", "", "x_ses"])
@pytest.mark.parametrize("detach", [False, True])
def test_a_session_id_that_does_not_start_with_ses_is_exit_3_before_anything_starts(session, detach, fake_opencode, project, tmp_path, capsys, monkeypatch):
    """opencode rejects such an id with 'Expected a string starting with "ses"', after the turn has already begun."""

    def no_process(*args, **kwargs):
        raise AssertionError("a process was started")

    monkeypatch.setattr(opencode_turn.subprocess, "Popen", no_process)
    log = tmp_path / "turn.log"
    status = tmp_path / "turn.status"
    argv = ["--opencode", str(fake_opencode("pass")), "--dir", str(project), "--session", session, "--out", str(log), "--status-file", str(status)]
    code = opencode_turn.main([*argv, *(["--detach"] if detach else []), "hi"])
    assert code == 3
    err = capsys.readouterr().err
    assert '"ses"' in err and "ses_fixlogin01" in err
    assert not log.exists() and not status.exists()


@pytest.mark.parametrize("session", ["ses", "ses_x", "ses_fixlogin01"])
def test_a_session_id_that_starts_with_ses_is_passed_to_opencode(session, fake_opencode, project, tmp_path):
    log = tmp_path / "turn.log"
    code = opencode_turn.main(["--opencode", str(fake_opencode("print('ARGV', sys.argv[1:], flush=True)")), "--dir", str(project), "--session", session, "--out", str(log), "hi"])
    assert code == 0
    assert f"'-s', '{session}'" in log.read_text(encoding="utf-8")


def test_the_worker_sees_the_project_folder_in_PWD_not_the_callers(fake_opencode, project, tmp_path, monkeypatch):
    """opencode picks its folder from $PWD, so a PWD left over from the caller sends --auto into the wrong folder."""
    monkeypatch.setenv("PWD", str(tmp_path))
    fake = fake_opencode("print('PWD', os.environ.get('PWD'), flush=True)")
    code, text = turn(fake, project, tmp_path)
    assert code == 0
    assert f"PWD {project.resolve()}" in text


def test_the_status_line_is_written_to_the_status_file_when_the_turn_ends(fake_opencode, project, tmp_path, capsys):
    status = tmp_path / "sub" / "turn.status"
    code, _ = turn(fake_opencode("print('ok', flush=True)"), project, tmp_path, "--status-file", str(status))
    assert code == 0
    assert status.read_text(encoding="utf-8") == capsys.readouterr().out
    assert not (status.parent / "turn.status.tmp").exists()


def test_a_status_file_left_by_an_earlier_turn_is_removed_when_the_next_turn_starts(fake_opencode, project, tmp_path, monkeypatch):
    status = tmp_path / "turn.status"
    status.write_text("status=done exit=0 log=old\n", encoding="utf-8")
    monkeypatch.setenv("STATUS", str(status))
    fake = fake_opencode("print('GONE' if not os.path.exists(os.environ['STATUS']) else 'STILL THERE', flush=True)")
    code, text = turn(fake, project, tmp_path, "--status-file", str(status))
    assert code == 0
    assert "GONE" in text


def test_a_failed_turn_writes_status_failed_to_the_file(fake_opencode, project, tmp_path):
    status = tmp_path / "turn.status"
    code, _ = turn(fake_opencode("sys.exit(3)"), project, tmp_path, "--status-file", str(status))
    assert code == 1
    assert status.read_text(encoding="utf-8").startswith("status=failed exit=1")


def test_sigterm_stops_opencode_and_its_children_and_writes_status_cancelled(fake_opencode, project, tmp_path):
    childfile = tmp_path / "child"
    fake = fake_opencode(
        f"child = subprocess.Popen(['sleep', '60']); open({str(childfile)!r}, 'w').write(str(child.pid)); print('working', flush=True); time.sleep(60)"
    )
    status = tmp_path / "turn.status"
    proc = subprocess.Popen([
        sys.executable, opencode_turn.__file__, "--opencode", str(fake), "--dir", str(project),
        "--session", "ses_x", "--out", str(tmp_path / "turn.log"), "--status-file", str(status), "hi",
    ])
    wait_until(lambda: childfile.exists() and childfile.read_text() != "")
    proc.send_signal(signal.SIGTERM)
    assert proc.wait(timeout=20) == 4
    assert status.read_text(encoding="utf-8").startswith("status=cancelled exit=4")
    time.sleep(0.3)
    assert not alive(int(childfile.read_text()))


def detach_argv(fake, project, tmp_path, status):
    return ["--detach", "--opencode", str(fake), "--dir", str(project), "--session", "ses_x", "--out", str(tmp_path / "turn.log"), "--status-file", str(status), "do the thing"]


def test_detach_returns_at_once_prints_where_to_look_and_the_status_file_appears_when_the_turn_ends(fake_opencode, project, tmp_path, capsys):
    fake = fake_opencode("time.sleep(1.5); print('late work', flush=True)")
    status = tmp_path / "turn.status"
    began = time.time()
    code = opencode_turn.main(detach_argv(fake, project, tmp_path, status))
    assert code == 0 and time.time() - began < 1.0
    assert re.fullmatch(r"started status-file=\S+ log=\S+ pid=\d+\n", capsys.readouterr().out)
    assert not status.exists()
    wait_until(status.exists)
    assert "status=done exit=0" in status.read_text(encoding="utf-8")
    assert "late work" in (tmp_path / "turn.log").read_text(encoding="utf-8")


def test_detach_without_a_status_file_is_exit_3_with_a_message(fake_opencode, project, tmp_path, capsys):
    code = opencode_turn.main(["--detach", "--opencode", str(fake_opencode("pass")), "--dir", str(project), "--session", "ses_x", "--out", str(tmp_path / "l"), "hi"])
    assert code == 3
    assert "--status-file" in capsys.readouterr().err


@pytest.mark.parametrize("missing", ["opencode", "folder"])
def test_detach_with_a_missing_opencode_or_folder_is_exit_3_before_any_process_starts(missing, fake_opencode, project, tmp_path, capsys, monkeypatch):
    def no_process(*args, **kwargs):
        raise AssertionError("a process was started")

    monkeypatch.setattr(opencode_turn.subprocess, "Popen", no_process)
    status = tmp_path / "turn.status"
    fake = tmp_path / "nope" if missing == "opencode" else fake_opencode("pass")
    folder = tmp_path / "missing" if missing == "folder" else project
    code = opencode_turn.main(detach_argv(fake, folder, tmp_path, status))
    assert code == 3
    assert "not found" in capsys.readouterr().err
    assert not status.exists()


def spy_on_popen(monkeypatch):
    """Replace Popen with a recorder that starts nothing, and report what the parent had prepared when it was called."""
    seen = {}

    def popen(cmd, **kwargs):
        seen["cmd"], seen["stderr"] = cmd, kwargs.get("stderr")
        seen["stderr_name"] = getattr(kwargs.get("stderr"), "name", None)
        return SimpleNamespace(pid=4242)

    monkeypatch.setattr(opencode_turn.subprocess, "Popen", popen)
    return seen


def test_detach_creates_the_log_and_the_status_folder_and_keeps_the_childs_stderr_before_it_starts_the_child(fake_opencode, project, tmp_path, monkeypatch):
    """A child that dies before it writes anything must still leave a log (its age says when the turn began) and a traceback."""
    seen = spy_on_popen(monkeypatch)  # no child ever runs, so whatever exists afterwards the parent made
    status = tmp_path / "sub" / "turn.status"
    code = opencode_turn.main(detach_argv(fake_opencode("pass"), project, tmp_path, status))
    assert code == 0
    assert (tmp_path / "turn.log").exists() and status.parent.is_dir()
    assert Path(seen["stderr_name"]).name == "turn.status.err"


def test_detach_exits_3_when_the_log_or_the_status_folder_cannot_be_created(fake_opencode, project, tmp_path, capsys, monkeypatch):
    seen = spy_on_popen(monkeypatch)
    blocker = tmp_path / "blocker"
    blocker.write_text("a file where a folder is needed", encoding="utf-8")
    argv = detach_argv(fake_opencode("pass"), project, tmp_path, tmp_path / "turn.status")
    argv[argv.index("--out") + 1] = str(blocker / "turn.log")
    assert opencode_turn.main(argv) == 3
    assert "cannot create" in capsys.readouterr().err
    assert "cmd" not in seen


def test_the_detached_child_is_built_from_the_parsed_args_and_never_detaches_again():
    """`--det` is an abbreviation argparse accepts; filtering sys.argv for "--detach" would miss it and start the script forever."""
    args = opencode_turn.parse(["--det", "--session", "s", "--out", "o.log", "--status-file", "s.status", "--model", "p/m#max", "--archived", "--", "-hello"])
    cmd = opencode_turn.child_command(args)
    assert cmd[0] == sys.executable
    assert cmd[1] == str(Path(opencode_turn.__file__).resolve())
    assert "--detach" not in cmd and "--det" not in cmd
    assert cmd[cmd.index("--status-file") + 1].endswith("s.status")
    assert "--model" in cmd and "--archived" in cmd
    assert cmd[-2:] == ["--", "-hello"]


def test_a_failed_turn_after_a_cancelled_input_request_says_so(fake_opencode, project, tmp_path, capsys):
    fake = fake_opencode("print('wrote the files', flush=True); print('Cancelled a request for input this run cannot answer', flush=True); sys.exit(1)")
    code, _ = turn(fake, project, tmp_path)
    assert code == 1
    assert re.search(r"^status=failed exit=1 cause=input-cancelled log=", capsys.readouterr().out, re.M)


def test_a_failed_turn_that_ends_in_a_connection_reset_says_so(fake_opencode, project, tmp_path, capsys):
    fake = fake_opencode("print('wrote the files', flush=True); print('Error: read ECONNRESET', flush=True); sys.exit(1)")
    turn(fake, project, tmp_path)
    assert "cause=connection-reset" in capsys.readouterr().out


def test_the_status_file_gets_the_cause_too(fake_opencode, project, tmp_path):
    fake = fake_opencode("print('Error: read ECONNRESET', flush=True); sys.exit(1)")
    status = tmp_path / "turn.status"
    turn(fake, project, tmp_path, "--status-file", str(status))
    assert "status=failed exit=1 cause=connection-reset log=" in status.read_text(encoding="utf-8")


def test_an_early_connection_reset_gives_no_cause(fake_opencode, project, tmp_path, capsys):
    fake = fake_opencode(f"print('Error: read ECONNRESET', flush=True); print('x' * {opencode_turn.TAIL_BYTES + 1000}, flush=True); print('TypeError: boom', flush=True); sys.exit(1)")
    turn(fake, project, tmp_path)
    assert "cause=" not in capsys.readouterr().out


def test_a_connection_reset_followed_by_more_output_gives_no_cause(fake_opencode, project, tmp_path, capsys):
    fake = fake_opencode("print('Error: read ECONNRESET', flush=True); [print(f'step {n}', flush=True) for n in range(10)]; print('TypeError: boom', flush=True); sys.exit(1)")
    turn(fake, project, tmp_path)
    assert "cause=" not in capsys.readouterr().out


def test_a_done_turn_never_gets_a_cause(fake_opencode, project, tmp_path, capsys):
    fake = fake_opencode("print('Error: read ECONNRESET', flush=True)")
    turn(fake, project, tmp_path)
    assert "cause=" not in capsys.readouterr().out
