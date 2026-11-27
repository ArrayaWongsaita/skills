# Design: fix the open skill issues (#15 to #22) and the unreported part-slides problems

- Date: 2026-11-27
- Status: Approved 2026-11-27
- Size: a project (eight issues and three unreported problems, one PR per issue)
- Touches: `skills/teaching/part-slides/` (scaffold script, template code box, check page, `Compare` layout, `references/slides.md`, `references/plan-list.md`, `references/check-and-revise.md`) and `skills/meta/opencode-delegate/` (`opencode_turn.py`, `SKILL.md`)

## Intent

One long course run with OpenCode workers and a foreman session filed eight issues. In most of them the skill let an agent build something wrong without saying so: the check page said `problems=0` on clipped slides, a status said `failed` on finished work, a rule had no answer for a real topic. Each fix makes the skill report the problem itself or answer the case, so the next run does not need trial and error or a re-check by hand.

## Goals

- **#21 (scaffold language):** a Part added without `--language` takes the language of the course's existing Parts. If there is no existing Part, or the existing Parts disagree, `scaffold.py` stops with a message that asks for `--language`. Passing `--language` still wins.
- **#22 (opencode-delegate status):** when a turn ends `failed` and the log tail shows a known cause that can come after the work was done, the status line says so: `status=failed exit=1 cause=<input-cancelled|connection-reset> log=…`. `SKILL.md` "When it goes wrong" says that `failed` with a `cause=`, and `stopped` while the worker waits on its own background job, can still mean the work is finished, and that the caller must read the files to decide. The exit code and the `status=` values do not change, so current callers still work.
- **#15 and #16 (code box overflow):**
  - The check page reports a code or output box that overflows at 1280 × 720 as a `problem`, not a note: `clipped-code` for a box that is too tall (with how many rows are hidden) and `wide-line` for a line wider than the box (with the line number and its width in characters against the width that fits). On the phone frame, sideways overflow stays a `note` (a phone shows about 40 characters, so it is expected).
  - A code box whose line is wider than the box shows a right-edge fade, the same kind of cue as the existing bottom fade.
  - `slides.md` Code rule 5 stops giving exact row counts as the limit. It gives a rough starting point, says a `…` gap marker between ranges takes a row, and says the check page is the judge.
- **#17 (Compare with a picture):** `Compare` takes an optional `visual`, shown above the two panels (or beside them when the layout has room; the builder picks whichever fits at 1280 × 720 and on the phone). The layout table and `plan-list.md` list it. `Code`, `Example` and `Output` do not get a `visual` (see Decided with the user).
- **#18 (budget fields):** `plan-list.md` "The budgets" says what the check page counts toward 160/220 characters, as `proseChars` in `check/CheckPage.tsx` does: the title and every text field on the slide (body, items, notice, `Compare`'s left, right and takeaway, an `Error` slide's symptom, cause and fix, and so on). Not counted: code and its output, an `Anatomy` strip, and the template's own field labels.
- **#19 (more parts than the cap):** `plan-list.md` "parts" says: when a topic has more parts than its 9 slides allow, merge parts the learner uses together and name each merged pair in the plan row, or split the topic in two. Ask the user which, when the plan is presented.
- **#20 (a topic with two ideas):** `plan-list.md` says a topic that carries two ideas that each need their own picture is two topics, each with its own divider and rhythm.
- **Preview port (unreported problem):** `check-and-revise.md` starts the preview with `--strictPort`, so a busy port fails loudly instead of quietly serving another course. The check result gains the course slug (`course`), and the doc says to confirm it matches before reading findings.
- **Unreported problems filed first:** the workshop phase, the second Part of one subject, and the preview port are filed to `skills-issues` with `report-skill-issue`, so each fix has an issue to close, as AGENTS.md asks.

## Non-goals

- Designing a workshop phase or reusing a brief and research for a second Part. They are filed as issues here and get their own design later: each changes how a Part is planned, not a single rule.
- Exact measured row counts per layout. The check page decides; the doc gives a starting point only.
- Wrapping long code lines. A wrapped line no longer matches the copied program line for line, and it breaks the line numbers that `highlight` uses.
- Changing opencode itself, or reading opencode's internal session data to decide whether a turn finished.

## Anti-goals

- A check page that stays quiet about a slide a learner cannot read. A note that nobody acts on counts as quiet.
- A `status=done` for a turn whose work the script cannot see: the script reports what it saw, and the caller checks the files.
- Breaking existing courses: a course on an older template still updates with `scaffold.py`, and a `Compare` without `visual` renders as it does today.

## Approaches

Decided first, for the whole batch: fix in code where the skill can detect the problem itself, not in docs only (user's pick). A doc-only fix would need re-measuring whenever the fonts or frames change.

| Issue | Considered | Picked, and why |
|---|---|---|
| #15, #16 | re-measure and rewrite the numbers · promote the existing overflow measurement to problems and add a right-edge fade · wrap long lines | promote and fade: `code.tsx` already marks `data-scrolls` / `data-scrolls-x`, the check page only filed them as notes, so the fix is small and does not depend on numbers; wrapping breaks line numbers and the copy button |
| #17 | doc rule "use Explain + visual" · `visual` on `Compare` | `visual` on `Compare`: a picture comparison is common in picture-first Parts, and the rule would keep sending planners the wrong way |
| #21 | require `--language` always · inherit from existing Parts, fail when unknown | inherit, fail when unknown: a second Part needs no extra flag, and a first Part never gets a silent `en` |
| #22 | docs only · a `cause=` field from the log tail plus docs · a new status value | `cause=` plus docs: callers that parse `status=` and the exit code keep working, and the caller learns why without opening the log |
| #19, #20 | raise the cap · allow two picture know slides · merge or split | merge or split: the 9-slide cap is a readability rule the user set, and a topic with two ideas reads better as two topics |
| Delivery | one PR per issue · one PR per skill | one PR per issue, as AGENTS.md says; template PRs are merged one at a time and each re-runs `record_template_versions.py`, so `template-versions.json` does not conflict |

## Decided with the user

- Fix in code where possible (option ก).
- Add `visual` to `Compare` only. `Code`, `Example` and `Output` stay without a picture, because "code slides stay code slides" is a confirmed rule; the open-problems memory entry "no picture beside code" is dropped.
- One PR per issue, in this order: #21, #22; then #15+#16 (one PR, the same code box and check finding), #17; then #18, #19, #20; then file the three unreported problems and fix the preview port.

## Calls I made (check these)

- #15 and #16 share one PR and close both issues: they change the same function in `code.tsx` and the same finding list.
- New finding kinds `clipped-code` and `wide-line` replace `scrolling-block` on the desktop frame; the phone keeps a `scrolling-block` note for sideways overflow, and a phone box that is too tall is a `clipped-code` problem too.
- `wide-line` counts width in characters of the monospace font, so the message says "line 18 is 141 characters, the box fits 96".
- #22 detects only two causes, from the last lines of the log: the line `Cancelled a request for input this run cannot answer`, and `ECONNRESET`. Anything else stays a plain `failed`.
- The preview port fix gets its own issue first, like the other two unreported problems.

## Constraints

- Code, comments, docs, commits and issues in English; Conventional Commits with the skill as the scope; one commit per change.
- After any change in `template/`, run `record_template_versions.py` and commit the JSON with it.
- Each fix starts with a failing test made of a made-up input; no paths, logs or course content from the issues go into the public repo.
- Run each touched skill's tests from AGENTS.md before opening the PR.

## Left to the builder

- Where `visual` sits in `Compare` (above or beside the panels), as long as both frames pass the check page.
- How the right-edge fade is drawn (mask or gradient overlay), matching the existing bottom fade.
- The exact wording of the doc changes.
