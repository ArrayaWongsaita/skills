---
name: grill-with-docs
description: "Full-lifecycle engineering orchestrator that guides a feature end-to-end from discovery interview and domain modeling to specification, design gate, vertical ticket breakdown, context boundary, test-driven implementation, and quality review."
disable-model-invocation: true
---

# Full-Lifecycle Orchestrator

The orchestrator guides an engineering effort end-to-end through six sequential phases from initial idea to verified, committed code.

```
Phase 1: Discovery & Domain Modeling
   │ (Gate 1: Post-Discovery Confirmation)
   ▼
Phase 2: Specification & Design Gate
   │ (Gate 2: Post-Spec / Design Confirmation)
   ▼
Phase 3: Vertical Ticket Breakdown
   │ (Gate 3: Post-Tickets Confirmation)
   ▼
Phase 4: Context Boundary (Smart Zone Reset)
   │ (/clear + resume command)
   ▼
Phase 5: Test-Driven Implementation Loop
   │ (Gate 4: Post-Ticket Confirmation)
   ▼
Phase 6: System Review & Wrap-Up
```

---

## Operating Principles

### Inline Skill Execution

Child skills configured with `disable-model-invocation: true` (`to-spec`, `to-tickets`, `implement`, etc.) cannot be invoked automatically through runtime tool calls. Execute each child skill inline by directly reading its instructions (`.agents/skills/<skill>/SKILL.md`) and following its workflow steps.

### Feature-Scoped Storage

Store all feature artifacts in a dedicated directory under `.scratch/<feature-slug>/`:

```
.scratch/<feature-slug>/
├── CONTEXT.md       # Domain glossary and ubiquitous language
├── adr/             # Architectural Decision Records (0001-<slug>.md)
├── spec.md          # Feature specification
└── issues/          # Tracer-bullet vertical tickets (01-<slug>.md, ...)
```

Derive `<feature-slug>` from the feature name (lowercase alphanumeric with hyphens).

### Smart Zone and Context Boundaries

High-cognitive planning (Phases 1–3) operates in a single unbroken context window. Once tickets are published, clear context (`/clear`) to maintain sharp reasoning in the model's Smart Zone (~150k tokens) before entering the implementation loop.

---

## Phase 1: Discovery & Domain Modeling

Guide the engineer through requirement discovery and domain modeling concurrently.

### 1. Ground in Existing Context
Inspect the repository for existing domain vocabulary and architectural context:
- Read root `CONTEXT.md` and `docs/adr/` if present.
- Read existing feature directories under `.scratch/` if relevant.
- Initialize `.scratch/<feature-slug>/` for the current feature.

### 2. Relentless Interview (Inline `grilling`)
Follow the instructions in [`.agents/skills/grilling/SKILL.md`](../grilling/SKILL.md) inline:
- Map decisions as a **design tree**.
- Work the tree in **rounds** across the **frontier** (all decisions whose prerequisites are settled).
- Format each round with numbered questions and recommended answers:
  ```
  ❓ **Q1** - **<question title>**: <question body and options>
  ➡️ <recommended answer>
  ```
- Gather facts autonomously through repository inspection and tool lookups; reserve questions for human decisions.

### 3. Active Domain Modeling (Inline `domain-modeling`)
Follow the instructions in [`.agents/skills/domain-modeling/SKILL.md`](../domain-modeling/SKILL.md) inline:
- Challenge overloaded terms and resolve fuzzy terminology into canonical names.
- Record domain terms inline into `.scratch/<feature-slug>/CONTEXT.md`.
- Record hard-to-reverse architectural choices into `.scratch/<feature-slug>/adr/NNNN-<slug>.md` using the format in [`.agents/skills/domain-modeling/ADR-FORMAT.md`](../domain-modeling/ADR-FORMAT.md).

### Gate 1: Post-Discovery Confirmation
When the decision frontier is empty:
1. Summarize the agreed domain glossary and architectural decisions.
2. Present the summary to the user.
3. Pause for explicit user confirmation before proceeding to Phase 2.

---

## Phase 2: Specification & Design Quality Gate

Synthesize the clarified intent into a formal specification and validate it with an outsider design review.

### 1. Spec Synthesis (Inline `to-spec`)
Follow the instructions in [`.agents/skills/to-spec/SKILL.md`](../to-spec/SKILL.md) inline:
- Synthesize the conversation context, glossary, and ADRs directly into `.scratch/<feature-slug>/spec.md`.
- Structure the document with standard sections:
  - **Problem Statement**: User-facing problem description.
  - **Solution**: User-facing solution description.
  - **User Stories**: Numbered list covering user interactions (`As a <actor>, I want <feature>, so that <benefit>`).
  - **Implementation Decisions**: Target modules, interface changes, schema updates, and architectural contracts.
  - **Testing Decisions**: Pre-agreed test **seams** and behavior-focused verification criteria.
  - **Out of Scope**: Explicit boundaries.
  - **Further Notes**: Auxiliary context.

### 2. Outsider Design Gate (Inline `scrutinize`)
Follow the instructions in [`.agents/skills/scrutinize/SKILL.md`](../scrutinize/SKILL.md) inline to review `spec.md`:
- **Intent**: Evaluate whether a simpler or more elegant alternative achieves the same outcome with less complexity.
- **Trace**: Walk proposed interfaces against real codebase structures and verify that pre-agreed seams exist.
- **Verdicts**: Classify findings into one of four actionable outcomes:
  - `Pass`: Spec is sound and ready for ticket decomposition.
  - `Minor Correction`: Small clarifications needed; apply edits directly.
  - `Rework`: Structural gaps identified; revise spec and re-review within a 6-cycle gate budget.
  - `Reject`: Core concept is unviable; return to Phase 1.

### Gate 2: Post-Spec / Design Confirmation
Present the finalized `spec.md` and design review verdict to the user. Pause for explicit user confirmation before proceeding to Phase 3.

---

## Phase 3: Vertical Ticket Breakdown

Decompose the specification into actionable, tracer-bullet vertical slices.

### 1. Decompose into Vertical Slices (Inline `to-tickets`)
Follow the instructions in [`.agents/skills/to-tickets/SKILL.md`](../to-tickets/SKILL.md) inline:
- Break `spec.md` into tracer-bullet tickets where each ticket cuts through all layers (schema, logic, interface, tests).
- Size each ticket to fit inside a single fresh context window.
- Sequence wide refactors using expand-contract patterns.
- Declare explicit dependency edges (`Blocked by`) for each ticket.

### 2. Write Feature Tickets
Write each ticket as an individual markdown file under `.scratch/<feature-slug>/issues/<NN>-<slug>.md`:
```markdown
# <NN>: <Ticket title>

**What to build:** End-to-end behavior delivered by this ticket.

**Blocked by:** Ticket numbers/titles that must complete first, or "None (can start immediately)".

**Status:** ready-for-agent

- [ ] Acceptance criterion 1
- [ ] Acceptance criterion 2
```

### Gate 3: Post-Tickets Confirmation
Present the complete ticket list, granularity, and dependency chain to the user. Pause for explicit user confirmation before proceeding to Phase 4.

---

## Phase 4: Context Boundary (Smart Zone Reset)

Protect model reasoning inside the Smart Zone (~150k tokens) by shedding accumulated planning tokens before writing code.

### 1. Context Reset Instructions
Output clear instructions for the user to reset the session:
```text
Phase 3 planning complete. All artifacts are saved in `.scratch/<feature-slug>/`.

To preserve peak reasoning in the Smart Zone for implementation, reset context:
Run: /clear
```

### 2. Resume Command
Provide the exact command to begin implementation in the fresh session:
```text
Then resume with:
/implement .scratch/<feature-slug>/issues/01-<first-ticket-slug>.md
```

---

## Phase 5: Test-Driven Implementation Loop

Execute tickets on the dependency frontier incrementally.

### 1. Frontier Ticket Selection
Identify unblocked tickets (`Blocked by: None` or all blockers completed).

### 2. Test-Driven Development (Inline `tdd`)
Follow the instructions in [`.agents/skills/tdd/SKILL.md`](../tdd/SKILL.md) inline:
- Confirm test seams with the user before writing tests.
- Execute the red-green-refactor loop: write failing tests at pre-agreed seams first, then add minimal code to make them pass.
- Run targeted tests and typechecks frequently.

### 3. Two-Axis Code Review (Inline `code-review`)
Follow the instructions in [`.agents/skills/code-review/SKILL.md`](../code-review/SKILL.md) inline:
- Evaluate the diff against the merge-base along two independent axes:
  - **Standards**: Verify adherence to repository standards and Fowler code smells.
  - **Spec**: Verify complete satisfaction of the ticket's acceptance criteria without scope creep.
- Address any blocking findings.

### 4. Commit and Progress
- Commit verified changes to the current branch.
- Update ticket status in `.scratch/<feature-slug>/issues/<NN>-<slug>.md`.

### Gate 4: Post-Ticket Implementation Confirmation
Present ticket completion summary and test results to the user. Confirm before starting the next unblocked ticket on the frontier.

---

## Phase 6: System Review & Wrap-Up

Perform final verification across the integrated feature.

### 1. System Scrutiny (Inline `scrutinize`)
For cross-cutting or high-risk features, perform an end-to-end review across all implemented tickets:
- Trace end-to-end execution paths, concurrency, error boundaries, and state transitions.
- Verify that every acceptance criterion across all tickets in `.scratch/<feature-slug>/issues/` is satisfied.

### 2. Delivery & Pull Request
- Run the full test suite and typechecking.
- Provide a summary of all delivered artifacts and tickets.
- Provide instructions for preparing the pull request (e.g. `/pr-to-dev`).
