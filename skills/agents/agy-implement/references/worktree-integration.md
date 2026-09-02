# Worktrees and integration

How ticket work is isolated, verified, and assembled onto one branch. The serial
path is below; the parallel-wave path is in the second section.

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

Serial tickets reuse one worktree slot at a time. Each worktree is removed
(`git worktree remove`) once its wave's integration gate is green.

### Dependency reuse

A fresh worktree has no `node_modules`. Symlink (or reflink) the primary
checkout's installed dependencies into each worktree — `node_modules` for
JavaScript, and the equivalent per ecosystem (`.venv`, `vendor/`, `target/`) —
as read-only reuse. Workers are forbidden from running package installs, so the
shared lockfile is never mutated by a worker. A ticket that needs a new
dependency stops and returns to Stage 0 planning.

## Verification gate (orchestrator, per ticket, in the ticket's worktree)

Detailed in SKILL.md. In short: check the envelope, **reproduce the red state on
a scratch checkout with only the ticket's test files applied**, confirm every
acceptance criterion maps to a non-vacuous test, re-run the tests green, and
typecheck. Any failure resumes the same worker with the specific detail
(`MAX_TICKET_ATTEMPTS = 3`), then `BLOCKED (TICKET_VERIFICATION_FAILED)`.

## Integration gate (orchestrator, per wave)

1. **Squash-merge** each verified ticket's worker branch into the integration
   branch as exactly one commit, in **ascending ticket-number order**:

   ```bash
   git merge --squash agy-implement/<slug>/<NN>
   git commit -m "<NN>: <ticket title>"
   ```

   The same commit ticks that ticket file's acceptance checkboxes and sets its
   `Status:` to done. "One commit per ticket" is a property of this merge, not a
   worker rule — workers commit freely on their own branch.
2. **Merge conflict.** The orchestrator resolves a purely mechanical conflict
   itself on the main thread. A conflict that encodes a design decision — which
   module owns a shared contract, which schema shape wins — halts the run and
   surfaces the decision; the affected tickets return to Stage 0 planning.
3. **Full suite.** Run the full typecheck and test suite on the integrated
   result. Green → `git worktree remove` the wave's worktrees and advance. Red →
   identify the culprit ticket and route it to a verification retry or
   `BLOCKED`.

## Parallel-wave execution

(Added in ticket 04.)
