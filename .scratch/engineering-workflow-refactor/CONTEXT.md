# Context: Pure-Prompt Engineering Workflow Refactor

## Domain Glossary & Ubiquitous Language

| Term | Meaning |
|---|---|
| **Pure-Prompt Workflow** | A multi-stage engineering control plane implemented entirely in markdown prompt instructions, requiring zero external runtime scripts (no Python, no Node scripts required for state management). |
| **State Anchor Block** | A mandatory markdown block that the agent must print as the very first output in every response to pin attention and enforce the active stage. |
| **Phase Boundary / Hard Stop** | A terminal condition at the end of a stage where the agent must stop calling tools and await explicit human confirmation before proceeding. |
| **Markdown State Artifact** | A project-relative markdown file (e.g. `.agents/workflows/<id>.md` or `.scratch/<slug>/status.md`) used to persist workflow progress, decisions, and gate outcomes. |
| **Orchestrator Role** | The agent's mode where it only performs classification, discovery, review, and subagent delegation, strictly forbidden from modifying source code directly during planning phases. |
