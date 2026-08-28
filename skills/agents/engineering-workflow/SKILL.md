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

Use progressive preflight. At startup establish only current reality:

1. Locate the repository root and read applicable repository/agent
   instructions plus basic project identity.
2. Use `workflow_state.py list`/`status` to discover resumable state. For a
   resume, reconcile that state with Git/worktree and its referenced artifacts;
   do not restart discovery when `IMPLEMENTATION` remains valid.
3. Inspect Git/working-tree state when available. Preserve existing changes.
4. Classify a new request using the user request and repository facts. Read
   [routing](references/routing.md) only as much as classification needs, then
   read only the selected flow reference.
5. Audit the dependency required for the immediate next stage, plus its
   declared hard transitive children. Do not audit every later or conditional
   dependency at startup. Read [dependency rules](references/dependencies.md)
   when dependency resolution or installation is active.

Do not eagerly load every ADR, the full domain glossary, tracker/test
configuration, all specifications, previous reviews, unrelated tickets,
post-mortems, or every repository guideline. Load an artifact when the current
stage or immediate gate requires it.

When a required dependency is missing, disabled, ambiguous, incompatible, or
provenance-mismatched, stop before its stage. Show owner, repository, role,
evidence, scope, and an exact command verified against the active installer.
Detection never installs. The dependency registry stores repository/source,
not permanent CLI syntax: verify installer syntax and scope only after a
missing dependency makes installation relevant, then ask explicit permission.
If declined, persist `BLOCKED_DEPENDENCY`. If approved, perform only the
approved install and re-audit before resuming the paused stage. An unrelated
continuation message is not approval.

Distinguish installed files from repository bootstrap. Check
`setup-matt-pocock-skills` only when the current downstream Matt skill's
contract requires configuration that is absent. Ask before setup and do not
run it once per workflow.

## Stage-scoped context

Load only the context necessary for the current stage and immediate gate:

| Stage | Smallest sufficient context |
|---|---|
| `DISCOVERY` | request, project instructions, and only relevant domain docs |
| `SPECIFICATION` | discovery output, relevant vocabulary/ADRs, and architecture at the affected seam |
| `IMPLEMENTATION` | current ticket, parent spec, relevant ADRs, code, tests, and local conventions |
| `CODE_REVIEW` | approved ticket/spec, fixed-point diff, relevant standards, and test evidence |
| `SYSTEM_REVIEW` | implemented path, surrounding contracts/failure paths, and design/spec context |

Do not load unrelated tickets, historical reviews, post-mortems, all test
files, or all external skill definitions. Inspect an external `SKILL.md` on
first validation, provenance/content change, uncertain invocation, or a real
compatibility check; reuse an unchanged resolution during the session.

Cache the resolved script path/interface version, dependency registry version,
runtime capabilities, and audited dependency identity for the current session.
Do not probe them repeatedly without evidence of change. On a new-session
resume, validate only facts that may have changed.

For `dependencies`/`skills`, report the registry, owner, repository, role,
category, install source, verified installation method when known, and
`INSTALLED`/`MISSING`/`NOT_CHECKED` status.
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
for the missing child unless the active installer was verified to resolve that
exact transitive dependency safely.

If provenance is absent, write `Source: UNKNOWN / requires verification`.
Never present an invented command or attribute an installed skill to an owner
without evidence.

## Script interfaces

Interfaces are defined here. Do not execute `--help` during normal workflow
operation when this contract is present and the command behaves accordingly.
Use `--help` only for a missing/disagreeing contract, an argument-mismatch
failure, an unexpected script/schema version, or debugging this skill itself.

`dependency_audit.py` is `READ_ONLY` and never installs or updates anything:

```text
python3 <skill>/scripts/dependency_audit.py
  --runtime <codex|claude>
  [--search-root <path>]...
  (--require <skill>... |
   --workflow-type <FEATURE|BUG|LARGE_PROJECT> [--stage <stage>] [--stage-mode <RESEARCH|PROTOTYPE>] |
   --inventory)
  [--risk <LOW|MEDIUM|HIGH|CRITICAL>]
  [--uncertainty <LOW|MEDIUM|HIGH|CRITICAL>]
  [--characteristic <name>]... [--reduced] [--incident]
  [--has-subagents] [--orchestrator-skill <SKILL.md>]
  [--repository-root <path>] [--require-repository-setup]
```

Use `--workflow-type` plus the immediate `--stage`; omitting `--stage` audits
only that type's entry stage. Use repeated `--require` only for an explicitly
selected dependency (including a dependency activated later). `--inventory`
is for the explicit `dependencies`/`skills` command, never startup. Output is
one JSON audit object. Exit `0` means the requested stage dependencies resolve;
exit `2` means audit/compatibility/usage issues are present. A missing install
proposal contains canonical source intent but no trusted command until the
active installer is verified on demand. Expected issue codes include
`MISSING_DEPENDENCY`, `DISABLED_DEPENDENCY`, `AMBIGUOUS_DEPENDENCY`,
`PROVENANCE_MISMATCH`, `SUBAGENT_CAPABILITY_REQUIRED`,
`REPOSITORY_SETUP_REQUIRED`, and `INVOCATION_POLICY_INCOMPATIBLE`.

`workflow_state.py` uses the global prefix
`python3 <skill>/scripts/workflow_state.py [--root <repository>] <subcommand>`.
Its JSON output is a compact state object/list. Exit `0` is success; exit `2`
is a JSON `WorkflowStateError` such as invalid state, transition, or revision
conflict.

`READ_ONLY` subcommands:

```text
list [--include-complete]
status [<workflow-id>]
```

`MUTATING` state subcommands:

```text
init <request> [--type <FEATURE|BUG|LARGE_PROJECT>] [--parent <id>]
reconstruct <id> <request> [--type <FEATURE|BUG|LARGE_PROJECT>]
transition <id> <target> [--mode <stage-mode>] --reason <text>
classify <id> <type> <risk> <uncertainty> --scope <text> [--characteristic <name>]... [--incident]
block <id> <code> <message> [--owner <owner>]
unblock <id> --reason <text>
register-artifact <id> <kind> <relative-path> <producer-stage>
set-work-item <id> <reference>
set-mitigation <id> <outstanding|resolved> --reason <text>
record-dependencies <id> <audit-json-path>
add-child <id> <child-id>
verify <id> [--command-json '<JSON argv array>']...
gate <id> <design|code|system> [--blocker <finding>]...
scrutinize <id> <design|system> <verdict> [finding/progress options]
request-installation <id> <dependencies-json> <verified-proposals-json> --needed-at <stage> --reason <text>
installation-decision <id> <approved|declined> --reason <text>
reconcile [<id>] [--run-checks]
```

`scrutinize` progress options are repeated `--blocking-finding`,
`--new-finding`, `--resolved-finding`, `--repeated-finding`, and
`--changed-artifact`, plus optional `--reason-for-retry`, `--review-ref`, and
`--no-progress`. `request-installation` rejects proposals without a verified
exact command, explicit scope, and `requiresApproval=true`. `verify` executes
the stored/provided argv commands. `reconcile` may persist a rewind; neither is
read-only.

Read local files with the runtime's file APIs when possible instead of using
shell commands for simple Markdown/JSON lookup. These `READ_ONLY`/`MUTATING`
labels guide behavior only; they do not bypass or predict runtime security
prompts. Installation/setup is `EXTERNAL_MUTATION` and always requires explicit
permission.

If a helper fails, do not retry blindly. Report its purpose, failure class and
exit evidence, whether current state is trustworthy, and whether safe
read-only inspection can continue. Never proceed using stale state after an
unexplained state/audit failure.

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

Before each stage, inspect only that stage's heading in
[states](references/states.md) and the relevant artifact entry in
[artifacts](references/artifacts.md); do not load either reference wholesale
when a targeted lookup suffices.

1. Confirm entry conditions and referenced artifact fingerprints. Audit the
   immediate stage dependency if its cached resolution is absent or stale.
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
is selected. `references/state-machine.json` is the canonical executable
transition source consumed by `workflow_state.py`; Markdown explains semantics
without maintaining another transition table. `data/dependencies.json` is the
canonical dependency registry consumed by `dependency_audit.py`.
`references/workflow-state.schema.json` validates persisted state shape.
