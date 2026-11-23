import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

from conftest import ENTRY, TODAY
from skill_issue import IssueError, SkillInfo, make_draft, read_draft, render, skill_info, validate_entry


@pytest.fixture
def entry(installed):
    return {**ENTRY, "skill_dir": str(installed)}


@pytest.fixture
def drafts(tmp_path, monkeypatch):
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path / "tmp"))
    return tmp_path / "tmp" / "report-skill-issue"


def test_render_title_labels_and_sections(entry, installed):
    info = skill_info(installed)
    title, body, labels = render(entry, info, TODAY)
    lines = body.splitlines()
    assert title == "[demo] validate_deck counts the newline in Items" and labels == ["bug", "skill:demo"]
    assert lines[0] == f"**Skill:** demo · `skills/teaching/demo` @ {info.commit[:7]} (clean, on main)"
    assert lines[2] == "**Reported:** 2026-11-23 · Claude Code (claude-opus-5-5)"
    assert [l for l in lines if l.startswith("## ")] == \
        ["## What happened", "## Expected", "## Steps to reproduce", "## Evidence", "## Suggested fix"]
    assert "1. Assemble the deck\n2. Run validate_deck.py" in body
    assert "**validator output**\n\n```\nerror: 1-006: too long\n```" in body


def test_skill_line_for_a_branch_and_for_a_copy(entry):
    branch = SkillInfo("demo", "skills/teaching/demo", "abcdef1234", True, "feat/x", False, "git")
    assert render(entry, branch, TODAY)[1].splitlines()[0] == \
        "**Skill:** demo · `skills/teaching/demo` @ abcdef1 (uncommitted changes, branch feat/x, not on main)"
    copy = SkillInfo("demo", "unknown", "unknown", None, "unknown", None, "copy")
    assert render(entry, copy, TODAY)[1].splitlines()[0] == "**Skill:** demo @ unknown (copied install)"
    unfetched = SkillInfo("demo", "skills/teaching/demo", "abcdef1234", False, "main", None, "git")
    assert render(entry, unfetched, TODAY)[1].splitlines()[0].endswith("@ abcdef1 (clean, main unknown)")


def test_kind_labels_optional_fix_and_model(entry, installed):
    info = skill_info(installed)
    assert render({**entry, "kind": "improvement"}, info, TODAY)[2] == ["enhancement", "skill:demo"]
    assert render({**entry, "kind": "docs"}, info, TODAY)[2] == ["documentation", "skill:demo"]
    _, body, _ = render({**entry, "suggested_fix": "", "model": ""}, info, TODAY)
    assert "## Suggested fix" not in body and body.splitlines()[2] == "**Reported:** 2026-11-23 · Claude Code"


def test_evidence_fence_longer_than_its_content(entry, installed):  # Review Focus 5
    body = render({**entry, "evidence": [{"text": "```python\nprint(1)\n```"}]}, skill_info(installed), TODAY)[1]
    assert "````\n```python\nprint(1)\n```\n````" in body


def test_entry_is_validated():
    with pytest.raises(IssueError, match="entry is missing: expected, steps"):
        validate_entry({k: v for k, v in {**ENTRY, "skill_dir": "x"}.items() if k not in ("expected", "steps")})
    with pytest.raises(IssueError, match="kind must be one of bug, improvement, docs"):
        validate_entry({**ENTRY, "skill_dir": "x", "kind": "feature"})
    with pytest.raises(IssueError, match="steps must be a non-empty list"):
        validate_entry({**ENTRY, "skill_dir": "x", "steps": []})
    with pytest.raises(IssueError, match="evidence must be a non-empty list"):
        validate_entry({**ENTRY, "skill_dir": "x", "evidence": []})


def test_draft_is_scrubbed_and_hashed(entry, drafts):
    leaky = {**entry, "title": "token ghp_" + "c" * 36,
             "evidence": [{"text": "key sk-proj-" + "b" * 40 + " at /Users/alice/proj"}]}
    out = make_draft(leaky, {"HOME": "/Users/alice"}, today=TODAY)
    path = Path(out["draft"])
    assert path.parent == drafts and out["sha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
    assert out["redacted"] == ["github-token", "openai-key"]
    draft = read_draft(path)
    assert (draft.repo, draft.title, draft.labels) == \
        ("ArrayaWongsaita/skills-issues", "[demo] token [REDACTED:github-token]", ["bug", "skill:demo"])
    assert "[REDACTED:openai-key] at ~/proj" in draft.body and "sk-proj-" not in path.read_text()


def test_safe_unique_file_names(entry, drafts):  # Review Focus 5
    first = Path(make_draft({**entry, "title": "ข้อความยาวเกิน 🙂"}, {}, today=TODAY)["draft"])
    second = Path(make_draft({**entry, "title": "ข้อความยาวเกิน 🙂"}, {}, today=TODAY)["draft"])
    assert re.fullmatch(r"\d{8}-\d{6}-[a-z0-9-]+\.md", first.name) and first != second and first.exists()


def test_cli_draft_from_stdin(skill_dir, entry, tmp_path):
    script = skill_dir / "scripts" / "skill_issue.py"
    env = {**os.environ, "TMPDIR": str(tmp_path / "t")}
    (tmp_path / "t").mkdir()
    run = subprocess.run([sys.executable, str(script), "draft", "-"], input=json.dumps(entry), capture_output=True, text=True, env=env)
    assert run.returncode == 0, run.stderr
    assert Path(json.loads(run.stdout)["draft"]).parent.name == "report-skill-issue"
