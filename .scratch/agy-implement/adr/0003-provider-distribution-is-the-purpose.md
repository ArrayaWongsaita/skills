# Workers exist for provider distribution, not cost or speed

`agy-implement` dispatches tickets to `agy` workers so that one multi-ticket run's
token spend is spread across several LLM providers (Claude, Gemini, GPT-OSS). The
driving constraint is provider quota / rate limits: a large ticket set sent entirely
to one provider hits that provider's ceiling. Cost reduction and wall-clock speedup are
real but secondary effects.

The mechanism is deliberately dumb: an optional flat `Model list` passed once at run
start, assigned round-robin over **dispatch order** as each worker slot starts (not by
ticket number — assigning by ticket number lets two simultaneous workers land on the
same provider, the exact rate-limit case this exists to avoid), with no per-ticket
judgement about which model suits which ticket. With no list, every worker uses `agy`'s
own default model and the run is single-provider. Earlier drafts had a curated pool with
weight tiers and a "capability floor" for mechanical-only models; the owner cut all of
that because choosing a model per ticket was the error-prone part, not having several
models. `Failover` (its own budget, separate from verification retries) just advances to
the next list entry.

Alternatives rejected: send everything to Claude (simplest, defeats the point);
per-ticket model matching by weight/complexity (the selection problem the owner wants
gone).
