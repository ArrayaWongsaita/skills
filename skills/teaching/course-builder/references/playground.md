# Playground

Read this at Step 3, when you write the playground's skeleton for the stack chosen at the interview.

No stack is built in. This page says what each part of a playground must do; you write it for the tool the user chose. The user's own public repos are the worked examples: `ArrayaWongsaita/DN_T_REACT_VITEST` (Vitest and Testing Library) and `ArrayaWongsaita/DN_T_PLAYWRIGHT` (Playwright). Read one of them when the stack is close to it.

## What the skeleton must contain

Write these into `<playground>/` before `init_playground.py`:

- **The package files** for the stack (`package.json` and lockfile, `pyproject.toml`, …) with exact versions, and the test tool's config.
- **A `.gitignore`** that leaves out installed packages, build output and test reports: `init_playground.py` refuses to commit when the install or the setup check made something it does not leave out.
- **A setup check**: one tiny test or script that passes only when the install works (in the examples, `pnpm test setup-check`). The learner runs it first.
- **`README.md`**, in the playground's language:
  - what the repo is and who it is for;
  - install, then the setup check, which must pass;
  - how to do an exercise, for the course's kind of exercise (below): open the chapter's exercise file, read the header, and write under each `👉` the test, or the code the given checks run;
  - how to run one chapter and all of them, and how to read the result (a pending test is not a failure);
  - how to look at the answers: the `solutions` branch (a whole check fails when the README does not name it, or does not give the setup-check command exactly as `course.md` has it). Give the commands that work in a learner's fresh clone while they have edits in progress: `git show origin/solutions:<chapter's exercise file>` and `git diff main origin/solutions -- <chapter folder>`, with the path pattern or one example per chapter, not chapter 01's only. A clone has no local `solutions` until the first switch, and `git switch solutions` is refused once an exercise file has edits, so give a switch only after `git stash` (and `git stash pop` back on `main`). A whole check flags `git show solutions:`, `git diff main solutions` and a switch with no stash;
  - **the contents table, grouped by stage, with every chapter of the outline**, each naming its folder (`01-first-render`). Writing every row now means a chapter's unit never has to touch the README.
- **`docs/cheatsheet.md`**: a short skeleton; the finish step fills it.
- **The chapters folder** (`Chapters folder:` in `course.md`), empty.

## The commands

Record in `course.md` under `## Playground`:

- `Install:` the install command;
- `Setup check:` the setup check;
- `Run chapter:` the command that runs one chapter's folder, with `{folder}`;
- `Run all:` (optional) the command that runs every chapter.

Each must exit 0 when things are right, from the playground's root, with no prompt.

**A test tool that starts a server** (Playwright's `webServer`, a dev server): the scripts give every command its own free port in the environment variable `PLAYGROUND_PORT`, because workers check their chapters at the same time. Make the tool's config read the port from `PLAYGROUND_PORT` (with a fixed default for the learner), and never reuse a server that is already running, or one worker's tests run against another worker's pages. On `main` a chapter's exercises are pending (`test.todo`, `test.fixme`, or the tool's skip), and **a pending exercise must not fail the run**: try it once. If the tool exits non-zero when a folder has only pending tests, add the tool's own pass-with-no-tests or equivalent option to `Run chapter:`.

## A chapter, whatever the stack

Decide at this step which kind of exercise the course has, from the learner, and say it in `pattern.md` and the README:

- **The learner writes the test.** The thing under test is given; each exercise is a pending test, and the learner writes the test under its `👉`. For a learner learning a test tool.
- **The learner writes the code, and the checks are given.** Each exercise is a place for code (a query, a function body) under its `👉`, and a given check that is pending (skipped) while the answer is still empty, so `main` passes. For a learner learning the language or tool itself (SQL, a first language). The check is written once per exercise, on both branches; `solutions` fills in the code.

**A wrong answer's output must be readable by this course's learner.** A test tool's traceback is fine for someone who writes code; a learner who has never programmed needs one line per failed exercise, in the playground's language, saying which exercise and what was wrong (`ข้อ 2: ได้ 3 แถว ควรได้ 2 แถว`). When the given checks call a helper, the helper catches the tool's errors and prints that line. The pilot tries one wrong answer per exercise (`pilot-and-pattern.md`).

What `check_playground.py` checks, and what a worker writes:

- one folder per chapter, `<Chapters folder>/NN-<slug>`, holding the small thing under test and **one exercise file**. When the tool needs the thing under test elsewhere (a page its server serves), it goes there, at its own path, in the same unit. **The thing under test belongs to its chapter**: never one module at the root that every chapter adds to. Workers run at the same time, and a unit replaces a whole file, so a chapter that extends a shared file drops what another chapter added. A file several chapters use (a helper, a fixture) is written once, in the skeleton or by the pilot, and later chapters only read it. `apply_unit.py` runs every built chapter and `Run all` when a unit changes a file outside its folder, and names those files;
- the exercise file opens with a header comment: the chapter, what it practises, the idea in a few lines, and one worked example. Give the worked example as real code that runs too (a finished test above the exercises, or an example file in the chapter folder), so the slides can show it with its real output;
- then numbered exercises, `ข้อ N: <what to do>`, about three, each with:
  - one line `แนวทาง: <a hint>`: a direction (which function, which idea, where to look), never the code to write, the expected value, or the worked example again;
  - a pending test, or, for given checks, a pending check;
  - a `👉` line where the learner writes;
  - an exercise that practises something the chapter's other exercises do not: two exercises that differ only in their values teach the same thing twice;
- a check that fails on a plausible wrong answer, including a mistyped name or text: a check that something is absent, hidden or empty also passes when it finds nothing, so first check the thing exists; an assertion that is true whatever the learner does (a text checked against part of itself, a value compared with itself) teaches nothing. Try one wrong answer per exercise before the chapter is applied;
- on `solutions`, the same file with each test written and **no `👉` left**;
- if `pattern.md` says so, copies of the answers in `.solutions/` on `main` too;
- file names unique across chapters when the tool imports test files by name (pytest's default import mode, for one): two chapters' `test_shop.py` collide in `Run all`. Put the chapter's number or slug in the name.

The script counts `ข้อ N:` headings, `แนวทาง:` lines and `👉` marks, so keep each of them to exactly one per exercise on `main`, and keep `👉` out of every other comment.
