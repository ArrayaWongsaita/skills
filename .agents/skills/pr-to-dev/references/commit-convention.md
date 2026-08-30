# Commit convention

Derive the message from the semantic staged diff and repository conventions. The staged diff is the source of truth.

## Types

Use the first applicable intent:

- feat: user-visible capability or behavior
- fix: correction of incorrect behavior
- refactor: behavior-preserving structure change
- test: tests without production behavior change
- docs: documentation-only change
- chore: maintenance without product behavior change
- perf: measurable performance improvement
- build: build or dependency tooling change
- ci: CI workflow or configuration change
- style: formatting-only change

Prefer an existing repository convention when it is stricter. Do not force a type that misrepresents behavior.

## Scope

Use a concise domain or package scope only when it clarifies intent:

    feat(auth): add refresh token rotation
    fix(payment): prevent duplicate transaction
    refactor(user): isolate persistence adapter
    test(order): cover checkout failure

Omit scope when no stable domain is evident. Never invent a scope solely to satisfy a pattern.

## Subject

Write a concise imperative subject that names the outcome, not the edited file. Use add, prevent, isolate, cover, update, or remove when accurate. Avoid update file, misc changes, fix stuff, and ticket-only labels. Do not claim a behavior the full diff does not implement.

## Body

Add a body only when the staged change needs rationale, migration ordering, compatibility, or review context that the subject cannot express. Do not restate the file list.

## PR title

Use the overall coherent task from origin/dev...HEAD. If several commits form one task, write a broader title that remains accurate. The PR title may match the main commit but must be based on the complete PR diff.

## Validation

Before commit, compare message intent against cached diff. After rebase, compare the PR title/body against the full triple-dot diff again.
