# Every ticket is decomposed into a criterion-level step plan

The local model runs in a 32k-token window, of which a probe measured ~11k spent before
any ticket work and ~11.3k peak for a trivial 2-file / 1-edit task. A normal tracer-
bullet ticket — read a few files, write a test file and an implementation file, iterate —
does not fit. It has to be broken into pieces the model can hold.

**The orchestrator always builds a step plan for every ticket. The default fault line is
one acceptance criterion per sub-step.** A ticket with a single criterion gets a
one-sub-step plan (indistinguishable from running the ticket whole). A ticket with four
criteria gets a four-sub-step plan by default. Each sub-step's worker writes that
criterion's failing test first and makes it pass (adr/0004); state passes to the next
sub-step by a commit on the worker branch plus a compact **progress note**, never by
`opencode` session resume (resume replays the transcript and context would grow).

Earlier drafts made "run the ticket whole vs. decompose it" a planning decision gated on
a footprint estimate. That was cut: a pre-implementation estimate of *which files a
worker will read* is exactly the unreliable guess `agy-implement` learned to demote to
advisory, and here an estimate that comes in low means a worker hangs for 40 minutes
before the runtime re-split rescues it. Decomposing by criterion unconditionally removes
that whole failure class, and smaller units suit a weak model regardless.

**Estimation still has one job:** deciding whether a *single criterion's* sub-step is
itself too big. When one criterion — its test plus its slice of implementation plus the
files it must touch — is estimated over the **context budget** (provisionally ~13k tokens
of sub-step-specific content: `32k window − ~11k input floor − ~4k headroom − ~4k
reasoning reserve`; pinned by validation probe C), the orchestrator splits it finer along
the next natural line (a file, a layer). The bias is deliberate: **when unsure, split** —
an extra 3-minute sub-step is cheap, an under-split sub-step that hangs is not.

The step plan is shown in the Plan at approval. It is an estimate, not a gate: a sub-step
that overflows at runtime (caught by the checkpoint check and by overflow symptoms —
truncated edits, ignored late instructions) is re-split by the orchestrator, recorded in
`status.md`. This mirrors `agy-implement`'s "the estimate is advisory, the gate is truth".

A single criterion that cannot be split fine enough to fit — it inherently needs to see
too much at once — triggers the subagent fallback (adr/0007), or
`BLOCKED (TICKET_TOO_LARGE_FOR_CONTEXT)` under `--no-fallback`.

Rejected: split by red/green/refactor phase (one "green" step can still be huge).
Rejected: no decomposition, let verification catch overflow (wastes a multi-minute run
per overflow; the weak model degrades silently rather than erroring).
