# 01: Subagent Prompt Scaffold & Retry Ceiling

**What to build:** The orchestrator formats subagent task dispatches using a canonical 5-section prompt scaffold and halts at 3 consecutive failed verification attempts before runaway token loops occur.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Incorporate the 5-section subagent prompt scaffold (Target, Context & Seam, Verification, Constraints, Return Format) into the stage contract reference using positive steering.
- [x] Enforce `MAX_TICKET_ATTEMPTS = 3` and specify the transition to `BLOCKED (TICKET_VERIFICATION_FAILED)` when verification fails repeatedly.
- [x] Ensure parity across `skills/` and `.agents/skills/`.
