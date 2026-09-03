# Verification is split: a fresh verifier subagent does the I/O, the orchestrator judges

`agy-implement`'s orchestrator reproduces the red state itself — applies only the
worker's test files at the pre-ticket `HEAD`, runs them, re-runs green,
typechecks, inspects the diff. That file-reading and test-running is exactly what
`subagent-implement` exists to move out of the orchestrator's context.

Decision: per ticket, the orchestrator dispatches a **fresh `Explore` subagent**
as the verifier. It is told the pre-ticket `HEAD`, the worker branch, and the
changed test files. It reproduces red, runs green, runs the typecheck and the
full suite, and returns raw evidence with **no verdict**. The orchestrator reads
that evidence and makes the judgment itself — criterion coverage, vacuous or
tautological assertions, genuinely-red-first, genuinely-green — and owns the
pass / retry / BLOCKED decision.

Why a separate subagent rather than trusting the worker's return: the check must
be independent of the agent that wrote the code, which is `agy-implement`'s
principle too. Why `Explore`: it reads and runs commands but writes no files, so
it cannot accidentally fix what it is checking. Why fresh each ticket: no
accumulated context, one job.

Fallback: if the verifier itself errors, the orchestrator runs the ticket's new
tests once directly — the one sanctioned place implementation-adjacent work
re-enters its context, and only on failure.

Trade-off: an extra subagent dispatch per ticket, and `Explore`'s
excerpt-oriented reading may be too shallow to summarise a large test diff — if
so, the verifier switches to `general-purpose` instructed to write nothing. This
is a first-use confirmation, not a blocker.
