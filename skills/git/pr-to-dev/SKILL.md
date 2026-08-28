---
name: pr-to-dev
description: Prepare coherent current local work and create or update a Pull Request targeting dev. Use for repository inspection, protected-branch handling, selective staging, validation, safe conflict-aware rebasing on origin/dev, exact-lease pushing, PR reuse, and verification; not for merging, releases, deployment, or production work.
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
    06 COMPLETION_FEASIBILITY_GATE
          ↓
    07 PREPARE_BRANCH
          ↓
    08 PRE_COMMIT_VALIDATION
          ↓
    09 SELECTIVE_STAGE
          ↓
    10 VERIFY_STAGED_DIFF
          ↓
    11 COMMIT
          ↓
    12 CAPTURE_REMOTE_BRANCH_EXPECTATION
          ↓
    13 REBASE_ON_ORIGIN_DEV
          ↓
    14 CONFLICT_SAFETY_GATE
          ↓
    15 POST_REBASE_VALIDATION
          ↓
    16 VERIFY_PR_DIFF
          ↓
    17 VERIFY_BASE_FRESHNESS
          ├─ moved + retry available
          │      → 13 REBASE → conflict gate
          │      → validation → PR diff → 17
          ├─ moved + budget exhausted → STOP
          └─ fresh
                ↓
    18 PUSH_WITH_SAFE_LEASE
          ↓
    19 FIND_EXISTING_PR
          ↓
          ┌─────────────────┐
          │                 │
         OPEN             missing
          │                 │
        update            create
          │                 │
          └────────┬────────┘
                   ↓
    20 VERIFY_PR
                   ↓
    21 REPORT

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
2. origin/dev is the authoritative integration base.
3. Never blindly stage all changed files.
4. Always inspect git diff --cached and git diff --cached --stat before commit.
5. Never use git push --force.
6. Never automatically use destructive cleanup.
7. Never guess through high-risk semantic conflicts.
8. Any integration-changing rebase or conflict resolution requires revalidation.
9. Inspect the complete origin/dev...HEAD diff before the PR.
10. The PR base must explicitly be dev.
11. Do not create duplicate OPEN PRs for the same branch and dev base.
12. Verify the PR after create or update.
13. Never claim validation succeeded unless it ran successfully.
14. Never silently lose or discard user work, including changes, files, commits, or stashes.
15. Never merge the PR as part of this skill.
16. Do not push if origin/dev changed since the last validated rebase.
17. Rewrite remote history only while the exact expected remote branch SHA remains unchanged.
18. Do not begin a commit workflow if unrelated tracked work would prevent safe completion.

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
       test -d "$(git rev-parse --git-path rebase-merge)"
       test -d "$(git rev-parse --git-path rebase-apply)"
       git rev-parse -q --verify MERGE_HEAD
       git rev-parse -q --verify CHERRY_PICK_HEAD
       git rev-parse -q --verify REVERT_HEAD
       test -f "$(git rev-parse --git-path BISECT_START)"

Treat each check's exit status as the evidence: `git rev-parse --git-path` merely prints a location and does not prove that a rebase is active. The rebase directories, Git operation heads, and `BISECT_START` file must actually exist. `BISECT_START` detects normal bisect state even when `BISECT_HEAD` is absent.

3. When the PR endpoint is needed, verify gh --version and gh auth status without exposing credentials.
4. Stop for a non-repository, detached-HEAD, missing-tooling, or unrelated merge/rebase/cherry-pick/revert/bisect state. Resume only an operation unambiguously recorded as belonging to an earlier invocation of this workflow; never guess ownership.

### 02. FETCH_REMOTE

Refresh remote state early:

       git fetch origin --prune
       git show-ref --verify refs/remotes/origin/dev

If origin or origin/dev is missing after a successful fetch, stop. Do not invent a base or use local dev as a substitute.

### 03–06. ANALYZE, CLASSIFY, AND PROVE COMPLETION FEASIBILITY

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
- If the current branch is known and gh is authenticated, inspect its PR list as an inventory hint; phase 19 must re-query the current head and explicit dev base before create/update.
- On dev, inspect git rev-list --left-right --count origin/dev...dev and git log --oneline origin/dev..dev. If local-only commits are unexplained or unrelated, stop without moving commits or resetting. Continue only when their relationship to the request is clear and the resulting PR would not inherit unrelated history.
- On main or master, do not commit. Only create a task branch when the current tip has no unique commits relative to origin/dev and is safe to rebase; otherwise stop and preserve the work.
- On an existing working branch, verify that commits relative to origin/dev are coherent with the request and do not contain accidental merges, WIP, or another feature. Flag history problems; do not rewrite them automatically.
- Inspect untracked files by name, type, and relevant safe content before considering them. Never print likely secret values.

Classify the work as one coherent scope or multiple scopes using behavior, intent, domain, dependencies, tests, and diff semantics—not directory boundaries alone. Then ask before any branch, index, or commit mutation: **Can this workflow reach a clean rebase and PR creation without discarding, hiding, or automatically stashing unrelated user work?**

- Continue when all tracked/staged changes belong to one coherent task and committing them will leave a rebase-safe index/worktree.
- A clearly unrelated untracked ignored/debug artifact may remain only when it is proven unstageable, will not be overwritten or interfere with checkout/rebase/validation, and is reported.
- Stop before branching, staging, or committing when unrelated tracked modifications, unrelated staged changes, or another task's partial edits would remain. Preserve every change and do not stash automatically.
- If separation or completion feasibility is ambiguous, stop and report each suspected scope. Do not hide mixed work in a vague commit or create a partial task commit that cannot safely reach the PR.

Infer a Conventional Commit type and optional scope from intent. Read [commit-convention.md](references/commit-convention.md) when the type, scope, or PR title is not obvious.

### 07. PREPARE_BRANCH

If the current branch is a suitable working branch, reuse it; never create a nested branch unnecessarily. Protected branches are dev, main, and master.

When a protected branch is safe to branch from, choose a short lowercase name in the form <type>/<short-kebab-description>, for example feat/auth-refresh-token or fix/payment-duplicate-transaction. Verify both local and remote names before creating it:

       git show-ref --verify --quiet refs/heads/<candidate>
       git ls-remote --exit-code --heads origin <candidate>
       git switch -c <candidate>

If a remote name is occupied by unknown work, do not attach to it blindly. Choose a deterministic unused suffix such as -2, verify again, and report the choice. Never use meaningless names.

Read [branch-naming.md](references/branch-naming.md) for naming and protected-branch edge cases. Carry current work onto the new branch without stashing or discarding it.

### 08. PRE_COMMIT_VALIDATION

Discover repository-defined validation from package.json, workspace configuration, Makefile, justfile, pyproject.toml, Cargo.toml, go.mod, CI configuration, and local instructions. Prefer focused checks for affected packages/apps, then broader required checks needed for confidence. For monorepos, identify affected workspaces and cross-package effects.

Run only commands that exist and are relevant: lint, format/check, typecheck, unit/integration tests, build, and repository-specific checks. Record exact commands and outcomes. Target auto-fixes narrowly; after any auto-fix, inspect git status and git diff and return to scope classification if files changed unexpectedly.

If a failure is introduced by this work, repair it when clearly in scope or stop before PR creation. Distinguish pre-existing failures from regressions; never conceal either. Read [validation-strategy.md](references/validation-strategy.md) for monorepos, generated files, lockfiles, migrations, and validation evidence.

### 09–10. SELECTIVE_STAGE and VERIFY_STAGED_DIFF

Stage only exact paths or hunks proved to belong to the intended scope:

       git add -- <explicit-file-1> <explicit-file-2>
       git add -p
       git diff --cached
       git diff --cached --stat

Do not automatically stage secrets, local configuration, logs, debug artifacts, generated output, or unrelated edits. If existing staged content is mixed or uncertain, stop or correct only with explicit path-level index operations that preserve worktree content. The staged diff is authoritative: verify intended files, semantic tests, no secrets, no debug leftovers, no unrelated changes, and expected lockfile/generated-file behavior before continuing.

### 11. COMMIT

If the staged diff is non-empty, generate a concise imperative Conventional Commit from that diff, for example feat(auth): add refresh token rotation. Use a body only when it adds necessary context. Commit only verified staged content.

If there is no new staged diff but the working branch already has the intended commits, record a no-op and do not create an empty duplicate commit. Otherwise stop rather than committing an empty or ambiguous change. After a commit, verify:

       git status --short
       git log -1 --oneline
       git show --stat --oneline HEAD

If hooks modify files or fail, inspect the new state. Never silently absorb hook-generated changes; reclassify and selectively stage them only when they clearly belong.

### 12. CAPTURE_REMOTE_BRANCH_EXPECTATION

Immediately before any rebase can rewrite published history, query the live remote head rather than trusting a remote-tracking ref:

       git ls-remote --heads origin "refs/heads/<current-branch>"

Record the returned SHA as `EXPECTED_REMOTE_SHA`. No result means the branch is expected not to exist. Ensure the remote commit object is available locally when needed, then classify both ancestry directions. If the remote branch is ahead of or diverged from local history, stop and inspect; do not blindly rebase and force-push over it. Keep the original expectation for the eventual push—never refresh the expected SHA merely to make a lease pass.

### 13–14. REBASE_ON_ORIGIN_DEV and CONFLICT_SAFETY_GATE

Require a clean, explained index and worktree, refresh, confirm the remote feature head still matches `EXPECTED_REMOTE_SHA`, and rebase onto the authoritative base:

       git fetch origin --prune
       git rebase origin/dev

Immediately after a successful or no-op rebase, record `REBASED_BASE_SHA` from `git rev-parse origin/dev` and prove it is an ancestor of HEAD. This SHA identifies the integration tree that later validation covers. Never rebase onto local dev or use ambiguous git pull.

If rebase conflicts, read git status, inspect every conflicted file and both sides, and follow [conflict-resolution.md](references/conflict-resolution.md). Resolve only when intent is obvious and preserve compatible intent from both branches. Low-risk import/formatting conflicts may be resolved when semantics are clear. Authentication/authorization, payments, financial calculations, schema or migration semantics, data deletion, security policy, concurrency, locking, transactions, and business rules are high risk: do not guess. If safe resolution is unavailable, leave or abort only the skill-owned rebase when appropriate, preserve all work, and report the exact state. Never use repository-wide ours/theirs selection, reset, or clean.

### 15. POST_REBASE_VALIDATION

A successful rebase is not validation. Rerun all applicable integration checks—lint, typecheck, tests, build, and repository-specific checks—against the rebased tree, including checks affected by changed dev contracts. Any later rebase or conflict resolution makes this evidence stale and returns here. Do not claim readiness while required validation is failing or unverified; inspect final status and record exact commands and results.

### 16. VERIFY_PR_DIFF

Inspect exactly what reviewers will see:

       git log --oneline --decorate origin/dev..HEAD
       git diff --stat origin/dev...HEAD
       git diff origin/dev...HEAD

Use the full triple-dot diff and commit list to verify scope, history, generated files, secrets, database/security impact, and reviewer context. Derive the PR title and body from this complete diff and actual validation, never HEAD alone. Read [pr-template.md](references/pr-template.md) when a repository template exists or when drafting the body.

### 17. VERIFY_BASE_FRESHNESS

Immediately before push, refresh the relevant remote state and compare the exact base:

       git fetch origin --prune
       git rev-parse origin/dev

Continue only when current origin/dev equals `REBASED_BASE_SHA`. If it moved, do not push: increment the freshness retry count, rebase onto the new origin/dev, record the new base SHA, pass the conflict gate, rerun all applicable validation, reinspect the full PR diff, and check freshness again. Allow at most **2 automatic freshness rebase retries** per invocation. If origin/dev moves after both retries, stop and report rapidly changing dev without claiming latest integration. Never skip validation or PR-diff review after a retry rebase.

### 18. PUSH_WITH_SAFE_LEASE

Re-query the live remote feature head immediately before push. It must still equal `EXPECTED_REMOTE_SHA`, or still be absent when absence was recorded. If it changed, stop, fetch, inspect, preserve local work, and report another actor's update.

For a branch that remains absent remotely, use normal first push:

       git push -u origin HEAD

Use normal push when published history was not rewritten. If a rebase rewrote an existing remote branch, bind force-with-lease to the exact observed SHA:

       git push --force-with-lease="refs/heads/<branch>:<EXPECTED_REMOTE_SHA>" origin HEAD:refs/heads/<branch>

The explicit expected SHA is mandatory; a bare `--force-with-lease` is insufficient for this rewrite path. On rejection or lease failure, never retry with `--force`, never overwrite the new remote head, and never silently replace the expectation. Stop after read-only fetch/inspection and report the race. Never push dev, main, or master directly.

### 19–20. FIND_EXISTING_PR, CREATE_OR_UPDATE, VERIFY_PR

With gh authenticated, query the current head and explicit base before creating anything:

       gh pr list --head <current-branch> --base dev --state open --json number,url,title,baseRefName,headRefName,state
       gh pr view <number> --json number,url,title,body,baseRefName,headRefName,state

If an open PR for this head targets dev, update it rather than creating a duplicate. Preserve useful human-written body content and reviewer discussion; change generated sections only when the full diff or validation evidence changed. If no such PR exists, create one with an explicit base:

       gh pr create --base dev --head <current-branch> --title "<validated PR title>" --body-file <reviewed-body-file>

For an existing PR, use the reviewed body and title with `gh pr edit <number> --title ... --body-file ...`; never replace human-written context wholesale.

Populate an existing repository PR template when present. Include only checks that actually passed, and accurately call out failures, skipped checks, breaking changes, database/migration changes, security considerations, generated files, and follow-up notes. Never claim “all tests pass” from partial evidence. An existing open PR for the same head with a different base is an ambiguity to report, not a reason to overwrite it.

When no OPEN PR to dev exists, query prior same-head PRs in CLOSED and MERGED state. They are historical records, not active PRs: never silently edit, reopen, or treat them as reusable. Create a new PR only when the complete current diff is non-empty new work, branch/history relationships safely support a new review, and no OPEN duplicate exists. Otherwise stop and explain the prior PR relationship.

Verify the result after create or update:

       gh pr view <number> --json number,url,title,baseRefName,headRefName,state

Success requires state == OPEN, baseRefName == dev, headRefName equal to the current branch, and a confirmed PR number, URL, and title. CI is the remote integration gate; report available checks accurately, but do not merge or bypass them.

### 21. REPORT

Report only verified facts in this compact form:

    PR prepared successfully.

    Branch:
    <branch>

    Commit(s):
    <sha> <message>

    Base:
    origin/dev <REBASED_BASE_SHA>, freshness confirmed before push

    Validation:
    ✓ <successful command>
    ! <failed, skipped, or pre-existing issue with explanation>

    Rebase:
    ✓ validated against origin/dev <REBASED_BASE_SHA>

    PR:
    #<number> <title>
    <branch> → dev

    URL:
    <url>

If blocked, state current Git state, exact reason, preserved work, completed states, and remaining states. Do not label partial work success or PR ready.

## Stop conditions

Stop safely and preserve state when any of these is true:

- The directory is not a Git worktree, origin/origin-dev is unavailable, or required GitHub authentication/tooling is missing.
- An unrelated merge, rebase, cherry-pick, revert, or bisect is in progress.
- dev has unexplained local-only commits, or a protected branch would leak unrelated history.
- Unrelated tracked/staged work would remain dirty, or multiple scopes cannot reach a clean rebase safely.
- A likely secret, credential, or unintended artifact would enter the staged or PR diff.
- A high-risk semantic conflict cannot be resolved from repository evidence.
- Validation exposes an in-scope regression, a major unrelated repository problem, or required checks cannot be truthfully represented.
- The branch contains unexplained commits, is diverged from its remote, or its remote SHA changes after inspection.
- origin/dev keeps moving after 2 automatic freshness retries.
- An existing PR/base relationship or CLOSED/MERGED PR history does not safely support new work.

On every stop: do not reset, clean, discard, silently drop commits, merge, delete branches, or push a protected branch. Report current branch, operation state, worktree preservation, exact blocker, and safe next action.

## Command safety classification

Read [safety-rules.md](references/safety-rules.md) when a history-changing, destructive-looking, or recovery action is under consideration. In summary:

- **Normally safe:** status/diff/log/show/rev-parse/rev-list/ls-remote/gh inspection, fetch, and repository-defined validation.
- **Mutating within this workflow:** verified branch creation, explicit-path staging, commit, rebase origin/dev, skill-owned rebase continue/abort, normal branch push, and explicit-base PR create/edit.
- **High caution:** semantic conflict resolution, high-risk business/security/migration decisions, and explicit-SHA force-with-lease.
- **Forbidden automatically:** reset --hard, clean -fd, push --force, branch -D, repository-wide ours/theirs selection, protected-branch pushes, work loss, PR merge/approval/close, branch deletion, release/deploy, or protection/CI bypass.

## Anti-patterns

Reject this shortcut:

    git add .
    git commit -m "update"
    git pull
    git push
    gh pr create

It lacks scope proof, staged-diff review, origin/dev synchronization, validation, conflict safety, explicit PR targeting, idempotent PR detection, and verification. Also reject using git checkout dev && git pull && git checkout -b ... as the synchronization policy: fetch first and compare/rebase against origin/dev.

## Conditional references

- Use this file as the authoritative normal workflow. Read [workflow.md](references/workflow.md) only when resuming partial execution, proving state exit evidence, handling freshness retries, diagnosing an ambiguous transition, or reporting a blocked/recovery state.
- Read [safety-rules.md](references/safety-rules.md) for command boundaries and stop behavior when a destructive or history-changing action is under consideration.
- Read [branch-naming.md](references/branch-naming.md) when selecting a branch or handling protected-branch divergence.
- Read [commit-convention.md](references/commit-convention.md) when inferring commit type, scope, or title.
- Read [conflict-resolution.md](references/conflict-resolution.md) for any rebase conflict, especially auth, payment, migration, security, or concurrency conflicts.
- Read [validation-strategy.md](references/validation-strategy.md) when discovering checks, handling monorepos/generated files/lockfiles, or interpreting failures.
- Read [pr-template.md](references/pr-template.md) when creating/updating a body, detecting a repository template, or documenting database/security/breaking changes.
