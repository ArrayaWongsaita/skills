# Interview

Read this at Step 1, before `course.md` exists.

One conversation, one question at a time, each with your proposal so the user can say "yes". Six questions at most; skip any that what the user already said answers. Never ask what a file or their repo already shows.

## The questions

1. **The subject**, and the one thing a learner can do at the end that they cannot do now. That sentence is the course's goal.
2. **The learner**: what they already know, and what they have never done. Propose a learner from what the user said ("writes React, has never written a test").
3. **The stack**: the tool under study, the language, the package manager, the runtime version. Propose what the user's other work uses. No stack is built in: whatever they choose, the playground is written for it at Step 3.
4. **An existing playground?** If the user already has a repo for this subject, ask for its path; the outline is then read from it (SKILL.md, From an existing playground).
5. **The size**: about how many chapters, and how long a learner spends on one. Propose 10–16 chapters of 20–40 minutes when they have no view.
6. **The slides' language** and the course title, if not already clear.

## What it writes

The head of `<course_dir>/course.md`, in the format of `outline.md`, without the outline rows yet:

- the title, `Learner:`, `Goal:`, `Stack:`, `Slides language:`;
- `## Playground` with `Chapters folder:` and the three commands left as `Install: (Step 3)` and so on until Step 3 fills them (the scripts refuse to run a placeholder);
- `## Outline` with the header row only.

Make `<course_dir>` if it does not exist. Tell the user in two lines what you wrote, and go on to the outline.
