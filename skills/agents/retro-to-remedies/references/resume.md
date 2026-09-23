# Resume and Fresh Mode

A Retro survives a closed session. When re-running `/retro-to-remedies [<feature-slug>]` on a Run where a prior session left an existing Retro report at `.scratch/<feature-slug>/retro.md`, Stage 0 inspects the report state to determine whether to resume or start over.

## The Two Resume Points

An existing Retro report resumes execution at one of two deterministic resume points based on the state of its `Choice:` lines and committed Remedies:

1. **Unanswered choices → resume at the pause**:
   When the report contains unanswered `Choice:` lines, execution resumes at the Stage 1 decision pause using the existing report. All primary source collection and classification analysis are preserved without re-reading sources or recalculating proposals. The skill presents the existing report and awaits user choices.

2. **Answered choices but unapplied Remedies → resume at Stage 2**:
   When the report contains answered choices but some applied Remedies have not yet been committed (they lack recorded SHAs), execution resumes directly at Stage 2. It proceeds to apply and commit the remaining unapplied Remedies.

## The Skip Rule for Remedies with a Recorded SHA

During Stage 2 execution on a resumed run:
- Skip every Remedy that already has a recorded commit SHA in the Retro report.
- Only uncommitted applied Remedies are modified, committed as `chore(retro): <remedy>`, and updated with their commit SHA.
- Avoid repeating already committed changes or creating duplicate commits for Remedies with an existing SHA.

## The `--fresh` Flag

When invoked with `--fresh`, it replaces the report: `--fresh` discards the unfinished report and starts over by rebuilding from the primary sources.

- Discard the unfinished report at `.scratch/<feature-slug>/retro.md`.
- Re-read all Primary sources and the Retro Log during Stage 0, re-run classification and ranking during Stage 1, and generate a new Retro report from scratch.
- Use `--fresh` when primary sources or git history changed after an aborted run or when a clean re-evaluation is desired.
