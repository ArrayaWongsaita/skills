# The Reuse Catalog lists only code that exists

The catalog is read as fact by planners and workers, so a wrong entry is worse
than a missing one: an agent that trusts it skips the search that would have
found the truth. We therefore hold one invariant instead of one writer — **every
write to `docs/reuse-catalog.md` describes code that exists at that moment.**

Consequences:

- Modules a feature *plans* to create live in that feature's `spec.md` Reuse
  Plan, not in the catalog. They enter the catalog when the ticket that creates
  them is integrated.
- Two kinds of writer are legitimate, because both describe existing code: the
  `grill-to-tickets` Reuse survey (bootstrap, drift repairs, entries for
  existing modules it finds in a gap) and the implementers' integration step
  (entries for modules a ticket just created).
- A missed update self-heals: if a run bypasses a catalog-aware implementer
  (e.g. upstream `/implement`), the next Reuse survey re-reads files changed
  since the area's Coverage date and adds what it finds.

## Considered Options

- **Planned entries with a `status: planned` flag, flipped on implementation** —
  rejected: the catalog lies for the whole window between planning and
  integration, and a run that never implements leaves permanent false entries.
- **A generated index (script over exports)** — rejected: never stale, but
  stack-specific, and it cannot carry rules, use-when intent, or Candidates
  (which live in feature directories by definition and are invisible to a
  shared-directory scan).
- **Inline in `AGENTS.md`** — rejected: always-loaded, so every turn of every
  task pays for it. `AGENTS.md` carries a one-line pointer instead.
