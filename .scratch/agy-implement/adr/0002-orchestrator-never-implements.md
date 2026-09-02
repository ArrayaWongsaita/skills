# The orchestrator never implements a ticket itself

The orchestrator (the main Claude agent running the skill) dispatches every ticket to
a worker. It only ever writes code itself to resolve merge conflicts at an integration
gate. It also owns verification and skill routing. A ticket that no worker can complete
within its retry budget becomes `BLOCKED` and waits for a human — the orchestrator does
not "rescue" it by coding it directly.

Why: the skill exists to spread token spend across providers (see
0003-provider-distribution-is-the-purpose.md). Every ticket the orchestrator implements
burns the exact quota the skill is trying to protect, and silently changes the run from
"distributed" to "Claude did it all". Making this a hard rule keeps the cost model
honest and turns an un-buildable ticket into a visible planning signal rather than a
hidden fallback. Trade-off: a ticket that is genuinely subtle stalls the run instead of
getting quietly finished.
