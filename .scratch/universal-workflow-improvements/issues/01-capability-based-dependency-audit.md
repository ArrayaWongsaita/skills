# 01: Capability-Based Dependency Audit

**What to build:**
Upgrade `scripts/dependency_audit.py` and its tests to support capability-based probing and generic runtime handling without requiring strict vendor names.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Support `--capability <feature>` or generic runtime default in `scripts/dependency_audit.py`.
- [x] Add/update unit tests in `skills/agents/engineering-workflow/tests/test_dependency_audit.py` for capability verification.
- [x] Verify test suite passes with `python3 -m unittest discover skills/agents/engineering-workflow/tests`.
