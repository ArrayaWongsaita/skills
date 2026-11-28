# Pilot and pattern

Read this at Step 4, to build chapter 1 in full and turn what the user settles into `pattern.md`.

The pilot is where systemic mistakes are cheap: one chapter, built for real, looked at by the user before any other chapter starts.

## Build chapter 1

1. `python3 <skill>/scripts/course_md.py <course_dir> --set 01 pilot`
2. Write the chapter, as `playground.md` describes, into `<course_dir>/units/01/main/` and `<course_dir>/units/01/solutions/`, with paths from the playground's root (`units/01/main/lessons/01-first-render/…`). Start from the outline row: its `practises`, its `under test`, what it `builds on`.
3. Check and apply it:

   ```bash
   python3 <skill>/scripts/apply_unit.py <course_dir> 01
   ```

   It copies each into a temporary worktree of its branch, checks the shape and runs the commands, and commits on both branches only when both pass. Fix and run it again until it prints `chapter 01: committed`.
4. Read it as the learner: copy `units/01/main/` aside, write one plausible wrong answer per exercise into `units/01/main/` (never the playground), under each `👉` line, keeping the `ข้อ N`, `แนวทาง:` and `👉` lines (the shape check runs before the tests), run `apply_unit.py <course_dir> 01 --check --save-output <course_dir>/.wrong-runs`, read `.wrong-runs/01-main.txt` as the learner would, then put the copy back and delete `.wrong-runs/`. Include a mistyped name or text among the wrong answers. Each wrong answer must fail, and its output must say which exercise and what was wrong in words this learner reads (`playground.md`, A chapter). Fix the unit until it does, and show the user one such output at the review.
5. Save the real runs for the slides:

   ```bash
   python3 <skill>/scripts/check_playground.py <course_dir> --chapter 01 --save-output <course_dir>/runs
   ```

6. Build the chapter's slides with `part-slides`, as Part 1 of the same course. It writes the brief from `course.md` instead of interviewing, and takes code from the playground with its `sync_listings.py` (its `references/slides.md`, Code). The slides explain what the exercises have the learner do, mostly with pictures; the code on a slide is the playground's code. Two rules every chapter's slides keep:
   - **No slide shows an exercise's answer**, not even a watchout's fix line or an Anatomy strip. A listing from `solutions` that is an exercise's test or code gives the exercise away; show the worked example of the header, or a separate example file in the chapter folder, instead.
   - **The Closing shows how to do the chapter**, before the summary: one `Steps` slide (open which file, write under each `👉`, run which command; a command too long for the slide's text goes on a `Code` slide after it) and the real run on `main` (pending) and on `solutions` (passing), from `runs/01-main.txt` and `runs/01-solutions.txt`, each as an excerpt with `outputLines`: a `Compare` with `leftBlocks` and `rightBlocks` when both lines fit a half (about 45 characters), else two `Output` slides. These slides have `section: "Closing"`, so they need no divider.

## The user's review

Show the user the real thing: the exercise file on `main`, the solution on `solutions`, and the slides in the browser. Ask what to change in each. Apply the changes the same way (edit `units/01/…`, run `apply_unit.py` again, rebuild the slides), until they are happy. Then `course_md.py <course_dir> --set 01 done`.

## `pattern.md`

Write what the review settled as short rules a worker can follow without seeing the conversation. Cover what the pilot decided, and only that:

- **The exercise file:** the kind of exercise (the learner writes the test, or the code), the header's parts and length, the hint style (one line, a direction not the answer), the number of exercises per chapter, how a pending test or check is written, and what a wrong answer prints (quote the output the user saw).
- **The thing under test:** about how big, how it is named, what it may use.
- **Solutions:** the `solutions` branch only, or `.solutions/` copies on `main` too.
- **The slides of a chapter:** the topics a chapter usually has, which example each topic's code comes from (never an exercise's answer), what a picture shows, which output is shown, and the Closing's how-to slides.
- **Words:** the terms the course uses for its ideas, in the playground's language.

Quote chapter 1's files by path as the example of each rule; do not copy them in. When a later review changes a rule, change `pattern.md` and say from which wave it applies.
