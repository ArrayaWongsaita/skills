# report-skill-issue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `report-skill-issue`, which turns problems an agent meets while running this repo's skills into user-approved issues in the private `ArrayaWongsaita/skills-issues` repo. Also add the reporting hook to the existing skills, and the repo's instructions for fixing issues.

**Architecture:**
- One stdlib CLI, `skill_issue.py`, with four subcommands: `info`, `draft`, `similar` and `post`. The secret scan lives in `secrets_scan.py`. `git` and `gh` are called as subprocesses.
- A draft is a file: JSON-literal frontmatter (repo, title, labels) followed by the issue body. `post` sends a draft only when its SHA-256 matches the one printed at draft time.
- `SKILL.md` carries the procedure. Each existing skill gets a hook section, and `AGENTS.md` carries the fixing workflow.

**Tech Stack:** Python ≥ 3.11 (stdlib only), pytest, git, the GitHub CLI `gh`.

**Spec:** `docs/superpowers/specs/2026-11-23-report-skill-issue-design.md`

## Global Constraints

- **Location:** the skill directory is `skills/meta/report-skill-issue/`, with `SKILL.md`, `scripts/`, `tests/` and `evals/acceptance.md`.
- **Scripts:** stdlib only, python3 ≥ 3.11. Each script inserts its own directory into `sys.path`, as in `slide-design`.
- **Repos:** `SOURCE_REPO = "ArrayaWongsaita/skills"` and `ISSUES_REPO = "ArrayaWongsaita/skills-issues"`.
- **Issue title and labels:** the title is `[<skill>] <summary>`. Labels are the kind label (`bug` → `bug`, `improvement` → `enhancement`, `docs` → `documentation`) plus `skill:<name>`.
- **Issue body order:**
  1. the `**Skill:**` line
  2. the `**Reported:**` line
  3. `## What happened`
  4. `## Expected`
  5. `## Steps to reproduce`
  6. `## Evidence`
  7. `## Suggested fix`, omitted when empty
- **Secret scan:**
  - It runs on the title and the body, at `draft` and again at `post`.
  - The reporter's own secret values are taken from environment variables whose names contain `KEY`, `TOKEN`, `SECRET`, `PASSWORD` or `CREDENTIAL`, with values of at least 8 characters.
  - The home path becomes `~`, and each secret becomes `[REDACTED:<kind>]`.
- **Drafts:** they live in `<tempfile.gettempdir()>/report-skill-issue/`.
- **Approval:** nothing is posted without the user's approval. `post` refuses a draft whose SHA-256 differs from the approved one.
- **Tests never call GitHub:**
  - `gh` is a fake executable on `PATH`.
  - Git in tests runs with `GIT_CONFIG_GLOBAL` pointing at an empty file and `GIT_CONFIG_NOSYSTEM=1`.
- **Hook and report formats:**
  - the hook heading is exactly `## Reporting problems with this skill`
  - the subagent reply line is `Skill problem: <what got in the way, and where>`
  - the consistency-review row is `skill | <brief or script> | <problem> | <suggested fix>`
- **Problems files:**
  - `course-research`: `<course_dir>/_work/skill-problems.md`
  - `slide-design`: `<work>/skill-problems.md`, where `<work>` is `<course_dir>/slides/_work/part-NN/`
- **Repo-facing text:** English.
- **Commits:** one commit per task.
- **Test commands:**
  - this skill: `uv run --no-project --python 3.12 --with pytest pytest skills/meta/report-skill-issue/tests -q`
  - slide-design: `uv run --no-project --python 3.12 --with pytest pytest skills/teaching/slide-design/tests -q`
  - course-research: `uv run --no-project --python 3.12 --with pytest --with langchain==1.5.2 --with langgraph==1.2.24 --with langchain-openai==1.8.5 --with python-dotenv==1.2.4 pytest skills/teaching/course-research/tests -q`

**Plan decisions** (the spec leaves these to the builder):
1. **Entry JSON:**
   - Keys: `{skill_dir, kind, title, what_happened, expected, steps: [str], evidence: [{label?, text}], suggested_fix?, harness, model?, allow_copy?}`.
   - Required: `skill_dir`, `kind`, `title`, `what_happened`, `expected`, `steps` (non-empty), `evidence` (non-empty) and `harness`.
   - `validate_entry` checks presence and types only, never whether a path exists.
2. **Draft file:** written with `frontmatter.render({"template": "report-skill-issue/draft@1", "repo": …, "title": …, "labels": […]})`, followed by the body. The SHA-256 covers the whole file's bytes.
3. **Unknown values:**
   - `dirty` and `on_main` are `True`, `False`, or `None` when unknown.
   - A copied install gets `commit`, `branch` and `path` of `"unknown"`, and `dirty` and `on_main` of `None`.
4. **CLI:** each subcommand prints its result on stdout. Errors print `error: <message>` on stderr and exit 1.
   - `info <skill_dir> [--allow-copy]` prints JSON.
   - `draft <entry.json | ->` prints JSON `{draft, sha256, title, labels, redacted}`.
   - `similar <skill> <words…>` prints a JSON list.
   - `post <draft> --sha <hex> [--comment N]` prints the URL.
5. **Body to `gh`:** the body is passed on stdin with `--body-file -`.
6. **Missing labels:** `post` creates them. `skill:<name>` gets `--color 5319E7 --description "Problems with the <name> skill"`. A missing kind label gets `--color ededed`.
7. **Drafts are kept after posting.** The temp dir is the OS's to clean.
8. **`frontmatter.py`** is copied verbatim from `skills/teaching/slide-design/scripts/frontmatter.py`.

## Review Focus

1. **A redacted draft must post.** `[REDACTED:…]` must not itself match a pattern on the rescan at `post`.
2. **Ordinary text that only looks like a secret stays untouched:** `task-…`, `max_tokens = 1000`, prose about tokens in Thai or English.
3. **The home path is replaced only at a path boundary.** With home `/Users/non`, `/Users/nonsense` stays. A skill reached through a symlinked parent (macOS `/var` vs `/private/var`) still gives the right path inside the repo.
4. **This repo's origin URL is recognised in every form,** HTTPS or SSH, with or without `.git`, in any letter case. Look-alikes are refused: `skills-issues`, `skills2`, another owner, another host.
5. **Awkward input stays intact:**
   - Evidence that contains triple backticks keeps its fence.
   - A title that is only Thai or emoji still gives a safe, non-empty draft file name.
   - Two drafts made in the same second do not overwrite each other.

---

### Task 1: Scaffold and the secret scan

**Files:**
- Create: `skills/meta/report-skill-issue/scripts/secrets_scan.py`
- Create: `skills/meta/report-skill-issue/scripts/frontmatter.py` (a verbatim copy from slide-design)
- Create: `skills/meta/report-skill-issue/tests/conftest.py`: inserts `<skill>/scripts` into `sys.path` and defines the `skill_dir` fixture, as in slide-design's conftest
- Test: `skills/meta/report-skill-issue/tests/test_secrets_scan.py`

**Interfaces:**
- Produces:
  - `SECRET_NAME_WORDS = ("KEY", "TOKEN", "SECRET", "PASSWORD", "CREDENTIAL")`
  - `MIN_SECRET_LENGTH = 8`
  - `scan(text: str, environ: Mapping[str, str]) -> list[str]`: the kinds found, unique, in order of first appearance
  - `scrub(text: str, environ: Mapping[str, str]) -> tuple[str, list[str]]`: the redacted text, with secrets replaced by `[REDACTED:<kind>]` and the home path by `~`, and the kinds redacted (the home path is not listed)
  - Kinds: `anthropic-key`, `openai-key`, `github-token`, `aws-access-key-id`, `google-api-key`, `slack-token`, `private-key`, `jwt`, `bearer-token`, `assignment` and `env:<NAME>`

- [ ] **Step 1: Write the failing tests**

```python
import pytest

from secrets_scan import scan, scrub

FAKE = {
    "anthropic-key": "sk-ant-api03-" + "a" * 40,
    "openai-key": "sk-proj-" + "b" * 40,
    "github-token": "ghp_" + "c" * 36,
    "aws-access-key-id": "AKIA" + "ABCDEFGHIJKLMNOP",
    "google-api-key": "AIza" + "d" * 35,
    "slack-token": "xoxb-1234567890-abcdefghij",
    "jwt": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
}


@pytest.mark.parametrize("kind,value", FAKE.items())
def test_each_token_shape_is_redacted(kind, value):
    assert scrub(f"got {value} in the log", {}) == (f"got [REDACTED:{kind}] in the log", [kind])


def test_private_key_block_is_redacted():
    block = "-----BEGIN OPENSSH PRIVATE KEY-----\nabc\ndef\n-----END OPENSSH PRIVATE KEY-----"
    assert scrub(f"key:\n{block}\nend", {}) == ("key:\n[REDACTED:private-key]\nend", ["private-key"])


def test_bearer_and_assignments_keep_their_names():
    raw = ('Authorization: Bearer abcdefghijklmnop1234\napi_key = "q1w2e3r4t5y6"\npassword: hunter2hunter2\n'
           "AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY")
    text, kinds = scrub(raw, {})
    assert text == ('Authorization: Bearer [REDACTED:bearer-token]\napi_key = "[REDACTED:assignment]"\n'
                    "password: [REDACTED:assignment]\nAWS_SECRET_ACCESS_KEY=[REDACTED:assignment]")
    assert kinds == ["bearer-token", "assignment"]


def test_reporters_own_secret_values_are_redacted():
    env = {"MY_SERVICE_TOKEN": "zq-custom-value-77", "SHORT_KEY": "abc", "PATH": "/usr/bin:/bin"}
    assert scrub("value zq-custom-value-77 and abc in /usr/bin", env) == (
        "value [REDACTED:env:MY_SERVICE_TOKEN] and abc in /usr/bin", ["env:MY_SERVICE_TOKEN"])


def test_home_path_becomes_tilde_only_on_a_boundary():  # Review Focus 3
    env = {"HOME": "/Users/non"}
    assert scrub("/Users/non/proj, /Users/nonsense, /Users/non-old and /Users/non.", env)[0] == \
        "~/proj, /Users/nonsense, /Users/non-old and ~."
    assert scrub("/x", {"HOME": "/"})[0] == "/x"


def test_scrubbed_text_scans_clean():  # Review Focus 1
    env = {"MY_TOKEN": "zq-custom-value-77"}
    raw = "\n".join([*FAKE.values(), 'token = "abcdefgh12345"', "Bearer abcdefghijklmnop1234", "zq-custom-value-77"])
    text, _ = scrub(raw, env)
    assert scan(text, env) == []


def test_ordinary_text_is_untouched():  # Review Focus 2
    text = "task-abcdefghijklmnopqrstuvwxyz1234 risk-free max_tokens = 1000, a token budget, ใช้ token น้อยลง"
    assert scrub(text, {"HOME": "/Users/non"}) == (text, [])
    assert scan(text, {}) == []


def test_scan_reports_each_kind_once_in_order():
    text = f"{FAKE['github-token']} {FAKE['openai-key']} {FAKE['github-token']}"
    assert scan(text, {}) == ["github-token", "openai-key"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run --no-project --python 3.12 --with pytest pytest skills/meta/report-skill-issue/tests -q`
Expected: collection error, `ModuleNotFoundError: No module named 'secrets_scan'`.

- [ ] **Step 3: Implement `scan` and `scrub` in `scripts/secrets_scan.py`**

- **Patterns:** one compiled regex per kind, checked in the order listed above. The order matters: `anthropic-key` must be checked before `openai-key`.
  - `anthropic-key`: `(?<![A-Za-z0-9])sk-ant-[A-Za-z0-9_-]{20,}`
  - `openai-key`: `(?<![A-Za-z0-9])sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}`
  - `github-token`: `(?<![A-Za-z0-9])(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})`
  - `aws-access-key-id`: `(?<![A-Za-z0-9])(?:AKIA|ASIA)[0-9A-Z]{16}(?![0-9A-Z])`
  - `google-api-key`: `(?<![A-Za-z0-9])AIza[0-9A-Za-z_-]{35}`
  - `slack-token`: `(?<![A-Za-z0-9])xox[abprs]-[A-Za-z0-9-]{10,}`
  - `private-key`: `-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----` with `re.S`
  - `jwt`: `(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}`
  - `bearer-token`: `(?i)\bbearer\s+` followed by the value `[A-Za-z0-9._~+/-]{16,}=*`
- **`bearer-token` and `assignment`:** replace only the value group.
  - The assignment name is any identifier containing `api_key`/`api-key`/`apikey`, `access_key`, `private_key`, `secret`, `token`, `password`, `passwd` or `credential` (case-insensitive).
  - Its value is `["']?` then 8 or more characters other than whitespace, quotes, `,` and `;`. The value must not start with `[REDACTED:`.
- **The reporter's own values:** exact substring replacement, longest value first.
- **The home path:** use `re.escape(home) + r"(?![\w-])"`. Skip it when `HOME` is empty or `/`.
- **`scrub`** returns the kinds in order of first redaction, without duplicates.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run --no-project --python 3.12 --with pytest pytest skills/meta/report-skill-issue/tests -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add skills/meta/report-skill-issue
git commit -m "feat(report-skill-issue): add the secret scan and test scaffold"
```

### Task 2: Identify the skill (`info`)

**Files:**
- Create: `skills/meta/report-skill-issue/scripts/skill_issue.py` (constants, `IssueError`, `SkillInfo`, `origin_matches`, `skill_info`, `main` with `info`)
- Modify: `skills/meta/report-skill-issue/tests/conftest.py`: add the fixtures `git_env`, `checkout` and `installed`, and the helper `git(cwd, *args) -> str`
- Test: `skills/meta/report-skill-issue/tests/test_info.py`

**Interfaces:**
- Consumes: `frontmatter.parse` (Task 1)
- Produces:
  - `SOURCE_REPO`, `ISSUES_REPO`
  - `class IssueError(Exception)`
  - `@dataclass(frozen=True) class SkillInfo`, with fields `name: str`, `path: str`, `commit: str`, `dirty: bool | None`, `branch: str`, `on_main: bool | None` and `source: str` (`"git"` or `"copy"`)
  - `origin_matches(url: str) -> bool`
  - `skill_info(skill_dir: Path, allow_copy: bool = False) -> SkillInfo`
  - `main(argv: list[str]) -> int`: `info` prints `json.dumps(dataclasses.asdict(info))`
- Fixtures:
  - `git_env` sets `GIT_CONFIG_GLOBAL` (an empty file), `GIT_CONFIG_NOSYSTEM=1`, and the author and committer name and email.
  - `checkout` makes `tmp_path/"skills-repo"`:
    - on branch `main`
    - with `skills/teaching/demo/SKILL.md` containing `"---\nname: demo\ndescription: Demo skill.\n---\n# Demo\n"`
    - with an origin of `https://github.com/ArrayaWongsaita/skills.git` and one commit
    - with `refs/remotes/origin/main` set by `git update-ref` to `HEAD`
  - `installed` is a symlink, `tmp_path/"installed"/"demo"`, pointing at the demo skill directory.

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run --no-project --python 3.12 --with pytest pytest skills/meta/report-skill-issue/tests -q`
Expected: `test_info.py` fails to import `skill_issue`.

- [ ] **Step 3: Implement `skill_info`, `origin_matches` and the `info` subcommand in `scripts/skill_issue.py`**

- **Directory:** resolve `skill_dir`, then run every git command with `git -C <resolved>`.
- **Repo path:** `path` is the resolved directory relative to `Path(<rev-parse --show-toplevel>).resolve()`, written with forward slashes.
- **Git checks:**
  - `dirty`: `git status --porcelain -- .` is non-empty. It counts untracked files.
  - `branch`: `git rev-parse --abbrev-ref HEAD`, with `HEAD` mapped to `"detached"`.
  - `on_main`: `None` when `git rev-parse --verify --quiet refs/remotes/origin/main` fails. Otherwise it is the result of `merge-base --is-ancestor HEAD origin/main`.
- **`origin_matches`:** match host `github.com`, owner `arrayawongsaita` and repo `skills` exactly, ignoring case. Accept the `https://`, `git@host:` and `ssh://git@host/` forms, with an optional `.git`.
- **Skill name:** taken from `frontmatter.parse`, falling back to the directory name.
- **Errors** (each an `IssueError`, so the CLI prints `error: <message>`):
  - no `SKILL.md`: `no SKILL.md in <dir>`
  - `git rev-parse --show-toplevel` fails and `allow_copy` is false: `<dir> is not a git checkout; if the user confirms it is a copy of a skill from ArrayaWongsaita/skills, pass --allow-copy`
  - an origin that does not match, or no origin: `<dir> comes from <origin URL or "a repo with no origin">, not ArrayaWongsaita/skills; only this repo's skills can be reported`

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run --no-project --python 3.12 --with pytest pytest skills/meta/report-skill-issue/tests -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add skills/meta/report-skill-issue
git commit -m "feat(report-skill-issue): identify the skill and the commit it ran from"
```

### Task 3: Render and write drafts (`draft`)

**Files:**
- Modify: `skills/meta/report-skill-issue/scripts/skill_issue.py`
- Modify: `skills/meta/report-skill-issue/tests/conftest.py`: add the constants `ENTRY` and `TODAY` shown at the top of the test below, so Task 4 can import them from `conftest` too
- Test: `skills/meta/report-skill-issue/tests/test_draft.py`

**Interfaces:**
- Consumes: `skill_info`, `SkillInfo` and `IssueError` (Task 2), and `scrub` (Task 1)
- Produces:
  - `KIND_LABELS = {"bug": "bug", "improvement": "enhancement", "docs": "documentation"}`
  - `REQUIRED_FIELDS = ("skill_dir", "kind", "title", "what_happened", "expected", "steps", "evidence", "harness")`
  - `DRAFT_TEMPLATE = "report-skill-issue/draft@1"`
  - `validate_entry(entry: dict) -> None`
  - `render(entry: dict, info: SkillInfo, today: str) -> tuple[str, str, list[str]]`, returning the title, body and labels
  - `drafts_dir() -> Path`, which is `Path(tempfile.gettempdir()) / "report-skill-issue"`
  - `make_draft(entry: dict, environ: Mapping[str, str], today: str | None = None) -> dict`, returning `{"draft", "sha256", "title", "labels", "redacted"}`
  - `@dataclass(frozen=True) class Draft(path: Path, repo: str, title: str, labels: list[str], body: str)`
  - `read_draft(path: Path) -> Draft`
  - `sha256_of(path: Path) -> str`
  - the `draft <entry.json | ->` subcommand

- [ ] **Step 1: Write the failing tests**

```python
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

# In conftest.py:
# ENTRY = {"kind": "bug", "title": "validate_deck counts the newline in Items", "what_happened": "A 2-item list failed the limit.",
#          "expected": "Each item is measured on its own.", "steps": ["Assemble the deck", "Run validate_deck.py"],
#          "evidence": [{"label": "validator output", "text": "error: 1-006: too long"}],
#          "suggested_fix": "Measure items without the newline.", "harness": "Claude Code", "model": "claude-opus-5-5"}
# TODAY = "2026-11-23"


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
             "evidence": [{"text": "key sk-proj-" + "b" * 40 + " at /Users/non/proj"}]}
    out = make_draft(leaky, {"HOME": "/Users/non"}, today=TODAY)
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run --no-project --python 3.12 --with pytest pytest skills/meta/report-skill-issue/tests -q`
Expected: `test_draft.py` fails to import `make_draft`.

- [ ] **Step 3: Implement `validate_entry`, `render`, `make_draft`, `read_draft`, `sha256_of` and the `draft` subcommand**

- **Body layout:** the Skill line, a blank line, the Reported line, a blank line, then the sections, with one blank line between blocks.
- **The Skill line** for a git install is `**Skill:** <name> · \`<path>\` @ <commit[:7]> (<parts>)`, where the parts, joined by `, `, are:
  1. `clean` when `dirty` is false, `uncommitted changes` when it is true
  2. `branch <branch>`, only when the branch is not `main`
  3. `on main`, `not on main`, or `main unknown` when `on_main` is `None`

  A copied install gives `**Skill:** <name> @ unknown (copied install)`.
- **The Reported line** is `**Reported:** <today> · <harness>`, followed by ` (<model>)` when the model is non-empty.
- **Evidence:** each item is an optional `**label**` paragraph, then a fence one backtick longer than the longest backtick run in the text (at least 3), using the item's `lang` if given.
- **`make_draft`:**
  1. `validate_entry`
  2. `skill_info(Path(entry["skill_dir"]), entry.get("allow_copy", False))`
  3. `render`
  4. `scrub` the title and the body
  5. create `drafts_dir()` with `parents=True, exist_ok=True`, then write the frontmatter and the body to `drafts_dir() / f"{%Y%m%d-%H%M%S}-{slug}.md"`
- **The file name:**
  - The slug comes from the entry's `title`, without the `[<skill>]` prefix. It is the runs of lowercase ASCII letters and digits, joined by `-`, cut to at most 40 characters. It is `issue` when empty.
  - When the name is taken, append `-2`, `-3` and so on.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run --no-project --python 3.12 --with pytest pytest skills/meta/report-skill-issue/tests -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add skills/meta/report-skill-issue
git commit -m "feat(report-skill-issue): render and write scrubbed issue drafts"
```

### Task 4: Similar issues and posting (`similar`, `post`)

**Files:**
- Modify: `skills/meta/report-skill-issue/scripts/skill_issue.py`
- Modify: `skills/meta/report-skill-issue/tests/conftest.py`: add the `fake_gh` fixture
- Test: `skills/meta/report-skill-issue/tests/test_gh.py`

**Interfaces:**
- Consumes: `read_draft`, `sha256_of`, `make_draft` and `ISSUES_REPO` (Tasks 2–3), and `scan` (Task 1)
- Produces:
  - `run_gh(args: list[str], stdin: str | None = None) -> str`, returning stdout. It raises `IssueError("gh is not installed: https://cli.github.com")` when `shutil.which("gh")` is `None`, and `IssueError(f"gh {args[0]} {args[1]} failed: <stderr>")` on a non-zero exit. When `stdin` is `None` it passes `stdin=subprocess.DEVNULL`, so neither the fake nor a real `gh` waits on the terminal.
  - `similar(skill: str, words: str) -> list[dict]`, returning `[{number, title, state, url}]` with `state` lowercased, open issues first, otherwise in gh's order. It runs only `issue list … --limit 20` (no `auth status`), and empty stdout means `[]`.
  - `post(draft_path: Path, sha: str, environ: Mapping[str, str], comment: int | None = None) -> str`, returning the URL from the last non-empty line of gh's stdout.
  - the `similar <skill> <words…>` and `post <draft> --sha <hex> [--comment N]` subcommands. On an error after the hash check, the CLI adds `; the draft is kept at <path>`.
- The `fake_gh(tmp_path, monkeypatch)` fixture:
  - It writes `tmp_path/"bin"/"gh"` with shebang `#!{sys.executable}` and prepends it to `PATH`.
  - Each call is appended to `$FAKE_GH_LOG` as JSON `{"args": argv[1:], "stdin": <stdin text>}`.
  - It answers with the first rule in `$FAKE_GH_RULES` whose `match` list is a prefix of the args. The default answer is exit 0 with empty stdout.
  - Its methods are `rule(match: list[str], stdout="", stderr="", code=0)` and `calls() -> list[dict]`.

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run --no-project --python 3.12 --with pytest pytest skills/meta/report-skill-issue/tests -q`
Expected: `test_gh.py` fails to import `post` and `similar`, and the `fake_gh` fixture is not found.

- [ ] **Step 3: Implement `run_gh`, `similar`, `post` and their subcommands**

`post` runs in this order:
1. Check the hash.
2. Read the draft, then `scan` the title and the body with `environ`.
3. Run `gh auth status`. A failure becomes the "not logged in" error.
4. **Comment mode:** run `issue comment`.
5. **New issue:**
   - run `label list -R … --json name --limit 200`; empty stdout means no labels
   - run `label create` for each missing label, in the draft's label order
   - run `issue create`

The CLI passes `os.environ` as `environ`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run --no-project --python 3.12 --with pytest pytest skills/meta/report-skill-issue/tests -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add skills/meta/report-skill-issue
git commit -m "feat(report-skill-issue): find similar issues and post approved drafts"
```

### Task 5: The coordinator `SKILL.md` and the acceptance checklist

**Files:**
- Create: `skills/meta/report-skill-issue/SKILL.md`
- Create: `skills/meta/report-skill-issue/evals/acceptance.md`
- Test: `skills/meta/report-skill-issue/tests/test_skill_md.py`

**Interfaces:**
- Consumes: the four subcommands (Tasks 2–4), and `validate_entry` (Task 3)
- Produces: the procedure the agent follows, and the skill's own hook section
- `SKILL.md` covers:
  - frontmatter `name: report-skill-issue`, and a description of at most 1024 characters that names `skills-issues`
    - when to use it: a problem with a skill from `ArrayaWongsaita/skills`, the user asking for a report, or a skill's reporting section offering one
    - when not to: other repos' skills, or bugs in the user's own project
  - the seven steps of spec 5.4, with exact `python3 <skill>/scripts/skill_issue.py …` commands
  - how to find `<skill_dir>`: the base directory the harness showed when it loaded the reported skill
  - that installs should point at a checkout that stays on `main` (spec 5.2), and what the user should do when `similar` finds a closed match
  - a section `## The entry` holding one example entry in a ```` ```json ```` block
  - the approval rule
  - after posting, adding ` → <issue URL>` to the lines it covered in `skill-problems.md`
  - on failure, giving the reason and the draft path
  - its own `## Reporting problems with this skill` section: a problem with this skill goes in the final report, because this skill is the reporter

- [ ] **Step 1: Write the failing tests**

```python
import json
import re

import pytest

import frontmatter
from skill_issue import validate_entry


@pytest.fixture
def skill_md(skill_dir):
    return (skill_dir / "SKILL.md").read_text(encoding="utf-8")


def test_frontmatter(skill_dir, skill_md):
    data, _ = frontmatter.parse(skill_md)
    assert data["name"] == "report-skill-issue" == skill_dir.name
    assert 0 < len(data["description"]) <= 1024 and "skills-issues" in data["description"]


@pytest.mark.parametrize("needle", ["skill_issue.py info", "skill_issue.py similar", "skill_issue.py draft",
                                    "skill_issue.py post", "--sha", "--comment", "--allow-copy", "skill-problems.md"])
def test_mentions_every_command(skill_md, needle):
    assert needle in skill_md


def test_approval_rule(skill_md):
    assert "Never run `post` before the user approves the exact draft" in skill_md


def test_entry_example_is_valid(skill_md):
    section = skill_md.split("## The entry", 1)[1]
    validate_entry(json.loads(re.search(r"```json\n(.*?)\n```", section, re.S).group(1)))


def test_has_its_own_hook(skill_md):
    assert "## Reporting problems with this skill" in skill_md


def test_acceptance_lists_the_checks(skill_dir):
    text = (skill_dir / "evals" / "acceptance.md").read_text(encoding="utf-8")
    assert [n for n in ("fake gh", "skills-issues", "Closes ArrayaWongsaita/skills-issues#") if n not in text] == []
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run --no-project --python 3.12 --with pytest pytest skills/meta/report-skill-issue/tests -q`
Expected: `test_skill_md.py` errors with `FileNotFoundError` for `SKILL.md`.

- [ ] **Step 3: Write `SKILL.md` and `evals/acceptance.md`**

The acceptance checklist mirrors spec §7:
- a table of the automated checks, naming their test files (run with a fake gh)
- the manual recipe: a real run proposes a report, the user approves it, the issue lands in `skills-issues`, and a fix PR in this repo uses `Closes ArrayaWongsaita/skills-issues#<n>` and carries no private detail

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run --no-project --python 3.12 --with pytest pytest skills/meta/report-skill-issue/tests -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add skills/meta/report-skill-issue
git commit -m "feat(report-skill-issue): add the coordinator SKILL.md and acceptance checklist"
```

### Task 6: The reporting hook in course-research and slide-design

**Files:**
- Test (create): `skills/meta/report-skill-issue/tests/test_repo_hooks.py`
- Modify `skills/teaching/course-research/`:
  - `SKILL.md`: add the hook section
  - `references/researcher.md` and `references/part-writer.md`: add the reply line
  - `references/consistency-review.md`: add the `skill |` row
  - `tests/test_references.py` and `tests/test_skill_md.py`: add tests
- Modify `skills/teaching/slide-design/`:
  - `SKILL.md`: add the hook section
  - `references/section-writer.md` and `references/learner-review.md`: add the reply line
  - `tests/test_references.py` and `tests/test_skill_md.py`: add tests

**Interfaces:**
- Consumes: the hook heading and the formats from Global Constraints
- Produces: the canonical hook text, which Task 7 copies into `AGENTS.md`. It is the same in both skills; only `<problems file>` differs:

```markdown
## Reporting problems with this skill

When something in this skill goes wrong or does not fit (a script error, a validator error that was wrong, a brief that misled a subagent, a limit or rule that did not fit real content), append one line to `<problems file>` as soon as you see it:

`- <bug|improvement|docs> · <what happened> · <where: the script, brief or rule> · <stage>`

A subagent's `Skill problem:` line goes in too. On resume, read the file first. At the end of the run, if any line is not yet reported, offer once to report them with the `report-skill-issue` skill, or at once if a problem stops the run. After a report, add ` → <issue URL>` to each line it covered. If `report-skill-issue` is not installed, list the open lines in your final report instead.
```

The subagent reply line, added to the reply list of each of the four reply-style briefs:

```markdown
- `Skill problem: <what got in the way, and where>`, one line each, only when this brief, a script or a template got in your way
```

The row added to `consistency-review.md`'s Report section:

```markdown
A problem with this brief or a script, not with the course, goes on its own row: `skill | <brief or script> | <problem> | <suggested fix>`.
```

- [ ] **Step 1: Write the failing tests**

`skills/meta/report-skill-issue/tests/test_repo_hooks.py`:

```python
HOOK = "## Reporting problems with this skill"


def test_every_skill_has_the_reporting_hook(skill_dir):
    skills_root = skill_dir.parents[1]
    found = sorted(skills_root.glob("*/*/SKILL.md"))
    assert len(found) >= 3
    assert [str(p.relative_to(skills_root)) for p in found if HOOK not in p.read_text(encoding="utf-8")] == []
```

Append to `skills/teaching/slide-design/tests/test_references.py`:

```python
@pytest.mark.parametrize("brief", ["section-writer.md", "learner-review.md"])
def test_briefs_let_subagents_report_skill_problems(skill_dir, brief):
    assert "Skill problem:" in read(skill_dir, brief)
```

Append to `skills/teaching/slide-design/tests/test_skill_md.py`:

```python
def test_reporting_hook(skill_md):
    section = skill_md.split("## Reporting problems with this skill", 1)[1]
    assert "<work>/skill-problems.md" in section and "report-skill-issue" in section and "Skill problem:" in section
```

Append to `skills/teaching/course-research/tests/test_references.py`, which already has the `read(skill_dir, name)` helper:

```python
@pytest.mark.parametrize("brief", ["researcher.md", "part-writer.md"])
def test_briefs_let_subagents_report_skill_problems(skill_dir, brief):
    assert "Skill problem:" in read(skill_dir, brief)


def test_consistency_review_has_a_skill_row(skill_dir):
    assert "skill | <brief or script> | <problem> | <suggested fix>" in read(skill_dir, "consistency-review.md")
```

Append to `skills/teaching/course-research/tests/test_skill_md.py`, which already has the `skill_md` fixture:

```python
def test_reporting_hook(skill_md):
    section = skill_md.split("## Reporting problems with this skill", 1)[1]
    assert "<course_dir>/_work/skill-problems.md" in section and "report-skill-issue" in section and "Skill problem:" in section
```

- [ ] **Step 2: Run the tests to verify they fail**

Run each of the three test commands in Global Constraints.
Expected:
- `test_every_skill_has_the_reporting_hook` lists `teaching/course-research/SKILL.md` and `teaching/slide-design/SKILL.md`
- the new brief tests and hook tests in both skills fail
- every other test passes

- [ ] **Step 3: Add the hook sections, the reply lines and the row**

- **Placement in `SKILL.md`:** the hook goes before the final `## References` section. Use `<course_dir>/_work/skill-problems.md` in course-research and `<work>/skill-problems.md` in slide-design.
- **In course-research:** the hook text is enough. Its stages have no list of writer requests to extend.
- **In slide-design:** also add a bullet to Stage 3's "Act on what writers need" list: `- **A skill problem:** append the writer's \`Skill problem:\` line to \`<work>/skill-problems.md\`.`

- [ ] **Step 4: Run the tests to verify they pass**

Run all three test commands.
Expected: all pass in each.

- [ ] **Step 5: Commit**

```bash
git add skills/meta/report-skill-issue/tests/test_repo_hooks.py skills/teaching/course-research skills/teaching/slide-design
git commit -m "feat(skills): add the problem-reporting hook to course-research and slide-design"
```

### Task 7: `AGENTS.md` and `CLAUDE.md` at the repo root

**Files:**
- Create: `AGENTS.md`, `CLAUDE.md`
- Test: `skills/meta/report-skill-issue/tests/test_agents_md.py`

**Interfaces:**
- Consumes: the canonical hook text (Task 6), and the test commands (Global Constraints)
- Produces: the fixing workflow of spec 5.9. `AGENTS.md` has these sections:
  - **Layout:** `skills/<category>/<name>/` and what each skill folder holds.
  - **Tests:** the three test commands, verbatim.
  - **A new skill:** it must include the hook, with the canonical text.
  - **Fixing an issue from `skills-issues`:**
    1. `gh issue view <n> -R ArrayaWongsaita/skills-issues`
    2. Work against `main`.
    3. Reproduce the problem as a failing test.
       - If it cannot be reproduced, create the `needs-info` label on first use with `gh label create needs-info -R ArrayaWongsaita/skills-issues`.
       - Then run `gh issue edit <n> -R ArrayaWongsaita/skills-issues --add-label needs-info`, add a comment, and stop.
    4. Fix it on a branch named `fix/<skill>-<slug>`.
    5. Open a PR whose description says `Closes ArrayaWongsaita/skills-issues#<n>`.
    6. Run `gh issue comment <n> -R ArrayaWongsaita/skills-issues --body "Fix: <PR URL>"`.
    7. After the merge, if the issue is still open, run `gh issue close <n> -R ArrayaWongsaita/skills-issues --comment "Fixed in <PR URL>"`.
  - **The privacy rule**, verbatim: `This repo is public: never copy an issue's paths, logs, course content or project code into a commit, a PR or a test fixture.`
- `CLAUDE.md` is exactly `@AGENTS.md\n`.

- [ ] **Step 1: Write the failing tests**

```python
import pytest

PRIVACY = "This repo is public: never copy an issue's paths, logs, course content or project code into a commit, a PR or a test fixture."


@pytest.fixture
def root(skill_dir):
    return skill_dir.parents[2]


@pytest.fixture
def agents_md(root):
    return (root / "AGENTS.md").read_text(encoding="utf-8")


def test_claude_md_imports_agents_md(root):
    assert (root / "CLAUDE.md").read_text(encoding="utf-8") == "@AGENTS.md\n"


@pytest.mark.parametrize("needle", ["gh issue view <n> -R ArrayaWongsaita/skills-issues", "Closes ArrayaWongsaita/skills-issues#<n>",
                                    "fix/<skill>-<slug>", "needs-info", "gh issue close <n> -R ArrayaWongsaita/skills-issues",
                                    "## Reporting problems with this skill", "skill-problems.md", PRIVACY])
def test_agents_md_covers_the_fixing_workflow(agents_md, needle):
    assert needle in agents_md


def test_agents_md_lists_every_skill_test_command(root, agents_md):
    suites = [p.parent.relative_to(root).as_posix() for p in root.glob("skills/*/*/tests")]
    assert suites and [s for s in suites if f"pytest {s}/tests" not in agents_md] == []
```

Note that `p.parent` is the skill folder, so the needle is `pytest skills/<cat>/<name>/tests`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run --no-project --python 3.12 --with pytest pytest skills/meta/report-skill-issue/tests -q`
Expected: `test_agents_md.py` fails with `FileNotFoundError` for `CLAUDE.md` and `AGENTS.md`.

- [ ] **Step 3: Write `AGENTS.md` and `CLAUDE.md`**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run --no-project --python 3.12 --with pytest pytest skills/meta/report-skill-issue/tests -q`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md CLAUDE.md skills/meta/report-skill-issue/tests/test_agents_md.py
git commit -m "docs(repo): add AGENTS.md with the skill layout and the issue-fixing workflow"
```

### Task 8: Create the private issues repo and check access

The design approval covers creating this repo (spec 5.10). Do not post a test issue: the first real issue comes from the manual acceptance run.

- [ ] **Step 1: Check that the repo does not exist yet**

Run: `gh repo view ArrayaWongsaita/skills-issues --json visibility`
Expected: an error, `Could not resolve to a Repository`. If the repo exists and is `PRIVATE`, skip Step 2.

- [ ] **Step 2: Create it**

Run: `gh repo create ArrayaWongsaita/skills-issues --private --description "Problems agents report against the skills in ArrayaWongsaita/skills"`
Expected: it prints `https://github.com/ArrayaWongsaita/skills-issues`.

- [ ] **Step 3: Check its visibility and that the CLI can read it**

Run:
- `gh repo view ArrayaWongsaita/skills-issues --json visibility --jq .visibility`
- `python3 skills/meta/report-skill-issue/scripts/skill_issue.py similar slide-design "anything"`
- `python3 skills/meta/report-skill-issue/scripts/skill_issue.py info skills/teaching/slide-design`

Expected:
- `PRIVATE`
- `[]` with exit 0
- JSON with `"name": "slide-design"` and `"source": "git"`

No commit.
