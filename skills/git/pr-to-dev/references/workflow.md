# Workflow phase contract

Read this file before running the workflow. Every phase has one purpose and one evidence gate. A phase may be a recorded no-op, but the agent must not advance without its exit evidence.

## 01 PREFLIGHT

- Purpose: establish repository, tool, and Git safety before mutation.
- Entry: the user requested a PR to dev and the current directory is not yet trusted.
- Actions: resolve the root; read repository instructions; run rev-parse, status, branch, remote, operation-marker, and tool checks listed in SKILL.md. Check detached HEAD and unfinished merge, rebase, cherry-pick, or bisect state, including REBASE_HEAD and the rebase metadata paths.
- Exit evidence: repository root, branch, remotes, tooling, and operation state are known; no unrelated operation is active.
- Failure behavior: stop and report the exact state. Leave index, worktree, refs, and any existing operation untouched.
- Safety constraints: inspection is read-only; do not use reset, clean, stash, checkout, or recovery commands.

## 02 FETCH_REMOTE

- Purpose: replace stale remote assumptions with current origin state.
- Entry: preflight passed and origin exists.
- Actions: run git fetch origin --prune, then verify refs/remotes/origin/dev and record its SHA.
- Exit evidence: origin/dev exists and its SHA is the base for every later comparison.
- Failure behavior: stop if fetch fails or dev is absent; report that no authoritative base is available.
- Safety constraints: never substitute local dev; pruning remote-tracking refs is allowed, but do not delete branches or tags.

## 03 ANALYZE_REPOSITORY_STATE

- Purpose: understand branch topology and history before branch or commit decisions.
- Entry: origin/dev is verified.
- Actions: record current branch, HEAD, upstream, status --branch, branch -vv, origin/dev..HEAD, HEAD..origin/dev, triple-dot counts, recent log, and local-only commits. If gh is authenticated and a branch is known, inspect its PR list as an inventory hint. Check protected branch divergence explicitly.
- Exit evidence: ahead/behind, local-only and remote-only commits, upstream, merge/WIP history, and branch relationship are classified.
- Failure behavior: stop on unexplained protected-branch commits, detached HEAD, or history that could leak another task.
- Safety constraints: history inspection is read-only; never move or rewrite commits to make topology look cleaner.

## 04 ANALYZE_WORKTREE

- Purpose: inventory user-owned local changes before selecting the commit set.
- Entry: repository topology is understood.
- Actions: inspect status, unstaged diff/stat, cached diff/stat, untracked paths, deletions, renames, and file types. Inspect safe portions of candidate untracked files without printing secrets.
- Exit evidence: every staged, unstaged, untracked, deleted, renamed, generated, and suspicious file is accounted for.
- Failure behavior: stop if a likely secret or unknown artifact cannot be classified safely.
- Safety constraints: do not stage, unstage, clean, stash, or discard during inventory.

## 05 CLASSIFY_CHANGE_SCOPE

- Purpose: decide whether the candidate change is one coherent task and derive semantic intent.
- Entry: complete worktree inventory and user request are available.
- Actions: group by behavior, domain, dependency, tests, and intent; distinguish current work from unrelated edits. Infer type, scope, summary, affected workspaces, database/security impact, and validation.
- Exit evidence: one coherent scope is selected, or ambiguous scopes are reported; intended file/hunk set and commit/PR intent are explicit.
- Failure behavior: stop before staging when unrelated work cannot be separated confidently.
- Safety constraints: directory proximity is not proof of relatedness; never use a vague commit to hide mixed work.

## 06 PREPARE_BRANCH

- Purpose: place work on a safe, reviewable working branch.
- Entry: scope is coherent and history is safe to reuse or branch.
- Actions: reuse a suitable feature branch; for a protected branch, create a descriptive candidate after explicit local and remote collision checks. Carry the worktree as-is without stashing.
- Exit evidence: current branch is not dev, main, or master; name is meaningful, available, and recorded.
- Failure behavior: stop on unsafe protected-branch history, ambiguous remote ownership, or an unresolved collision.
- Safety constraints: never commit or push normal work on protected branches; never attach to an unknown remote branch.

## 07 PRE_COMMIT_VALIDATION

- Purpose: find regressions before committing and establish truthful PR evidence.
- Entry: safe working branch and intended scope are known.
- Actions: discover existing commands; select focused and required broader checks; run relevant lint, format/check, typecheck, tests, builds, and repository checks. For monorepos include affected packages and cross-package checks. Scope auto-fixes and reinspect afterward.
- Exit evidence: each relevant check is passed, not applicable, skipped with reason, or failed with cause classified.
- Failure behavior: fix in-scope failures when safe; otherwise stop for regressions or major unknown failures. Report pre-existing failures if continuation is allowed.
- Safety constraints: do not invent absent commands, disable tests, claim unrun checks, or expand into unrelated cleanup.

## 08 SELECTIVE_STAGE

- Purpose: construct the exact index that will become the commit.
- Entry: validation evidence exists and intended paths/hunks are known.
- Actions: use explicit path staging or reviewed patch mode. Keep unrelated, secret, temporary, and unknown generated files out. Reinspect status after staging.
- Exit evidence: staged paths/hunks match the selected scope and remaining work is intentionally preserved.
- Failure behavior: correct only with explicit index operations that preserve worktree contents; stop if the index remains ambiguous.
- Safety constraints: git add . and git add -A are never substitutes for scope proof.

## 09 VERIFY_STAGED_DIFF

- Purpose: make the staged diff an auditable commit boundary.
- Entry: selective staging completed.
- Actions: inspect cached diff and cached stat; check content, tests, secrets, debug leftovers, generated files, lockfiles, migrations, and unrelated changes.
- Exit evidence: staged diff alone represents the intended task and no unsafe file is included.
- Failure behavior: return to selective staging or stop; do not commit an unverified index.
- Safety constraints: never use a status line or commit message as a substitute for cached-diff review.

## 10 COMMIT

- Purpose: create the smallest truthful Conventional Commit.
- Entry: staged diff is verified and non-empty, or existing coherent commits make this invocation a no-op.
- Actions: generate the message from staged semantics; commit; verify status, latest log, and show stat. If no new staged work exists but intended commits already exist, record the no-op.
- Exit evidence: commit SHA/message and clean-or-explained post-hook status are known.
- Failure behavior: inspect hook failures or modifications; reclassify changed files. Do not retry blindly or create an empty commit.
- Safety constraints: commit only the verified index; no direct protected-branch commit and no silent hook changes.

## 11 REBASE_ON_ORIGIN_DEV

- Purpose: integrate the latest authoritative dev base before publishing.
- Entry: working branch has coherent commits and no unresolved worktree ambiguity.
- Actions: require no unresolved or unexplained worktree/index changes; fetch origin --prune again; run git rebase origin/dev; record pre/post HEAD and whether published history changed.
- Exit evidence: branch is based on current origin/dev, or conflict state is explicitly handed to phase 12.
- Failure behavior: enter the conflict gate; if unsafe, leave or abort only the skill-owned rebase and stop.
- Safety constraints: rebase origin/dev, never local dev; no reset, clean, or blind side selection.

## 12 CONFLICT_SAFETY_GATE

- Purpose: prevent semantic guesses from becoming integration bugs.
- Entry: rebase reported conflicts or an in-progress rebase is clearly owned by this workflow.
- Actions: inspect status, every unmerged path, both sides, surrounding contracts, tests, and risk class. Resolve only obvious low-risk conflicts; add each verified resolution and continue one step at a time.
- Exit evidence: rebase completes with no unmerged paths, or a safe stop includes exact conflict files and state.
- Failure behavior: abort the skill-owned rebase when appropriate, or leave it paused with instructions; never lose work.
- Safety constraints: high-risk auth, payment, migration, security, business-rule, transaction, locking, concurrency, and deletion conflicts require a stop when intent is not proven.

## 13 POST_REBASE_VALIDATION

- Purpose: prove that the rebased tree still works with current dev.
- Entry: rebase completed without unresolved conflicts.
- Actions: rerun relevant pre-commit checks, including checks affected by changed base contracts; inspect hook-generated changes and status.
- Exit evidence: final validation commands and outcomes are recorded against rebased HEAD.
- Failure behavior: repair only in-scope regressions or stop with truthful failures; return to scope/staging if new changes appear.
- Safety constraints: a clean rebase is not a passing test suite.

## 14 VERIFY_PR_DIFF

- Purpose: review exact commits and content reviewers will see.
- Entry: rebased branch and post-rebase evidence exist.
- Actions: inspect log origin/dev..HEAD, stat origin/dev...HEAD, and full diff origin/dev...HEAD. Check scope, accidental history, secrets, generated output, lockfiles, migrations, security, breaking changes, and reviewer context.
- Exit evidence: PR title, body, summary, risk notes, and validation claims come from the full diff.
- Failure behavior: remove or correct unsafe staged content before push, or stop for unrelated history or uncertain impact.
- Safety constraints: do not derive the PR from the latest commit alone; origin/dev remains the comparison base.

## 15 PUSH

- Purpose: publish only the reviewed working branch.
- Entry: final PR diff is approved by local evidence and branch is not protected.
- Actions: use normal upstream push for a never-published branch; use force-with-lease only when an existing remote branch was rewritten by rebase. Inspect rejection instead of escalating force.
- Exit evidence: remote head reflects reviewed local head and push mode/reason are recorded.
- Failure behavior: stop on rejection, lease failure, authentication failure, or unexpected remote movement.
- Safety constraints: never force, never push protected branches, and never publish before phase 14.

## 16 FIND_EXISTING_PR

- Purpose: make reruns idempotent and avoid duplicate PRs.
- Entry: remote branch is published and gh is authenticated.
- Actions: query open PRs with current head and explicit base dev; inspect candidate metadata/body. Also check same-head PRs with another base.
- Exit evidence: select update an existing dev PR, create a missing PR, or stop for ambiguity.
- Failure behavior: report missing API access or ambiguity without creating anything.
- Safety constraints: identify by head and base, not a remembered number; do not overwrite human discussion.

## CREATE_OR_UPDATE_PR

- Purpose: create the requested PR or refresh an existing one with accurate context.
- Entry: phase 16 selected create or update.
- Actions: compose a reviewed body from the full diff, validation, repository template, and risk findings. Create with explicit base dev, or update only generated/stale sections while preserving human content.
- Exit evidence: gh returns a PR number and URL; title and body are known.
- Failure behavior: stop and report; do not retry by creating a second PR.
- Safety constraints: do not change base away from dev, merge, close, delete, or erase reviewer context.

## 17 VERIFY_PR

- Purpose: confirm the external result matches the requested invariant.
- Entry: create/update returned or an existing PR was selected.
- Actions: run gh pr view with number, URL, title, baseRefName, headRefName, and state; optionally report immediately available CI separately.
- Exit evidence: state OPEN, baseRefName dev, headRefName current branch, and number/URL/title all match.
- Failure behavior: do not report success; state which invariant failed and preserve branch/PR.
- Safety constraints: never infer state from the create command alone.

## 18 REPORT

- Purpose: hand off concise, auditable facts and warnings.
- Entry: phase 17 passed or a safe stop occurred.
- Actions: report branch, commit(s), origin/dev base, validation outcomes, rebase, PR metadata, URL, warnings, and incomplete states.
- Exit evidence: user can see what changed, what was verified, and what remains.
- Failure behavior: use the blocked report format; never call partial completion success.
- Safety constraints: omit raw secret-bearing output and unverified CI claims.
