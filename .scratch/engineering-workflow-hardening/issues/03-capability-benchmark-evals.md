# 03: Capability Benchmark Evals

**What to build:** Automated benchmark test cases in `evals.json` validating orchestrator routing logic across capability matrix permutations.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Add Eval ID 16 validating subagent loop execution when `has_subagents: true`.
- [x] Add Eval ID 17 validating `/clear` phase boundary guidance when `has_subagents: false`.
- [x] Verify `evals.json` syntax and schema integrity across both locations.
