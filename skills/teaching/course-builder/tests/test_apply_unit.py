import pytest
from conftest import EXERCISE, SOLVED, git

import apply_unit
import course_md


def stage(course_dir, nn="02", folder="02-second", main_text=None, solved_text=None):
    unit = course_dir / "units" / nn
    for branch, text in (("main", main_text or EXERCISE.format(nn=nn)), ("solutions", solved_text or SOLVED.format(nn=nn))):
        target = unit / branch / "lessons" / folder
        target.mkdir(parents=True, exist_ok=True)
        (target / "thing.test.ts").write_text(text, encoding="utf-8")


def show(repo, branch, path):
    return git(repo, "show", f"{branch}:{path}")


def test_apply_commits_a_unit_on_both_branches_and_marks_it_review(git_playground):
    stage(git_playground)
    assert apply_unit.apply(git_playground, "02") == "committed"
    repo = git_playground / "playground"
    assert "👉" in show(repo, "main", "lessons/02-second/thing.test.ts")
    assert "👉" not in show(repo, "solutions", "lessons/02-second/thing.test.ts")
    assert course_md.read(git_playground).chapter("02").status == "review"
    assert git(repo, "log", "-1", "--format=%s", "main") == "feat: chapter 02 second"


def test_a_unit_whose_solution_fails_commits_nothing(git_playground):
    repo = git_playground / "playground"
    heads = (git(repo, "rev-parse", "main"), git(repo, "rev-parse", "solutions"))
    stage(git_playground, solved_text="// ข้อ 1: แรก\n// แนวทาง: x\nFAIL\n")
    with pytest.raises(apply_unit.ApplyError, match="run-failed"):
        apply_unit.apply(git_playground, "02")
    assert (git(repo, "rev-parse", "main"), git(repo, "rev-parse", "solutions")) == heads
    assert course_md.read(git_playground).chapter("02").status == "outline"


def test_a_unit_with_a_broken_exercise_shape_commits_nothing(git_playground):
    repo = git_playground / "playground"
    head = git(repo, "rev-parse", "main")
    stage(git_playground, main_text="// ข้อ 1: แรก\ntest.todo('x');\n")
    with pytest.raises(apply_unit.ApplyError, match="exercise-shape"):
        apply_unit.apply(git_playground, "02")
    assert git(repo, "rev-parse", "main") == head


def test_applying_the_same_unit_twice_commits_once(git_playground):
    stage(git_playground)
    apply_unit.apply(git_playground, "02")
    repo = git_playground / "playground"
    head = git(repo, "rev-parse", "main")
    assert apply_unit.apply(git_playground, "02") == "unchanged"
    assert git(repo, "rev-parse", "main") == head


def test_apply_leaves_the_users_working_tree_alone(git_playground):
    repo = git_playground / "playground"
    readme = repo / "README.md"
    readme.write_text(readme.read_text(encoding="utf-8") + "my note\n", encoding="utf-8")
    stage(git_playground)
    apply_unit.apply(git_playground, "02")
    assert readme.read_text(encoding="utf-8").endswith("my note\n")
    assert git(repo, "rev-parse", "--abbrev-ref", "HEAD") == "main"


def test_a_missing_unit_folder_is_named(git_playground):
    with pytest.raises(apply_unit.ApplyError, match="units/02/main"):
        apply_unit.apply(git_playground, "02")


def test_the_users_checkout_moves_forward_and_stays_clean(git_playground):
    repo = git_playground / "playground"
    stage(git_playground)
    apply_unit.apply(git_playground, "02")
    assert git(repo, "status", "--porcelain") == ""
    assert (repo / "lessons" / "02-second" / "thing.test.ts").is_file()


def test_a_unit_that_changes_a_file_the_user_is_editing_commits_nothing(git_playground):
    repo = git_playground / "playground"
    heads = (git(repo, "rev-parse", "main"), git(repo, "rev-parse", "solutions"))
    readme = repo / "README.md"
    readme.write_text("my own edit\n", encoding="utf-8")
    stage(git_playground)
    for branch in ("main", "solutions"):
        (git_playground / "units" / "02" / branch / "README.md").write_text("| 01 | `01-first` |\n| 02 | `02-second` |\nnew row\n", encoding="utf-8")
    with pytest.raises(apply_unit.ApplyError, match=r"nothing was committed.*uncommitted changes.*README\.md"):
        apply_unit.apply(git_playground, "02")
    assert (git(repo, "rev-parse", "main"), git(repo, "rev-parse", "solutions")) == heads
    assert readme.read_text(encoding="utf-8") == "my own edit\n"


def test_check_only_runs_everything_and_commits_nothing(git_playground, capsys):
    repo = git_playground / "playground"
    heads = (git(repo, "rev-parse", "main"), git(repo, "rev-parse", "solutions"))
    stage(git_playground)
    assert apply_unit.main([str(git_playground), "02", "--check"]) == 0
    assert "chapter 02: passed" in capsys.readouterr().out
    assert (git(repo, "rev-parse", "main"), git(repo, "rev-parse", "solutions")) == heads
    assert course_md.read(git_playground).chapter("02").status == "outline"
    assert len(git(repo, "worktree", "list").splitlines()) == 1


def test_check_only_reports_a_failing_unit(git_playground):
    stage(git_playground, solved_text="// ข้อ 1: แรก\n// แนวทาง: x\nFAIL\n")
    assert apply_unit.main([str(git_playground), "02", "--check"]) == 1


def test_the_finish_unit_is_applied_without_changing_any_status(git_playground):
    stage(git_playground)
    apply_unit.apply(git_playground, "02")
    course_md.set_status(git_playground, "02", "done")
    for branch in ("main", "solutions"):
        (git_playground / "units" / "finish" / branch / "docs").mkdir(parents=True)
        (git_playground / "units" / "finish" / branch / "docs" / "cheatsheet.md").write_text("# cheatsheet\n", encoding="utf-8")
    assert apply_unit.apply(git_playground, "finish") == "committed"
    repo = git_playground / "playground"
    assert git(repo, "show", "solutions:docs/cheatsheet.md") == "# cheatsheet"
    assert git(repo, "log", "-1", "--format=%s", "main") == "docs: finish the course"
    assert [c.status for c in course_md.read(git_playground).chapters] == ["pilot", "done"]
    assert (git_playground / "units" / "02" / "main").is_dir()


def test_a_unit_whose_readme_drops_a_chapter_commits_nothing(git_playground):
    stage(git_playground)
    for branch in ("main", "solutions"):
        (git_playground / "units" / "02" / branch / "README.md").write_text("| 02 | `02-second` |\n", encoding="utf-8")
    with pytest.raises(apply_unit.ApplyError, match="01-first"):
        apply_unit.apply(git_playground, "02")


def test_no_solutions_branch_is_an_error_message_not_a_traceback(git_playground, capsys):
    git(git_playground / "playground", "branch", "-q", "-D", "solutions")
    stage(git_playground)
    assert apply_unit.main([str(git_playground), "02"]) == 1
    assert "solutions" in capsys.readouterr().err


def test_apply_says_the_users_uncommitted_changes_were_not_checked(git_playground, capsys):
    readme = git_playground / "playground" / "README.md"
    readme.write_text(readme.read_text(encoding="utf-8") + "my note\n", encoding="utf-8")
    stage(git_playground)
    assert apply_unit.main([str(git_playground), "02", "--check"]) == 0
    assert "uncommitted" in capsys.readouterr().out
