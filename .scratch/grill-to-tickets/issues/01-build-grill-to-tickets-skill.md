# 01: Build the `grill-to-tickets` skill

**What to build:** A standalone, user-invoked skill (`/grill-to-tickets`) that carries an idea from a relentless interview through to published, ticket-ready work, then stops — end to end this behaves as:

- **Frontmatter**: `name: grill-to-tickets`, a one-line description naming the full span (grill → spec → bounded design review → tickets, no implementation), `disable-model-invocation: true`. Ship `agents/openai.yaml` alongside it (`allow_implicit_invocation: false`, matching `to-spec`/`to-tickets`/`implement`).
- **Stage 0 (Grill)**: Ground in the repo's existing `CONTEXT.md`/`docs/adr` if present, initialize `.scratch/<feature-slug>/`, then inline-execute `grilling` and `domain-modeling` together (design-tree rounds, `CONTEXT.md`/ADR written inline as terms resolve). Pause for explicit confirmation once the frontier is empty.
- **Stage 1 (Spec)**: Inline-execute `to-spec` to synthesize the settled conversation into `.scratch/<feature-slug>/spec.md`. No re-interviewing.
- **Stage 2 (Design Review Gate)**: Inline-execute `scrutinize` against `spec.md`. Normalize its verdict using `scrutinize`'s own vocabulary (`SHIP` / `FIX_THEN_SHIP` / `REWORK` / `REJECT` — no paraphrasing). Keep one stable report file, `.scratch/<feature-slug>/design-review.md`, updated per cycle rather than a new file per retry. Route:
  - `SHIP` → Stage 3.
  - `FIX_THEN_SHIP` → apply the minimal verified fix directly to `spec.md`, consume one cycle, re-review.
  - `REWORK`, spec-level (the finding is about how the spec is written) → re-run `to-spec` with the finding as added context, consume one cycle, re-review.
  - `REWORK`, decision-level (the finding traces to a decision nobody made) → return to Stage 0 to re-grill that decision; do **not** reset the cycle counter.
  - `REJECT` → stop immediately and report to the user; never auto-loop back into grilling on a `REJECT`.
  - **Stall**: the same blocking finding survives two consecutive cycles with no new/resolved findings → stop early, report the stall, do not keep spending the budget.
  - **Budget exhaustion**: cycle 6 completes without `SHIP` → stop, report budget exhaustion, and require explicit human authorization before starting a fresh budget.
- **Stage 3 (Tickets)**: Once `SHIP`, inline-execute `to-tickets` against the shipped `spec.md`; publish tickets under `.scratch/<feature-slug>/issues/`.
- **Stop**: print a handoff message (context-boundary note + the exact `/clear` then `/implement <first ticket>` resume command). Never invoke `implement` itself.
- Must not modify `grill-with-docs`, any other `mattpocock/skills`-sourced file, or `skills-lock.json` (per `.scratch/grill-to-tickets/adr/0001-standalone-no-upstream-modification.md`).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `/grill-to-tickets` run end-to-end on a real idea produces published tickets without ever invoking `implement`
- [ ] A `FIX_THEN_SHIP` verdict edits `spec.md` directly and re-reviews without leaving Stage 2
- [ ] A spec-level `REWORK` re-runs `to-spec`; a decision-level `REWORK` returns to Stage 0 — the two are visibly distinguished in the gate report, with the agent's reasoning stated
- [ ] A `REJECT` verdict halts and reports to the user instead of auto-resuming grilling
- [ ] The same blocking finding recurring for two consecutive cycles halts with a stall report before cycle 6
- [ ] Cycle 6 completing without `SHIP` halts and states that a fresh budget needs explicit human authorization
- [ ] The cycle counter is never reset by a backward transition to Stage 0
- [ ] No edits are made anywhere under `.agents/skills/grill-with-docs/`, any other `mattpocock/skills`-sourced skill, or `skills-lock.json`
