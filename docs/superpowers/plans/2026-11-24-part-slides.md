# part-slides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new skill `part-slides` that interviews the user, researches one Part, lets the user edit a slide list, then builds and revises the Part as React slides, with no dependency on `course-research` or `slide-design`.

**Architecture:** A fork of the react-slides template (1.2.0 → 2.0.0) with a lighter slide contract and readability budgets reported by the check page; one stdlib Python script (`scaffold.py`); the flow itself is written as `SKILL.md` plus five reference briefs. Slides are written as TSX directly.

**Tech Stack:** Python 3.11+ stdlib and pytest; the template's TypeScript, React 19, Vite, vitest.

**Spec:** `docs/superpowers/specs/2026-11-24-part-slides-design.md`

## Global Constraints

- Skill folder: `skills/teaching/part-slides/`; `SKILL.md` frontmatter `name: part-slides`.
- Code, comments, docs and commit messages are English; the skill talks to the user in the user's language. Commits are Conventional Commits scoped `part-slides`, one commit per task step group as listed.
- The repo is public: fixtures are small, made up and neutral; no local home path in any tracked file.
- Scripts are stdlib Python 3.11+; each puts its own folder on `sys.path`; `tests/conftest.py` puts `scripts/` on `sys.path`.
- `SKILL.md` contains the `## Reporting problems with this skill` section from `AGENTS.md`, with the work folder `<course_dir>/skill-problems.md`.
- Budget numbers (single place, `check/budgets.ts`): a topic at most 9 slides including its divider; the Opening at most 3; a Part at most 40 slides (a `note` from 35); prose at most 160 characters for language `th` and 220 otherwise.
- Phases in order: `know`, `parts`, `example`, `watchout`, `check`.
- The old skills and the template under `react-slides/` are not changed.
- Tests never call the network or a model.

## Review Focus

- A slide with no `purpose`, `from` or `sources` must render and must typecheck (a hand-written Part is the normal case now).
- A React node as `visual` must render inside every layout that takes a visual, and an old data visual must still work.
- A Part with no topics, only an Opening and a Closing, must not produce budget findings about missing dividers.
- A section that mixes slides with and without a phase (a divider has none) must not be flagged as out of order.
- `scaffold.py` run twice must change nothing and must never overwrite a file the user edited; a Part number below 10 is written `part-01`.

---

### Task 1: Fork the template and relax the slide contract

**Files:**
- Create: `skills/teaching/part-slides/template/` (a copy of the tracked files of `skills/teaching/react-slides/template/`, made with `git ls-files`, so no `node_modules` and no `dist`)
- Modify: `skills/teaching/part-slides/template/package.json` (version `2.0.0`), `template/src/components/types.ts`, `template/src/components/layouts.tsx`, `template/src/components/SlideFrame.tsx`
- Test: `template/src/components/layouts.test.tsx`

**Interfaces:**
- Produces: `Base = { id: string; section: string; purpose?: string; from?: string[]; sources?: string[]; unit?: string; topic?: string; phase?: Phase }`; every layout's `visual` prop typed `Visual | ReactNode`; `SlideFrame` puts `data-section` and `data-phase` (when set) on the `.rs-slide` element.

- [ ] **Step 1: Copy the template**

```bash
cd <repo> && mkdir -p skills/teaching/part-slides && git ls-files skills/teaching/react-slides/template | while read f; do d=skills/teaching/part-slides/template/${f#skills/teaching/react-slides/template/}; mkdir -p "$(dirname "$d")"; cp "$f" "$d"; done
```

Then `npm --prefix skills/teaching/part-slides/template ci` and run `npm --prefix … test` to see the copy green (177 tests). Commit: `feat(part-slides): copy the react-slides template as a base`.

- [ ] **Step 2: Write the failing tests** in `layouts.test.tsx` (use that file's existing render helper):
  - `a slide without purpose, from and sources renders`: `<Explain id="1-001" section="Topic" title="T" body="B" visual={<svg data-testid="own" />} />` renders the title, the body and `own`, and has no `.rs-sources` footer.
  - `a node is accepted as the visual of every layout that takes one`: the same for `Cover`, `Focus`, `Steps` (`items`), `Topic` (a divider), `Objectives`, `Summary`.
  - `an old data visual still renders`: existing tests cover it; keep them green.
  - `SlideFrame marks the section and the phase`: `<Explain … phase="know">` → the `.rs-slide` has `data-section="Topic"` and `data-phase="know"`.

- [ ] **Step 3: Run them: `npm --prefix … test -- layouts`**. Expected: FAIL (type error or missing attribute; vitest runs types loosely, so also run `npm --prefix … run build` and expect the `tsc` error for the missing `purpose`).

- [ ] **Step 4: Implement.** `types.ts`: make `purpose`, `from`, `sources` optional in `Base`; add `export type VisualProp = Visual | ReactNode`. `layouts.tsx`: change every `visual?: Visual` / `visual: Visual` to `VisualProp`; `slot()` returns a node unchanged when the value has no `kind` string field (a React element or text), else `<VisualSlot>`. `SlideFrame.tsx`: `(slide.sources ?? [])`, and the two data attributes. `package.json`: version `2.0.0`.

- [ ] **Step 5: Run `npm --prefix … test` and `npm --prefix … run build`.** Expected: all pass, no `tsc` errors (fix the fixtures under `src/__fixtures__` only if they break, with the smallest change).

- [ ] **Step 6: Commit** `feat(part-slides): let a slide carry no research metadata and take a node as its visual`.

---

### Task 2: Readability budgets and the slide list in the check page

**Files:**
- Create: `template/src/check/budgets.ts`, `template/src/check/budgets.test.ts`
- Modify: `template/src/check/findings.ts` (add kind `'budget'`, and `slides` to `CheckResult`), `template/src/check/CheckPage.tsx`, `template/src/check/CheckPage.test.tsx`

**Interfaces:**
- Produces: `type SlideInfo = { id: string; section: string; phase?: Phase; divider: boolean; title: string; chars: number }`; `budgets(slides: SlideInfo[], language: string): Finding[]` (`slide` is the slide id, or `''` for a Part-level finding; `frame` is `''`; `kind` is `'budget'`; `level` `'problem'` or `'note'`); `CheckResult.slides: SlideInfo[]`. `SlideFrame`'s `data-section`/`data-phase` (Task 1) and the class `rs-divider` on a divider (add it to `Topic` in every case, not only with topics) are what the page reads.

- [ ] **Step 1: Write the failing tests** in `budgets.test.ts`, one per rule (a helper builds `SlideInfo`s):
  - `a topic of ten slides is a problem on its tenth, nine is fine`.
  - `the Opening has at most three slides`.
  - `a Part of 41 slides is a problem, 36 is a note, 35 is fine`.
  - `prose over 160 characters is a problem in Thai and fine in English up to 220`.
  - `phases out of order are named on the slide that breaks the order only` (`know, parts, example, parts` flags the last `parts`, not `example`).
  - `a divider has no phase and a section whose first slide is not a divider is a problem, but a section with no topic (Opening, Closing) is not`.
  - `a Part with only an Opening and a Closing has no findings`.

- [ ] **Step 2: Run `npm … test -- budgets`.** Expected: FAIL (module missing).

- [ ] **Step 3: Implement `budgets()`** as a pure function: group by `section`; `Opening` and `Closing` (the strings the template's `sectionLabel` maps) are not topics. Use `findings.ts`'s `Finding` shape. Keep the limits as named constants at the top of the file.

- [ ] **Step 4: Wire the page.** In `CheckPage.tsx` `measure()` also collects a `SlideInfo` per slide of the desktop frame (`id` from `data-slide`, `section`/`phase` from the data attributes, `divider` from `.rs-divider`, `title` from `.rs-title`, `chars` from the text of `.rs-title` and `.rs-prose` with every `pre` and `.rs-codeblock`, `.rs-output` removed); `findings()` results are concatenated with `budgets(slides, meta.language)`; `window.__reactSlidesCheck` gets `slides`. Add a `CheckPage.test.tsx` case: a Part whose topic has ten slides reports a `budget` finding and `slides` lists every slide with its section.

- [ ] **Step 5: Run the whole template suite and the build.** Expected: pass.

- [ ] **Step 6: Commit** `feat(part-slides): report readability budgets and the slide list from the check page`.

---

### Task 3: scaffold.py

**Files:**
- Create: `skills/teaching/part-slides/scripts/scaffold.py`, `tests/conftest.py`, `tests/test_scaffold.py`

**Interfaces:**
- Produces: `scaffold.run(course_dir: Path, *, title: str | None, language: str | None, part: int | None, slug: str | None, part_title: str | None, skip_install: bool, template_dir: Path = TEMPLATE_DIR) -> dict` with keys `created: list[str]`, `skipped: list[str]`, `install: 'ran' | 'skipped' | 'not-needed' | 'failed'`; `scaffold.main(argv) -> int` printing the report as JSON. CLI: `scaffold.py <course_dir> [--title T] [--language L] [--part N --slug S --part-title T] [--skip-install]`.

- [ ] **Step 1: Write the failing tests** (a tiny template fixture dir built in `tmp_path`, plus one test against the real template that only checks the file list):
  - `creates the app from the template, without node_modules, dist or test files`.
  - `writes src/course.ts with the title and slug` (`export const course = { slug: '<folder name>', title: '<title>' };`).
  - `a second run creates nothing and keeps an edited file`.
  - `--part 1 creates parts/01-<slug>/ and src/parts/part-01.tsx and part-01.data.ts`, where the data file exports `meta = { course, part: 1, slug, title, language, slideCount: 0 }` and the TSX file is a default-exported component rendering an empty `<Deck …>` with an Opening placeholder cover; an existing Part file is skipped.
  - `part numbers under 10 are zero padded and 10 is not`.
  - `--skip-install runs no npm; without it npm install runs only when node_modules is missing` (inject the runner as a module-level `_run` that the test replaces).
  - `exit status 1 with an error line on stderr when the course folder cannot be created or the template is missing`.

- [ ] **Step 2: Run them** (`uv run --no-project --python 3.12 --with pytest pytest skills/teaching/part-slides/tests -q`). Expected: FAIL (module missing).

- [ ] **Step 3: Implement `scaffold.py`** with the `template_files`-style walk of `build_part.py` (skip `node_modules`, `dist`, `.test.ts`, `.test.tsx`, `src/__fixtures__`, `src/check/*.test.*`), writing a file only when absent.

- [ ] **Step 4: Run them.** Expected: pass.

- [ ] **Step 5: Commit** `feat(part-slides): add scaffold.py to create the course app and a Part skeleton`.

---

### Task 4: SKILL.md and the five references

**Files:**
- Create: `skills/teaching/part-slides/SKILL.md`, `references/interview.md`, `references/research.md`, `references/plan-list.md`, `references/slides.md`, `references/check-and-revise.md`, `tests/test_skill_md.py`, `tests/test_references.py`

**Interfaces:**
- Consumes: the scaffold CLI (Task 3), the budgets (Task 2) and the layouts and figures of the template (Task 1; `references/slides.md` lists the layouts and figures by reading `template/src/components/layouts.tsx` and `figures.tsx` exports).

- [ ] **Step 1: Write the failing tests.**
  - `test_skill_md.py`: frontmatter has `name` equal to the folder name and a description under 1,024 characters that starts with "Use when"; the body has the reporting section with `<course_dir>/skill-problems.md`; every relative `references/…` link resolves; the file is at most 160 lines.
  - `test_references.py`: each reference exists and is linked from `SKILL.md`; `slides.md` names every exported layout component that `layouts.tsx` exports (parsed with a regex on `export function (\w+)(`), so the brief cannot drift from the template; `plan-list.md` states the same budget numbers as `check/budgets.ts` (the test reads the constants with a regex and checks each number appears).

- [ ] **Step 2: Run them.** Expected: FAIL (files missing).

- [ ] **Step 3: Write the files**, following the design's "The flow", "What a Part looks like" and "Readability rules". Content each file must carry:
  - `SKILL.md`: the role (you talk with the user, research, plan, write TSX, build and check); the start/resume rules from the files present; the five steps with the two conversational checkpoints (what I understood, the plan list); the no-subagent rule (everything inline; one optional subagent for drawing pictures is not used in v1); the course-notes read and write; the reporting section.
  - `interview.md`: the questions, one at a time, with why each is asked; what to do on "I don't know"; the non-interactive fallback (`Assumed:` lines).
  - `research.md`: how to research one Part (search tools first, then fetching known pages, else knowledge marked `unverified`); the `research.md` format per topic; the "what I understood" summary and how to present it.
  - `plan-list.md`: the `plan.md` format (title, `Status:` line, story, table per topic, optional `Assumed:` and `Unverified:` lists), the budgets, how to present the table and apply edits, the approval line.
  - `slides.md`: file layout (`part-NN.tsx`, `part-NN.data.ts`, `src/visuals/part-NN.tsx`); one section per layout with its props; how to write a picture (figures first, then own SVG from the sketch primitives, then an image file) with the drawing rules (viewBox about 460 × 330, labels at least 16 px, no two labels closer than their own width, role colours from `roleColour`); code listings: run the code, paste real output; the readability rules verbatim from the design.
  - `check-and-revise.md`: build, serve, open the check page, read `findings` and `slides`; which screenshots to take and what to look for (label collisions, text over pictures, a slide that needs two readings); the revision loop by slide id; updating `plan.md`; writing `course-notes.md`.

- [ ] **Step 4: Run the tests.** Expected: pass.

- [ ] **Step 5: Commit** `feat(part-slides): write the skill and its briefs`.

---

### Task 5: An end-to-end fixture Part and the repo wiring

**Files:**
- Create: `skills/teaching/part-slides/tests/fixtures/part-01.tsx`, `tests/fixtures/part-01.data.ts`, `tests/test_app_build.py`, `evals/acceptance.md`
- Modify: `AGENTS.md` (the layout list gets a `part-slides` line, and the Tests block gets the part-slides commands: the npm lines, then the pytest line)

- [ ] **Step 1: Write the failing test** `test_app_build.py::test_a_scaffolded_app_with_a_fixture_part_builds_and_passes_its_own_check`: scaffold into `tmp_path` with `--skip-install`, symlink the template's `node_modules`, copy the fixture Part over the skeleton (a made-up neutral subject: "sorting a list", one Opening cover, one topic with a divider, two `know`/`parts` slides with an own-SVG visual and a figure, one `example` with a listing and an output, a closing summary and sources), run `npm run build`, and assert `dist/index.html` exists with relative asset paths. Skipped when the template has no `node_modules`.

- [ ] **Step 2: Run it.** Expected: FAIL until the fixture exists, then pass once it compiles; if the build fails, fix the template or the fixture, not the test.

- [ ] **Step 3: Write `evals/acceptance.md`**: a table of checks for the real run: the interview asked one question at a time; research.md has sources; the "what I understood" summary was shown; the plan list was approved; the check page shows no budget finding; every distinct picture was looked at; one slide was revised with one edit and one rebuild; the user's verdict against the hand-written demo and the old pipeline's deck. Results are filled in after the run.

- [ ] **Step 4: Edit `AGENTS.md`**, then run the whole repo's tests for every skill touched: part-slides (pytest, vitest, build) and `report-skill-issue` (the hook test covers the new `SKILL.md`). Expected: all pass.

- [ ] **Step 5: Commit** `feat(part-slides): add an end-to-end fixture, the acceptance checks and the repo wiring`.
