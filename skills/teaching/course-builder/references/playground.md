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
  - how to do an exercise: open the chapter's exercise file, read the header, write the test under each `👉`;
  - how to run one chapter and all of them, and how to read the result (a pending test is not a failure);
  - how to look at the answers: the `solutions` branch (a whole check fails when the README does not name it, or does not give the setup-check command exactly as `course.md` has it);
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

What `check_playground.py` checks, and what a worker writes:

- one folder per chapter, `<Chapters folder>/NN-<slug>`, holding the small thing under test and **one exercise file**. When the tool needs the thing under test elsewhere (a page its server serves), it goes there, at its own path, in the same unit;
- the exercise file opens with a header comment: the chapter, what it practises, the idea in a few lines, and one worked example;
- then numbered exercises, `ข้อ N: <what to do>`, about three, each with:
  - one line `แนวทาง: <a hint>`;
  - a pending test;
  - a `👉` line where the learner writes;
- on `solutions`, the same file with each test written and **no `👉` left**;
- if `pattern.md` says so, copies of the answers in `.solutions/` on `main` too.

The script counts `ข้อ N:` headings, `แนวทาง:` lines and `👉` marks, so keep each of them to exactly one per exercise on `main`, and keep `👉` out of every other comment.
