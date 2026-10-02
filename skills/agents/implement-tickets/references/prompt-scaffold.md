# Per-ticket worker prompt scaffold

The orchestrator writes one self-contained prompt per ticket at
`.scratch/<slug>/prompts/<NN>.md` and passes it to the background worker. The
worker has no context from the orchestrator's conversation. Inline the ticket,
its acceptance criteria, the selected test seam, and every path it needs.

## Template

# Task: <ticket NN — title>

## Working directory

The harness-created worktree for branch <worker-branch>.

## First command — sync to the integration tip

Before reading, testing, editing, installing, or running any ticket work, run
this as the first command in the worktree. Every worker prompt includes this
step, including ticket 1:

```bash
git checkout -B "<worker-branch>" "<integration-sha>" || { echo "failed_infra: unable to check out integration SHA"; exit 1; }
test "$(git rev-parse HEAD)" = "<integration-sha>" || { echo "failed_infra: HEAD does not equal integration SHA"; exit 1; }
```

The first command checks out the worker branch at the integration SHA. The
second asserts that `HEAD` equals that exact SHA. If checkout fails or the
assertion finds a mismatch, stop and return `failed_infra`; do not spend a
ticket attempt or continue with implementation.

## What to build

<the ticket's "What to build" paragraph, verbatim>

## Acceptance criteria

<the ticket's acceptance checkboxes, verbatim>

## Context

- Parent spec: <absolute path> — read only: <named sections>
- Relevant ADRs: <absolute paths>
- Domain glossary: <absolute path>
- Read: <plain and `(from NN)` Context paths>
- Change: <`(edit)` and `(edit from NN)` Context paths>
- Create: <`(new)` Context paths>
- Test seam: <ticket seam verbatim, or the seam selected in planning>

## Method — red, green, refactor

1. **Red:** add tests for the acceptance criteria and run them. Confirm they
   fail because behavior is missing, not because of a syntax or import error.
   Include the exact failing output in your return.
2. **Green:** make the smallest implementation that makes the tests pass.
3. **Refactor:** tidy only the changes you made and keep the tests passing.

Run the ticket tests and the project's configured typecheck. If the repository
has no typecheck command, report that instead of inventing one.

## Constraints

- Work in the files assigned to this ticket. Extra files are allowed when
  required, and you must report each one under Touch-set extras.
- Reuse installed dependencies. If a new dependency is needed, stop and report
  it without installing.
- Read only the listed files or files clearly required by them.
- Commit the work on the worker branch. Do not push or open a pull request.
- If a required design decision is missing, stop and report it.

## Return

End your report with exactly these sections:

- **Red output:** the failing test run from the red step, verbatim.
- **Green output:** the passing test run and typecheck from the final step,
  verbatim, noting if no typecheck is configured.
- **Files changed:** every file created or modified, split into test files and
  implementation files.
- **Test → criterion table:** each new test mapped to the acceptance criterion
  it covers.
- **Touch-set extras:** every file outside its declared touch set (the
  `Change` and `Create` paths above) that you changed, each with the reason it
  was required. Write `none` when there are no extras.
