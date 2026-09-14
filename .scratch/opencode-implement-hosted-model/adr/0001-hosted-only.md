# 1. `opencode-implement` becomes hosted-only; no default model of its own

## Status

Accepted

## Context

`opencode-implement` existed to run implementation on a local, zero-cost, private
model (`.scratch/opencode-implement/adr/0003-local-execution-is-the-purpose.md`).
The user has stopped using local models in `opencode` entirely and will run
against a hosted model (DeepSeek V4.1 Flash, via a hosted `opencode`-compatible
gateway). `opencode` itself already resolves a model when none is given, in this
priority order: `--model`/`-m` flag → the `model` field in `opencode.json` /
`opencode.jsonc` → the last model used → an internal default. The skill
previously overrode this entirely by hardcoding `--model
ollama/qwen3.8:27b-mlx-32k` as its own default.

## Decision

- The skill **stops injecting a default `--model` value**. `--model
  provider/model` at invocation still works exactly as before (explicit
  override), but when omitted, the skill passes no `--model` flag to `opencode
  run` at all and lets `opencode`'s own resolution chain decide.
- Local models (Ollama or otherwise) are no longer a documented path. Nothing
  Ollama-specific remains in the skill's docs, preflight checks, or messaging.
  Any `opencode` provider still works mechanically (the invocation was always
  provider-agnostic) — "hosted-only" describes the skill's framing and defaults,
  not a technical block on pointing `--model` at a local provider if a future
  user wants to.
- Preflight (`references/worktree-integration.md`) drops the Ollama-reachability
  check and the "restart Ollama and opencode" failure message; it becomes
  "confirm `opencode` on `PATH` and `opencode models` lists the resolved model."
- The one-model-for-the-whole-run invariant is unchanged: whatever model
  resolves (explicit or `opencode`'s own chain) at the start of a run is the one
  every worker in that run uses. There is still no per-ticket model reasoning.

## Consequences

- Whichever model was last selected in the user's own `opencode` session (or
  configured in `opencode.json`) becomes the run's model with zero extra
  flags — matching the request that drove this change.
- **Risk, mitigated by capture-and-pin, not left open:** relying on
  `opencode`'s implicit "last used model" means a run *could* pick up a
  different model than the user expects if they (or anyone on the same
  machine) select a different model in `opencode` between runs — or, worse,
  *mid*-run, since a real run now dispatches many worker processes over time,
  some concurrently. Caught during the Stage 2 design review: showing the
  resolved model in the Plan is not enough by itself, because nothing stops
  each individual worker dispatch from re-resolving independently if the skill
  keeps omitting `--model`. So the skill resolves the model **once**, before
  wave 0 (via `opencode models` or the first `step_start`/`step_finish`
  event), records it in the Plan and `status.md`, and from then on passes that
  captured value as an explicit `--model` flag to every worker for the rest of
  the run — the same as if the user had typed it. Implicit re-resolution only
  ever happens once, at the very start.
- Every downstream document that said "local model" / "Ollama" / "zero-cost" /
  "slow background tool" needs rewriting (tracked at the tickets stage, not
  itemized here).
- Supersedes `.scratch/opencode-implement/adr/0003-local-execution-is-the-purpose.md`.
  That file is left in place as a historical record, not deleted.

## Rejected alternatives

- **Pin a specific hosted model as the new hardcoded default.** Rejected: the
  user explicitly wants "whatever I last selected," not a second hardcoded
  default replacing the first — the whole point is to stop the skill from
  overriding `opencode`'s own choice.
- **Require `--model` on every invocation, no implicit resolution at all.**
  Rejected as more friction than the user asked for; `opencode`'s own resolution
  chain already solves this.
