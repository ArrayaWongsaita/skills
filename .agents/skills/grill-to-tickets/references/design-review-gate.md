# Design Review Gate

The bounded review loop in Stage 2. `scrutinize` evaluates the published `spec.md`
and returns a verdict; this gate normalizes it, routes it, and decides whether
ticket breakdown may begin. This skill owns these rules outright — it does not
share them with `grill-with-docs`.

## Stable report

Keep exactly one file, `.scratch/<feature-slug>/design-review.md`. Each cycle
updates it in place; never write a new file per retry.

Record per cycle:

- `cycle` — 1-based cycle number
- `reviewedSpecRef` — a fingerprint (hash or git blob) of the `spec.md` reviewed
- `verdict` — one of `SHIP`, `FIX_THEN_SHIP`, `REWORK`, `REJECT`
- `reworkKind` — `spec-level` or `decision-level`, only when `verdict` is `REWORK`
- `reworkReasoning` — one or two sentences on why that kind, naming the finding
- `blockingFindings` — stable identities so a repeated finding is detectable
- `newFindings` / `resolvedFindings` / `repeatedFindings`
- `route` — the stage this verdict sends control to
- `validationCommands` — anything run to check the finding

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

Close the gate. Advance to Stage 3 (`to-tickets`) against the reviewed `spec.md`.

### `FIX_THEN_SHIP`

A bounded correction that does not change the chosen design. Identify the violated
invariant, verify the evidence, and make the smallest correct edit **directly to
`spec.md`**. A recommendation like "use a distributed lock" is not an instruction
to install Redis. Consume one cycle. Re-review. Control never leaves Stage 2.

### `REWORK` — spec-level

The finding is about **how the spec is written**: an unclear or missing seam, an
absent user story, an ambiguous boundary, an implementation decision stated too
vaguely to break into tickets. Every fact needed to fix it was already settled in
Stage 0.

Route: re-run `to-spec` inline with the finding as added context. Consume one
cycle. Re-review. Control stays in Stage 2.

### `REWORK` — decision-level

The finding traces to **a decision no one has made** — `to-spec` cannot
synthesize it from the conversation because the conversation never resolved it. A
new actor appeared, a trade-off was skipped, a constraint surfaced that changes
the approach.

Route: return to Stage 0 and re-grill that specific decision (inline `grilling` +
`domain-modeling`), updating `CONTEXT.md` / `adr/` as it resolves, then re-run
`to-spec` and re-review.

The cycle counter **carries over**. A backward transition to Stage 0 never resets
it — decision-level rework spends the same six-cycle budget as everything else.

### Distinguishing the two

Ask: *if I handed this finding and the full Stage 0 transcript to a fresh writer,
could they fix the spec without asking anyone a question?* Yes → spec-level. No,
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

Every cycle, `scrutinize` reviews `spec.md` with its Reuse Plan and the project's
`docs/reuse-catalog.md` in context, and its mandatory "use something that
already exists" pass is pointed at both. Reuse findings carry stable ids so the
stall rule can see a repeat:

| finding id | condition | route |
| --- | --- | --- |
| `reuse-duplicate-<symbol>` | the spec creates something the catalog already has | `FIX_THEN_SHIP` — change it to use or extend the catalogued module |
| `reuse-unowned-<shape>` | logic two or more stories need, with no create-shared entry | `FIX_THEN_SHIP` — add a create-shared entry with its interface and consumers |
| `reuse-speculative-<symbol>` | a create-shared entry below the create-shared bar | `FIX_THEN_SHIP` — downgrade it to create candidate |
| `reuse-plan-missing` | the spec has no Reuse Plan although the survey settled the facts | `REWORK`, spec-level — re-run `to-spec` with the finding |
| `reuse-undecided-<symbol>` | extend-vs-new, or share-vs-separate, is a genuine trade-off nobody decided | `REWORK`, decision-level — return to Stage 0 for that one question |

The create-shared bar and the Reuse Plan categories live in
[reuse-pass.md](reuse-pass.md). Budget, stall detection, and the verdict
vocabulary apply to reuse findings unchanged.
