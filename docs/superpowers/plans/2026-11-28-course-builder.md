# course-builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `course-builder` skill that designs a course once and builds, chapter by chapter, a local playground repo and the slides that explain it; plus the two `part-slides` changes it needs.

**Architecture:** `course-builder` owns `course.md` (outline, commands), `pattern.md`, the playground repo and the wave hand-off to `foreman`. Its scripts are stdlib Python and stack-free: the playground's own commands, recorded in `course.md`, are what runs. `part-slides` reads a chapter's row from `course.md` instead of interviewing, and fills listings from the playground's files with a generated module so slide code never drifts from the repo.

**Tech Stack:** Python 3.11+ stdlib, pytest (via `uv`), git (worktrees), Markdown skill files; `part-slides`' existing React template (unchanged).

**Spec:** `docs/superpowers/specs/2026-11-28-course-builder-design.md`

## Global Constraints

- Skill layout per AGENTS.md: `skills/teaching/course-builder/` with `SKILL.md` (frontmatter `name: course-builder`), `references/`, `scripts/` (stdlib Python 3.11+, each script puts its own folder on `sys.path`), `tests/` (`conftest.py` puts `scripts/` on `sys.path`), `evals/acceptance.md`.
- `SKILL.md` has the `## Reporting problems with this skill` section from AGENTS.md, work folder `<course_dir>`; each worker brief asks for a `Skill problem:` line.
- Frontmatter values that contain `: ` or ` #` are quoted (the repo-wide YAML test).
- Tests never call GitHub or a model; fixtures are made up; the user's two example repos are named in references only as the source of the convention, and nothing is copied from them into fixtures.
- Scripts never push and never switch the user's checkout of the playground: other branches are read with `git show` or a temporary worktree.
- The playground convention (spec, Constraints): one folder per chapter `NN-<slug>`; an exercise file whose header comment explains the idea with one worked example; numbered exercises `ข้อ N`, each with `แนวทาง:` and a `👉` line on `main`; a `solutions` branch where the `👉` lines are gone and the tests are written; a `setup-check`; a README that lists every chapter.
- Conventional Commits with the skill as scope (`feat(course-builder): …`, `feat(part-slides): …`), one commit per task. Branch: `feat/course-builder`.
- Test commands: `uv run --no-project --python 3.12 --with pytest pytest skills/teaching/course-builder/tests -q`; part-slides as in AGENTS.md; `skills/meta/report-skill-issue/tests` for the repo-wide hooks.

## Review Focus

1. **A chapter in the outline that is not built yet** (`status: outline`): a whole-repo check must not report its missing folder; only chapters with status `pilot`, `building`, `review` or `done` are checked. (Task 2 test `test_unbuilt_chapters_are_not_checked`.)
2. **The user has uncommitted changes in `playground/`:** checks and `apply_unit.py` work from committed branches in temporary worktrees, never touch the user's working tree, and say that uncommitted changes were not checked. (Task 3 test `test_uncommitted_changes_are_left_alone_and_named`.)
3. **`apply_unit.py` run twice for the same chapter** (a worker's fix after review): the chapter's files are replaced, a commit is made only when something changed, and a second run with no change commits nothing. (Task 4 test `test_applying_the_same_unit_twice_commits_once`.)
4. **A listing whose `path` is missing on its branch:** `sync_listings.py` stops naming the listing, the branch and the path, and writes nothing. (Task 6 test `test_a_missing_source_names_the_listing_and_writes_nothing`.)
5. **Exercise files in Thai with CRLF line endings:** parsed the same as LF. (Task 2 test `test_crlf_exercise_file_is_read_like_lf`.)

---

### Task 1: `course.md` — the outline and the commands

**Files:**
- Create: `skills/teaching/course-builder/scripts/course_md.py`
- Create: `skills/teaching/course-builder/tests/conftest.py`, `tests/test_course_md.py`

**Interfaces:**
- Produces, in `course_md.py`:

```python
@dataclass(frozen=True)
class Chapter:
    nn: str            # "01"
    slug: str
    title: str
    practises: str
    builds_on: str
    under_test: str
    status: str        # one of STATUSES

STATUSES = ("outline", "pilot", "building", "review", "done")
BUILT = ("pilot", "building", "review", "done")

@dataclass(frozen=True)
class Course:
    chapters_dir: str          # "lessons"
    commands: dict[str, str]   # keys "install", "setup", "chapter"; "chapter" may hold {nn}, {slug}, {folder}
    chapters: list[Chapter]

class CourseError(Exception): ...
def parse(text: str) -> Course
def read(course_dir: Path) -> Course                     # <course_dir>/course.md
def set_status(course_dir: Path, nn: str, status: str) -> None   # rewrites only that row's status cell
def chapter_command(course: Course, chapter: Chapter) -> str     # fills {nn} {slug} {folder}; folder = f"{chapters_dir}/{nn}-{slug}"
```

- The `course.md` format, written by the skill and parsed here:

```markdown
# <course title>

Learner: …
Goal: …
Stack: …

## Playground

Chapters folder: lessons
Install: pnpm install
Setup check: pnpm test setup-check
Run chapter: pnpm test {folder}

## Outline

| NN | slug | title | practises | builds on | under test | status |
|---|---|---|---|---|---|---|
| 01 | first-render | … | … | – | Hello.tsx | pilot |
```

- [ ] **Step 1: Write the failing tests** in `test_course_md.py` with a made-up course text:
  - `test_parse_reads_the_commands_and_every_row` (commands dict has the three keys; two rows; `chapters[0].nn == "01"`, `.status == "pilot"`).
  - `test_chapter_command_fills_the_placeholders` (`"run {folder} {nn} {slug}"` → `"run lessons/01-first-render 01 first-render"`).
  - `test_an_unknown_status_names_the_row` (`CourseError` matching `"02"` and `"done-ish"`).
  - `test_a_missing_command_is_named` (no `Run chapter:` → `CourseError` matching `"Run chapter"`).
  - `test_set_status_changes_only_that_cell` (other lines byte-identical; parse again shows the new status).
  - `test_a_slug_that_is_not_lowercase_hyphens_is_refused`.
- [ ] **Step 2:** Run the course-builder test command. Expected: FAIL (`course_md` missing).
- [ ] **Step 3:** Implement `course_md.py` as in Interfaces. Lines are matched as `Key: value` under `## Playground`; the table is the first table under `## Outline`; cells are stripped; `–` or empty `builds on` is kept as given.
- [ ] **Step 4:** Run the course-builder test command. Expected: PASS.
- [ ] **Step 5:** Commit `feat(course-builder): read and update a course outline`.

### Task 2: `check_playground.py` — the structure of a tree

**Files:**
- Create: `skills/teaching/course-builder/scripts/check_playground.py` (structure part)
- Test: `tests/test_check_structure.py`

**Interfaces:**
- Consumes: `course_md.Course`, `Chapter`, `BUILT` (Task 1).
- Produces:

```python
@dataclass(frozen=True)
class Finding:
    kind: str            # "missing-folder" | "no-exercise" | "exercise-shape" | "readme" | "leftover-marker" | "no-solutions-branch" | "run-failed" | "uncommitted"
    chapter: str | None  # "08"
    branch: str | None   # "main" | "solutions"
    detail: str
    def line(self) -> str   # "<kind> <chapter or -> <branch or ->: <detail>"

def exercise_file(folder: Path) -> Path | None          # the file that contains "ข้อ 1"
def exercise_shape(text: str) -> tuple[int, int, int]   # (exercises, hints, markers): counts of "ข้อ N" headings, "แนวทาง:", "👉"
def check_tree(root: Path, course: Course, branch: str, only: str | None = None) -> list[Finding]
```

  `check_tree` checks, for each chapter with status in `BUILT` (or only `only`): the folder `<chapters_dir>/<nn>-<slug>` exists (`missing-folder`); it holds an exercise file (`no-exercise`); on `main`, exercises ≥ 1 and hints == markers == exercises (`exercise-shape`, detail gives the three counts); on `solutions`, markers == 0 (`leftover-marker`). Once per tree: `README.md` names every built chapter's folder name (`readme`, listing the missing ones). Files are read as UTF-8 with CRLF normalised.

- [ ] **Step 1: Write the failing tests**, each building a made-up tree in `tmp_path` (a fixture `make_tree(tmp_path, chapters: dict[str, str], readme: str)`):
  - `test_a_well_formed_main_tree_has_no_findings` (one chapter, 3 exercises with 3 hints and 3 markers).
  - `test_a_missing_marker_is_an_exercise_shape_finding` (detail contains `3 exercises, 3 hints, 2 markers`).
  - `test_a_marker_left_on_solutions_is_named` (`leftover-marker`, chapter `"01"`, branch `"solutions"`).
  - `test_unbuilt_chapters_are_not_checked` (row 02 has status `outline` and no folder → no finding).
  - `test_the_readme_must_name_every_built_chapter`.
  - `test_crlf_exercise_file_is_read_like_lf`.
  - `test_only_checks_one_chapter` (`only="02"` ignores a broken 01).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement as in Interfaces.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(course-builder): check a playground tree against the exercise convention`.

### Task 3: `check_playground.py` — branches, runs and the command line

**Files:**
- Modify: `skills/teaching/course-builder/scripts/check_playground.py`
- Test: `tests/test_check_playground.py`, plus a `git_playground` fixture in `tests/conftest.py`

**Interfaces:**
- Consumes: Task 1, Task 2.
- Produces:

```python
def worktree(repo: Path, branch: str) -> ContextManager[Path]   # `git worktree add --detach <tmp> <branch>`, removed on exit (also on error)
def run(cmd: str, cwd: Path, timeout: int = 900) -> tuple[int, str]   # shell=True; returns (exit code, combined output)
def check(course_dir: Path, chapter: str | None = None, run_commands: bool = True, save_output: Path | None = None) -> list[Finding]
def main(argv: list[str]) -> int   # check_playground.py <course_dir> [--chapter NN] [--no-run] [--save-output DIR]; prints one Finding.line() per finding; exit 1 if any, else prints "ok" and exits 0
```

  `check`: reads `course.md`; `no-solutions-branch` if `solutions` does not exist (and stops there); for each branch, in a temporary worktree: `check_tree`, then, when `run_commands`, the install command once, the setup check on `main`, and the chapter command for each checked chapter (`run-failed` with the last 20 lines). With `save_output`, the chapter run's output is written to `<DIR>/<nn>-<branch>.txt`. When the playground's working tree has uncommitted changes (`git status --porcelain` not empty), add one `uncommitted` finding that says they were not checked; it is a note: `main` exits 1 only for the other kinds.

- [ ] **Step 1: Write the failing tests.** The `git_playground(tmp_path)` fixture makes a real git repo with `course.md` whose commands are stack-free: `Install: true`, `Setup check: python3 check_setup.py`, `Run chapter: python3 run_chapter.py {folder}`, where `run_chapter.py` exits 1 if any file in the folder contains `FAIL`. It commits a good chapter 01 on `main` and its solution on `solutions`.
  - `test_a_good_playground_is_ok` (`main([...]) == 0`, prints `ok`).
  - `test_a_failing_solution_is_run_failed_on_solutions` (solutions file contains `FAIL` → finding `run-failed 01 solutions`).
  - `test_no_solutions_branch_is_reported`.
  - `test_the_users_checkout_is_never_switched` (current branch and HEAD unchanged after `check`, and `git worktree list` shows only the main tree).
  - `test_uncommitted_changes_are_left_alone_and_named` (a modified file stays modified; one `uncommitted` finding; exit 0 when nothing else is wrong).
  - `test_save_output_writes_each_branch_run` (`01-main.txt`, `01-solutions.txt` exist).
  - `test_no_run_checks_structure_only` (a failing run is not reported with `--no-run`).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement as in Interfaces.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(course-builder): check a playground's branches and runs without touching the user's checkout`.

### Task 4: `init_playground.py` and `apply_unit.py`

**Files:**
- Create: `skills/teaching/course-builder/scripts/init_playground.py`, `scripts/apply_unit.py`
- Test: `tests/test_init_playground.py`, `tests/test_apply_unit.py`

**Interfaces:**
- Consumes: Task 1 (`read`, `set_status`), Task 3 (`worktree`, `check`).
- Produces:

```python
# init_playground.py <course_dir>
def init(course_dir: Path) -> None
# <course_dir>/playground must hold the skeleton the agent wrote; refuses if it is already a git repo.
# git init -b main, commit "chore: playground skeleton", create branch solutions at the same commit,
# then runs the setup check on main (CourseError with its output if it fails).

# apply_unit.py <course_dir> <NN>
def apply(course_dir: Path, nn: str) -> str   # returns "committed" | "unchanged"
# Reads <course_dir>/units/<NN>/main/ and units/<NN>/solutions/ (paths relative to the playground root).
# For each branch, in a temporary worktree: copy the files over, run check(…, chapter=NN) on that worktree's tree
# and the chapter command; if either branch fails, raise ApplyError with the findings and commit nothing on any branch.
# Otherwise commit "feat: chapter <NN> <slug>" on each branch that changed, and set the chapter's status to "review".
```

- [ ] **Step 1: Write the failing tests** (reuse `git_playground`, plus a `units` helper):
  - `test_init_makes_main_and_solutions_and_runs_the_setup_check`.
  - `test_init_refuses_an_existing_repo`.
  - `test_init_reports_a_failing_setup_check` (`CourseError` holding the command output; no commit).
  - `test_apply_commits_a_unit_on_both_branches_and_marks_it_review` (both branches contain the chapter; `course.md` row 02 says `review`).
  - `test_a_unit_whose_solution_fails_commits_nothing` (both branch heads unchanged; `ApplyError` names `run-failed`).
  - `test_applying_the_same_unit_twice_commits_once` (second call returns `"unchanged"`, head unchanged).
  - `test_apply_leaves_the_users_working_tree_alone` (an uncommitted edit in `playground/` survives).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement as in Interfaces. Commit with `git -C <worktree> commit`, author taken from the repo's git config.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(course-builder): start a playground and apply a worker's chapter only when it passes`.

### Task 5: the `course-builder` skill text

**Files:**
- Create: `skills/teaching/course-builder/SKILL.md`
- Create: `references/interview.md`, `references/outline.md`, `references/playground.md`, `references/pilot-and-pattern.md`, `references/waves.md`
- Create: `evals/acceptance.md`
- Test: `tests/test_skill_md.py`
- Modify: `AGENTS.md` (test command for course-builder)

**Interfaces:**
- Consumes: the script names and flags of Tasks 1–4.
- Produces: the text `part-slides` and `foreman` workers follow. `waves.md` holds the worker brief template that names `<course_dir>/course.md`, `<course_dir>/pattern.md`, the chapter row, the output folders `units/<NN>/main/`, `units/<NN>/solutions/` and the slides files, and asks for a `Skill problem:` line.

Content (each reference starts `# …` and its third line `Read this …`, like part-slides):
- `SKILL.md`: what it makes and why (one design pass, two outputs that follow each other); the course files (spec, "Files of a course"); a Start-or-resume table driven by files (no `course.md` → interview; no outline rows → outline; no `playground/.git` → skeleton + `init_playground.py`; a `pilot` row → pilot; rows at `outline` → waves; all `done` → finish); the six steps of the spec's flow, each pointing at its reference; the rule that nothing is pushed; "From an existing playground"; the reporting section.
- `interview.md`: the course questions (subject, learner, goal, stack, existing playground?), at most six, with proposals; writes the head of `course.md`.
- `outline.md`: the `course.md` format (Task 1) and how to propose stages and rows; the user edits until approved; nothing built before.
- `playground.md`: the convention (Global Constraints) as a checklist of what each file must do, whatever the stack; how to record the three commands; the user's two public repos named as worked examples; a pending exercise must not fail the run on `main`.
- `pilot-and-pattern.md`: building chapter 1 (files → `check_playground.py --chapter 01` → commit both branches → `part-slides` for its slides → user review); what `pattern.md` records (exercise header and hint style, exercises per chapter, `.solutions/` copies or not, slide choices, picture style).
- `waves.md`: waves of 3–4; units staged in `units/<NN>/`; the foreman's check per unit (`apply_unit.py`, the slides check page with no problems, `sync_listings.py --check`); one slides build at a time; pattern changes go to the next wave only; between waves the user may review.

- [ ] **Step 1: Write the failing tests** in `test_skill_md.py`:
  - `test_frontmatter_names_the_folder` (`name: course-builder`, a `description`).
  - `test_every_script_the_skill_names_exists` (every `scripts/<x>.py` mentioned in `SKILL.md` and `references/*.md` exists).
  - `test_every_flag_shown_is_one_the_script_takes` (for `check_playground.py`: `--chapter`, `--no-run`, `--save-output`).
  - `test_every_reference_starts_with_a_heading_and_says_who_reads_it`.
  - `test_the_skill_never_pushes` (`SKILL.md` contains `never push`; no reference contains `git push`).
  - `test_the_worker_brief_names_the_course_files_and_asks_for_skill_problems` (in `waves.md`: `course.md`, `pattern.md`, `units/`, `Skill problem:`).
- [ ] **Step 2:** Run the course-builder tests and `skills/meta/report-skill-issue/tests`. Expected: FAIL.
- [ ] **Step 3:** Write the files. Add the course-builder line to AGENTS.md's test block. Write `evals/acceptance.md` (a table: check → test, like opencode-delegate's).
- [ ] **Step 4:** Run both. Expected: PASS.
- [ ] **Step 5:** Commit `feat(course-builder): the skill, its references and acceptance checks`.

### Task 6: part-slides — listings read from the playground

**Files:**
- Create: `skills/teaching/part-slides/scripts/sync_listings.py`
- Test: `skills/teaching/part-slides/tests/test_sync_listings.py`
- Modify: `skills/teaching/part-slides/references/slides.md` (Code)

**Interfaces:**
- Produces:

```python
# sync_listings.py <course_dir> --part N [--check]
# Reads <web>/src/parts/part-NN.sources.json: {"<name>": {"branch": "main"|"solutions", "path": "<path in playground>", "lang": "tsx"}}
# Writes <web>/src/parts/part-NN.playground.ts:
#   // Written by sync_listings.py from <course_dir>/playground. Do not edit: change the playground and run it again.
#   import type { Listing } from '../components/types';
#   export const playgroundListings: Record<string, Listing> = { "<name>": { lang, status: 'verified', reason: 'playground <branch>:<path>', code: <JSON string> }, … };
# With --check, writes nothing and exits 1 listing each name whose code differs from the playground (or that is missing).
def sources(web: Path, part: int) -> dict[str, dict[str, str]]
def render(course_dir: Path, srcs: dict[str, dict[str, str]]) -> str
def main(argv: list[str]) -> int
```

  The Part's data file uses it as `export const listings = { ...playgroundListings, …own };`. Files are read with `git -C <playground> show <branch>:<path>`, so the user's checkout is not switched.

- [ ] **Step 1: Write the failing tests** with a made-up git playground in `tmp_path` and a `web/src/parts/` folder:
  - `test_it_writes_each_source_from_its_branch` (the generated file holds the `solutions` text for a solutions source, the `main` text for a main source; it parses as TS-ish: contains `export const playgroundListings`).
  - `test_check_passes_when_the_generated_file_is_current` (exit 0).
  - `test_check_names_a_listing_that_drifted` (change the file on `solutions`, commit; `--check` exits 1 and prints the name).
  - `test_a_missing_source_names_the_listing_and_writes_nothing`.
  - `test_code_with_quotes_backticks_and_thai_round_trips` (the JSON string literal decodes to the exact file text).
- [ ] **Step 2:** Run the part-slides pytest command. Expected: FAIL.
- [ ] **Step 3:** Implement as in Interfaces (JSON-encode each code string with `ensure_ascii=False`; TypeScript accepts JSON string literals).
- [ ] **Step 4:** Run. Expected: PASS. Also add `part-NN.playground.ts` import to one fixture Part only if `test_app_build.py` needs it to type-check; otherwise leave the template untouched.
- [ ] **Step 5: Docs.** `slides.md` Code: a course with a playground declares each code listing in `part-NN.sources.json`, runs `sync_listings.py`, spreads `playgroundListings` into `listings`, and takes outputs from `check_playground.py --save-output`; never type playground code by hand. Add `sync_listings.py --check` to `check-and-revise.md` Build. Run the part-slides pytest command (the references tests check script names and flags). Expected: PASS.
- [ ] **Step 6:** Commit `feat(part-slides): read code listings from a course's playground`.

### Task 7: part-slides — a Part that belongs to a course

**Files:**
- Modify: `skills/teaching/part-slides/SKILL.md` (Start or resume, Step 1), `references/interview.md`
- Test: `skills/teaching/part-slides/tests/test_skill_md.py`

- [ ] **Step 1: Write the failing test** `test_a_part_of_a_course_takes_its_brief_from_course_md`: `SKILL.md` contains `course.md` and `pattern.md`; `interview.md` contains `course.md` and the phrase `instead of interviewing`.
- [ ] **Step 2:** Run the part-slides pytest command. Expected: FAIL.
- [ ] **Step 3:** In `SKILL.md` Start or resume, before the table: when `<course_dir>/course.md` has a row for this Part, write `brief.md` from that row and the course head (learner, goal, language, code) and follow `pattern.md`; ask only what is still open; research only what the playground does not already show. In `interview.md`, a short section "A Part of a course" saying the same, instead of interviewing.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(part-slides): a Part of a course takes its brief from course.md`.

### Task 8: Ship

- [ ] **Step 1:** Run every touched skill's tests and the repo-wide hooks (`skills/meta/report-skill-issue/tests`). Expected: PASS.
- [ ] **Step 2:** Push `feat/course-builder`, open a PR to `main` whose body summarises the skill and says `Closes ArrayaWongsaita/skills-issues#23` and `Closes ArrayaWongsaita/skills-issues#24` (the course layer replaces a workshop phase and the second-Part reuse). Comment `Fix: <PR URL>` on both issues.
- [ ] **Step 3:** Update the memory file `part-slides-open-problems.md`: nothing left open; link the PR.
