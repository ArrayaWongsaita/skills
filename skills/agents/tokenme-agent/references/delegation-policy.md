# Delegation Policy

Which work stays on the host and which may go to a delegate run. The host
applies this policy before every dispatch: the keep-local rules first, then
the eligibility checklist. Work that either one holds back stays on the host.

## Keep-local rules

The host keeps this work and sends nothing to the gateway:

- Any task that would create or edit a secrets file — credential files,
  `.env` files, API-key files, token files, private keys. The host keeps the
  task and dispatches nothing.
- Tickets marked `Risk: high`.
- Code the user has marked as staying local — code that leaves the machine
  only when the user says so.

### Where the keep-local mark comes from

Every keep-local mark lives in one of two places — the user's request
("keep this file on my machine"), or the host's own instruction files
(CLAUDE.md, AGENTS.md, and the other instruction files the host reads).

The host checks both places before dispatch. A bare delegate run reads no
project instructions, so a mark recorded in an instruction file takes effect
only when the host checks for it first — and keeps the task on the host when
one applies.

## Eligibility checklist

The host applies all three checks before every delegation. A subtask is
eligible only when every check passes:

1. **Self-contained** — the prompt carries everything the run needs. A task
   that needs this chat's earlier context fails this check and stays on the
   host.
2. **Fits the budget** — the task's footprint plus the run's fixed overhead
   stays inside the planning budget. The budget and chunking guide carries
   the numbers.
3. **Verifiable by a diff or a test run** — after the run finishes, the host
   can check the outcome with `git diff` or a test run. A task whose outcome
   the host cannot check this way stays on the host.

## Exclusions

The host keeps this work itself even when the checklist passes, because a
wrong answer here is expensive to catch:

- Design and architecture decisions — choosing between two architectures,
  picking an abstraction, shaping a public interface.
- Debugging that needs judgment — any investigation where the next step
  depends on what the previous step found.
- Security-sensitive edits — authentication, authorization, input
  validation, cryptography, and anything whose failure mode is a
  vulnerability.

The host does excluded work itself; a delegate run takes only the
mechanical, self-contained remainder, when there is one.
