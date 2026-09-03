# v1 is serial; parallelism is a deferred follow-up

v1 runs one ticket at a time in dependency order. Tickets with no `Blocked by`
edge between them are still run one after another. There is no wave computation
and no touch-set estimation — those exist in `agy-implement` only to schedule and
de-risk concurrency.

Why: the skill's purpose is context preservation, and serial execution serves it
directly. The orchestrator reasons about one worker return and one verifier
report at a time, which keeps its own context and attention cheap — the point of
the skill. Serial also collapses the machinery: each worker branch is cut from an
integration `HEAD` that already carries every earlier ticket with nothing merged
in between, so the worker branch's working tree equals the post-squash-merge
tree, and the verifier's full-suite run on the worker branch already covers the
post-merge state. v1 therefore needs no separate integration gate.

The deferred follow-up adds parallelism through the Agent tool's built-in
`isolation: "worktree"` (one background worker per independent ticket, a
concurrency cap) and reintroduces a per-wave integration gate, since parallel
branches cut from one `HEAD` can break each other.

Trade-off: a large ticket set takes longer in wall-clock time than
`agy-implement`'s parallel waves. Accepted for v1 — throughput is not this
skill's reason for being, and the parallel path can be added by extending the
execution loop rather than reworking it.
