---
name: engineering-workflow
description: Explicitly route a feature, bug, incident, or large engineering effort through installed specialist skills, durable state, evidence gates, bounded review loops, and resumable transitions. Route composite multi-stage workflows; use specialist skills directly for isolated single-discipline requests or status queries.
disable-model-invocation: true
---

# Engineering Workflow

Control plane for multi-stage engineering requests. Classify requests, discover
route dependencies, sequence stages, enforce quality gates, persist durable state,
apply Reality reconciliation on resume, and guide outcomes to completion. Installed
specialist skills retain sole ownership of discovery, specification, vertical planning,
implementation, diagnosis, design review, code review, research, prototypes, wayfinding,
and post-mortems.

## Invocation

This skill is explicit-only:

- Universal / Slash command: `/engineering-workflow <request>`
- Codex: `$engineering-workflow <request>`
- Script / CLI: `python3 scripts/workflow_state.py init "<request>"`
- Commands: `<request>`, `continue [workflow-id]`, `status [workflow-id]`, `list`, and `dependencies`/`skills`

Codex policy is declared in `agents/openai.yaml`. Claude Code installations require
`disable-model-invocation: true` or `skillOverrides.<name> = "user-invocable-only"`.
If neither control is effective, stop with `INVOCATION_POLICY_INCOMPATIBLE`. Require
explicit human invocation before starting or continuing the workflow.

## Purpose and Principles

Produce the smallest safe, evidence-backed path from request to validated outcome.
Preserve user intent, repository conventions, approvals, and existing worktree changes.

Execute commits, branch pushes, pull requests, deployments, tracker mutations, or
destructive operations only when explicitly requested by the user. Treat external
skills as package-like dependencies that retain full ownership of their specialist
methods. When the runtime limits direct model invocation, record `USER_INVOCATION_REQUIRED`
and hand off the dependency's exact command to the user. Halt cleanly on `BLOCKED` states
with clear resumption guidance.

## Core Disciplines

1. **Control Plane Ownership**: The orchestrator alone directs classification, transitions,
   bounded loops, durable state, Reality reconciliation, and completion.
2. **Compact State & Atomic CAS**: Persist lightweight metadata, gate counters, and
   fingerprinted artifact references via Atomic CAS (`workflow_state.py`), storing full
   specifications, tickets, and review bodies in repository files.
3. **Audited Specialist Resolution**: Resolve every specialist from audited filesystem
   installations and qualified plugin namespaces, preserving external skill contracts.
4. **Explicit Mutation Approvals**: Require explicit user permission before executing network
   operations or dependency installations, installing only verified missing dependencies.
5. **Separate Gate Budgets**: Enforce independent Gate budgets: `MAX_SCRUTINIZE_CYCLES = 6`
   separately for design review and system review; 3 cycles for code review.
6. **Blocking Quality Gates**: Advance past design or system review only upon a normalized
   `SHIP` verdict within the allotted Gate budget.
7. **Invariant-Targeted Fixes**: Target fixes directly at the verified finding or broken
   invariant, recording concise progress in cycle history.
8. **Stabilization vs. Resolution**: Apply minimal, reversible, observable emergency
   mitigations during active incidents; require root-cause confirmation and regression
   verification before marking a workflow `COMPLETE`.
9. **Smart Zone & Phase Boundaries**: Maintain peak reasoning in the Smart Zone by scoping
   context per stage. Execute multi-ticket implementation via transient subagents (`self`) when
   supported; establish explicit Phase Boundaries (`/clear`) before implementation in single-session runtimes.
10. **Reality Reconciliation**: On resume, verify state claims against Git status, working
    tree, and artifact fingerprints, rewinding to the earliest invalidated producer stage
    when reality drifts.

## Preflight and Progressive Discovery

Operate progressively, establishing current reality at startup:

1. Locate the repository root and inspect repository/agent instructions plus project identity.
2. Query `workflow_state.py list`/`status` to discover active workflows. On resume (`continue`),
   apply Reality reconciliation against Git refs, working-tree changes, and artifact hashes,
   keeping valid downstream stages intact.
3. Inspect Git and working-tree state, preserving existing local changes.
4. Classify new requests using repository facts and user intent. Consult [routing](references/routing.md)
   and the matching flow reference ([feature-flow](references/feature-flow.md), [bug-flow](references/bug-flow.md),
   or [large-project-flow](references/large-project-flow.md)).
5. Audit the dependency required for the immediate next stage, plus its declared hard transitive
   children, using `scripts/dependency_audit.py`. Read [dependency rules](references/dependencies.md).
   For normal Feature Discovery, audit `grill-with-docs` and its support skills (`grilling` and `domain-modeling`).
6. When a required dependency is missing, disabled, ambiguous, incompatible, or provenance-mismatched,
   pause before that stage. Report owner, repository, role, evidence, scope, and verified install
   command. Request explicit permission; perform read-only detection during audits. If declined,
   persist `BLOCKED_DEPENDENCY`. If approved, execute only the approved installation and re-audit
   before resuming the paused stage.
7. Verify repository bootstrap (`setup-matt-pocock-skills`) once when required by downstream contracts
   and configuration is absent.

For `dependencies`/`skills`, report the registry, owner, repository, role, category, install source,
and `INSTALLED`/`MISSING`/`NOT_CHECKED` status in read-only mode without triggering mutations.

## Stage-Scoped Context in the Smart Zone

Preserve the agent's Smart Zone by scoping context strictly to the immediate stage and gate:

| Stage | Smallest Sufficient Context |
|---|---|
| `DISCOVERY` | request, project instructions, relevant domain glossaries and ADRs |
| `SPECIFICATION` | discovery output, domain vocabulary, seam architecture |
| `PLANNING` | approved specification, issue tracker configuration |
| `IMPLEMENTATION` | tracer-bullet ticket, parent spec, relevant ADRs, local code/tests |
| `CODE_REVIEW` | approved ticket/spec, fixed-point diff, test evidence, repository standards |
| `SYSTEM_REVIEW` | executed runtime path, concurrency/retry boundaries, failure contracts |

Load artifacts on demand as required by the active stage. Retain cached dependency and script
resolutions during the active session, re-auditing only upon file modifications or new-session resumption.

## Classify and Route

Transition `IDLE -> CLASSIFYING`. Record:

- `workflowType`: `FEATURE`, `BUG`, or `LARGE_PROJECT`
- `incidentSubtype`: `INCIDENT` only for production-impacting defects
- scope, `risk`, `uncertainty`, and observable `changeCharacteristics`

Apply deterministic routing from [routing](references/routing.md). Small features with LOW risk,
LOW uncertainty, and stable architecture follow the reduced route (`DISCOVERY -> IMPLEMENTATION -> CODE_REVIEW -> COMPLETE`).
Bugs begin with `diagnosing-bugs`. Large projects begin with `wayfinder` and coordinate bounded
child feature workflows.

## Stage Execution and State Management

Consult the stage contract in [states](references/states.md) and artifact conventions in
[artifacts](references/artifacts.md):

1. Verify entry conditions and artifact fingerprints. Audit the immediate stage dependency if not cached.
2. Invoke the audited specialist or provide the real command for user-only skills (`USER_INVOCATION_REQUIRED`).
   Disclose declared side effects (e.g. `implement` commits) and obtain explicit user approval before execution.
3. Normalize the specialist outcome into a compact stage record and register stable artifact references.
4. Evaluate exit conditions. The orchestrator alone determines stage transitions and failure routings.
   When a backward transition requires a conditional dependency, pause and verify permissions before proceeding.
5. Persist state transitions via Atomic CAS (`workflow_state.py`), ensuring updates apply to the active revision.

Use `stageMode` for `REGRESSION_TEST`, `FIX`, `REVIEW_FIX`, `EMERGENCY_MITIGATION`, `BOUND_FEATURES`,
`RESEARCH`, and `PROTOTYPE`.

## Quality Gates and Gate Budgets

Normalize review findings using [gate rules](references/gates.md). Design and system `scrutinize`
outcomes map to `SHIP`, `FIX_THEN_SHIP`, `REWORK`, or `REJECT`. Completed reviews increment cycle
counters and record compact progress (`newFindings`, `resolvedFindings`, `repeatedFindings`, changed artifacts).

Enforce independent Gate budgets:

- **Design Review Gate**: Bounded by `MAX_SCRUTINIZE_CYCLES = 6`.
  - `SHIP`: Closes the design gate and advances to `PLANNING` (`to-tickets`).
  - `FIX_THEN_SHIP`: Applies minimal verified fixes to spec/design and re-reviews.
  - `REWORK`: Returns to `SPECIFICATION` or `EXPLORATION` without resetting cycle counts.
  - `REJECT`: Returns to `DISCOVERY` or explicit human/product decision.
  - Early stop: Halt with `BLOCKED` (`SCRUTINIZE_NO_PROGRESS`) when progress stalls across revisions.
  - Budget exhaustion: Transition to `BLOCKED` (`GATE_BUDGET_EXHAUSTED`) on cycle 6 non-`SHIP`.
    A fresh 6-cycle budget requires explicit human authorization for a materially new solution.
- **Code Review Gate**: Bounded by a 3-cycle Gate budget across standards and specification axes.
  Blocking findings return to `IMPLEMENTATION[REVIEW_FIX]`. Passing review advances to `SYSTEM_REVIEW`,
  `POST_MORTEM`, or `COMPLETE`.
- **System Review Gate**: Traces end-to-end execution paths for high-risk changes under an independent
  6-cycle Gate budget. Fixes return through tests/typechecks and code review before re-review.

Classify findings as blocking only when backed by spec mismatches, functional defects, missing tests,
or documented standard violations with concrete consequences.

## Reality Reconciliation, Resume, and Completion

- **Resume (`continue`)**: Apply Reality reconciliation across schema revision, Git refs, working-tree
  state, and artifact fingerprints. Re-run verification commands. Rewind state to the earliest
  invalidated producer stage when discrepancies are detected. Re-audit dependencies after approved installations.
- **Status (`status`)**: Report ID, workflow type, stage, mode, status, gate counts, active item, and blockers compactly.
- **List (`list`)**: Display active workflows, hiding `COMPLETE` unless `--include-complete` is requested.
- **Completion (`COMPLETE`)**: Retain state at `.agents/workflows/<id>.json`. Mark `COMPLETE` only when
  all required gates pass, validation matches current reality, blockers are cleared, mitigations are resolved,
  and all child workflows are complete.

For detailed architecture and script interfaces, see [architecture](references/architecture.md).
Canonical transitions and state schemas live in `references/state-machine.json` and `references/workflow-state.schema.json`.
