---
name: course-research
description: Use when the user wants to research a topic in depth in order to build teaching or learning material (a course, a lesson series, a slide series). It interviews the user for scope (topic, learners and their prior knowledge, learning outcomes), researches the topic on the web from several perspectives, orders the knowledge into Parts and sub-topics, and writes one self-contained, cited research file per Part, with code examples checked against fake models, for a later media-design step to turn into slides or other media. Do not use for one-off research questions (use deep-research) or for making slides directly.
---

# Course research

You are the **coordinator**. You talk with the user, keep the run state, dispatch researcher, writer and reviewer subagents, and run the scripts. Talk with the user in their language. Repository-facing text (file headings, frontmatter keys) stays as the templates define it.

The result is a course folder that a downstream media-design skill reads **one Part at a time**: `00-overview.md` plus a single `part-NN-<slug>.md`. Every Part file must stand on its own.

All paths below are relative to this skill's base directory (the directory this file was loaded from), written `<skill>/…`. Course paths are absolute: `<course_dir>` is `<cwd>/courses/<course-slug>/`.

## The stages and the state

The scripts record the run state and enforce its gates:

```bash
python3 <skill>/scripts/course_state.py show <course_dir>               # stage, parts, next action
python3 <skill>/scripts/course_state.py set-stage <course_dir> <stage>
python3 <skill>/scripts/course_state.py set-parts <course_dir> <n>
python3 <skill>/scripts/course_state.py set-part <course_dir> <N> <status>
python3 <skill>/scripts/course_state.py reset-parts <course_dir> <N> [<N> …]
```

Stages, in order: `scope` → `scope-confirmed` → `broad-research` → `outline-draft` → `outline-approved` → `deep-research` → `writing` → `verifying` → `done`. Part statuses: `pending` → `researched` → `written` → `checked`.

The script refuses to skip a stage. That is how the gates hold: deep research cannot start before the outline is approved. Run `set-stage` at each step below, and when a run is interrupted, trust `show` over your memory.

There are two user gates:
- **Scope confirmation**, at the end of Stage 1.
- **Outline approval**, at the end of Stage 3: the hard gate, because deep research is the expensive part.

Everything else runs without stopping to ask.

## Stage 0: start or resume

- Pick the course slug from the request: lowercase-kebab ASCII, for example `langchain-langgraph`. `<course_dir>` is `<cwd>/courses/<slug>/`.
- **The folder does not exist:** run `course_state.py init <course_dir>` and go to Stage 1.
- **The folder exists:** run `show`, tell the user where the run stands, and offer one of:
  - **continue** from `next_action`
  - **redo Part(s)**: `reset-parts <course_dir> <N…>`, then `set-stage <course_dir> deep-research`, and run Stages 4–5 for those Parts only (`check_code.py --part N`), still validating and reviewing the whole course
  - **change the outline**: `set-stage <course_dir> outline-draft`, then back through the Stage 3 gate. A Part is affected when it is new or renumbered, or its title or sub-topics changed. After `set-parts`, run `reset-parts` on every affected Part before `set-stage <course_dir> deep-research`; otherwise a new Part 2 inherits the old Part 2's status. For each dropped or renumbered Part, delete its old `part-NN-*.md`, `_work/research/parts/part-NN.md` and the fixtures named after its snippet ids, because those ids carry the old number.
  - **restart**: once the user confirms, delete `part-*.md`, `00-overview.md`, `_work/outline.md`, `_work/research/` and everything in `_work/code-check/` except `.venv`. Then run `set-stage <course_dir> scope`, which also clears the Part statuses.

## Stage 1: scope

Interview the user following `references/scope-interview.md`, write `<course_dir>/_work/scope.md`, and play the scope back. When the user confirms, run `set-stage <course_dir> scope-confirmed`.

## Stage 2: broad research

1. Tell the user what will run, and the cost behind it: 4 broad researchers (5 for technical topics, adding Current state), then one researcher and one writer per Part after the outline.
2. Run `set-stage <course_dir> broad-research`.
3. Dispatch **all broad researchers in one turn**, one per perspective: Beginner, Practitioner, Teacher, Existing curricula, plus Current state for technical topics. Use `subagent_type="general-purpose"`, no `model`, with this prompt:

```
Research <topic> for a course, broad mode, perspective: <perspective>.

Scope summary: <learners and prior knowledge; outcomes O1..On; delivery mode; output language>
Key questions:
- <2–4 questions specific to this perspective and topic>
Constraints: <versions, platform, boundaries, must-include/avoid from scope>

Save your notes to <course_dir>/_work/research/broad/<perspective-slug>.md

As a first step, read <skill>/references/researcher.md and follow it.
```

Wait for all of them before Stage 3.

## Stage 3: outline (gate)

Run `set-stage <course_dir> outline-draft`. Build the outline yourself following `references/outline.md`:
- write `<course_dir>/_work/outline.md`, including the glossary
- for technical topics, write exact `==` pins into `packages` in scope

Present it to the user. Loop on their changes until they approve. Then:

```bash
python3 <skill>/scripts/course_state.py set-stage <course_dir> outline-approved
python3 <skill>/scripts/course_state.py set-parts <course_dir> <n>
python3 <skill>/scripts/course_state.py set-stage <course_dir> deep-research
```

**Never dispatch deep research before the user approves the outline.**

Effort follows the scope's `size` (small 1–3 Parts, medium 4–8, large 9+). When the outline the user wants falls outside that range, say so at the gate before they approve.

## Stage 4: deep research

Dispatch one researcher per pending Part, **at most 5 in parallel per turn**:

```
Research Part <N> of a course on <topic>, deep mode.

Part: <title>; objectives: <outcomes served and "after this Part the learner can …">
Sub-topics: <N.1 title: one line; N.2 …>
Slots to fill: Core knowledge, Worked example, Misconceptions, Common errors and fixes, Self-check material; plus practice material and prerequisites/setup for the Part
Scope summary: <learners, delivery mode, language>
Constraints: <pins for technical topics; boundaries>
Broad notes you may read first: <course_dir>/_work/research/broad/

Save your notes to <course_dir>/_work/research/parts/part-<NN>.md

As a first step, read <skill>/references/researcher.md and follow it.
```

Run `set-part <course_dir> <N> researched` as each one finishes. When all are researched, run `set-stage <course_dir> writing`.

## Stage 5: write and verify

1. **Environment.** For technical topics, run `python3 <skill>/scripts/code_check/setup_env.py <course_dir>` first. It builds the check environment and records the resolved versions the writers need.
2. **Writers.** Dispatch one per Part, at most 5 per turn:

```
Write Part <N> of the course in <course_dir>.

Inputs: <course_dir>/_work/scope.md, <course_dir>/_work/outline.md, <course_dir>/_work/research/parts/part-<NN>.md, <course_dir>/_work/research/broad/ (Teacher and Current state at least), <course_dir>/_work/code-check/env.json (technical topics)
Output: <course_dir>/part-<NN>-<slug>.md   (the file name the outline fixed)
Today: <YYYY-MM-DD>

As a first step, read <skill>/references/part-writer.md and follow it.
```

   Run `set-part <course_dir> <N> written` as each one finishes.
3. **Overview.** Write `<course_dir>/00-overview.md` yourself, from the overview skeleton in `references/part-template.md`. Set `research_date` to today and `versions` to `resolved` from `_work/code-check/env.json` (`{}` when not technical). The Part map titles must match the Part files exactly.
4. **Code check.** Run `set-stage <course_dir> verifying`, then `python3 <skill>/scripts/code_check/check_code.py <course_dir>`. For each unverified snippet that has no `skip`, send its reason (and, for `expected output differs`, its `stdout` from `_work/code-check/results.json`) to the Part's writer in revision mode (the same prompt, plus "Revision mode. Fix only these issues: …"). Rerun with `--part N`. Allow at most 2 rounds per snippet; whatever still fails stays marked unverified. The rules are in `references/code-check.md`.
5. **Structure.** Run `python3 <skill>/scripts/validate_course.py <course_dir>`. Send its errors to the writers in revision mode, and fix overview errors yourself, until it exits 0.
6. **Consistency.** Dispatch one reviewer: "Review the course in `<course_dir>`. As a first step, read `<skill>/references/consistency-review.md` and follow it." Append its `skill |` rows to `<course_dir>/_work/skill-problems.md`. Send the other issues to the writers in revision mode, then run `validate_course.py` again. Rerun `check_code.py --part N` for any Part whose code changed.
7. **Close.** Run `set-part <course_dir> <N> checked` for each Part not yet checked, then `set-stage <course_dir> done`.

## Stage 6: report

Tell the user, briefly and in their language:
- the course folder path
- the Part list
- each unverified snippet with its reason
- the research gaps that left a slot thin

Point them to the files. Do not paste the documents.

## Without a subagent tool

When there is no Agent tool, do every role inline, in sequence, writing exactly the same files. Broad research becomes 3 notes:
- Beginner + Teacher
- Practitioner + Existing curricula
- Current state (technical topics only)

Keep each note to about 8 tool calls. The gates, the scripts and the templates stay the same.

## Reporting problems with this skill

When something in this skill goes wrong or does not fit (a script error, a validator error that was wrong, a brief that misled a subagent, a limit or rule that did not fit real content), append one line to `<course_dir>/_work/skill-problems.md` as soon as you see it:

`- <bug|improvement|docs> · <what happened> · <where: the script, brief or rule> · <stage>`

A subagent's `Skill problem:` line goes in too. On resume, read the file first. At the end of the run, if any line has no ` → ` mark yet, offer once to report them with the `report-skill-issue` skill, or at once if a problem stops the run. Then mark each line the offer covered: ` → <issue URL>` once reported, or ` → not reported (<date>)` if the user declined or dropped it. A marked line is never offered again. If `report-skill-issue` is not installed, list the unmarked lines in your final report instead.

## References

- `references/scope-interview.md`: the Stage 1 questions and the `_work/scope.md` layout
- `references/researcher.md`: the brief every researcher reads (broad and deep modes)
- `references/outline.md`: evidence tags, Part grouping, pins and the gate presentation
- `references/part-template.md`: the Part and overview contract the downstream skill relies on
- `references/part-writer.md`: the brief every writer reads, including revision mode
- `references/code-check.md`: snippet conventions, fixtures, and how to read results
- `references/consistency-review.md`: the brief for the final reviewer
