# Design: course-builder — one design pass for a course's playground repo and its slides

- Date: 2026-11-28
- Status: Approved 2026-11-28
- Size: a project (a new skill, and two changes to `part-slides`)
- Touches: new `skills/teaching/course-builder/`; `skills/teaching/part-slides/` (resume from a course, listings read from the playground); `skills/meta/foreman/` only if a brief needs a hook (expected: none)
- Related issues: ArrayaWongsaita/skills-issues#23 (workshop), #24 (second Part of a subject) — this design replaces both with a course layer

## Intent

The user teaches with two things that must follow the same order: a **playground repo** the learner works in (a folder per chapter, exercises marked 👉, the answers on a `solutions` branch, a `setup-check`) and **slides** that explain each chapter, mostly with pictures, because code alone cannot show what happens. Today the user designs the order twice: once for the repo, once for the slides, and the two drift. They want to design a course once and get both, chapter by chapter, with the slides explaining what the playground has the learner do.

They also do not want to wait for a whole course before seeing anything: a mistake that shows up at the end costs a rewrite of every chapter.

## Goals

- **One outline for the course.** A table, one row per chapter: title, what it practises, what it builds on, the thing under test. The user edits it before anything is built. Both the repo and the slides follow it.
- **A pilot chapter.** Chapter 1 is built in full (playground folder, exercises, solutions, slides) and the user reviews the real thing. What they settle becomes the course's **pattern** file, which every later chapter follows.
- **Waves.** The remaining chapters are built in waves of 3–4, in parallel, through `foreman` and its workers. Between waves the user can look at finished chapters; a change to the pattern applies to the next wave, and to built chapters only when the user asks.
- **A playground repo built locally.** A git repository in the course folder, in the user's existing convention (see Constraints). The skill commits; it never pushes. The user decides when it goes to GitHub.
- **Slides that show the playground's code exactly.** A slide's code is read from the playground (either branch), never retyped, and a check reports a slide whose code no longer matches the file.
- **Every solution runs.** On the `solutions` branch every exercise passes; on `main` the exercises are pending, not failing, and `setup-check` passes. The slides show real run output.
- **`part-slides` still works alone.** A slides-only Part (no playground) runs as today.
- **A course from an existing playground.** When the user already has a playground repo, course-builder reads its chapters into the outline instead of designing them, and only the slides are built.

## Non-goals

- What the slides of a chapter look like inside (the rhythm, the pictures, an exercise-slide layout). `part-slides` owns that; changing it is separate work.
- Pushing, creating GitHub repositories, or publishing.
- Ready-made starters for particular stacks. The skill builds each playground's skeleton from the interview (see Decided with the user).
- Planning a course with no playground at all. That is `part-slides` Part by Part, as today.

## Anti-goals

- A whole course built before the user has seen one chapter.
- Slides and playground that disagree: a slide showing code that is not in the repo, or an exercise in the repo that no slide explains.
- A solution shown on a slide that was never run.
- `part-slides` growing so long that a worker on a cheaper model misreads it.

## Constraints

- **The playground convention, taken from the user's two repos** (`DN_T_REACT_VITEST`, `DN_T_PLAYWRIGHT`):
  - `README.md` in Thai: what the repo is, install (`pnpm install`, `pnpm test setup-check` must pass), how to do an exercise, how to run, how to read the result, and a contents table grouped in stages (ช่วง).
  - One folder per chapter, `NN-<slug>` (`lessons/` or `e2e/`, by tool), holding the small thing under test and one exercise file.
  - An exercise file opens with a header comment: the chapter, what it practises, the idea in a few lines, and one worked example. Then about three numbered exercises (`ข้อ N`), each with a one-line `แนวทาง:` hint, a pending test (`test.todo` / `test.fixme`) and a `// 👉` line where the learner writes.
  - A `solutions` branch: the same files with the tests written. (The Playwright repo also keeps copies in `.solutions/`; the pattern file says whether a course does.)
  - `docs/cheatsheet.md`, and a `setup-check` that proves the install works.
- Repo conventions of this skills repo (AGENTS.md): stdlib Python 3.11+ scripts, pytest, `## Reporting problems with this skill`, Conventional Commits, one commit per change.
- No GitHub calls in tests; no user content in fixtures.
- The user talks Thai; files, code and commit messages follow the playground's own language (Thai comments and README, as in the examples).

## Approaches

| Considered | Trade-off | Picked |
|---|---|---|
| A. Extend `part-slides` with the course layer and the playground | One skill to call; but `part-slides` doubles in length, and a slides-only user carries all of it | no |
| **B. A new `course-builder` skill for the course layer and the playground; `part-slides` keeps doing one chapter's slides and learns to read the course and the playground** | Each skill stays short with one job; `part-slides` alone still works; the playground convention lives in one place. Costs a shared file format between two skills, pinned by tests | **yes (user's pick, on recommendation)** |
| C. Three skills: plan, playground, slides | Finest split, but the user calls three skills in a row and planning and building the playground are one conversation anyway | no |

For the run order: all at once (one long wait, late surprises) · strictly one chapter at a time (slow) · **outline, pilot chapter, then parallel waves** (picked: cheap changes first, systemic mistakes caught once, speed after the pattern is settled).

## Decided with the user

- One design pass gives both the playground repo and the slides, which follow each other.
- The skill builds the playground locally and commits; the user pushes later.
- Slides are the main explanation and cover what the code cannot show, mostly with pictures.
- Run order: a light outline of the whole course first, then chapter 1 as a pilot the user reviews, then the rest in parallel waves; the user may review finished chapters between waves.
- Approach B.
- No stack is built in: course-builder writes each playground's skeleton for the stack chosen at the interview, and checks it with a stack-independent script.

## The design

### Files of a course

```
<cwd>/courses/<slug>/
  course.md                 the outline and the course decisions (new; owned by course-builder)
  pattern.md                what the pilot settled (new; owned by course-builder)
  course-notes.md           as today (part-slides)
  playground/               the playground git repo (new)
  parts/NN-<slug>/          per chapter: brief.md, research.md, plan.md (part-slides, as today)
  web/                      the slides app (part-slides, as today)
```

`course.md` holds: the learner, the goal, the stack (tool, language, package manager), the stages, and the outline table — `| NN | slug | title | practises | builds on | under test | status |`, where status is `outline`, `pilot`, `building`, `review`, `done`. It is the only place a chapter's order and scope are decided.

`pattern.md` holds what the pilot settled, as short rules: the exercise file's header and hint style, the number of exercises, how solutions are kept, the slide rhythm choices for a chapter, the picture style. Every later chapter's brief points at it.

### course-builder's flow

1. **Interview** (one conversation): subject, learner, goal, stack, and whether a playground already exists. Write `course.md` without the outline.
2. **Outline**: research the subject's order of learning, propose the outline table and the stages; the user edits it until they approve. Nothing is built yet.
3. **Scaffold the playground**: the skill writes `playground/` for the stack chosen at the interview (package files, the test tool's config, a `setup-check`, the README skeleton, the cheatsheet), records the commands in `course.md` (install, run all, run one chapter), makes the first commit on `main` and creates `solutions`. The setup check must pass. There are no stored starters: the convention (Constraints) says what a playground must contain, whatever the stack.
4. **Pilot chapter 1**:
   - write the thing under test, the exercise file and its solution, from the outline row;
   - run `check_playground.py` (below): on `solutions` the chapter passes, on `main` it is pending and nothing fails;
   - commit on both branches;
   - hand the chapter to `part-slides`, which writes `parts/01-…/brief.md` from `course.md` (no interview), researches only what the playground does not already say, plans, and builds the slides with code read from the playground;
   - the user reviews the chapter's exercises and slides; changes are applied, and what they settle is written to `pattern.md`.
5. **Waves**: hand chapters 2… to `foreman` in waves of 3–4. Each unit is one chapter: playground folder + both branches + slides, done by a worker with a brief that names `course.md`, `pattern.md` and the chapter's row. The foreman checks each unit (the solution runs, `main` stays green, the slides check page has no problems, the slides' code matches the playground) before marking it `review`. Between waves, the user may review; a pattern change goes to `pattern.md` and to the next wave's briefs.
6. **Finish**: README contents table and cheatsheet brought up to date, a last full run of both branches, and a report of what is ready to push.

**From an existing playground:** step 2 reads the chapters from the repo (folders, README contents, exercise headers) into the outline, and steps 3–5 skip the playground work: each unit is the chapter's slides only.

### Checking a playground, whatever the stack

A script, `check_playground.py <course_dir> [--chapter NN]`, checks the convention without knowing the tool:
- the structure: the README sections and contents table, a folder per outline row, one exercise file per chapter with its header, numbered exercises, a `แนวทาง:` hint each and a `👉` line each on `main`;
- the `solutions` branch exists, and in each chapter's exercise file the `👉` lines are gone;
- the commands in `course.md` exit 0: the setup check, and the chapter's run on both branches (each branch checked out in its own worktree, so the user's checkout is never switched). A pending exercise must not fail the run on `main`, which is how the user's repos already behave (`test.todo`, `test.fixme`).

It prints one finding per problem and exits 1 when there is any. course-builder, the foreman and the workers all use it.

### Changes to part-slides

- **Resume from a course.** When `<course_dir>/course.md` exists and has a row for this Part, step 1 writes the brief from that row and `course.md` instead of interviewing, and asks only what is open. This also covers a second Part of one subject (#24).
- **Code from the playground.** A listing may name its source instead of holding code: `listings.counter = { lang: 'tsx', source: { branch: 'solutions', path: 'lessons/08-click-counter/Counter.test.tsx' }, … }`. A script fills `code` from `git show <branch>:<path>` in `<course_dir>/playground`, and the check (a script and the check page) reports a listing whose code differs from the file. A listing without `source` works as today.
- **Exercise outputs are real.** For a listing from the playground, the output is the run of that chapter on the named branch.

### What the user approves, and when

The outline (once), the pilot chapter (once), and anything a wave's report flags. Nothing else waits for them.

## Calls I made (check these)

- One playground chapter = one slides Part, numbered the same.
- The playground lives inside the course folder (`<course_dir>/playground/`), as its own git repository.
- Waves of 3–4 chapters; the foreman's existing retry and stop rules apply unchanged.
- A pattern change does not rebuild finished chapters unless the user asks.
- `.solutions/` copies on `main` are optional, chosen at the pilot and recorded in `pattern.md`.
- **Parallel workers never touch the playground's git.** A worker writes its chapter into `<course_dir>/units/NN/main/` and `units/NN/solutions/` (the files as they should be on each branch). The foreman copies them into the playground, runs both branches and commits, one chapter at a time. Two workers committing to the same two branches at once would conflict.
- **One slides build at a time.** Workers write their Part's files; the foreman runs `scaffold.py --sync-count`, the build and the check page, one Part at a time, on one preview port.

## Left to the builder

- The exact scripts and their names (scaffold, run-both-branches, sync listings), within the stdlib-Python rule.
- How a skeleton is written for a stack (a reference that lists what each file must do, with the user's two repos as worked examples).
- The wording of briefs, as long as each worker brief names `course.md`, `pattern.md` and the chapter row, and asks for a `Skill problem:` line.
- How the check reports listing drift (a script, the check page, or both).
