# Design Review Gate

The bounded review loop in Stage 2. A fresh reviewer runs `scrutinize` against
the published `spec.md` and returns a verdict; this gate normalizes it, routes
it, and decides whether ticket breakdown may begin. This skill owns these rules
outright.

## Stable report

Keep exactly one file, `.scratch/<feature-slug>/design-review.md`. Each cycle
updates it in place; never write a new file per retry.

Record per cycle:

- `cycle` — 1-based cycle number (a cycle is a round: one completed review)
- `reviewer` — `subagent`, or `inline` when the harness offered no subagent
- `reviewedSpecRef` — a fingerprint (hash or git blob) of the `spec.md` reviewed
- `verdict` — one of `SHIP`, `FIX_THEN_SHIP`, `REWORK`, `REJECT`
- `reworkKind` — `spec-level` or `decision-level`, only when `verdict` is `REWORK`
- `reworkReasoning` — one or two sentences on why that kind, naming the finding
- `blockingFindings` — stable identities so a repeated finding is detectable
- `newFindings` / `resolvedFindings` / `repeatedFindings`
- `route` — the stage this verdict sends control to
- `specEdits` — every `spec.md` location changed this cycle: the fix, and each
  restatement the sweep aligned
- `validationCommands` — anything run to check the finding

Once, at the head of the report, record the gate's budget and end:

- `maxRounds` — the maximum the user chose (raised when the user adds rounds)
- `roundsUsed` — completed cycles so far
- `ended` — how the gate closed: `SHIP`, `skipped` (the user chose 0), `stall`,
  `exhausted`, or `REJECT`, plus the user's choice when it asked: `added <N>`
  or `went on`

## Reviewer

Each cycle's review runs in a new subagent, so it reads the spec the way the
implementer will: from files, with none of the interview in its context. Dispatch
a fresh one every cycle, with read access to the repository, and brief it with:

- **Paths:** `spec.md`, `decisions.md`, `CONTEXT.md`, and `adr/` under
  `.scratch/<feature-slug>/`; the root `CONTEXT.md` and `docs/adr/` when they
  exist.
- **Task:** run the `scrutinize` skill's workflow — its `SKILL.md` at the path
  Preflight found — on `spec.md`, tracing its claims through the real code.
- **Scenario question:** when the spec carries scenarios, ask whether each
  scenario is testable at a seam named in Testing Decisions. When the spec
  carries no scenarios, omit this question. It adds no new cycle, verdict, or
  finding type.
- **Prior findings,** from cycle 2 on: the previous cycle's blocking findings,
  one line each with its id, to report as resolved or still present under the
  same id.
- **Return:** every finding with an id — a listed id when it is the same
  finding, a new kebab-case id otherwise — its severity, and `scrutinize`'s
  closing line. The reviewer reads and reports; it edits no file.

The main thread owns everything after the return: verdict normalization, the
`REWORK` diagnosis, spec edits, cycle accounting, stall detection, and this
report. A finding that `decisions.md` already settles is spec-level — the spec
must state what the log decided.

When the harness offers no subagent, run the review inline and record
`reviewer: inline` for that cycle, so the weaker review stays visible.

## Verdict vocabulary

Use `scrutinize`'s own four tokens verbatim. `scrutinize` closes with a lower-case
one-liner (`ship / fix-then-ship / rework / reject`); map it directly:

| scrutinize closing line | normalized token |
| --- | --- |
| `ship` | `SHIP` |
| `fix-then-ship` | `FIX_THEN_SHIP` |
| `rework` | `REWORK` |
| `reject` | `REJECT` |

No paraphrasing, no intermediate synonyms. `SHIP` is the only passing verdict.

## Routing

### `SHIP`

Close the gate. Advance to Stage 3 (`ticket-format.md`) against the reviewed `spec.md`.

### `FIX_THEN_SHIP`

A bounded correction that does not change the chosen design. Identify the violated
invariant, verify the evidence, and make the smallest correct edit **directly to
`spec.md`**. A recommendation like "use a distributed lock" is not an instruction
to install Redis.

Then **sweep** the spec: a fact is often stated in more than one section — a
story, an implementation decision, a further note — and a fix to
one leaves the others stating the old version. Search `spec.md` for the fact's
key terms (the symbol, flag, value, or behaviour you changed) and bring every
restatement in line. The sweep is done when a search for the old wording finds
nothing. Record each location in `specEdits`.

Consume one cycle. Re-review. Control never leaves Stage 2.

### `REWORK` — spec-level

The finding is about **how the spec is written**: an unclear or missing seam, an
absent user story, an ambiguous boundary, an implementation decision stated too
vaguely to break into tickets. Every fact needed to fix it was already settled in
Stage 0.

Route: re-run Stage 1 inline with the finding as added context. Consume one
cycle. Re-review. Control stays in Stage 2.

### `REWORK` — decision-level

The finding traces to **a decision no one has made** — Stage 1 cannot
synthesize it from `decisions.md` because Stage 0 never resolved it. A
new actor appeared, a trade-off was skipped, a constraint surfaced that changes
the approach.

Route: return to Stage 0 and re-grill that specific decision (inline `grilling` +
`domain-modeling`), logging the round in `decisions.md` and updating
`CONTEXT.md` / `adr/` as it resolves, then re-run Stage 1 and re-review.

The cycle counter **carries over**. A backward transition to Stage 0 never resets
it — decision-level rework spends the same budget as everything else.

### Distinguishing the two

Ask: *if I handed this finding and `decisions.md` to a fresh writer, could they
fix the spec without asking anyone a question?* Yes → spec-level. No,
they'd have to get a decision first → decision-level. Write the answer and the
reasoning into `reworkKind` / `reworkReasoning` every time, so the two paths are
visible in the report.

### `REJECT`

The core concept is unviable as scoped. Stop immediately. Report to the user with
the single biggest reason from `scrutinize`. Never auto-loop back into grilling on
a `REJECT` — a fresh attempt is a human decision, not an automatic transition.

## Budget and early stops

**Entry question.** On entering Stage 2, ask once whether to review and at most
how many rounds. Propose 3. `0` skips the review: record `ended: skipped` and go
on to Stage 3. `--review N` on the invocation answers it and nothing is asked; a
missing or invalid value falls back to asking. Write `maxRounds` and
`roundsUsed` into `decisions.md` State, so `continue` resumes with both and
rounds spent stay spent.

**Round accounting.** Only a completed `scrutinize` review consumes a round.
Editing `spec.md` between reviews does not.

**Stall.** If the same blocking finding survives two consecutive cycles with no
new and no resolved findings, stop before the budget is spent and take the exit
below, naming the stalled finding and why no progress is possible. Do not keep
mechanically re-reviewing.

**Exit: exhaustion or stall.** When cycle `maxRounds` completes without `SHIP`,
or a stall fires, report the unresolved findings and the per-cycle history, then
ask once: add more rounds, or go on to Stage 3.

- **Go on** is the default. Write the unresolved blocking findings to this
  report and to the spec's Further Notes under "Known unresolved review
  findings", record `ended: exhausted` or `stall` with `went on`, and advance.
- **Add rounds:** the user names the number every time; there is no default
  number. Raise `maxRounds` by it, record `added <N>`, and continue from the
  current cycle.

`REJECT` is not part of this exit: it stops the run at once.
