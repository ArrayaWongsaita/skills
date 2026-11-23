---
name: slide-design
description: Use after course-research, one Part at a time, to design the slides for a Part that learners will read on their own. It plans a storyboard the user approves (slide order, layouts, diagrams built up step by step), has writers turn the Part into slide-sized text and visuals, checks the result against the Part, reviews it as the learner, and writes a tool-neutral deck file plus a course-wide visual vocabulary for a later skill to build in Google Slides or React. Do not use to make the slide files themselves, for narration or audio, or to research a topic (use course-research).
---

# Slide design

You are the **coordinator**. You talk with the user, keep the run state, plan the storyboard, dispatch section writers and a reviewer, and run the scripts. Talk with the user in their language. Repository-facing text (headings, field labels, JSON keys) stays as `references/deck-template.md` defines it.

The input is a `course-research` course folder: `00-overview.md` and `part-NN-<slug>.md` files (`course-research/part@1`). The output, per Part, is one deck file a downstream skill builds from without ever opening the Part.

All paths below are relative to this skill's base directory (the directory this file was loaded from), written `<skill>/…`. `<course_dir>` is the course folder, `<cwd>/courses/<slug>/`. `<N>` is the Part number and `<work>` is `<course_dir>/slides/_work/part-NN/`.

## The stages and the state

```bash
python3 <skill>/scripts/deck_state.py init           <course_dir> <N> --language <code> [--force]
python3 <skill>/scripts/deck_state.py show           <course_dir> <N>      # stage, sections, next action
python3 <skill>/scripts/deck_state.py set-stage      <course_dir> <N> <stage>
python3 <skill>/scripts/deck_state.py set-section    <course_dir> <N> <key> <written|checked>
python3 <skill>/scripts/deck_state.py reset-sections <course_dir> <N> (<key> … | --all)
```

Stages, in order: `storyboard` → `storyboard-approved` → `writing` → `checking` → `reviewing` → `done`. Section keys are `opening`, the sub-topic numbers (`1.1`, `1.2`, …) and `closing`; their statuses go `pending` → `written` → `checked`.

The script refuses to skip a stage. That is how the gate holds: writing cannot start before the storyboard is approved. When a run is interrupted, trust `show` over your memory.

There is one user gate: **storyboard approval**, at Stage 2. **Never dispatch writers before the user approves the storyboard.** Everything else runs without stopping to ask.

## Stage 0: start or resume

- The user names the course and the Part. Find `<course_dir>` and the Part file.
- **No state yet:** run `deck_state.py init <course_dir> <N> --language <code>`, with the language the Part is written in (for example `th`). It refuses a Part file whose template is not `course-research/part@1`.
- Tell the user the cost: one writer per section (the sub-topics plus the opening and the closing) and one reviewer, at most two review rounds.
- **State exists** (`init` says so): run `show`, tell the user where the run stands, and offer one of:
  - **continue** from `next_action`
  - **redo a section:** `reset-sections <course_dir> <N> <key>`, then `set-stage <course_dir> <N> writing`, and run Stages 3–5 for that section, still assembling, validating and reviewing the whole deck
  - **redo the storyboard:** `set-stage <course_dir> <N> storyboard`. It re-reads the Part, so the sections match it again, and sets every section back to `pending`.
- **A deck exists:** run `python3 <skill>/scripts/validate_deck.py <course_dir> <N>`. When it reports `stale`, the Part changed after the deck was made: tell the user and offer to redo the storyboard.

## Stage 1: storyboard

Follow `references/storyboard.md`, with `references/visuals.md` for the visuals. Write to `<work>`:
- `storyboard.md`: every slide, by section
- `diagrams.md`: every diagram, fully defined
- `new-concepts.json`: the concepts this Part adds to the vocabulary
- `deck-notes.md`: the learner profile, that the deck is read alone, and the Part gaps

Then run `python3 <skill>/scripts/validate_deck.py <course_dir> <N> --diagrams` and fix every error.

## Stage 2: the gate

Present the storyboard as `references/storyboard.md` describes, in the user's language. Warn when the Part's `code_status` is `"unverified"`. Loop on the user's changes, re-running `--diagrams`, until they approve. Then:

1. On the course's first Part only, create the vocabulary with the approved illustration style:
   `python3 <skill>/scripts/vocabulary.py init <course_dir> --course <slug> --style "<sentence>"`
2. `python3 <skill>/scripts/vocabulary.py add <course_dir> <work>/new-concepts.json --part <N>`. It refuses to change an existing concept; if it does, change the plan to a new concept id instead.
3. `set-stage <course_dir> <N> storyboard-approved`, then `set-stage <course_dir> <N> writing`.

## Stage 3: write the sections

Dispatch one writer per pending section, at most 5 in one turn, with `subagent_type="general-purpose"` and no `model`:

```
Write section <key> of the slide deck for Part <N> of the course in <course_dir>.

Inputs: <course_dir>/00-overview.md, <course_dir>/<part file>, <work>/storyboard.md, <work>/diagrams.md, <course_dir>/slides/visual-vocabulary.md
Your slides: <storyboard ids for this section>
Output: <work>/sections/<key>.md

As a first step, read <skill>/references/section-writer.md and follow it.
```

Run `set-section <course_dir> <N> <key> written` as each one finishes. Keep every writer's report; the final report lists each change from the storyboard. Act on what writers need:
- **A diagram change:** edit `diagrams.md` yourself and re-run `--diagrams`.
- **A missing concept:** append it to `new-concepts.json` and run `vocabulary.py add` again.
- **A Part gap:** add it to `deck-notes.md`. No writer fills it.
- **A skill problem:** append the writer's `Skill problem:` line to `<work>/skill-problems.md`.

## Stage 4: assemble and check

1. `set-stage <course_dir> <N> checking`.
2. `python3 <skill>/scripts/assemble_deck.py <course_dir> <N>`. It writes `<course_dir>/slides/<part file name>` and renumbers the slides, so a writer's split ids such as `1-007a` become plain numbers.
3. `python3 <skill>/scripts/validate_deck.py <course_dir> <N>`.
4. Send each slide's errors to its section's writer in revision mode: the same prompt plus `Revision mode. Fix only these issues:` and the list. Name each slide by its deck id and its draft id. They differ only after a split: the n-th slide of a section's draft is the n-th slide of that section in the deck. Diagram errors (where a diagram id is named) are yours to fix in `diagrams.md`. Coverage errors go to the writer of the section the storyboard puts that content in.
5. Assemble and validate again. Allow at most 2 revision rounds; whatever still fails goes in the report.
6. `set-stage <course_dir> <N> reviewing`.

## Stage 5: learner review

Dispatch one reviewer, with `subagent_type="general-purpose"` and no `model`:

```
Review the slide deck <course_dir>/slides/<part file> for Part <N>.

Learner profile: <the Part's Context>
Round: <1 | 2: recheck slides <ids> for issues <list>>
Output: <work>/review.md

As a first step, read <skill>/references/learner-review.md and follow it.
```

- Send the Blocking issues, and the Minor issues that fit, to the writers in revision mode, then assemble and validate again.
- Part gaps go to `deck-notes.md`, not to writers.
- Round 2 rechecks only the revised slides. After it, stop: Blocking issues still open are listed in the report as unresolved.
- Run `set-section <course_dir> <N> <key> checked` for every section, then `set-stage <course_dir> <N> done`.

## Stage 6: report

Tell the user, briefly and in their language:
- the deck path
- the slide count per section
- the illustrations to generate and the screenshots to capture (the deck notes list them)
- unverified code
- the Part gaps
- every change from the approved storyboard
- any validator error or review issue still open

Point to the files. Do not paste the deck.

## Without a subagent tool

When there is no Agent tool, do every role inline, in sequence, writing exactly the same files: each section draft as its writer would, then the review as its reviewer would, reading only the vocabulary and the deck for the learner pass. The gate, the scripts and the templates stay the same.

## Reporting problems with this skill

When something in this skill goes wrong or does not fit (a script error, a validator error that was wrong, a brief that misled a subagent, a limit or rule that did not fit real content), append one line to `<work>/skill-problems.md` as soon as you see it:

`- <bug|improvement|docs> · <what happened> · <where: the script, brief or rule> · <stage>`

A subagent's `Skill problem:` line goes in too. On resume, read the file first. At the end of the run, if any line has no ` → ` mark yet, offer once to report them with the `report-skill-issue` skill, or at once if a problem stops the run. Then mark each line the offer covered: ` → <issue URL>` once reported, or ` → not reported (<date>)` if the user declined or dropped it. A marked line is never offered again. If `report-skill-issue` is not installed, list the unmarked lines in your final report instead.

## References

- `references/deck-template.md`: the deck and vocabulary contract the downstream skill relies on, with a filled example
- `references/storyboard.md`: planning the storyboard and diagrams, the term rule, and the gate presentation
- `references/visuals.md`: choosing visual kinds, laying out diagrams, build steps, illustrations and screenshots
- `references/section-writer.md`: the brief every writer reads, including revision mode
- `references/learner-review.md`: the brief for the learner reviewer
