# The orchestrator never implements a ticket itself

The orchestrator dispatches every ticket to a worker. It writes code itself only
to resolve a purely mechanical merge conflict at integration. It also owns
verification judgment and agent routing. A ticket that no worker can complete
within `MAX_TICKET_ATTEMPTS = 3` becomes `BLOCKED` and waits for a human — the
orchestrator does not "rescue" it by coding it directly.

Why: the skill exists to keep implementation out of the orchestrator's context
(see 0001-context-preservation-is-the-purpose.md). Every ticket the orchestrator
implements fills the exact window the skill is trying to protect and silently
changes the run from "delegated" to "the main agent did it all". Making this a
hard rule keeps the context model honest and turns an un-buildable ticket into a
visible planning signal rather than a hidden fallback.

Trade-off: a genuinely subtle ticket stalls the run instead of getting quietly
finished. Consistent with `agy-implement`'s feature ADR 0002, which draws the
same line for a different underlying reason.
