# Routing

Classify from repository facts and observed behavior, not keywords alone.

## Workflow type

- `BUG`: an existing expectation is violated. Set `incidentSubtype=INCIDENT`
  only when production users, money, security, data integrity, or critical
  availability are currently affected.
- `LARGE_PROJECT`: the destination contains several independently valuable
  bounded features or cannot fit one safe implementation/review loop.
- `FEATURE`: one bounded behavior change that fits one delivery loop.

## Risk and uncertainty

Risk is consequence if wrong. Raise it for money movement, authorization,
privacy, irreversible data changes, public contracts, distributed retries,
concurrency, migrations, or broad blast radius. Uncertainty is missing
knowledge.

Route uncertainty by kind:

- product/domain intent: `DISCOVERY` through `grill-with-docs`;
- current external fact/API behavior: `EXPLORATION[RESEARCH]` through `research`;
- UI/client-state or empirical interaction question: `EXPLORATION[PROTOTYPE]`
  through `prototype`;
- unclear seam or vocabulary: consult `codebase-design` without replacing the
  stage's owning external skill.

`research` and `code-review` require the subagent capability required by their
installed contracts. Missing capability is `BLOCKED`, never an ad-hoc
substitute.

## Feature

Normal route:

```text
CLASSIFYING -> DISCOVERY(grill-with-docs) -> EXPLORATION? ->
SPECIFICATION(to-spec) -> DESIGN_REVIEW(scrutinize) ->
PLANNING(to-tickets) -> IMPLEMENTATION(implement) ->
CODE_REVIEW(code-review) -> SYSTEM_REVIEW(scrutinize, high risk only) -> COMPLETE
```

Check only the dependencies reachable by the current route. `grill-with-docs`
is required now for a normal feature; `to-spec`, `scrutinize`, `to-tickets`,
`implement`, and `code-review` are required later at their stages. Conditional
skills are checked only when evidence routes to them.

Design `SHIP` advances to `PLANNING`; `FIX_THEN_SHIP` identifies and fixes the
verified finding in the spec/design, then reviews again; `REWORK` returns to
specification or exploration; `REJECT` returns to discovery or an explicit
human/product decision. Every completed scrutinize review increments the
design gate's independent counter. The gate has a hard maximum of six cycles,
and no blocker advances automatically.

If a review finds unresolved empirical uncertainty, pause at the backward
transition, check `prototype` or `research`, and request permission only if
that dependency is missing. Installation resumes from the paused state and
does not restart discovery.

Reduced route:

```text
DISCOVERY(lightweight alignment + acceptance/spec artifact) ->
IMPLEMENTATION(implement) -> CODE_REVIEW(code-review) -> COMPLETE
```

Use it only for LOW risk/LOW uncertainty, one known local seam, explicit
acceptance behavior, and no architecture, abstraction, assumption, system,
or cross-system failure-mode change.

## Bug and incident

```text
CLASSIFYING -> DIAGNOSIS(diagnosing-bugs) ->
IMPLEMENTATION[REGRESSION_TEST/FIX](implement or diagnosis handoff) ->
CODE_REVIEW(code-review) -> SYSTEM_REVIEW(scrutinize, when required) ->
POST_MORTEM(post-mortem only when its installed contract accepts this case) -> COMPLETE
```

Diagnosis must establish a red-capable feedback loop, confirmed root cause,
and regression evidence. An active incident may use a human-approved,
minimal/reversible/observable `EMERGENCY_MITIGATION`, then returns to diagnosis;
mitigation never completes the workflow. The installed 9arm post-mortem
contract at the audited baseline explicitly rejects customer-visible
incidents, so such an incident is `BLOCKED` until a compatible external
incident-record skill is installed or the user supplies a compatible provider.

For high/critical or system-sensitive bugs, the final system scrutinize gate has
its own six-cycle counter. After a fix found by system scrutinize, run tests or
typecheck, then `code-review`, before returning to system review.

## Large project

```text
CLASSIFYING -> WAYFINDING(wayfinder) ->
EXPLORATION[RESEARCH|PROTOTYPE]? -> PLANNING[BOUND_FEATURES](to-tickets when needed)
-> child FEATURE workflows -> re-WAYFINDING on assumption change -> COMPLETE
```

The parent never jumps directly from discovery/planning to implementation. It
completes only after every bounded child is complete and the destination still
matches the wayfinder map.

## Requirement drift

- clarification consistent with approved behavior: update the current artifact;
- behavior change before implementation: return to specification;
- change invalidating reviewed design/code: return to the relevant review;
- independently valuable or unrelated request: initialize a new workflow.

Never silently widen the active scope.
