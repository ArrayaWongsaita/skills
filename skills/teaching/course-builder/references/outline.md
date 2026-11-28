# Outline

Read this at Step 2, and whenever you change `course.md`.

## The format of `course.md`

`course_md.py` reads exactly this; keep the headings, the `Key: value` lines and the column names.

```markdown
# Testing React components

Learner: เขียน React ได้ แต่ยังไม่เคยเขียนเทสต์
Goal: เขียนเทสต์ที่ render component กดเหมือนผู้ใช้ แล้วตรวจว่าอะไรเปลี่ยน
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
- The keys (`Learner:`, `Goal:`, …) and the column names stay as they are: the parser reads them. The values are in the slides' language (`Slides language:`), except `slug`, the commands, and names of the tool's API in `practises`, which stay as the tool writes them.
- `slug` is lowercase letters, digits and hyphens; the chapter's folder is `<Chapters folder>/NN-<slug>`.
- `builds on` names the chapters this one needs, separated by commas (`01, 02`), or `–`.
- `under test` is the small thing the chapter's exercises test or work on: a component, a function, a page, a table or a small data set.
- `status` starts at `outline` for every row. The scripts change it; to change it yourself, run `python3 <skill>/scripts/course_md.py <course_dir> --set NN STATUS`.

## Proposing the outline

1. Research the order in which this subject is learnt: the tool's own guide, two or three well-regarded courses or tutorials. Note what each step needs from the ones before it. Read the documentation of the version in `Stack:` (a docs site's default page is often a newer version, with features the course's version lacks). When the tool's own documentation is a reference manual with no learning order, take the order from the tutorials, and the details from the manual.
2. Order the chapters for this learner, not for the sources: each chapter practises one new thing, and uses only what earlier chapters taught. A chapter whose `builds on` names a later chapter is in the wrong place. When the goal names more skills than the user's chapter count, either propose more chapters or pair two skills a learner uses together in one chapter, name both in `practises`, and say which you paired when you show the table.
3. Group them in stages (ช่วง) of 3–5 chapters, each with a name a learner understands. A course of 6 chapters or fewer may have stages of 2; never one stage that holds the whole course.
4. Give each row a small `under test`: something a beginner reads in one screen. A chapter that needs a big example to be interesting is two chapters.
5. Show the user the table and the stages, with one line on why the order is what it is. Let them edit it, as often as they like. Nothing is built until they approve it.

When the outline is approved, run `python3 <skill>/scripts/course_md.py <course_dir>` once: it prints the outline as JSON when the file parses, and names the row and the cell when it does not.
