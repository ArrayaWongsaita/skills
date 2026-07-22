# Release and Rollback

Use this reference for production release planning or changes whose rollout and recovery materially affect users or operations.

## Choose an evidence-based strategy

Consider direct, rolling, canary, blue/green, feature flag, staged enablement, or shadow traffic only when supported by the repository's deployment platform and risk. Do not prescribe a sophisticated strategy without evidence it is available and useful.

## Release plan contract

Define:

- Release and operational owners.
- Deployment and migration order.
- Compatibility window and dependent systems.
- Feature-flag defaults and removal plan when applicable.
- Health indicators, smoke tests, and post-release checks.
- Rollback triggers, decision owner, steps, and verification.
- Data rollback limitations and forward-fix constraints.
- Monitoring period and communication requirements.
- Required approvals and the exact production action still blocked.

Release-plan approval does not authorize deployment. The skill must never execute a deployment merely because it produced a plan.

## Readiness decision

Mark each required item ready, blocked, not applicable with a reason, or unknown with an owner. Do not convert unknown commands or owners into plausible defaults.

## Rollback quality

Test or rehearse rollback where risk justifies it. Distinguish application rollback, configuration rollback, traffic rollback, and data recovery. If data cannot be rolled back safely, state the limitation and define containment or forward-repair steps before release approval.
