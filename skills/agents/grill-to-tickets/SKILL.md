---
name: grill-to-tickets
description: Standalone composite skill that carries one idea from a relentless discovery interview through domain modeling, specification, a bounded design-review gate, and vertical ticket breakdown, then stops at published tickets without implementing.
disable-model-invocation: true
---

# Grill To Tickets

Carry a single idea from a relentless interview through to published, ticket-ready
work, then stop at the handoff. This skill inline-executes `grilling` and
`domain-modeling`, writes `spec.md` following [spec-format.md](references/spec-format.md),
reviews the spec in a fresh context with `scrutinize`, and writes tickets following
[ticket-format.md](references/ticket-format.md); a separate implementer run
(`/subagent-implement`, `/agy-implement`, or `/opencode-implement`) picks the
ticket directory up afterward.

```
Preflight             locate the three stage skills (stop if one is missing)
   ▼
Stage 0: Grill        reuse survey + grilling + domain-modeling
                      → decisions.md, CONTEXT.md, adr/, docs/reuse-catalog.md
   │ (pause: explicit confirmation, empty frontier)
   ▼
Stage 1: Spec         spec-format.md              → spec.md
   ▼
Stage 2: Design Review Gate   scrutinize (fresh reviewer) → design-review.md   (bounded loop)
   │ (SHIP)
   ▼
Stage 3: Tickets      ticket-format.md            → issues/NN-<slug>.md
   ▼
Stop: handoff message (commit catalog changes, /clear, /subagent-implement <dir>)
```

## Invocation

Explicit invocation only:

- Universal / slash command: `/grill-to-tickets <idea>`
- Codex command: `$grill-to-tickets <idea>`
- Resume a run: `/grill-to-tickets continue <feature-slug>` (or `$grill-to-tickets
  continue <feature-slug>`) — pick up from the Decision Log's State, as
  [decision-log.md](references/decision-log.md) — Resume describes.

Codex policy is declared in `agents/openai.yaml` (`allow_implicit_invocation: false`).
Claude Code installations rely on `disable-model-invocation: true`. Require explicit
human invocation before starting.

## Inline Execution

Stages 0, 1, and 3 run **inline**: read each stage skill's `SKILL.md` at the
path Preflight found and follow its workflow steps directly, in this one
continuous context window. This skill follows three stage skills (`grilling`,
`domain-modeling`, `scrutinize`) and two owned formats
([spec-format.md](references/spec-format.md) and
[ticket-format.md](references/ticket-format.md)). `grilling` and
`domain-modeling` run inline, keeping the interview, the spec, and the tickets
on one reasoning thread, where the user is.

Two steps dispatch a subagent, and neither makes a decision: the Reuse survey's
fact lookup in Stage 0, and the Stage 2 reviewer. The reviewer runs `scrutinize`
in a fresh context so it reads the spec the way the implementer will — from files
alone, without the interview's answers to fill its gaps.

This skill owns its own copy of the Design Review Gate rules and runs fully
standalone.

## Preflight

Before Stage 0, and before `continue` resumes a run, locate the `SKILL.md` of
each stage skill — `grilling`, `domain-modeling`, `scrutinize` — taking the
first of these that exists:

1. `.agents/skills/<skill>/SKILL.md`
2. `.claude/skills/<skill>/SKILL.md`
3. `~/.agents/skills/<skill>/SKILL.md`
4. `~/.claude/skills/<skill>/SKILL.md`

When any is missing, stop before Stage 0: name the missing skills and print the
install line for each missing one, then wait for the user.

```text
npx skills add mattpocock/skills --skill grilling
npx skills add mattpocock/skills --skill domain-modeling
npx skills add thananon/9arm-skills --skill scrutinize
```

Use `npx skills check` to check the stage skills for updates.

For each skill found, record the path found and the hash its matching lock holds:
- a skill found under `.agents/skills/` or `.claude/skills/` reads the project `skills-lock.json` → `skills.<name>.computedHash`;
- a skill found under `~/.agents/skills/` or `~/.claude/skills/` reads `~/.agents/.skill-lock.json` → `skills.<name>.skillFolderHash`.

Record the value as the lock holds it without recomputation, comparison, or warning. A missing lock file, a missing entry, or an empty value records `no lock entry`. Stage 0 step 1 writes the first dated entry under `## Preflight` in `decisions.md`; each `continue` appends another.

## Feature-Scoped Storage

Store every artifact under a dedicated directory; local files are the tracker. Derive `<feature-slug>` from the
idea (lowercase alphanumeric with hyphens).

```
.scratch/<feature-slug>/
├── decisions.md        # Decision Log: every question and answer, plus run State
├── CONTEXT.md          # domain glossary and ubiquitous language
├── adr/                # architectural decision records (NNNN-<slug>.md)
├── spec.md             # feature specification
├── design-review.md    # one stable design-review report, updated per cycle
└── issues/             # tracer-bullet vertical tickets (NN-<slug>.md)
```

`.scratch/` is local working state and stays out of git, so the tickets need no
commit and the implementers find a clean working tree. In a git repository,
before the first write, run `git check-ignore -q .scratch/`; when it exits
non-zero, append `.scratch/` to the file `git rev-parse --git-path info/exclude`
prints — a local exclude that changes no tracked file — and tell the user you did.

One project-level artifact lives outside that directory and outlasts the
feature: the **Reuse Catalog** at `docs/reuse-catalog.md`, plus a one-line
pointer to it in the project's `AGENTS.md` or `CLAUDE.md`. It indexes the
project's reusable code so each run surveys only what changed since the last one
— see [reuse-pass.md](references/reuse-pass.md).

## Stage 0 — Grill

Run `grilling` and `domain-modeling` together as one discovery pass.

1. **Ground in existing context.** Read the repository's root `CONTEXT.md` and
   `docs/adr/` if they exist, plus any relevant existing directory under
   `.scratch/`. Initialize `.scratch/<feature-slug>/` with its
   `decisions.md` State and write the first `### Preflight <date>` entry under
   `## Preflight` recording the stage skills' paths and lock hashes.
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
   questions for human decisions. Log every round in
   `.scratch/<feature-slug>/decisions.md` as you post it, and record each answer
   there before the next round — the log, not the conversation, is what Stage 1
   and a resumed run read: [decision-log.md](references/decision-log.md).
4. **Active domain modeling (inline `domain-modeling`).** Challenge overloaded
   terms, sharpen fuzzy language, and stress-test relationships with concrete
   scenarios. Write terms into `.scratch/<feature-slug>/CONTEXT.md` the moment
   they resolve; record hard-to-reverse choices as
   `.scratch/<feature-slug>/adr/NNNN-<slug>.md`. Write inline, as they resolve.
5. **Blind-spot pass.** When the frontier is empty, mark each category of
   [blind-spot-pass.md](references/blind-spot-pass.md) `clear`, `partial`,
   `missing`, or `n/a`. Gaps that would change the spec become one final round
   of at most five questions; the rest become stated assumptions. New decisions
   return to the frontier until it is empty again.
6. **Pause.** When the frontier is empty and the blind-spot pass is done,
   summarize the agreed glossary, the decisions, the blind-spot table with its
   assumptions, and the catalog changes, then pause for explicit user
   confirmation before Stage 1.

## Stage 1 — Spec

Write `.scratch/<feature-slug>/spec.md` following
[spec-format.md](references/spec-format.md). Synthesize `decisions.md`, the
glossary, and the ADRs directly into `.scratch/<feature-slug>/spec.md` using the
standard sections (Problem Statement, Solution, User Stories, Implementation
Decisions, Testing Decisions, Out of Scope, Further Notes). Sketch the test
seams and confirm them with the user. Stage 0 already settled the decisions —
synthesize them and keep the interview closed. The spec is done when
every decision in the log appears in it — as a story, an implementation or
testing decision, an out-of-scope line, or a further note — and
every blind-spot assumption appears in Further Notes.

Implementation Decisions includes a `### Reuse Plan`: every reusable module the
spec touches, by symbol, as use as-is, extend, create shared, create candidate,
promote, or kept separate on purpose — with the interface and named consumers of
each new shared module. Categories, the create-shared bar, and an example:
[reuse-pass.md](references/reuse-pass.md) — Stage 1.

## Stage 2 — Design Review Gate

Each cycle, dispatch a fresh reviewer subagent that runs `scrutinize` against
`spec.md` from files alone and edits nothing — its brief is in
[design-review-gate.md](references/design-review-gate.md) — Reviewer. The main
thread keeps the rest: normalize the reviewer's closing verdict to exactly one of
`scrutinize`'s own four tokens — `SHIP`, `FIX_THEN_SHIP`, `REWORK`, `REJECT`
— with no paraphrasing. Keep one stable report at
`.scratch/<feature-slug>/design-review.md`, updating its cycle section each pass.
Every cycle also applies the **reuse lens**: the reviewer checks the Reuse Plan
against `docs/reuse-catalog.md` for duplicated, unowned, and speculative shared
modules.

Route the verdict:

- **`SHIP`** → close the gate, advance to Stage 3.
- **`FIX_THEN_SHIP`** → apply the minimal verified fix directly to `spec.md`,
  sweep the spec so every passage restating the same fact agrees with it,
  consume one cycle, re-review, stay in Stage 2.
- **`REWORK`, spec-level** (the finding is about how the spec is written) →
  re-run Stage 1 with the finding as added context, consume one cycle,
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

Once the gate returns `SHIP`, write tickets following
[ticket-format.md](references/ticket-format.md) against the shipped `spec.md`.
Break it into tracer-bullet vertical slices, each declaring its blocking edges,
and write one file per ticket under `.scratch/<feature-slug>/issues/<NN>-<slug>.md`,
numbered from `01` in dependency order. Every ticket carries a `**Stories:**` line after `**Reuse:**`: the spec's
user-story numbers it delivers (`2, 5`, or a range `3-6`), or `none` for a
prefactor.

Reuse rides into the tickets: each new shared module gets exactly one **owner
ticket** — the first vertical slice that consumes it — and every other consumer
is blocked by it; each promote becomes a prefactor ticket. Every ticket carries
a `**Reuse:**` line after `**Blocked by:**` with the fixed verbs `use`, `extend`,
`create-shared`, `create-candidate`, `promote` (or `none`), kept out of the
acceptance criteria. Rules, and why reuse stays out of the acceptance criteria:
[reuse-pass.md](references/reuse-pass.md) — Stage 3.

**Draft, measure, fix, then quiz.** Write the draft tickets first, then run the
ticket checker that ships with this skill with `--write-budget`, so it writes
every ticket's Budget line from its measurement:

```text
node <this skill's directory>/scripts/check-tickets.mjs .scratch/<feature-slug>/ --write-budget
```

[check-tickets.mjs](scripts/check-tickets.mjs) verifies that every user story
has a ticket, that Stories and Blocked by name real stories and lower-numbered
tickets, that the Reuse field sits after Blocked by with the fixed verbs, that
Seam, Context, and Budget are present, single-line, in order, and real, and that
every create-shared or promote symbol has exactly one ticket, which blocks every
other ticket using it. Fix every error it reports, then quiz the user on
granularity and blocking edges, showing each ticket's Reuse, Seam, Context, and
Budget, and showing the checker's story-coverage table, budget table, DAG
summary, and every warning. Re-run the checker after every change with `--write-budget`.

Stage 3 is done when the checker prints `result: PASS`, every warning is logged
under `## Ticket warnings` in `decisions.md` — one line per warning,
`<warning> — acknowledged` or `<warning> — fixed: <change>` — and the user
approves the breakdown. Where Node is unavailable, apply the checks listed in the
script's header by hand.

## Stop — Handoff

Print a handoff message and stop:

```text
Tickets published to .scratch/<feature-slug>/issues/. Planning is done; this skill
hands off here.

.scratch/ is local and git-ignored, so the tickets need no commit. Commit any
change to docs/reuse-catalog.md or the AGENTS.md / CLAUDE.md pointer first — the
implementers start only from a clean working tree.

To keep peak reasoning for implementation, reset context:
/clear

Paste the checker's final DAG summary — its waves, maximum wave width,
critical-path length, and recommended implementer, with the skill names carrying
no leading slash:

  wave 0: 01
  wave 1: 02, 03
  maximum wave width: 2
  critical-path length: 2
  recommended implementer: subagent-implement, agy-implement, opencode-implement

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
