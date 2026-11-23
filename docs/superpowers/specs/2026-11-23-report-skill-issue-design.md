# Design: `report-skill-issue` skill

- Date: 2026-11-23
- Status: Approved 2026-11-23
- Location of the skill: `skills/meta/report-skill-issue/` (my call: `meta` is for skills about this repo's skills)
- Issue tracker: a new private repository, `ArrayaWongsaita/skills-issues`
- Touches:
  - the `SKILL.md` of `course-research` and `slide-design`
  - their subagent briefs (one optional report line each, 5.3)
  - a new `AGENTS.md` and `CLAUDE.md` at the repo root

## 1. Intent

The user runs skills from this repository (`ArrayaWongsaita/skills`) in other projects. Today these are `course-research` and `slide-design`, and more will follow. During a real run, the agent is the first to see what is wrong with a skill:
- a script error
- a validator that reports an error that isn't one
- a brief that leads a subagent the wrong way
- a length limit that doesn't fit real content

Today that knowledge is lost when the run ends, unless the user remembers it.

This skill lets the agent turn those observations into issues, so the skills can be fixed later from a precise record. A second piece, instructions at the root of this repo, tells an agent working here how to pick up an issue and fix it.

### What the user decided in the brainstorm

- **When an issue is written:** the agent notices problems itself during a run and proposes reports. Nothing is filed until the user approves. The user can also ask for a report at any time.
- **Where issues go:** a new **private** repository, `skills-issues`, not this public repo. This was the user's idea. It keeps paths, logs and course content private, so issues can carry the full evidence a fixer needs.
- **How it is built:** a `SKILL.md` plus small, tested stdlib Python scripts (approach B, below).
- **How issues get fixed:** fixing instructions live in this repo's root instructions file (`AGENTS.md`), not in a second skill.
- **Approved playback:**
  - problems are collected during the run and proposed once at the end, except one that blocks the run, which is proposed at once
  - the issue text is English and the conversation is in the user's language
  - the draft the user sees is exactly what gets posted
  - duplicates are checked first, and a duplicate becomes a comment on the existing issue
  - an issue carries enough for a fixer who cannot ask the reporter anything

### What success looks like

- After a real run of `slide-design`, the user approves one prompt. Each problem the run hit becomes one well-formed issue in `skills-issues`, labelled with its skill and kind, and tied to the exact commit of the skill that ran.
- An agent in this repo, told "fix skills-issues#3", reproduces the problem with a failing test, fixes it, and opens a public PR that closes the private issue. The PR carries none of the issue's private details.
- No secret ever reaches an issue.

## 2. Goals, non-goals, anti-goals

### Goals

- A skill any agent can follow, in any project, to report a problem with one of this repo's skills.
- A short hook in each of this repo's skills that tells the coordinator to keep a list of problems and offer the report.
- A deterministic secret scan before anything is posted.
- What is posted is byte-for-byte what the user approved.
- Duplicate detection against open issues for the same skill.
- Fixing instructions in this repo, so the issues get acted on in a consistent way.

### Non-goals

- Reporting problems with skills from other repositories. Such a skill is refused, with a message saying so.
- Filing anything without the user's approval.
- A fixing skill, triage automation, GitHub Actions, or issue forms.
- A general-purpose bug tracker for the user's projects.

### Anti-goals (failure even if everything "runs")

- A key, token or password ends up in an issue.
- Private details from an issue (paths, logs, course content, project code) end up in this public repo, through a PR, a commit message or a test fixture.
- The agent interrupts a run with report prompts again and again.
- Many issues for the same problem.
- An issue a fixer cannot act on: no version, no reproduction steps, no evidence.

## 3. Constraints

- Python scripts are stdlib only and run on python3 ≥ 3.11, as in `course-research` and `slide-design`. Each script puts its own directory on `sys.path`.
- Posting needs the GitHub CLI (`gh`), logged in with access to `ArrayaWongsaita/skills-issues`. Without it the skill still writes the draft and tells the user where it is.
- Skills are normally installed as symlinks from `~/.claude/skills/<name>` into a checkout of this repo. A copied install (no git) must still work, with the version recorded as unknown.
- Repository-facing text (issue bodies, `AGENTS.md`, code, commits) is in English. The agent talks to the user in the user's language.
- Tests never call GitHub. They use a fake `gh` executable on `PATH`.

## 4. Approaches considered

| | Approach | Trade-off | Verdict |
|---|---|---|---|
| A | `SKILL.md` only; the agent runs `gh` itself | Smallest. But the secret scan depends on the agent remembering every rule, nothing is testable, and nothing guarantees the posted text equals the approved draft. | Rejected |
| **B** | **`SKILL.md` plus a tested stdlib script that drafts, scans and posts** | More to build. The scan and the "post what was approved" guarantee are code with tests, and the script matches the repo's existing skills. | **Chosen** |
| C | GitHub issue templates plus a thin `SKILL.md` | Gives web users the same structure, but has A's weaknesses. | Rejected |

Two choices about where the issues go:
- **Issues in this public repo with strict redaction** of paths, names and content was the first proposal. It was dropped for the user's private-repo idea: with a private repo, redaction shrinks to secrets only (plus `~` for the home path, for readability), and issues can keep the evidence a fixer needs.
- **A fixing skill** was weighed against instructions in `AGENTS.md`. Fixing always happens in this repo and the general method (TDD, review, PR) already comes from the user's other skills, so a repo instructions file is enough.

## 5. The design (decided)

### 5.1 Pieces

```
skills/meta/report-skill-issue/
  SKILL.md                 # the procedure the agent follows
  scripts/
    skill_issue.py         # CLI: info | draft | similar | post
    secrets_scan.py        # the secret patterns and the scan
  tests/                   # pytest, with a fake gh and temporary git repos
  evals/acceptance.md
AGENTS.md                  # repo instructions: layout, test commands, fixing skill issues, the hook convention
CLAUDE.md                  # one line: @AGENTS.md (my call, so Claude Code and other agents read the same file)
```

The file split inside `scripts/` is left to the builder. One CLI with subcommands mirrors `deck_state.py`.

### 5.2 Which skills can be reported

`skill_issue.py info <skill_dir>` resolves the directory (following symlinks) and prints JSON:
- `name`: from the skill's frontmatter
- `path`: the skill's path inside the repo, such as `skills/teaching/slide-design`
- `commit`: the checkout's `HEAD`
- `dirty`: true when the skill directory has uncommitted changes
- `branch`: the checked-out branch, or `detached`
- `on_main`: whether `commit` is reachable from the local `origin/main` ref (`unknown` when that ref is missing). It is read without fetching.

A report from a branch or an unpushed commit is filed as usual. The issue's `Skill` line shows the branch and `not on main`, so the fixer knows the code may differ from `main`. Installs should point at a checkout that stays on `main`: a development checkout that switches branches changes which code runs.

The skill counts as this repo's when the checkout's `origin` URL points at `ArrayaWongsaita/skills`, in its HTTPS or SSH form. Otherwise:
- **A git checkout of another repo:** refused, with the remote named.
- **Not a git checkout (a copied install):** allowed only if the user confirms the skill is from this repo. The version is recorded as `unknown`.

The agent finds `<skill_dir>` from the skill's base directory, which the harness shows when it loads the skill.

### 5.3 The hook in each skill

Each skill in this repo gets a short section, `## Reporting problems with this skill`, which says:
- **What to note:** anything in this skill that went wrong or did not fit. That means a script error, a validator error that was wrong, a brief that misled a subagent, or a limit or rule that did not fit real content.
- **Where to note it:** on disk, not only in memory, because runs are resumed across sessions (my call). When a problem is seen, append one entry to `skill-problems.md` in the run's work folder:
  - `course-research`: `<course_dir>/_work/skill-problems.md`
  - `slide-design`: `<course_dir>/slides/_work/part-NN/skill-problems.md`
  - a skill without a work folder keeps the list in the conversation
  - a resumed run reads the file first
- **Subagents report too.** Each subagent brief gains one optional line in its reply: `Skill problem: <what got in the way, and where>` (my call). The coordinator appends these to the file.
  - `consistency-review.md` replies only in pipe rows, so it gains a row form instead: `skill | <brief or script> | <problem> | <suggested fix>`.
  - No script parses these replies; the coordinator reads them.
- **When to offer:** at the end of the run, if the list has entries not yet reported, offer to report them with `report-skill-issue`, in one prompt. A problem that stops the run is offered at once.
- **After a report:** each entry is marked with its issue URL, so a resumed run does not offer it again.
- **Without `report-skill-issue`:** if it is not installed, list the problems in the final report instead.

`AGENTS.md` makes this section part of every new skill. A test in `report-skill-issue` checks that every `skills/*/*/SKILL.md` in the repo has it, including `report-skill-issue`'s own (my call: it keeps the convention from being forgotten).

### 5.4 The procedure in `SKILL.md`

1. **Collect.** One entry per distinct problem: the skill, its kind (`bug`, `improvement` or `docs`), what happened, what was expected, steps to reproduce, evidence (error text, the command run, a minimal excerpt of the input), and a suggested fix if the agent has one.
2. **Identify the skill:** `info`.
3. **Look for duplicates:** `similar <skill> "<title words>"` lists matching issues with the skill's label: open ones first, then closed ones, marked closed.
   - An open match: the agent proposes a comment on that issue instead of a new one.
   - A closed match: the problem may already be fixed on `main` after the commit that ran. The agent tells the user, who may only need to update their checkout. If the problem persists on `main`, file a new issue that links the closed one.
4. **Draft:** `draft <entry.json>` checks the entry, renders the issue, runs the secret scan, and writes the draft to a file. It prints the path, a SHA-256 of the draft, and what the scan redacted.
5. **Ask once.** Show every draft in full, with a one-line summary per draft in the user's language and a note of anything redacted. The user can approve, edit or drop each. An edit means a new `draft` and a new preview.
6. **Post:** `post <draft> --sha <sha> [--comment <issue number>]`. It refuses when the file's hash differs from the approved one. It scans again, creates the labels it needs, files the issue or comment with `gh`, and prints the URL.
7. **Report back:** the URLs. If posting failed, give the reason and the draft paths.

### 5.5 The issue

Title: `[<skill>] <summary>`. Labels: the kind (`bug`, `enhancement`, `documentation`) and `skill:<name>`. The body sections come in this order:

```markdown
**Skill:** slide-design · `skills/teaching/slide-design` @ b00e220 (clean, on main)
**Reported:** 2026-11-23 · Claude Code (claude-opus-5-5)

## What happened
## Expected
## Steps to reproduce
## Evidence
## Suggested fix
```

- Steps to reproduce are a numbered list.
- Evidence goes in fenced blocks, with a fence longer than any backtick run inside.
- `Suggested fix` is omitted when empty.
- The harness and model come from the entry. They help a fixer tell skill problems from model problems.

### 5.6 The secret scan

The scan runs on the title and the body, at `draft` and again at `post`.
- **Known token shapes** are replaced with `[REDACTED:<kind>]`:
  - OpenAI and Anthropic keys
  - GitHub tokens (`ghp_`, `gho_`, `ghs_`, `ghu_`, `ghr_`, `github_pat_`)
  - AWS access key ids (`AKIA…`, `ASIA…`)
  - Google API keys (`AIza…`)
  - Slack tokens (`xox…`)
  - private key blocks
  - JWTs
  - `Bearer` tokens
  - `key/secret/token/password = <value>` assignments
- **The reporter's own secret values.** The exact value of every environment variable whose name contains `KEY`, `TOKEN`, `SECRET`, `PASSWORD` or `CREDENTIAL` is redacted too, when it is at least 8 characters long. This catches formats the patterns miss.
- **The home path** becomes `~`.

`post` refuses a draft that still matches a secret pattern. Exact patterns are left to the builder, each with a test.

### 5.7 Drafts on disk

Drafts go under the system temp directory, in `report-skill-issue/<timestamp>-<slug>.md` (my call). They are not left in the user's project, and they survive for retry if posting fails. Nothing else is stored.

### 5.8 Failure handling

- `gh` missing, not logged in, or without access to `skills-issues`: a clear message (`gh auth login`, or the access problem), exit 1, and the draft is kept.
- An entry with missing required fields (what happened, steps, evidence): `draft` refuses and lists the fields.
- A skill not from this repo: `info` and `draft` refuse.

### 5.9 Fixing issues: `AGENTS.md`

The repo's root instructions cover:
- **The layout:** `skills/<category>/<name>/`, each with `SKILL.md`, `references/`, `scripts/`, `tests/` and `evals/`. They also give each skill's test command.
- **The hook convention** from 5.3, for every new skill.
- **Fixing an issue from `skills-issues`:**
  1. Read it with `gh issue view <n> -R ArrayaWongsaita/skills-issues`.
  2. Work against `main`, wherever the reported commit is. The issue's `Skill` line says if it came from a branch.
  3. Reproduce the problem as a failing test in the skill's tests. If it cannot be reproduced on `main`, comment asking for what is missing, add a `needs-info` label (create it on first use), and stop.
  4. Fix it, and run the skill's test command.
  5. Open a PR to `main` from `fix/<skill>-<slug>` whose description says `Closes ArrayaWongsaita/skills-issues#<n>`.
  6. Comment on the issue with the PR link.
- **The privacy rule:** this repo is public. Never copy an issue's paths, logs, course content or project code into a commit, a PR, or a test fixture. Write a minimal, made-up reproduction instead.

Whether GitHub's closing keyword closes an issue in a private repo from a public repo's PR is checked in the acceptance run. If it does not, step 6 also closes the issue with `gh issue close`.

### 5.10 The private repository

`ArrayaWongsaita/skills-issues` is created private with `gh repo create` once this design is approved. It keeps GitHub's default labels; `skill:<name>` labels are created by `post` on first use. It needs no other setup.

## 6. Left to the builder

- The exact secret patterns, and label colours.
- Flag names, the entry JSON schema details, and the file split inside `scripts/`.
- How `similar` matches: `gh issue list --search` with the skill's label is the expected route.
- The wording of the hook section and of `AGENTS.md`, within 5.3 and 5.9.
- The test fixtures: a fake `gh` that records its arguments and returns canned JSON, and temporary git repos with a set `origin`.

## 7. Acceptance checks for the first build

1. **Automated** (pytest, no network):
   - `info` gives the name, path, commit, dirty state, branch and `on_main` for a symlinked skill in a temporary checkout with an `origin` of this repo. It refuses another repo's checkout.
   - `draft` renders the sections and labels, refuses an entry with missing fields, and redacts each secret kind, the reporter's own secret values, and the home path.
   - `post` sends exactly the draft through the fake `gh`, creates a missing `skill:` label, refuses a changed hash and a remaining secret, keeps the draft when `gh` fails, and posts a comment in comment mode.
   - `similar` passes the skill's label and the search words to `gh`, and lists closed matches after open ones.
   - Every `skills/*/*/SKILL.md` has the hook section.
   - Every subagent brief of `course-research` and `slide-design` has the `Skill problem:` line (the `skill |` row in `consistency-review.md`).
2. **Manual:**
   - Create `skills-issues`.
   - During a real `slide-design` or `course-research` run, let the agent propose a report, approve it, and check the issue in the private repo.
   - Then fix it from this repo following `AGENTS.md`, and check that the PR closes the issue and contains no private detail from it.
