import json
import subprocess
import sys

import pytest

from conftest import git
from skill_issue import IssueError, origin_matches, skill_info


def test_info_for_a_symlinked_skill(installed, checkout):
    info = skill_info(installed)
    assert (info.name, info.path, info.commit, info.dirty, info.branch, info.on_main, info.source) == \
        ("demo", "skills/teaching/demo", git(checkout, "rev-parse", "HEAD"), False, "main", True, "git")


def test_path_through_a_symlinked_parent(tmp_path, checkout):  # Review Focus 3
    alias = tmp_path / "alias"
    alias.symlink_to(checkout)
    assert skill_info(alias / "skills" / "teaching" / "demo").path == "skills/teaching/demo"


def test_dirty_only_for_changes_inside_the_skill(installed, checkout):
    (checkout / "README.md").write_text("x")
    assert skill_info(installed).dirty is False
    (checkout / "skills/teaching/demo/notes.md").write_text("x")
    assert skill_info(installed).dirty is True


def test_a_branch_commit_is_not_on_main(installed, checkout):
    git(checkout, "checkout", "-q", "-b", "feat/x")
    (checkout / "skills/teaching/demo/SKILL.md").write_text("---\nname: demo\n---\n# Demo v2\n")
    git(checkout, "commit", "-qam", "v2")
    info = skill_info(installed)
    assert (info.branch, info.on_main) == ("feat/x", False)


def test_on_main_unknown_without_the_ref(installed, checkout):
    git(checkout, "update-ref", "-d", "refs/remotes/origin/main")
    assert skill_info(installed).on_main is None


def test_detached_head(installed, checkout):
    git(checkout, "checkout", "-q", "--detach")
    assert skill_info(installed).branch == "detached"


@pytest.mark.parametrize("url", [  # Review Focus 4
    "https://github.com/ArrayaWongsaita/skills", "https://github.com/ArrayaWongsaita/skills.git",
    "git@github.com:ArrayaWongsaita/skills.git", "ssh://git@github.com/ArrayaWongsaita/skills.git",
    "https://github.com/arrayawongsaita/Skills.git"])
def test_origin_forms_accepted(url):
    assert origin_matches(url)


@pytest.mark.parametrize("url", [  # Review Focus 4
    "https://github.com/ArrayaWongsaita/skills-issues.git", "https://github.com/ArrayaWongsaita/skills2",
    "https://github.com/someone/skills.git", "https://gitlab.com/ArrayaWongsaita/skills.git", ""])
def test_origin_look_alikes_refused(url):
    assert not origin_matches(url)


def test_other_repo_refused(installed, checkout):
    git(checkout, "remote", "set-url", "origin", "https://github.com/someone/skills.git")
    with pytest.raises(IssueError, match="someone/skills"):
        skill_info(installed)


def test_copied_install_needs_confirmation(tmp_path):
    copy = tmp_path / "copy" / "demo"
    copy.mkdir(parents=True)
    (copy / "SKILL.md").write_text("---\nname: demo\n---\n")
    with pytest.raises(IssueError, match="not a git checkout"):
        skill_info(copy)
    info = skill_info(copy, allow_copy=True)
    assert (info.name, info.path, info.commit, info.dirty, info.branch, info.on_main, info.source) == \
        ("demo", "unknown", "unknown", None, "unknown", None, "copy")


def test_confirmed_copy_inside_another_git_project(tmp_path, git_env):
    project = tmp_path / "project"
    copy = project / ".claude" / "skills" / "demo"
    copy.mkdir(parents=True)
    (copy / "SKILL.md").write_text("---\nname: demo\n---\n")
    git(tmp_path, "init", "-q", "-b", "main", str(project))
    git(project, "remote", "add", "origin", "https://github.com/someone/project.git")
    with pytest.raises(IssueError, match="someone/project"):
        skill_info(copy)
    assert skill_info(copy, allow_copy=True).source == "copy"


def test_name_falls_back_to_the_folder(tmp_path):
    copy = tmp_path / "folded"
    copy.mkdir()
    (copy / "SKILL.md").write_text("---\ndescription: >\n  folded text\n---\n")
    assert skill_info(copy, allow_copy=True).name == "folded"


def test_missing_skill_md(tmp_path):
    with pytest.raises(IssueError, match="no SKILL.md"):
        skill_info(tmp_path)


def test_cli_info(skill_dir, installed, checkout):
    script = skill_dir / "scripts" / "skill_issue.py"
    ok = subprocess.run([sys.executable, str(script), "info", str(installed)], capture_output=True, text=True)
    assert ok.returncode == 0 and json.loads(ok.stdout)["name"] == "demo"
    git(checkout, "remote", "set-url", "origin", "https://github.com/someone/skills.git")
    bad = subprocess.run([sys.executable, str(script), "info", str(installed)], capture_output=True, text=True)
    assert bad.returncode == 1 and bad.stderr.startswith("error: ")
