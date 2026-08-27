---
name: engineering-workflow
description: Explicitly route a feature, bug, incident, or large engineering effort through installed specialist skills, durable state, evidence gates, bounded review loops, and resumable transitions. Do not use for one isolated discipline or a status-only question.
---

# Engineering Workflow

Own the control plane for an engineering request. Classify it, discover the
external specialist dependencies needed by the selected route, choose stages,
persist state, enforce gates, reconcile reality on resume, and decide when the
workflow is blocked or complete. Installed specialist skills remain the source
of truth for discovery, specification, planning, implementation, diagnosis,
design, review, research, prototypes, wayfinding, and post-mortems.

## Invocation

This skill is explicit-only:

- Codex: `$engineering-workflow <request>`
- Claude Code: `/engineering-workflow <request>`
- Commands: `<request>`, `continue [workflow-id]`, `status [workflow-id]`,
  `list`, and `dependencies`/`skills`

Codex policy is declared in `agents/openai.yaml`. A Claude Code installation
must set `disable-model-invocation: true` on this skill or the equivalent
`skillOverrides` value `user-invocable-only`. If neither control is effective,
stop with `INVOCATION_POLICY_INCOMPATIBLE`; never allow implicit orchestration.

## Purpose and non-goals

Produce the smallest safe, evidence-backed path from request to validated
outcome. Preserve user intent, repository conventions, approvals, and existing
worktree changes.

Do not commit, push, open or merge a pull request, deploy, mutate an external
tracker, or perform a destructive operation unless the user separately asks
for that action. Do not turn `BLOCKED` into a guessed fallback. Do not copy or
reimplement an external skill. External skills are package-like dependencies,
not templates. If the runtime cannot invoke a dependency, record the exact
limitation and hand the user the dependency's real command.

## Invariants

1. This orchestrator alone owns classification, transitions, loops, state,
   resume, and completion.
2. Persist only compact state and artifact references, never full specs,
   tickets, reviews, or reports.
3. Invoke or hand off to the resolved external skill with artifact references
   plus only the repository context needed for its stage. Normalize its result
   into state; do not impose a new protocol on the dependency.
4. Resolve every specialist from audited installed files. Never rely only on a
   model-visible skill list or a bare colliding name.
5. Require human approval before any network or installation mutation. Install
   only missing dependencies; never update, replace, or remove an existing
   dependency implicitly.
6. Keep gate budgets separate. `MAX_SCRUTINIZE_CYCLES` is 6 independently for
   design and system scrutinize; code review retains its separate three-cycle
   budget.
7. `scrutinize` is a blocking quality gate. No design or system gate passes
   without a normalized `SHIP` result, and no automatic cycle 7 exists.
8. Fix the verified invariant/finding, not a suggested implementation blindly.
   Preserve concise cycle history and progress evidence, not full reports.
9. Emergency mitigation must be minimal, reversible, and observable. It can
   never make a workflow `COMPLETE` before root cause and fix validation.
10. Continue through safe work boundaries. Use `BLOCKED` only when proceeding
   would be unsafe or a required human/runtime capability is absent.

## Preflight

1. Locate the repository root and read applicable repository instructions,
   conventions, task/tracker configuration, domain glossary, ADRs, tests, and
   working-tree state.
2. Read [routing](references/routing.md) for a new request or
   [state contracts](references/states.md) for resume/recovery. Read the
   matching flow reference only when its branch is selected.
3. Determine route dependencies. Classify each as `REQUIRED_NOW`,
   `REQUIRED_LATER`, `CONDITIONAL`, `TRANSITIVE`, or `OPTIONAL`; then run
   `scripts/dependency_audit.py` against only the dependencies reachable by the
   current route. The audit expands verified hard transitive children. For a
   normal Feature Discovery, that means `grill-with-docs` plus its required
   `grilling` and `domain-modeling` support skills; support skills are never
   separate workflow stages. Read [dependency rules](references/dependencies.md).
4. When a required dependency is missing, disabled, ambiguous, incompatible, or
   provenance-mismatched, stop before its stage. Show owner, repository, role,
   evidence, scope, and the verified install command. Ask explicit permission;
   never install during detection. Group compatible missing installs into one
   request. If declined, persist `BLOCKED_DEPENDENCY`. If approved, the
   runtime may perform only the approved install, then must re-audit before
   resuming; do not silently continue or restart discovery.
   Treat only an explicit approval such as “yes”, “install it”, or “go ahead”
   as permission; an unrelated continuation message is not approval.
5. Distinguish installed skill files from repository bootstrap. If a Matt
   Pocock skill requires `setup-matt-pocock-skills` and repository configuration
   is absent, report `Repository setup: MISSING` and ask before running setup.
   Do not run setup repeatedly.
6. Initialize or select state with `scripts/workflow_state.py`. Reuse a matching
   incomplete workflow. If more than one active workflow exists and no ID is
   supplied, ask the user to choose once.

For `dependencies`/`skills`, report the registry, owner, repository, role,
category, installation method, and `INSTALLED`/`MISSING`/`NOT_CHECKED` status.
Inventory is read-only and never triggers installation.

Use this compact presentation before asking for installation:

```text
Missing Skill

Skill: <name>
Purpose: <role>
Owner: <owner>
Repository: <repository>
Needed At: <stage>
Installation: <verified exact command, or manual instructions>
Install Scope: <project-local|user/global|unknown>
Permission Required: Yes
```

For a missing transitive dependency, show the installed parent, the missing
child, `Required by`, owner, repository, and the same verified command and
permission request. For example, if `grill-with-docs` is installed but
`domain-modeling` is missing, do not report Discovery as ready. Ask permission
for the missing child because the current Skills CLI does not install skill
dependencies automatically.

If provenance is absent, write `Source: UNKNOWN / requires verification`.
Never present an invented command or attribute an installed skill to an owner
without evidence.

## Classify and route

Move `IDLE -> CLASSIFYING`. Record:

- `workflowType`: `FEATURE`, `BUG`, or `LARGE_PROJECT`
- `incidentSubtype`: `INCIDENT` only for a production-impacting bug
- scope, `risk`, `uncertainty`, and observable `changeCharacteristics`

Use the deterministic decision order in [routing](references/routing.md). A
small feature may use the reduced path only when risk and uncertainty are LOW
and architecture, abstractions, and assumptions remain unchanged. A bug begins
with the installed `diagnosing-bugs` skill. A large outcome begins with the
installed `wayfinder` skill and creates bounded child feature workflows rather
than copying child state.

## Execute a stage

Before each stage, read that stage's contract in
[states](references/states.md) and the relevant artifact convention in
[artifacts](references/artifacts.md).

1. Confirm entry conditions and referenced artifact fingerprints.
2. Invoke the named audited specialist. For Claude plugin skills use the
   resolved namespace such as `mattpocock-skills:code-review` or
   `9arm-skills:scrutinize`; for Claude user-only skills stop with a
   `USER_INVOCATION_REQUIRED` handoff. For Codex use the exact audited path
   when the audit returns `codex_load_path`; if its policy returns
   `user_handoff`, show the real `$skill-name` invocation and resume later.
   Before a model-loaded dependency with declared side effects runs, obtain
   explicit approval for those effects (for example, `implement` commits).
   A user-only handoff is the user's own invocation and must still disclose
   the dependency's side effects.
3. Normalize the specialist result into a compact stage record and register
   stable artifact and evidence references.
4. Check exit conditions and apply the stage's failure transition. The
   specialist cannot select the next stage. If a backward transition requires
   a conditional dependency, pause there and run the same permission-gated
   dependency check; do not substitute a sibling skill.
5. Persist through atomic compare-and-swap. Never overwrite a newer revision.

Use `stageMode` for `REGRESSION_TEST`, `FIX`, `REVIEW_FIX`,
`EMERGENCY_MITIGATION`, `BOUND_FEATURES`, and exploration modes `RESEARCH` or
`PROTOTYPE`.

## Gates

Normalize review findings using [gate rules](references/gates.md). Design and
system `scrutinize` outcomes map to `SHIP`, `FIX_THEN_SHIP`, `REWORK`, or
`REJECT`. A cycle is counted only after an actual scrutinize review completes;
editing between reviews does not consume a cycle. Persist
`designScrutinizeCycles`, `systemScrutinizeCycles`, and compact per-cycle
progress (`newFindings`, `resolvedFindings`, `repeatedFindings`, changed
artifacts, retry reason, and review reference).

Design review is blocking and has its own hard maximum of 6:

- `SHIP` closes the design gate and proceeds to `to-tickets`.
- `FIX_THEN_SHIP` applies the smallest verified fix to the spec/design and
  runs scrutinize again.
- `REWORK` returns to the stage responsible for the failed assumption, usually
  `SPECIFICATION` or `EXPLORATION`, without resetting the design counter.
- `REJECT` returns to `DISCOVERY` or an explicit human/product decision; it is
  not converted into a local patch.

Stop early with `BLOCKED` when progress is demonstrably absent. Otherwise a
non-`SHIP` result on cycle 6 is `BLOCKED`; never execute cycle 7. A human may
explicitly authorize a materially new solution as a fresh review series.

For high/critical or system-sensitive changes, final system scrutinize follows
`implement -> code-review -> SYSTEM_REVIEW`. Its six-cycle counter is
independent. After a final-scrutinize fix, always return through tests/typecheck
and `code-review` before system scrutinize again. A system `REWORK` returns to
specification/design and then repeats implementation and review; it does not
force a local patch.

Code blockers remain observed behavior/spec mismatches or documented-standard
violations with a concrete consequence, not consequence-free style preferences.

## Resume, block, and complete

For `continue`, validate schema and revision, fingerprints, Git refs and
worktree, then rerun verification claimed by state. Reality wins: rewind to the
earliest invalidated producer stage and record why. If state is missing but
artifacts are unambiguous, reconstruct references without duplicating files.
When a dependency install was approved, resume only after the installer has
completed and a fresh audit verifies the expected skill/source; a permission
record alone never unblocks the workflow. Preserve gate counters and history
when resuming a retry loop.

For `status`, report ID, type, stage/mode, status, gate counts, current item,
and blocker compactly. For `list`, hide `COMPLETE` unless explicitly requested.

Keep completed state at `.agents/workflows/<slug>.json` for audit and
idempotency. Mark `COMPLETE` only after required gates pass, validation evidence
still matches the repository, no blocker remains, and every bounded child of a
large project is complete.

Read [feature-flow](references/feature-flow.md), [bug-flow](references/bug-flow.md),
or [large-project-flow](references/large-project-flow.md) only when that route
is selected. The machine-readable graph and schema live in
`references/state-machine.json` and `references/workflow-state.schema.json`.
