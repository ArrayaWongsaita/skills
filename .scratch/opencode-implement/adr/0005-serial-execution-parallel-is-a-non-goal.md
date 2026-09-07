# Execution is serial, permanently — parallel is a non-goal, not a deferred follow-up

`opencode-implement` runs one ticket at a time in dependency order. One worktree is
created, worked, verified, integrated, and removed before the next ticket starts. There
is no wave computation, no touch-set estimation, no concurrency cap, no parallel-safety
flagging.

This diverges from **both** siblings. `agy-implement` ships parallel waves on day one
(its purpose is spreading load across providers, so concurrency is the point).
`subagent-implement` is serial in v1 but names parallelism an explicit deferred
follow-up. Here it is neither shipped nor deferred — it is **out of scope by design**,
because the hardware makes it worthless:

- Ollama serves a single model instance. Several `opencode run` processes dispatched at
  once do not run their inference in parallel — Ollama queues them. The result is idle
  Node processes, extra worktrees, and multiple KV-caches competing for RAM, with zero
  inference speedup.
- The target machine has 38.7 GB RAM and the model is ~18 GB resident. There is not
  room to host concurrent workers' context windows.
- A probe showed a single local run of a real multi-file task can hang for 40+ minutes;
  running two at once multiplies that risk with no upside.

The only thing serialized execution gives up is overlapping the orchestrator's
verification of ticket N with the worker on ticket N+1 — and the orchestrator's
verification is fast next to multi-minute local inference, so the overlap is marginal.

If a run genuinely needs parallelism, that means pointing `--model` at a hosted provider
— which is not this skill's purpose. Use `agy-implement` for that. A shared-machinery
refactor could later add an optional parallel mode, but it is not planned.

Consequence: a large ticket set takes real wall-clock time. That is accepted — the skill
trades speed for zero cost and privacy (adr/0003).
