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
Stage 0: Grill        grilling + domain-modeling
                      → decisions.md, parked.md, CONTEXT.md, adr/
   │ (pause: explicit confirmation, empty frontier)
   ▼
Stage 1: Spec         spec-format.md              → spec.md
   ▼
Stage 2: Design Review Gate   scrutinize (fresh reviewer) → design-review.md   (user-bounded loop)
   │ (SHIP / 0 skip / user goes on after exhaustion or stall)
   ▼
Stage 3: Tickets      ticket-format.md            → issues/NN-<slug>.md
Stage 3.5: Ticket review      fresh reviewer subagent (skippable) → ## Ticket review
   ▼
Stop: handoff message (/clear, /subagent-implement <dir>)
```

## Invocation

Explicit invocation only:

- Universal / slash command: `/grill-to-tickets <idea>`
- Codex command: `$grill-to-tickets <idea>`
- Resume a run: `/grill-to-tickets continue <feature-slug>` (or `$grill-to-tickets
  continue <feature-slug>`) — pick up from the Decision Log's State, as
  [decision-log.md](references/decision-log.md) — Resume describes.

Add `--review N` to the idea to answer the Stage 0 pause review question up front — `N`
is the most rounds of design review to run, and `--review 0` skips the review.
A missing or invalid value asks at the pause; `N` must be a non-negative integer.
A recorded State answer wins over a flag on `continue`.

Match `--ticket-review 0` as whole tokens to skip Stage 3.5. Only
that exact value skips; any other value is treated as absent.

Codex policy is declared in `agents/openai.yaml` (`allow_implicit_invocation: false`).
Claude Code installations rely on `disable-model-invocation: true`. Require explicit
human invocation before starting.

## Inline Execution

Stages 0, 1, and 3 run **inline**: read each stage skill's `SKILL.md` at the
path Preflight found and follow its workflow steps directly, in this one
continuous context window. The ticket review is the one dispatched step inside
Stage 3, because the interview, the spec, and the ticket writing remain inline.
This skill follows three stage skills (`grilling`,
`domain-modeling`, `scrutinize`) and two owned formats
([spec-format.md](references/spec-format.md) and
[ticket-format.md](references/ticket-format.md)). `grilling` and
`domain-modeling` run inline, keeping the interview, the spec, and the tickets
on one reasoning thread, where the user is.

Two steps dispatch a subagent, and neither decides: the Stage 2 design reviewer
and the Stage 3.5 ticket reviewer. The Stage 2 reviewer runs `scrutinize` in a
fresh context so it reads the spec the way the implementer will, from files
alone. The Stage 3.5 reviewer follows the read-only brief in
[ticket-review.md](references/ticket-review.md) and reports a verdict for each
ticket; the main thread keeps the decisions for both reviews.

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
├── parked.md           # parked questions, defaults, owners, and statuses
├── CONTEXT.md          # domain glossary and ubiquitous language
├── adr/                # architectural decision records (NNNN-<slug>.md)
├── spec.md             # feature specification
├── design-review.md    # one stable design-review report, updated per cycle
├── issues/             # tracer-bullet vertical tickets (NN-<slug>.md)
└── manifest.json       # derived by the ticket checker
```

`.scratch/` is local working state and stays out of git, so the tickets need no
commit and the implementers find a clean working tree. In a git repository,
before the first write, run `git check-ignore -q .scratch/`; when it exits
non-zero, append `.scratch/` to the file `git rev-parse --git-path info/exclude`
prints — a local exclude that changes no tracked file — and tell the user you did.

## Stage 0 — Grill

Run `grilling` and `domain-modeling` together as one discovery pass.

1. **Ground in existing context.** Read the repository's root `CONTEXT.md` and
   `docs/adr/` if they exist, plus any relevant existing directory under
   `.scratch/`. When Stage 0 step 1 creates `decisions.md`, initialize its State
   with `ticket review: skipped` for `--ticket-review 0` or
   `ticket review: pending` otherwise. Write the first `### Preflight <date>`
   entry under `## Preflight` recording the stage skills' paths and lock hashes.
2. **Relentless interview (inline `grilling`).** Map decisions as a design tree.
   Work the tree in rounds across the frontier — every decision whose
   prerequisites are settled. Each question is tagged `hard` or `easy`.
   A hard question changes a user story, an interface, or a test seam, or is hard to reverse.
   A hard question carries a numbered title, a full body, and a recommended answer.
   An easy question is a single line stating the default that applies unless the person objects.
   The person can raise an easy question to hard at any time; re-post it with full text and a recommendation.
   An unsure classification is hard.
   Find facts yourself through repository inspection and tool lookups; reserve
   questions for human decisions. Log every round in
   `.scratch/<feature-slug>/decisions.md` as you post it, and record each answer
   there before the next round — the log, not the conversation, is what Stage 1
   and a resumed run read: [decision-log.md](references/decision-log.md).
   When the person cannot answer now, a parked question leaves its round:
   log its round line as `decided: parked`, which counts as closed. Write the
   question, why parked, blocking or non-blocking, default assumption, owner,
   and status `open` to `.scratch/<feature-slug>/parked.md` using
   [parked-questions.md](references/parked-questions.md). The owner is the person
   or the third party they name. Resume reads its state from `parked.md`.
   A later answer is logged as a new decision entry, and its parked status
   becomes `resolved: answered`.
3. **Active domain modeling (inline `domain-modeling`).** Challenge overloaded
   terms, sharpen fuzzy language, and stress-test relationships with concrete
   scenarios. Write terms into `.scratch/<feature-slug>/CONTEXT.md` the moment
   they resolve; record hard-to-reverse choices as
   `.scratch/<feature-slug>/adr/NNNN-<slug>.md`. Write inline, as they resolve.
4. **Blind-spot pass.** When the frontier is empty, mark each category of
   [blind-spot-pass.md](references/blind-spot-pass.md) `clear`, `partial`,
   `missing`, or `n/a`. Gaps that would change the spec become one final round
   of at most five questions; the rest become stated assumptions. New decisions
   return to the frontier until it is empty again.
5. **Pause.** When the frontier is empty and the blind-spot pass is done,
   summarize the agreed glossary, the decisions, the blind-spot table with its
   assumptions, then pause for explicit user
   confirmation and the review maximum in the same message before Stage 1,
   proposing 3; `0` skips the review. The pause asks only when State holds no review answer.
   A valid `--review N` answers it at the pause and nothing is asked; a missing
   or invalid value asks at the pause. Record the answer in `decisions.md` State
   when given, including while a blocking parked question holds the pause open;
   it is not asked again. Write `review: 0/<max> rounds`, or `review: skipped`
   for 0. An open blocking parked question holds the
   pause: the pause cannot complete until it is answered or downgraded.
   The person can downgrade it by accepting its default; set its status to
   `resolved: assumed` and carry its default into Further Notes.
   A non-blocking parked question becomes `resolved: assumed` when the person
   confirms the pause, without a fresh question. Update the pause summary to
   list every parked entry with status `resolved: assumed`, labelled assumed,
   including the non-blocking entries resolved by that confirmation.

## Stage 1 — Spec

Write `.scratch/<feature-slug>/spec.md` following
[spec-format.md](references/spec-format.md). Synthesize `decisions.md`, the
glossary, and the ADRs directly into `.scratch/<feature-slug>/spec.md` using the
standard sections (Problem Statement, Solution, User Stories, Implementation
Decisions, Testing Decisions, Out of Scope, Further Notes). Sketch the test
seams and confirm them with the user. Stage 0 already settled the decisions —
synthesize them and keep the interview closed. For every new spec, write at
least one `Scenario:` line under every story. The spec is done when
every decision in the log appears in it — as a story, an implementation or
testing decision, an out-of-scope line, or a further note — and
every blind-spot assumption appears in Further Notes. Read `parked.md` and
write every `resolved: assumed` parked entry's default into Further Notes as
an assumption, including non-blocking entries resolved at the confirmed pause
and blocking entries the person downgraded.

## Stage 2 — Design Review Gate

Read the review answer from `decisions.md` State. Stage 2 asks only when State holds no review answer:
for a resumed older run with no recorded answer, ask once *"Do you want a design
review, and at most how many rounds?"* Propose 3; `0` skips the review. Record
that answer in State using the pause's format. A fresh run already answered at
Stage 0. A decision-level rework keeps the answer and does not repeat the
question. A recorded State answer wins over any `--review` flag on `continue`.
When State says `review: skipped` (including `--review 0` at the pause), write
`ended: skipped` in the gate report and advance to Stage 3. Otherwise keep the
maximum and rounds used without refilling the budget. A round is one completed review.

Each round, dispatch a fresh reviewer subagent that runs `scrutinize` against
`spec.md` from files alone and edits nothing — its brief is in
[design-review-gate.md](references/design-review-gate.md) — Reviewer. The main
thread keeps the rest: normalize the reviewer's closing verdict to exactly one of
`scrutinize`'s own four tokens — `SHIP`, `FIX_THEN_SHIP`, `REWORK`, `REJECT`
— with no paraphrasing. Keep one stable report at
`.scratch/<feature-slug>/design-review.md`, updating its cycle section each pass.

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

The gate is bounded by the user's maximum. When the last round closes without
`SHIP`, or a stall — the same blocking finding surviving two consecutive rounds
with no new or resolved findings — stops the loop early, ask once: add more
rounds (the user names the number; there is no default number) or go on to
Stage 3. The default is to go on, with the open blocking findings recorded in
`design-review.md` and under "Known unresolved review findings" in the spec's
Further Notes. `REJECT` still stops the run. Full routing table, stall detection, round accounting, and gate report format live in
[design-review-gate.md](references/design-review-gate.md).

## Stage 3 — Tickets

After `SHIP`, a recorded `0` skip, or the user's choice to go on after
exhaustion or stall, write tickets following
[ticket-format.md](references/ticket-format.md) against the `spec.md`.
Break it into tracer-bullet vertical slices, each declaring its blocking edges,
and write one file per ticket under `.scratch/<feature-slug>/issues/<NN>-<slug>.md`,
numbered from `01` in dependency order. Every ticket carries a `**Stories:**` line after `**Blocked by:**`: the spec's
user-story numbers it delivers (`2, 5`, or a range `3-6`), or `none` for a
prefactor.

Draw each ticket's acceptance criteria from the Scenario lines of the stories
it delivers. The checker enforces Scenario form: `given`, `when`, `then` in
order, and a Scenario under every story; an older spec without Scenarios
passes with a warning
([ticket-format.md](references/ticket-format.md)).

**Draft, measure, fix, then quiz.** Write the draft tickets first, then run the
ticket checker that ships with this skill with `--write-budget`, so it writes
every ticket's Budget line from its measurement:

```text
node <this skill's directory>/scripts/check-tickets.mjs .scratch/<feature-slug>/ --write-budget
```

[check-tickets.mjs](scripts/check-tickets.mjs) verifies that every user story
has a ticket, that Stories and Blocked by name real stories and lower-numbered
tickets, that Seam, Context, and Budget are present, single-line, in order, and real. Fix every error it reports, then quiz the user on
granularity and blocking edges, showing each ticket's Seam, Context, and
Budget, and showing the checker's story-coverage table, budget table, DAG
summary, and every warning. Re-run the checker after every change with `--write-budget`.

**Stage 3.5 — Ticket review.** After the checker prints `result: PASS` and
ticket errors are fixed, run one review before the quiz. Match
`--ticket-review 0` as whole tokens; that exact value skips the
review, and any other value is treated as absent. An absent flag runs the review
once. Dispatch one fresh reviewer subagent and follow the brief in
[ticket-review.md](references/ticket-review.md); the reviewer is read-only. When
the harness offers no subagent, run the review in the main context and record
`reviewer: inline`. A skipped review records the single line `- review skipped`
under `## Ticket review` in `decisions.md`, alongside the State key
`ticket review: skipped`. Once the review has run, set State
`ticket review: done`; while the `ASK` questions are shown at the quiz, State
reads `waiting on: ticket-quiz approval`
([decision-log.md](references/decision-log.md) — Format).

The review returns `NN READY` or `NN ASK: <question>` for each ticket. Treat
each ticket with no return line as `ASK: the reviewer returned no verdict`.
Show each `ASK` question beside its ticket's Seam, Context, and Budget in the
quiz. The person decides whether to fix or acknowledge each question. The main
thread waits until the person has seen and decided on the question before
applying a fix, and fixes a ticket only when
the person chooses fix. After each fix, re-run the checker with `--write-budget`;
a second review starts only when the person asks. `ASK` lines name tickets as
numbered at review time; when the quiz removes a ticket, give its line the
`— acknowledged` suffix. The review set closes at review time. Tickets the quiz
creates join a review only after the person asks for another review.

Stage 3 is done when all of these hold:

- every warning is logged under `## Ticket warnings` in `decisions.md`, one line
  per warning: `<warning> — acknowledged` or `<warning> — fixed: <change>`;
- the `ticket review` State is `done` or `skipped`;
- every `ASK` line under `## Ticket review` carries `— resolved: <change>` or
  `— acknowledged`;
- the user approves the breakdown;
- either the last checker run exits 0 or, where Node is unavailable,
  the by-hand checks listed in the script's header pass.

After a manifest write
failure, report the failure and re-run the checker before finishing Stage 3.

## Stop — Handoff

Print a handoff message and stop. Include every parked entry whose status is
`resolved: assumed`, labelled assumed, with its question and default assumption:


```text
Tickets published to .scratch/<feature-slug>/issues/. Planning is done; this skill
hands off here.

.scratch/ is local and git-ignored, so the tickets need no commit; the
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
Manifest: .scratch/<feature-slug>/manifest.json

Then implement the whole ticket directory in a fresh session:
/subagent-implement .scratch/<feature-slug>/
(or /agy-implement or /opencode-implement with the same argument)
```

The manifest line appears only when the last checker run exited 0. Omit it when
the checker could not run or could not write the manifest.

The later implementer run owns implementation; this skill's job ends at the
handoff.

## Constraints

- Keep `grill-with-docs`, every other `mattpocock/skills`-sourced file, and
  `skills-lock.json` exactly as they are — this skill is standalone by design
  (see `docs/decisions/0003-grill-to-tickets-standalone-composite.md`).
- Execute commits, pushes, pull requests, or tracker mutations only when the user
  explicitly asks. Publishing tickets as local files under `.scratch/` is the
  default terminal output.
