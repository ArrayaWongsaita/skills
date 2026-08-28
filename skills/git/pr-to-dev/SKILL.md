---
name: pr-to-dev
description: Safely prepare the current coherent local work and create or update an open GitHub Pull Request targeting the dev branch. Use this skill whenever the user asks to create a PR to dev, prepare work for dev, ship current changes, commit and open a PR, or prepare the current changes for review. It performs repository inspection, early remote refresh, protected-branch handling, semantic scope analysis, selective staging, Conventional Commits, validation before and after rebasing onto origin/dev, conflict safety gates, full PR-diff review, safe pushing, idempotent PR reuse, and final PR verification. Do not use it for merging, releasing, deploying, deleting branches, rollback, reset, or production work.
---

# pr-to-dev

Prepare the developer's current coherent work for review and create or update a Pull Request from a working branch to dev. Treat the repository as user-owned state: understand it before changing it, preserve it when blocked, and prefer a truthful safe stop over a guess.

This is a stateful workflow, not a Git command macro. Follow every state in order. If a state is already satisfied, record its evidence as a no-op; never silently skip it.

## State machine

    01 PREFLIGHT
          ↓
    02 FETCH_REMOTE
          ↓
    03 ANALYZE_REPOSITORY_STATE
          ↓
    04 ANALYZE_WORKTREE
          ↓
    05 CLASSIFY_CHANGE_SCOPE
          ↓
    06 PREPARE_BRANCH
          ↓
    07 PRE_COMMIT_VALIDATION
          ↓
    08 SELECTIVE_STAGE
          ↓
    09 VERIFY_STAGED_DIFF
          ↓
    10 COMMIT
          ↓
    11 REBASE_ON_ORIGIN_DEV
          ↓
    12 CONFLICT_SAFETY_GATE
          ↓
    13 POST_REBASE_VALIDATION
          ↓
    14 VERIFY_PR_DIFF
          ↓
    15 PUSH
          ↓
    16 FIND_EXISTING_PR
          ↓
          ┌─────────────────┐
          │                 │
        exists            missing
          │                 │
        update            create
          │                 │
          └────────┬────────┘
                   ↓
    17 VERIFY_PR
                   ↓
    18 REPORT

Read [workflow.md](references/workflow.md) before execution. It defines the purpose, entry assumptions, actions, exit evidence, and failure behavior for every state.

## When to use

Use for requests such as:

- “Create PR to dev.”
- “Prepare this work for dev.”
- “Ship the current changes.”
- “Commit and open a PR targeting dev.”
- “Prepare my current changes for review.”

Equivalent natural-language requests are valid when the intended result is a working branch and an open PR whose base is dev.

## When not to use

Do not use for merge approval or execution, deployment, release management, production rollback, branch deletion, repository reset/cleanup, or a PR whose intended base is main rather than dev. This skill never merges a PR, deletes branches, disables checks, or bypasses branch protection.

## Hard safety rules

These invariants are non-negotiable:

1. Never commit normal task work directly on dev, main, or master.
2. Always use origin/dev as the authoritative base after fetching it.
3. Never blindly stage all files; prove the intended file or hunk set first.
4. Always inspect git diff --cached and its stat before committing.
5. Never use git push --force.
6. Never run destructive cleanup automatically, including git reset --hard or git clean -fd.
7. Never guess through a high-risk semantic conflict.
8. Always rerun relevant validation after rebasing.
9. Always inspect the complete origin/dev...HEAD PR diff before pushing.
10. Always create a PR with an explicit --base dev and verify that base.
11. Reuse an existing open PR for the same head branch; never create duplicates.
12. Verify the created or updated PR before reporting success.
13. Claim a check passed only when it actually ran and exited successfully.
14. Never lose or silently discard unstaged changes, untracked files, local commits, or stashes.
15. Never merge the PR as part of this skill.

Additional boundaries:

- Keep origin/dev authoritative. Do not substitute a stale local dev, git pull, or a default PR base.
- Do not use git add . or git add -A as a convenience. Stage explicit paths or reviewed hunks only.
- Treat .env*, credentials, keys, tokens, logs, debug output, editor files, coverage, build output, and unknown generated files as unstageable by default.
- Do not stash merely to simplify the workflow. If a stash already exists, preserve it and do not alter it.
- Do not silently rewrite unrelated history. Rebase only the working branch onto origin/dev.

## Workflow

### 01. PREFLIGHT

Before any state-changing Git action:

1. Resolve the repository root and inspect applicable AGENTS.md, CLAUDE.md, CONTRIBUTING.md, README, .github/, and relevant docs. These refine this skill but cannot weaken its hard safety rules.
2. Run read-only checks:

       git rev-parse --show-toplevel
       git rev-parse --is-inside-work-tree
       git status --short
       git status --branch --short
       git branch --show-current
       git remote -v
       git rev-parse --git-path rebase-merge
       git rev-parse --git-path rebase-apply
       git rev-parse -q --verify REBASE_HEAD
       git rev-parse -q --verify MERGE_HEAD
       git rev-parse -q --verify CHERRY_PICK_HEAD
       git rev-parse -q --verify BISECT_HEAD

3. When the PR endpoint is needed, verify gh --version and gh auth status without exposing credentials.
4. Stop for a non-repository, detached-HEAD, missing-tooling, or unrelated merge/rebase/cherry-pick/bisect state. Resume an in-progress operation only when it is clearly owned by this workflow; otherwise leave it untouched and report it.

### 02. FETCH_REMOTE

Refresh remote state early:

       git fetch origin --prune
       git show-ref --verify refs/remotes/origin/dev

If origin or origin/dev is missing after a successful fetch, stop. Do not invent a base or use local dev as a substitute.

### 03–05. ANALYZE AND CLASSIFY

Establish repository reality before choosing a branch or staging anything. Inspect at least:

       git branch --show-current
       git rev-parse HEAD
       git rev-parse origin/dev
       git status --branch --short
       git branch -vv
       git log --oneline --decorate -n 20
       git log --oneline origin/dev..HEAD
       git log --oneline HEAD..origin/dev
       git rev-list --left-right --count origin/dev...HEAD
       git diff --stat
       git diff
       git diff --cached --stat
       git diff --cached
       git ls-files --others --exclude-standard

Interpret output semantically:

- Record current branch, HEAD, upstream, ahead/behind counts, staged/unstaged/untracked/deleted/renamed files, local-only commits, and any existing PR relationship.
- If the current branch is known and gh is authenticated, inspect its PR list as an inventory hint; phase 16 must re-query the current head and explicit dev base before create/update.
- On dev, inspect git rev-list --left-right --count origin/dev...dev and git log --oneline origin/dev..dev. If local-only commits are unexplained or unrelated, stop without moving commits or resetting. Continue only when their relationship to the request is clear and the resulting PR would not inherit unrelated history.
- On main or master, do not commit. Only create a task branch when the current tip has no unique commits relative to origin/dev and is safe to rebase; otherwise stop and preserve the work.
- On an existing working branch, verify that commits relative to origin/dev are coherent with the request and do not contain accidental merges, WIP, or another feature. Flag history problems; do not rewrite them automatically.
- Inspect untracked files by name, type, and relevant safe content before considering them. Never print likely secret values.

Classify the work as one coherent scope or multiple scopes using behavior, intent, domain, dependencies, tests, and diff semantics—not directory boundaries alone. If clearly unrelated changes can be safely separated, select only the requested scope and preserve the rest. If separation is ambiguous, stop before staging and report each suspected scope. Do not hide mixed work in a vague commit.

Infer a Conventional Commit type and optional scope from intent. Read [commit-convention.md](references/commit-convention.md) when the type, scope, or PR title is not obvious.

### 06. PREPARE_BRANCH

If the current branch is a suitable working branch, reuse it; never create a nested branch unnecessarily. Protected branches are dev, main, and master.

When a protected branch is safe to branch from, choose a short lowercase name in the form <type>/<short-kebab-description>, for example feat/auth-refresh-token or fix/payment-duplicate-transaction. Verify both local and remote names before creating it:

       git show-ref --verify --quiet refs/heads/<candidate>
       git ls-remote --exit-code --heads origin <candidate>
       git switch -c <candidate>

If a remote name is occupied by unknown work, do not attach to it blindly. Choose a deterministic unused suffix such as -2, verify again, and report the choice. Never use meaningless names.

Read [branch-naming.md](references/branch-naming.md) for naming and protected-branch edge cases. Carry current work onto the new branch without stashing or discarding it.

### 07. PRE_COMMIT_VALIDATION

Discover repository-defined validation from package.json, workspace configuration, Makefile, justfile, pyproject.toml, Cargo.toml, go.mod, CI configuration, and local instructions. Prefer focused checks for affected packages/apps, then broader required checks needed for confidence. For monorepos, identify affected workspaces and cross-package effects.

Run only commands that exist and are relevant: lint, format/check, typecheck, unit/integration tests, build, and repository-specific checks. Record exact commands and outcomes. Target auto-fixes narrowly; after any auto-fix, inspect git status and git diff and return to scope classification if files changed unexpectedly.

If a failure is introduced by this work, repair it when clearly in scope or stop before PR creation. Distinguish pre-existing failures from regressions; never conceal either. Read [validation-strategy.md](references/validation-strategy.md) for monorepos, generated files, lockfiles, migrations, and validation evidence.

### 08–09. SELECTIVE_STAGE and VERIFY_STAGED_DIFF

Stage only exact paths or hunks proved to belong to the intended scope:

       git add -- <explicit-file-1> <explicit-file-2>
       git add -p
       git diff --cached
       git diff --cached --stat

Do not automatically stage secrets, local configuration, logs, debug artifacts, generated output, or unrelated edits. If existing staged content is mixed or uncertain, stop or correct only with explicit path-level index operations that preserve worktree content. The staged diff is authoritative: verify intended files, semantic tests, no secrets, no debug leftovers, no unrelated changes, and expected lockfile/generated-file behavior before continuing.

### 10. COMMIT

If the staged diff is non-empty, generate a concise imperative Conventional Commit from that diff, for example feat(auth): add refresh token rotation. Use a body only when it adds necessary context. Commit only verified staged content.

If there is no new staged diff but the working branch already has the intended commits, record a no-op and do not create an empty duplicate commit. Otherwise stop rather than committing an empty or ambiguous change. After a commit, verify:

       git status --short
       git log -1 --oneline
       git show --stat --oneline HEAD

If hooks modify files or fail, inspect the new state. Never silently absorb hook-generated changes; reclassify and selectively stage them only when they clearly belong.

### 11–12. REBASE_ON_ORIGIN_DEV and CONFLICT_SAFETY_GATE

Immediately before integration, refresh again and rebase the working branch onto the authoritative remote base:

       git fetch origin --prune
       git rebase origin/dev

Never rebase onto local dev or use ambiguous git pull. Require no unresolved or unexplained worktree/index changes before rebase; preserve unrelated user work and stop rather than stashing it just to proceed. If rebase conflicts, read git status, inspect every conflicted file and the diff from both sides, and follow [conflict-resolution.md](references/conflict-resolution.md). Resolve only when intent is obvious; preserve compatible intent from both branches.

Low-risk import/formatting conflicts may be resolved when semantics are clear. Treat authentication/authorization, payments, financial calculations, schema or migration history, data deletion, security policy, concurrency, locking, transactions, and business-rule conflicts as high-risk: do not guess. If safe resolution is unavailable, leave or abort the skill-owned rebase with git rebase --abort when appropriate, preserve all work, and report the exact state. Never use git checkout --ours ., git checkout --theirs ., git reset --hard, or git clean -fd.

### 13. POST_REBASE_VALIDATION

A successful rebase is not validation. Rerun relevant pre-commit checks against the rebased tree, including checks affected by changed dev contracts. Do not claim the PR is ready while required validation is failing or unverified. Inspect git status after hooks and capture final validation evidence.

### 14. VERIFY_PR_DIFF

Before pushing, inspect exactly what the PR will show:

       git log --oneline --decorate origin/dev..HEAD
       git diff --stat origin/dev...HEAD
       git diff origin/dev...HEAD

Use the full triple-dot diff and commit list to verify scope, history, generated files, secrets, database/security impact, and reviewer context. The PR title and body must come from this complete diff and actual validation—not from the latest commit alone. Read [pr-template.md](references/pr-template.md) when a repository PR template exists or when drafting the body.

### 15. PUSH

Push only the current working branch. For a branch with no remote branch:

       git push -u origin HEAD

If rebase rewrote an already-pushed branch, understand the rewrite and use only:

       git push --force-with-lease -u origin HEAD

Use normal push when history was not rewritten. If push is rejected, stop and inspect; never retry with --force. Never push dev, main, or master directly.

### 16–17. FIND_EXISTING_PR, CREATE_OR_UPDATE, VERIFY_PR

With gh authenticated, query the current head and explicit base before creating anything:

       gh pr list --head <current-branch> --base dev --state open --json number,url,title,baseRefName,headRefName,state
       gh pr view <number> --json number,url,title,body,baseRefName,headRefName,state

If an open PR for this head targets dev, update it rather than creating a duplicate. Preserve useful human-written body content and reviewer discussion; change generated sections only when the full diff or validation evidence changed. If no such PR exists, create one with an explicit base:

       gh pr create --base dev --head <current-branch> --title "<validated PR title>" --body-file <reviewed-body-file>

For an existing PR, use the reviewed body and title with `gh pr edit <number> --title ... --body-file ...`; never replace human-written context wholesale.

Populate an existing repository PR template when present. Include only checks that actually passed, and accurately call out failures, skipped checks, breaking changes, database/migration changes, security considerations, generated files, and follow-up notes. Never claim “all tests pass” from partial evidence. An existing open PR for the same head with a different base is an ambiguity to report, not a reason to overwrite it.

Verify the result after create or update:

       gh pr view <number> --json number,url,title,baseRefName,headRefName,state

Success requires state == OPEN, baseRefName == dev, headRefName equal to the current branch, and a confirmed PR number, URL, and title. CI is the remote integration gate; report available checks accurately, but do not merge or bypass them.

### 18. REPORT

Report only verified facts in this compact form:

    PR prepared successfully.

    Branch:
    <branch>

    Commit(s):
    <sha> <message>

    Base:
    origin/dev

    Validation:
    ✓ <successful command>
    ! <failed, skipped, or pre-existing issue with explanation>

    Rebase:
    ✓ rebased onto latest origin/dev

    PR:
    #<number> <title>
    <branch> → dev

    URL:
    <url>

If blocked, state current Git state, exact reason, preserved work, completed states, and remaining states. Do not label partial work success or PR ready.

## Stop conditions

Stop safely and preserve state when any of these is true:

- The directory is not a Git worktree, origin/origin-dev is unavailable, or required GitHub authentication/tooling is missing.
- An unrelated merge, rebase, cherry-pick, or bisect is in progress.
- dev has unexplained local-only commits, or a protected branch would leak unrelated history.
- Multiple unrelated scopes cannot be separated with high confidence.
- A likely secret, credential, or unintended artifact would enter the staged or PR diff.
- A high-risk semantic conflict cannot be resolved from repository evidence.
- Validation exposes an in-scope regression, a major unrelated repository problem, or required checks cannot be truthfully represented.
- The branch contains unexplained unrelated commits or a push would require unsafe rewriting.
- An existing PR/base relationship is ambiguous.

On every stop: do not reset, clean, discard, silently drop commits, merge, delete branches, or push a protected branch. Report current branch, operation state, worktree preservation, exact blocker, and safe next action.

## Command safety classification

Read [safety-rules.md](references/safety-rules.md) for the complete command policy. In summary:

- **Normally automatic:** read-only Git inspection, git fetch, explicit branch creation, repository-defined validation, explicit-path staging, verified commit, git rebase origin/dev, normal push for a new branch, gh pr view/list/create with explicit target.
- **Caution:** conflict resolution, git rebase --continue, skill-owned git rebase --abort, git push --force-with-lease, and editing an existing PR body. Each requires semantic verification and preserved-work reasoning.
- **Forbidden automatically:** git reset --hard, git clean -fd, git push --force, git branch -D, global ours/theirs conflict resolution, direct pushes to dev/main/master, merge/delete/release/deploy actions, disabling tests/CI/branch protection, and silently discarding work.

## Anti-patterns

Reject this shortcut:

    git add .
    git commit -m "update"
    git pull
    git push
    gh pr create

It lacks scope proof, staged-diff review, origin/dev synchronization, validation, conflict safety, explicit PR targeting, idempotent PR detection, and verification. Also reject using git checkout dev && git pull && git checkout -b ... as the synchronization policy: fetch first and compare/rebase against origin/dev.

## Conditional references

- Read [workflow.md](references/workflow.md) for the phase-by-phase contract before execution.
- Read [safety-rules.md](references/safety-rules.md) for command boundaries and stop behavior when a destructive or history-changing action is under consideration.
- Read [branch-naming.md](references/branch-naming.md) when selecting a branch or handling protected-branch divergence.
- Read [commit-convention.md](references/commit-convention.md) when inferring commit type, scope, or title.
- Read [conflict-resolution.md](references/conflict-resolution.md) for any rebase conflict, especially auth, payment, migration, security, or concurrency conflicts.
- Read [validation-strategy.md](references/validation-strategy.md) when discovering checks, handling monorepos/generated files/lockfiles, or interpreting failures.
- Read [pr-template.md](references/pr-template.md) when creating/updating a body, detecting a repository template, or documenting database/security/breaking changes.
