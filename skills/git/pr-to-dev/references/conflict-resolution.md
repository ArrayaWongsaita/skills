# Conflict resolution

A rebase conflict is a semantic review gate, not a text-editing exercise. Read repository instructions, the conflicting diff, nearby tests, and the current dev-side contract before choosing a resolution.

## Procedure

1. Run git status and list every unmerged path.
2. Read conflict markers and both staged sides. Inspect parent commits and surrounding code when the marker is insufficient.
3. Classify each file and behavior as low, medium, or high risk.
4. Resolve only conflicts whose intended behavior is proven by the request, current branch diff, origin/dev behavior, tests, or repository conventions.
5. Add each resolved path explicitly and run git rebase --continue.
6. Repeat status and semantic review until rebase completes or a safe stop is required.
7. After completion, run post-rebase validation and inspect the full origin/dev...HEAD diff.

## Risk taxonomy

### Low risk

Examples include import ordering, formatting, adjacent additive code, and non-overlapping test additions. Automatic resolution is acceptable only when both sides remain represented and the result is mechanically obvious.

### Medium risk

Examples include shared implementation logic, changed function signatures, dependency wiring, shared DTOs, or configuration used by multiple packages. Resolve only when callers, tests, and contracts prove the intended result. Otherwise stop.

### High risk

Treat these as high risk:

- authentication, authorization, sessions, JWT, cookies, OAuth, password handling, permissions, roles, CORS, CSRF, rate limiting, and secrets;
- payment, billing, money, financial calculations, idempotency, and settlement;
- database schemas, migrations, destructive changes, constraints, indexes, data movement, and migration ordering;
- deletion behavior, retention, security policy, business rules, transactions, locking, retries, concurrency, and race-sensitive code.

Do not guess through a high-risk conflict. Stop with exact paths, risk, evidence inspected, and current rebase state. Ask for direction only when repository evidence cannot determine intent.

## Safe patterns

- Preserve compatible intent from both sides when the change is additive.
- Prefer a targeted edit over a repository-wide replacement.
- Re-run focused tests for affected behavior before continuing.
- Check whether a migration is already applied or whether the repository uses a strict sequence.
- Keep conflict resolution in the skill-owned working branch; do not resolve by pushing a partial tree.

## Unsafe patterns

Never resolve globally with git checkout --ours . or git checkout --theirs .. Never reset, clean, delete files, drop commits, or use a resolution that cannot explain which behavior it preserves. Do not mark a conflict resolved merely because conflict markers disappeared.
