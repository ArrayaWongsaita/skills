# Worktrees, verification, and integration

How each ticket's work is isolated, verified by the orchestrator, and
assembled onto the integration branch — one squash-merge commit per ticket,
as soon as that ticket clears, independent of its wave-mates.

## Preflight (once, before wave 0)

- The target repository has no uncommitted changes. A dirty tree stops the run
  and asks — the run stashes nothing.
- Create or switch to the integration branch `opencode-implement/<feature-slug>`,
  cut from the current `HEAD`.
- Add `.scratch/<feature-slug>/worktrees/` to `.gitignore`.
- Confirm `opencode` on `PATH` and that `opencode models` lists the resolved,
  pinned model (see [worker-contract.md](worker-contract.md)).

## One worktree + worker branch per ticket

Every ticket — serial or parallel — is worked on its own worker branch
`opencode-implement/<feature-slug>/<NN>` in its own `git worktree` at
`.scratch/<feature-slug>/worktrees/<NN>`, cut from the current integration
`HEAD`:

```bash
git worktree add .scratch/<slug>/worktrees/<NN> -b opencode-implement/<slug>/<NN>
```

A fresh worktree has no installed dependencies. Symlink (or reflink) the
primary checkout's — `node_modules` for JavaScript, the equivalent per
ecosystem (`.venv`, `vendor/`, `target/`) — as read-only reuse. A worker
needing a new dependency stops and returns to Stage 0 planning rather than
running a package install, so the shared lockfile is never mutated by a
worker.

Write `opencode.json` `{"snapshot": false}` into the worktree and add
`opencode.json` to `.scratch/<slug>/worktrees/<NN>/.git/info/exclude` (or the
worktree's exclude path) so it never enters a diff (see
[worker-contract.md](worker-contract.md) for why).

Each worktree is removed with `git worktree remove` once that ticket's own
integration gate is green — not held open until its wave's other tickets
finish, since integration is per-ticket (see below).

## Serial vs parallel dispatch within a wave

- **Serial tickets** (a dependency edge, or a `likely-overlapping` pair the
  user chose to serialize) reuse one worktree slot at a time, in
  ticket-number order.
- **A wave the user approved for parallel execution** dispatches one
  background worker per independent ticket at once — an `opencode run`
  process (harness `run_in_background`), each writing its own log file —
  `logs/<NN>.jsonl` / `logs/<NN>.err`, capped at the **concurrency cap**
  (default 4, editable in the Plan). Tickets past the cap wait in a **queue**
  and start as slots free. The harness re-invokes the orchestrator as each
  background worker finishes; on each re-entry, parse that ticket's log, run
  the verification gate in its worktree, start the next queued ticket, and —
  independent of that — carry the just-verified ticket through its own
  integration gate right away (see below).
- A worker that writes no new output for a configurable **stall interval**
  (default 10 minutes) is flagged **possibly stalled** in `status.md`,
  without blocking its wave-mates — the other workers in the wave keep
  running, finishing, verifying, and integrating on their own schedule.
  `WORKER_TIMEOUT`, not the stall flag itself, is what eventually kills a
  worker that never recovers (an `opencode` failure — see
  [worker-contract.md](worker-contract.md)).

Every worker in every wave dispatches with the run's one resolved-and-pinned
model as an explicit `--model` flag — there is no round-robin or per-ticket
model assignment (see [worker-contract.md](worker-contract.md)).

## Verification gate — orchestrator, per ticket, in the worktree

Run once, after the worker's single whole-ticket dispatch has returned. The
orchestrator — not the worker — runs every check:

1. **Return well-formed.** The worker's return has a red run, a green run,
   the changed-files list, and the test → criterion mapping.
2. **Reproduce the ticket's red state.** On a scratch checkout at the
   **pre-ticket integration `HEAD`**, apply **only the ticket's test files**,
   run them, and confirm they fail for missing behaviour — not a compile or
   import error. A test that passes without the implementation, or only
   fails to compile, is a verification failure.
3. **Coverage and non-vacuity.** Every acceptance criterion of the ticket maps
   to at least one new test, and no test is vacuous or tautological
   (`expect(true).toBe(true)`, an assertion that recomputes the expected value
   the way the code does).
4. **Green.** Re-run the ticket's new and changed tests on the worker branch;
   they pass. The typecheck passes.

A verification failure resumes the same `opencode` session with the specific
failure as the next turn (Rule 1 in [worker-contract.md](worker-contract.md)),
up to `MAX_TICKET_ATTEMPTS = 3`. Exhausting that budget escalates the ticket
to the fallback tier (see [fallback.md](fallback.md)) instead of integrating
it here, or `BLOCKED (TICKET_VERIFICATION_FAILED)` under `--opencode-only`,
with the worktree kept for inspection.

## Integration — per ticket, not gated on the whole wave

A ticket squash-merges as soon as it passes verification — independent of
whether its wave-mates are done. This is per-ticket integration, not wave-gated
integration: the only thing the wave itself gates is the *start of the next
wave* (see below), never any individual ticket's own integration.

1. **Squash-merge**, in **ascending ticket-number order relative to what's
   already integrated** (not relative to dispatch order or wave membership):

   ```bash
   git merge --squash opencode-implement/<slug>/<NN>
   git commit -m "<NN>: <ticket title>"
   ```

   A branch cut before an earlier ticket's merge replays its diff onto the
   advanced integration branch; any conflict falls to step 2. The same commit
   ticks that ticket file's acceptance checkboxes and sets its `Status:` to
   done. "One commit per ticket" is a property of this merge, not a worker
   rule.
2. **Conflict routing.** A **mechanical conflict** (import ordering, adjacent
   edits, a moved block) the orchestrator resolves itself on the main thread.
   A conflict that **encodes a design decision** — which module owns a shared
   contract, which schema shape wins — halts the run with
   `BLOCKED (INTEGRATION_DESIGN_CONFLICT)` and surfaces the decision; the
   affected ticket returns to Stage 0 rather than the orchestrator choosing
   silently.
3. **Full suite.** Run the full typecheck and test suite on the integrated
   result. Green → `git worktree remove` the ticket's worktree; the ticket has
   reached a terminal state (integrated). Red → identify the culprit and
   route it to a verification retry or `BLOCKED`.

**A ticket that escalates to the fallback tier does not hold up its
wave-mates, and still integrates the same way itself** once fallback
verification passes. Every other ticket in the wave that passes verification
is squash-merged as soon as it's ready, with the full suite run on that
result, whether or not the escalated ticket is done — the same "everything
that passed is integrated" precedent this skill already applies to a
`BLOCKED` ticket. Once the fallback subagent's own result also passes this
same verification gate, that ticket integrates the same way too —
squash-merge, conflict routing, full suite — cut from whatever integration
`HEAD` exists by then, which may already include its former wave-mates'
work.

## The wave boundary gates only the start of the next wave

The wave is a *planning* unit, not an integration gate for any one ticket in
it. The run does not start the next wave until every ticket in the current
wave reaches a **terminal state** (integrated, or `BLOCKED`) — a ticket still
inside the fallback tier keeps the next wave from starting even after its
already-passed wave-mates have integrated. But the wave boundary never gates
any individual ticket's own integration: a ticket that clears verification
integrates immediately, without waiting for its wave-mates or for the wave
itself to close out.

A wide-refactor expand–contract sequence is just ordered waves here:
`to-tickets` stratifies it into waves (expand | migrate batches | contract),
and this gate runs the full suite at every per-ticket integration and at every
wave boundary — so it stays green step to step, with no wide-refactor-specific
handling.
