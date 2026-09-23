# Verification and integration

How each ticket's work is isolated, checked by a fresh subagent, and assembled
onto one branch — one commit per ticket.

## Preflight (once, before the first ticket)

- The target repository has no uncommitted changes. A dirty tree stops the run
  and asks the user what to do — the run stashes nothing.
- Create or switch to the integration branch `subagent-implement/<feature-slug>`,
  cut from the current `HEAD`.
- Worker worktrees are created and cleaned by the harness
  (`isolation: "worktree"`), so there is no worktree directory to add to
  `.gitignore`. If a harness needs the orchestrator to manage worktrees by hand
  instead, cut them under `.scratch/<feature-slug>/worktrees/` and add that path
  to `.gitignore`.

## One worker branch per ticket

Every ticket is built on its own branch `subagent-implement/<feature-slug>/<NN>`
in its own worktree, cut from the current integration `HEAD`. In v1 the run is
serial, so at any moment one worker worktree exists; it is cut from an
integration `HEAD` that already carries every earlier ticket.

A fresh worktree reuses the primary checkout's installed dependencies. Workers
are held to reusing them — a ticket that needs a new dependency stops and returns
to Stage 0 planning rather than running a package install, so the shared lockfile
is never mutated by a worker.

The orchestrator removes the worktree with `git worktree remove` once the
ticket's commit lands on the integration branch. A harness that auto-cleans a
worktree only when it has no changes will keep this one, since the worker
committed to it — so the orchestrator removes it explicitly.

## Verifier subagent contract

Run by a **fresh `Explore` subagent per ticket** — read and run commands, write
no files. The orchestrator's dispatch tells it:

- the pre-ticket integration `HEAD` commit
- the worker branch name
- the list of changed **test** files from the worker's report

The verifier then:

1. **Reproduce red.** On a scratch checkout at the pre-ticket `HEAD`, apply
   only the test files, run them, and record whether they fail for a missing
   behaviour — not a compile or import error. Applying only the test files is
   the point: a test that passes without the implementation, or fails only to
   compile, is the finding to report.
2. **Run green.** Check out the worker branch. Re-run the ticket's new and
   changed tests, run the project typecheck, and run the full test suite.
3. **Return raw evidence** — the red output, the green output, the typecheck
   result, the full-suite result, and a summary of the test diff (which files,
   how many test cases, what each asserts). Render **no verdict**.

If the verifier itself errors, the orchestrator runs the ticket's new tests once
directly as a fallback — the one place implementation-adjacent work re-enters the
orchestrator's context, and only on failure.

## Orchestrator judgment

The orchestrator reads the verifier's raw evidence and decides:

- **Coverage.** Every acceptance criterion maps to at least one new test.
- **No vacuous or tautological test** — `expect(true).toBe(true)`, an assertion
  that recomputes the expected value the way the code under test does.
- **Genuinely red first.** The red reproduction failed for a missing behaviour.
- **Genuinely green.** The green run, the typecheck, and the full suite pass.

A gap on any of these is a verification failure: resume the same worker via
`SendMessage` with the specific detail, `MAX_TICKET_ATTEMPTS = 3`, then
`BLOCKED (TICKET_VERIFICATION_FAILED)` with the output in `status.md` and the
worktree kept.

## Integration — once a ticket passes judgment

1. **Squash-merge** the worker branch onto the integration branch as exactly one
   commit, in ascending ticket-number order (which is dependency order):

   ```bash
   git merge --squash subagent-implement/<feature-slug>/<NN>
   git commit -m "<NN>: <ticket title>"
   ```

   The orchestrator ticks that ticket file's acceptance checkboxes and sets its
   `Status:` to done. `.scratch/` is normally git-ignored, so those edits land on
   disk only; a tracked ticket file is staged into the same commit. That commit
   carries the ticket's Reuse Catalog update (below).
   "One commit per ticket" is a property of this merge, not a worker rule —
   workers commit freely on their own branch.
2. **Conflict routing.** A **mechanical conflict** (import ordering, adjacent
   edits, a moved block) the orchestrator resolves itself on the main thread. A
   conflict that **encodes a design decision** — which module owns a shared
   contract, which schema shape wins — halts the run and surfaces the decision to
   the user; the affected ticket returns to Stage 0 planning rather than the
   orchestrator choosing silently.
3. **Cleanup and advance.** Remove the worker's worktree and move to the next
   frontier ticket.

## Reuse Catalog update — inside the ticket's squash commit

When the target repository has `docs/reuse-catalog.md` and the ticket's
`**Reuse:**` line carries `create-shared`, `create-candidate`, `extend`, or
`promote`, the orchestrator updates the catalog between `git merge --squash` and
`git commit`, so the entries land in the ticket's own commit. For each such
verb:

1. **Path.** Grep the bare symbol in the implementation files the worker
   reported as changed. Not found → write no entry, and note
   `catalog: <symbol> not found in changed files` under the ticket in
   `status.md`; the catalog lists only code that exists.
2. **Use-when.** Take it from the spec's Reuse Plan entry for that symbol.
3. **Write** the entry in the format the catalog's header states:
   - `create-shared` → add it under Shared, in the category that fits;
   - `create-candidate` → add it under Candidates with `· from: <feature-slug>`;
   - `promote` → move its entry from Candidates to Shared, with its new path;
   - `extend` → update the existing entry's use-when when the Reuse Plan changed
     it, or add the entry when the module was not yet catalogued.

The symbol comes from the ticket, the path from a grep, the use-when from the
spec — the orchestrator reads no code, so this step stays text-only. It is the
catalog's only writer during a run; workers read it. Coverage dates stay as they
are, because only a Reuse survey moves them. With no catalog file, skip this
section.

## Why v1 has no separate integration gate

`agy-implement` runs a full typecheck and test suite on the integration branch
after every wave, because a wave squash-merges several branches that were cut
from the same `HEAD` and can break each other. `subagent-implement` v1 is serial:
each worker branch is cut from an integration `HEAD` that already has every
earlier ticket, and nothing else merges in between, so the working tree of the
worker branch equals the working tree after its squash-merge. The verifier's
full-suite run on the worker branch already covers the post-merge state. When the
deferred parallel follow-up lands, it reintroduces a per-wave integration gate.
