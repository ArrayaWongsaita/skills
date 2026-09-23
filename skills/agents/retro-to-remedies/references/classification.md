# Classification, Destinations, and Ranking

Stage 1 transforms extracted Misses into actionable environment Remedies. Every proposal follows deterministic classification rules, enforces a strict evidence bar, and ranks items by cost and recurrence.

## Remedy Kinds

Every Remedy belongs to exactly one kind. The classification enforces a strict Text remedy versus Code remedy split:
- Text remedy (Standard, Pointer, Prune): Applied directly by the Retro onto the branch.
- Code remedy (Check, Skill fix, Access): Handed off as ready-to-run `/grill-to-tickets` prompts.


## The Ordered Rule

Classify each Miss by the first matching rule in the following order:

1. **Skill fix**: Following a skill's instructions as written produced the Miss, because they are wrong or outdated. An agent that departed from correct instructions falls to the rules below instead (most often a Check that makes the departure fail fast).
2. **Check**: A fixed rule could have caught it (Mechanical miss) — such as a syntactic pattern, a banned API, an import shape, or a file-location rule.
3. **Standard**: It needed a reader of intent (Judgement miss) — recorded in `CODING_STANDARDS.md`, or a Reuse Catalog Rule for a reuse convention.
4. **Pointer**: The agent spent navigation effort finding a document or file.
5. **Access**: The agent lacked unreachable information it could not reach (such as server logs or credentials).
6. **Prune**: A project instruction had no effect or has gone stale.

## Destinations

| Remedy kind | Destination |
| --- | --- |
| Check | handed off: test, lint rule, hook, or CI job in the project |
| Standard | `CODING_STANDARDS.md` (created when absent); reuse conventions in the Reuse Catalog's Rules |
| Pointer | `AGENTS.md`, else `CLAUDE.md`, else a new `AGENTS.md` |
| Skill fix | handed off: own library → `/grill-to-tickets` prompt; other source → Upstream feedback |
| Prune | the project instruction file holding it: `AGENTS.md`, `CLAUDE.md`, `CODING_STANDARDS.md`, or the Reuse Catalog's Rules (an instruction inside a skill is a Skill fix) |
| Access | handed off: config or tooling in the project |

Prune is limited strictly to project instruction files (`AGENTS.md`, `CLAUDE.md`, `CODING_STANDARDS.md`, and the Reuse Catalog's Rules). An instruction inside a skill is a Skill fix.

## Evidence Bar and Merging

- **Evidence Bar**: Every Remedy must cite at least one located, quoted Primary source (file plus id, line, or commit SHA, and verbatim quote). Any proposal without evidence is dropped.
- **Merge Same-Cause Misses**: Merge Misses that share a cause into one Remedy. List causes, not symptoms.

## Ranking Order

Remedies are ranked in priority order: Failed Remedy first, then recurring, then the cost ranking (costly misses), then the rest:
1. **Failed Remedy**: Escalated from a prior applied Remedy whose Miss recurred.
2. **Recurring Remedy**: A Remedy matching prior entries in `docs/retro-log.md`.
3. **Costly Misses** (the cost ranking):
   - Review blockers (`blocker`)
   - Implementer blocked tickets (`BLOCKED`)
   - Implementer failed verification attempts
   - Design review cycles that ended without `SHIP`
4. **The rest of the Remedies**

## Carried Findings and Open Bugs

- **Carried findings**: Each non-blocking finding left open in `review-status.md` is treated as a Miss, mapped to a Remedy or a proposed decline with explicit rationale. None are silently carried again.
- **Open bugs**: A defect in the feature's own code is reported for `/diagnosing-bugs` and never as Remedies. Remedies change the Environment only, leaving feature code intact.
