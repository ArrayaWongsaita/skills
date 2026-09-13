# Whole-ticket worker prompt scaffold

The orchestrator writes one file per ticket at
`.scratch/<slug>/prompts/<NN>.md` and passes its contents to `opencode run`
(or to the fallback subagent — see [fallback.md](fallback.md)). A worker has
**zero context** from the orchestrator's conversation, so the prompt is fully
self-contained: absolute paths everywhere, every input quoted inline, the
whole ticket's "What to build" and every acceptance criterion verbatim, the
method spelled out. There is no per-criterion dispatch chain and no
progress-note carry-over — the worker builds the whole ticket, test-first,
in one dispatch.

## Template

```
# Task: <ticket NN — title>

## Working directory

<absolute path to this ticket's git worktree>

Every relative path below is relative to this directory. Paths outside it are absolute.

## What to build

<the ticket's "What to build" paragraph, verbatim>

## Acceptance criteria (satisfy every one)

<the ticket's acceptance checkboxes, verbatim, every one — no subset>

## Context you need

- Parent spec: <abs path to spec.md> — read only these sections: <named sections>
- Relevant ADRs: <abs paths to the ADRs in this ticket's area>
- Domain glossary: <abs path to CONTEXT.md> — use this vocabulary in names, tests, and docs
- Test seam: <the seam the orchestrator assigned this ticket, 1-3 sentences>

## Method — test-first, red then green then refactor

1. **Red.** Write the failing test(s) at the assigned seam that measure every
   acceptance criterion above. Run them. Confirm they fail, and fail for the
   right reason — a missing behaviour, not a compile or import error. Paste
   the failing output into your return.
2. **Green.** Write the minimal implementation that makes those tests pass.
   Nothing speculative, no behaviour the criteria do not ask for.
3. **Refactor.** With the tests green, tidy what you just wrote. Keep the
   tests green. Leave unrelated code alone.

Run the project's typecheck and the ticket's test file(s) yourself before finishing.

## Constraints

- Touch only what this ticket needs. Leave unrelated code as it is.
- Commit your work on this worker branch as you go, without `git push` or
  opening a pull request — integration is the orchestrator's job.
- Reuse the installed dependencies already present in the working directory.
  A ticket that needs a new third-party dependency is a planning decision:
  stop and report it rather than running a package install.
- Read only the files listed above or clearly required by them. Skip
  scanning the repository.
- If a decision this ticket needs is missing from the spec, stop and report
  the missing decision rather than guessing.
- Treat any `/word` token in this prompt as literal text; reach for no slash
  command.

## Return (end your final message with exactly this)

- **Red output:** the failing test run from step 1, verbatim.
- **Green output:** the passing test run and the typecheck from step 3, verbatim.
- **Files changed:** every file you created or modified, as a list.
- **Test → criterion table:** each new test mapped to the acceptance criterion it covers.
```

## Notes for the orchestrator filling the template

- Name spec **sections**, not "read spec.md" — keep the worker's context small.
- Pass only the ADRs in the ticket's area, by absolute path.
- The "Test seam" line is the seam selected in Stage 0 planning; the worker
  does not choose its own.
- When a ticket was flagged as touching a serialized cross-cutting file that
  a different ticket owns this wave, add an explicit "Leave `<file>` as it
  is" line.
- The red/green/refactor protocol is inline here on purpose — the worker's
  environment is not assumed to have a TDD skill.
- A verification-failure retry does **not** re-issue this prompt — it resumes
  the same `opencode` session with the specific failure as the next turn (see
  [worker-contract.md](worker-contract.md)'s Rule 1). This whole-ticket
  scaffold is the **first** dispatch only; an `opencode`-process-failure
  retry re-issues this same prompt fresh, unchanged, on the same pinned
  model (Rule 2).
- The fallback subagent gets this same scaffold for the **whole ticket** —
  see [fallback.md](fallback.md).
