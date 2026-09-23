# Retro Report Structure

The Retro report is written to `.scratch/<feature-slug>/retro.md` at the end of Stage 1. It structures the findings and proposed environment remedies into a transparent report that pauses for user decisions.

## Sections in Order

The report must contain the following six sections in exact order:

1. **Sources read and missing**: All Primary sources inspected during Stage 0, followed by expected sources that were missing.
2. **Handed-off follow-ups**: Any prior handed-off Remedies queried from `docs/retro-log.md` and their user-confirmed status answers (`applied`, `handed-off`, or `declined`).
3. **Project Remedies**: Proposed project-level Remedies ranked by cost and recurrence (Failed Remedies, recurring, costly misses, then the rest).
4. **Skill fixes**: Proposed fixes for skills, split into own library (with ready-to-run `/grill-to-tickets` prompt) and Upstream feedback.
5. **Carried findings**: Each non-blocking finding from `review-status.md`, mapped to a concrete Remedy or a proposed decline with rationale.
6. **Open bugs**: Defects in the feature's own code, reported for `/diagnosing-bugs` and never as Remedies.

## Remedy Fields

Every proposed Remedy in the report must present the following fields:

- **id**: Scoped stable identifier in the form `R-<feature-slug>-<NN>`.
- **kind**: One of the six kinds: Check, Standard, Pointer, Skill fix, Prune, or Access.
- **severity reason**: Why this Remedy was prioritized (e.g. Failed Remedy, recurring, review blocker, BLOCKED ticket, failed verification, design rework cycle without SHIP).
- **Misses**: Bulleted list of each covered Miss, including its source location (file plus id, line, or commit SHA) and verbatim quote.
- **destination**: Where the Remedy lands (e.g. `CODING_STANDARDS.md`, `AGENTS.md`, or handed off).
- **exact change or /grill-to-tickets prompt**:
  - For Text remedies (Standard, Pointer, Prune): The exact change to be added, modified, or deleted, including the target file.
  - For Code remedies (Check, Skill fix, Access): The exact `/grill-to-tickets` prompt ready to be handed off.

- **recommended answer**: The Retro's recommended action (`apply`, `hand off`, `decline`, or `defer`).
- **Choice: line**: An explicit `Choice:` line awaiting user input.

## Choice Validity

The human answers each Remedy with one of four choices: `apply`, `hand off`, `decline`, or `defer`.
- `apply` is valid only for Text remedies (Standard, Pointer, Prune).
- `hand off` is valid only for Code remedies (Check, Skill fix, Access).
- `decline` and `defer` are valid for all Remedies.
