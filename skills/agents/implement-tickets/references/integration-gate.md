# Integration gate

After a ticket passes (verified, or judged without a verifier), squash-merge its
worker branch onto `implement-tickets/<slug>` as exactly one commit, then run
the project's full typecheck and the full test suite on the integration branch.
A green result completes the ticket. Start the next ticket only after it. Once
the gate is green and the ticket's `status.md` row is written, run
[Cleanup](#cleanup) before starting the next ticket.

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

## Cleanup

Cleanup removes, in this order, the Worker worktree, then the Worker branch,
then any other branch the harness created for that worktree. It does this for
the integrated attempt and every earlier kept attempt of the ticket, including
infrastructure-retry attempts, before the next ticket starts. Take each path and
harness branch from the Worktree cell.

- Remove the worktree with `git worktree remove <path>`: the plain form, no force
  flag.
- Delete each branch with `git branch -D <branch>`: the force-delete form,
  because a squash-merge leaves the Worker branch unmerged.
- Cleanup never edits the Branch or Commit columns of `status.md`; they stay as
  history.
- When an earlier kept attempt's recorded path is `?`, it is looked up by branch
  name in the worktree list. When it is still not found, append a report entry
  with Step `cleanup`; nothing is removed for that attempt.
- When a removal fails, append a report entry with Step `cleanup`; Cleanup still
  attempts the branch deletion, and the next ticket starts. A failure never stops
  the run.
- A worktree or branch that is already gone counts as success and writes no
  report entry.

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
