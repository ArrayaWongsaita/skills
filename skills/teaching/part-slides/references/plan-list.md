# The plan list

Read this before you present the plan, and again when the user edits it.

The plan list is the one thing the user approves. It shows each slide in words, so the user can see the whole Part before any slide is built. It is the skeleton of the slides, not a document: after the build the slides are the truth and the check page lists them.

## What a Part looks like

- **Opening, at most 3 slides:** a cover; what the learner will be able to do at the end, in their words; optionally one concrete situation. No glossary slide. No setup list unless the Part needs real setup.
- **Each topic, a segment that always runs the same way, at most 9 slides including its divider:**
  1. a **divider** (`Topic`): the topic's name, an optional tagline, an optional picture. Nothing else.
  2. **know** (รู้จัก), 1 or 2 slides: the learner sees or does a concrete thing first, then gets its name and what it is for.
  3. **parts** (ส่วนประกอบ): one slide per part, each with its own picture or its own line of code. An `Anatomy` slide cuts a call or a formula into numbered pieces.
  4. **example** (ตัวอย่าง): one working example. For code, the code and its real output on one slide.
  5. **watchout** (ระวัง): only for a mistake a beginner really makes at that point, and never about something not yet taught.
  6. **check** (ทบทวน): off unless the user asks for it.
- **Closing:** what the learner can now do, the bridge to the next Part, and one sources slide (the only place source names and URLs appear).

A phase with nothing to say is left out. Fewer slides is better: a topic of five slides that is clear beats nine that repeat.

## The budgets

The check page reports a `budget` finding when a Part breaks one of these, so plan inside them.

<!-- budgets: topic 9 · opening 3 · part 40 · note 35 · prose th 160 · prose other 220 -->

- A topic has at most 9 slides including its divider; the Opening at most 3; the Part at most 40 (a note from 35).
- A slide's text (title, body, items, not code) is at most 160 characters in Thai and 220 in other languages. More than that is two slides.
- Phases run in order: know, parts, example, watchout, check. A topic starts with its divider.

## Rules for the content

- Concrete before abstract: show a thing, then name it.
- A term is explained on the first slide that needs it, in the learner's words. No up-front glossary.
- One new idea per slide. The same picture is reused for the same idea, with the part under discussion highlighted.
- No source voice on slides ("X states that…"). Sources go on the last slide.
- Every claim, number and name is in `research.md`.

## The file

`<work>/plan.md`:

```
# Plan: Part <N> <title>
Status: draft
Learner: … · Goal: … · Language: th · Code: none
Assumed: …    Unverified: …

## Story
Five to eight sentences: how the learner's understanding grows, topic by topic.

## Opening
| # | phase | layout | title | what the text says | picture |
|---|---|---|---|---|---|
| 1-001 | — | Cover | … | … | none |

## <topic name>
| # | phase | layout | title | what the text says | picture |
| 1-004 | — | Topic | … | tagline | … |
| 1-005 | know | Explain | … | … | Flow: a, b, c |
| 1-006 | parts | Explain | … | … | same picture, "b" highlighted |

## Closing
…
```

`#` is the slide's id (`<part>-<nnn>`). `layout` is a component of `slides.md`. `picture` says in words what the picture is, so the user can see it: a figure and its labels, "a drawing of …", "the code line, cut in 3 pieces", or `none`.

Choosing a layout:
- `Explain` is the default: a title, a short paragraph and a picture beside it. `Focus` is for a single point or a hook. `Steps` is for 2 to 6 numbered items.
- `Anatomy` for one line of code or one formula cut into pieces. `Example` for code with its output. `Code` or `Output` when only one of them is wanted.
- `Compare` for two things side by side, `Error` for a mistake with its cause and fix.
- `Topic` for a divider, `Summary`, `Sources`, `Cover`, `Objectives` for the Opening and Closing.

## Presenting it

1. Tell the user, in their language, the story in a few sentences, then show each topic's table (id, phase, title, what it says, picture) and the counts: slides per topic and in total.
2. Name each phase once in plain words, so the user can read the tables.
3. Ask what to change. Accept any edit: add, remove, merge, split, move, reword, a different picture, a different example. Apply each edit to `plan.md`, show only the rows that changed, and keep inside the budgets (say so when an edit would break one, and offer the nearest fit).
4. When the user approves, change the line to `Status: approved` and go on to build. Do not build before that.
