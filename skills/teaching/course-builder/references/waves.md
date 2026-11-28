# Waves

Read this at Step 5, to build the remaining chapters through `foreman`, and when a wave's report comes back.

## A wave

A wave is the next 3–4 chapters at `outline`, in order, whose `builds on` chapters are already `done` or in the same wave. Two chapters that must change the same file outside their folders go in different waves: workers cannot see each other's units. Hand the wave to `foreman` as one job; each chapter is one unit. The intake questions are already answered by this page and `course.md`: put them in the foreman's brief as decided, and tell the user only the wave's chapters and that it starts.

Before handing it over, for each chapter of the wave:

- `python3 <skill>/scripts/course_md.py <course_dir> --set NN building`
- create the Part's skeleton with `part-slides`' `scaffold.py` (`--part N --slug <slug> --part-title "<title>"`), one Part at a time.

The workers of one wave may run at the same time: each writes only its own `units/NN/` and its own Part's files. Everything that touches the playground's git, and the slides' shared `web/dist`, runs one chapter at a time; a worker checks its own Part in a build folder and on a port of its own.

## The worker brief

One per chapter. Fill the angle brackets (`<course_skill>` is this skill's base directory, `<skill>` above; `<part-slides>` is part-slides' base directory; `<port>` is a port you give each worker of the wave, a different one for each, since several workers asked for "a free port" pick the same one) and send it as written:

```
You are building chapter <NN> (<title>) of the course in <course_dir>.

Read first: <course_dir>/course.md (your row is <NN>; the learner and the goal are at the top),
<course_dir>/pattern.md (the rules every chapter follows; chapter 01 is the example of each),
and <course_skill>/references/playground.md (what a chapter must contain).

1. The playground chapter. Write the files as they should be on each branch:
   - <course_dir>/units/<NN>/main/<chapters folder>/<NN>-<slug>/…  (exercises pending, a 👉 line each)
   - <course_dir>/units/<NN>/solutions/<chapters folder>/<NN>-<slug>/…  (the same files, tests written, no 👉)
   Your row's "under test" is the thing the exercises test; use only what the "builds on" chapters taught.
   If the thing under test lives outside the chapter folder (a page the test tool serves, say), put it in the
   unit too, at its own path from the playground's root.
   Never rewrite a file outside your chapter folder that another chapter uses; if your chapter seems to need
   that, say so in your reply instead.
   Check it, as often as you need, saving your chapter's real runs for the slides:
     python3 <course_skill>/scripts/apply_unit.py <course_dir> <NN> --check --save-output <course_dir>/runs
   It must print "chapter <NN>: passed", and writes runs/<NN>-main.txt and runs/<NN>-solutions.txt. It commits
   nothing; never run git in <course_dir>/playground yourself, and never copy the playground to run it by hand.

2. The slides. Follow part-slides for Part <N> of this course, steps 1 to 4 (brief from course.md, research,
   plan, write), with no interview: <course_dir>/parts/<NN>-<slug>/ and <course_dir>/web/src/parts/part-<NN>.*.
   No one approves your plan: pattern.md and the approved pilot (Part 01) are the approval. Write plan.md, check
   it against pattern.md's slide rules and the budgets, write "Status: approved (pattern.md)" and go on; say in
   your reply where the plan departs from pattern.md, and the foreman decides.
   Declare each code listing in part-<NN>.sources.json by its branch and the path it will have in the playground
   (the path under units/<NN>/<branch>/), and give a listing's output as "runs/<NN>-solutions.txt" or
   "runs/<NN>-main.txt", the files the check above saved. An output a slide shows is part of the chapter's run:
   when a slide needs something else (a query's rows, a value), make the chapter's run print it, never a
   hand-written file. Read the code you plan around from units/<NN>/. Never type playground code into the data
   file.

3. Check your Part yourself. Your chapter is not in the playground yet, so sync from your unit, and build into
   a folder and a port of your own (other workers build at the same time; never use web/dist or port 4173):
     python3 <part-slides>/scripts/sync_listings.py <course_dir> --part <N> --unit <NN>
     python3 <part-slides>/scripts/scaffold.py <course_dir> --sync-count <N>
     pnpm --dir <course_dir>/web exec tsc --noEmit
     pnpm --dir <course_dir>/web exec vite build --outDir <course_dir>/parts/<NN>-<slug>/check-dist
     pnpm --dir <course_dir>/web exec vite preview --outDir <course_dir>/parts/<NN>-<slug>/check-dist --port <port> --strictPort
   Then the check page and the screenshots of part-slides' references/check-and-revise.md at that port. Fix
   every problem, stop your preview server (`lsof -ti tcp:<port> -sTCP:LISTEN | xargs kill`: only the server, never
   another worker connected to it), and delete check-dist/. A build or type error in another Part's files is
   another worker's: build again a minute later. The foreman syncs again from the playground after applying
   your chapter, checks the Part again and sends you what it still finds.

Done when: apply_unit.py --check passes, brief.md, plan.md, the data file and sources.json are written, and
your Part's check page has no problems.
Reply with what you made, anything in pattern.md that did not fit this chapter, and, when something in a brief,
a script or a template got in your way, one line: Skill problem: <what got in the way, and where>.
```

## The foreman's check of each chapter

When a worker is finished, one chapter at a time:

1. `python3 <skill>/scripts/apply_unit.py <course_dir> NN`: must print `committed` or `unchanged`; the chapter is now `review`.
2. `python3 <skill>/scripts/check_playground.py <course_dir> --chapter NN --save-output <course_dir>/runs`: must print `ok`.
3. `part-slides`' `sync_listings.py <course_dir> --part N`, then its `scaffold.py <course_dir> --sync-count <N>`, the build and the check page (its `references/check-and-revise.md`): no problems. Look at the screenshots of each drawing again: a worker's check ran before the apply.
4. `sync_listings.py <course_dir> --part N --check`: no listing differs from the playground.
5. `python3 <skill>/scripts/course_md.py <course_dir> --set NN done`

A failure, including a check-page problem or an overlap you see in a screenshot, goes back to the same worker with the script's output or the screenshot, by `foreman`'s own retry rules; the worker fixes `units/NN/` or its Part, and you run the check again from step 1. Copy each `Skill problem:` line into `<course_dir>/skill-problems.md`.

## Between waves

Tell the user which chapters are done, with the slides' address, and that they may look before the next wave. A change they ask for to a done chapter is a unit like any other: edit `units/NN/`, apply, rebuild. A change to the pattern goes into `pattern.md` and the next wave's briefs; built chapters are rebuilt only when the user asks.
