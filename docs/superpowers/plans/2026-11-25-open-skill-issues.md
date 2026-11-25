# Open skill issues (#11 to #14) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four open issues in `ArrayaWongsaita/skills-issues` and ship the already-committed foreman frontmatter fix, as three PRs.

**Architecture:** Each fix starts with a failing test in the skill's own `tests/` (pytest) or in the part-slides template (vitest), then the smallest change to the script, the template or the reference that the test pins. The part-slides layout and fill changes are also checked in a real browser, because jsdom does no layout.

**Tech Stack:** stdlib Python 3.11+ with pytest; React + TypeScript + vitest (pnpm) in `skills/teaching/part-slides/template`; rough.js for the sketch primitives; the chrome-devtools MCP for the screenshots.

**Spec:** `docs/superpowers/specs/2026-11-25-open-skill-issues-design.md`

## Global Constraints

- Code, comments, docs, commit messages, PRs and issues in English. Talk with the user in Thai.
- Conventional Commits with the skill as the scope; one commit per change (per issue).
- Branches: `fix/foreman-yaml-description` (exists, 2 commits), `fix/opencode-delegate-session-id`, `fix/part-slides-ids-anatomy-highlight` (exists, holds the spec and this plan, uncommitted). Each from `origin/main`, upstream unset until the first `git push -u`.
- Each PR description says `Closes ArrayaWongsaita/skills-issues#<n>` for each issue it fixes; after opening, comment `Fix: <PR URL>` on each issue (AGENTS.md, steps 5 and 6).
- Public repo: no paths, logs or course content from the issues in branches, commits, PRs or fixtures. Made-up inputs only.
- Scripts and Python tests are stdlib only. JS uses pnpm.
- Test commands, from the repo root:
  - `uv run --no-project --python 3.12 --with pytest pytest skills/meta/opencode-delegate/tests -q`
  - `pnpm --dir skills/teaching/part-slides/template test` and `pnpm --dir skills/teaching/part-slides/template run build`
  - `uv run --no-project --python 3.12 --with pytest pytest skills/teaching/part-slides/tests -q`

## Review Focus

- A session id of exactly `ses` or `SES_x`: opencode's rule is a case-sensitive prefix, so `ses` passes and `SES_x` fails. Pinned in Task 2's parametrized test.
- A Part with two slides sharing one id (a copy-paste): reported as `id-order`, since the second is not greater. Pinned in Task 3.
- An id from another Part (`2-005` inside Part 1) or a malformed id (`1-5`): reported as `id-order`. Pinned in Task 3.
- An `Anatomy` piece with no spaces at all (`aVeryLongIdentifierWithoutSpaces…`): still must not overflow the phone frame, so the wrap must break inside a word. Checked in Task 4's browser step with a no-space piece.
- An own drawing that passes `fill` and `fillStyle="solid"` (the `Diagram` badges do): stays fully opaque; only an omitted `fillStyle` becomes the tint. Pinned in Task 5.

---

### Task 1: Ship the foreman frontmatter fix

**Files:** none new; branch `fix/foreman-yaml-description` already has `1af51af fix(foreman): …` and `1234423 test(report-skill-issue): …`.

- [ ] **Step 1: Re-run both skills' tests on the branch**

Run: `git switch fix/foreman-yaml-description`, then the foreman and report-skill-issue test commands from AGENTS.md.
Expected: `42 passed` and `104 passed`.

- [ ] **Step 2: Push and open the PR**

`git push -u origin fix/foreman-yaml-description`, then `gh pr create --base main` with title `fix(foreman): make the description valid YAML so the installer stops skipping the skill`. No issue to close; the body says what broke (installer `YAML parse error … line 2, column 14`), the fix, and the new repo-wide test.

---

### Task 2: #11, a session id that opencode will take

**Files:**
- Modify: `skills/meta/opencode-delegate/scripts/opencode_turn.py` (docstring usage and exit 3 line, `parse` help for `--session`, the start of `main`)
- Modify: `skills/meta/opencode-delegate/SKILL.md` (the `--session` bullet, the exit codes bullet)
- Test: `skills/meta/opencode-delegate/tests/test_opencode_turn.py`, `skills/meta/opencode-delegate/tests/test_skill_md.py`

**Interfaces:**
- Produces: exit 3 and a stderr line containing `"ses"` and `ses_fixlogin01` when `--session` does not start with `ses`; checked first in `main`, before the folder, the binary and `--detach`.

- [ ] **Step 1: Branch**

`git switch -c fix/opencode-delegate-session-id origin/main && git branch --unset-upstream`

- [ ] **Step 2: Write the failing tests**

```python
@pytest.mark.parametrize("session", ["s", "my-task", "SES_x", "", "x_ses"])
@pytest.mark.parametrize("detach", [False, True])
def test_a_session_id_that_does_not_start_with_ses_is_exit_3_before_anything_starts(session, detach, fake_opencode, project, tmp_path, capsys, monkeypatch):
    # Popen replaced by a function that raises "a process was started"; argv as in turn()/detach_argv() with this session
    assert code == 3
    err = capsys.readouterr().err
    assert '"ses"' in err and "ses_fixlogin01" in err
    assert not (tmp_path / "turn.log").exists()

@pytest.mark.parametrize("session", ["ses", "ses_x", "ses_fixlogin01"])
def test_a_session_id_that_starts_with_ses_is_passed_to_opencode(session, fake_opencode, project, tmp_path):
    # fake prints sys.argv; assert f"'-s', '{session}'" in the log and code == 0
```

In `test_skill_md.py`:

```python
def test_the_skill_says_what_a_session_id_looks_like(skill_md):
    assert "starts with `ses`" in skill_md and "ses_fixlogin01" in skill_md
```

Change `"--session", "s"` to `"--session", "ses_x"` in the three existing exit-3 tests (missing opencode, missing folder, detach without status file) so they keep testing what they name.

- [ ] **Step 3: Run them to verify the new ones fail**

Run: the opencode-delegate test command.
Expected: the `does_not_start_with_ses` cases and the skill_md test FAIL; everything else passes.

- [ ] **Step 4: Implement**

In `main`, right after `parse`: when `not args.session.startswith("ses")`, print to stderr
`error: --session must start with "ses", such as ses_fixlogin01 (ses_ then letters and digits); opencode rejects any other id`
and return 3. `--session` help: `session id starting with "ses", such as ses_fixlogin01: continued if it exists, created if not`. Docstring: usage `--session ses_ID`, and exit 3 also covers a session id opencode would reject.

`SKILL.md`, the `--session` bullet becomes:
`- **`--session`:** an id that starts with `ses`, such as `ses_fixlogin01` (`ses_`, then letters and digits); opencode rejects any other, and the script stops with exit 3 before it starts. It continues that session if it exists and creates it if not. Use one id per task and reuse it for every follow-up turn.`
The exit codes bullet: `3 could not start (no `opencode`, no such folder, a session id that does not start with `ses`)`.

- [ ] **Step 5: Run the tests to verify they pass**

Expected: all opencode-delegate tests pass (37 before, plus the new ones).

- [ ] **Step 6: Commit, push, PR, link**

```bash
git add skills/meta/opencode-delegate
git commit -m "fix(opencode-delegate): stop at once on a session id that does not start with ses, and say the format"
git push -u origin fix/opencode-delegate-session-id
```
PR body: `Closes ArrayaWongsaita/skills-issues#11`. Then `gh issue comment 11 -R ArrayaWongsaita/skills-issues --body "Fix: <PR URL>"`.

---

### Task 3: #12, slide ids that run in file order

**Files:**
- Create: `skills/teaching/part-slides/template/src/check/ids.ts`, `skills/teaching/part-slides/template/src/check/ids.test.ts`
- Modify: `skills/teaching/part-slides/template/src/check/findings.ts` (`FindingKind` gains `'id-order'`)
- Modify: `skills/teaching/part-slides/template/src/check/CheckPage.tsx` (merge the id findings with the problems)
- Modify: `skills/teaching/part-slides/references/plan-list.md`, `skills/teaching/part-slides/references/slides.md`, `skills/teaching/part-slides/references/check-and-revise.md` (if it lists the finding kinds)
- Test: `skills/teaching/part-slides/template/src/check/CheckPage.test.tsx`, `skills/teaching/part-slides/tests/test_references.py`

**Interfaces:**
- Produces: `export function idOrder(slides: SlideInfo[], part: number): Finding[]` in `check/ids.ts`. Each finding is `{ slide: <id>, frame: '', kind: 'id-order', level: 'problem', detail }`.

- [ ] **Step 1: Commit the spec and this plan on the branch**

`git switch fix/part-slides-ids-anatomy-highlight`; `git add docs/superpowers && git commit -m "docs(skills): add the design and the plan for the open skill issues"`.

- [ ] **Step 2: Write the failing tests** (`ids.test.ts`, with the `slide()` helper style of `budgets.test.ts`)

```ts
test('ids that ascend have no findings', () => expect(idOrder(ids('1-001', '1-002', '1-010'), 1)).toEqual([]));
test('a slide whose id is not greater than the one before is reported, and only that slide', () => {
  expect(idOrder(ids('3-014', '3-016', '3-015', '3-017'), 3).map((f) => f.slide)).toEqual(['3-015']);
});
test('a repeated id is reported', () => expect(idOrder(ids('1-001', '1-002', '1-002'), 1).map((f) => f.slide)).toEqual(['1-002']));
test.each(['1-5', 'x', '2-005', '1-0001'])('an id that is not <part>-<nnn> for this Part is reported: %s', (bad) => {
  expect(idOrder(ids('1-001', bad), 1)).toEqual([expect.objectContaining({ slide: bad, kind: 'id-order', level: 'problem' })]);
});
test('the detail names the slide before and says to renumber', () => {
  expect(idOrder(ids('1-002', '1-001'), 1)[0].detail).toMatch(/1-001.*1-002.*renumber/);
});
```

In `CheckPage.test.tsx`: a two-slide Part with ids `1-002`, `1-001` publishes one `id-order` problem on `1-001`.

In `test_references.py`: `plan-list.md` contains `in the order the slides run` and `renumber`; `slides.md` contains `renumber`.

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --dir skills/teaching/part-slides/template exec vitest run src/check` and the part-slides pytest command.
Expected: `ids.test.ts` fails to import `idOrder`; the CheckPage and references tests fail.

- [ ] **Step 4: Implement**

`idOrder`: an id is valid when it matches `^${part}-\d{3}$`; an invalid id gives `id ${id} is not ${part}-<nnn>`; a valid id whose number is not greater than the last valid id before it gives `id ${id} comes after ${previous} in the file: renumber the slides so the ids run in the order the slides run`. In `CheckPage`, compute `idOrder(slides, part)` and put its findings with the other problems, before the notes.

`plan-list.md`, under the file's `#` description: `Number the rows in the order the slides run, phase order inside each topic, with no gaps. When an edit adds, removes or moves a row, renumber the rows after it.` Add `Slide ids ascend in the order the slides run.` to the budgets list (the check page enforces it).

`slides.md`, after "keep the slide ids and the order of the plan": `When the phase order forces you to move a slide the plan put elsewhere, renumber the slides so the ids still run in file order, and tell the user which rows moved. The check page reports an id that does not.`

- [ ] **Step 5: Run the template tests and the part-slides pytest**

Expected: all pass, including the end-to-end fixture Part (its ids already ascend).

- [ ] **Step 6: Commit**

`git commit -m "fix(part-slides): number plan rows in the order the slides run, and report ids that do not ascend"`

---

### Task 4: #13 and the Error labels, prose that is prose and pieces that wrap

**Files:**
- Modify: `skills/teaching/part-slides/template/src/check/CheckPage.tsx` (`proseChars`: also skip `.rs-anatomy-strip, .rs-label`)
- Modify: `skills/teaching/part-slides/template/src/theme/base.css` (`.rs-piece`)
- Modify: `skills/teaching/part-slides/references/slides.md` (the `Anatomy` paragraph)
- Test: `skills/teaching/part-slides/template/src/check/CheckPage.test.tsx`, `skills/teaching/part-slides/tests/test_references.py`

- [ ] **Step 1: Write the failing tests** (CheckPage, Thai Part, so `.length` counts code units of single-code-point letters)

```ts
// Anatomy: title ค, body ก, items [ข, ง], pieces with 60 characters of code
expect(slides[0].chars).toBe('ค กขง'.length);
// Error: title ค, cause ก, fix ข, symptom ง: the labels อาการ, สาเหตุ, วิธีแก้ are not counted
expect(slides[1].chars).toBe('ค งกข'.length);
```

A CSS test (vitest reading `theme/base.css` as text): the `.rs-piece` rule has `white-space: pre-wrap`, `overflow-wrap: anywhere` and `min-width: 0`. In `test_references.py`: `slides.md` contains `cut it into more pieces`.

- [ ] **Step 2: Run them to verify they fail**

Expected: both `chars` assertions fail with the larger counts; the CSS and references tests fail.

- [ ] **Step 3: Implement**

`proseChars` skip list becomes `pre, .rs-codeblock, .rs-output, .rs-block, .rs-anatomy-strip, .rs-label`; update its comment. `.rs-piece`: `white-space: pre-wrap; overflow-wrap: anywhere; min-width: 0; max-width: 100%`.

- [ ] **Step 4: Run the template tests**

Expected: all pass.

- [ ] **Step 5: Measure in a real browser and write the guidance**

Scaffold a scratch course in the session scratchpad the way `tests/test_app_build.py` does (`scaffold.run(..., language="th", skip_install=True)`, symlink the template's `node_modules`), with a Part holding an `Anatomy` slide with a made-up piece of about 40 characters, such as `basket.addFruit("mango", { count: 3, ripe: true })` and one with a 50-character piece that has no spaces. `pnpm run build`, serve `dist` on a free port (check it with `lsof -ti tcp:<port>` first), open `#/check/part-01` with the chrome-devtools MCP.
Expected: no `prose-overflow` on either slide in the phone frame, and the long piece wraps inside its box. Measure how many monospace characters fit on one strip line in the phone frame (strip width ÷ one character's width) and round down to a multiple of 5: that is N.

Then the `Anatomy` paragraph of `slides.md` gains: `A piece wider than the screen wraps inside its box, which is harder to read: keep each piece to about N characters, which fit on one line on a phone, and cut a longer call into more pieces (the object, the method, each argument). The code in the strip does not count toward the slide's text.`

- [ ] **Step 6: Run the part-slides pytest and commit**

`git commit -m "fix(part-slides): leave the Anatomy strip and the Error labels out of the text count, and let a long piece wrap"`

---

### Task 5: #14, a highlight that keeps its label readable

**Files:**
- Modify: `skills/teaching/part-slides/template/src/components/sketch.tsx` (`SketchStyle`, `options`, `Paths`)
- Modify: `skills/teaching/part-slides/template/src/components/figures.tsx` (`Bars` keeps hachure; the lit `Box` stroke only if the screenshot calls for it)
- Modify: `skills/teaching/part-slides/references/slides.md` (rules for a drawing)
- Test: `skills/teaching/part-slides/template/src/components/sketch.test.tsx`, `skills/teaching/part-slides/template/src/components/figures.test.tsx`, `skills/teaching/part-slides/tests/test_references.py`

**Interfaces:**
- Produces: `export const TINT: number` in `sketch.tsx` (the opacity of a fill whose `fillStyle` is omitted) and `SketchStyle.fillOpacity?: number`.

- [ ] **Step 1: Take the "before" screenshots**

In the scratch course of Task 4 (rebuilt from the current template), add an `Explain` slide with `<Cells cells={['3', '1', '4', '1']} highlight={1} />` and one with an own drawing: a `SketchRect` with `fill={roleColour('accent')}` and a centred label. Screenshot both at 1280 × 720 into the scratchpad.

- [ ] **Step 2: Write the failing tests**

```ts
// sketch.test.tsx
test('a fill without a fillStyle is a pale solid tint with no hatch lines', () => {
  // SketchRect stroke="#000" fill="#e08a2e": a path has fill="#e08a2e" and fill-opacity=String(TINT); no path has stroke="#e08a2e"
});
test('an explicit fillStyle keeps its look: hachure draws hatch lines, solid stays opaque', () => {
  // fillStyle="hachure": some path has stroke="#e08a2e"; fillStyle="solid": the fill path has no fill-opacity below 1
});
// figures.test.tsx
test('a highlighted box is tinted behind its label, with no hatch lines', () => {
  // Cells highlight=1: in the [data-highlight="true"] element, a path has fill-opacity=String(TINT), and no path has stroke-width="1"
});
test('bars keep their hachure fill', () => { /* a bar's [data-el] has a path with stroke=roleColour('primary') and stroke-width="1" */ });
```

`test_references.py`: `slides.md` contains `never put a label on a hachure fill`.

- [ ] **Step 3: Run them to verify they fail**

Expected: the tint tests fail (today's default is hachure); `bars keep their hachure fill` passes already and must keep passing.

- [ ] **Step 4: Implement**

`options`: with `fill` and no `fillStyle`, use `fillStyle: 'solid'`; an explicit `fillStyle` keeps today's options (`hachureGap: 7, fillWeight: 1`). `Paths`: give a path whose `fill` is set and not `'none'` the attribute `fillOpacity`: `style.fillOpacity` when given, else `TINT` when `style.fillStyle` was omitted, else none. Start with `TINT = 0.18`. `Bars`: pass `fillStyle="hachure"`.

`slides.md`, the `fill` mention in "Your own drawing" and a new rule: `A fill without a fillStyle is a pale tint that a label can sit on. Never put a label on a hachure fill: its lines cross the text. Use fillStyle="hachure" only for a shape with no text inside, and mark a highlight with the tint and a thicker stroke.`

- [ ] **Step 5: Run the template tests**

Expected: all pass, including `the same figure draws the same way every time`.

- [ ] **Step 6: Take the "after" screenshots and tune**

Rebuild the scratch course and take the same two screenshots. Expected: the labels read clearly and the highlighted box still stands out from the others. If it does not, change `TINT` (between 0.12 and 0.3) or the lit stroke width in `Box`, rerun Step 5, and say which value was chosen and why in the commit body.

- [ ] **Step 7: Run every part-slides check and commit**

Run: the pnpm test and build lines, then the part-slides pytest.
`git commit -m "fix(part-slides): tint a fill without a fillStyle instead of hatching it, so a highlighted label stays readable"`

---

### Task 6: Ship the part-slides PR

- [ ] **Step 1: Push and open the PR**

`git push -u origin fix/part-slides-ids-anatomy-highlight`; `gh pr create --base main`, body with `Closes ArrayaWongsaita/skills-issues#12`, `#13`, `#14` on separate lines, the before/after finding for each, and that the Error-label count from the open-problems memory is fixed too.

- [ ] **Step 2: Link the PR from each issue**

`gh issue comment <n> -R ArrayaWongsaita/skills-issues --body "Fix: <PR URL>"` for 12, 13, 14.

- [ ] **Step 3: Update the open-problems memory**

Remove the "Prose budget counts Error field labels" line from `part-slides-open-problems.md` and say it was fixed in the PR.

- [ ] **Step 4: Clean up**

Stop the preview server started for the screenshots and delete the scratch course.
