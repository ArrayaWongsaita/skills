---
name: grill-to-tickets
description: Standalone composite skill that carries one idea from a relentless discovery interview through domain modeling, specification, a bounded design-review gate, and vertical ticket breakdown, then stops at published tickets without implementing.
disable-model-invocation: true
---

# Grill To Tickets

Carry a single idea from a relentless interview through to published, ticket-ready
work, then stop at the handoff. This skill inline-executes `grilling`,
`domain-modeling`, `to-spec`, `scrutinize`, and `to-tickets` in sequence; a
separate `/implement` run picks the tickets up afterward.

```
Stage 0: Grill        grilling + domain-modeling  → CONTEXT.md, adr/
   │ (pause: explicit confirmation, empty frontier)
   ▼
Stage 1: Spec         to-spec                     → spec.md
   ▼
Stage 2: Design Review Gate   scrutinize          → design-review.md   (bounded loop)
   │ (SHIP)
   ▼
Stage 3: Tickets      to-tickets                  → issues/NN-<slug>.md
   ▼
Stop: handoff message (/clear + /implement <first ticket>)
```

## Invocation

Explicit invocation only:

- Universal / slash command: `/grill-to-tickets <idea>`
- Codex command: `$grill-to-tickets <idea>`

Codex policy is declared in `agents/openai.yaml` (`allow_implicit_invocation: false`).
Claude Code installations rely on `disable-model-invocation: true`. Require explicit
human invocation before starting.

## Inline Execution

Every stage skill runs **inline**: read its instructions at
`.agents/skills/<skill>/SKILL.md` and follow its workflow steps directly, in this
one continuous context window. `to-spec` and `to-tickets` are
`disable-model-invocation: true`, so inline is their only path; the rest run
inline too, keeping the whole interview-to-tickets pass on one unbroken reasoning
thread. Keep every stage on the main thread — stopping at tickets exists precisely
to hand a fresh context window to a later `/implement` run.

This skill owns its own copy of the Design Review Gate rules and runs fully
standalone.

## Feature-Scoped Storage

Store every artifact under a dedicated directory. Derive `<feature-slug>` from the
idea (lowercase alphanumeric with hyphens).

```
.scratch/<feature-slug>/
├── CONTEXT.md          # domain glossary and ubiquitous language
├── adr/                # architectural decision records (NNNN-<slug>.md)
├── spec.md             # feature specification
├── design-review.md    # one stable design-review report, updated per cycle
└── issues/             # tracer-bullet vertical tickets (NN-<slug>.md)
```

## Stage 0 — Grill

Run `grilling` and `domain-modeling` together as one discovery pass.

1. **Ground in existing context.** Read the repository's root `CONTEXT.md` and
   `docs/adr/` if they exist, plus any relevant existing directory under
   `.scratch/`. Initialize `.scratch/<feature-slug>/`.
2. **Relentless interview (inline `grilling`).** Map decisions as a design tree.
   Work the tree in rounds across the frontier — every decision whose
   prerequisites are settled. Number each question and give a recommended answer.
   Find facts yourself through repository inspection and tool lookups; reserve
   questions for human decisions.
3. **Active domain modeling (inline `domain-modeling`).** Challenge overloaded
   terms, sharpen fuzzy language, and stress-test relationships with concrete
   scenarios. Write terms into `.scratch/<feature-slug>/CONTEXT.md` the moment
   they resolve; record hard-to-reverse choices as
   `.scratch/<feature-slug>/adr/NNNN-<slug>.md`. Write inline, as they resolve.
4. **Pause.** When the decision frontier is empty, summarize the agreed glossary
   and decisions and pause for explicit user confirmation before Stage 1.

## Stage 1 — Spec

Run `to-spec` inline. Synthesize the settled conversation, glossary, and ADRs
directly into `.scratch/<feature-slug>/spec.md` using the standard sections
(Problem Statement, Solution, User Stories, Implementation Decisions, Testing
Decisions, Out of Scope, Further Notes). Sketch the test seams and confirm them
with the user. Stage 0 already settled the decisions — synthesize them and keep
the interview closed.

## Stage 2 — Design Review Gate

Run `scrutinize` inline against `spec.md`, then normalize its closing verdict to
exactly one of its own four tokens — `SHIP`, `FIX_THEN_SHIP`, `REWORK`, `REJECT`
— with no paraphrasing. Keep one stable report at
`.scratch/<feature-slug>/design-review.md`, updating its cycle section each pass.

Route the verdict:

- **`SHIP`** → close the gate, advance to Stage 3.
- **`FIX_THEN_SHIP`** → apply the minimal verified fix directly to `spec.md`,
  consume one cycle, re-review, stay in Stage 2.
- **`REWORK`, spec-level** (the finding is about how the spec is written) →
  re-run `to-spec` with the finding as added context, consume one cycle,
  re-review, stay in Stage 2.
- **`REWORK`, decision-level** (the finding traces to a decision nobody made) →
  return to Stage 0 to re-grill that one decision; the running cycle count
  carries over the transition unchanged.
- **`REJECT`** → stop and report to the user; a fresh attempt is a human
  decision.

State which `REWORK` kind you diagnosed, and why, in the gate report so the
spec-level and decision-level paths stay visibly distinguished.

The gate is bounded to six cycles. A stall — the same blocking finding surviving
two consecutive cycles with no new or resolved findings — stops the loop early;
so does cycle 6 closing without `SHIP`, and a fresh budget then needs explicit
human authorization. Full routing table, stall detection, cycle accounting, and
gate report format live in
[design-review-gate.md](references/design-review-gate.md).

## Stage 3 — Tickets

Once the gate returns `SHIP`, run `to-tickets` inline against the shipped
`spec.md`. Break it into tracer-bullet vertical slices, each declaring its
blocking edges, and publish one file per ticket under
`.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` in dependency
order. Quiz the user on granularity and blocking edges until they approve.

## Stop — Handoff

Print a handoff message and stop:

```text
Tickets published to .scratch/<feature-slug>/issues/. Planning is done; this skill
hands off here.

To keep peak reasoning for implementation, reset context:
/clear

Then start the first ticket in a fresh session:
/implement .scratch/<feature-slug>/issues/01-<first-ticket-slug>.md
```

The later `/implement` run owns implementation; this skill's job ends at the
handoff.

## Constraints

- Keep `grill-with-docs`, every other `mattpocock/skills`-sourced file, and
  `skills-lock.json` exactly as they are — this skill is standalone by design
  (see `docs/decisions/0003-grill-to-tickets-standalone-composite.md`).
- Execute commits, pushes, pull requests, or tracker mutations only when the user
  explicitly asks. Publishing tickets as local files under `.scratch/` is the
  default terminal output.
