# Exceptional workflow, evidence, and recovery

`SKILL.md` is the authoritative normal workflow. Read this reference only to resume a partial invocation, prove an important state boundary, handle a freshness retry, diagnose an ambiguous transition, or report a blocked/recovery state. Do not use it as a second copy of the happy path.

## Resume rule

Reconstruct state from repository and remote evidence; do not infer completion from an earlier message or intended command. Record current branch/HEAD, index/worktree, operation markers, origin/dev, live remote feature SHA, validation tree, and PR metadata. An active Git operation may be resumed only when prior evidence unambiguously ties it to this skill and its intended branch/base. Otherwise stop without changing it.

Resume from the earliest state whose exit evidence is missing or stale. In particular:

- any unexpected tracked/index change returns to scope and completion feasibility;
- any rebase or conflict resolution invalidates integration validation and PR-diff evidence;
- any origin/dev movement invalidates the recorded integration base;
- any remote feature-head movement invalidates the push expectation and is a stop, not a lease refresh;
- create/update output never substitutes for independent PR verification.

## Deterministic preflight operation evidence

Path printing is not state detection. Check marker existence or ref resolution and interpret each exit status separately:

| Operation | Active evidence |
| --- | --- |
| rebase | `rebase-merge` or `rebase-apply` from `git rev-parse --git-path` exists as a directory |
| merge | `git rev-parse -q --verify MERGE_HEAD` succeeds |
| cherry-pick | `git rev-parse -q --verify CHERRY_PICK_HEAD` succeeds |
| revert | `git rev-parse -q --verify REVERT_HEAD` succeeds |
| bisect | `BISECT_START` from `git rev-parse --git-path` exists as a file |

`BISECT_HEAD` alone is insufficient because ordinary bisect state can exist without that ref. Git-path resolution remains worktree-safe; marker existence is the deciding evidence.

## Critical state evidence

### COMPLETION_FEASIBILITY_GATE

Entry evidence:

- every tracked, staged, unstaged, and relevant untracked path is classified;
- selected scope and unrelated scope are explicit.

Exit evidence:

- committing the selected scope will leave no unrelated tracked/index changes that block rebase;
- any remaining untracked artifact is proven unstageable and non-interfering;
- no stash, discard, reset, or hidden-work plan is required.

If this cannot be proven, stop before branch/index/commit mutation and report all work preserved.

### CAPTURE_REMOTE_BRANCH_EXPECTATION

Entry evidence:

- current working branch and local HEAD are known;
- completion feasibility passed.

Exit evidence:

- the live `refs/heads/<branch>` was queried with `git ls-remote --heads`;
- `EXPECTED_REMOTE_SHA` is the exact returned SHA or explicit absence;
- both ancestry directions were inspected when the remote exists;
- remote-ahead or diverged history has stopped instead of entering rewrite flow.

Do not replace this evidence with a possibly stale remote-tracking ref.

### REBASE_ON_ORIGIN_DEV / CONFLICT_SAFETY_GATE

Entry evidence:

- clean, explained index/worktree;
- live remote feature head still matches its recorded expectation;
- current origin/dev is fetched.

Exit evidence:

- rebase completed and no unmerged paths or rebase markers remain;
- pre/post HEAD and rewrite status are recorded;
- `REBASED_BASE_SHA` equals the origin/dev used and is an ancestor of HEAD;
- every conflict resolution has a recorded semantic risk decision.

If conflict ownership or semantics are unclear, use the safe stop/abort rules in `conflict-resolution.md`; never guess.

### POST_REBASE_VALIDATION

Exit evidence:

- every applicable lint, typecheck, test, build, and repository-specific command is recorded with its real outcome;
- the evidence applies to current HEAD and `REBASED_BASE_SHA`;
- status after validation is clean or fully explained.

An integration-changing rebase or conflict edit expires all earlier integration evidence.

### VERIFY_PR_DIFF

Exit evidence:

- commit list `origin/dev..HEAD`, stat, and full `origin/dev...HEAD` diff were reviewed;
- scope, history, secrets, generated files, migrations, security/business risk, and reviewer context are classified;
- title/body claims and validation notes come from this complete range.

### VERIFY_BASE_FRESHNESS

Exit evidence:

- origin/dev was fetched immediately before push;
- current origin/dev SHA was compared exactly with `REBASED_BASE_SHA`;
- equality permits push; inequality enters a bounded retry or safe stop.

Freshness retry loop:

1. Start with retry count 0 after the initial rebase.
2. On movement, if count is below 2, increment it and return to rebase on the new origin/dev.
3. Pass conflict safety, capture the new base SHA, rerun every applicable integration check, and review the full PR diff again.
4. Fetch and compare again.
5. If origin/dev moves after 2 retries, stop. Do not push, loop, or claim latest integration.

### PUSH_WITH_SAFE_LEASE

Entry evidence:

- base freshness passed;
- current branch is not protected;
- live remote feature SHA still equals `EXPECTED_REMOTE_SHA`, or remains absent;
- whether the rebase rewrote published history is known.

Exit evidence:

- remote branch updated successfully;
- a normal push was used for a new/non-rewritten history;
- rewritten published history used an explicit lease for exactly `EXPECTED_REMOTE_SHA`;
- the resulting remote head is known.

A changed remote head or lease failure is a stop. Fetch and inspect for diagnosis, but do not overwrite it, retry with force, or replace the expectation.

### FIND_EXISTING_PR / VERIFY_PR

Selection evidence:

- OPEN PRs were queried by exact head and base dev;
- same-head PRs with another base and CLOSED/MERGED history were inspected when relevant;
- an OPEN dev PR is reused; a historical PR is never edited/reopened silently;
- new PR creation is allowed only for non-empty new work on safe history with no OPEN duplicate.

Final exit evidence:

- number and URL are available;
- state is OPEN;
- baseRefName is dev;
- headRefName is the expected working branch;
- verified title is available.

## Other mutation exit evidence

| State | Required evidence before advancing |
| --- | --- |
| PREPARE_BRANCH | current branch is the intended non-protected branch; local/remote collision checks and any created name are recorded |
| SELECTIVE_STAGE | index contains only reviewed paths/hunks; unrelated and secret-like content remains excluded and preserved |
| VERIFY_STAGED_DIFF | cached diff and stat alone match the selected coherent task |
| COMMIT | SHA/message, latest commit stat, and clean-or-explained hook/worktree state are recorded |
| CREATE_OR_UPDATE_PR | returned number/URL are known; explicit dev base was used; human-authored content was preserved before independent verification |

## Edge transitions

### Remote feature branch diverged before rebase

If neither the remote SHA nor local HEAD is an ancestor of the other, stop before rebase. Preserve both histories and report the two tips. Reconciliation requires an explicit, evidence-backed decision outside the automatic rewrite path.

### Remote feature branch changed after inspection

If live remote SHA changes after expectation capture, stop at the next comparison or explicit-lease failure. Keep local rebased work intact. Do not treat the new SHA as permission to overwrite or silently incorporate another actor's commits.

### CLOSED or MERGED previous PR

Treat it as history, not the active target. Determine whether `origin/dev...HEAD` is genuinely new and whether branch ancestry supports a new PR. Create a new PR only after those checks and an OPEN-PR query; otherwise stop and report why the old branch/PR cannot safely be reused.

### Validation or hooks create changes

Return to worktree analysis and completion feasibility. Do not absorb the files into the existing commit automatically. Any new commit or integration change requires the downstream evidence to be rebuilt.

## Blocked report evidence

Report current branch/HEAD, active Git operation, origin/dev and recorded base SHAs, expected/live remote feature SHAs, retry count, staged/unstaged/untracked work preserved, last completed state, exact blocker, validation already run, PR state if any, and the safest next action. Never label a blocked or stale-base state as ready.
