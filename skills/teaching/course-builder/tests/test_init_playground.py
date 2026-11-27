import subprocess

import pytest
from conftest import COURSE_MD, RUN_CHAPTER, git

import course_md
import init_playground


def skeleton(tmp_path, setup="print('setup ok')\n"):
    course_dir = tmp_path / "course"
    repo = course_dir / "playground"
    repo.mkdir(parents=True)
    (course_dir / "course.md").write_text(COURSE_MD, encoding="utf-8")
    (repo / "check_setup.py").write_text(setup, encoding="utf-8")
    (repo / "run_chapter.py").write_text(RUN_CHAPTER, encoding="utf-8")
    (repo / "README.md").write_text("# made up\n", encoding="utf-8")
    return course_dir


@pytest.fixture(autouse=True)
def git_identity(monkeypatch):
    for key, value in {"GIT_AUTHOR_NAME": "T", "GIT_AUTHOR_EMAIL": "t@example.com", "GIT_COMMITTER_NAME": "T", "GIT_COMMITTER_EMAIL": "t@example.com"}.items():
        monkeypatch.setenv(key, value)


def test_init_makes_main_and_solutions_and_runs_the_setup_check(tmp_path):
    course_dir = skeleton(tmp_path)
    init_playground.init(course_dir)
    repo = course_dir / "playground"
    assert git(repo, "rev-parse", "--abbrev-ref", "HEAD") == "main"
    assert git(repo, "rev-parse", "main") == git(repo, "rev-parse", "solutions")
    assert git(repo, "status", "--porcelain") == ""


def test_init_refuses_an_existing_repo(tmp_path):
    course_dir = skeleton(tmp_path)
    init_playground.init(course_dir)
    with pytest.raises(course_md.CourseError, match="already"):
        init_playground.init(course_dir)


def test_init_reports_a_failing_setup_check(tmp_path):
    course_dir = skeleton(tmp_path, setup="print('missing tool'); raise SystemExit(2)\n")
    with pytest.raises(course_md.CourseError, match="missing tool"):
        init_playground.init(course_dir)
    assert not (course_dir / "playground" / ".git").exists()


def test_init_refuses_to_commit_what_the_install_made_unless_it_is_ignored(tmp_path):
    course_dir = skeleton(tmp_path)
    md = course_dir / "course.md"
    md.write_text(md.read_text(encoding="utf-8").replace("Install: true", "Install: mkdir -p node_modules/pkg && touch node_modules/pkg/index.js"), encoding="utf-8")
    with pytest.raises(course_md.CourseError, match="node_modules"):
        init_playground.init(course_dir)
    assert not (course_dir / "playground" / ".git").exists()
    (course_dir / "playground" / ".gitignore").write_text("node_modules/\n", encoding="utf-8")
    init_playground.init(course_dir)
    assert "node_modules" not in git(course_dir / "playground", "ls-files")
