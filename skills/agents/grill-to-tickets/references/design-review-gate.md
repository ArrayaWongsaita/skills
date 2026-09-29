# Design Review Gate

The bounded review loop in Stage 2. A fresh reviewer runs `scrutinize` against
the published `spec.md` and returns a verdict; this gate normalizes it, routes
it, and decides whether ticket breakdown may begin. This skill owns these rules
outright.

## Stable report

Keep exactly one file, `.scratch/<feature-slug>/design-review.md`. Each cycle
updates it in place; never write a new file per retry.

Record per cycle:

- `cycle` — 1-based cycle number
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

## Reviewer

Each cycle's review runs in a new subagent, so it reads the spec the way the
implementer will: from files, with none of the interview in its context. Dispatch
a fresh one every cycle, with read access to the repository, and brief it with:

- **Paths:** `spec.md`, `decisions.md`, `CONTEXT.md`, and `adr/` under
  `.scratch/<feature-slug>/`; the root `CONTEXT.md` and `docs/adr/` when they
  exist; `docs/reuse-catalog.md`.
- **Task:** run the `scrutinize` skill's workflow — its `SKILL.md` at the path
  Preflight found — on `spec.md`, tracing its claims through the real code, with
  the reuse lens below.
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
story, an implementation decision, the Reuse Plan, a further note — and a fix to
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
it — decision-level rework spends the same six-cycle budget as everything else.

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

**Gate budget: six cycles.** Only a completed `scrutinize` review consumes a
cycle. Editing `spec.md` between reviews does not.

**Stall.** If the same blocking finding survives two consecutive cycles with no
new and no resolved findings, stop before the budget is spent. Report the stalled
finding, the specs reviewed, and why no progress is possible. Do not keep
mechanically re-reviewing.

**Budget exhaustion.** If cycle 6 completes without `SHIP`, stop. Report budget
exhaustion with the unresolved findings and the per-cycle history. A fresh
six-cycle budget requires explicit human authorization and a materially different
approach — never start cycle 7 automatically.

## Reuse lens

Every cycle, the reviewer reads `spec.md` with its Reuse Plan and the project's
`docs/reuse-catalog.md`, and `scrutinize`'s mandatory "use something that
already exists" pass is pointed at both. Reuse findings carry stable ids so the
stall rule can see a repeat:

| finding id | condition | route |
| --- | --- | --- |
| `reuse-duplicate-<symbol>` | the spec creates something the catalog already has | `FIX_THEN_SHIP` — change it to use or extend the catalogued module |
| `reuse-unowned-<shape>` | logic two or more stories need, with no create-shared entry | `FIX_THEN_SHIP` — add a create-shared entry with its interface and consumers |
| `reuse-speculative-<symbol>` | a create-shared entry below the create-shared bar | `FIX_THEN_SHIP` — downgrade it to create candidate |
| `reuse-plan-missing` | the spec has no Reuse Plan although the survey settled the facts | `REWORK`, spec-level — re-run Stage 1 with the finding |
| `reuse-undecided-<symbol>` | extend-vs-new, or share-vs-separate, is a genuine trade-off nobody decided | `REWORK`, decision-level — return to Stage 0 for that one question |

The create-shared bar and the Reuse Plan categories live in
[reuse-pass.md](reuse-pass.md). Budget, stall detection, and the verdict
vocabulary apply to reuse findings unchanged.
