# Outline

Read this at Step 2, and whenever you change `course.md`.

## The format of `course.md`

`course_md.py` reads exactly this; keep the headings, the `Key: value` lines and the column names.

```markdown
# Testing React components

Learner: writes React, has never written a test
Goal: writes a test that renders a component, acts on it like a user, and checks what changed
Stack: TypeScript, React, Vitest, Testing Library, pnpm, Node 20
Slides language: th

## Playground

Chapters folder: lessons
Install: pnpm install
Setup check: pnpm test setup-check
Run chapter: pnpm vitest run {folder}
Run all: pnpm vitest run

## Stages

- ช่วง 1 พื้นฐาน: 01–03
- ช่วง 2 การกระทำของผู้ใช้: 04–06

## Outline

| NN | slug | title | practises | builds on | under test | status |
|---|---|---|---|---|---|---|
| 01 | first-render | Render แล้วหาข้อความ | render, screen.getByText | – | Hello.tsx | outline |
| 02 | find-by-role | หาด้วยบทบาท | getByRole, name | 01 | Greeting.tsx | outline |
```

- `Run all:` is optional: a whole check (`check_playground.py` with no `--chapter`) runs it on both branches too.
- `Run chapter:` may use `{folder}` (`lessons/01-first-render`), `{nn}` (`01`) and `{slug}`.
- `slug` is lowercase letters, digits and hyphens; the chapter's folder is `<Chapters folder>/NN-<slug>`.
- `builds on` names the chapters this one needs, or `–`.
- `under test` is the small thing the chapter's exercises test: a component, a function, a page.
- `status` starts at `outline` for every row. The scripts change it; to change it yourself, run `python3 <skill>/scripts/course_md.py <course_dir> --set NN STATUS`.

## Proposing the outline

1. Research the order in which this subject is learnt: the tool's own guide, two or three well-regarded courses or tutorials. Note what each step needs from the ones before it.
2. Order the chapters for this learner, not for the sources: each chapter practises one new thing, and uses only what earlier chapters taught. A chapter whose `builds on` names a later chapter is in the wrong place.
3. Group them in stages (ช่วง) of 3–5 chapters, each with a name a learner understands.
4. Give each row a small `under test`: something a beginner reads in one screen. A chapter that needs a big example to be interesting is two chapters.
5. Show the user the table and the stages, with one line on why the order is what it is. Let them edit it, as often as they like. Nothing is built until they approve it.

When the outline is approved, run `python3 <skill>/scripts/course_md.py <course_dir>` once: it prints the outline as JSON when the file parses, and names the row and the cell when it does not.
