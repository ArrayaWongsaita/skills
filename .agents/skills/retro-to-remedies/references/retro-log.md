# Retro Log

`docs/retro-log.md` serves as the durable per-project ledger recording every Remedy a Retro proposed, the Misses behind it, and what became of it across Runs. It outlives each individual Run so future Retros recognise recurring Misses (the strongest severity signal a Retro has) and avoid re-proposing previously declined Remedies unless the underlying Miss recurs after the decline.

The first Retro creates `docs/retro-log.md` with a self-describing header comment.

## Header Comment

When `docs/retro-log.md` is first created, it begins with a self-describing header comment defining entry format, Outcome states, the id rule, and specifying that only a Retro reads the file:

```markdown
<!--
docs/retro-log.md
Durable log of Environment Remedies proposed across Retros.

Entry format:
### <id> · <kind> · <outcome>
Remedy: <summary>
Misses:
- <slug> · <source#location> · <date> · "<quote>"
History:
- <date> <outcome>: <detail>

Outcome states:
- applied: the change is in place, made by a Retro or confirmed done after a hand-off.
- handed-off: a Code remedy's prompt was given and the change is not confirmed yet.
- declined: the user rejected the proposed Remedy.
- deferred: the user postponed decision on the proposed Remedy.

Id rule:
- R-<feature-slug>-<NN>, numbered within the Run that first proposed the Remedy, and never change.

Only a Retro reads this file to recognize recurrence and avoid re-proposing declined Remedies.
No Pointer to the Retro Log is added to AGENTS.md / CLAUDE.md; it costs context only while a Retro runs.
-->
```

Only a Retro reads the file; no Pointer to the Retro Log is added to `AGENTS.md` / `CLAUDE.md`, ensuring it costs context only while a Retro runs.

## Block Format

Every proposed Remedy is recorded as one block in `docs/retro-log.md`:

```markdown
### <id> · <kind> · <outcome>
Remedy: <summary>
Misses:
- slug · source#location · date · "quote"
History:
- date outcome: detail
```

Example from the spec:

```markdown
### R-opencode-implement-hosted-model-01 · Check · handed-off
Remedy: fail a feature branch whose commits edit files of a skill the feature does not name
Misses:
- opencode-implement-hosted-model · review-status.md#std-1 · 2026-09-23 · "Commit 22384f6 edited subagent-implement's …"
History:
- 2026-09-23 handed-off: /grill-to-tickets prompt in .scratch/opencode-implement-hosted-model/retro.md
```

Each block contains:
1. **Heading**: `### <id> · <kind> · <outcome>` indicating the Remedy id, Remedy kind (`Check`, `Standard`, `Pointer`, `Skill fix`, `Prune`, `Access`), and current Outcome.
2. **Remedy**: A single line starting with `Remedy:` summarising the intended change.
3. **Misses**: A section starting with `Misses:` containing one bullet per Miss occurrence formatted as:
   `- <slug> · <source#location> · <date> · "<quote>"`
   where each line provides `slug · source#location · date · "quote"`.
4. **History**: A section starting with `History:` containing chronological lines recording each outcome change:
   `- <date> <outcome>: <detail>`

### Recurrence and Update Rules

- **Recurrence**: When a Miss recurs in a later Run or after an applied Remedy, a new Miss line is appended under `Misses:`.
- **New Outcome**: When a Remedy's Outcome changes (for example from `handed-off` to `applied`, or upon user decision in Stage 1/2), append a History line under `History:` and updates the heading (`### <id> · <kind> · <outcome>`).

## Id Rule

Remedy ids follow the strict naming schema:
```text
R-<feature-slug>-<NN>
```
- `<feature-slug>` identifies the Run in which the Remedy was first proposed.
- `<NN>` is a two-digit integer (`01`, `02`, ...) numbered within the Run that first proposed the Remedy.
- Ids never change once minted.
- Because ids are scoped by feature slug, Retros running on parallel feature branches never mint the same id.

## Outcome States

A Remedy in the Retro Log always holds one of four Outcome states:

1. **`applied`**: The change is in place, made by a Retro (for Text remedies) or confirmed done after a hand-off (when the human confirms completion in Stage 0).
2. **`handed-off`**: A Code remedy's prompt (`/grill-to-tickets`) was given to the user, and the change is not confirmed yet.
3. **`declined`**: The user chose not to adopt the proposed Remedy. A declined Remedy is not proposed again unless the underlying Miss recurs after the decline.
4. **`deferred`**: The user postponed the decision on the proposed Remedy.

When a new Outcome occurs, updates the heading (`### <id> · <kind> · <outcome>`) and appends a History line with the date, new outcome, and context detail.

## Commit Rules

Stage 2 enforces two distinct commit rules when recording Remedies into `docs/retro-log.md`:

1. **Applied Remedy Commit Rule**:
   An applied Remedy's entry is written in the same commit as its change. Each applied Text remedy is committed individually on the working branch with:
   ```text
   chore(retro): <remedy>
   ```
   containing both the environment file change and the updated `docs/retro-log.md` entry.
2. **Final Log Commit Rule for Other Outcomes**:
   Every other Outcome (`handed-off`, `declined`, and `deferred`) is written in one final commit:
   ```text
   chore(retro): log <feature-slug>
   ```
   This ensures that the Retro Log is complete and accurate even when nothing was applied in the Run.

## Reading the Retro Log (Stages 0–1)

Retros learn from each other by reading `docs/retro-log.md` across Stages 0 and 1.

### Stage 0: Handed-Off Follow-Up

When `docs/retro-log.md` is present, Stage 0 reads it before reading Primary sources. For each Remedy still in the `handed-off` state, the Retro asks the user once:
- **done** → `applied`: the user confirms the Code remedy was implemented and is now in place in the Environment.
- **still pending** → stays `handed-off`: the prompt remains open and pending implementation.
- **drop** → `declined`: the user decides not to pursue the Remedy.

### Stage 1: Matching Against the Log

In Stage 1, before classifying Misses, the Retro matches candidate Remedies against `docs/retro-log.md` by the rule broken or lesson recorded:

1. **Same-Occurrence Rule**:
   A Miss whose slug and location the log already lists is the same occurrence, never a recurrence. When re-running a Retro on a Run whose Misses are already in the log, those Misses count as known occurrences and produce no new recurrence.

2. **Recurrence**:
   A recurrence is a Miss from another Run, or from the same Run after the Remedy's commit. When a Miss matches an existing Remedy in the log:
   - A recurrence of an `applied` Remedy makes it a **Failed Remedy**.
   - A recurrence of any other Remedy marks it as **recurring**.
   - For any recurrence, a new Miss line is appended under `Misses:` in the log.

3. **Failed Remedy Escalation**:
   An applied Remedy whose rule failed to hold escalates to a stronger Remedy kind:
   - **Standard** → **Check** where the rule is mechanical.
   - **Pointer** → sharper wording, then inlined material.
   - **Check or Skill fix** → a follow-up of the same kind citing the recurrence.

4. **The Declined Rule**:
   A `declined` Remedy returns only with a recurrence after the decline, showing both occurrences (the original occurrence and the new recurrence after the decline). Without a new occurrence after the decline, a declined Remedy is not proposed again.


