# Safety rules

This is the command boundary for pr-to-dev. The skill may mutate the current repository only within the requested working-branch-to-dev preparation scope.

## Normally automatic

- Read-only rev-parse, status, branch, log, diff, show, ls-files, show-ref, rev-list, and merge-base inspection.
- Live remote inspection with git ls-remote.
- Reading repository instructions and project metadata.
- git fetch origin --prune.
- Repository-defined validation commands.
- gh --version, gh auth status, gh pr list, and gh pr view.

## Mutating but allowed under the workflow

- git switch -c after branch collision checks.
- git add with explicit paths or reviewed hunks.
- git commit after cached-diff verification.
- git rebase origin/dev and a verified git rebase --continue.
- git rebase --abort only for a skill-owned rebase when it best preserves work.
- git push -u origin HEAD for a remote branch proven absent.
- gh pr create/edit with explicit dev-base and preserved human content.

## High caution

Pause for semantic reasoning before conflict resolution, an explicit-SHA force-with-lease, migration or lockfile resolution, security/business-rule decisions, narrow auto-fixes, or commands that write outside the repository. A rewrite lease must bind `refs/heads/<branch>` to the exact SHA returned earlier by live remote inspection; a bare `--force-with-lease` is not sufficient.

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
- automatically stashing unrelated work to force a clean rebase
- silently reopening or editing a CLOSED/MERGED PR as though it were OPEN

Do not evade a forbidden action by hiding it in a script.

## History-changing guard

Before rebase, query the live remote feature ref with git ls-remote and record its exact SHA or absence, current branch/HEAD, origin/dev SHA, upstream, worktree/index status, and why history may change. Stop on remote-ahead or diverged history. After rebase, record the exact base SHA and rewrite status. Before push, prove origin/dev still equals the validated base and the remote feature ref still equals its original expectation. A lease failure or changed remote head is a safety stop; never replace the expectation to make a retry pass.

## Protected branches

dev, main, and master are protected concepts. They may be inspected and fetched, but normal task commits and pushes belong on a working branch. If a protected branch has local-only commits, inspect and preserve them; do not reset, move, or silently branch around unexplained history.

## Stop report

When blocked, report current branch and HEAD, whether a merge/rebase/cherry-pick/revert/bisect is active, recorded/current origin/dev SHA, expected/live remote feature SHA, freshness retry count, staged/unstaged/untracked work preserved, last completed state, exact blocker and evidence, and safe next action. Do not describe a blocked state as a successful PR.
