import time
from pathlib import Path

import opencode_turn
from conftest import alive

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
