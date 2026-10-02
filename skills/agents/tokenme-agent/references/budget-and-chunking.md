# Budget and Chunking Guide

How to size a delegate run against the planning budget, and how to split a
task that misses it. The eligibility checklist in
[delegation-policy.md](delegation-policy.md) makes "fits the budget" a check
every dispatch must pass; this guide carries the numbers that check uses.

## The planning budget

Every delegation is sized against a planning budget of 60k tokens, counted as
the task's footprint plus the run's fixed overhead. The ceiling is 90k tokens
— the compaction setting behind the tokenme settings file — and the ceiling
is headroom for an estimate that lands low, not room to spend. The model's
128k window is not the planning number: the gateway compacts a run once it
reaches the ceiling, long before the window fills, so a task planned against
the window loses work mid-run.

## The footprint formula

Estimate the footprint from the files the task reads and edits:

```
footprint = file bytes / 4 * 1.5
```

In prose: add up the bytes of those files, divide by 4 (about four bytes to a
token), then multiply by 1.5 as headroom for the edits, the prompt, and the
run's own reading. The formula covers the footprint only — the fixed
overhead is added on top of it:

- about 1k for a bare run, the default for every delegate run
- about 28k for a run that is not bare, the opt-out case

Check footprint plus overhead against the 60k planning budget.

Worked example — three files totalling 120 KB in a bare run: 120,000 bytes
divided by 4 is 30k, times 1.5 is about 45k of footprint, plus about 1k of
bare overhead — about 46k against the 60k budget, so it fits. The same task
pointed at about 400 KB of files instead: about 400,000 bytes divided by 4,
times 1.5, is about 150k, which does not fit the budget — split the task
before dispatch (the next section).

## Splitting an oversized job

A task that misses the budget is split before dispatch. Given a refactor
spanning forty files, split it into per-file or per-directory chunks: each
chunk runs as a separate delegate run, and the chunks stay independent — each
chunk's prompt carries everything that chunk needs, and none depends on
another chunk's output. A mechanical rename, a formatting pass, and
boilerplate generation all split along file and directory lines this way.

Size each chunk with the formula before dispatch; a chunk that still misses
the budget is split again.

## Overflow symptoms

After the run finishes, check its result for the three signs of context
overflow:

- Truncated edits — a named file's diff stops partway through a change.
- A result that omits files it was told to touch — named files come back
  untouched.
- A terminal reason other than `completed` in the JSON result.

A run showing one of the three is treated as failed even when the process
exit code is zero: re-split the task into smaller chunks and dispatch them as
their own runs.

## Compaction

Compaction is never relied on. The split is what brings an oversized task
back inside the budget; the gateway's compaction sits behind the ceiling as
the failure mode of an oversized run, and the plan treats reaching it as a
failure like any other. Sizing each chunk against the planning budget is how
every run finishes without it.
