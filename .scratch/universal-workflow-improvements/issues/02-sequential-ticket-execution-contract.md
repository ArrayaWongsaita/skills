# 02: Sequential Ticket Execution Contract

**What to build:**
Update the stage contracts and workflow guides in `references/states.md`, `references/feature-flow.md`, and `references/routing.md` to formally document the Sequential Subagent Ticket Execution Loop and progressive phase boundary.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Update `references/states.md` with the detailed loop in `IMPLEMENTATION` (Orchestrator CAS -> Transient `self` Subagent -> Verification).
- [x] Update `references/feature-flow.md` with progressive fallback handling (`has_subagents` true vs false).
- [x] Update `references/routing.md` with capability-based routing rules.
