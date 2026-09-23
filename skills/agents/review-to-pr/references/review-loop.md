# The two-axis code-review loop (Stage 1)

The bounded loop between `code-review` and the fix stage. Run `code-review`
inline against the review point pinned in Stage 0, normalize every finding,
record it in the ledger, and route.

## The inline `code-review` call

Run the installed `code-review` skill inline, unchanged, with its fixed point set
to the pinned `review_point` — `git diff <review-point>...HEAD` (three-dot). It
runs two axes as **parallel sub-agents**:

- **Standards axis** — the repo's documented coding standards plus the Fowler
  smell baseline `code-review` carries. When the repository has
  `docs/reuse-catalog.md`, name it among the standards sources handed to this
  axis, with the brief: *a new module that duplicates a catalogued one, or code
  that bypasses a catalog Rule, is a documented-standard violation — cite the
  catalog line.* This reaches duplication outside the diff, which the baseline's
  Duplicated Code smell (hunks within the change) cannot see. `code-review`
  itself stays unchanged; the catalog is input, like any standards file.
- **Spec axis** — the acceptance criteria in the `spec_source` from Stage 0
  (`spec.md` + `issues/`, or the commit messages in degraded mode), and scope
  creep.

Present the two axes' findings **side by side**, under their own headings, the
way `code-review` reports them. This skill does not rerank or merge the two axes
— a Standards-pass / Spec-fail change and a Spec-pass / Standards-fail change
both need their own axis's finding surfaced.

## Blocking vs non-blocking normalization

Sort every finding with the `gates.md` **Code normalization** rule:

A finding is a **blocker** when the evidence shows one of:

- a **spec mismatch** — the diff does something the spec did not ask for, or asks
  for and the diff omits;
- **missing or wrong behaviour**;
- **regression risk with no covering test** — a change a future edit could break
  silently;
- a **documented-standard violation with a concrete consequence** — cite the
  standard (file + rule) and name what breaks.

A Reuse Catalog finding follows the same rule: it is a blocker when it has a
concrete consequence — two implementations of one job that can now diverge (a
second currency formatter beside `formatCurrency`), or a Rule's guarantee lost
(an HTTP call that skips `apiClient`'s auth and retry) — and non-blocking when
the overlap is cosmetic.

A finding is **non-blocking** when it is a style preference, or a baseline smell
with no concrete consequence. Non-blocking findings are **carried in the report,
not fixed** — they are recorded in the ledger with `status: open` and axis, and
listed in the Stage 5 handoff as "carried, not fixed".

Both axes feed the same normalization. A blocker on the **Standards axis only**,
or on the **Spec axis only**, routes to Stage 2 exactly the same way.

## The findings ledger

Record every finding in `review-status.md` under `findings`, one row each:

| field | values |
| --- | --- |
| `id` | a stable identity (`std-1`, `spec-2`, …) so a finding repeated in a later cycle is detectable |
| `axis` | `standards` or `spec` |
| `status` | `open` \| `resolved` \| `stalled` \| `unfixable` |
| `cluster` | the blocker cluster it was assigned to in Stage 2, once clustered (else empty) |

A blocker starts `open`, becomes `resolved` when its `fix(review):` commit lands
and the next cycle no longer reports it, `stalled` when it survives a no-progress
cycle, and `unfixable` when its cluster exhausts `MAX_FIX_ATTEMPTS` (see
[fix-dispatch.md](fix-dispatch.md)).

## Cycle bookkeeping and the code budget

- **One completed two-axis review consumes one code cycle.** Increment
  `code_cycles`. Editing between reviews — the Stage 2 fixes — consumes no cycle.
- Record per cycle: the reviewed `HEAD` fingerprint, and the findings that are
  **new**, **resolved**, and **still open** this cycle.
- **The ceiling is three cycles.** After a third completed two-axis review that
  still reports blockers, stop and report the unresolved blockers rather than
  starting a fourth.
- **No-progress early stop.** A cycle that resolves **no** blocker *and* turns up
  **nothing new** ends the loop before the ceiling — a fix cycle that moved
  nothing will move nothing on a retry. Mark the surviving blockers `stalled`
  and report them.

## Routing

- **Any blocker this cycle** → Stage 2 ([fix-dispatch.md](fix-dispatch.md)), then
  back to Stage 1 for the next review.
- **No blocker this cycle** (a clean review, non-blocking findings only) → Stage 3
  ([scrutiny-gate.md](scrutiny-gate.md)).
- **Ceiling reached or loop stalled with blockers open** → carry the open
  blockers into the handoff as "not PR-ready" and stop
  ([status-and-resume.md](status-and-resume.md)).
