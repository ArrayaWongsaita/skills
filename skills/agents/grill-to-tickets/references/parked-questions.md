# Parked Questions

`.scratch/<feature-slug>/parked.md` holds questions the person cannot answer now.
Use one entry per question and retain its round/question identifier for later answers.

## Template

```markdown
# Parked Questions — <feature-slug>

## R<round> Q<number>

- question: <full question>
- why parked: <why the answer is unavailable now>
- blocking: <blocking or non-blocking>
- default assumption: <default to carry forward if accepted>
- owner: <the person, or the third party they name>
- status: open
```

The six fields are required. Status is one of `open`, `resolved: answered`,
or `resolved: assumed`. Start at `open`; retain the question and owner when
updating its status.

## Lifecycle

Parking closes the round line as `decided: parked`; `parked.md` supplies its
current state on resume. An open blocking entry holds the Stage 0 pause.
Accepting its default downgrades it to `resolved: assumed`; confirmation of the
pause resolves each non-blocking entry as `resolved: assumed` without a fresh
question. Stage 1 writes those defaults into Further Notes. A later answer
creates a new decision-log entry that names the parked question and supersedes
its assumed decision, then changes status to `resolved: answered`. When that
answer changes a value already written into `spec.md`, return to Stage 1 and
replace the assumption everywhere it appears, including Further Notes, before
handoff. Then rerun the affected downstream design-review and ticket stages. If
tickets already exist, reconcile them against the revised spec and rerun the
checker and ticket quiz before handoff. Preserve the review maximum and rounds
used in State; a late answer does not reset or re-ask for them. A late answer
that confirms the assumption does not invalidate downstream artifacts. The
pause summary and handoff list every entry still resolved as assumed, labelled
assumed.
