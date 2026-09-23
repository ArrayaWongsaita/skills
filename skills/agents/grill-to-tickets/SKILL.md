---
name: grill-to-tickets
description: Standalone composite skill that carries one idea from a relentless discovery interview through domain modeling, specification, a bounded design-review gate, and vertical ticket breakdown, then stops at published tickets without implementing.
disable-model-invocation: true
---

# Grill To Tickets

Carry a single idea from a relentless interview through to published, ticket-ready
work, then stop at the handoff. This skill inline-executes `grilling`,
`domain-modeling`, `to-spec`, `scrutinize`, and `to-tickets` in sequence; a
separate implementer run (`/subagent-implement`, `/agy-implement`, or
`/opencode-implement`) picks the ticket directory up afterward.

```
Stage 0: Grill        reuse survey + grilling + domain-modeling
                      → CONTEXT.md, adr/, docs/reuse-catalog.md
   │ (pause: explicit confirmation, empty frontier)
   ▼
Stage 1: Spec         to-spec                     → spec.md
   ▼
Stage 2: Design Review Gate   scrutinize          → design-review.md   (bounded loop)
   │ (SHIP)
   ▼
Stage 3: Tickets      to-tickets                  → issues/NN-<slug>.md
   ▼
Stop: handoff message (commit, /clear, /subagent-implement <dir>)
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
to hand a fresh context window to a later implementer run.

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

One project-level artifact lives outside that directory and outlasts the
feature: the **Reuse Catalog** at `docs/reuse-catalog.md`, plus a one-line
pointer to it in the project's `AGENTS.md` or `CLAUDE.md`. It indexes the
project's reusable code so each run surveys only what changed since the last one
— see [reuse-pass.md](references/reuse-pass.md).

## Stage 0 — Grill

Run `grilling` and `domain-modeling` together as one discovery pass.

1. **Ground in existing context.** Read the repository's root `CONTEXT.md` and
   `docs/adr/` if they exist, plus any relevant existing directory under
   `.scratch/`. Initialize `.scratch/<feature-slug>/`.
2. **Reuse survey.** Read `docs/reuse-catalog.md`, drift-check every entry
   against the code, and survey only the gaps — areas the idea touches that
   Coverage lacks, and files changed in covered areas since their Coverage date.
   The survey's subagent is a fact lookup; the stage itself stays on the main
   thread. Write back what the survey found about existing code, bootstrap the
   catalog when it is absent, and carry each genuine reuse choice into the
   interview as a frontier question. Full procedure:
   [reuse-pass.md](references/reuse-pass.md) — Stage 0.
3. **Relentless interview (inline `grilling`).** Map decisions as a design tree.
   Work the tree in rounds across the frontier — every decision whose
   prerequisites are settled. Number each question and give a recommended answer.
   Find facts yourself through repository inspection and tool lookups; reserve
   questions for human decisions.
4. **Active domain modeling (inline `domain-modeling`).** Challenge overloaded
   terms, sharpen fuzzy language, and stress-test relationships with concrete
   scenarios. Write terms into `.scratch/<feature-slug>/CONTEXT.md` the moment
   they resolve; record hard-to-reverse choices as
   `.scratch/<feature-slug>/adr/NNNN-<slug>.md`. Write inline, as they resolve.
5. **Pause.** When the decision frontier is empty, summarize the agreed glossary,
   the decisions, and the catalog changes, then pause for explicit user
   confirmation before Stage 1.

## Stage 1 — Spec

Run `to-spec` inline. Synthesize the settled conversation, glossary, and ADRs
directly into `.scratch/<feature-slug>/spec.md` using the standard sections
(Problem Statement, Solution, User Stories, Implementation Decisions, Testing
Decisions, Out of Scope, Further Notes). Sketch the test seams and confirm them
with the user. Stage 0 already settled the decisions — synthesize them and keep
the interview closed.

Implementation Decisions includes a `### Reuse Plan`: every reusable module the
spec touches, by symbol, as use as-is, extend, create shared, create candidate,
promote, or kept separate on purpose — with the interface and named consumers of
each new shared module. Categories, the create-shared bar, and an example:
[reuse-pass.md](references/reuse-pass.md) — Stage 1.

## Stage 2 — Design Review Gate

Run `scrutinize` inline against `spec.md`, then normalize its closing verdict to
exactly one of its own four tokens — `SHIP`, `FIX_THEN_SHIP`, `REWORK`, `REJECT`
— with no paraphrasing. Keep one stable report at
`.scratch/<feature-slug>/design-review.md`, updating its cycle section each pass.
Every cycle also applies the **reuse lens**: `scrutinize` checks the Reuse Plan
against `docs/reuse-catalog.md` for duplicated, unowned, and speculative shared
modules.

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
human authorization. Full routing table, the reuse lens, stall detection, cycle
accounting, and gate report format live in
[design-review-gate.md](references/design-review-gate.md).

## Stage 3 — Tickets

Once the gate returns `SHIP`, run `to-tickets` inline against the shipped
`spec.md`. Break it into tracer-bullet vertical slices, each declaring its
blocking edges, and publish one file per ticket under
`.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` in dependency
order. Quiz the user on granularity and blocking edges until they approve.

Reuse rides into the tickets: each new shared module gets exactly one **owner
ticket** — the first vertical slice that consumes it — and every other consumer
is blocked by it; each promote becomes a prefactor ticket. Every ticket carries
a `**Reuse:**` line after `**Blocked by:**` with the fixed verbs `use`, `extend`,
`create-shared`, `create-candidate`, `promote` (or `none`), kept out of the
acceptance criteria. Check ownership and the Reuse fields before the quiz, and
show each ticket's Reuse field in it. Rules, and why reuse stays out of the
acceptance criteria: [reuse-pass.md](references/reuse-pass.md) — Stage 3.

## Stop — Handoff

Print a handoff message and stop:

```text
Tickets published to .scratch/<feature-slug>/issues/. Planning is done; this skill
hands off here.

Commit .scratch/<feature-slug>/ and any change to docs/reuse-catalog.md or the
AGENTS.md / CLAUDE.md pointer first — the implementers start only from a clean
working tree.

To keep peak reasoning for implementation, reset context:
/clear

Then implement the whole ticket directory in a fresh session; the implementer
keeps docs/reuse-catalog.md current as each ticket lands:
/subagent-implement .scratch/<feature-slug>/
(or /agy-implement or /opencode-implement with the same argument)
```

The later implementer run owns implementation; this skill's job ends at the
handoff.

## Constraints

- Keep `grill-with-docs`, every other `mattpocock/skills`-sourced file, and
  `skills-lock.json` exactly as they are — this skill is standalone by design
  (see `docs/decisions/0003-grill-to-tickets-standalone-composite.md`).
- Execute commits, pushes, pull requests, or tracker mutations only when the user
  explicitly asks. Publishing tickets as local files under `.scratch/` is the
  default terminal output.
