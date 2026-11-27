from conftest import git, write_chapter

import check_playground as cp


def test_a_good_playground_is_ok(git_playground, capsys):
    assert cp.main([str(git_playground)]) == 0
    assert capsys.readouterr().out.strip() == "ok"


def test_a_failing_solution_is_run_failed_on_solutions(git_playground, capsys):
    repo = git_playground / "playground"
    git(repo, "checkout", "-q", "solutions")
    write_chapter(repo, "01-first", "// ข้อ 1: แรก\n// แนวทาง: x\nFAIL\n")
    git(repo, "commit", "-qam", "break")
    git(repo, "checkout", "-q", "main")
    assert cp.main([str(git_playground)]) == 1
    assert "run-failed 01 solutions" in capsys.readouterr().out


def test_no_solutions_branch_is_reported(git_playground):
    git(git_playground / "playground", "branch", "-q", "-D", "solutions")
    assert [f.kind for f in cp.check(git_playground)] == ["no-solutions-branch"]


def test_the_users_checkout_is_never_switched(git_playground):
    repo = git_playground / "playground"
    head = git(repo, "rev-parse", "HEAD")
    cp.check(git_playground)  # it reads main and then solutions: a check that switched the checkout would end on solutions
    assert git(repo, "rev-parse", "--abbrev-ref", "HEAD") == "main"
    assert git(repo, "rev-parse", "HEAD") == head
    assert len(git(repo, "worktree", "list").splitlines()) == 1


def test_uncommitted_changes_are_left_alone_and_named(git_playground, capsys):
    readme = git_playground / "playground" / "README.md"
    readme.write_text(readme.read_text(encoding="utf-8") + "my note\n", encoding="utf-8")
    assert cp.main([str(git_playground)]) == 0
    assert "uncommitted" in capsys.readouterr().out
    assert readme.read_text(encoding="utf-8").endswith("my note\n")


def test_save_output_writes_each_branch_run(git_playground, tmp_path):
    out = tmp_path / "runs"
    cp.check(git_playground, save_output=out)
    assert "ran lessons/01-first" in (out / "01-main.txt").read_text(encoding="utf-8")
    assert (out / "01-solutions.txt").is_file()


def test_no_run_checks_structure_only(git_playground):
    repo = git_playground / "playground"
    (repo / "check_setup.py").write_text("raise SystemExit(3)\n", encoding="utf-8")
    git(repo, "commit", "-qam", "break setup")
    assert cp.check(git_playground, run_commands=False) == []
    assert [f.kind for f in cp.check(git_playground)] == ["run-failed"]


def test_a_chapter_flag_checks_only_that_chapter(git_playground, capsys):
    assert cp.main([str(git_playground), "--chapter", "01", "--no-run"]) == 0


def test_each_run_gets_a_free_port_of_its_own(tmp_path):
    code1, out1 = cp.run('python3 -c "import os; print(os.environ[\'PLAYGROUND_PORT\'])"', tmp_path)
    code2, out2 = cp.run('echo ${PLAYGROUND_PORT}', tmp_path)
    assert code1 == code2 == 0
    assert int(out1) > 1024 and int(out2) > 1024


def test_saved_output_does_not_show_the_temporary_worktree(git_playground, tmp_path):
    repo = git_playground / "playground"
    (repo / "run_chapter.py").write_text("import os, sys\nprint('in', os.getcwd(), os.path.realpath(os.getcwd()))\n", encoding="utf-8")
    git(repo, "commit", "-qam", "print cwd")
    git(repo, "checkout", "-q", "solutions")
    git(repo, "checkout", "-q", "main", "--", "run_chapter.py")
    git(repo, "commit", "-qam", "print cwd")
    git(repo, "checkout", "-q", "main")
    out = tmp_path / "runs"
    cp.check(git_playground, save_output=out)
    text = (out / "01-main.txt").read_text(encoding="utf-8")
    assert "playground-" not in text and text.startswith("in . .")


def test_a_timed_out_command_leaves_no_process_behind(tmp_path):
    import os
    import time

    code, _ = cp.run("python3 -c \"import os, time; open('pid', 'w').write(str(os.getpid())); time.sleep(30)\"; true", tmp_path, timeout=2)
    assert code == 124
    pid = int((tmp_path / "pid").read_text())
    time.sleep(0.5)
    try:
        os.kill(pid, 0)
        alive = True
    except ProcessLookupError:
        alive = False
    assert not alive


def test_run_all_runs_on_both_branches_in_a_whole_check(git_playground):
    course_md_path = git_playground / "course.md"
    text = course_md_path.read_text(encoding="utf-8")
    course_md_path.write_text(text.replace("Run chapter:", "Run all: python3 -c \"raise SystemExit(4)\"\nRun chapter:"), encoding="utf-8")
    found = cp.check(git_playground)
    assert sorted((f.kind, f.branch) for f in found) == [("run-failed", "main"), ("run-failed", "solutions")]
    assert all("exited 4" in f.detail for f in found)
    assert cp.check(git_playground, chapter="01") == []
