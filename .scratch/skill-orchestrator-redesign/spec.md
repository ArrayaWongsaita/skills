# Spec: Full-Lifecycle Skill Orchestrator & Engineering Workflow Refactor

**Status:** ready-for-agent

## Problem Statement

Engineers using AI coding skills face high cognitive load when coordinating fragmented standalone tools (grilling, specification, ticket breakdown, implementation, reviews). Furthermore, child skills configured with disabled model invocation cannot be invoked automatically via tool calls, causing orchestration failures. Long multi-stage sessions also accumulate token clutter, degrading reasoning capacity during critical implementation stages.

## Solution

A cohesive, end-to-end skill orchestration architecture where `grill-with-docs` acts as the full-lifecycle guide from initial interview to committed code. The orchestrator executes child skills inline by reading their instruction files, groups all feature artifacts under a dedicated `.scratch/<feature-slug>/` directory, enforces quality review gates, and provides explicit phase boundaries (`/clear`) to maintain peak model reasoning inside the Smart Zone. Concurrently, `engineering-workflow` is refactored into a high-leverage control plane following positive prompting and progressive disclosure principles.

## User Stories

1. As an engineer with a new feature idea, I want to invoke a single slash command, so that I am guided through the entire engineering lifecycle without manually chaining individual skills.
2. As an engineer, I want the orchestrator to inspect existing domain glossaries and architectural decisions before grilling, so that we use consistent project vocabulary from the start.
3. As an engineer, I want the grilling session to run in structured rounds with recommended answers, so that I only need to make high-level decisions while the AI handles fact-finding.
4. As an engineer, I want domain terminology and architectural decisions captured into feature-scoped documentation, so that a permanent paper trail is preserved.
5. As an engineer, I want the conversation synthesized into a formal specification without being re-interviewed, so that requirements and testing seams are solidified quickly.
6. As an engineer, I want an outsider design review gate to scrutinize the spec before ticket breakdown, so that over-engineering and flawed seams are caught early.
7. As an engineer, I want the design gate to have bounded cycle limits and clear verdicts, so that the AI does not get stuck in infinite correction loops.
8. As an engineer, I want the spec decomposed into tracer-bullet vertical slices with explicit blocking dependencies, so that implementation can proceed incrementally.
9. As an engineer, I want tickets saved as individual files in a dedicated feature directory, so that each task is self-contained and agent-grabbable.
10. As an engineer, I want an explicit phase boundary checkpoint between planning and coding, so that I can reset the context window and keep the AI in its optimal reasoning zone.
11. As an engineer in a fresh context window, I want a direct command to start implementation on the first unblocked ticket, so that I do not lose context after resetting.
12. As an engineer, I want implementation to be driven test-first at pre-agreed seams, so that every delivered behavior is verified with automated tests.
13. As an engineer, I want every implemented ticket reviewed across both Standards and Spec axes before committing, so that code quality and requirement compliance are guaranteed.
14. As an engineer modifying high-risk subsystems, I want a final system review gate, so that end-to-end execution paths, concurrency, and error handling are verified.
15. As an engineer maintaining the skills repository, I want the orchestrator skill written using positive prompting and progressive disclosure, so that model adherence is maximized and token load is minimized.

## Implementation Decisions

### Modules to Build / Modify
- **Full-Lifecycle Orchestrator Skill**: Enhanced to manage all phases (Discovery, Specification, Design Gate, Ticket Breakdown, Context Reset, Implementation Loop, System Review).
- **Engineering Workflow Control Plane**: Refactored to eliminate negative steering, streamline state management, and adopt leading words.
- **Feature Storage Container**: Standardized directory structure under the feature scratch root for all produced artifacts.

### Interface & Orchestration Contracts
- **Inline Skill Execution**: The orchestrator reads child skill instructions directly from local repository skill definitions rather than attempting model-driven tool calls.
- **Structured Interactive Gates**: The orchestrator pauses for explicit user confirmation at four distinct milestones (Post-Discovery, Post-Spec/Design, Post-Tickets, and Post-Ticket Implementation).
- **Quality Gate Normalization**: Design reviews normalize verdicts into four actionable outcomes (Pass, Minor Correction, Rework, or Reject) with an independent 6-cycle budget.
- **Context Boundary Protocol**: After ticket breakdown, the orchestrator outputs an explicit context flush instruction alongside the exact command needed to resume implementation in a fresh session.

### Artifact Schema
- **Domain Glossary**: Contains definitions for ubiquitous language and boundary concepts.
- **Architectural Decision Record**: Contains context, decision, and consequences for hard-to-reverse architectural choices.
- **Feature Specification**: Follows problem, solution, user stories, implementation decisions, and testing decisions.
- **Vertical Ticket**: Includes user-perspective build objective, acceptance criteria, and blocker references.

## Testing Decisions

### What Makes a Good Test
A good test verifies that the orchestrator correctly guides the multi-stage lifecycle, respects gate budgets, writes artifacts to the correct feature directory, and executes child skill instructions without failing on model-invocation restrictions.

### Modules Tested
- Orchestrator skill definition and stage progression logic.
- Control plane state consistency and command interfaces.
- Feature artifact layout and directory structure generation.

### Prior Art
- Standard Matt Pocock micro-skills architecture (`ask-matt`, `grilling`, `to-spec`, `to-tickets`, `implement`).
- Two-axis code review and outsider scrutinize review patterns.

## Out of Scope
- Modifying underlying third-party issue tracker integrations (Linear, Jira, GitHub Issues).
- Automatic git pushing or remote pull request merging without explicit command.
- Modifying external standalone skills unrelated to the core engineering lifecycle.

## Further Notes
- All child skills with disabled model invocation are preserved as standalone tools for manual user invocation when needed.
- Feature artifacts remain isolated per feature slug, allowing concurrent feature exploration without workspace collisions.
