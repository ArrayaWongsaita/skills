---
name: report-skill-issue
description: Use when a skill from the ArrayaWongsaita/skills repository (such as course-research or slide-design) went wrong or did not fit during a run, when the user asks to report a problem with one of those skills, or when a skill's "Reporting problems with this skill" section offers a report. It drafts one issue per problem, redacts secrets, checks for duplicates, shows the drafts to the user, and files only what the user approves in the private ArrayaWongsaita/skills-issues repository. Do not use for skills from other repositories, or for bugs in the user's own project.
---

# Report a skill issue

You turn the problems met while running a skill from `ArrayaWongsaita/skills` into issues in the private repository `ArrayaWongsaita/skills-issues`, so the skill can be fixed later by someone who cannot ask you anything. Talk with the user in their language. The issue text is English.

In the commands below:
- `<skill>` is this skill's base directory.
- `<skill_dir>` is the base directory of the skill being reported. The harness showed it when it loaded that skill.

Run the scripts with `python3` (3.11 or later). Posting needs the GitHub CLI `gh`, logged in with access to `ArrayaWongsaita/skills-issues`.

**Never run `post` before the user approves the exact draft.** What they approve is posted byte for byte: `post` checks the draft's SHA-256 against the one you showed them.

## The procedure

1. **Collect.** Write one entry per distinct problem, as in [The entry](#the-entry). The problems come from:
   - the lines of the run's `skill-problems.md` that are not yet marked with ` → <issue URL>`
   - what you saw yourself
   - what the user tells you

   Merge lines about the same problem. Give each entry what a fixer needs:
   - what happened
   - what you expected
   - numbered steps to reproduce
   - the evidence: the error text, the command you ran, a minimal excerpt of the input
   - a suggested fix, if you have one

2. **Identify the skill.**

   ```
   python3 <skill>/scripts/skill_issue.py info <skill_dir>
   ```

   It prints the skill's name, its path in the repo, the commit, whether the skill folder has uncommitted changes, the branch, and whether the commit is on `main`.
   - **A skill from another repository** is refused. Tell the user it can't be reported here.
   - **A folder that is not a git checkout of this repo** (a copied install): ask the user whether it is a copy of a skill from `ArrayaWongsaita/skills`. Only if they confirm, set `"allow_copy": true` in the entry. `info <skill_dir> --allow-copy` shows the result, and the version is recorded as unknown.
   - **A `branch` other than `main`, or `on_main` false:** the code that ran may differ from `main`. File the issue as usual; its Skill line says so. Tell the user that installs should point at a checkout that stays on `main`.

3. **Look for duplicates.** For each entry:

   ```
   python3 <skill>/scripts/skill_issue.py similar <name> <a few words from the title>
   ```

   It lists the issues with the skill's label that match: open ones first, then closed ones.
   - **An open match for the same problem:** propose a comment on that issue instead of a new one. Use step 6 with `--comment <number>`, drafted from the same entry, so the new run's evidence is added there.
   - **A closed match:** the problem may already be fixed on `main` after the commit that ran. Tell the user. Updating their checkout of `main` may be all they need. If the problem persists on `main`, file a new issue that links the closed one in `what_happened`.

4. **Draft.**

   ```
   python3 <skill>/scripts/skill_issue.py draft <entry.json>
   ```

   Use `draft -` to pass the entry on stdin instead. Keep entry files out of the user's project.

   `draft` does the following:
   - checks the entry and renders the issue
   - redacts secrets: known key and token shapes, `password = …` style assignments, and the values of your own secret environment variables
   - replaces the home path with `~`
   - writes the draft under the system temp folder

   It prints `draft` (the path), `sha256`, `title`, `labels` and `redacted`.

5. **Ask once.** Send one message that covers, for each draft:
   - a one-line summary in the user's language
   - whether it is a new issue or a comment on issue #N
   - anything that was redacted
   - the draft file's full text

   The user can approve, edit or drop each draft. An edit means a new entry, a new `draft` and a new preview. Never edit a draft file by hand.

6. **Post** each approved draft, with the SHA-256 that `draft` printed for it:

   ```
   python3 <skill>/scripts/skill_issue.py post <draft> --sha <sha256>
   python3 <skill>/scripts/skill_issue.py post <draft> --sha <sha256> --comment <issue number>
   ```

   `post` does the following:
   - refuses a draft whose hash changed, or that still holds a secret
   - creates the labels it needs: the kind label and `skill:<name>`
   - files the issue or the comment with `gh`
   - prints the URL

7. **Report back.**
   - Give the user the URLs.
   - In the run's `skill-problems.md`, add ` → <issue URL>` to each line that the issue covers, so a resumed run does not offer it again.
   - If posting failed, give the reason and the draft path. The draft is kept, and `post` can run again once the cause is fixed.

## The entry

```json
{
  "skill_dir": "~/.claude/skills/slide-design",
  "kind": "bug",
  "title": "validate_deck counts the newline between Items bullets toward the length limit",
  "what_happened": "validate_deck.py reported slide 1-006 as too long, although each bullet was under the limit. The count included the newlines between bullets.",
  "expected": "Each Items bullet is measured on its own.",
  "steps": ["Assemble the deck for Part 1", "Run validate_deck.py <course_dir> 1"],
  "evidence": [{"label": "validator output", "text": "error: 1-006: Items too long", "lang": "text"}],
  "suggested_fix": "Measure each bullet separately in validate_deck.py.",
  "harness": "Claude Code",
  "model": "claude-opus-5-5"
}
```

**Required fields:**

| Field | What goes in it |
|---|---|
| `skill_dir` | the reported skill's base directory |
| `kind` | `bug`, `improvement` or `docs`. It becomes the label `bug`, `enhancement` or `documentation`. |
| `title` | the summary, without a `[skill]` prefix (`draft` adds it) |
| `what_happened` | what went wrong |
| `expected` | what you expected instead |
| `steps` | a non-empty list of steps to reproduce |
| `evidence` | a non-empty list of `{"label"?, "text", "lang"?}` objects. Each `text` becomes a fenced block. |
| `harness` | the agent tool you run in, such as `Claude Code` |

**Optional fields:**
- `suggested_fix`
- `model`: your model id
- `allow_copy`: set it only after the user confirms a copied install

Write so the issue stands on its own: name the script, brief or rule involved, and the stage of the run.

## When something fails

- **`gh` is missing, not logged in, or has no access:** `post` prints the reason, exits 1 and keeps the draft. Tell the user the fix and the draft path. The fix is one of these:
  - install `gh` from https://cli.github.com
  - run `gh auth login`
  - get access to `ArrayaWongsaita/skills-issues`
- **`draft` refuses an entry:** it names the missing or wrong fields. Fix the entry and run `draft` again.

## Reporting problems with this skill

This skill is the reporter, so it does not report itself. If one of its scripts fails or this procedure misleads you, say so in your final report to the user, with the command and its error, so they can fix it in `ArrayaWongsaita/skills`.
