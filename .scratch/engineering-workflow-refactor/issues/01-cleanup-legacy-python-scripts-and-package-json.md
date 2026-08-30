# 01: Cleanup legacy Python scripts and update test runner

**What to build:** Remove legacy Python scripts and tests from the engineering-workflow skill directory and update repository configuration so the test runner operates without Python dependencies.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Remove `skills/agents/engineering-workflow/scripts/` and `skills/agents/engineering-workflow/tests/`
- [x] Update `package.json` to remove Python test invocation (`test:engineering-workflow`)
- [x] Verify `npm run test:repo` executes without script missing errors
