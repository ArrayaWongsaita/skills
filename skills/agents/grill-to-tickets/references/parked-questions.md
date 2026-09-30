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
creates a new decision-log entry and changes status to `resolved: answered`.
The pause summary and handoff list every assumed entry, labelled assumed.
