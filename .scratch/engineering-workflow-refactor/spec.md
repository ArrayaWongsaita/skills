# Feature Specification: Pure-Prompt Engineering Workflow Control Plane

**Feature Slug:** `engineering-workflow-refactor`
**Triage Status:** `ready-for-agent`

---

## Problem Statement

Engineers and AI agents using the `engineering-workflow` skill frequently encounter two critical failure modes:
1. **Environment Fragility & Dependencies**: The existing orchestrator relies on Python CLI scripts (`workflow_state.py`, `dependency_audit.py`). In environments without Python 3 installed, misconfigured paths, or missing execution permissions, the workflow fails immediately.
2. **Agent Premature Completion & Flow Evasion**: Because language models possess strong action biases toward immediate code editing, agents tend to ignore external CLI state tools and skip directly to modifying source files without performing structured discovery, planning, or respecting gate approvals.

---

## Solution

Transform `engineering-workflow` into a **Pure-Prompt, Zero-Script Control Plane** that enforces orchestration entirely through cognitive scaffolding, attention pinning, and prompt-driven gates:
1. **Zero-Script Operation**: Eliminate all runtime Python script requirements. All state transitions, route classification, and gate records operate natively through markdown artifacts and prompt instructions.
2. **State Anchor Cognitive Pinning**: Enforce a mandatory Compact State Header output at the beginning of every agent response to pin the model's attention to the active stage and prevent context drift.
3. **Adaptive Gating with Hard Stops**: Implement unambiguous phase boundaries (Read-Only Discovery, Post-Discovery Approval, Spec Gate, Ticket Breakdown Gate, and Smart Zone Context Boundary) that prevent code edits before authorization.
4. **Markdown State Persistence**: Persist workflow records directly into human-readable, repo-friendly markdown files (`.scratch/<feature-slug>/status.md` or `.agents/workflows/<id>.md`) using standard file operations.

---

## User Stories

1. As an engineer operating on a minimal container or machine without Python installed, I want to invoke `/engineering-workflow <request>`, so that I can run multi-stage engineering tasks without installing Python or external dependencies.
2. As a tech lead, I want the AI agent to output a clear `### 📋 Workflow: [<STAGE>]` state header at the start of every response, so that I can immediately verify which stage the agent is in and what gate it is targeting.
3. As a developer, I want the agent to operate in read-only mode during Discovery and Planning, so that no unwanted code modifications or accidental file deletions occur before an agreed plan is formed.
4. As an engineer, I want the agent to present a concise Execution Plan and explicitly pause for my confirmation before editing any source files, so that I maintain full control over the architectural direction.
5. As a developer with a small, low-risk task, I want the workflow to use Adaptive Gating (1 single approval stop before implementation), so that I am not interrupted by unnecessary intermediate gates on trivial fixes.
6. As a lead working on a large or high-risk feature, I want the workflow to enforce full multi-stage gates (Discovery Gate $\rightarrow$ Spec Gate $\rightarrow$ Tickets Gate $\rightarrow$ Context Boundary), so that complex requirements are thoroughly vetted before coding.
7. As an agent orchestrator, I want progressive disclosure reference documents (`references/feature-flow.md`, `references/adaptive-gating.md`, etc.), so that I can consult specialized rules on-demand without bloating the immediate context window.
8. As a maintainer, I want all legacy Python scripts and Python tests in the skill directory to be cleaned up, so that the codebase contains no dead code or broken unexecutable scripts.
9. As a test harness engineer, I want repository-level contract tests (`node --test tests/*.test.mjs`) to validate that the new prompt-based orchestrator satisfies all structural, frontmatter, and non-negative steering guidelines.
10. As a developer resuming an interrupted workflow, I want the agent to read `.scratch/<feature-slug>/status.md` and reconcile reality against git status, so that work can resume seamlessly without lost context.

---

## Implementation Decisions

### 1. Skill Entry Point Architecture
- The main entry point will be the canonical `skills/agents/engineering-workflow/SKILL.md` (and its mirrored installation).
- Maintain YAML frontmatter with `name: engineering-workflow`, `disable-model-invocation: true`, and a clear description containing triggers.
- Eliminate all execution calls to `python3 scripts/workflow_state.py` and `scripts/dependency_audit.py`.

### 2. State Scaffolding & State Anchor Protocol
- Mandatory instruction requiring the agent to output a compact Markdown State Block at the beginning of its first response and subsequent turns:
  - Active Stage Name
  - Feature Identifier & Workflow Type (`FEATURE`, `BUG`, `REFACTOR`)
  - Current Turn Objective
  - Active Gate Status (`AWAITING_APPROVAL`, `READY_TO_CODE`, `PASS`)
- Instruct the agent that modifying source files prior to reaching the `IMPLEMENTATION` stage constitutes an immediate protocol violation.

### 3. State Persistence Schema (Markdown Artifact)
- Standardize the state file format under `.scratch/<feature-slug>/status.md`:
  - **Metadata**: ID, Type, Risk, Started At, Current Stage
  - **Decision Log**: Key architectural choices made during discovery
  - **Gate Checklist**: Checkboxes for Discovery Gate, Spec Gate, Tickets Gate, Code Review Gate
  - **Active Frontier / Tasks**: List of actionable vertical slices and their progress

### 4. Progressive Disclosure & Reference Layout
- Keep the root `SKILL.md` focused purely on the top-level control plane steps and rules.
- Retain and rewrite reference documents in `references/`:
  - `adaptive-gating.md`: Rules for small vs large project gate budgets and pauses.
  - `feature-flow.md`: End-to-end steps for feature delivery.
  - `bug-flow.md`: Incident diagnosis and regression verification steps.
  - `red-flags.md`: Rationalization traps and mandatory corrective behaviors.

### 5. Repository Cleanup & Tooling Update
- Remove `skills/agents/engineering-workflow/scripts/` and `skills/agents/engineering-workflow/tests/`.
- Update `package.json` scripts: remove python test invocation (`test:engineering-workflow`) and update `test:repo` / validator checks to verify markdown contracts.

---

## Testing Decisions

### Seam Architecture
- **Highest Seam**: The repository contract suite `node --test tests/*.test.mjs` and the validator script `node scripts/validate-skills.mjs`.
- Tests verify:
  1. YAML Frontmatter validity (`name`, `description >= 80 chars`, `disable-model-invocation: true`).
  2. Complete elimination of negative steering words (`Do not`, `Never`) in accordance with agent instruction standards.
  3. Correct progressive disclosure link targets within `references/`.
  4. Proper validation of skill index generation via `npm run docs:index`.

---

## Out of Scope

- Developing native binary plugins or GUI integrations for specific IDEs.
- Building custom network API servers or background daemons for workflow tracking.
- Altering the behavior of external specialist skills (e.g. `grill-with-docs`, `tdd`, `code-review`).

---

## Further Notes

- The design adheres to the principles of `writing-for-agents` and `ADR 0003`.
- Fully backwards compatible with all major AI coding agents (Antigravity, Claude Code, Cursor, Windsurf, Codex).
