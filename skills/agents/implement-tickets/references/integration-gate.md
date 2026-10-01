# Wave integration gate

After every ticket in the wave is verified, squash-merge the verified worker
branches onto `implement-tickets/<slug>` in ascending ticket-number
order, creating exactly one commit per ticket. Update the ticket's status and
recorded commit after each successful merge.

After all tickets in the wave have been merged, run the project's full
typecheck and the full test suite on the integration branch. A green result completes the
wave gate. Do not begin the next wave before the gate passes.

## Find and isolate a failing merge

If the gate fails:

1. Re-merge the verified wave from its pre-wave integration commit, in
   ticket-number order. After each merge (squash-merge and ticket commit), run the
   project's full typecheck and full test suite. The first merge after which either check
   fails is the culprit.
2. Move the integration branch to the last good commit with
   `git checkout -B <integration-branch> <sha>`. Use this branch checkout to
   rewind; do not use a hard reset.
3. Re-merge the already-verified later tickets, in ticket order, keeping one
   squash commit per ticket, without re-verifying them.
4. Run the gate once more: run the project's full typecheck and full test suite
   on that rebuilt integration branch.
5. Re-dispatch the culprit alone as a serial attempt. This gate-triggered
   dispatch counts one attempt. Its dependants remain behind
   it until it passes verification and the wave gate.

Record the failing check, culprit, last good commit, replayed ticket commits,
and gate result in `status.md` so `continue` can reconcile the run.

## Successful handoff

When every ticket is integrated and the last suite is green, print a handoff
naming `implement-tickets/<slug>` and review commands, for example:

```text
git log --oneline <base>..implement-tickets/<slug>
git diff --stat <base>...implement-tickets/<slug>
/review-to-pr <slug>
```

Stop after printing the handoff. Do not run review, push, or open a pull request.
