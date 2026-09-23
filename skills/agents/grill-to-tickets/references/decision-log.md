# Decision Log

`.scratch/<feature-slug>/decisions.md` is the run's durable memory. Every
question lands here as it is asked, and every answer before the next round, so
the decisions survive context compaction, `/clear`, and a lost session, and
Stage 1 writes the spec from a file rather than from recall. `CONTEXT.md` stays
a glossary and `adr/` stays for hard-to-reverse choices; this log holds every
decision, including the small ones neither of them takes.

## Format

```markdown
# Decision Log — <feature-slug>

## State

- stage: 0 — Grill
- waiting on: answers to round 3
- updated: 2026-09-24

## Round 1

- **Q1 — <question title>** — recommended: <answer> — decided: <answer> — why: <the user's reason, when given>
- **Q2 — <question title>** — recommended: <answer> — decided: <answer>

## Round 2

- **Q1 — <question title>** — recommended: <answer> — decided: open
```

- **State** is rewritten in place. `stage` is one of `0 — Grill`, `1 — Spec`,
  `2 — Design Review Gate`, `3 — Tickets`, or `done`. `waiting on` names the one
  thing the run needs from the user next — a round's answers, Stage 0
  confirmation, test-seam confirmation, ticket-quiz approval, or a fresh-budget
  authorization — or `nothing` while the run works. The gate's cycle count lives
  in `design-review.md` alone.
- **Rounds** are the log. The open round fills in its `decided:` values as the
  answers arrive; a closed round stays as written. An answer that reverses an
  earlier one is a new entry naming what it replaces (`supersedes R1 Q2`).
- A reuse choice put to the user is a question like any other and is logged. A
  survey fact that settled itself belongs in the catalog, not here.
- A decision-level `REWORK` appends its round under the heading
  `## Round N — re-grill for <finding id> (gate cycle K)`.
- The blind-spot pass writes its table, stated assumptions included, under
  `## Blind-spot pass`; its format lives in `blind-spot-pass.md`.

## When to write

1. When you post a round, append it with each question's recommended answer and
   `decided: open`, and set `waiting on` to that round.
2. When the answers arrive, fill in every `decided:` before you post the next
   round.
3. At every stage transition, and before every pause that waits on the user,
   update State.

A round is closed when every question in it carries a `decided:` other than
`open`.

## Resume — `continue <feature-slug>`

1. Read `decisions.md`, State first, then `CONTEXT.md`, `adr/`, and whichever of
   `spec.md`, `design-review.md`, and `issues/` exist.
2. Take the gate cycle count from `design-review.md`.
3. Resume at the recorded `stage` and `waiting on`. When the run waits on a
   round, re-post that round's open questions. Every logged decision is settled:
   a question returns only when a gate finding reopens it.
4. With no `decisions.md` — a run begun before the log existed — rebuild State
   from the artifacts present, tell the user which decisions survive only as
   spec text, and start the log from there.
