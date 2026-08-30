# Specification: Engineering Workflow Hardening & Quality Optimization

## Problem Statement

While `engineering-workflow` provides a universal multi-stage control plane, orchestrator agents dispatching subagents risk high variance in prompt formulation and can fall into infinite retry loops when a ticket's verification fails repeatedly. Furthermore, repository owners lack direct configuration snippets for popular agent harnesses (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`), and the evaluation suite lacks specific benchmarks for capability-aware behavior.

## Solution

Harden `engineering-workflow` by:
1. Defining a canonical **5-Section Subagent Prompt Scaffold** in the stage contract references.
2. Enforcing a deterministic **Per-Ticket Retry Budget (`MAX_TICKET_ATTEMPTS = 3`)** with clean failure escalation.
3. Publishing turnkey **Multi-Harness Directives** in the skill guide for `AGENTS.md`, `CLAUDE.md`, and `.cursorrules`.
4. Expanding `evals/evals.json` with **Capability Matrix Benchmark Cases** (Eval IDs 16 & 17).

## User Stories

1. As a workflow orchestrator, I want a structured 5-section prompt scaffold for dispatching ticket subagents, so that the subagent receives exact context, constraints, and test commands with zero prompt ambiguity.
2. As a workflow orchestrator, I want subagents to return only a concise diff summary and test output, so that the orchestrator's context window remains clean and unbloated.
3. As a developer running an automated workflow, I want the system to stop and block after 3 consecutive failed verification attempts on a single ticket, so that the agent does not waste tokens on endless loops.
4. As a developer inspecting a blocked ticket, I want the recorded error log and test failure output preserved in workflow state, so that I can quickly diagnose and fix the root cause.
5. As a developer adopting the skill in a new repository, I want copy-pasteable configuration directives for `AGENTS.md`, `CLAUDE.md`, and `.cursorrules`, so that my local AI agent immediately knows when and how to trigger the workflow.
6. As an engineer maintaining the skill, I want evaluation benchmarks verifying capability-aware routing (`has_subagents: true` vs `has_subagents: false`), so that regressions in orchestrator decision logic are caught automatically.

## Implementation Decisions

### 1. 5-Section Subagent Prompt Scaffold
- Document the standard dispatch structure in `references/states.md` under the `IMPLEMENTATION` contract:
  - **Section 1: Target Work Item** (Ticket title, file path, and summary)
  - **Section 2: Context & Seam** (Parent specification section, relevant ADR references, source file locations)
  - **Section 3: Verification** (Explicit test command, e.g. `npm test <file>` or `pytest <file>`)
  - **Section 4: Constraints** (Focus solely on this ticket; preserve unchanged files; adhere to repository standards)
  - **Section 5: Return Format** (Report only list of modified/created files and test pass output)

### 2. Per-Ticket Retry Budget (`MAX_TICKET_ATTEMPTS = 3`)
- Specify the retry bound in `references/states.md`:
  - Each ticket permits up to 3 implementation/fix attempts.
  - If tests fail on attempt 3, the orchestrator transitions the workflow to `BLOCKED (TICKET_VERIFICATION_FAILED)`.
  - Persist failure details and command output in `.agents/workflows/<id>.json` for human inspection and resumption.

### 3. Multi-Harness Directives in Skill Guide
- Add a dedicated "Harness Directives & Setup" section in `docs/skills/agents/engineering-workflow.md` providing copy-ready configurations:
  - `AGENTS.md` directive for universal AI coding agents.
  - `CLAUDE.md` directive for Claude Code.
  - `.cursorrules` / `.windsurfrules` directive for AI IDE environments.

### 4. Capability Benchmark Evals
- Add Eval ID 16: Verifies that when `has_subagents: true` is set, the orchestrator selects the sequential subagent loop during multi-ticket implementation without prompting for `/clear`.
- Add Eval ID 17: Verifies that when `has_subagents: false` is set, the orchestrator provides the `/clear` context boundary instructions before starting implementation.

## Testing Decisions

### Seams & Verification Criteria
- **Seam 1 (Stage Contract & Scaffold Verification)**: Validate that `references/states.md` contains the scaffold and retry policy while adhering strictly to positive steering (zero occurrences of "Do not / Never").
- **Seam 2 (Documentation & Link Integrity)**: Run `tests/engineering-workflow-contract.test.mjs` and `scripts/validate-skills.mjs` to ensure all links and markdown files are fully valid.
- **Seam 3 (Eval Schema & Content Validation)**: Validate `evals/evals.json` syntax and structure.

## Out of Scope

- Introducing GUI desktop application dependencies.
- Altering existing persisted workflow JSON schema versions.

## Further Notes

- Fully adheres to ADR 0001 and ADR 0002.
