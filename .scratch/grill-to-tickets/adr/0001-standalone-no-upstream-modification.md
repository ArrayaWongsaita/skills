# 0001: Standalone Skill, No Modification to Upstream-Tracked Skills

## Status
Accepted

## Context
`grill-with-docs` already implements Phases 1-3 (grilling → domain-modeling → to-spec → scrutinize design gate → to-tickets) as part of its six-phase full-lifecycle orchestration. Composing `grill-to-tickets` by having `grill-with-docs` delegate its Phase 1-3 to it would remove the duplicated Design Review Gate logic, but requires editing `grill-with-docs/SKILL.md` directly.

Separately, `skills-lock.json` still records `grill-with-docs` as sourced verbatim from `mattpocock/skills` (with a `computedHash` that no longer matches the file on disk — it was already rewritten locally by commit `7fda919`, untracked by the lock file). The user does not want to modify any Matt Pocock-sourced skill further, regardless of this pre-existing drift.

## Decision
1. Build `grill-to-tickets` as a fully standalone skill that inline-executes `grilling`, `domain-modeling`, `to-spec`, `scrutinize`, and `to-tickets` in sequence, owning its own copy of the Design Review Gate rules (verdict routing, six-cycle budget, stall detection).
2. Do not modify `grill-with-docs/SKILL.md` or any other `mattpocock/skills`-sourced file.
3. Do not touch the `grill-with-docs` entry in `skills-lock.json`; its existing drift is out of scope for this feature.

## Consequences
- **Positive**: Zero risk to the working `grill-with-docs` orchestrator or its (already stale) lock provenance.
- **Trade-off**: The Design Review Gate rules now exist in two places in the repository (`grill-with-docs` Phase 2's prose, and `grill-to-tickets`'s own reference) and can drift apart if one is updated without the other.
- **Follow-up (not done here)**: `skills-lock.json`'s `grill-with-docs` entry still misrepresents its provenance; correcting it is a separate, explicitly deferred task.
