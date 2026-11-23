# Writing a deck section

You write one section of a Part's slide deck: the opening, one sub-topic, or the closing. The learner reads the slides alone, without a teacher or narration, so every slide must explain itself. A later skill builds the slides in Google Slides or React from the deck alone, exactly as you write them.

## First, read

1. `references/deck-template.md`: the slide grammar, layouts, field labels, length limits and visual JSON. Follow it exactly.
2. `references/visuals.md`: how visuals and build steps work.

## Your inputs

The prompt gives you absolute paths to:
- `00-overview.md`: the glossary; use its wording for every term it defines
- the Part file: the only source of content
- `_work/part-NN/storyboard.md`: the approved plan; your slides are the rows of your section, and its `unit` column says which unit each belongs to
- `_work/part-NN/units.json`: the approved unit map: each chapter's units, in order, with their titles, goals and `needs`
- `_work/part-NN/diagrams.md`: every diagram, already defined
- `slides/visual-vocabulary.md`: concepts and the illustration style
- your section key, your slide ids, and the output path `_work/part-NN/sections/<key>.md`

## Write

- **The file:** your section's `##` heading (`## Opening`, `## N.k <sub-topic title>` or `## Closing`), then your slides in order. Nothing else: no title, no notes, no text between slides.
- **One slide per storyboard row,** with its id, layout and purpose. Every slide starts with its `slide` block.
- **Content comes from the Part only:** no new facts, no new code, no error messages and no analogies beyond the Part. Rephrase freely into slide-sized, conversational text addressed to the learner, but add nothing. When a slide seems to need something the Part lacks, report it; do not fill it in.
- **Inline code** (`` `like_this` ``) only as it appears in the Part, character for character.
- **Terms:** use a term only once it is known: the learner's prior knowledge from the Part's `Context`, an earlier Part, or an earlier slide.
- **Lengths:** stay within each layout's limits. They count visible characters.
- **Titles:** `focus` titles are full sentences that state the point. Other titles are short and unique within the deck.
- **Sources:** list in `sources` the Part URLs the slide's claims rely on. Never add a URL the Part does not cite.

## Units

A sub-topic section holds one or more chapters, and each chapter a few small units. The learner meets one unit at a time and must always know which one they are in.
- **Write each unit's divider, then its slides.** The `topic` slide's block carries `"unit": "<unit id>"`; its Title is the unit's `title` and its Body the unit's `goal`, character for character, from `units.json`.
- **Stay inside the unit:** its slides explain only what its goal names. Something another unit teaches is not explained here; something a later unit teaches is not relied on.
- **Code:** a unit's `code` slides show only that unit's lines of the snippet. The whole program appears once, on the chapter's `assemble` slide.
- **A moved unit** (one with `moved_from` in `units.json`) is written by you when it sits in your section. Read its origin sub-topic in the Part as well; its slides may use refs from that sub-topic. It teaches the concept and shows no code from a snippet of a sub-topic the learner has not reached.

## Code, output and errors

- A `code` slide shows an excerpt of one snippet. Set `lines` to the shown ranges and `highlight` to the lines the Body explains. The block holds exactly those lines, copied from the Part.
- An `output` slide copies the snippet's expected output exactly, with the same info string. When it is illustrative, say in the Body that real output will differ.
- An `error` slide needs a `Symptom` or an error block, or both. The block holds the error text the Part gives, verbatim. When the Part gives no error text, the `Symptom` says what the learner sees, in the Part's words.
- When a snippet's status is not `verified`, add a `**Notice:**` field to its `code`, `output` and code `assemble` slides saying, in the slide language, that the code has not been run.

## Assemblies

An `assemble` slide puts the chapter's units back together, or, in the closing (`"assembles": "part"`), the Part's chapters. It introduces nothing new: every piece it labels was taught earlier.
- **It shows code or a diagram, not both.** On code: `snippet`, `lines` (the shown ranges, usually the whole program) and one block holding exactly those lines. On a diagram: a diagram visual, no `snippet` and no block.
- **`labels`** numbers the pieces in order, and the builder draws the numbers:
  - on code, `[{"unit": "<unit id>", "lines": [[first, last], …]}, …]`: each range inside the shown `lines`, no two labels' ranges overlapping; lines that belong to no unit, such as imports, may stay unlabelled;
  - on a diagram, `[{"unit": "<unit id>", "elements": ["<element id>", …]}, …]`, each element in `show`;
  - in the closing, `[{"chapter": "<chapter id>", "elements": [...]}, …]`, labelling every chapter.
- **Scope:** a label names a unit of this chapter or of an earlier chapter of the same section, never a later chapter's.
- **Coverage:** a chapter's assemble slides, together, label every unit of the chapter. A moved unit is labelled only when the program or the diagram contains it.
- The Body says what the numbers are, in the units' words.


## Visuals

- Reference diagrams by id; never define or change one. Set `show`, `new`, `highlight` and `dim` for each slide. `new` is exactly what this slide adds over the previous slide on the same diagram.
- When a diagram needs a change, or a missing vocabulary concept, report it. The coordinator edits `diagrams.md` and the vocabulary.
- Illustration prompts are English and end with the vocabulary's illustration style sentence, exactly.

## What you may change

Within your own section, and only within a unit, without asking:
- **Split** a slide whose text exceeds its limit into consecutive slides. Give the new slide the previous id plus a letter: `1-007a`, `1-007b`. Assembly renumbers the whole deck.
- **Add a build step** to a diagram sequence.
- **Reorder** the unit's slides.

Never move a slide to another unit, never reorder units, never drop a `topic` or an `assemble` slide or any other planned slide, never move content to another section, and never add a section. Report the need instead: the coordinator changes the unit map.

## Revision mode

Sometimes the prompt gives you a list of issues instead: from the validator or the learner review, each with a slide id.
- Fix exactly those issues, in `sections/<key>.md`. Leave every other slide as it is.
- Each issue names the slide by its deck id and by your draft id; they differ after a split. Edit the slide with the draft id.
- If an issue needs content the Part does not have, do not invent it: report it as a Part gap.

## When you finish

Reply in three to six lines with:
- the file path and the number of slides
- every change from the storyboard: splits, added build steps, reorders, each with its unit
- anything you need from the coordinator: a diagram change, a missing concept, a Part gap, a unit that should split, merge or move
- `Skill problem: <what got in the way, and where>`, one line each, only when this brief, a script or a template got in your way
