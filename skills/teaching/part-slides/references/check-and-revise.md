# Building, checking and revising

Read this after the slides are written, and again each time the user asks for a change.

## Build

```bash
python3 <skill>/scripts/sync_listings.py <course_dir> --part <N>     # only for a Part of a course with a playground: its code, from the playground
python3 <skill>/scripts/scaffold.py <course_dir> --sync-count <N>   # keep slideCount right; N is the Part number, the count is worked out from the slide ids
pnpm --dir <course_dir>/web run build                                # tsc and vite: fix every error
pnpm --dir <course_dir>/web run preview --strictPort                # in the background: http://localhost:4173/; it stops if the port is taken
```

When the preview stops because port 4173 is taken, an earlier run's server is probably still on it, serving another course. Stop it (`lsof -ti tcp:4173`, then `kill` what that prints if it is yours), or start the preview with `--port <a free port>` and use that port in every address below.

A build error is yours to fix: read it, correct the file. For a Part with a playground, `python3 <skill>/scripts/sync_listings.py <course_dir> --part <N> --check` writes nothing and names each listing whose code no longer matches the playground: run it again without `--check`. A prop the layout does not know, or a required prop you left out, is a compile error here.

## The check page

Open `http://localhost:4173/#/check/part-NN` and wait until `window.__reactSlidesCheck.done` is true (with a browser tool, evaluate it; otherwise load the page in headless Chrome with `--headless=new --virtual-time-budget=15000 --dump-dom` and read the table). First check that its `course` and `part` are this course's slug and this Part: if they are not, another server answered, so go back to Build. It lays every slide out twice (1280 × 720 and a 390 × 844 phone) and reports:

- `findings`: the problems and notes. Fix every `problem`. A `prose-overflow` means the text does not fit: split the slide, do not shrink it. A `clipped-drawing` means a drawing runs past the slide's edge, most often on the phone: draw it smaller or with fewer rows. A `budget` finding means the Part is outside the readability budgets: restructure (merge slides, drop a phase that adds nothing) and tell the user when it changes the approved plan. A `clipped-code` problem means rows of a code or output box are cut off at the bottom (it says how many, and names a highlighted line that is hidden): show fewer lines with `lines`, shorten the output or drop the body. A `wide-line` problem means a line is wider than the box at 1280 × 720 (it gives the line number, its length and what the box fits): excerpt it, or break it over several lines in the program and run it again. A `scrolling-block` note means a line scrolls sideways on the phone only, which a long line often does; check that the part that matters is in view. A `text-overlap` problem means two labels of one drawing sit on top of each other: move them apart. A `clipped-text` problem means text runs out of a Compare panel or the takeaway and is cut off (a long inline code, a run line): shorten it, show an excerpt of the output with `outputLines`, or break the line. An `id-order` problem means a slide's id is not `<part>-<nnn>` or is not greater than the id before it: renumber the slides so the ids run in file order. `fallback` and `out-of-canvas` come from a picture.
- `slides`: every slide, with its section, phase, divider flag, title and text length: the real slide list.

The page does not see everything. Two labels that overlap, a number badge on top of another, text that runs over a drawing: only a screenshot shows these.

## Look at the slides

Save every screenshot in `<work>/screenshots/`, named `<slide id>-desktop.png` or `<slide id>-phone.png`, and nowhere else. Take each one after the fonts have loaded and with the entry animations off, or it catches a drawing mid-fade or a title before it wraps: with headless Chrome, `--headless=new --force-prefers-reduced-motion --virtual-time-budget=8000 --window-size=1280,720 --screenshot=<work>/screenshots/<slide id>-desktop.png http://localhost:4173/#/part-NN/<slide id>` (headless Chrome lays a page out at least 500 px wide, so `--window-size=390,844` gives a cropped wrong picture: take the phone shots with a browser tool's device emulation at 390 × 844, or screenshot the slide's element in the check page's phone frame, `[data-frame="phone"] [data-check-slide="<slide id>"]`); with a browser tool, emulate `prefers-reduced-motion: reduce` and wait for `document.fonts.ready` first. Take a screenshot of:
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
