# Waves

Read this at Step 5, to build the remaining chapters through `foreman`, and when a wave's report comes back.

## A wave

A wave is the next 3–4 chapters at `outline`, in order, whose `builds on` chapters are already `done` or in the same wave. Hand the wave to `foreman` as one job; each chapter is one unit. The intake questions are already answered by this page and `course.md`: put them in the foreman's brief as decided, and tell the user only the wave's chapters and that it starts.

Before handing it over, for each chapter of the wave:

- `python3 <skill>/scripts/course_md.py <course_dir> --set NN building`
- create the Part's skeleton with `part-slides`' `scaffold.py` (`--part N --slug <slug> --part-title "<title>"`), one Part at a time.

The workers of one wave may run at the same time: each writes only its own `units/NN/` and its own Part's files. Everything that touches the playground's git or the slides app runs one chapter at a time.

## The worker brief

One per chapter. Fill the angle brackets (`<course_skill>` is this skill's base directory, `<skill>` above) and send it as written:

```
You are building chapter <NN> (<title>) of the course in <course_dir>.

Read first: <course_dir>/course.md (your row is <NN>; the learner and the goal are at the top),
<course_dir>/pattern.md (the rules every chapter follows; chapter 01 is the example of each),
and <course_skill>/references/playground.md (what a chapter must contain).

1. The playground chapter. Write the files as they should be on each branch:
   - <course_dir>/units/<NN>/main/<chapters folder>/<NN>-<slug>/…  (exercises pending, a 👉 line each)
   - <course_dir>/units/<NN>/solutions/<chapters folder>/<NN>-<slug>/…  (the same files, tests written, no 👉)
   Your row's "under test" is the thing the exercises test; use only what the "builds on" chapters taught.
   Check it, as often as you need:
     python3 <course_skill>/scripts/apply_unit.py <course_dir> <NN> --check
   It must print "chapter <NN>: passed". It commits nothing; never run git in <course_dir>/playground yourself.

2. The slides. Follow part-slides for Part <N> of this course, steps 1 to 4 (brief from course.md, research,
   plan, write), with no interview: <course_dir>/parts/<NN>-<slug>/ and <course_dir>/web/src/parts/part-<NN>.*.
   Declare each code listing in part-<NN>.sources.json by its branch and path in the playground; never type
   playground code into the data file. Do not build or start the slides app: the foreman does that.

Done when: apply_unit.py --check passes, and brief.md, plan.md, the data file and sources.json are written.
Reply with what you made, anything in pattern.md that did not fit this chapter, and, when something in a brief,
a script or a template got in your way, one line: Skill problem: <what got in the way, and where>.
```

## The foreman's check of each chapter

When a worker is finished, one chapter at a time:

1. `python3 <skill>/scripts/apply_unit.py <course_dir> NN`: must print `committed` or `unchanged`; the chapter is now `review`.
2. `python3 <skill>/scripts/check_playground.py <course_dir> --chapter NN --save-output <course_dir>/runs`: must print `ok`.
3. `part-slides`' `sync_listings.py <course_dir> --part N`, then its `scaffold.py --sync-count`, the build and the check page (its `references/check-and-revise.md`): no problems.
4. `sync_listings.py <course_dir> --part N --check`: no listing differs from the playground.
5. `python3 <skill>/scripts/course_md.py <course_dir> --set NN done`

A failure goes back to the same worker with the script's output, by `foreman`'s own retry rules. Copy each `Skill problem:` line into `<course_dir>/skill-problems.md`.

## Between waves

Tell the user which chapters are done, with the slides' address, and that they may look before the next wave. A change they ask for to a done chapter is a unit like any other: edit `units/NN/`, apply, rebuild. A change to the pattern goes into `pattern.md` and the next wave's briefs; built chapters are rebuilt only when the user asks.
