# opencode-implement → hosted-model generalization — Domain glossary / อภิธานศัพท์

This feature turns `opencode-implement` from a **local-only, criterion-decomposed**
skill into a **hosted-model, wave/parallel** skill shaped like `agy-implement`,
while keeping `opencode run` as its delegate CLI (not `agy`) and keeping its own
automatic fallback tier that `agy-implement` does not have. This file records
which terms from `.scratch/opencode-implement/CONTEXT.md` are **retired**,
**redefined**, or **new**, and links each to the ADR that decided it.

## Retired terms (from the original CONTEXT.md)

| term | why retired |
|---|---|
| **sub-step** | Criterion-level decomposition is gone ([[adr-0002-whole-ticket-wave-parallel]]). A worker now builds the **whole ticket**, same granularity as the fallback subagent always had. |
| **step plan** | No per-ticket sub-step chain to plan — superseded by the **wave table** (below), borrowed from `agy-implement`. |
| **progress note** | Existed to hand off state between sub-step dispatches inside a 32k window. Retry now **resumes the same `opencode` session** instead ([[adr-0002-whole-ticket-wave-parallel]]), so there is no chain of dispatches to hand off between. |
| **context budget / input floor** | Local-window sizing math. A hosted model's window is large enough that per-ticket context fitting is no longer a planning concern ([[adr-0001-hosted-only]]). |
| **`--strict-local`** (alias of `--no-fallback`) | Named the local-only guarantee, which no longer exists. Renamed **`--opencode-only`**: still means "suppress the fallback tier, stay inside the `opencode` path, no Claude tokens spent, no extra escalation" — just not "local" ([[adr-0001-hosted-only]]). |

## Redefined terms

| term | old meaning | new meaning |
|---|---|---|
| **worker** | One headless `opencode run` process on the **local** model, building **one sub-step**, inside a git worktree. | One headless `opencode run` process on the **resolved model** (hosted; see below), building the **whole ticket** test-first, inside its own git worktree. Workers for independent same-wave tickets run **concurrently**, one worktree each ([[adr-0002-whole-ticket-wave-parallel]]). |
| **the run's model** | A fixed `--model` value, default `ollama/qwen3.8:27b-mlx-32k`, hardcoded by the skill. | Whatever `opencode run` itself resolves when the skill does **not** pass `--model`: its own config → **last used model** → internal default — or an explicit `--model provider/model` override at invocation, unchanged from before. The skill injects **no default of its own** ([[adr-0001-hosted-only]]). One resolved model for the whole run, still no per-ticket or per-provider selection. |
| **fallback tier** | Exists because "a 27B local model is weak and slow" (original adr/0007 scratch). Triggers: ticket too large to decompose further, verification budget exhausted, `opencode` failures exhausted. | Same three triggers, same mechanics (whole-ticket subagent dispatch, `isolation: "worktree"`, no approval pause) — reframed as a **capability-ceiling safety net**: the resolved hosted model, however capable, can still fail a ticket 3× or hit a genuine capability gap. Kept as `opencode-implement`'s differentiator over `agy-implement`, which has no equivalent and just yields `BLOCKED` ([[adr-0003-fallback-tier-retained]]). |
| **retry (verification failure)** | A **fresh** `opencode run`, never session-resume — resuming would replay the whole transcript and overflow the 32k window. Carries a **progress note**. | **Resumes the same `opencode` session** (`opencode run -s <session>` with just the failure detail as the next turn), mirroring `agy-implement`'s `agy --conversation <id> -p "<feedback>"`. No progress note — there is nothing to hand off across, since dispatch is already whole-ticket ([[adr-0002-whole-ticket-wave-parallel]]). |
| **cost / usage disclosure** | Plan/`status.md`/handoff disclosed `tokens.fallback` only — the main path was `cost: 0` by construction (local). | Disclosed for **both** paths: `tokens.main` (the `opencode` path, real spend against the resolved hosted model) and `tokens.fallback` (unchanged), in the Plan, `status.md`, and the completion handoff ([[adr-0004-cost-disclosure-and-no-failover]]). |

## New terms (borrowed from `agy-implement`, adapted)

| term | meaning |
|---|---|
| **wave** | A batch of tickets whose blockers all landed in earlier waves. Wave 0 = every ticket with no blockers. Computed at planning, same algorithm as `agy-implement` ([[adr-0002-whole-ticket-wave-parallel]]). |
| **wave table** | The Plan's per-wave breakdown, replacing the old step-plan-per-ticket view: wave number, tickets in it, each ticket's estimated touch-set, serial/parallel proposal, overlap flags, test seam. |
| **touch-set estimate** | An advisory guess at the files a ticket's implementation will touch, computed at planning to flag same-wave overlap risk. Never a scheduling hard-constraint — the integration gate is the correctness guarantee, same disclaimer as `agy-implement`. |
| **overlap flag** | `likely-overlapping — consider serializing`, raised for an independent same-wave ticket pair whose estimated touch-sets intersect, or either touches a cross-cutting file (router, DI container, root schema, migrations, `package.json`, lockfiles, CI config, shared config). The user decides at Plan approval whether to serialize. |
| **parallel dispatch** | Independent tickets in the same wave run **concurrently**, each in its own `worktrees/<NN>/` with its own `opencode run` worker process. Serial-only was a local-model constraint (adr/0005, retired); a hosted model handles concurrent requests, so parallel dispatch is now the default within a wave ([[adr-0002-whole-ticket-wave-parallel]]). |

## Carried-forward non-goals (explicitly re-confirmed, not silently dropped)

| non-goal | still holds because |
|---|---|
| **No cross-provider failover / no model list / no round-robin.** | Never revisited by the user. `opencode-implement` still resolves and uses exactly **one** model for the whole run (unlike `agy-implement`'s `MAX_FAILOVER_ATTEMPTS` round-robin over a model list). An `opencode`-process failure retries against the **same** resolved model, budget `MAX_OPENCODE_RETRIES = 3`, then escalates to the fallback tier — never to a different model. This is what keeps `opencode-implement` distinct from `agy-implement`'s "provider distribution" reason-to-exist even after adopting its wave/parallel mechanics ([[adr-0004-cost-disclosure-and-no-failover]]). |
| **Standalone skill, not merged into `agy-implement`.** | Explicit user decision: `opencode` is a genuinely different execution engine/provider-access path (its own CLI, its own model-resolution chain, its own event-stream contract) worth its own skill and its own ADR trail, even though the planning/execution shape now closely mirrors `agy-implement`. |

## Superseded ADRs (original `.scratch/opencode-implement/adr/`)

| original ADR | status |
|---|---|
| `0003-local-execution-is-the-purpose.md` | **Superseded** by [[adr-0001-hosted-only]] — the "why" flips from local/zero-cost/private to hosted/wave-parallel/cost-disclosed. |
| `0005-serial-execution-parallel-is-a-non-goal.md` | **Superseded** by [[adr-0002-whole-ticket-wave-parallel]] — serial-only was itself a consequence of the local model constraint; parallel dispatch within a wave is now the default. |
| `0006-context-fit-decomposition.md` | **Superseded** by [[adr-0002-whole-ticket-wave-parallel]] — decomposition is gone; the file is kept for history, not deleted. |
| `0007-automatic-native-subagent-fallback.md` (scratch) | **Amended, not reversed**, by [[adr-0003-fallback-tier-retained]] — mechanism and triggers unchanged, only the "why" narrative is reframed. |

Repo-level `docs/decisions/0007-opencode-implement-standalone.md` frames this
skill's differentiator against `agy-implement` and `subagent-implement` partly in
terms of local execution — flagged for a short addendum at the tickets stage, not
rewritten here (see spec's Further Notes).
