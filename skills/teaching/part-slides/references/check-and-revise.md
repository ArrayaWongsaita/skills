# Building, checking and revising

Read this after the slides are written, and again each time the user asks for a change.

## Build

```bash
python3 <skill>/scripts/scaffold.py <course_dir> --sync-count <N>   # keep slideCount right; N is the Part number, the count is worked out from the slide ids
pnpm --dir <course_dir>/web run build                                # tsc and vite: fix every error
pnpm --dir <course_dir>/web run preview                              # in the background: http://localhost:4173/
```

A build error is yours to fix: read it, correct the file. A prop the layout does not know, or a required prop you left out, is a compile error here.

## The check page

Open `http://localhost:4173/#/check/part-NN` and wait until `window.__reactSlidesCheck.done` is true (with a browser tool, evaluate it; otherwise load the page in headless Chrome with `--headless=new --virtual-time-budget=15000 --dump-dom` and read the table). It lays every slide out twice (1280 × 720 and a 390 × 844 phone) and reports:

- `findings`: the problems and notes. Fix every `problem`. A `prose-overflow` means the text does not fit: split the slide, do not shrink it. A `budget` finding means the Part is outside the readability budgets: restructure (merge slides, drop a phase that adds nothing) and tell the user when it changes the approved plan. A `scrolling-block` note means a code or output box scrolls inside its box, up and down or sideways (on the phone it is usually sideways): break the long line over several lines or show fewer lines, then check the screenshot, where a scrolling box looks cut off. A `text-overlap` problem means two labels of one drawing sit on top of each other: move them apart. `fallback` and `out-of-canvas` come from a picture.
- `slides`: every slide, with its section, phase, divider flag, title and text length: the real slide list.

The page does not see everything. Two labels that overlap, a number badge on top of another, text that runs over a drawing: only a screenshot shows these.

## Look at the slides

Take a screenshot (`http://localhost:4173/#/part-NN/<slide id>`, 1280 × 720; with headless Chrome `--screenshot=<file> --window-size=1280,720 --virtual-time-budget=5000`) of:
- every slide the check page flagged,
- every distinct drawing,
- the divider, one `parts` slide, the example, and one slide per other layout the Part uses.

Look for: labels that collide or run off the picture, a highlight on the wrong thing or on most of the code, a drawing whose meaning you cannot read without the text, text over a picture, a divider with more than a name. Fix, rebuild, look again. Allow yourself two rounds per slide, then tell the user what is still wrong.

## Read it cold

Read the slides in order as the learner would, assuming only what `brief.md` says they know. Mark each place where you had to read a slide twice, met a word that was not explained, or lost the thread. Fix those slides. This replaces a separate reviewer: do it every time, even if the check page is clean.

## Give the user the link

Say, in the user's language: the address, the number of slides per topic, anything you could not verify (code you did not run, facts marked `unverified`), the pictures you are least sure of, and what you changed from the approved plan and why.

## Revise

The user reads the real slides and names what is hard ("slide 12 is confusing", "this example is too long", "I want a different picture here"):
1. Ask only what you need: what in the slide is the problem, if it is not clear. A reaction such as "I don't get it" is enough to try.
2. Change that slide, or split, merge, move or remove slides. Keep the ids in order; renumber when you insert (ids are `<part>-<nnn>` in order).
3. Run `scaffold.py --sync-count`, build, check, take a screenshot of the changed slides and show it.
4. When the structure changed, update `<work>/plan.md` (it is the approved proposal, not the truth, but keep it from lying). Ask for approval only when a change breaks a budget or drops something the user asked for.

## Course notes

At the end of each Part write or update `<course_dir>/course-notes.md`, so the next Part does not re-explain and the pictures stay consistent:

```
# Course notes
Learner: … (from the briefs)
Language: th
## Taught
- Part 1 <title>: <the terms and ideas it explained, one line each>
## Pictures
- <concept>: <role colour> · <the drawing component that shows it>
```

Read it before the next Part's interview, and do not ask what it already answers.
