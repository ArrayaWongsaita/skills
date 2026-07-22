# Context Routing

Use this reference when designing conditional instructions or reducing active context.

## Loading order

Start with:

1. Current task contract or user request.
2. Nearest applicable instructions and broader inherited instructions.
3. Relevant source and tests.
4. Directly relevant approved spec or public contract.
5. ADRs identified by area or identifier.
6. Conditional rules activated by task type or risk modifier.
7. Incidents and lessons whose applicability metadata matches the work.

Do not read every ADR, incident, lesson, skill reference, or document tree. Do not repeatedly reload unchanged material.

## Route contract

Every route must state:

```text
Trigger | Required document | Required workflow | Required verification | Escalation condition
```

Example:

```markdown
For authentication, authorization, payment, upload, webhook, administrative,
tenant-isolation, or sensitive-data work, read [Security](docs/agent-rules/security.md)
before planning or modifying code; complete its threat review and security checks,
and escalate unresolved trust-boundary or approval questions.
```

A bare link is not routing. Use verbs such as `read`, `classify`, `verify`, and `obtain approval`.

## Routing quality

- Make triggers observable from the task, affected paths, or declared risk modifiers.
- Route to one authoritative document per concern where practical.
- Keep critical approval rules in always-loaded instructions and repeat only concise prevention statements when essential.
- Prefer task-type plus independent risk modifiers over one overloaded taxonomy.
- Include negative routing: ordinary CRUD or local changes do not trigger full system design unless an architecture trigger is present.
- Validate target paths and anchors.
