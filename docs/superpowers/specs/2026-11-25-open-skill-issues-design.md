# Design: fix the open skill issues (#11 to #14) and the foreman frontmatter

- Date: 2026-11-25
- Status: Approved 2026-11-25
- Size: a small change per issue
- Touches: `skills/meta/opencode-delegate/`, `skills/teaching/part-slides/` (references, template check page, sketch and figures), and, already done, `skills/meta/foreman/SKILL.md` and `skills/meta/report-skill-issue/tests/test_repo_hooks.py`

## Intent

Four issues came back from real runs, and the installer skips `foreman` on `main` because its description is not valid YAML. Each fix removes a cause of hand work or of a wrong check result, so the next run does not hit it again.

## Goals

- **Foreman frontmatter:** `main` gets the description that parses, and a repo-wide test that catches a `: ` or ` #` in an unquoted frontmatter value. Done on `fix/foreman-yaml-description`.
- **#11 (opencode-delegate):** a session id that does not start with `ses` stops before opencode starts, with exit 3 and a message that gives the format. `SKILL.md` and `--help` give the format (`ses_` then letters or digits, such as `ses_fixlogin01`).
- **#12 (part-slides):** plan ids run in the order the slides run. `plan-list.md` says to number rows in phase order and renumber after an edit. `slides.md` says to renumber when the writer has to move a slide. The check page reports ids that do not ascend in file order.
- **#13 (part-slides):** the code in an `Anatomy` strip is not counted as prose. A long piece wraps inside its own box, so it never runs off a 390 px phone. `slides.md` gives the longest piece that fits on a phone (measured) and says to cut a longer call into more pieces.
- **Error labels (from the open-problems memory, same function as #13):** the "symptom / cause / fix" labels of an `Error` slide are not counted as prose.
- **#14 (part-slides):** a filled shape whose `fillStyle` is not given gets a pale solid tint, not hachure. A highlighted box in `Flow`, `Pipeline` and `Cells` (and a highlighted `Network` node) shows a pale tint and a thick accent stroke, so its label stays readable. `Bars` keeps hachure explicitly, since its labels sit beside the bar. `slides.md` says never to put a label on a hachure fill.

## Non-goals

- The other four problems in the open-problems memory (workshop steps, a second Part, a picture beside code, the preview port). They are larger design questions.
- A script that renumbers slide ids. The plan rule and the check finding are enough.

## Anti-goals

- Prefixing `ses_` silently: the id the agent then uses with `opencode session export` and `delete` would not be the one it passed.
- A lighter hachure behind labels: the lines still cross the text.

## Approaches

| Issue | Considered | Picked, and why |
|---|---|---|
| #11 | document only · auto-prefix · validate and document | validate and document: it fails at once with the fix in the message, and the id stays the one the agent uses later |
| #12 | plan rule only · plan rule, writer rule and a check finding | all three: the plan rule prevents it, the writer rule covers a reorder, the check catches what slips through |
| #13 | docs only · leave code out of the count and let a piece wrap, plus docs | the second: the count was wrong and the overflow is a layout bug, and the docs make good pieces likely |
| #14 | lighter hachure · stroke only · a pale solid tint and a thick stroke | the tint: it keeps the label readable and matches the quiet slide style the user prefers; a stroke alone is too weak to mark the one thing a slide is about |

## Decided with the user

- Three PRs, one per skill (foreman, opencode-delegate, part-slides), one commit per issue, each PR closing its issues.
- Every fix starts from a failing test.
- #14 is checked with a 1280 × 720 screenshot before and after.

## My calls

- The check finding for #12 has its own kind, `id-order`, and level `problem`. It names each slide whose id is not greater than the id of the slide before it, and each id that is not `<part>-<nnn>` for this Part.
- The `ses` check is a prefix check only, matching opencode's own error. The docs recommend letters and digits after `ses_`, the form the report showed working.
- The tint is the role colour at a low opacity, so it works with any palette edit in `roles.ts`.

## Left to the builder

- The exact tint opacity and stroke width, chosen from the screenshots.
- The longest piece length for the phone, measured on the 390 px frame.
