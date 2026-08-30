# 04: Contract Validation & Test Suite Verification

**What to build:** Comprehensive end-to-end test execution confirming that all Python unit tests, Node contract tests, and repository validators pass with zero regressions.

**Blocked by:** 01: Subagent Prompt Scaffold & Retry Ceiling, 02: Multi-Harness Onboarding Directives, 03: Capability Benchmark Evals

**Status:** completed

- [x] Run all Python unit tests: `python3 -m unittest discover skills/agents/engineering-workflow/tests`.
- [x] Run repository validator: `node scripts/validate-skills.mjs`.
- [x] Run Node contract tests: `node --test tests/*.test.mjs`.
- [x] Ensure clean git working tree state.
