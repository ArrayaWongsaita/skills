# Every ticket and every sub-step is built test-first, no exceptions

Each worker prompt carries the full red-green-refactor protocol inline (the worker's
environment is not assumed to have a TDD skill): write the failing test at the assigned
seam, run it, confirm it fails for a missing behaviour, write the minimal code to pass,
then refactor with the tests green. The orchestrator selects each ticket's test seam at
planning from the parent spec's Testing Decisions where they constrain it, otherwise the
narrowest public boundary that exercises the acceptance criteria. A ticket whose
acceptance criteria cannot be exercised by an isolated test at any seam is a
decomposition problem — it returns to planning rather than being implemented without a
test.

When a ticket is decomposed into sub-steps (adr/0006), TDD applies **per sub-step**: the
default fault line is one acceptance criterion per sub-step, and each sub-step's worker
writes that criterion's failing test first and makes it pass. The orchestrator's
end-of-ticket verification gate still reproduces the whole ticket's red state and runs
the full new test set green.

This matters more here than for the hosted-model siblings: a weak local model is exactly
the case where "it wrote code that looks right" is least trustworthy, so a test that
actually measures the acceptance criterion — reproduced red by the orchestrator itself —
is the load-bearing check. Mirrors `agy-implement` feature ADR 0004.
