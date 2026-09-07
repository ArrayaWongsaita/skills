# The skill exists to run implementation on a local, zero-cost, private model

`opencode-implement` dispatches tickets to `opencode run` against a local Ollama model
(default `ollama/qwen3.8:27b-mlx-32k`) so that a whole `grill-to-tickets` output can be
implemented **without spending any API tokens or provider quota, and without the code
leaving the machine**. A probe confirmed the local model reports `cost: 0` per run. The
run works offline. This is the driving constraint and the reason workers exist — the
counterpart to `agy-implement`'s "provider distribution" (its feature ADR 0003) and
`subagent-implement`'s "orchestrator-context preservation" (repo ADR 0005).

Everything downstream follows from this "why":

- **No cross-provider failover.** A local model does not rate-limit. A repeated failure
  is the ticket's problem (verification budget) or the model's capability ceiling
  (fallback tier, adr/0007) — never "try a different provider". `--model` may point at
  another `opencode` provider, but that is a manual override, not a routing strategy.
- **The real constraints are capability, speed, and latency variance — not cost.** A 27B
  local model is weaker and much slower than a hosted frontier model (a trivial probe
  prompt took ~140s), and some probe runs ran many times longer or appeared to wedge —
  whether true `opencode`↔Ollama hangs or contention-driven slowness was not cleanly
  isolated, but either way a worker can take far longer than expected. So the design
  invests heavily in making each unit of work small and verifiable — criterion-level
  decomposition (adr/0006), mandatory TDD (adr/0004), a preflight smoke test, generous
  probe-calibrated timeouts, an `opencode`-retry budget — and in a graceful automatic
  escape when the local path still cannot deliver (adr/0007).
- **The context window is a first-class budget**, not an afterthought. 32k total, with
  ~11–15k spent before any ticket work.

Rejected: a curated multi-model pool with capability tiers (that is `agy-implement`'s
rejected design too — the selection problem is the error-prone part). Rejected: treat
the local model as a drop-in for a hosted one and skip the decomposition/fallback
machinery (the probes show it is not one).
