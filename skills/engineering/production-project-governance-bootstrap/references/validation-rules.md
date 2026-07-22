# Validation Rules

Use this checklist after design and after every authorized governance change. Validation is read-only unless the user explicitly requests fixes.

## Structural validation

- Required and routed files exist and are non-empty.
- Relative links and anchors resolve.
- Nested instructions have distinct documented scope.
- No directory accidentally contains both ordinary and override instructions.
- Templates and generated documents contain their required decision-bearing sections.
- No created directory exists solely to mirror an example.

## Command validation

- Commands are sourced from current manifests, task runners, CI, or authoritative docs.
- Package manager and workspace filters match the repository.
- CI and documented local commands are reconciled where expected.
- Unknown commands remain explicitly unknown.
- Reports distinguish inspection from execution.

Automated validation can confirm only recognized command forms. Treat unrecognized tools as manual-review warnings, not proof of failure or validity.

## Instruction validation

- Root instructions route rather than reproduce manuals.
- Critical safety and approval rules are always visible.
- Detailed rules have explicit triggers, workflows, checks, and escalation.
- Duplicate and contradiction candidates are reviewed in scope and precedence context.
- Ordinary features do not automatically trigger system design.
- Security triggers cannot bypass security routing.
- Destructive and production actions require human approval.
- Root and active-chain sizes remain within configured thresholds.

## Memory and lifecycle validation

- Active lessons are indexed and applicable.
- Superseded lessons link replacements.
- Incident and evidence links resolve.
- Stronger guardrails are recorded where practical.
- Temporary debugging notes are not active policy.
- Status and ownership metadata use recognized values.
- Existing skill-registry entries resolve.

## Quality checks

Run available Markdown lint, link validation, YAML parsing, script checks, and `git diff --check` relevant to governance files. Do not run unrelated full application tests unless governance tooling affects executable code.

Report each check as passed, failed, skipped with reason, or unavailable. A validator warning is evidence for review, not permission to ignore the issue.
