# Planning the storyboard

You are the coordinator. Read this at Stage 1, before you plan a Part's deck, and again at Stage 2, before you present the plan. The storyboard is the plan the user approves. Writers fill it in afterwards and may not change its shape, so every decision about order, layouts and diagrams is made here.

## Read first

- `00-overview.md`: the glossary and the other Parts' titles
- the Part file
- `slides/visual-vocabulary.md`, when it exists: the concepts and shapes earlier decks already use
- `references/deck-template.md` (layouts, limits, visual JSON) and `references/visuals.md` (choosing and drawing visuals)

## Sections

The deck has one section per part of the Part:
- `opening`
- one section per sub-topic, `N.1` … `N.m`, keyed by the sub-topic number
- `closing`

Default order. Deviate when the content asks for it, and say why in the storyboard:
- **Opening:** cover, real-world task (the problem this Part solves), objectives, setup, key terms, core mental model.
- **Each sub-topic:**
  1. a hook: the problem or question
  2. the explanation: one or more `focus`, `explain` or `steps` slides, building diagrams up
  3. the analogy, when the Part has one
  4. a code walkthrough: one `code` slide per highlighted step
  5. the expected output
  6. misconceptions: `compare` slides, including outdated patterns
  7. common errors
  8. a `question` slide and an `answer` slide per self-check item
- **Closing:** summary (back to the core mental model), practice, bridge to the next Part, further reading and sources.

A Part slot that holds `_None._` produces no slide. Every other slot, and every snippet, must be covered by some slide's `from` and `snippet`; the validator checks this.

## Slides

One new idea per slide. Plan for each slide:
- **id:** `<part>-<nnn>`, in order
- **layout:** from the closed set in `deck-template.md`
- **purpose:** the single new thing the learner gains, one line
- **from:** the Part refs it draws on (`"Objectives"`, `"1.2/Core knowledge"`). A sub-topic ref belongs only in that sub-topic's section; the opening and closing use Part-level refs.
- **visual:** a diagram and its build step, an illustration, a screenshot, the layout's own content, or none

Choosing a layout:
- `explain` (B) is the default explanation: a short title, a paragraph, and a visual beside it.
- `focus` (A) for a single point or a hook: one full-sentence title, at most two short sentences.
- `steps` (C) for a process or a structure with parts: 2–6 numbered items matching numbered badges on a diagram.
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

Plan every diagram in full before the gate, in `slides/_work/part-NN/diagrams.md`: a `# Diagrams` heading and one ```` ```diagram ```` block per diagram, in the format of `deck-template.md`. Writers only reference diagrams; they never define one. A diagram is often used in several sections (the core mental model appears in the opening, a sub-topic and the summary), and its fixed layout must be finished before the first build step can be drawn.

For each diagram, plan which slides build it up and what each adds. Then run:

```bash
python3 <skill>/scripts/validate_deck.py <course_dir> <N> --diagrams
```

Fix every error before the gate. It checks the geometry, the references and the concepts against the vocabulary plus `new-concepts.json`.

## Files you write

All in `slides/_work/part-NN/`:

**`storyboard.md`:**

```markdown
# Storyboard: Part N <title>

## Opening

| id | layout | purpose | from | visual |
|---|---|---|---|---|
| 1-001 | cover | … | Real-world task | none |
| 1-002 | focus | … | Real-world task | d-agent-loop: n-user, n-model, e-ask, e-answer |

## 1.1 <sub-topic title>

| id | layout | purpose | from | visual |
|---|---|---|---|---|

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

Assembly copies it under the deck's `## Deck notes` and adds the visuals and code status lists.

## Presenting the gate (Stage 2)

Present in the user's language:
- the slide count per section
- each slide's title idea and layout
- the planned diagrams and their build steps
- every illustration and screenshot, with why a diagram is not enough
- the new vocabulary concepts
- the Part gaps
- a warning when the Part's `code_status` is `"unverified"`
- on the course's first Part only: the proposed illustration style, one English sentence that every image prompt will end with

Loop on the user's changes, editing the files and re-running `--diagrams`, until they approve.
