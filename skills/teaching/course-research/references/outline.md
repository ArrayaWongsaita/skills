# Building the outline (Stage 3)

The coordinator builds the outline itself, from `_work/scope.md` and the broad notes in `_work/research/broad/`, then takes it to the user for approval. No deep research starts until the user approves.

## Steps

1. **List the concepts and skills** the outcomes need, drawing on the Beginner, Practitioner and Teacher notes.
2. **Build prerequisite edges** ("A must come before B"). Tag each edge with its evidence:
   - **Strong:** current official docs state the dependency, or the current official tutorial or learning path teaches A before B. For technical topics the current official learning path counts as a reference curriculum, and it is the primary one.
   - **Supporting:** another reference curriculum from the Existing curricula notes orders it that way. A curriculum older than the current major version supports only version-independent concept dependencies, such as "tool calling before agents". It never supports API-structural ordering, such as a chain-first sequence built around deprecated APIs.
   - **Inferred:** no source; your own reasoning.

   Drop two-way and ambiguous edges. Never drop Inferred edges silently: they go to the user, flagged.
3. **Group into Parts.**
   - Order the Parts along the edges.
   - Map each Part to the outcomes it serves. Every Part serves at least one outcome, and every outcome is served by at least one Part. An uncovered outcome is a defect: fix the outline.
   - The number of Parts must fit the scope's `size`: `small` 1–3, `medium` 4–8, `large` 9+. If the outcomes genuinely need more, say so at the gate and offer two options: raise the size, or cut outcomes.
4. **Split each Part into bite-sized sub-topics,** one idea each, numbered `N.1..N.m`.
5. **Draft the glossary.** Each writer receives it, so the Parts use the same words.
6. **Move leftovers** that serve no outcome into "Further reading". Do not squeeze them into Parts.

## Pins (technical topics)

Before the gate, take the current stable versions from the Current state notes and write exact `==` pins into `packages` in `_work/scope.md`, for example `["langchain==1.5.2", "langgraph==1.2.24"]`. Pin packages that must move together (langchain and langgraph) from the same release window. Show the pins at the gate.

## `_work/outline.md` layout

```markdown
# Outline: <course title>

## Parts

### Part 1: <title>
- Outcomes: O1, O3
- Prerequisite parts: —
- Real-world task: <one line>
- Sub-topics:
  - 1.1 <title>: <one line>
  - 1.2 <title>: <one line>
- Why here: <the evidence behind this position>

### Part 2: <title>
...

## Prerequisite edges

| Before | After | Evidence | Source |
|---|---|---|---|
| <concept> (Part 1) | <concept> (Part 2) | Strong | [Official tutorial](URL) |
| <concept> (Part 2) | <concept> (Part 3) | Inferred | — |

## Glossary

| Term | Meaning | English term |
|---|---|---|
| <term in output language> | <one-line meaning> | <English term> |

## Further reading
- <leftover topic>: [link](URL)

## Pins
langchain==1.5.2, langgraph==1.2.24 (from the Current state notes, YYYY-MM-DD)
```

## Presenting at the gate

Show the outline in the user's language:
- The Parts in order, each with its sub-topics and the outcomes it serves.
- Every **Inferred** edge, flagged as needing the user's call, e.g. "⚑ Inferred: no source orders X before Y. Your call."
- The pins, for technical topics.
- How many researchers the next stage will run: one per Part.

Ask the user to approve the outline or change it: reorder, add, drop, merge, rename. Apply the changes and show it again, looping until they approve. Then run:

```bash
python3 <skill>/scripts/course_state.py set-stage <course_dir> outline-approved
python3 <skill>/scripts/course_state.py set-parts <course_dir> <number of parts>
python3 <skill>/scripts/course_state.py set-stage <course_dir> deep-research
```
