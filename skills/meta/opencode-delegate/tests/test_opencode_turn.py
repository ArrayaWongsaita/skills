import re
import signal
import subprocess
import sys
import time
from pathlib import Path

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
    code = opencode_turn.main(["--opencode", str(tmp_path / "nope"), "--dir", str(project), "--session", "s", "--out", str(log), "hi"])
    assert code == 3
    assert "not found" in capsys.readouterr().err


def test_a_project_folder_that_does_not_exist_is_exit_3(fake_opencode, tmp_path, capsys):
    fake = fake_opencode("pass")
    code = opencode_turn.main(["--opencode", str(fake), "--dir", str(tmp_path / "missing"), "--session", "s", "--out", str(tmp_path / "l"), "hi"])
    assert code == 3
    assert "missing" in capsys.readouterr().err


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
        "--session", "s", "--out", str(tmp_path / "turn.log"), "--status-file", str(status), "hi",
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
    code = opencode_turn.main(["--detach", "--opencode", str(fake_opencode("pass")), "--dir", str(project), "--session", "s", "--out", str(tmp_path / "l"), "hi"])
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
