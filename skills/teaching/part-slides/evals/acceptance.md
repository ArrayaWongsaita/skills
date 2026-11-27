# Acceptance checks

The checks from the design (`docs/superpowers/specs/2026-11-24-part-slides-design.md`), and where each one is tested. Python tests are in `tests/`; template tests are in `template/src/` and run with `pnpm test` in the template.

Run them:

```bash
pnpm --dir skills/teaching/part-slides/template install --frozen-lockfile
pnpm --dir skills/teaching/part-slides/template test
pnpm --dir skills/teaching/part-slides/template run build
uv run --no-project --python 3.12 --with pytest pytest skills/teaching/part-slides/tests -q
```

`tests/test_app_build.py` needs the template's `node_modules` and is skipped without them.

## Automated

| # | Check | Tests |
|---|---|---|
| 1 | A slide carries no research metadata (no `purpose`, `from`, `sources`) and any node is its picture, in every layout that takes one; `Code` and `Example` default to the whole listing; `Focus`, `Explain` and `Steps` may have no picture. | `template/src/components/layouts.test.tsx`, `src/__fixtures__/typecheck.tsx` (compiled by `pnpm run build`) |
| 2 | A divider is marked and styled as one without a topic list; a slide carries its section and phase as data attributes; where the slide is (Part, section, phase) is a small muted block at the top of the slide (the place, then the phase) that the title outweighs, and the bottom bar holds only the all-parts link and the pager; the course icon is on the home page and in the browser tab, never on a slide (a png, webp or jpg named `icon` overrides the default svg); a code block has one copy button that copies what it shows. | `layouts.test.tsx`, `where.test.ts`, `Deck.test.tsx`, `code.test.tsx`, `Home.test.tsx`, `App.test.tsx`, `icon.test.ts`, `tests/test_scaffold.py` |
| 3 | The readability budgets: topic at most 9 slides, Opening at most 3, Part at most 40 (a note from 35), prose at most 160 Thai characters (220 elsewhere), phases in order naming only the slide that breaks it, a topic starting with its divider; slide ids that are `<part>-<nnn>` and run in file order (`id-order`), one moved slide giving one finding. | `template/src/check/budgets.test.ts`, `CheckPage.test.tsx` |
| 4 | The check page lists the slides (`slides`) and reports budget findings with the other findings; it reports a highlight on more than half of the shown code lines; the text count leaves out code, its output, an `Anatomy` strip and the template's field labels. | `CheckPage.test.tsx`, `findings.test.ts` |
| 5 | `scaffold.py` creates the app without `node_modules`, fixtures or tests, writes `course.ts`, never overwrites a file the course changed (it lists it under `kept`), brings a course made from an older template up to date (an unchanged copy is replaced, an unchanged file the template dropped is removed, install runs again when the packages changed) from every version recorded in `template-versions.json`, creates a Part's folder and skeleton with zero-padded numbers, refuses a bad Part request before writing, installs only when needed, and `--sync-count` keeps `slideCount` equal to the slide ids, whichever way the data file writes the key. | `tests/test_scaffold.py` |
| 6 | The briefs cannot drift: `SKILL.md` has its reporting section and links every reference; `slides.md` names every layout and figure the template exports; `plan-list.md` states the budgets of `budgets.ts`; the briefs name only real `scaffold.py` options; no brief mentions the old pipeline. | `tests/test_skill_md.py`, `tests/test_references.py` |
| 7 | End to end: a scaffolded app with a small made-up Part (cover, divider, figure, own drawing, anatomy, example with output, error, summary, sources) passes its own check page and builds with relative asset paths. | `tests/test_app_build.py` |
| 8 | A drawing keeps its labels readable and its code typeable: a `fill` without a `fillStyle` is a pale tint (a highlighted `Flow`, `Pipeline` or `Cells` box, a highlighted `Network` layer) that fades in after its outline when the drawing draws in, an explicit `fillStyle` keeps its look and `Bars` keep hachure; an `Anatomy` piece wider than the strip wraps inside its own box; monospace text shows no ligatures. | `sketch.test.tsx`, `figures.test.tsx`, `tests/test_theme.py` |

## Run on a real subject

Run once with the user answering the interview, then record here. The first subject is "Machine Learning". Compare with the hand-written demo of the same subject (29 slides, about 550 words) and with the three-skill pipeline's deck (97 slides, about 2,300 words).

| # | Check | Result |
|---|---|---|
| 8 | The interview asked one question at a time, with the reason, and proposed when the user did not know. | _Not run yet._ |
| 9 | `research.md` has sources for every claim on a slide; what is unverified is named. | _Not run yet._ |
| 10 | The user saw "what I understood" and corrected it before any slide was planned. | _Not run yet._ |
| 11 | The plan list was presented per topic, edited by the user and approved before the build. | _Not run yet._ |
| 12 | The Part is inside the budgets (the check page shows no `budget` finding) and a topic runs divider → know → parts → example. | _Not run yet._ |
| 13 | Every distinct drawing and one slide per layout was looked at in a screenshot; collisions were fixed. | _Not run yet._ |
| 14 | One slide the user found confusing was revised with one edit and one rebuild, and the plan stayed true. | _Not run yet._ |
| 15 | The user's verdict: easier to follow than the old pipeline's deck, and as easy as the hand-written demo. | _Not run yet._ |
| 16 | Picture first: on a code topic, each topic's first `know` slide is a picture with no code, and every explaining slide without a picture says why in the plan. | Plan-only run on `JavaScript Array Methods` Part 1 (opencode, `opencode-go/deepseek-v4.1-flash#max`), same brief and research before and after the rule: 8 of 30 slides drawn and 7 of 16 explaining slides drawn before; 18 of 32 and 15 of 19 after, and all 4 topics open with a picture slide with no code. Built from the new plan in the same way: 32 slides, build passed, 12 distinct drawings; I looked at 18 slides on the desktop frame and found three drawings (1-011, 1-018, 1-022) with a second label placed on top of a box's own label, which the check page did not report and the model's own screenshot review missed. The check page now reports this as `text-overlap` (found those three, no false alarm on the ML course or the first JS course). Third run, with the divider-picture and one-picture-per-topic rules: all 4 dividers carry the topic's picture, 4 pictures are reused over more than 20 slides with the part under discussion highlighted, the check page reports nothing (my own run agrees), and the model's list of changes from the plan matches the slides. Still weak: each `know` slide repeats its divider's picture unchanged, and 2 of 5 watchout slides (`Error`) have no picture with the reason "the symptom is the code output"; the rules now say a `know` slide traces one item through the picture, a watchout is drawn, and "the code shows it" is not a reason. Fourth run with those three edits: the plan has every `know` slide trace one item through the divider's picture (the highlighted item goes in and its result comes out), all 4 watchout slides are drawn, and the only slides with no picture are the cover, the objectives and the sources. Built: 30 slides, check page clean, 11 drawings, every slide viewed at 1280 × 720 and the pictures also on a phone, no labels on top of each other. Weak: the last watchout (a missing start value) is crowded, with a caption loose under the picture; the drawing rules now keep a note beside the thing it names. The model's one skill problem (an `Example` with 9 code lines and a body scrolls) is now in the code rules as the room an `Example` has. |

| 17 | A Part of a course: the brief comes from the chapter's row in `course.md` with no interview, the slides follow `pattern.md`, and every listing comes from the playground through `sync_listings.py`, with `--check` clean after a build. | _Not run yet._ |

## Notes
