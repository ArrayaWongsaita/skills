import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

import frontmatter
from conftest import ENTRY, TODAY
from skill_issue import ISSUES_REPO, IssueError, make_draft, post, read_draft, sha256_of, similar

URL = "https://github.com/ArrayaWongsaita/skills-issues/issues/1"


@pytest.fixture
def draft(installed, tmp_path, monkeypatch):
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path / "tmp"))
    out = make_draft({**ENTRY, "skill_dir": str(installed)}, {}, today=TODAY)
    return Path(out["draft"]), out["sha256"]


def args_of(fake_gh):
    return [c["args"] for c in fake_gh.calls()]


def test_post_files_exactly_the_draft(draft, fake_gh):
    path, sha = draft
    fake_gh.rule(["label", "list"], stdout='[{"name": "bug"}]')
    fake_gh.rule(["issue", "create"], stdout=URL + "\n")
    assert post(path, sha, {}) == URL
    calls = args_of(fake_gh)
    assert calls[0][:2] == ["auth", "status"]
    assert ["label", "create", "skill:demo", "-R", ISSUES_REPO, "--color", "5319E7",
            "--description", "Problems with the demo skill"] in calls
    create = next(c for c in fake_gh.calls() if c["args"][:2] == ["issue", "create"])
    assert create["args"] == ["issue", "create", "-R", ISSUES_REPO, "--title", read_draft(path).title,
                              "--body-file", "-", "--label", "bug", "--label", "skill:demo"]
    assert create["stdin"] == read_draft(path).body


def test_existing_labels_are_not_recreated(draft, fake_gh):
    fake_gh.rule(["label", "list"], stdout='[{"name": "bug"}, {"name": "skill:demo"}]')
    fake_gh.rule(["issue", "create"], stdout=URL)
    post(*draft, {})
    assert not any(c[:2] == ["label", "create"] for c in args_of(fake_gh))


def test_changed_draft_is_refused(draft, fake_gh):
    path, sha = draft
    path.write_text(path.read_text() + "edited\n")
    with pytest.raises(IssueError, match="the draft changed after it was shown"):
        post(path, sha, {})
    assert fake_gh.calls() == []


def test_remaining_secret_is_refused(draft, fake_gh):
    path, _ = draft
    d = read_draft(path)
    path.write_text(frontmatter.render({"template": "report-skill-issue/draft@1", "repo": d.repo, "title": d.title,
                                        "labels": d.labels}) + d.body + "\nghp_" + "c" * 36 + "\n")
    with pytest.raises(IssueError, match="still contains secrets: github-token"):
        post(path, sha256_of(path), {})
    assert not any(c[:2] == ["issue", "create"] for c in args_of(fake_gh))


def test_comment_mode(draft, fake_gh):
    path, sha = draft
    fake_gh.rule(["issue", "comment"], stdout=URL + "#issuecomment-9\n")
    assert post(path, sha, {}, comment=7) == URL + "#issuecomment-9"
    comment = next(c for c in fake_gh.calls() if c["args"][:2] == ["issue", "comment"])
    assert comment["args"] == ["issue", "comment", "7", "-R", ISSUES_REPO, "--body-file", "-"]
    assert comment["stdin"] == read_draft(path).body
    assert not any(c[0] == "label" for c in args_of(fake_gh))


def test_gh_missing(draft, tmp_path, monkeypatch):
    (tmp_path / "empty").mkdir()
    monkeypatch.setenv("PATH", str(tmp_path / "empty"))
    with pytest.raises(IssueError, match="gh is not installed"):
        post(*draft, {})
    assert draft[0].exists()


def test_not_logged_in(draft, fake_gh):
    fake_gh.rule(["auth", "status"], stderr="You are not logged into any GitHub hosts.", code=1)
    with pytest.raises(IssueError, match="gh is not logged in: run `gh auth login`"):
        post(*draft, {})


def test_cli_keeps_the_draft_when_gh_fails(skill_dir, draft, fake_gh):
    path, sha = draft
    fake_gh.rule(["issue", "create"], stderr="GraphQL: Could not resolve to a Repository", code=1)
    run = subprocess.run([sys.executable, str(skill_dir / "scripts" / "skill_issue.py"), "post", str(path), "--sha", sha],
                         capture_output=True, text=True)
    assert run.returncode == 1
    assert "Could not resolve to a Repository" in run.stderr and f"the draft is kept at {path}" in run.stderr
    assert path.exists()


def test_similar_lists_open_first(fake_gh):
    fake_gh.rule(["issue", "list"], stdout='[{"number": 2, "title": "old", "state": "CLOSED", "url": "u2"},'
                                           ' {"number": 5, "title": "new", "state": "OPEN", "url": "u5"}]')
    assert similar("demo", "Items newline") == [{"number": 5, "title": "new", "state": "open", "url": "u5"},
                                                {"number": 2, "title": "old", "state": "closed", "url": "u2"}]
    assert args_of(fake_gh)[0] == ["issue", "list", "-R", ISSUES_REPO, "--label", "skill:demo", "--state", "all",
                                   "--search", "Items newline", "--json", "number,title,state,url", "--limit", "20"]
