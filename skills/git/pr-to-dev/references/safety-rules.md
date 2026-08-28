# Safety rules

This is the command boundary for pr-to-dev. The skill may mutate the current repository only within the requested working-branch-to-dev preparation scope.

## Normally automatic

- Read-only rev-parse, status, branch, log, diff, show, ls-files, show-ref, rev-list, and merge-base inspection.
- Reading repository instructions and project metadata.
- git fetch origin --prune.
- Explicit local branch creation with git switch -c after local and remote collision checks.
- Repository-defined validation commands.
- git add with explicit paths or reviewed patch hunks.
- git commit after cached-diff verification.
- git rebase origin/dev after a clean safety gate.
- git push -u origin HEAD for a never-published working branch.
- gh --version, gh auth status, gh pr list, and gh pr view.
- gh pr create with explicit --base dev after full-diff review.

## Caution

Pause for semantic reasoning before conflict resolution, git rebase --continue, a skill-owned git rebase --abort, git push --force-with-lease, existing PR edits, migration or lockfile resolution, narrow auto-fixes, or commands that write outside the repository.

## Forbidden automatically

Never perform:

- git reset --hard
- git clean -fd or any broad clean
- git push --force
- git branch -D
- git checkout --ours .
- git checkout --theirs .
- git push origin dev
- git push origin main
- git push origin master
- local or remote branch deletion
- merging, squashing, approving, or closing the PR
- disabling CI, tests, hooks, branch protection, or required checks
- silently dropping commits, stashes, untracked files, or worktree changes
- overwriting an unrelated PR or replacing a repository PR template without review

Do not evade a forbidden action by hiding it in a script.

## History-changing guard

Before rebase or force-with-lease, record current branch and HEAD, origin/dev SHA, upstream and remote-tracking SHA if any, worktree/index status, and why history will change. Afterward verify new HEAD, status, commit list, and push target. A lease failure is a safety stop.

## Protected branches

dev, main, and master are protected concepts. They may be inspected and fetched, but normal task commits and pushes belong on a working branch. If a protected branch has local-only commits, inspect and preserve them; do not reset, move, or silently branch around unexplained history.

## Stop report

When blocked, report current branch and HEAD, whether a merge/rebase/cherry-pick/bisect is active, staged/unstaged/untracked work preserved, last completed state, exact blocker and evidence, and safe next action. Do not describe a blocked state as a successful PR.
