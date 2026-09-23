# Worktrees and integration

How ticket work is isolated, verified, and assembled onto one branch.

## Preflight (once, before wave 0)

- The target repository has no uncommitted changes. A dirty tree stops the run
  and asks — the run stashes nothing.
- Create or switch to the integration branch `agy-implement/<feature-slug>`, cut
  from the current `HEAD`.
- Add `.scratch/<feature-slug>/worktrees/` to `.gitignore`.

## One worktree + worker branch per ticket

Every ticket — serial or parallel — is worked on its own worker branch
`agy-implement/<feature-slug>/<NN>` in its own `git worktree` at
`.scratch/<feature-slug>/worktrees/<NN>`, cut from the current integration
`HEAD`:

```bash
git worktree add .scratch/<slug>/worktrees/<NN> -b agy-implement/<slug>/<NN>
```

A fresh worktree has no installed dependencies. Symlink (or reflink) the primary
checkout's — `node_modules` for JavaScript, the equivalent per ecosystem
(`.venv`, `vendor/`, `target/`) — as read-only reuse. Workers are held to
reusing them: a ticket that needs a new dependency stops and returns to Stage 0
planning rather than running a package install, so the shared lockfile is never
mutated by a worker.

Each worktree is removed with `git worktree remove` once its wave's integration
gate is green.

## Serial vs parallel dispatch within a wave

- **Serial tickets** (a dependency edge, or a `likely-overlapping` pair the user
  chose to serialize) reuse one worktree slot at a time, in ticket-number order.
- **A wave the user approved for parallel execution** dispatches one background
  worker per ticket at once (harness `run_in_background`, each writing
  `logs/<NN>.json`), capped at the **concurrency cap** (default 4, editable in
  the Plan). Tickets past the cap wait in a **queue** and start as slots free.
  The harness re-invokes the orchestrator as each background worker finishes; on
  each re-entry, parse that ticket's log, run the verification gate in its
  worktree, and start the next queued ticket. A worker that writes no output for
  a configurable interval (default 10 minutes) is flagged **possibly stalled**
  in `status`.

Model is assigned at dispatch (see
[agy-contract.md](agy-contract.md) — round-robin over dispatch order).

## Verification gate

Run by the orchestrator, per ticket, in the ticket's worktree — detailed in
`SKILL.md`.

## Integration gate — once every ticket in the wave has passed verification

1. **Squash-merge** each verified worker branch into the integration branch as
   exactly one commit, in **ascending ticket-number order**:

   ```bash
   git merge --squash agy-implement/<slug>/<NN>
   git commit -m "<NN>: <ticket title>"
   ```

   A branch cut before earlier same-wave merges replays its diff onto the
   advanced integration branch; any conflict falls to step 2. The same commit
   ticks that ticket file's acceptance checkboxes, sets its `Status:` to done,
   and carries the ticket's Reuse Catalog update (below). "One commit per
   ticket" is a property of this merge, not a worker rule.
2. **Conflict routing.** A **mechanical conflict** (import ordering, adjacent
   edits, a moved block) the orchestrator resolves itself on the main thread. A
   conflict that **encodes a design decision** — which module owns a shared
   contract, which schema shape wins — halts the run and surfaces the decision to
   the user; the affected tickets return to Stage 0 planning rather than the
   orchestrator choosing silently.
3. **Full suite.** Run the full typecheck and test suite on the integrated
   result. Green → `git worktree remove` the wave's worktrees and advance to the
   next wave. Red → identify the culprit ticket and route it to a verification
   retry (verification budget) or `BLOCKED`.

A wide-refactor expand–contract sequence is just an ordinary serial chain here:
`to-tickets` stratifies it into waves (expand | migrate batches | contract), and
this gate runs the full suite at every wave boundary — so it stays green step to
step, with no wide-refactor-specific handling.

## Reuse Catalog update — inside each ticket's squash commit

When the target repository has `docs/reuse-catalog.md` and a ticket's
`**Reuse:**` line carries `create-shared`, `create-candidate`, `extend`, or
`promote`, the orchestrator updates the catalog between that ticket's
`git merge --squash` and `git commit`, so the entries land in the ticket's own
commit. The wave's merges run one at a time in ascending ticket-number order, so
these writes are serial even when the wave's workers ran in parallel — the
workers only read the catalog. For each such verb:

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
spec — the orchestrator reads no code for this step. It is the catalog's only
writer during a run. Coverage dates stay as they are, because only a Reuse
survey moves them. With no catalog file, skip this section.
