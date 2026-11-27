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
