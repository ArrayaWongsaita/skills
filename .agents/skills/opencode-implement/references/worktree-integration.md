# Worktrees, verification, and integration

How one ticket's work is isolated, verified by the orchestrator, and assembled
onto the integration branch as exactly one commit.

## Preflight (once, before the first ticket)

- The target repository has no uncommitted changes. A dirty tree stops the run
  and asks — the run stashes nothing.
- Create or switch to the integration branch `opencode-implement/<feature-slug>`,
  cut from the current `HEAD`.
- Add `.scratch/<feature-slug>/worktrees/` to `.gitignore`.
- Confirm `opencode` on `PATH`, `opencode models` lists the run's model, Ollama
  reachable, and run the smoke test (see [worker-contract.md](worker-contract.md)).

## One worktree + worker branch per ticket

Every ticket is worked on its own worker branch `opencode-implement/<slug>/<NN>`
in its own `git worktree` at `.scratch/<slug>/worktrees/<NN>`, cut from the
current integration `HEAD`:

```bash
git worktree add .scratch/<slug>/worktrees/<NN> -b opencode-implement/<slug>/<NN>
```

The run is serial, so worktrees are created and removed one at a time. Symlink
(or reflink) the primary checkout's installed dependencies — `node_modules`,
`.venv`, `vendor/`, `target/` per ecosystem — as read-only reuse. A sub-step that
needs a new dependency stops and returns to Stage 0 planning rather than running
a package install, so the shared lockfile is never mutated by a worker.

Write `opencode.json` `{"snapshot": false}` into the worktree and add
`opencode.json` to `.scratch/<slug>/worktrees/<NN>/.git/info/exclude` (or the
worktree's exclude path) so it never enters a diff.

## Verification gate — orchestrator, per ticket, in the worktree

Run once, after the ticket's whole sub-step chain has passed its checkpoints. The
orchestrator — not a worker — runs every check:

1. **Returns well-formed.** Every sub-step's worker return has a red run, a green
   run, the changed-files list, and the test → criterion mapping.
2. **Reproduce the whole ticket's red state.** On a scratch checkout at the
   **pre-ticket integration `HEAD`**, apply **only the ticket's test files** (from
   every sub-step), run them, and confirm they fail for missing behaviour — not a
   compile or import error. A test that passes without the implementation, or only
   fails to compile, is a verification failure.
3. **Coverage and non-vacuity.** Every acceptance criterion of the ticket maps to
   at least one new test, and no test is vacuous or tautological
   (`expect(true).toBe(true)`, an assertion that recomputes the expected value the
   way the code does).
4. **Green.** Re-run the ticket's new and changed tests on the worker branch; they
   pass. The typecheck passes.

Any failure re-dispatches the **failing sub-step** (a fresh `opencode run` with a
progress note naming the specific failure), up to `MAX_TICKET_ATTEMPTS = 3`.
Exhausting that budget escalates the ticket to the fallback (see
[fallback.md](fallback.md)), or `BLOCKED (TICKET_VERIFICATION_FAILED)` under
`--no-fallback`, with the worktree kept for inspection.

## Integration — one commit per ticket

Once the ticket passes verification:

1. **Squash-merge** its worker branch onto the integration branch as exactly one
   commit, in ascending ticket-number order:

   ```bash
   git merge --squash opencode-implement/<slug>/<NN>
   git commit -m "<NN>: <ticket title>"
   ```

   The same commit ticks that ticket file's acceptance checkboxes and sets its
   `Status:` to done. "One commit per ticket" is a property of this merge, not a
   worker rule.
2. **Conflict routing.** A **mechanical conflict** (import ordering, adjacent
   edits, a moved block) the orchestrator resolves itself on the main thread. A
   conflict that **encodes a design decision** — which module owns a shared
   contract, which schema shape wins — halts the run with
   `BLOCKED (INTEGRATION_DESIGN_CONFLICT)` and surfaces the decision; the affected
   ticket returns to Stage 0 rather than the orchestrator choosing silently.
3. **Full suite.** Run the full typecheck and test suite on the integrated
   result. Green → `git worktree remove` the ticket's worktree and advance to the
   next frontier ticket. Red → identify the culprit and route it to a
   verification retry or `BLOCKED`.

Because the run is serial — each worker branch is cut from the current
integration `HEAD` with nothing merged in between — the verification gate's green
run on the worker branch already covers the post-merge state, so there is no
separate integration gate.
