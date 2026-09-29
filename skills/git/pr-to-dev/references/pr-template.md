# PR description and template integration

The PR body is derived from the complete origin/dev...HEAD diff, commit history, validation evidence, and repository instructions. It is not a restatement of the latest commit.

## Template discovery

Before drafting, inspect:

- .github/pull_request_template.md
- .github/PULL_REQUEST_TEMPLATE/
- contribution docs and repository-specific PR instructions

If a template exists, use its headings and checklist as the base, and carry the Evidence and Merge Danger content below into its testing and risk sections. Preserve required HTML comments and reviewer prompts. Do not replace it with a generic structure without a reason.

## Review-friendly body

The top three sections let a reviewer decide fast: what changed, proof it works, and what a bad merge costs. Summary, Evidence, and Merge Danger always appear; the rest appear only when they add evidence:

    ## Summary
    Outcome and user-visible or operational result, then the smallest visual
    that makes it clear (see "Summary visual").

    ## Evidence
    - **Before:** <failing test run, output, or screenshot>
      **After:** <the same run, passing>
    - [x] only checks that actually passed
    - [ ] skipped or failed check with an explanation

    ## Merge Danger
    **Door:** <one-way | two-way>: <the part a revert would not undo, if any>
    **Blast radius:** <one word>: <who or what feels it if this is wrong>

    ## Changes
    - Important behavior or contract change.
    - Important test or workspace change.
    - Meaningful generated/configuration change.

    ## Why
    Problem and motivation.

    ## Implementation
    Key design decisions, not a file-by-file inventory.

    ## Breaking Changes
    None only when the full diff supports it; otherwise describe them.

    ## Database Changes
    None only after checking schema and migration files; otherwise list schema, migration, index, constraint, or data-migration implications.

    ## Security Considerations
    None only after checking security-sensitive paths; otherwise describe auth, permission, secret, payment, or attack-surface implications.

    ## Notes
    Reviewer context, deployment considerations, known limitations, or follow-up.

Omit empty/noisy sections below Merge Danger when they add no value, except when a repository template requires them.

## Summary visual

Pick the one view that shows the point with the least reading: pseudocode for logic, a call tree for runtime control flow, a shallow file tree for a layout change or broad refactor, a `diff` sketch when the surrounding shape already exists, or a Mermaid diagram for interaction between components. Keep only the calls, files, and boundaries the reviewer needs; place it right under the sentence it supports.

## Evidence

Evidence is a before/after pair from runs that actually happened on this branch:

- **Execution evidence:** name the test that failed before the change and passes after it, and quote its red and green lines. When the branch came through an implementer, that red and green output is already recorded per ticket under `.scratch/<feature-slug>/`: `reports/<NN>.md` (`subagent-implement`), `logs/<NN>.json` (`agy-implement`), or `logs/<NN>.jsonl` (`opencode-implement`). When it came through `review-to-pr`, its `review-status.md` holds the review verdicts and the `fix(review):` commits worth listing.
- **Visual evidence:** for a visible UI change, a before/after screenshot is the strongest evidence whenever the environment can capture one.
- **Checks list:** tick a check only when it ran and passed on the final tree.

Quote the signal-carrying lines rather than whole logs, and redact secrets, tokens, and personal data.

## Merge Danger

Judge both lines from the complete origin/dev...HEAD diff, the same inspection the Breaking, Database, and Security sections rely on.

- **Door:** two-way when reverting the merge fully undoes it: code-only, no persisted data, no external contract. One-way when a revert leaves something behind: a migration or backfill, a changed on-wire or on-disk format, a public API or event that other systems consume, deleted data, sent messages, or a published package. Name the one-way part.
- **Blast radius:** one word for who or what feels a bad merge (`isolated`, `module`, `service`, `consumers`, `users`, `data`), then the concrete ramifications worth checking, such as layout shift, broken consumers, mobile, performance, or permissions.

## Truthfulness

- Include only executed successful checks in checked items.
- Put failures, skipped checks, unavailable services, and pre-existing failures in visible notes.
- Do not claim all tests pass from lint or typecheck evidence.
- Do not claim no breaking, database, or security changes without inspecting the complete diff.
- Mention affected monorepo workspaces, generated files, lockfiles, and migrations when relevant.

## Existing PR updates

Fetch the existing body first. Preserve useful human-written sections, reviewer discussion, and unchecked follow-ups. Update generated summary, evidence, merge danger, changes, and risk details only when stale or contradicted by the new full diff. Never erase context merely to make a generic template fit.

## Create command

Use a temporary reviewed body file when invoking gh:

    gh pr create --base dev --head <branch> --title "<title>" --body-file <body-file>

The explicit base is part of the invariant. Verify the resulting PR independently.
