# agy-implement is a standalone skill, not wired into engineering-workflow

`engineering-workflow`'s `feature-flow.md` already describes a "Sequential Ticket
Execution Loop" that dispatches a subagent per ticket, but delegates it. We considered
building `agy-implement` as that skill's `IMPLEMENTATION` delegate. We decided
instead to build it fully standalone: it is invoked directly as the alternative to
`/implement` at the `grill-to-tickets` handoff, does not modify `engineering-workflow`
or `grill-to-tickets`, and carries its own light copy of the state/resume discipline
(`status.md` + Reality reconciliation).

Why: the owner wants the two skills decoupled and may remove `engineering-workflow`
entirely later, so `agy-implement` must not depend on it. Trade-off: the frontier /
wave-execution pattern now exists in two places and can drift. Mirrors ADR 0003's
standalone stance for `grill-to-tickets`.
