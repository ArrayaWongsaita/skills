# part-slides: one skill that designs and builds the slides of one Part

Date: 2026-11-24. Status: approved by the user in conversation (option B, with the assumptions listed under "Assumptions").

## Intent

The pipeline `course-research → slide-design → react-slides` produced decks that read as confusing, although the content was correct. A real run on the topic "AI to LLM" gave 97 slides and about 2,300 words for one Part, where a hand-written demo of the same subject taught it in 29 slides and about 550 words and was clear. The user wants the demo's result back.

The causes found by reading both decks:

1. The pipeline covers the research, not the learner. Every slot of the Part (`Components`, `Misconceptions`, `Self-check`, `Analogy`…) must have slides, and the validator checks it. Nobody decides what this learner needs first, so the deck is mostly review and error-correction slides (24 `parts`, 15 `watchout`, 20 `check` of 97; 11 `know`).
2. The Part is written in a report voice with citations, and the writers may not add or cut, so "IBM states that…" and terms such as `foundation model` land on slides for a learner with no background (20 slides quote a source).
3. A Part gap or an invented component (a `Components` slot has to be filled for every topic) turns into a slide.
4. Nobody asked the user what they want: the course-research interview has no answer in a non-interactive run, and the plan is made for the whole course at once.

## Goal

One skill, `part-slides`, that works on **one Part at a time** and needs neither `course-research` nor `slide-design`:

1. interviews the user about the Part,
2. researches only that Part's subject,
3. shows what it understood, then a slide list the user edits (text in words, pictures in words),
4. builds the Part as slides in the course's React app,
5. revises single slides when the user reads the real thing and wants them clearer.

Success: for a subject the user does not know well (the first test is "Machine Learning"), the deck is as easy to follow as the hand-written demo, the user steers the content in conversation, and a later change to one slide is one small edit.

## Non-goals and anti-goals

- No Part file, no `part@N` or `deck@N` contract, no storyboard state machine, no writer or reviewer subagents, no validator that forces every research item onto a slide.
- Not a whole-course planner. A course is a folder of Parts made one after another; continuity between them is one small notes file.
- No Google Slides output, no generated raster images (a picture is a figure, a drawing in SVG, or an image file the user drops in).
- Anti-goal: a skill that is as heavy as the three it replaces. If a rule cannot be checked by a script or by looking at a screenshot, it is a short sentence in the skill, not a new artifact.

## Approaches considered

- **A. Patch the three skills** (cap slides per topic, relax coverage). Cheapest, but the interview, the per-Part research and the learner-first order are missing, and the weight stays.
- **B. One new skill that covers the Part end to end (chosen).** The slides are the single source; the plan list the user approves is the skeleton of the slides.
- **C. A design-only skill that writes a deck file for `react-slides`.** Keeps a second contract (`from`, `diagrams.md`, vocabulary); fixing a picture means a round trip through markdown. Half the cause stays.

## The flow

There is no state machine. The files present say where a run stands.

### 0. Start or resume

`<course_dir>` is `<cwd>/courses/<slug>/`. A Part's work files are in `<course_dir>/parts/NN-<slug>/`.

- No `<course_dir>/web`: `scripts/scaffold.py` creates the app from the skill's template.
- `parts/NN-<slug>/research.md` exists: research is done. `plan.md` with the line `Status: approved` exists: the plan is approved. `web/src/parts/part-NN.tsx` has slides: the Part is built. Offer to continue from there or to change something.

### 1. Interview

One question at a time, in the user's language, each with the reason for asking. Cover: what the Part is about, who learns it and what they already know, what they should understand or be able to do after, what must be in or out, examples or analogies the user likes. The user may say they do not know, and the agent then proposes and says so. With no way to ask (a non-interactive harness), the agent writes its assumptions at the top of `plan.md` as `Assumed:` lines and says so in the report.

### 2. Research

Only the subject of this Part. Write `research.md`, at most one page per topic: the topic's parts, a one-sentence definition a beginner can follow, one analogy, one worked example, the mistakes beginners really make, and the source URLs. Facts come from sources read in this run; with no search tool, the agent uses what it knows and marks each such fact `unverified` in `research.md` and at the gate.

Then show the user, in a few lines, **what the agent understood**: the topics, the parts of each, and the order it proposes. The user corrects it before any slide is planned.

### 3. The plan list (the one approval)

`plan.md`: a story in 5 to 8 sentences (how the learner's understanding grows, in order), then per topic a table:

| # | phase | title | what the text says (one line) | picture (in words) |
|---|---|---|---|---|

The user edits it freely. The agent applies each change to `plan.md` and shows the changed rows. When the user approves, the agent writes `Status: approved` as the first line after the title.

### 4. Build

The agent writes `web/src/parts/part-NN.tsx` (the slides) and `part-NN.data.ts` (meta and the code listings with their real outputs), plus the Part's own pictures in `web/src/visuals/part-NN.tsx`. It then:

- runs every code listing with the real interpreter and puts the real output in the data file,
- runs `npm run build`, serves it, opens `#/check/part-NN`, and reads `window.__reactSlidesCheck`,
- looks at a screenshot of every distinct picture and of one slide per layout, and fixes what it sees,
- gives the user the link.

### 5. Revise

The user names a slide ("slide 12 is still confusing") and says why. The agent changes that slide, or splits, merges, moves or removes slides, rebuilds, and shows the screenshot. When the structure changes, `plan.md` is updated. The real slide list is always available from the check page (`slides`), so `plan.md` is never the source of truth after the build.

## What a Part looks like

A Part is the opening, a run of topics, and the closing.

- **Opening** (at most 3 slides): the cover, what you will be able to do (the goal, in the learner's words), and optionally one concrete situation. No glossary slide, no setup list unless the Part needs real setup.
- **A topic** (a segment that always runs the same way, at most 9 slides with its divider):
  1. a divider: the topic's name, an optional tagline, an optional picture,
  2. `know` (รู้จัก), 1–2 slides: a concrete thing first, then its name and what it is for,
  3. `parts` (ส่วนประกอบ): one slide per part of the topic, each with its own picture or code line; an `anatomy` slide for a call or a formula,
  4. `example` (ตัวอย่าง): one working example, with real output when it is code,
  5. `watchout` (ระวัง): only for a mistake a beginner really makes at that point, and never about something not yet taught,
  6. `check` (ทบทวน): off unless the user asks.
- **Closing**: a summary of what the learner can now do, the bridge to the next Part, and one sources slide (the only place source names and URLs appear).

## Readability rules

These are the content of the fix. Some are checked by the check page (marked ✓), the rest are the author's discipline and the screenshot review.

- ✓ A topic has at most 9 slides including its divider; the Opening at most 3; a Part at most 40 (a `note` from 35).
- ✓ Prose on a slide (title, body, items, not code) is at most 160 characters for Thai and 220 for other languages. A slide that needs more is two slides.
- ✓ Phases run in order inside a topic: `know`, `parts`, `example`, `watchout`, `check`. A topic starts with its divider.
- A term is defined on the slide that first needs it, in the learner's words. No up-front glossary.
- One new idea per slide. The same picture is reused for the same concept, with the part being discussed highlighted.
- Concrete before abstract: the learner sees or does something, then gets its name.
- No source voice on slides ("X states that…", names of institutions, paper terms). Sources go on the closing slide only.
- Every number, name and claim on a slide is in `research.md`.

## Components

```
skills/teaching/part-slides/
  SKILL.md                      the flow above, short
  references/
    interview.md                questions, how to ask, what to do when the user does not know
    research.md                 how to research one Part, the research.md format, the "what I understood" summary
    plan-list.md                the plan.md format, the budgets, how to present and edit it
    slides.md                   writing the Part: the slide components, pictures, code listings, the data file
    check-and-revise.md         building, the check page, what to look at in a screenshot, revising
  scripts/
    scaffold.py                 create the app, add a Part skeleton (idempotent)
  template/                     the React app (a fork of react-slides 1.2.0, see below)
  tests/  evals/acceptance.md
```

### The template (a copy of react-slides 1.2.0, version 2.0.0)

Copied, not moved, so the old skills keep working until the user decides to delete them. Changes:

1. `Base` keeps `id`, `section` (the topic's name, shown in the top line) and optional `phase` and `sources`; `purpose` and `from` become optional. A slide no longer has to carry metadata about the research.
2. Every layout's `visual` accepts a React node as well as the old data object, so a Part's own SVG drops into any layout.
3. The check page also reports the readability budgets above as findings (`budget` kind) and returns `slides` (id, section, phase, title) for the revise step.

Everything else is unchanged: layouts (`topic` divider, `explain`, `steps`, `compare`, `code`, `example`, `anatomy`, `error`, `question`/`answer`, `summary`, `sources`…), sketch primitives, the figures library, the progress and navigation, the phone frame and the check page. The unused deck machinery (diagram definitions, vocabulary, units) is left in place and is deleted later, with the old skills.

### scaffold.py

`scaffold.py <course_dir> [--title T] [--language L] [--part N --slug S --title T] [--skip-install]`

- Creates `<course_dir>/web` from the template when it does not exist (never overwrites a file), writes `src/course.ts`, runs `npm install` unless told not to.
- With `--part`, creates `parts/NN-<slug>/` and the skeleton files `src/parts/part-NN.tsx` and `part-NN.data.ts`, only if they do not exist.
- Prints a JSON report of what it created and skipped. Needs Node.js 20 or later for the install.

### Course notes

`<course_dir>/course-notes.md`, written at the end of each Part: who the learner is, the terms each Part already taught, and the colour used for each recurring concept. The agent reads it first, so Part 2 does not re-explain Part 1 and the pictures stay consistent.

## Constraints

- Text with the user is in the user's language; code, file names, JSON keys and repository docs are English (this repo's `AGENTS.md`).
- The repo is public: no course content in tests or fixtures; fixtures are small, made up and neutral.
- `SKILL.md` has the `## Reporting problems with this skill` section (work folder `<course_dir>/skill-problems.md`).
- Scripts are stdlib Python 3.11 or later; each puts its own folder on `sys.path`. Tests never call a network or a model.
- Code shown on a slide is run with its real interpreter in the build step, and the real output is what the slide shows. A listing that cannot be run is marked `unverified` on the slide.

## Testing

- pytest for `scaffold.py` (creates, skips, idempotent, Part skeleton), for `SKILL.md` and the references (frontmatter, links resolve, the reporting section), and an end-to-end build of the app from a small fixture Part.
- vitest for the template: relaxed `Base`, a node as `visual`, the budget findings, the `slides` list.
- Acceptance (`evals/acceptance.md`): a real run on "Machine Learning" in this conversation, with the user answering the interview, compared with the hand-written demo and with the old pipeline's deck. Success means the user finds the deck easy to follow and a single-slide revision takes one edit and one rebuild.

## What happens to the old skills

Nothing, until the user has seen the acceptance run and says so. Then, with the user's confirmation, `course-research`, `slide-design` and `react-slides` and their specs and tests are removed, and the unused deck machinery is trimmed from the template. The open pull requests (`feat/topic-segments-deck3`, `feat/course-research-components`) are not pushed meanwhile; this work is on `feat/part-slides`, which starts from the first because the template there (1.2.0) is the base.

## Assumptions (the user can reverse any of them)

- Slides are written as TSX directly, not as a deck file.
- The skill is named `part-slides`.
- The `check` (ทบทวน) phase is off by default.
- The two gates are conversations (what the agent understood, then the plan list); there is no stage file.
- The template is copied, not moved, for now.

## Left to the builder

The exact wording of the references; the exact budget numbers if a real run shows they are off (change the numbers in one place, with a test); the look of the budget findings in the check page's table.
