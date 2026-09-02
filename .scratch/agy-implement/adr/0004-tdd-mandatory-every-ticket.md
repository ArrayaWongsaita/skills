# Every ticket is implemented test-first, no exceptions

Each worker must write the failing test(s) at the ticket's assigned test seam, observe
them fail, implement minimally, then refactor. The worker's structured return carries
the red output, the green output, and a table mapping each test to an acceptance
criterion. The orchestrator's verification gate re-runs those tests plus a typecheck and
inspects the test diff for vacuous assertions and criterion coverage; any gap is a
verification failure. A ticket that cannot be exercised by an isolated test is treated
as a decomposition error — it goes back for replanning, it is not exempted.

Why: the owner wants tests written every time so the desired outcome is measured
correctly, not asserted by a worker's prose. Making TDD the fixed method (rather than a
prompt suggestion) is what lets the orchestrator trust a worker it shares no context
with. Trade-off: genuinely test-resistant work (bare config, some migrations, pure
visual tweaks) now forces a planning conversation instead of a quick edit. Consistent
with 0002 — an un-buildable-to-spec ticket surfaces as a signal, never a silent
fallback.
