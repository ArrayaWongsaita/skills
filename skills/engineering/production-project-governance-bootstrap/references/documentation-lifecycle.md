# Documentation Lifecycle

Use this reference when adding ownership, status, indexes, registries, or archiving rules.

## Status model

Use repository-native statuses when they exist. Otherwise select from:

```text
Draft | Proposed | Accepted | Active | Deprecated | Superseded | Archived | Rejected
```

Do not use superseded, deprecated, archived, or rejected documents as current guidance. Preserve them when they provide history, and link a superseding document.

## Ownership

Assign an owner when appropriate for applications, services, public contracts, ADRs, skills, runbooks, dashboards, critical dependencies, engineering-memory areas, and release procedures. Record an owning team or role when an individual would become stale. Unknown ownership is a reported gap, not a fabricated name.

## Review triggers

Prefer event-driven review after architecture changes, service additions, repeated agent mistakes, significant incidents, CI/build-command changes, platform upgrades, security-policy changes, major releases, or skill eval regressions. Do not add arbitrary review dates when events are sufficient.

## Archiving and deletion

Archive or supersede stale material with status and replacement links. Require explicit approval before deleting historical lessons, incidents, ADRs, or instructions. Preserve version-control history with moves when practical.

## Skill registry

Create a registry only when multiple skills make discovery, overlap, or ownership difficult. Record skill name, purpose, trigger, negative trigger, inputs, outputs, side effects, required approval, owner, version, status, and replacement. Register this bootstrap skill when a registry already exists.
