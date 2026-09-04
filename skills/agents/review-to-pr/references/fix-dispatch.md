# Fix dispatch and the fix(review) commit (Stage 2)

How a cycle's blockers become `fix(review):` commits on the integration branch.
The worker + verifier contract here is **copied from `subagent-implement`** — the
same dispatch, the same retry budget, the same fresh-verifier judgment — so a fix
that touches real files stays out of the orchestrator's context.

## 1. Cluster the blockers

Group the cycle's blockers into **clusters** — a set of related blockers fixed
together, **one cluster per coherent fix**. Two findings that the same edit
resolves are one cluster; two findings in unrelated modules are two clusters.
Record each blocker's `cluster` in the ledger. Clusters are fixed **serially** in
v1 — parallel fix dispatch is a deferred follow-up.

## 2. Dispatch or inline

Decide per cluster:

| the cluster… | how it is fixed |
| --- | --- |
| needs a **new or changed test**, **or** spans **more than one file** | **dispatched** — worker subagent + fresh verifier (§3) |
| is confined to **one file** with **no test change** | **hand-applied inline** by the orchestrator, then the affected tests and the typecheck are run inline — the sanctioned context cost |

The orchestrator writes fix code itself **only** for an inline one-file no-test
cluster. Every other cluster goes to a worker.

## 3. The dispatch contract (copied from `subagent-implement`)

### Worker branch and prompt

Cut a worker branch `review-to-pr/<feature-slug>/fix-<n>` from the current
integration `HEAD` (`<n>` is the cluster's ordinal). Write a **self-contained,
test-first** prompt to `.scratch/<feature-slug>/prompts/fix-<n>.md` — every path
absolute — carrying: the blockers in the cluster, the `code-review` evidence for
each, the acceptance criterion or standard each violates, the test seam, and the
red → green → refactor protocol. Then dispatch:

```
Agent(
  subagent_type: <resolved agent — --agent pin, else a build/implement/tdd-shaped
                 available type, else general-purpose; never fork>,
  description:   "fix(review) cluster <n> — <summary>",
  prompt:        <contents of .scratch/<feature-slug>/prompts/fix-<n>.md>,
  isolation:     "worktree",
  model:         <the run's --model value, only when set>,
)
```

`isolation: "worktree"` gives the worker its own git worktree so its edits and
commits never touch the orchestrator's checkout; a worktree with commits on it
persists for the orchestrator to merge. `fork` is ruled out — a fork inherits the
orchestrator's context and model, the cost this dispatch exists to avoid. `model`
is passed only when the run set `--model`; otherwise it is omitted so the worker
inherits the orchestrator's model and the skill stays portable.

The worker builds the fix test-first — a failing test that pins the blocker
first, then the change that makes it pass — and commits on its worker branch. It
ends its final message with: the red output, the green output and the typecheck,
the files it changed (split into test and implementation), and a table mapping
each new test to the blocker it covers.

### Fresh verifier

Dispatch a **fresh `Explore` subagent** per cluster — reads and runs commands,
writes no files. Tell it the pre-fix integration `HEAD`, the worker branch, and
the changed test files. It:

1. **Reproduces the would-be-red.** On a scratch checkout at the pre-fix `HEAD`,
   applies **only the test files**, runs them, and records whether they fail for
   the missing fix — not a compile or import error.
2. **Runs green.** Checks out the worker branch, re-runs the cluster's new and
   changed tests, runs the typecheck, and runs the affected tests.
3. **Returns raw evidence** — the red output, the green output, the typecheck
   result — and renders **no verdict**.

Should the verifier itself error, the orchestrator runs the cluster's new tests
once directly as a fallback check.

### Orchestrator judgment

The orchestrator reads the verifier's evidence and decides: every blocker in the
cluster maps to a new test; no test is vacuous or tautological; the red
reproduction failed for the missing fix; the green run and the typecheck pass.

## 4. Retry budget — `MAX_FIX_ATTEMPTS = 3`

- A **verification gap** (a blocker with no test, a test that is not actually red
  first, still-red, vacuous) resumes the **same worker**:
  `SendMessage({ to: <worker id/name>, message: "<the specific gap>" })`. The
  worker keeps its worktree and context; the follow-up is targeted and cheap.
- A **worker crash, timeout, or lost subagent** counts as **one attempt** and
  re-dispatches a **fresh** worker against the same worker branch — there is no
  separate failover budget.
- The **third failure** leaves the cluster's blockers `unfixable` in the ledger,
  keeps the worktree for inspection, and records the failure output in
  `review-status.md`.

## 5. The fix(review) commit

Each cluster lands as **exactly one** `fix(review): <summary>` commit **appended**
to the integration branch, in the order the fixes are made:

- A **dispatched** cluster is squash-merged from its worker branch:

  ```bash
  git merge --squash review-to-pr/<feature-slug>/fix-<n>
  git commit -m "fix(review): <summary>"
  ```

- An **inline** cluster is committed directly with the same message shape.

Record the commit in `review-status.md` under `fix_commits` (sha + summary +
the cluster's finding ids). Fix commits stay their own commits — they are appended
to the tip, in fix order, rather than folded into a ticket commit (ADR 0002).
Then return to Stage 1 for the next two-axis review.

## 6. Unfixable blockers

A cluster that exhausts `MAX_FIX_ATTEMPTS`:

- its blockers stay `unfixable` in the ledger — recorded, not hand-coded around;
- its worktree is kept;
- it is named in the Stage 5 handoff as "not PR-ready", with the last failure
  output.

The orchestrator writes no fix code for a dispatched cluster it could not get a
worker to finish — an un-fixable blocker is a visible signal, not a hidden
fallback.

## First-use confirmation checklist

The harness's Agent / Task tool behaviour varies. Confirm these on the first real
fix dispatch and fold the answers back into this file — the same list
`subagent-implement` confirms, because the contract is copied:

| assumption | how to confirm |
| --- | --- |
| a non-`fork` subagent dispatched in the background re-invokes the orchestrator on completion | dispatch one trivial worker, observe the re-invocation |
| `isolation: "worktree"` keeps a worktree that has commits, path + branch recoverable by the orchestrator | dispatch a worker that commits, then locate the worktree and branch |
| `SendMessage` resumes a backgrounded worker with its context intact | resume one worker with a follow-up, confirm it still has the cluster context |
| the final report carries token usage | inspect one completed worker's result; if present, roll it into `review-status.md` as a bonus |
| `Explore` reads deeply enough to summarise a test diff | run one verifier; if its reading is too shallow, switch the verifier to `general-purpose` instructed to write nothing |
