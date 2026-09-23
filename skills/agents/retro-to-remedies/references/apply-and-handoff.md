# Apply and Handoff

Stage 2 applies approved Text remedies, creates individual commits on the working branch, runs verification checks once, and presents the handoff prompts before `/pr-to-dev`.

## Destinations

Apply each approved Text remedy (`apply`) directly at its assigned destination:

- **Standard**:
  - Apply into `CODING_STANDARDS.md`.
  - When `CODING_STANDARDS.md` is absent from the project, it is created with a short header (e.g. `# Coding Standards\n\nProject rules and conventions.`) before appending the new standard rule.
  - When the Standard represents a reuse convention, apply it into the Reuse Catalog's Rules section (for example in `docs/reuse-catalog.md`).
- **Pointer**:
  - Apply into `AGENTS.md`, else `CLAUDE.md`, else a new `AGENTS.md`.
  - Add one navigation line identifying the document and specifying when agents must read it.
- **Prune**:
  - Removed from the project instruction file holding it (`AGENTS.md`, `CLAUDE.md`, `CODING_STANDARDS.md`, or the Reuse Catalog's Rules).
  - An instruction inside a skill is not pruned here; it routes as a Skill fix.

## One-Commit-per-Remedy Rule

Each applied Remedy is committed individually on the current working branch (the integration branch):

1. Apply the exact text change for the single Remedy at its destination, and write its `applied` entry into `docs/retro-log.md` (creating the file with its self-describing header comment on the first Retro). An applied Remedy's entry is written in the same commit as its change.
2. Create a dedicated commit on the working branch with the exact subject format:
   ```text
   chore(retro): <remedy>
   ```
   where `<remedy>` is the concise summary of the remedy.
3. Obtain the resulting commit SHA.
4. Record the SHA; each commit's SHA is written into the Retro report (`.scratch/<feature-slug>/retro.md`) alongside the Remedy entry.

Three applied Remedies make three commits. Keep each applied Remedy in its own distinct commit; avoid combining multiple Remedies into a single commit or squashing them into feature commits.

## Final Log Commit Rule

Record every other Outcome (`handed-off`, `declined`, `deferred`) in `docs/retro-log.md` and commit it in one final commit on the working branch with the exact subject format:
```text
chore(retro): log <feature-slug>
```
This guarantees that the Retro Log is complete even when no Remedies were applied in the Run.

## Check Scripts Rule

After all applied Remedy commits are completed on the working branch, execute repository verification:

1. Inspect the project configuration (such as `package.json` scripts) for existing check scripts:
   - `validate`
   - `check`
   - `lint`
   - `test`
2. Run each of the project's `validate`, `check`, `lint`, and `test` scripts that exists, once.
3. If any script exits with a red result (failure / non-zero exit code):
   - A red result stops before the handoff and names the failing command and the Retro commit it follows.
   - Halt so the human can inspect and resolve the regression before any handoff.

## Handoff

When all check scripts pass cleanly (green):

1. Print each Code remedy's prompt in order:
   - Display the `/grill-to-tickets` prompt for Checks, Skill fixes, and Access remedies.
   - A Code remedy answered `hand off` appears only as a prompt; it is not applied or committed in this run.
2. Conclude the handoff by printing:
   ```text
   /pr-to-dev
   ```

### Stance

The run pushes nothing to remote branches, opens no pull request, and opens a GitHub issue only on an explicit request.
