# Design: learning units in `slide-design` (deck@2)

- Date: 2026-11-23
- Status: Draft, waiting for approval
- Skills changed: `skills/teaching/slide-design/` and `skills/teaching/react-slides/`
- Contract changed: `slide-design/deck@1` becomes `slide-design/deck@2`

## 1. Intent

The user ran `slide-design` on real Parts and found that learners lose track of what they are learning. The skill plans one deck section per Part sub-topic and fills it slot by slot (Core knowledge, then Worked example, then Misconceptions, Common errors, Self-check). But a real sub-topic holds five or six separate ideas and one large program. The result:

- Every concept is explained first, and the program is walked through afterwards. A concept and the code line that shows it end up five slides apart.
- One section ran to 27 slides, with two programs and a setup step in the middle, and nothing told the learner which idea they were on.
- Illustrations were rationed ("only where a diagram cannot carry the idea"), so a whole deck had none.

The user wants the skill to work out what the learner has to understand in each Part and split it into small topics. The skill orders the topics so that what is needed first comes first, simple before complex. It tells them one at a time, each with a divider slide that says what is being learned now and as many slides as the topic needs, without rushing. It then assembles the pieces at the end so the learner sees the whole. The skill should lean on pictures, but keep the text explanation.

### The research this design follows

- **Isolated, then interacting elements** (Pollock, Chandler & Sweller 2002), and **pre-training** (Mayer, Mathias & Wetzell 2002): novices learn complex material better when the parts come one at a time, before the whole system.
- **Segmenting** (Rey et al. 2019, a meta-analysis of 56 studies): splitting material into segments helps retention and transfer and lowers cognitive load.
- **Elaboration theory** (Reigeluth): go from simple to complex, open with a short view of the whole, and teach explicitly how the parts relate (synthesis).
- **Signaling** (Schneider et al. 2018, 103 studies): headings and cues help retention (g≈0.53) and transfer (g≈0.33), most for learners with little prior knowledge.
- **Subgoal labels** (Margulieux, Morrison, Guzdial): worked-example code grouped and labelled by purpose helps programming learners.
- **Multimedia and contiguity** (Mayer; Schroeder & Cenkci 2018): words with pictures beat words alone, and text belongs next to the picture it explains. **Seductive details** (Rey 2012; Sundararajan & Adesope 2020): decorative pictures hurt learning.
- **Fragmentation** (the 4C/ID critique of part-task design): parts taught without putting them back together stay separate. So assembly is required, and a chapter stays anchored to the program it builds.
- **Expertise reversal** (Blayney, Kalyuga & Sweller 2010): learners who already know more gain less from isolated parts. The split follows the learner profile.

### What the user decided

- **Units stay inside their sub-topic** (option "ก, extended"). The Part's sub-topic order stays, because course-research ordered it by prerequisite and each sub-topic builds one program. The skill splits and orders inside each sub-topic. There are two extensions:
  - A unit may move to an earlier sub-topic when a unit there needs it. The move is made for that dependency only, never because the unit is easier. The skill gives the reason at the gate and reports the move as a Part ordering problem for course-research.
  - A sub-topic too large for one chapter (for example, two programs) is split into two chapters.
- **Approach 2** (§4): units are part of the deck format, with new layouts, checks that enforce them, and `react-slides` rendering them.

## 2. Goals, non-goals, anti-goals

### Goals

- Before the storyboard, the coordinator writes a **unit map**: for each chapter, its units in order, each with a title, a goal and the units it needs. The user approves it at the existing gate, with the storyboard.
- Every unit opens with a divider slide that says which unit this is, out of how many, and its goal.
- A unit takes as many slides as it needs. No slide cap and no fixed slot order inside a unit.
- Each concept is shown next to its own code lines, inside its unit.
- Every chapter of two or more units ends with an assembly: the whole program or diagram, each part labelled with the unit it came from.
- The opening shows a map of the whole Part, and the closing assembles the whole Part.
- More explanatory pictures, and every explanation slide has a visual that explains.
- The validator enforces the structure. The learner review checks what a script cannot.
- `react-slides` renders the new layouts and shows the current unit in every slide's header.

### Non-goals

- Changing `course-research`, or how it sizes sub-topics. The skill reports moved units as Part ordering problems. Fixing the Part upstream is separate work.
- New content. Writers still add no facts, code, examples, analogies or questions beyond the Part. A unit's concrete example must come from the Part's worked example, real-world task or analogy.
- Migrating existing `deck@1` decks. To get the new structure, the user redoes the storyboard.
- A Google Slides builder.

### Anti-goals (failure even if everything passes)

- The old pattern inside units: all the concept slides first, then all the code.
- Units reordered across sub-topics only because one is easier. That fragments the programs the sub-topics build.
- An assembly slide that teaches something new. Assembly only combines what the units taught.
- Decorative pictures: an illustration that does not show, organise or interpret the slide's point.
- Units so fine that a learner with experience clicks through dividers for one-line ideas.
- A divider or header whose unit title differs from the unit map.

## 3. Constraints

- Writers add no content beyond the Part (unchanged).
- `scripts/contract.py` is the source of truth. `references/deck-template.md` mirrors it.
- `react-slides` keeps its own copy of the contract in `scripts/contract.py`. Both copies change together.
- `react-slides` must still build existing `deck@1` decks (§5.7).
- Stdlib Python 3.11+. The tests never call GitHub or a model.
- Repository text is in English. Test fixtures are made up and never copied from a user's course.
- One commit per change, Conventional Commits with the skill as the scope.

## 4. Approaches

| # | Approach | Trade-off | Outcome |
|---|---|---|---|
| 1 | **Briefs only:** change the storyboard, writer, reviewer and visuals briefs to think in units. A `focus` slide stands in for a divider and a full-snippet `code` slide for the assembly. | Fast. `react-slides` and `deck@1` stay as they are. But a divider looks like any other slide, no header says "unit 3/5", and no script checks the order or the assembly. The existing rule "one new idea per slide" was already in the briefs, and nothing enforced it. | Rejected |
| 2 | **Units in the deck format:** a unit map in the deck, three new layouts (map, divider, assembly), validator checks, and `react-slides` rendering. `deck@2`. | Learners see the structure, and scripts enforce it. Two skills change, and old decks must be redone to get it. | **Picked** by the user |
| 3 | **Three heading levels in the deck** (chapter → unit → slide). | Same benefit for the learner as 2. But every heading parser changes (assembler, validator, the `react-slides` reader, all their tests), and nothing is gained over 2. | Rejected |

## 5. The design

### 5.1 Terms

- **Unit:** one thing the learner must understand or be able to do, small enough to explain around one concept. Its id looks like `u-<kebab-ascii>` and is unique in the Part.
- **Chapter:** a run of units that ends in an assembly. By default a sub-topic is one chapter. A sub-topic may be split into two or more chapters. A chapter's id is the section key, such as `2.2`. In a split section, each chapter takes a letter: `2.3a`, `2.3b`.
- **Section:** unchanged. One per sub-topic, plus `opening` and `closing`. It is still the unit of writing, of state and of "redo a section". The opening and the closing have no chapters.

### 5.2 Planning (Stage 1)

The coordinator writes a new file, `_work/part-NN/units.json`, before the storyboard:

```json
{"chapters": [
  {"id": "2.2", "section": "2.2", "title": "<chapter title>",
   "units": [
     {"id": "u-message-roles", "title": "<unit title>", "goal": "<what the learner can do after it>", "needs": []},
     {"id": "u-invoke", "title": "…", "goal": "…", "needs": ["u-message-roles"]},
     {"id": "u-sample", "title": "…", "goal": "…", "needs": [], "moved_from": "2.3", "reason": "<which unit here needs it, and why>"}
   ]}
]}
```

- **Every sub-topic** has at least one chapter, in Part order. Chapters of one section are consecutive.
- **Title:** at most 40 visible characters, because the header shows it. **Goal:** at most 120, an observable verb, never "understand".
- **needs:** the unit ids this unit relies on. Each must come earlier in the deck.
- **Finding units:**
  - List what a learner must grasp to follow the sub-topic's Core knowledge and Worked example: each concept, each part of the program, and each step the learner performs.
  - Merge ideas the learner profile already covers. Split anything that needs two explanations.
  - Order the units by `needs`. Where `needs` allows a choice, put the simpler one first, then the one closer to the program's first lines.
  - A chapter has two to six units. A sub-topic that would need more, or that builds two separate programs, splits into chapters. A sub-topic with one idea is one unit.
- **Moving a unit:** only when a unit in an earlier sub-topic needs it. The unit sits in the earlier chapter, with `moved_from` and a `reason`. Its slides may use refs from its origin sub-topic (§5.5).
  - **What it teaches:** a moved unit teaches the concept. It shows no code from a snippet whose sub-topic the learner has not reached yet. The reviewer flags it if it does.
  - **Where it is reported:** every move is listed in the deck notes under `### Part ordering problems`, at the gate, and in the Stage 6 report. When a run moves at least one unit, the coordinator also appends one line to `skill-problems.md` (`improvement · Part N sub-topic order: <the moves, in short> · course-research outline · storyboard`). The usual end-of-run offer to report it then applies, so the user decides whether it goes to `skills-issues`. One line covers every move in the run.

The storyboard keeps its tables. Each sub-topic table gains a `unit` column, and its rows follow the unit map: per unit, the divider, then the unit's slides; then the chapter's assembly and wrap-up.

`validate_deck.py <course_dir> <N> --plan` checks `units.json` with the diagrams. It checks the schema, the limits, the ids, that `needs` only point backwards, and that every sub-topic has a chapter. `--diagrams` keeps working as before.

### 5.3 Deck shape

**Opening:**
1. cover
2. real-world task
3. `map`: the whole Part, its chapters with their units
4. objectives, setup, terms
5. the core mental model, the full diagram shown dimmed: "by the end you can build this". This epitome slide is the one exception to the first-appearance rule for `new`. It is the core diagram's first appearance, every shown element is in `dim`, and `new` is empty. The validator allows a first appearance whose shown elements are all dimmed, and `react-slides` draws it without the stroke-in animation. Later slides compute `new` against it as usual.

**A chapter**, inside its sub-topic section:
1. For each unit, in map order:
   1. `topic` divider: "Unit n/m", the unit title, its goal. The builder renders the chapter's unit list with this unit current and the earlier ones done.
   2. The unit's slides, as many as it needs. The default rhythm: something concrete from the Part (the worked example's situation, as an illustration or a diagram), then the concept on a diagram that grows, then **only this unit's lines of code**, then their output when there is one. Errors and misconceptions that belong to this unit only come last, and so does a self-check item that tests only this unit.
2. `assemble`, when the chapter has two or more units: the whole program, its line groups labelled with their units, and/or the chapter's diagram complete, its elements labelled with their units. Then the program's output.
3. Wrap-up: the misconceptions and errors that span units, the remaining self-check questions and answers, and the sources.

**Closing:** an `assemble` slide for the whole Part (the core mental model diagram, complete, labelled by chapter). Then the summary, practice, bridge and sources, as now.

The old per-sub-topic default order (hook, explanation, analogy, code walkthrough…) is replaced by this shape. The storyboard still records deviations and why.

### 5.4 New layouts

| Layout | Use | Required fields | Optional | Slide-block keys | Visual | Content blocks |
|---|---|---|---|---|---|---|
| `map` | the Part map in the opening | Title | Body (120) | | none: the builder draws it from `## Units` | none |
| `topic` | the divider that opens a unit | Title, Body | | `unit` | optional: a diagram state that shows where this unit sits | none |
| `assemble` | puts a chapter's units, or the Part's chapters, together | Title, Body (300) | Notice | `assembles`, `labels`, and for code `snippet`, `lines` | a diagram, or none when it shows code | the code excerpt, when it shows code |

- **`topic`:** the Title equals the unit's title in the map, character for character. The Body is the goal, at most 160 characters. Every slide after a `topic` belongs to that unit until the next `topic` or `assemble`. Slide blocks carry no unit key, and the reader infers each slide's unit from its place.
- **`assemble`:** `assembles` is a chapter id, or `"part"` in the closing.
  - **Code:** `labels` is a list of `{"unit", "lines"}`. The ranges sit inside the shown lines and never overlap. Lines may stay unlabelled, such as imports.
  - **Diagram:** `labels` is a list of `{"unit", "elements"}`. In the closing it is a list of `{"chapter", "elements"}`.
  - **Label scope:** labels may name units of this chapter, or of earlier chapters in the same section. In a section split into `2.3a` and `2.3b` that builds one program, `2.3a` assembles only its own lines, and `2.3b` assembles the whole program, labelling the units of both chapters. Labels never name a unit of a later chapter.
  - **Coverage:** the assembly slides of a chapter, taken together, label every unit of that chapter. A moved unit is exempt: label it when the chapter's program or diagram contains it, and otherwise leave it out. A long program may take several consecutive `assemble` slides.
  - **Notice:** required on code that is not verified, as on `code` slides.
- **Limits** go into `contract.py` and `deck-template.md` like the others. The builder may tune the numbers above when real content asks for it, and writes down why.

### 5.5 Deck file (`deck@2`)

- **The template id** becomes `"slide-design/deck@2"`.
- **New `## Units` section,** before `## Diagrams`. It holds one ```` ```units ```` JSON block, the approved `units.json` as it stands after any writer-driven changes the coordinator made. Heading order: Deck notes, Opening, sub-topics, Closing, Units, Diagrams, Code listings.
- **Deck notes** gain a `### Part ordering problems` list (each moved unit and its reason), or "none".
- **The `from` rule:** a sub-topic ref outside its own section is allowed only on a slide of a moved unit whose `moved_from` is that sub-topic.

### 5.6 Validator checks (new, on the assembled deck)

- `## Units` is valid, as in `--plan`.
- The units of every chapter appear in map order, each opened by exactly one `topic` slide whose Title matches.
- Every chapter of two or more units has `assemble` slides after its last unit, before the next chapter. Together they label every unit of that chapter.
- The opening has one `map` slide. The closing has an `assemble` slide with `"part"` that labels every chapter.
- The first slide of every sub-topic section is a `topic` slide.
- `needs` point to units that come earlier in the deck.
- The moved-unit rule for `from`.
- `assemble` code blocks pass the same fidelity check as `code` slides, and label ranges lie inside the shown lines.

### 5.7 Visuals (`references/visuals.md`)

- **Every slide that explains** (`focus`, `explain`, `steps`) still requires a visual, and that visual must carry part of the explanation. It shows the thing, organises it, or interprets it. A picture that only decorates is not allowed.
- **Illustrations are no longer a last resort.** Use one for something concrete from the Part: the worked example's situation, the real-world task, the analogy, or the hook. Use a diagram for structure and flow. Keep the "why a diagram is not enough" note at the gate only for screenshots.
- **The cost argument changes.** The old text says an illustration "costs the user a step". That is true for raster images, but `react-slides` now draws illustrations itself as sketches. An illustration description must be sketchable: no faces, hands, emotions, realistic objects, brand logos or fine detail.
- **One diagram per chapter grows** across the chapter's units, one build step at a time. The `assemble` slide shows it complete, labelled by unit, and the closing shows the core diagram complete, labelled by chapter.
- **Text sits beside the picture it explains.** The picture never repeats the whole text.

### 5.8 Gate (Stage 2)

Present the unit map first: per chapter, its units in order with their goals and needs, every split chapter, and every moved unit with its reason. Then the storyboard as now, with the slide count per chapter and per unit. The user approves both together. A change to the unit map re-runs `--plan`.

### 5.9 Writers and review

- **Writers:** still one per section. A writer may split slides, add build steps and reorder slides *within a unit*. They may not move slides between units, reorder units, or drop a divider or an assembly. A moved unit is written by the writer of the section it now sits in, who reads the origin sub-topic.
- **Learner review, pass 1,** adds these flags:
  - a slide that leaves the learner unsure which unit they are in
  - a unit that relies on something a later unit teaches
  - an assembly that introduces anything new
  - a concept whose code is far from its explanation
  - a decorative visual
  - a unit carrying two ideas, or a unit too thin for the learner profile

- **Changing the unit map after the gate** follows the existing rule for the storyboard. The gate fixes the plan, and the user sees every deviation in the final report.
  - **Allowed without asking, inside one chapter:** a writer's report, a validator error or a Blocking review issue may need the unit map to change. The coordinator may then add, split, merge or reorder units within that chapter, keeping `needs` backwards. It edits `units.json`, re-runs `--plan`, resets the affected sections, and re-dispatches their writers in revision mode. This counts within the existing limit of two revision rounds.
  - **Never after the gate:** moving a unit across sub-topics, or splitting or merging chapters. When an issue needs that, it goes in the report as unresolved, with the suggested change.
  - **Reported:** every unit-map change appears in the Stage 6 report next to the storyboard changes.

### 5.10 `react-slides`

- **The contract copy** moves to `deck@2`. The reader accepts `deck@1` and `deck@2`. A `deck@1` deck has no units, and renders exactly as today.
- **New components:**
  - `MapSlide`: the chapters with their units.
  - `Topic`: the unit number out of the chapter's total, the title and the goal, with the chapter's unit list showing done, current and to come.
  - `Assemble`: code with a label for each line group, bracketed in the gutter so the line numbers stay readable, or a diagram with labelled element groups.
- **The header** shows `Part N · <section> · Unit n/m <unit title>` on slides inside a unit.
- **Tests and visual check:** vitest and pytest cover the new layouts and the `deck@1` path. The visual check takes one screenshot of each new layout, as it does for every layout.

## 6. Files that change

- **slide-design:**
  - `scripts/contract.py`, `scripts/deck.py`, `scripts/part_reader.py` if needed, `scripts/assemble_deck.py` (writes `## Units` and the ordering problems), `scripts/validate_deck.py`
  - the references (`deck-template.md`, `storyboard.md`, `visuals.md`, `section-writer.md`, `learner-review.md`), `SKILL.md`, `evals/acceptance.md`, and the tests and fixtures
- **react-slides:**
  - `scripts/contract.py`, `scripts/deck_reader.py`, and the TSX writer
  - in `template/src/components/`: `layouts.tsx`, `SlideFrame.tsx` and `types.ts`
  - `references/components.md`, and the tests and fixtures

## 7. Left to the builder

- The order of the commits, and whether `react-slides` lands before or after `slide-design` within the change. `react-slides` must read `deck@2` by the time `slide-design` writes it.
- The exact length limits of the new fields, within §5.4.
- How `Topic`, `MapSlide` and `Assemble` look, within the existing `react-slides` style (white, hand-drawn lines, Mali).
- The wording of the briefs.

## 8. Calls made without asking the user

- Three new layouts, where the conversation mentioned two: the Part map in the opening needed its own.
- A slide's unit is inferred from the nearest `topic` before it, not written on every slide.
- One writer per section, even when a section holds two chapters.
- Chapter ids are section keys, with letters added when a section is split.
- `react-slides` keeps reading `deck@1`. `slide-design` writes only `deck@2`.
- A single-unit chapter has no assembly.
- After the gate, the coordinator may change units within a chapter, and reports each change. Moves across sub-topics and chapter splits are never made after the gate (§5.9).
- Assembly labels may name units of earlier chapters in the same section. Moved units are exempt from assembly coverage (§5.4).
- A moved unit teaches the concept without code from a sub-topic the learner has not reached (§5.2).
- Moved units also become one line in `skill-problems.md`, so the existing end-of-run offer lets the user send it to `skills-issues` (§5.2).
- The opening's dimmed full diagram is the one exception to the first-appearance rule for `new` (§5.3).
