# Specification: Universal Engineering Workflow with Capability-Based Routing and Subagent Execution Loop

## Problem Statement

The existing `engineering-workflow` skill contains tight runtime couplings to Claude Code and Codex (e.g., hardcoded `--runtime <claude|codex>` checks and vendor-specific invocation policies). Furthermore, transitioning from planning to implementation previously mandated a manual `/clear` phase boundary by the human user. In modern agent environments (such as Antigravity, Cursor, Roo Code, Aider, etc.) that support native subagents or clean tool execution, this manual step introduces unnecessary friction and limits full autonomous end-to-end orchestration.

## Solution

Upgrade `engineering-workflow` into a **Universal Agent Control Plane** with:
1. **Capability-Based Resolution**: Replace vendor name branching with dynamic feature flags (`has_subagents`, `has_bash_tool`, `is_interactive`).
2. **Sequential Subagent Execution Loop**: In Stage `IMPLEMENTATION`, iterate through the ordered tickets produced by `to-tickets`, dispatching an isolated transient subagent (`self`) per ticket to maintain reasoning within the Smart Zone.
3. **Progressive Phase Boundary**: Automatically fork subagents when supported; fallback gracefully to `/clear` + `continue` for single-threaded CLI runtimes.
4. **Markdown/Rules-First Portability**: Keep the core lightweight, cross-platform, and portable across all agent environments.

## User Stories

1. **US1 (Universal Agent Compatibility)**: As a developer using any AI agent (Antigravity, Cursor, Aider, Claude Code, Codex, etc.), I want the workflow to work seamlessly without failing on unrecognized runtime names.
2. **US2 (Automated Ticket Execution Loop)**: As a developer in a subagent-capable environment, I want the orchestrator to automatically dispatch isolated subagents for each ticket in sequence so that I don't have to manually execute or clear context after every ticket.
3. **US3 (Graceful CLI Fallback)**: As a developer using a standalone terminal CLI, I want clear `/clear` and `continue` instructions when subagent capabilities are absent, preserving full backward compatibility.
4. **US4 (Verified State Tracking per Ticket)**: As a developer, I want the workflow state (`.agents/workflows/<id>.json`) to track progress per ticket with CAS validation and test verification evidence before advancing.

## Implementation Decisions

### 1. Capability-Based Audit (`scripts/dependency_audit.py`)
- Deprecate hardcoded `--runtime claude|codex` in favor of `--capability <feature>` or automatic capability probing.
- Support standard agent skill paths (`.agents/skills/`, `.gemini/skills/`, `.cursor/rules/`, `~/.claude/`, etc.).
- Normalize capability flags: `has_subagents` (bool), `has_bash_tool` (bool), `is_interactive` (bool).

### 2. Sequential Subagent Ticket Loop Contract (`references/states.md` & `references/feature-flow.md`)
- Update `IMPLEMENTATION` stage contract:
  - **Input**: Ordered list of tickets from `to-tickets`.
  - **Loop**:
    1. Set active ticket in workflow state via `set-work-item <id> <ticket-ref>`.
    2. If `has_subagents == true`, spawn `invoke_subagent` (`TypeName: "self"`) with scoped prompt (ticket details + verification command).
    3. Subagent implements changes, executes tests, and returns summary + test evidence.
    4. Orchestrator records verification and advances to the next unblocked ticket.
    5. If `has_subagents == false`, output `/clear` and `/implement <ticket>` resumption instructions.

### 3. Core Specification Documentation Updates
- Update `SKILL.md`: Update invocation guidelines to be universal and explain the Progressive Phase Boundary and Subagent Ticket Loop.
- Update `references/dependencies.md` and `references/architecture.md`: Document capability-based detection and universal portability.

## Testing Decisions

### Seams & Verification Criteria
- **Seam 1 (Audit Capability Unit Tests)**: Unit tests in `skills/agents/engineering-workflow/tests/test_dependency_audit.py` verifying that audit passes under various capability combinations without requiring specific runtime strings.
- **Seam 2 (Ticket Loop State Transitions)**: Tests in `tests/test_workflow_transitions.py` ensuring `set-work-item` and multi-ticket iterations maintain Atomic CAS and valid fingerprinting.
- **Seam 3 (Backward Compatibility Test)**: Ensure existing `.agents/workflows/*.json` v1/v2 schema files load and resume cleanly.

## Out of Scope

- Implementing heavy MCP Server binaries or custom GUI webviews (keeping it pure Markdown & Python standard library).
- Automatic Git push or pull request creation without explicit user permission.

## Further Notes

- Maintains strict compliance with ADR 0001 and ADR 0002 ("One Orchestrator, Zero Replacement Workers").
