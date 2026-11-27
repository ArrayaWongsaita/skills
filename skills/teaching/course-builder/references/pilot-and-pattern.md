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
4. Save the real runs for the slides:

   ```bash
   python3 <skill>/scripts/check_playground.py <course_dir> --chapter 01 --save-output <course_dir>/runs
   ```

5. Build the chapter's slides with `part-slides`, as Part 1 of the same course. It writes the brief from `course.md` instead of interviewing, and takes code from the playground with its `sync_listings.py` (its `references/slides.md`, Code). The slides explain what the exercises have the learner do, mostly with pictures; the code on a slide is the playground's code.

## The user's review

Show the user the real thing: the exercise file on `main`, the solution on `solutions`, and the slides in the browser. Ask what to change in each. Apply the changes the same way (edit `units/01/…`, run `apply_unit.py` again, rebuild the slides), until they are happy. Then `course_md.py <course_dir> --set 01 done`.

## `pattern.md`

Write what the review settled as short rules a worker can follow without seeing the conversation. Cover what the pilot decided, and only that:

- **The exercise file:** the header's parts and length, the hint style (one line, a direction not the answer), the number of exercises per chapter, how a pending test is written.
- **The thing under test:** about how big, how it is named, what it may use.
- **Solutions:** the `solutions` branch only, or `.solutions/` copies on `main` too.
- **The slides of a chapter:** the topics a chapter usually has, which exercise gets a slide and how, what a picture shows, which output is shown.
- **Words:** the terms the course uses for its ideas, in the playground's language.

Quote chapter 1's files by path as the example of each rule; do not copy them in. When a later review changes a rule, change `pattern.md` and say from which wave it applies.
