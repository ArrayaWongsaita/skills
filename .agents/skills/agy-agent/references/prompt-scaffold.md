# Prompt Scaffolds for Delegation

Subagents begin with zero conversational history. Strong delegation requires
fully self-contained prompts with absolute filesystem paths, bounded scopes, and
explicit acceptance criteria.

## Core Prompt Structure

Store each prompt in a temporary file (`/tmp/agy-prompts/<task-id>.md`) using this
layout:

```markdown
# Objective
[Concise description of the goal]

# Context & Inputs
- Workspace root: /absolute/path/to/project
- Target files:
  - /absolute/path/to/project/src/file_a.ts
  - /absolute/path/to/project/src/file_b.ts
- Relevant docs/logs: /absolute/path/to/project/logs/build.log

# Instructions
1. Inspect the target files and relevant error logs.
2. Apply the requested changes strictly within the named files.
3. Run verification commands to confirm the result.

# Acceptance Criteria
- [ ] Command `npm test -- tests/target.test.ts` passes with exit code 0.
- [ ] All TypeScript types compile without errors via `npx tsc --noEmit`.
- [ ] Provide a concise markdown summary of changes and verification output.

# Return
Return your result as JSON matching the schema passed via --json-schema.
```

## Structured Return (`--json-schema`)

Write a schema next to the prompt (`/tmp/agy-prompts/<task-id>.schema.json`) and
pass `--json-schema <path>`. The subagent's schema-conforming object then arrives
in the envelope's `structured_output`, so Phase 4 reads fields instead of parsing
prose. A general-purpose schema:

```json
{
  "type": "object",
  "required": ["verdict", "summary"],
  "properties": {
    "verdict": { "enum": ["DONE", "BLOCKED", "PARTIAL"] },
    "files_changed": { "type": "array", "items": { "type": "string" } },
    "commands_run": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "cmd": { "type": "string" },
          "exit_code": { "type": "integer" }
        }
      }
    },
    "findings": { "type": "array", "items": { "type": "string" } },
    "summary": { "type": "string" }
  }
}
```

Each archetype below notes the fields worth requiring for that task shape.

---

## Archetype 1: Whole-Codebase Survey & Reconnaissance
*Model:* `--model gemini-3.8-flash-high` — Flash / high tier, 1M+ context.
*Return fields:* `verdict`, `findings`, `summary` (source stays untouched, so
`files_changed` is empty).

```markdown
# Objective
Perform a whole-codebase architecture survey of the repository at /Users/user/project.

# Target Area
- Scan directories: /Users/user/project/src/modules
- Review configuration files: package.json, tsconfig.json

# Instructions
1. Discover all exported service modules and their dependency directions.
2. Identify circular references or cross-boundary imports between modules.
3. List the primary domain models and where their persistence logic resides.

# Acceptance Criteria
- Return a structured markdown report containing:
  - Dependency direction table across all modules
  - Any circular or cross-layer import violations
  - Summary of persistence patterns
- Keep source code untouched.
```

---

## Archetype 2: Deep Bug Investigation & Log Crunching
*Model:* `--model gemini-3.1-pro-high` — Pro / high tier (the slug carries the
reasoning tier; no separate `--effort`).
*Return fields:* `verdict`, `files_changed`, `commands_run`, `summary`.

```markdown
# Objective
Investigate intermittent 504 Gateway Timeouts in the payment worker service.

# Inputs
- Service source: /Users/user/project/services/payment-worker
- Recent crash logs: /Users/user/project/logs/payment-errors.log
- Relevant test file: /Users/user/project/services/payment-worker/tests/worker.test.ts

# Instructions
1. Analyze /Users/user/project/logs/payment-errors.log to locate error spikes.
2. Trace the code path in /Users/user/project/services/payment-worker/src/processor.ts.
3. Formulate the root-cause hypothesis and identify missing timeout bounds.
4. Implement the fix in processor.ts and add a regression test covering the timeout path.
5. Execute the test suite to verify the fix.

# Acceptance Criteria
- [ ] New regression test reproduces the edge case and passes.
- [ ] Existing tests in services/payment-worker pass.
- [ ] Report root cause, code diff, and test output.
```

---

## Archetype 3: Bulk Mechanical Refactoring & Scaffolding
*Model:* `--model gemini-3.8-flash-medium` — Flash / medium tier for low-latency
mechanical work (drop to `gemini-3.8-flash-low` for the most trivial passes).
*Return fields:* `verdict`, `files_changed`, `commands_run`, `summary`.

```markdown
# Objective
Add TypeScript strict null checks and export interfaces for all models in /Users/user/project/src/models.

# Inputs
- Directory: /Users/user/project/src/models

# Instructions
1. Inspect all TypeScript files in /Users/user/project/src/models.
2. Ensure every interface explicitly marks optional fields with `?`.
3. Add JSDoc comments explaining each exported interface.

# Acceptance Criteria
- [ ] All files in /Users/user/project/src/models pass `npx tsc --noEmit`.
- [ ] Only documentation and type annotations are modified; runtime logic remains identical.
```

---

## Archetype 4: Cross-Provider Second Opinion
*Model:* a family different from the host — `--model gemini-3.1-pro-high` when the
host is Claude Code; `--model claude-sonnet-4-6` when it is not.
*Return fields:* `verdict`, `findings`, `summary` (files stay untouched).

```markdown
# Objective
Perform an independent design and code review of the proposed changes in /Users/user/project/src/auth.

# Inputs
- Implementation: /Users/user/project/src/auth/session.ts
- Specification: /Users/user/project/docs/specs/auth-redesign.md

# Instructions
1. Review session.ts against the security requirements in auth-redesign.md.
2. Evaluate potential session fixation, token leakage, or replay attack surfaces.
3. Challenge the proposed token revocation strategy and propose simpler alternatives where viable.

# Acceptance Criteria
- Return a structured review report with:
  - Security audit findings prioritized by severity
  - Simplification opportunities
  - Verdict: SHIP / FIX_THEN_SHIP / REWORK / REJECT
- Keep files untouched.
```
