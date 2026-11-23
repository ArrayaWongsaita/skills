# Planning the storyboard

You are the coordinator. Read this at Stage 1, before you plan a Part's deck, and again at Stage 2, before you present the plan. The unit map and the storyboard are the plan the user approves. Writers fill it in afterwards and may not change its shape, so every decision about units, order, layouts and diagrams is made here.

Plan in this order: the unit map (`units.json`), then the diagrams, then the storyboard.

## Read first

- `00-overview.md`: the glossary and the other Parts' titles
- the Part file
- `slides/visual-vocabulary.md`, when it exists: the concepts and shapes earlier decks already use
- `references/deck-template.md` (layouts, limits, visual JSON) and `references/visuals.md` (choosing and drawing visuals)

## The unit map

A Part explained as one long story loses the learner: they stop knowing what they are learning right now. So each sub-topic is cut into small **units**, one thing to understand or do, small enough to explain around one concept. The learner meets them one at a time, each opened by a divider, and sees them put back together at the end of the chapter.

- **Unit:** an id `u-<words>` (lowercase ASCII, hyphens), unique in the Part; a `title` of at most 40 visible characters, because the slide header shows it; a `goal` of at most 120, with an observable verb ("build", "tell apart", "fix"), never "understand"; `needs`, the ids of the units it relies on.
- **Chapter:** a run of units that ends in an assembly. A sub-topic is one chapter by default, with the sub-topic key as its id (`1.2`). A sub-topic split into chapters gives them letters, in order: `1.2a`, `1.2b`.

**Finding the units:**
- List what a learner must grasp to follow the sub-topic's Core knowledge and Worked example: each concept, each part of the program, each step the learner performs.
- Merge ideas the learner's prior knowledge already covers. Split anything that needs two explanations.
- A chapter has two to six units. A sub-topic that would need more, or that builds two separate programs, splits into chapters. A sub-topic with one idea is one unit, in one chapter.

**Ordering them:**
- By `needs`: every id in `needs` names a unit that comes earlier in the deck.
- Where `needs` leaves a choice, put the simpler unit first, then the one closer to the program's first lines.

**Moving a unit:** only when a unit of an earlier sub-topic needs something the Part teaches later. The unit then sits in the earlier chapter, with `moved_from` (the sub-topic it came from) and a `reason` (which unit here needs it, and why). Its slides may use refs from `moved_from`. A moved unit teaches the concept; it shows no code from a snippet of a sub-topic the learner has not reached. Every move is a problem in the Part's order, so:
- assembly lists it in the deck notes under `### Part ordering problems`;
- you show it at the gate and in the Stage 6 report;
- when the run moves at least one unit, append one line to `<work>/skill-problems.md` for all the moves together: `- improvement · Part N sub-topic order: <the moves, in short> · course-research outline · storyboard`.

Write the map to `slides/_work/part-NN/units.json`:

```json
{"chapters": [
  {"id": "1.2", "section": "1.2", "title": "สร้าง agent ที่เรียก tool", "units": [
    {"id": "u-tool", "title": "ประกาศ tool", "goal": "เปลี่ยนฟังก์ชันธรรมดาเป็น tool ด้วย @tool", "needs": []},
    {"id": "u-agent", "title": "ต่อ tool เข้ากับ agent", "goal": "สร้าง agent จากโมเดลกับ tool แล้วส่งคำถาม", "needs": ["u-tool"]}]}
]}
```

Every sub-topic has at least one chapter, in Part order, and a section's chapters are consecutive.

## Sections

The deck has one section per part of the Part:
- `opening`
- one section per sub-topic, `N.1` … `N.m`, keyed by the sub-topic number; it holds that sub-topic's chapters
- `closing`

The deck's shape. Deviate inside a unit when the content asks for it, and say why in the storyboard; the dividers and assemblies are fixed:
- **Opening:** cover, real-world task (the problem this Part solves), the `map` slide (the Part's chapters and units, drawn from the unit map), objectives, setup, key terms, then the core mental model shown whole and dimmed: "by the end you can build this". That epitome slide is the core diagram's first appearance, with every shown element in `dim` and `new` empty.
- **Each chapter**, inside its sub-topic section:
  1. For each unit, in map order:
     1. a `topic` slide, the unit's divider: its Title is the unit's `title` and its Body the unit's `goal`, character for character;
     2. the unit's slides, as many as it needs. The default rhythm: something concrete from the Part (the worked example's situation, as an illustration or a diagram), then the concept on the chapter's diagram, one build step at a time, then **only this unit's lines of code**, one `code` slide per highlighted step, then their output. The unit's own misconceptions, errors and a self-check item that tests only this unit come last.
  2. When the chapter has two or more units, an `assemble` slide (`"assembles": "<chapter id>"`): the whole program with each unit's lines labelled, or the chapter's diagram complete with each unit's elements labelled. Then the program's output. A single-unit chapter has no `assemble` slide.
  3. The wrap-up: the misconceptions and errors that span units, the remaining `question` and `answer` slides, the sources.
- **Closing:** an `assemble` slide with `"assembles": "part"`, the core mental model complete with each chapter's elements labelled; then summary, practice, bridge to the next Part, further reading and sources.

A Part slot that holds `_None._` produces no slide. Every other slot, and every snippet, must be covered by some slide's `from` and `snippet`; the validator checks this.

## Slides

One new idea per slide. Plan for each slide:
- **id:** `<part>-<nnn>`, in order
- **layout:** from the closed set in `deck-template.md`
- **purpose:** the single new thing the learner gains, one line
- **unit:** the unit it belongs to, in a sub-topic section; the slides after an `assemble` belong to the chapter as a whole
- **from:** the Part refs it draws on (`"Objectives"`, `"1.2/Core knowledge"`). A sub-topic ref belongs only in that sub-topic's section, except on a slide of a moved unit, which may use refs from its `moved_from`; the opening and closing use Part-level refs.
- **visual:** a diagram and its build step, an illustration, a screenshot, the layout's own content, or none

Choosing a layout:
- `explain` (B) is the default explanation: a short title, a paragraph, and a visual beside it.
- `focus` (A) for a single point or a hook: one full-sentence title, at most two short sentences.
- `steps` (C) for a process or a structure with parts: 2–6 numbered items matching numbered badges on a diagram.
- `map`, `topic` and `assemble` have the places the deck's shape gives them, and only those.
- Code, output, errors, comparisons, terms, questions and answers use their own layouts.
- When text will not fit a layout's limit, plan two slides, not a denser one.

## The term rule

A term is **known** when it is:
- in the learner's prior knowledge, as the Part's `Context` states it
- taught by an earlier Part: the overview glossary, the Part's `Context` and `prerequisite_parts`
- explained on an earlier slide of this deck

Plan so that no slide relies on a term before it is known:
- Opening slides before the `terms` slide (cover, real-world task, objectives, setup) may name a term, as the Part title does, but must not rely on it to explain anything.
- A `terms` slide counts as one idea and holds at most 5 terms. Use two `terms` slides for more.
- A term the Part itself never explains is a **Part gap**. Writers may not add content, so record it in `deck-notes.md` and show it at the gate; do not plan a slide that explains it.

## Diagrams

Plan every diagram in full before the gate, in `slides/_work/part-NN/diagrams.md`: a `# Diagrams` heading and one ```` ```diagram ```` block per diagram, in the format of `deck-template.md`. Writers only reference diagrams; they never define one. A diagram is often used in several sections (the core mental model appears in the opening, a sub-topic and the closing's assembly), and its fixed layout must be finished before the first build step can be drawn.

Plan one diagram per chapter that grows across its units, and say which slides build it up and what each adds; its `assemble` slide shows it complete. Then run:

```bash
python3 <skill>/scripts/validate_deck.py <course_dir> <N> --plan
```

Fix every error before the gate. `--plan` checks `units.json` (its shape, the limits, the ids, that `needs` point backwards, that every sub-topic has a chapter, and the moves) and the diagrams: their geometry, references and concepts against the vocabulary plus `new-concepts.json`. `--diagrams` checks the diagrams alone.

## Files you write

All in `slides/_work/part-NN/`:

**`units.json`:** the unit map, as above.

**`storyboard.md`:** one table per section. A sub-topic table's `unit` column names each slide's unit; its rows follow the unit map: per unit, the `topic` slide, then the unit's slides; then the chapter's `assemble` slide and wrap-up.

```markdown
# Storyboard: Part N <title>

## Opening

| id | layout | purpose | from | visual |
|---|---|---|---|---|
| 1-001 | cover | … | Real-world task | none |
| 1-002 | focus | … | Real-world task | d-agent-loop: n-user, n-model, e-ask, e-answer |
| 1-003 | map | … | Objectives | none |

## 1.2 <sub-topic title>

| id | unit | layout | purpose | from | visual |
|---|---|---|---|---|---|
| 1-017 | u-tool | topic | … | 1.2/Worked example | none |
| 1-018 | u-tool | code | … | 1.2/Worked example | snippet 1.2-a, lines 1–8 |
| 1-020 | u-agent | topic | … | 1.2/Core knowledge | none |
| 1-026 | (chapter) | assemble | … | 1.2/Worked example | snippet 1.2-a, lines 1–13: u-tool 5–8, u-agent 11–13 |

## Closing

…

## Deviations from the default order

- <section>: <what and why>, or _None._
```

**`diagrams.md`:** as above.

**`new-concepts.json`:** a JSON list of the concepts this Part's diagrams need that the vocabulary lacks, each `{"id", "meaning", "shape", "role", "icon"}`. Write `[]` when there are none. Never repeat an existing concept with other values: the vocabulary is append-only, and the check refuses it.

**`deck-notes.md`:** plain paragraphs or lists, no headings. It holds:
- the learner profile, from the Part's `Context`
- that the deck is read alone, without narration, so every slide must explain itself
- the Part gaps, or "none"

Assembly copies it under the deck's `## Deck notes` and adds the visuals, code status and Part ordering problems lists.

## Presenting the gate (Stage 2)

Present in the user's language, the unit map first:
- per chapter, its units in order, each with its goal and its `needs`
- every split chapter, and every moved unit with its `moved_from` and reason

Then the storyboard:
- the slide count per section, per chapter and per unit
- each slide's title idea and layout
- the planned diagrams and their build steps
- every illustration, and every screenshot with why a diagram is not enough
- the new vocabulary concepts
- the Part gaps
- a warning when the Part's `code_status` is `"unverified"`
- on the course's first Part only: the proposed illustration style, one English sentence that every image prompt will end with

The user approves the unit map and the storyboard together. Loop on their changes, editing the files and re-running `--plan`, until they approve.
