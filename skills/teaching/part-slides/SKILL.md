---
name: part-slides
description: Use when the user wants the slides for one Part of a course (one subject area) that learners read on their own on a laptop or phone, starting from an idea that may be vague and with no research done yet. It interviews the user, researches only that Part's subject, shows what it understood and a slide list the user edits, builds the Part as React slides in the course's web app, checks them in a browser, and revises single slides afterwards. Do not use for narration or audio, for Google Slides, or to plan a whole course at once.
---

# Part slides

You are the author. You talk with the user, research, plan, write the slides, build and check them, and revise them when the user reads the real thing. You do all of it yourself, in order: there are no writer or reviewer subagents. Talk with the user in their language. Code, file names and the report's paths stay as they are.

The point of this skill is a Part a beginner can follow: few slides, one idea each, a fixed rhythm per topic, in an order chosen for this learner, not copied from the research. Read the rules in `references/plan-list.md` before you plan.

All paths below are relative to this skill's base directory, written `<skill>/…`. `<course_dir>` is the course folder, `<cwd>/courses/<slug>/`. `<N>` is the Part's number and `NN` is that number with two digits. `<work>` is `<course_dir>/parts/NN-<slug>/` and `<web>` is `<course_dir>/web`.

## A Part

An **opening** of at most 3 slides, then **topics**, then a **closing**. Each topic is a segment that always runs the same way, so the learner knows where they are: a divider that only names the topic, then `know` (what it is), `parts` (one slide per component), `example` (code with its real output), `watchout` (a mistake beginners really make, only when there is one) and, if the user asks, `check`. Details and the budgets: `references/plan-list.md`.

## Start or resume

Read `<course_dir>/course-notes.md` if it exists: it says who the learner is and what earlier Parts taught. Then let the files say where the run stands:

| What exists | Where you are |
|---|---|
| no `<web>` | scaffold, then step 1 |
| no `<work>/brief.md` | step 1 |
| no `<work>/research.md` | step 2 |
| `<work>/plan.md` without `Status: approved` | step 3 |
| approved, and the Part still has only its cover | step 4 |
| the Part is built | step 5: ask what the user wants to change |

Tell the user where it stands and offer to continue, or to redo a step.

## Step 1: interview

Follow `references/interview.md`: one question at a time, with a proposal where you can make one, then write `<work>/brief.md`. As soon as you know the Part's title and a slug, create the app and the Part's skeleton, in the background (the first `pnpm install` takes a minute or two):

```bash
python3 <skill>/scripts/scaffold.py <course_dir> --title "<course title>" --language <code> --part <N> --slug <slug> --part-title "<Part title>"
```

It creates `<web>` from the template, `<work>`, and the Part's two files; it never overwrites a file, so running it again is safe. It needs Node.js 20 or later and pnpm.

## Step 2: research

Follow `references/research.md`: research only this Part's subject, write `<work>/research.md`, then tell the user **what you understood** (topics, their parts, the order, what you are unsure of) and apply their corrections.

## Step 3: the plan list

Follow `references/plan-list.md`: the story and one table per topic, each slide in words with its picture in words. The user edits it until they approve; then write `Status: approved` in `<work>/plan.md`. **Do not build before that.**

## Step 4: build

Follow `references/slides.md` to write `<web>/src/parts/part-NN.tsx` and `part-NN.data.ts` (and `<web>/src/visuals/part-NN.tsx` for the Part's drawings), then `references/check-and-revise.md` to build, read the check page, look at the screenshots, read the slides cold, fix, and give the user the link. Never deploy: the run ends with a built `dist/` the user deploys where they like.

## Step 5: revise

The user reads the slides and asks for changes, usually "this slide is confusing". Change that slide (or split, merge, move, remove), rebuild, check, show a screenshot. `references/check-and-revise.md` has the loop. When a Part is done, write `<course_dir>/course-notes.md` as it says.

## Rules that matter most

- The learner, not the research, decides what goes on a slide. Leave out what they do not need yet.
- Concrete before abstract. A term is explained where it is first needed; there is no glossary slide.
- One new idea per slide, at most 160 Thai characters of text. Two slides, not a denser one.
- No source voice ("X states that…") on slides. Facts come from `research.md`; sources go on the last slide.
- Code on a slide is run, and the slide shows its real output.
- Never present an assumption as something the user said. With no way to ask, write what you assumed and say so.

## The course icon

The course icon shows in two places only: the header of the home page and the browser tab. It is not on the slides, where it pulled the eye from the content. The default is `template/src/assets/icon.svg`. To use your own icon, replace that file in the template (every new course then gets it), or in one course put `icon.svg`, `icon.png`, `icon.webp` or `icon.jpg` in `<web>/src/assets/` (a png, webp or jpg wins over the svg) and rebuild. Use a square picture that still reads at 16 px, the size of a tab.

## Reporting problems with this skill

When something in this skill goes wrong or does not fit (a script error, a validator error that was wrong, a brief that misled a subagent, a limit or rule that did not fit real content), append one line to `<course_dir>/skill-problems.md` as soon as you see it:

`- <bug|improvement|docs> · <what happened> · <where: the script, brief or rule> · <stage>`

A subagent's `Skill problem:` line goes in too. On resume, read the file first. At the end of the run, if any line has no ` → ` mark yet, offer once to report them with the `report-skill-issue` skill, or at once if a problem stops the run. Then mark each line the offer covered: ` → <issue URL>` once reported, or ` → not reported (<date>)` if the user declined or dropped it. A marked line is never offered again. If `report-skill-issue` is not installed, list the unmarked lines in your final report instead.

## References

- `references/interview.md`: the questions, how to ask, the brief
- `references/research.md`: researching one Part, the research file, the "what I understood" summary
- `references/plan-list.md`: what a Part looks like, the budgets, the plan file, presenting and editing it
- `references/slides.md`: the files, the layouts and their props, pictures, code, writing the text
- `references/check-and-revise.md`: build, the check page, screenshots, the cold read, revising, course notes
