# Branch naming and protected branches

## Branch name

Derive a branch from semantic intent, not a file name:

    <type>/<short-kebab-description>

Map common types as follows:

- feat → feat/
- fix → fix/
- refactor → refactor/
- test → test/
- docs → docs/
- chore → chore/
- perf → perf/
- build → build/
- ci → ci/

Use lowercase ASCII words, one hyphen between words, and a concise behavior-oriented description. Prefer auth-refresh-token over auth-service-update. Reject placeholders such as feature/update, fix/fix, work/new, branch/test, and names that expose secrets or raw ticket text.

## Candidate selection

1. Infer type and description from the classified scope.
2. Check local refs with git show-ref --verify --quiet refs/heads/<candidate>.
3. Check origin with git ls-remote --exit-code --heads origin <candidate>.
4. If neither is occupied, create with git switch -c <candidate>.
5. If a remote branch is occupied by unknown work, do not switch to it. Try a deterministic suffix such as -2, then repeat checks. Stop if ownership or intent remains ambiguous.

A branch collision is not proof that an existing branch belongs to this task.

## Protected branch cases

- On dev: compare dev to origin/dev. If dev has local-only commits, inspect messages and diffs. Continue only when they are clearly the requested coherent work and no unrelated history would enter the PR; otherwise stop.
- On main or master: never commit. Only branch automatically if HEAD has no unique commits relative to origin/dev and can be safely rebased; otherwise stop.
- On an existing working branch: reuse it when history relative to origin/dev is coherent. Do not create a nested branch merely to change its name.
- On detached HEAD: stop and report. Do not guess a branch name or move the user to a new base.

Branch creation carries the current worktree forward. Do not stash just to switch branches and do not discard the user's index.
