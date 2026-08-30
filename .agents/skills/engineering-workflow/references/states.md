# Stage Contracts

Each contract describes the control-plane boundary. The named discipline is an
installed external skill; it is not implemented in this skill.

## IDLE

- **ENTRY CONDITIONS:** No selected active workflow.
- **INPUT:** User request or command.
- **DISCIPLINE/SKILL:** Orchestrator command parser.
- **OUTPUT:** Selected, reused, or initialized workflow reference.
- **EXIT CONDITIONS:** Request identity and state file are unambiguous.
- **FAILURE TRANSITION:** `BLOCKED` for invalid state; ask once for a selected ID when several workflows are active.
- **NEXT STATE:** `CLASSIFYING`, or the reconciled stage for `continue`.

## CLASSIFYING

- **ENTRY CONDITIONS:** Request and repository scope are known.
- **INPUT:** Request, repository facts, existing artifacts, and production impact.
- **DISCIPLINE/SKILL:** Orchestrator classifier.
- **OUTPUT:** Type, incident subtype, scope, risk, uncertainty, and change characteristics.
- **EXIT CONDITIONS:** Classification is evidence-backed and routeable.
- **FAILURE TRANSITION:** `BLOCKED` for a material choice only the user can make.
- **NEXT STATE:** `DISCOVERY`, `DIAGNOSIS`, or `WAYFINDING` by type.

## DISCOVERY

- **ENTRY CONDITIONS:** Product/domain intent or acceptance behavior is unsettled.
- **INPUT:** Request, relevant context, glossary/ADRs, and artifact references.
- **DISCIPLINE/SKILL:** Installed Matt Pocock `grill-with-docs`; its upstream
  user-only contract calls transitive `grilling` and `domain-modeling`. Use the
  audited runtime load target or record a real user handoff when direct
  invocation is unavailable.
- **OUTPUT:** Shared decisions, acceptance behavior, glossary/ADR references, and open questions.
- **EXIT CONDITIONS:** The decision frontier is settled or each unknown has a typed exploration route.
- **FAILURE TRANSITION:** Stay in discovery, go to `EXPLORATION`, or block for missing human input/dependency.
- **NEXT STATE:** `EXPLORATION`, `SPECIFICATION`, reduced `IMPLEMENTATION`, or `WAYFINDING` only for a large-project parent.

## EXPLORATION

- **ENTRY CONDITIONS:** A bounded unknown prevents a responsible specification.
- **INPUT:** One falsifiable question, constraints, repository seam, and evidence references.
- **DISCIPLINE/SKILL:** Installed `research`, `prototype`, or `codebase-design` selected by uncertainty kind.
- **OUTPUT:** Cited evidence or disposable prototype verdict, never a production implementation.
- **EXIT CONDITIONS:** The unknown is answered or explicitly disproved.
- **FAILURE TRANSITION:** Return to discovery for intent change; block for missing capability/evidence.
- **NEXT STATE:** `SPECIFICATION`.

## WAYFINDING

- **ENTRY CONDITIONS:** A large-project destination or decision frontier is known.
- **INPUT:** Destination, repository facts, prior map, child IDs, and evidence references.
- **DISCIPLINE/SKILL:** Installed user-only `wayfinder`; Claude requires the user to invoke it.
- **OUTPUT:** Decision map, frontier, broken assumptions, and bounded feature candidates.
- **EXIT CONDITIONS:** The next decisions and independently valuable children are ordered.
- **FAILURE TRANSITION:** Stay in wayfinding, visit discovery/exploration, or block for unavailable capability.
- **NEXT STATE:** `PLANNING[BOUND_FEATURES]`, `DISCOVERY`, or `EXPLORATION`.

## SPECIFICATION

- **ENTRY CONDITIONS:** Intent and blocking evidence are settled.
- **INPUT:** Discovery/exploration artifacts, repository contracts, and constraints.
- **DISCIPLINE/SKILL:** Installed user-only `to-spec`; consult installed `codebase-design` when the seam itself is unclear.
- **OUTPUT:** One published spec with observable acceptance and failure behavior.
- **EXIT CONDITIONS:** No material product or architecture decision is deferred to implementation.
- **FAILURE TRANSITION:** `DISCOVERY` for intent gaps; `EXPLORATION` for a bounded unknown.
- **NEXT STATE:** `DESIGN_REVIEW`, or reduced `IMPLEMENTATION` while reduced-path predicates hold.

## DESIGN_REVIEW

- **ENTRY CONDITIONS:** Fingerprinted spec exists and design dependencies resolve.
- **INPUT:** Spec, decisions, repository architecture, and prior review artifact.
- **DISCIPLINE/SKILL:** Installed `scrutinize` (qualified `9arm-skills:scrutinize` when that plugin is selected).
- **OUTPUT:** Stable review artifact and normalized `SHIP`, `FIX_THEN_SHIP`, `REWORK`, or `REJECT` verdict.
- **EXIT CONDITIONS:** `SHIP` with no design blocker. A completed review increments `designScrutinizeCycles` and the design gate counter exactly once.
- **FAILURE TRANSITION:** `FIX_THEN_SHIP` applies the smallest verified finding fix; `REWORK` returns to specification/exploration; `REJECT` returns to discovery or a human/product decision. Check any newly required conditional dependency before that backward transition. Stop early on no progress or persist `BLOCKED` after cycle 6; never run cycle 7.
- **NEXT STATE:** `PLANNING` on `SHIP`.

## PLANNING

- **ENTRY CONDITIONS:** Approved spec, or a bounded large-project frontier.
- **INPUT:** Spec/frontier references and tracker configuration.
- **DISCIPLINE/SKILL:** Installed user-only `to-tickets`; it owns vertical ticket decomposition.
- **OUTPUT:** Ordered ticket references, or bounded child feature IDs for a parent.
- **EXIT CONDITIONS:** Each item has observable value, dependencies, acceptance evidence, and no hidden design choice.
- **FAILURE TRANSITION:** Return to specification/wayfinding or block for a missing decision/tracker.
- **NEXT STATE:** `IMPLEMENTATION` for a feature; child execution and then parent completion for a large project.

## DIAGNOSIS

- **ENTRY CONDITIONS:** An existing expectation is observably violated.
- **INPUT:** Symptom, environment, logs, contracts, code paths, and prior evidence.
- **DISCIPLINE/SKILL:** Installed model-invoked `diagnosing-bugs`.
- **OUTPUT:** Red-capable loop, root-cause evidence, affected contract, and regression seam.
- **EXIT CONDITIONS:** Root cause is confirmed and regression evidence is available; a diagnosis may also hand off a validated fix.
- **FAILURE TRANSITION:** Non-urgent no-loop blocks; active impact may enter human-approved emergency mitigation; otherwise continue diagnosis.
- **NEXT STATE:** `IMPLEMENTATION[REGRESSION_TEST]` or `IMPLEMENTATION[FIX]`; if diagnosis already produced a validated fix, use `IMPLEMENTATION[FIX]` only to register the handoff evidence before review.

## IMPLEMENTATION

- **ENTRY CONDITIONS:** Approved spec/ticket or confirmed bug cause; mitigation approval is explicit when relevant.
- **INPUT:** Current work item, artifact refs, exact seam, and verification commands.
- **DISCIPLINE/SKILL:** Installed user-only `implement`, which owns its own implementation method and may invoke installed `tdd`/`code-review` according to its source contract. Its current contract commits; disclose that side effect and obtain approval before any model-loaded invocation.
- **OUTPUT:** Code, tests, and implementation evidence.
- **EXIT CONDITIONS:** Behavior is implemented and focused validation passes.
- **FAILURE TRANSITION:** Remain in implementation; return to specification/diagnosis for disproved assumptions; block when safe progress is impossible.
- **NEXT STATE:** `CODE_REVIEW`; `REGRESSION_TEST` must precede `FIX`; emergency mitigation returns to diagnosis or block.

## CODE_REVIEW

- **ENTRY CONDITIONS:** Reviewable diff and implementation evidence exist.
- **INPUT:** Diff, spec/ticket, standards, tests, and fixed point.
- **DISCIPLINE/SKILL:** Installed two-axis `code-review`; requires its declared subagent capability.
- **OUTPUT:** Stable standards/spec review, normalized blocker list, and passing verdict.
- **EXIT CONDITIONS:** No blocker and checks still pass.
- **FAILURE TRANSITION:** `IMPLEMENTATION[REVIEW_FIX]`; third code blocker cycle is `BLOCKED`. After any final-system fix, this stage is mandatory before system re-review.
- **NEXT STATE:** `SYSTEM_REVIEW` for high/system-sensitive work, `POST_MORTEM` only for an eligible incident, otherwise `COMPLETE`.

## SYSTEM_REVIEW

- **ENTRY CONDITIONS:** Code review passed and system risk requires an end-to-end gate.
- **INPUT:** Diff, runtime path, contracts, retries, concurrency, partial failure, state, and side effects.
- **DISCIPLINE/SKILL:** Installed `scrutinize` with the system-review rationale.
- **OUTPUT:** Stable system review and normalized `SHIP`, `FIX_THEN_SHIP`, `REWORK`, or `REJECT` verdict.
- **EXIT CONDITIONS:** `SHIP` with no system blocker. A completed review increments `systemScrutinizeCycles` and only the system gate counter.
- **FAILURE TRANSITION:** `FIX_THEN_SHIP` returns to `IMPLEMENTATION[REVIEW_FIX]`, validation, and code review; `REWORK` returns to specification/design when architecture is invalid; `REJECT` returns to discovery or a human/product decision. Stop early on no progress or persist `BLOCKED` after cycle 6; never run cycle 7. Reviewed mitigation returns to diagnosis.
- **NEXT STATE:** `POST_MORTEM` for an eligible incident or `COMPLETE`.

## POST_MORTEM

- **ENTRY CONDITIONS:** Incident subtype, validated fix, repro/root cause/fix pointer/validation, and final review are present.
- **INPUT:** Diagnosis, implementation, validation, timeline, and review references.
- **DISCIPLINE/SKILL:** Installed external `post-mortem` only when its actual contract accepts this case; never create a replacement incident writer.
- **OUTPUT:** Canonical post-mortem artifact.
- **EXIT CONDITIONS:** Claims are evidence-linked and contract-compatible.
- **FAILURE TRANSITION:** Return to the evidence-producing stage or `BLOCKED`.
- **NEXT STATE:** `COMPLETE`.

## BLOCKED

- **ENTRY CONDITIONS:** Missing human authority, runtime capability, compatible dependency, evidence, or a gate beyond budget.
- **INPUT:** Previous stage, blocker code, evidence, owner, and resume condition.
- **DISCIPLINE/SKILL:** Orchestrator recovery.
- **OUTPUT:** Compact blocker plus the exact user/runtime action needed. For a dependency pause, also persist `dependencyStatus`, `blockedDependency`, and `pendingInstallationPermission`; show owner, repository, verified command, and scope before requesting permission.
- **EXIT CONDITIONS:** Resume condition is independently verified.
- **FAILURE TRANSITION:** Remain blocked; no fake fallback. An approved install still requires a fresh audit; a declined install stays `BLOCKED_DEPENDENCY`.
- **NEXT STATE:** Recorded return stage after reconciliation.

`BLOCKED_DEPENDENCY` is the persisted blocker code/status reason inside the
backward-compatible `BLOCKED` stage; it is not a renamed stage. Existing v1/v2
workflow files therefore resume without a stage-name migration.

## COMPLETE

- **ENTRY CONDITIONS:** Required gates pass, artifacts and verification match current reality, no blocker remains, mitigation is resolved, and all bounded children are complete.
- **INPUT:** Final state and evidence references.
- **DISCIPLINE/SKILL:** Orchestrator completion check.
- **OUTPUT:** Retained audit state and concise handoff.
- **EXIT CONDITIONS:** Terminal and idempotent.
- **FAILURE TRANSITION:** Reconciliation rewinds to the earliest invalidated producer.
- **NEXT STATE:** None.
