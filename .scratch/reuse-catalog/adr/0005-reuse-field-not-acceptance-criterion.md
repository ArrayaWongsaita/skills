# Reuse guidance travels in a Reuse field, never as an acceptance criterion

The obvious way to make a worker reuse `formatCurrency` is an acceptance
checkbox: "- [ ] formats amounts with the existing `formatCurrency`". It breaks
all three implementers: each verification gate requires **every acceptance
criterion to map to at least one new test**, and a structural "uses X" claim has
no behavioural test. The ticket would fail verification, retry up to
`MAX_TICKET_ATTEMPTS`, and end `BLOCKED (TICKET_VERIFICATION_FAILED)`.

So reuse is carried in a dedicated `**Reuse:**` line with fixed verbs (`use`,
`extend`, `create-shared`, `create-candidate`, `promote`). The implementers copy
it verbatim into the worker prompt's "Context you need", and their orchestrators
read the non-`use` verbs to update the catalog at integration. The behaviour a
new shared module provides — its interface, tested at that interface — still
belongs in the owner ticket's acceptance criteria as normal.

Enforcement of "did the worker actually reuse it" moves to review:
`review-to-pr` passes the catalog to `code-review` as a documented standards
source, so an unplanned duplicate of a catalogued module is a
documented-standard violation there.
