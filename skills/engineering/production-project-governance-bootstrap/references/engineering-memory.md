# Engineering Memory

Use engineering memory to preserve reusable repository-specific lessons without loading every incident into every task.

## Minimal structure

Create only the paths justified by recorded lessons:

```text
docs/engineering-memory/
├── README.md
├── index.md
├── known-pitfalls.md
├── lessons/
└── incidents/
```

An index may be enough initially. Do not create empty lesson or incident hierarchies for a small repository.

## Lesson contract

Every reusable lesson records:

- Identifier, status, area, severity, and owner.
- What went wrong and the evidence.
- Root cause and why it was non-obvious.
- Concise preventive rule.
- Strongest practical automated protection.
- Applicability trigger and verification.
- Related incident and superseding lesson when relevant.

Lesson statuses are `Draft`, `Active`, `Superseded`, `Deprecated`, or `Archived`. Active lessons must be indexed. Superseded lessons must point to their replacements.

Record a lesson when the issue recurred, affected production, was costly to diagnose, has a non-obvious or repository-specific cause, affected security/data/migration/deployment, or is likely to be repeated by agents. Do not record typing mistakes, compiler-prevented errors, temporary debug notes, speculation, or trivia.

## Incident-to-guardrail workflow

For a resolved defect or incident:

1. Reproduce the failure.
2. Add a regression test where feasible.
3. Identify the root cause.
4. Apply the smallest safe fix.
5. Verify affected behavior.
6. Decide whether the lesson is reusable.
7. Add the strongest practical guardrail.
8. Update only the appropriate regression test, pitfall, lesson, incident, ADR, runbook, monitoring, or CI rule.
9. Update instruction routing only when future agents must know the prevention rule before related work.

Do not turn every bug into a postmortem. Use incident reports for meaningful production or process failures.

## Context discipline

Keep full evidence in memory and only a concise prevention rule in instructions when always-needed. Route agents by area, trigger, status, and identifier; never require reading every lesson or incident.
