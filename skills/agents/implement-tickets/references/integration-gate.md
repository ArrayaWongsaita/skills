# Wave integration gate

After every ticket in the wave is verified, squash-merge the verified worker
branches onto `implement-tickets/<slug>` in ascending ticket-number
order, creating exactly one commit per ticket. Update the ticket's status and
recorded commit after each successful merge.

After all tickets in the wave have been merged, run the project's full
typecheck and the full test suite on the integration branch. A green result completes the
wave gate. Do not begin the next wave before the gate passes.

Held tickets, those in the hold set of a parked `BLOCKED (TOUCH_SET_APPROVAL)`
ticket, are not merged and do not delay the gate: the wave gate runs without any
held ticket. See [status-and-resume.md](status-and-resume.md#hold-set-and-release).

## Release pass

After an approved parked ticket is verified, merge it in a release pass. The
release pass is a mini-wave holding the released ticket and any verified held
tickets, merged in ticket order. Record its own pre-pass commit as the gate base
and use it, not the wave's pre-wave commit, for culprit isolation. Run the gate
after the pass, then release the hold. A merge conflict in the pass defers the
ticket to a drain round inside the pass at no attempt cost, and the approved
extras stay accepted. Held tickets never dispatched then resume in their
original wave and ticket order.

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

## Wave summary

At the end of each wave, print a summary listing every ticket that has extras
together with those files. A clean-merge overlap, where tickets changed the same
paths, merged cleanly, and passed a green gate, is recorded as a note in this
summary and in the run-state row of both tickets; it does not defer anything.

## Successful handoff

When every ticket is integrated and the last suite is green, print a handoff
naming `implement-tickets/<slug>` and review commands, for example:

```text
git log --oneline <base>..implement-tickets/<slug>
git diff --stat <base>...implement-tickets/<slug>
/review-to-pr <slug>
```

Include a table of tickets and their accepted extra files, so review starts
from the complete list:

```text
| Ticket | Accepted extra files |
| --- | --- |
| 02 | `docs/research/topic.md` |
```

Stop after printing the handoff. Do not run review, push, or open a pull request.
