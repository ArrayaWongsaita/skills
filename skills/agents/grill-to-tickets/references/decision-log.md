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
- ticket review: done

## Preflight

### Preflight 2026-09-24

- `grilling` — `.agents/skills/grilling/SKILL.md` — lock: `a1b2c3d4...`
- `domain-modeling` — `.agents/skills/domain-modeling/SKILL.md` — lock: `e5f6a7b8...`
- `scrutinize` — `~/.agents/skills/scrutinize/SKILL.md` — lock: `no lock entry`

## Round 1

- **Q1 — <question title>** — tier: hard — recommended: <answer> — decided: <answer> — why: <the user's reason, when given>
- **Q2 — <question title>** — tier: easy — recommended: <default> — decided: default

## Round 2

- **Q1 — <question title>** — tier: hard — recommended: <answer> — decided: open

## Ticket review

- reviewer: subagent
- 01 READY
- 02 ASK: <question> — resolved: <change>
- 03 ASK: <question> — acknowledged

## Ticket warnings

- `issues/02-csv-download.md: acceptance criterion "npm test passes" mentions a suite or tool run` — fixed: rewrote the criterion as a behavioural statement
- `the feature has 16 tickets; split it into separate feature slugs` — acknowledged
```

For a run that skips the review, the State key is `ticket review: skipped` and
`- review skipped` is the only entry under `## Ticket review`:

```markdown
## State

- ticket review: skipped

## Ticket review

- review skipped
```

- **State** is rewritten in place. `stage` is one of `0 — Grill`, `1 — Spec`,
  `2 — Design Review Gate`, `3 — Tickets`, or `done`. `waiting on` names the one
  thing the run needs from the user next — a round's answers, Stage 0
  confirmation, test-seam confirmation, ticket-quiz approval, the review entry
  question, or the add-rounds choice — or `nothing` while the run works. In Stage 2, State also carries
  `review: <used>/<max> rounds` (or `review: skipped`), the user's answer to
  the entry question. It also carries `ticket review: pending`, `done`, or
  `skipped`; Stage 0 step 1 writes `skipped` when `--ticket-review 0` is present
  and `pending` otherwise, and the key becomes `done` after the review.
- **Ticket review** records one reviewer line, either `- reviewer: subagent` or
  `- reviewer: inline`, followed by one line per ticket: `- NN READY` or
  `- NN ASK: <question>`. An open ASK line has no suffix; when settled, that
  same line carries `— resolved: <change>` or `— acknowledged`. A skipped
  review records `- review skipped` as its only Ticket review entry, alongside
  the State key.
- **Preflight** records the stage skills found and their lock values. Stage 0
  step 1 writes the first `### Preflight <date>` entry under `## Preflight` when
  it creates the log, and each `continue` appends another, keeping earlier entries.
- **Ticket warnings** logs the checker's Stage 3 warnings, one line each with the
  warning text and `— acknowledged` or `— fixed: <change>`, so a resumed run
  knows which warnings are settled. Stage 3 is done only when every warning
  carries one of the two suffixes.
- **Rounds** are the log. The open round fills in its `decided:` values as the
  answers arrive; a closed round stays as written. An answer that reverses an
  earlier one is a new entry naming what it replaces (`supersedes R1 Q2`).
- A decision-level `REWORK` appends its round under the heading
  `## Round N — re-grill for <finding id> (gate cycle K)`.
- The blind-spot pass writes its table, stated assumptions included, under
  `## Blind-spot pass`; its format lives in `blind-spot-pass.md`.

## When to write

1. When you post a round, append it with each question's tier, recommended answer and
   `decided: open`, and set `waiting on` to that round.
2. When the person's reply to a round is recorded, log every easy question they
   did not object to as `decided: default`, including when they answered only some hard questions.
   `decided: default` means the stated default was accepted by exception; keep
   that default in the question's recommended answer so the decision is durable.
   Record explicit answers and objections; unanswered hard questions stay
   `decided: open` until answered. A request to raise an easy question to hard
   changes its tier to hard, keeps it open, and re-posts its full text and recommendation.
   Fill in the remaining answers before you post the next round.
3. At every stage transition, and before every pause that waits on the user,
   update State.

A round is closed when every question in it carries a `decided:` other than
`open`.

## Resume — `continue <feature-slug>`

1. Read `decisions.md`, State first, and its `## Ticket review` section to
   recover verdicts and ASK questions that are still open; then read
   `CONTEXT.md`, `adr/`, and whichever of `spec.md`, `design-review.md`, and
   `issues/` exist.
2. Take the gate's maximum and rounds used from State and `design-review.md`;
   never ask the entry question again and never refill spent rounds.
3. Resume at the recorded `stage` and `waiting on`. When the run waits on a
   round, re-post that round's open questions. Every logged decision is settled:
   a question returns only when a gate finding reopens it.
4. With no `decisions.md` — a run begun before the log existed — rebuild State
   from the artifacts present, tell the user which decisions survive only as
   spec text, and start the log from there.
5. A `ticket review` State key wins over any invocation flag. An explicit
   `--ticket-review 0` turns `pending` into `skipped`; a `done` review stays
   `done` with every flag, and a `skipped` review stays `skipped`. A State with
   no `ticket review` key takes the invocation's flag and otherwise runs the
   review once. Keep the review State and `## Ticket review` entries together:
   a `done` State keeps its verdicts, each open ASK stays open until resolved or
   acknowledged, and a `skipped` State keeps the review skipped.
