# Review To PR

Domain glossary for `review-to-pr`, a standalone skill that picks up an
integration branch of verified-but-unreviewed ticket commits — where
`implement`, `agy-implement`, or `subagent-implement` stopped — and drives it to
a PR-ready state: a bounded two-axis code-review loop, blocker fixes,
conditional system scrutiny, a green full suite, then a handoff to the PR step.
It is `engineering-workflow`'s feature-flow §8–9 split out standalone, the same
way `grill-to-tickets` split §1–3 and `subagent-implement` is §7.

## Language

**Orchestrator**:
The main agent running this skill. It pins the review point, runs each
code-review and scrutinize pass, judges the findings, dispatches or hand-applies
fixes, commits them, and reports. Its own steps stay text-only where the sibling
implement skills keep them text-only; the file-heavy work of a real fix goes to
a subagent.
_Avoid_: driver, controller, reviewer, main thread

**Integration branch**:
The branch handed to the run — carrying one verified commit per ticket from
`implement` / `agy-implement` / `subagent-implement`, not yet reviewed. This skill
works **on that branch in place**: fix commits are appended to it, and it is the
branch the PR is later opened from. The run cuts no new branch of its own.
_Avoid_: feature branch, working branch, PR branch, trunk

**Review point**:
The fixed point every diff and both code-review axes are measured against.
Defaults to the merge-base with `main`; an explicit `/review-to-pr <ref>`
argument overrides it. Stable for the whole run — pinned once in Stage 0 and
recorded in `review-status.md`. `code-review`'s own term for the same thing is
"fixed point".
_Avoid_: baseline, base commit, diff base, starting point

**Two-axis code-review**:
The inline `code-review` pass: a **Standards axis** (documented repo standards +
the Fowler smell baseline) and a **Spec axis** (the ticket set's / `spec.md`'s
acceptance criteria, and scope creep), run as parallel sub-agents and reported
side by side. The skill runs this pass; it does not rerank or merge the two
axes.
_Avoid_: lint pass, QA, single review

**Blocker**:
A code-review finding that blocks the PR: a spec mismatch, missing or wrong
behaviour, regression risk with no covering test, or a documented-standard
violation with a concrete consequence. A style preference or a smell with no
consequence is **non-blocking** and is carried in the report, not fixed.
_Avoid_: bug, issue, nit, error

**Blocker cluster**:
A set of related blockers fixed together and landed as exactly one
`fix(review): <summary>` commit on the integration branch. One cluster per
coherent fix, in the order the fixes are made — append-only, never folded back
into a ticket commit.
_Avoid_: batch, patch, fixup, changeset

**Fix dispatch**:
How a cluster is fixed. A fix that needs a new or changed test, or spans more
than one file, goes to a **worker** subagent (test-first) and a fresh
**verifier** subagent — the worker+verifier contract copied from
`subagent-implement`, so the orchestrator's context stays out of the fix. A fix
confined to one file with no test change is hand-applied inline.
_Avoid_: patch job, delegation, offloading

**Worker** / **Verifier**:
Native harness subagents, same roles as in `subagent-implement`. The worker gets
one self-contained test-first prompt and its own worktree; the fresh `Explore`
verifier reproduces red, runs green + typecheck + the affected tests, and returns
raw evidence with no verdict. The orchestrator judges.
_Avoid_: agent, delegate, the model, checker

**Code budget**:
Three code-review cycles is the ceiling. One completed two-axis review consumes
one cycle; editing between reviews does not. The ceiling lifts feature-flow §8
("stop after the third code cycle") and `gates.md` ("separate three-cycle
budget"); the loop also ends early on a no-progress cycle (see `stall`).
_Avoid_: retry limit, attempts, iterations

**Stall**:
No forward movement in a review loop. In the code loop, one cycle that resolves
no blocker and turns up nothing new ends it — a fix cycle that moved nothing
will not move on a retry. In the scrutiny sub-loop, the same blocking findings
surviving two consecutive cycles (the `grill-to-tickets` Design Review Gate
rule). Either way the loop stops before its ceiling with a report naming the
stalled findings.
_Avoid_: stuck, deadlock, frozen

**System scrutinize**:
The inline `scrutinize` pass over the integrated change end-to-end — intent
first, then the real code path, not just the diff. Run **only when the change is
cross-cutting or risky** (see `cross-cutting change`), on its own independent
six-cycle budget, separate from the code budget.
_Avoid_: final review, deep review, audit

**Cross-cutting change**:
The trigger for the system gate: the diff touches routing, a DI container, a
root schema, a migrations directory, shared config, auth, concurrency or
locking, or an on-wire / on-disk format; or it spans many modules; or the
code-review loop surfaced a structural finding. Otherwise the system gate is
skipped and the run goes straight to the full suite.
_Avoid_: big change, risky diff, wide blast radius

**Scrutiny sub-loop**:
The fix path for a system-scrutinize finding: `scrutinize → fix → tests or
typecheck → code-review → scrutinize`. The repeated `code-review` step is never
skipped (feature-flow §9). Consumes the scrutinize budget, not the code budget.
_Avoid_: fix loop, rework cycle

**Full suite green**:
Stage 4 — the whole project typecheck and the whole test suite pass on the
integration branch after every fix has landed. The last gate before handoff.
_Avoid_: CI green, tests pass, final check

**Handoff**:
The terminal output: the integration branch name, the code-review and scrutinize
verdicts, a green-suite confirmation, the `fix(review):` commits added, and the
exact `/pr-to-dev` command to run next. The run performs no PR step — no `git
push`, no `gh`, no `/pr-to-dev` — the same terminal stance `subagent-implement`
takes toward `/code-review`.
_Avoid_: delivery, wrap-up, done

**review-status.md**:
The run-state file at `.scratch/<feature-slug>/review-status.md` — the review
point, per-cycle code-review and scrutinize history, the findings ledger
(open / resolved / stalled), the fix commits landed, and the current stage.
Distinct from `subagent-implement`'s `status.md` and `grill-to-tickets`'s
`design-review.md` in the same directory.
_Avoid_: state file, log, progress file

**Reality reconciliation**:
What `/review-to-pr continue` does before trusting `review-status.md`: confirm
the integration branch and its recorded fix commits still exist, re-run the full
suite, and re-open any finding whose fix no longer holds — then resume from the
recorded stage. Copied from `subagent-implement`.
_Avoid_: resume check, state sync, recovery
