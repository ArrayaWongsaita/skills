# 0001: Full-Lifecycle Skill Orchestration and Feature-Scoped Storage

## Status
Accepted

## Context
When engineers use standalone AI skills, they often face cognitive friction switching between disconnected tools (`grilling`, `to-spec`, `to-tickets`, `implement`, `code-review`). Furthermore, child skills configured with `disable-model-invocation: true` cannot be called autonomously via runtime tool calls. Without a unified orchestrator and structured context reset boundaries, context windows degrade over multi-step workflows.

## Decision
1. Refactor `grill-with-docs` to serve as a Full-Lifecycle Orchestrator leading the entire flow from discovery to verified implementation.
2. Adopt **Inline Execution**: the orchestrator reads child skill instructions directly from local skill definition files (`SKILL.md`) rather than attempting runtime tool calls.
3. Establish a **Feature-Scoped Artifact Directory** under `.scratch/<feature-slug>/` to hold all feature assets (`CONTEXT.md`, `adr/`, `spec.md`, `issues/`).
4. Enforce an explicit **Phase Boundary**: instruct the user to `/clear` context before implementation, providing a resume command for the fresh session.
5. Refactor `engineering-workflow` to adhere strictly to "Writing for Agents" principles (positive framing, leading words, and progressive disclosure).

## Consequences
- **Positive**: Engineers gain a seamless, guided workflow from idea to code without memorizing individual slash commands.
- **Positive**: AI reasoning stays sharp inside the Smart Zone due to explicit context flushing before implementation.
- **Positive**: Clean file isolation per feature in `.scratch/<feature-slug>/`.
- **Trade-off**: Requires reading skill definition files directly from the repository, assuming standard skill directory layouts.
