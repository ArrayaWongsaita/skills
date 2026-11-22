# Design: `slide-design` skill

- Date: 2026-11-22
- Status: Draft, awaiting approval
- Location of the skill: `skills/teaching/slide-design/` (my call; same layout as `course-research`)
- Depends on: the `course-research` contract `course-research/part@1` and `course-research/overview@1` (`skills/teaching/course-research/references/part-template.md`)

## 1. Intent

The user builds self-study courses in three steps:

1. **`course-research`** (exists) researches a topic and writes one cited research file per Part.
2. **This skill** takes **one Part at a time** and designs it as slides. Its output is a written **deck design**: slide by slide, what each slide teaches, the text on it, and the picture or diagram that explains it, in an order where the learner gains one small piece of knowledge per slide until they understand the Part in detail.
3. **A later skill** (not built yet) implements the deck design as real slides, mostly in **Google Slides** or as a **React** slide app.

The slides are **read, not presented**. Learners study alone, with no instructor and no narration, so every slide must explain itself through its picture and its text. Narrated video is a possible future skill, built separately.

The first real use is the LangChain + LangGraph course (Thai, self-paced) that `course-research` produces.

### What the user decided in the brainstorm

- Learners read the slides themselves. No audio.
- Every slide pairs a visual with explanatory text. Visuals, especially diagrams, carry the explanation wherever they make it easier to understand.
- The user prefers **layout B** (visual on one side, a full explanatory paragraph on the other) for reading comprehension. Layouts A (a sentence headline, a big visual and a short caption) and C (a numbered visual with a matching numbered list) are also useful. **The skill picks the layout per slide** from the content.
- Visuals: **diagrams first**. Illustrations and screenshots appear only where they help understanding, and every one has a fallback (see §6.6).
- Approach 2 (§4): storyboard first, approved by the user, then detailed writing, checks and a learner-eye review.

### What success looks like

- The downstream skill can build every slide from the vocabulary file plus one deck file, without opening the Part file and without guessing what a visual should look like.
- A learner reading the deck alone never meets a term before it is explained, never has to take two new ideas in one slide, and can check their own understanding at the end of each sub-topic.
- After the storyboard gate, the user changes little in the finished deck.

## 2. Goals, non-goals, anti-goals

### Goals

- Turn every part of a Part file into slides: objectives, setup, key terms, mental model, real-world task, each sub-topic's knowledge, worked example, analogy, misconceptions, common errors, self-check, practice, and the bridge to the next Part.
- **Progressive disclosure:** one new piece of knowledge per slide. A diagram is built up over several slides, one element at a time, with earlier elements dimmed.
- A **storyboard gate**: the user approves the slide list for the Part before the detailed writing.
- A tool-neutral, versioned **deck contract** that a Google Slides or React builder can follow exactly.
- A **course-wide visual vocabulary** so that the same concept looks the same in every Part.
- Code on slides is always the verified code from the Part, character for character.
- Resumable runs, and redoing a single section.

### Non-goals

- No slide files: no `.pptx`, no Google Slides API calls, no React code. The downstream skill does that.
- No narration, voice-over or audio.
- No new research, facts, code, error messages or analogies beyond what the Part file contains.
- No visual theme or branding: fonts, exact brand colours and slide templates belong to the downstream skill. This skill names colour roles only.
- No preview renderer in v1 (my call; the downstream React skill will be the first renderer). See §7.
- No editing of the Part file. Problems found in it are reported, not fixed.

### Anti-goals (failure even if everything "runs")

- Wall-of-text slides, or the Part file pasted into slides.
- A slide that introduces two new ideas, or uses a term before it is explained.
- Decorative visuals that explain nothing, or a visual that disagrees with its text.
- Invented content: a fact, code line or error message not in the Part.
- Code on a slide that differs from the code the check verified.
- Visual drift between Parts: the model is a blue box in Part 1 and a green circle in Part 3.
- A visual described so vaguely ("a nice diagram of an agent") that the builder has to design it.

## 3. Constraints

- **Runtime:** Claude Code with the Agent tool. Without it, every role runs inline, in sequence, writing the same files (same fallback idea as `course-research`).
- **Scripts:** Python 3 standard library only, run on the system Python, like `course-research`'s coordinator scripts.
- **Self-contained:** the skill is installed on its own. It does not import or call `course-research`'s scripts. It parses the Part contract with its own small parser.
- **Input contract:** `course-research/part@1` and `overview@1`. The skill refuses any other template value. When `course-research` bumps its contract, this skill's parser must follow.
- **Downstream targets:** Google Slides (shapes, text boxes, images; no reliable in-slide reveal) and React (anything). The deck must be buildable in Google Slides, so a build step is a separate slide and a self-check answer is on its own slide.
- **Language:** talk with the user in their language (Thai). Slide text uses the Part's language, keeping established English technical terms. Headings, keys and the contract stay English. Image-generation prompts are English (my call: image models follow English prompts most reliably).
- **Thai text length:** Thai has no spaces, so length limits count characters, not words. Combining vowel and tone marks do not count (my call), so the count tracks the visible width.
- **Repo conventions:** directory name equals the frontmatter `name`; repo docs, code and commits in English; tests run with pytest through `uv`.

## 4. Approaches considered

| # | Approach | Trade-off | Outcome |
|---|---|---|---|
| 1 | **Write in one pass**: read the Part, write the whole deck, run a format check | Fast, cheap, simple. But a Part of 5–6 sub-topics is 50–80 slides, quality drops toward the end of one long pass, the user cannot fix the order before the details are written, and nobody reads it as a learner before it ships. | Rejected |
| 2 | **Storyboard first, then details**: the coordinator plans the slide list, the user approves it, writers fill in each section in parallel, scripts check structure, coverage and code, and a reviewer reads as a beginner | The user controls the order cheaply, quality is even across the Part, and problems are caught before the downstream skill. Costs several subagents per Part. | **Picked** by the user |

## 5. Research basis for the design

The slide rules come from established multimedia-learning and slide-design research:

- **Multimedia principle** (Mayer, *Multimedia Learning*): words with pictures teach better than words alone. Every content slide has a visual.
- **Segmenting** (Mayer): learner-paced segments beat one continuous stream. One idea per slide; the learner moves on when ready.
- **Pre-training** (Mayer): key terms before the explanation that uses them. Key-term slides open the Part, and a term never appears before its slide.
- **Signalling and spatial contiguity** (Mayer): highlight what matters and put words next to the part of the picture they describe. This is layout C's numbered badges, layout B's side-by-side text, dimming earlier elements in a build, and highlighted code lines.
- **Coherence** (Mayer): leave out what does not serve the goal. No decorative visuals.
- **Assertion–evidence slides** (Alley; Garner & Alley): a sentence headline that states the point, supported by visual evidence. This is layout A.
- **Worked examples and fading** (Sweller; Renkl): study a complete worked example step by step before solving alone. Code walkthroughs highlight one part at a time, and practice comes after.
- **Retrieval practice** (Roediger & Karpicke): answering a question before seeing the answer improves retention. The question and its answer sit on separate slides.

Mayer's modality and redundancy principles concern narration, so they do not apply to a deck that is read.

## 6. The design (decided)

### 6.1 Inputs and outputs

Inputs, read only:
- `courses/<slug>/00-overview.md` (`overview@1`)
- `courses/<slug>/part-NN-<slug>.md` (`part@1`): one Part per run

Outputs:

```
courses/<course-slug>/slides/
├── visual-vocabulary.md         ← course-wide, shared by every Part's deck (§6.5)
├── part-01-<slug>.md            ← the deck design for Part 1 (§6.3); same file name as the Part
├── part-02-<slug>.md
└── _work/part-NN/               ← state, storyboard, section drafts, review notes; the downstream skill does not read it
```

The downstream skill reads `visual-vocabulary.md` plus **one** deck file.

### 6.2 Stages

| # | Stage | Who | Output |
|---|---|---|---|
| 0 | Start or resume | coordinator | locate the course and Part; check templates; init or read state |
| 1 | Storyboard | coordinator | `_work/part-NN/storyboard.md`; `_work/part-NN/diagrams.md` (every diagram, fully defined); new concepts for the vocabulary |
| 2 | **Gate: storyboard approval** | user | approved storyboard; vocabulary written |
| 3 | Write sections | one writer per section, at most 5 in parallel | `_work/part-NN/sections/<section>.md` |
| 4 | Assemble and check | coordinator + scripts | the deck file; `validate_deck.py` exits 0 |
| 5 | Learner review | one reviewer, at most 2 rounds | `_work/part-NN/review.md`; fixes through writers |
| 6 | Report | coordinator | a short summary to the user |

A state script records the stage and refuses to skip one, as `course_state.py` does for `course-research`. That is how the gate holds.
- Stages: `storyboard` → `storyboard-approved` → `writing` → `checking` → `reviewing` → `done`.
- Section statuses: `pending` → `written` → `checked`. A section is `checked` when the validator passes and it has no open blocking review issue, or its remaining blocking issues are listed as unresolved after the last review round.

**Stage 0.**
- The user names the course and the Part. The coordinator runs the input checks: the template values, and that the Part file exists.
- It tells the user what the run will cost: one writer per section and one reviewer.
- It warns at the gate when the Part's `code_status` is `"unverified"`.
- When a deck already exists, it offers three choices: **continue**, **redo a section**, or **redo the storyboard**.
- When the Part's `generated` date is newer than the deck's `source_generated`, it says the deck is stale and offers a redo.

**Stage 1: storyboard.** The coordinator reads the overview and the Part and plans the deck:
- **Sections**:
  - `opening`
  - one section per sub-topic `N.1`…`N.m`
  - `closing`
- **Slides**: for every slide, the id, layout (§6.4), a one-line purpose (the single new thing the learner gains), the Part slot(s) it comes from, and the visual kind (diagram, illustration, screenshot, code, none).
- **Diagrams**: each diagram's id, what it shows, and which slides build it up.
- **Vocabulary**: the concepts this Part needs that the vocabulary file lacks.

The coordinator also writes **every diagram in full** in `_work/part-NN/diagrams.md`: nodes, grid positions, edges, groups, badges and notes, in the deck's diagram format (§6.6). It checks them with `validate_deck.py --diagrams` before the gate. This is my call, for three reasons:
- One diagram often spans sections: the core mental model appears in the opening, in sub-topics and in the closing summary.
- A fixed layout needs the finished diagram before its first build step can be drawn.
- Parallel writers must not define the same diagram twice.

Writers only reference diagrams and set their state per slide. A writer that needs a diagram changed reports it, and the coordinator edits `diagrams.md` and checks it again. Diagram errors from the validator go to the coordinator, not to a writer. `assemble_deck.py` copies `diagrams.md` into the deck's `## Diagrams`.

Default order (the planner may deviate per sub-topic and must say why in the storyboard):
- **Opening:**
  1. cover
  2. real-world task (the problem this Part solves)
  3. objectives
  4. prerequisites and setup
  5. key terms
  6. core mental model
- **Each sub-topic:**
  1. hook (the problem or question)
  2. explanation: one or more focus/explain/steps slides, building diagrams up
  3. analogy, if the Part has one
  4. code walkthrough: one code slide per highlighted step
  5. expected output
  6. misconceptions: compare slides, including outdated patterns
  7. common errors
  8. a question slide and an answer slide per self-check item
- **Closing:**
  1. summary (back to the core mental model)
  2. practice
  3. bridge to the next Part
  4. further reading
  5. sources

Slots marked `_None._` produce no slides.

**Stage 2: gate.** The coordinator presents the storyboard in the user's language:
- slide count per section
- each slide's title idea and layout
- the planned diagrams and their build steps
- every illustration and screenshot, with why a diagram is not enough
- the new vocabulary concepts
- gaps in the Part

It loops on the user's changes until they approve, then writes the new concepts into `visual-vocabulary.md`, creating it on the first Part's run. **Writers are never dispatched before approval.**

**Stage 3: write.** One writer per section, given the overview, the Part, the approved storyboard, the diagrams, the vocabulary and the brief. Writers turn Part content into slide-sized text, rephrasing freely, but add no facts.
- **Allowed within the writer's own section**, with no new approval: split a slide into consecutive slides when its text exceeds the limit, add a build step, and reorder slides.
- **Not allowed:** dropping a planned slide, moving content to another section, or adding a section. The writer reports the need, and the coordinator decides. The report to the user lists every change since the approved storyboard. The run does not go back to the gate for these (my call: the gate fixes the plan, and the user sees the deviations at the end).
- Writers do not edit the vocabulary or the diagrams. A writer that needs a missing concept reports it, and the coordinator adds it, append-only, before revision.

**Stage 4: assemble and check.**
- `assemble_deck.py` merges the section drafts in storyboard order into the deck file. It also writes the frontmatter, the diagrams and the code listings.
- `validate_deck.py` checks everything in §6.7.
- Errors go back to the section's writer in revision mode, at most 2 rounds. Whatever still fails is listed in the report.

**Stage 5: learner review.** One reviewer works in two passes:
1. **As the learner:** reads the vocabulary and the deck only, with the Part's `Context` as the learner profile. It flags:
   - a term used before it is explained
   - two new ideas on one slide
   - a skipped step
   - a visual that does not match its text, or is too vague to build
   - text too dense for its layout
   - a question that cannot be answered from earlier slides
2. **For fidelity:** compares the deck with the Part. It flags claims not in the Part, important content left out, and self-check or common-error items without slides.

Each issue has a severity (my call):
- **Blocking:** a learner would be stuck or misled. Examples:
  - a slide relies on a term that has not been explained
  - a claim does not match the Part
  - a visual contradicts its text
  - an answer cannot be worked out from earlier slides
  - Part content is missing
- **Minor:** density, wording or flow that slows the learner without stopping them.

Issues go to writers in revision mode. Then the deck is re-assembled and `validate_deck.py` runs again.
- **Round 1** is the full review. **Round 2** rechecks only the revised slides and the issues they addressed.
- Blocking issues still open after round 2 are listed in the report as unresolved.
- Minor issues are fixed when they fit in those rounds; the rest are listed.

**The term rule.** A term counts as known when it is:
- in the learner's prior knowledge, as stated in the Part's `Context`
- taught by an earlier Part (the overview glossary, plus the Part's `Context` and `prerequisite_parts`)
- explained on an earlier slide of this deck

The rule has three refinements:
- **Opening slides before the `terms` slide** (cover, real-world task, objectives, setup) may name a term, as the Part title does, but must not rely on it to explain anything.
- **A term the Part itself never explains** is reported as a **Part gap**, not sent to a writer, because writers may not add content.
- **A `terms` slide counts as one idea** (this Part's vocabulary), with at most 5 terms per slide.

`references/storyboard.md` and `references/learner-review.md` both state this rule.

**Stage 6: report.** Tell the user, briefly and in their language:
- the deck path
- slide counts per section
- the illustrations to generate and the screenshots to capture
- unverified code
- Part gaps
- any review issue still open

Point to the files and do not paste the deck.

### 6.3 The deck contract (`slide-design/deck@1`)

A Markdown file: human-readable for the user's review, with fenced JSON blocks for everything a builder must parse. Frontmatter values are JSON literals, as in `part@1`.

Frontmatter keys, in order:

| Key | Value |
|---|---|
| `template` | `"slide-design/deck@1"` |
| `course` | the course slug |
| `part` | the Part number |
| `title` | the Part title, identical to the Part file |
| `source_file` | the Part file name |
| `source_generated` | the Part's `generated` date |
| `language` | the slide text language, e.g. `"th"` |
| `vocabulary` | `"visual-vocabulary.md"` |
| `vocabulary_version` | the vocabulary's version number when the deck was assembled (§6.5) |
| `slide_count` | the number of slides |
| `code_status` | copied from the Part |
| `generated` | today, `"YYYY-MM-DD"` |

Body, in order:
- `# Part N: <title>`
- `## Deck notes`: for the builder:
  - the learner profile
  - that the deck is read without narration
  - unverified snippets
  - illustrations to generate and screenshots to capture
  - Part gaps
- One `##` section per deck section, in order (`## Opening`, `## N.1 <sub-topic title>`, …, `## Closing`). Inside it, one `###` block per slide:
  - a heading with the slide id and layout, e.g. `### 1-007 · explain`
  - a `slide` JSON block: `layout`, `purpose`, `from` (Part slots, e.g. `["1.2/Core knowledge"]`), `sources` (URLs the slide's claims rely on, from the Part's citations), and the layout's own fields (§6.4)
  - the slide text as labelled Markdown: title, body, list items, panel texts
  - a `visual` JSON block (§6.6), when the layout has one
  - a code block, for code, output, compare and error layouts
- `## Diagrams`: one `diagram` JSON block per diagram (§6.6).
- `## Code listings`: every snippet the deck shows, verbatim and complete, with its id and check status. A learner needs the whole program to run it, and a slide shows only an excerpt.

Slide ids are `<part>-<nnn>`, sequential in deck order and unique in the course. Answer slides refer back to slides by id.

The exact Markdown labels and JSON field names are fixed in the skill's `references/deck-template.md`, with a filled example, the same way `part-template.md` fixes `part@1`. Renaming any of them bumps the version.

### 6.4 Layouts (a closed set)

| Layout | Use | Required content | Visual |
|---|---|---|---|
| `cover` | Part opening | title, one-line promise | optional |
| `focus` (A) | one point or a hook | a sentence headline that states the point, at most 2 short sentences | required, large |
| `explain` (B) | the default explanation | title, a paragraph | required, about half the slide |
| `steps` (C) | a process or a structure with parts | title, 2–6 numbered items, each matching a numbered badge in the visual | required, numbered |
| `compare` | old vs current, wrong vs right, X vs Y | two labelled panels (text or code), a takeaway line | the panels |
| `code` | one step of a code walkthrough | title, a code excerpt with highlighted lines, an explanation of the highlighted lines | the code |
| `output` | what the learner should see | the expected output verbatim; the "illustrative" note when the Part marks it so | the output |
| `error` | a common error | the error or symptom as the Part gives it, cause, fix | the error text |
| `terms` | key terms | at most 5 terms with meanings, in the glossary's wording | optional |
| `question` | self-check | the question, optional choices, "think first, then go to the next slide" | optional |
| `answer` | self-check answer | the answer, why it is right, the id of the slide to revisit | optional |
| `practice` | practice | the task, hints; a solution only when the Part gives one | optional |
| `summary` | recap | the core mental model again, the key points of the Part | optional |
| `sources` | references | the Part's sources and further reading as links | none |

Writing rules for all layouts:
- One new idea per slide, stated in `purpose`.
- Titles of `focus` slides are full sentences. Other titles are short.
- Every layout has a text length limit, enforced by the validator. The starting limits are my call and get tuned after the first real run:
  - titles: 70 characters
  - `focus` text: 160
  - `explain` paragraph: 420
  - each `steps` item: 80
  - each `answer` explanation: 300
- Text is plain and conversational, addressed to the learner, in the Part's terms (the overview glossary's wording).

### 6.5 Visual vocabulary (`slide-design/vocabulary@1`)

`courses/<slug>/slides/visual-vocabulary.md`, shared by every deck in the course:
- **Colour roles**: a small set (e.g. `primary`, `secondary`, `accent`, `success`, `warning`, `danger`, `neutral`), each with a suggested hex value. The builder may re-theme the hex values but keeps the role mapping.
- **Concepts**: one row per concept: id, meaning, shape (from a fixed shape set every target can draw: box, rounded box, circle, cylinder, document, person, cloud), colour role, and an optional icon name with a text fallback.
  - Examples: `model` → rounded box, `primary`; `tool` → box, `accent`; `state` → document, `secondary`.
- **Illustration style**: one English sentence appended to every image prompt in the course, so illustrations look alike.
- **Rules**: append-only. Later Parts add concepts and never change existing ones, because earlier decks depend on them. A `version` number in the frontmatter goes up by one on each addition.

### 6.6 Visuals

Every `visual` block has a `kind`.

**`diagram`**: a reference to a diagram in `## Diagrams` and its state on this slide:
- `diagram`: the diagram id
- `show`: element ids visible on this slide
- `new`: the elements first shown on this slide, compared with the previous slide that used this diagram. The builder emphasises them.
- `highlight`: elements already shown before and emphasised here (named apart from the `focus` layout)
- `dim`: elements shown faded

Nodes, edges, groups, badges and notes are all elements. Elements not in `show` are hidden. `new`, `highlight` and `dim` are subsets of `show` and do not overlap.

A **build step** is a slide that shows elements the previous slide on that diagram did not, and it lists exactly those in `new`. A slide that adds nothing has an empty `new` and may use `highlight`. Examples:
- an `explain` slide walking through a finished diagram part by part
- badges on a finished diagram, which count as `new` badges
- a summary that shows the whole diagram again
- an answer slide that points back to part of a diagram

`highlight` is in `deck@1` from the start, so walkthroughs do not need a contract bump later.

A diagram definition is tool-neutral and has a fixed layout, so elements never jump between build steps. Mermaid was rejected because its automatic layout moves existing boxes when one is added.
- `id`, `title`, `canvas`: a grid of columns × rows
- `nodes`: `id`, `label`, `concept` (from the vocabulary), position `at` [col, row] and `size` [w, h] in grid cells
- `edges`: `id`, `from`, `to`, optional `label`, `style` (solid or dashed)
- `groups`: a labelled boundary around member nodes, e.g. "agent" around model and tool
- `badges`: numbered markers placed near an element, for `steps` slides
- `notes`: short text labels placed near an element

Google Slides draws it with shapes and connectors at the grid positions. React draws SVG from the same data.

**`illustration`**: only where a diagram cannot carry the idea, typically the Part's analogy or the opening hook:
- `description`: what the picture shows, in the slide language
- `prompt`: an English image-generation prompt ending with the vocabulary's illustration style
- `alt`: alt text
- `fallback`: a diagram reference or a text-only treatment

**`screenshot`**: only for real interfaces the learner must use, typically setup steps such as creating an API key:
- `url`: the page, from the Part's sources
- `capture`: what screen, in what state, and what to highlight
- `fallback`: numbered text steps

Screenshots go stale, so each is listed in the deck notes for the user to capture.

**`code`, `output`, `error`**: the layout's own content is the visual.

### 6.7 What the validator checks

`validate_deck.py <course_dir> <part>` exits 0 only when all of these hold. Like `validate_course.py`, it prints each error with its slide id or line:

- **Structure:** frontmatter keys and values; section order matches the Part's sub-topics; ids sequential and unique; every slide has a known layout with its required fields; references resolve (answer → slide, visual → diagram, `from` → a real Part slot).
- **Length:** text within its layout's limit.
- **Diagrams:** unique element ids; nodes inside the canvas and not overlapping; edges, groups and badges point to real elements; every concept is in the vocabulary; `new`, `highlight` and `dim` are disjoint subsets of `show`; `new` equals exactly what the slide shows that the previous slide on the same diagram did not; a `steps` slide's item numbers match its visible badges. `--diagrams` runs only these checks, on `_work/part-NN/diagrams.md`, before the gate.
- **Coverage:** every Part slot that is not `_None._`, every Part-level section, and every snippet id appears in some slide's `from`. Item-level coverage (each self-check question, each error) is left to the reviewer, because `part@1` does not fix those slots' inner format.
- **Fidelity of code:**
  - Every code excerpt is a contiguous run of lines, or several runs, copied verbatim from the referenced snippet in the Part.
  - The code listings equal the Part's snippets exactly.
  - Outdated code in a compare panel appears verbatim in the Part, in a code block or an inline code span.
  - Expected output matches the Part's block verbatim, with its illustrative note when the Part marks it so.
  - Each snippet's check status (verified, unverified, skipped) is copied, and an unverified snippet's slides carry a visible notice.
- **Visual fallbacks:** every illustration and screenshot has a fallback.

The validator cannot judge meaning. Unclear text, invented facts and weak ordering are the reviewer's job.

### 6.8 Skill files

```
skills/teaching/slide-design/
├── SKILL.md                         coordinator: stages, gate, dispatch prompts, resume and redo
├── references/
│   ├── storyboard.md                how to plan sections and slides, the default order, the gate presentation
│   ├── deck-template.md             the deck@1 and vocabulary@1 contracts, with a filled example
│   ├── visuals.md                   choosing a visual kind, diagram and build rules, prompts, screenshots
│   ├── section-writer.md            brief for writers, including revision mode
│   └── learner-review.md            brief for the reviewer's two passes
├── scripts/                         stdlib only
│   ├── deck_state.py                resumable state; refuses to skip the gate
│   ├── part_reader.py               parses part@1 / overview@1 (slots, snippets, expected output, statuses)
│   ├── assemble_deck.py             section drafts → deck file
│   └── validate_deck.py             the checks in §6.7
├── tests/                           pytest; fixtures: a Part 1 copied from course-research's valid-course, a valid deck for it, broken variants
└── evals/acceptance.md              acceptance checklist for the first real run
```

### 6.9 Resume and redo

- **Continue:** follow the state's next action.
- **Redo a section:** reset it, re-dispatch its writer, re-assemble, validate, and review the whole deck again.
- **Redo the storyboard:** back to Stage 1 and the gate. Sections whose slides changed are reset.
- **Stale deck:** the Part changed after the deck was made. The whole deck is redone from the storyboard.

## 7. Left to the builder

- Exact Markdown labels, JSON field names, and the filled example in `deck-template.md`.
- How `assemble_deck.py` renumbers ids after a revision adds or removes slides, and rewrites references.
- Tuning the length limits, the default palette hex values and the shape set names, as long as every target can draw them.
- How the Thai character count treats combining marks, given the rule in §3.
- CLI names and flags for the scripts.
- A preview renderer (deck → static HTML wireframe) is out of v1. It may be worth adding if reviewing decks as JSON turns out to be hard.

## 8. Acceptance checks for the first build

1. On the fixture Part (`valid-course/part-01-first-agent.md`): the storyboard covers every slot, the gate stops the run, and the deck validates with exit 0.
2. Broken fixture decks each fail with the right error:
   - a changed code line
   - an overlapping node
   - an unknown concept
   - a missing slot
   - a diagram slide whose `new` does not match what it adds
   - text over its limit
3. A second Part run in the same course reuses the vocabulary and only appends to it.
4. On a real Part from the first `course-research` run (LangChain + LangGraph, Thai), the user approves the storyboard with few changes. The reviewer's learner pass ends with no blocking issue, and the user judges the deck buildable for Google Slides or React.
