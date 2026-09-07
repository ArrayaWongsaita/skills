# Running a ticket's step plan

Every ticket has a step plan from Stage 0 (see [planning.md](planning.md) §6) — an
ordered chain of sub-steps, one acceptance criterion each by default. This is how
the orchestrator runs that chain against the ticket's one worktree.

## The sub-step loop

For sub-step `K` of `M`, in order:

1. **Write the prompt** to `.scratch/<slug>/prompts/<NN>/<K>.md` from
   [prompt-scaffold.md](prompt-scaffold.md), filling the **progress note** with
   what earlier sub-steps in this ticket produced (files changed, the pass/fail
   state of every test written so far, anything this sub-step must build on).
   Sub-step 1's progress note is empty.
2. **Dispatch** one `opencode run` worker against the worktree, per
   [worker-contract.md](worker-contract.md). The worker builds the criterion
   test-first and **commits on the worker branch** `opencode-implement/<slug>/<NN>`
   before it returns.
3. **Checkpoint check** (below). Pass → continue. Fail → re-split or retry.
4. **Write the next progress note** from the worker's return and the checkpoint
   result, ready for sub-step `K+1`.

When the last sub-step's checkpoint passes, the ticket goes to the **verification
gate** in [worktree-integration.md](worktree-integration.md).

## The checkpoint check

A cheap check the orchestrator runs in the worktree after each sub-step — not the
full verification gate, which runs once at ticket completion:

- The worktree still typechecks / compiles.
- The tests touched so far are in the **red or green state the step plan expects
  for this point**: a sub-step that finished its criterion leaves that criterion's
  test **green**; a sub-step that only lays groundwork for a criterion split
  across sub-steps (a schema, a seam, a layer) legitimately leaves the
  behavioural test still **red**, and the step plan says which. No earlier
  sub-step's completed (green) test has regressed to red.
- The worker's return is well-formed — it pasted a red run and a green run and
  named the files it changed.

A failing checkpoint means either a bad sub-step (retry it — same worker budget
as a verification failure, `MAX_TICKET_ATTEMPTS = 3`) or a sub-step that was too
big and overflowed.

## Runtime re-split

A sub-step overflowed the context window when the checkpoint check fails **and**
the return shows overflow symptoms: a truncated edit, an edit that ignores a
constraint stated late in the prompt, a return that omits files it was told to
touch, or a green run that does not actually cover the criterion.

On an overflow the orchestrator **re-splits** that one sub-step along the next
natural line (a file, a layer), inserts the finer sub-steps in place of it, and
records the re-split in `status.md` (`sub_step` note: "K re-split into K.a, K.b at
runtime"). The re-split is not counted against `MAX_TICKET_ATTEMPTS` — a wrong
size estimate is the plan's fault, not the worker's. The finer sub-steps then run
through the same loop.

A sub-step that overflows again after being re-split as fine as it can go — one
criterion that inherently needs to see too much at once — escalates the whole
ticket (`TICKET_TOO_LARGE_FOR_CONTEXT`, see [fallback.md](fallback.md)), or blocks
it under `--no-fallback`.
