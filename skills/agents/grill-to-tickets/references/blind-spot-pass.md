# Blind-spot pass

The interview's design tree grows out of the idea, so a category nobody raised
never reaches the frontier. Before the Stage 0 pause, check the settled
decisions against a fixed set of categories, adapted from the ambiguity taxonomy
of GitHub Spec Kit's `/clarify`.

## Categories

| Category | Look for |
| --- | --- |
| Scope and behaviour | user goals, success criteria, what is explicitly excluded |
| Domain and data | entities, identity, lifecycle states, volume and scale |
| Interaction and flow | user journeys; empty, loading, and error states; accessibility |
| Quality attributes | performance targets, reliability, observability, security and privacy |
| Integrations | external services, data formats, versioning, a dependency that fails |
| Edge cases and failure | invalid input, concurrency and conflicts, partial failure, retries |
| Constraints and trade-offs | technical limits, rejected alternatives and why |
| Terminology | terms in use but absent from `CONTEXT.md`, two names for one concept |
| Completion signals | behaviour testable at a seam, what "done" means for the feature |

## Procedure

1. **Mark** every category `clear`, `partial`, `missing`, or `n/a`, reading
   `decisions.md`, `CONTEXT.md`, `adr/`, and the repository. An `n/a` carries a
   one-line reason (a CLI tool has no accessibility surface). Look facts up
   yourself; the marks are about decisions.
2. **Ask.** For each `partial` or `missing` category, find the gaps that would
   change the spec — a story, an interface, a test. Put them to the user as one
   final round, highest impact first and at most five questions, each with a
   recommended answer, logged like any round.
3. **Assume out loud.** Every other gap — one that would not change the spec, or
   one beyond the five — becomes a stated assumption in the table. The pause
   summary shows the assumptions, so the user can overturn any of them, and
   Stage 1 carries the rest into Further Notes.
4. **Return to the frontier.** An answer that opens new decisions puts them back
   on the frontier; keep grilling until it is empty again. The pass runs once per
   Stage 0; a decision-level re-grill from the gate skips it.

Write the result into `decisions.md` under `## Blind-spot pass`, and show it in
the pause summary:

```markdown
## Blind-spot pass

| Category | Mark | Resolution |
| --- | --- | --- |
| Quality attributes | missing | R5 Q1 — exports stream past 10k rows |
| Interaction and flow | partial | assumption: the existing toast reports failures |
| Integrations | n/a | no external service involved |
```

The pass is done when every category carries a mark, and every `partial` or
`missing` one has a logged decision or a stated assumption.
