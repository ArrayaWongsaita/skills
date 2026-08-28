# PR description and template integration

The PR body is derived from the complete origin/dev...HEAD diff, commit history, validation evidence, and repository instructions. It is not a restatement of the latest commit.

## Template discovery

Before drafting, inspect:

- .github/pull_request_template.md
- .github/PULL_REQUEST_TEMPLATE/
- contribution docs and repository-specific PR instructions

If a template exists, use its headings and checklist as the base. Preserve required HTML comments and reviewer prompts. Do not replace it with a generic structure without a reason.

## Review-friendly body

Use only sections that add evidence:

    ## Summary
    Outcome and user-visible or operational result.

    ## Changes
    - Important behavior or contract change.
    - Important test or workspace change.
    - Meaningful generated/configuration change.

    ## Why
    Problem and motivation.

    ## Implementation
    Key design decisions, not a file-by-file inventory.

    ## Testing
    - [x] only checks that actually passed
    - [ ] skipped or failed check with an explanation

    ## Breaking Changes
    None only when the full diff supports it; otherwise describe them.

    ## Database Changes
    None only after checking schema and migration files; otherwise list schema, migration, index, constraint, or data-migration implications.

    ## Security Considerations
    None only after checking security-sensitive paths; otherwise describe auth, permission, secret, payment, or attack-surface implications.

    ## Notes
    Reviewer context, deployment considerations, known limitations, or follow-up.

Omit empty/noisy sections when they add no value, except when a repository template requires them.

## Truthfulness

- Include only executed successful checks in checked items.
- Put failures, skipped checks, unavailable services, and pre-existing failures in visible notes.
- Do not claim all tests pass from lint or typecheck evidence.
- Do not claim no breaking, database, or security changes without inspecting the complete diff.
- Mention affected monorepo workspaces, generated files, lockfiles, and migrations when relevant.

## Existing PR updates

Fetch the existing body first. Preserve useful human-written sections, reviewer discussion, and unchecked follow-ups. Update generated summary, changes, testing, and risk details only when stale or contradicted by the new full diff. Never erase context merely to make a generic template fit.

## Create command

Use a temporary reviewed body file when invoking gh:

    gh pr create --base dev --head <branch> --title "<title>" --body-file <body-file>

The explicit base is part of the invariant. Verify the resulting PR independently.
