# Validation strategy

Validation is evidence attached to a tree, not a ritual command list. Discover the repository's own checks, select them from affected scope, and record exact outcomes before and after rebase.

## Discover commands

Inspect repository instructions and the files that define commands:

- package.json and workspace/package-manager configuration;
- pnpm-workspace.yaml, turbo.json, nx.json, Makefile, and justfile;
- pyproject.toml, Cargo.toml, go.mod, and language-specific tool config;
- CI workflow files and repository contribution docs.

Run only commands that exist and are relevant. Prefer package or workspace-focused checks when they provide equivalent confidence, then include required repository-wide checks before publishing.

## Evidence categories

Record each as passed, failed, skipped, or not applicable:

- format/check;
- lint;
- typecheck;
- unit tests;
- integration or end-to-end tests;
- build;
- schema/code generation or repository-specific checks.

A check is passed only when it ran successfully for the rebased tree. A missing tool, unavailable service, timeout, or partial command is not a pass.

## Failure classification

- Introduced failure: repair it when clearly within scope, then rerun. If not safely repairable, stop before creating or updating a ready-looking PR.
- Pre-existing failure: prove it is outside the changed path when possible, report it in the PR and final result, and continue only when repository policy and risk allow.
- Unknown failure: do not guess that it is pre-existing. Investigate or stop.
- Major unrelated repository failure: stop when it makes the final integration claim untrustworthy.

Never disable a check, weaken a test, change a snapshot solely to hide a failure, or refactor unrelated legacy code to make this workflow green.

## Monorepos

Identify affected apps/packages and cross-package consumers from the diff and workspace graph. Run targeted checks for each affected unit, then broader checks when shared packages, public contracts, lockfiles, or repository policy require them. Mention affected workspaces in the PR body.

## Auto-fix

Run formatters and linters with a narrow path or package scope. After any auto-fix:

1. inspect git status and git diff;
2. reclassify changed files and hunks;
3. selectively stage only intended changes;
4. rerun affected validation.

Never run a repository-wide write-mode formatter merely to reduce friction.

## Generated files

Determine whether generated clients, schemas, compiled output, coverage, dist, build output, or codegen artifacts are versioned by repository convention. Include expected generated changes only when the source change requires them. Keep untracked build junk out.

## Lockfiles

When a dependency manifest changes, inspect whether the matching lockfile is expected. Do not regenerate or omit lockfiles without evidence from package-manager conventions, the resolved dependency graph, and the diff. Review lockfile changes for unrelated churn.

## Database and migration changes

If schema or migration files are affected, inspect destructive drops/removals, renames, nullable-to-non-nullable changes, uniqueness, foreign keys, indexes, data migrations, and ordering. Do not resolve migration conflicts by filename order alone. Validation may require a schema check, migration check, generated client check, or disposable database; report what actually ran.

## Security-sensitive changes

For auth, credentials, cookies, sessions, permissions, raw SQL, uploads, payment, encryption, CORS, CSRF, rate limiting, or secret handling, use focused tests and a higher review threshold. Never print secret values and include meaningful security implications in the PR body.
