---
name: course-builder
description: Use when the user wants a course designed once and built as two things that follow the same outline, a playground repo the learner practises in (a folder per chapter, exercises marked with a pointing hand, the answers on a solutions branch) and slides that explain each chapter. It interviews the user, proposes an outline they edit, builds the playground locally, builds chapter 1 as a pilot the user reviews, then the remaining chapters in waves through foreman. Do not use for slides with no playground (use part-slides alone), or to push or publish a repo.
---

# Course builder

You design a course once and build two things from that one design: a **playground** the learner works in, and **slides** that explain each chapter, mostly with pictures, because code alone cannot show what happens. The two follow one outline, so a slide never shows code the repo does not have and the repo never has an exercise no slide explains.

You own the course layer: the interview, the outline, the playground and the order of work. `part-slides` builds each chapter's slides; `foreman` runs the waves. Talk with the user in their language. The playground's README and comments follow the playground's own language (Thai in the user's repos); code, file names and commit messages stay as they are.

The point of this skill is that a mistake shows up early and cheaply: the outline is a table the user edits before anything is built, and chapter 1 is built in full and reviewed before any other chapter starts.

Paths below are relative to this skill's base directory, written `<skill>/…`; `part-slides`' own folder is `<part-slides>/…`. `<course_dir>` is `<cwd>/courses/<slug>/`, `<playground>` is `<course_dir>/playground`, and `NN` is a chapter's number with two digits.

## The files of a course

| File | What it holds | Written by |
|---|---|---|
| `<course_dir>/course.md` | learner, goal, stack, the playground's commands, the outline table with each chapter's status | you; scripts update a status |
| `<course_dir>/pattern.md` | what the pilot settled, as short rules every later chapter follows | you, after the pilot |
| `<playground>/` | the playground git repository: `main` (exercises pending) and `solutions` (written) | `init_playground.py`, then `apply_unit.py` only |
| `<course_dir>/units/NN/main/`, `units/NN/solutions/` | one chapter's files as they should be on each branch, before they enter the repo | you (pilot) or a worker |
| `<course_dir>/runs/` | each chapter run's real output, for the slides | `check_playground.py --save-output` or `apply_unit.py --check --save-output` |
| `<course_dir>/parts/NN-<slug>/`, `<course_dir>/web/` | the chapter's slides: brief, research, plan, and the app | `part-slides` |
| `<course_dir>/skill-problems.md` | problems with this skill, for reporting | you |

A chapter's status in `course.md` is `outline` (not built), `pilot` (chapter 1 being built), `building` (with a worker), `review` (in the playground, both branches pass) or `done` (slides built and checked too).

## Start or resume

Read `<course_dir>/skill-problems.md` first if it exists. Then go by the files:

| What exists | Next |
|---|---|
| no `course.md` | Step 1, interview |
| `course.md` with no outline rows | Step 2, outline |
| an outline, but no `<playground>/.git` | Step 3, playground |
| chapter 01 not `done` | Step 4, pilot |
| chapters at `outline`, `building` or `review` | Step 5, waves |
| every chapter `done` | Step 6, finish |

## Step 1: interview

Follow `references/interview.md`. It writes the head of `course.md`: learner, goal, stack, and whether a playground already exists.

## Step 2: outline

Follow `references/outline.md`: research the subject's order of learning, propose stages and one row per chapter, and let the user edit the table until they approve it. Nothing is built before that. The outline is the only place a chapter's order and scope are decided: when either changes later, change `course.md` first.

## Step 3: the playground

Follow `references/playground.md`: write the skeleton for the stack from the interview, record the three commands in `course.md`, then:

```bash
python3 <skill>/scripts/init_playground.py <course_dir>
```

It runs the install and the setup check, and only when both pass makes the repository with `main` and `solutions` at the same first commit.

## Step 4: the pilot chapter

Follow `references/pilot-and-pattern.md`: build chapter 1 in full (the thing under test, the exercises, the solutions, the slides), let the user review the real thing, apply what they say, and write `pattern.md`.

## Step 5: waves

Follow `references/waves.md`: the remaining chapters in waves of 3–4, through `foreman`, each chapter a unit with its own check. Between waves the user may look at finished chapters. A change to `pattern.md` applies to the next wave; built chapters are rebuilt only when the user asks.

## Step 6: finish

1. Bring the README's contents table and `docs/cheatsheet.md` up to date with every chapter: write them, as they should be on each branch, into `<course_dir>/units/finish/main/` and `units/finish/solutions/`, then run `python3 <skill>/scripts/apply_unit.py <course_dir> finish`. It checks every chapter, commits on both branches and changes no chapter's status.
2. Run the whole playground:

   ```bash
   python3 <skill>/scripts/check_playground.py <course_dir>
   ```

   It must print `ok`.
3. Report: the chapters, the branches and their last commits (`apply_unit.py` prints them after each commit), the slides app's address, and that the repository is ready for the user to push when they choose. You never push.

## From an existing playground

When the interview finds the user already has a playground, Step 2 reads its chapters into the outline instead of designing them: the folders, the README's contents table, each exercise file's header. Set every chapter it already has to `review`, and run `check_playground.py <course_dir> --no-run` to see where it departs from the convention. Tell the user what it found; do not change their repo to fit unless they ask. Skip Step 3. In Steps 4 and 5 a unit is the chapter's slides only.

## Rules that matter most

- **Never push**, never create a remote repository, never publish. The user decides when the playground goes to GitHub.
- **Never switch the user's checkout of the playground.** The scripts read other branches in temporary worktrees. A chapter enters the repository only through `apply_unit.py`, which commits only when both branches pass.
- **Workers never touch the playground's git.** A worker writes `units/NN/`, checks it with `apply_unit.py <course_dir> NN --check`, and the foreman applies one chapter at a time.
- **Slide code is never typed by hand.** A slide's code comes from the playground through `part-slides`' `sync_listings.py`, and its output from a real run. The one exception is an `Anatomy` strip's `pieces`: they cut a line of a synced listing, and joined they are that line exactly.
- **One build into `web/dist` at a time**, on one preview port. A wave worker checks its own Part in a build folder and on a port of its own (`references/waves.md`).

## Scripts

| Script | What it does |
|---|---|
| `python3 <skill>/scripts/course_md.py <course_dir>` | prints the outline as JSON; `--set NN STATUS` changes one chapter's status |
| `python3 <skill>/scripts/init_playground.py <course_dir>` | the first commit on `main` and `solutions`, after the setup check passes |
| `python3 <skill>/scripts/check_playground.py <course_dir> --chapter NN --save-output <course_dir>/runs` | checks the shape of both branches and runs their commands; `--no-run` checks the shape only |
| `python3 <skill>/scripts/apply_unit.py <course_dir> NN` | brings `units/NN/` into both branches when both pass, and sets the chapter to `review`; `--check` checks and commits nothing; `--save-output <course_dir>/runs` saves the chapter's runs; a unit that changes files outside its folder runs every built chapter too |

Each prints one line per problem and exits 1 when there is any.

## Reporting problems with this skill

When something in this skill goes wrong or does not fit (a script error, a validator error that was wrong, a brief that misled a subagent, a limit or rule that did not fit real content), append one line to `<course_dir>/skill-problems.md` as soon as you see it:

`- <bug|improvement|docs> · <what happened> · <where: the script, brief or rule> · <stage>`

A subagent's `Skill problem:` line goes in too. On resume, read the file first. At the end of the run, if any line has no ` → ` mark yet, offer once to report them with the `report-skill-issue` skill, or at once if a problem stops the run. Then mark each line the offer covered: ` → <issue URL>` once reported, or ` → not reported (<date>)` if the user declined or dropped it. A marked line is never offered again. If `report-skill-issue` is not installed, list the unmarked lines in your final report instead.

## References

- `references/interview.md`: the course questions, and the head of `course.md`
- `references/outline.md`: the `course.md` format and how to propose the outline
- `references/playground.md`: what a playground must contain, whatever the stack
- `references/pilot-and-pattern.md`: building chapter 1 and writing `pattern.md`
- `references/waves.md`: the waves, the worker brief, and the foreman's check of each chapter
