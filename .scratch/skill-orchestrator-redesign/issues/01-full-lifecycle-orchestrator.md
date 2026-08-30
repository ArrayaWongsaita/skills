# 01: Full-Lifecycle Orchestrator Skill

**What to build:** Transform `grill-with-docs` into an end-to-end orchestrator that sequences Phase 1 (Discovery/Grilling), Phase 2 (Spec & Design Gate), Phase 3 (Tickets), Phase 4 (Context Boundary), Phase 5 (Implementation Loop), and Phase 6 (System Review) using inline skill execution and feature-scoped storage.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Update `grill-with-docs/SKILL.md` to define the complete sequential lifecycle.
- [x] Implement inline execution instructions that read child `SKILL.md` files directly.
- [x] Configure feature-scoped directory structure under `.scratch/<feature-slug>/` for all artifacts.
- [x] Define explicit user confirmation gates post-Grilling, post-Spec, and post-Tickets.
- [x] Output clear context-clearing instructions (`/clear`) with resume commands at the phase boundary.
