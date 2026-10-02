# Integration gate

After a ticket passes (verified, or judged without a verifier), squash-merge its
worker branch onto `implement-tickets/<slug>` as exactly one commit, then run
the project's full typecheck and the full test suite on the integration branch.
A green result completes the ticket. Start the next ticket only after it.

A merge conflict is mechanical when the orchestrator can resolve it without
changing behavior; otherwise redispatch the ticket from the latest integration
commit at the cost of one attempt.

## Failing gate

If the gate fails, the ticket is the culprit:

1. Move the integration branch back to the commit before the ticket with
   `git checkout -B <integration-branch> <sha>` (the one rewind command, also
   used by `continue`).
2. Redispatch the ticket from that commit with the failing output in the
   prompt. This counts one attempt.

Record the failing check, the ticket, and the last good commit in `status.md`.

## Handoff

When every ticket is integrated and the last gate is green, print the
integration branch and review commands:

```text
git log --oneline <base>..implement-tickets/<slug>
git diff --stat <base>...implement-tickets/<slug>
/review-to-pr <slug>
```

Include the tickets with accepted extra files, so review starts from the
complete list:

```text
| Ticket | Accepted extra files |
| --- | --- |
| 02 | `docs/research/topic.md` |
```

List by number the tickets that skipped the verifier (for example
`Skipped the verifier: 02, 04`), or print `none`. List any blocked tickets with
their reasons. Name `report.md` when it has entries, or print
`Run report: none`.

Stop after printing the handoff. Review, push, and the pull request stay with
the person.
