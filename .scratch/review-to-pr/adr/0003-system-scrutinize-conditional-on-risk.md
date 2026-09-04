# System scrutinize runs only when the change is cross-cutting or risky

After the code-review loop closes, `feature-flow.md` §9 says to "run final
`scrutinize` only when risk or change characteristics require the system gate".
The alternative is to always run it — simpler to specify, one less judgment
call. `grill-to-tickets`'s Design Review Gate always runs `scrutinize`, but that
is the *design* gate on a spec, a different thing.

Decision: Stage 3 runs the inline `scrutinize` pass **only when the integrated
change is cross-cutting or risky**, judged against a concrete checklist: the
diff touches routing, a DI container, a root schema, a migrations directory,
shared config, auth, concurrency or locking, or an on-wire / on-disk format; or
it spans many modules; or the code-review loop surfaced a structural finding
(Shotgun Surgery, Divergent Change, a wrong-layer decision). None of those →
skip Stage 3, go straight to the full suite, and say so in the handoff.

Why: `scrutinize` is an end-to-end code-path trace with its own six-cycle
budget — expensive. On a self-contained feature whose blast radius the
code-review Spec axis already covered, it mostly restates the code-review
result. Spending the gate only where a cross-cutting change can hide a seam bug
keeps the run proportional to the risk, which is what §9 asks for.

Trade-off: the "cross-cutting or risky" call is the orchestrator's, from a
checklist rather than a formula, so a borderline change could be waved through.
The mitigation: the handoff always states whether the system gate ran and why,
so a human can ask for it explicitly. The scrutinize budget stays independent of
the code budget either way (`gates.md`).
