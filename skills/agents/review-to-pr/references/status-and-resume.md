# State, resume, and the handoff (Stages 4–5)

The last gate, the terminal output, the run-state file, and the two
sub-commands.

## Stage 4 — Full suite green

Once the code loop is closed and the system gate has run or been skipped, a
**fresh `Explore` verifier** runs, on the integration branch `HEAD`:

- the **whole project typecheck**;
- the **whole test suite** — not just the affected tests.

It returns the raw output and renders no verdict; the orchestrator reads it.

- **Green** → Stage 5.
- **Red** → the failure is a **new blocker**. Add it to the ledger and route to
  Stage 2 for **one** code cycle (cluster, fix, commit, re-verify). Then re-run
  Stage 4.
- **Red with the code budget already spent** → stop. Report the red suite as
  **unresolved — not PR-ready**, with the failing output, and hand over
  `/review-to-pr continue`.

## Stage 5 — Handoff

Print the handoff and stop. It names:

- the **integration branch** and its `HEAD` SHA;
- the **code-review verdict** — `clean`, or `N fix(review): commits landed` — and
  the cycles spent (`n/<code_budget>`), with "fixes not re-reviewed — budget
  spent" when the last round's fixes got no review;
- the **deeper-pass line** — `/review-to-pr continue --rounds <n>
  [--scrutinize-rounds <n>]`, so more rounds are one command away;
- the **scrutinize disposition** — `ran: <checklist item> — <verdict>` or
  `self-contained — skipped`;
- the **green-suite confirmation** — the `HEAD` SHA the full suite passed on;
- the **`fix(review):` commits added**, sha + summary, in fix order;
- any **non-blocking findings carried, not fixed**;
- the **`/retro-to-remedies` command**, then the **`/pr-to-base` command**, to run
  next in a fresh context.

The run performs **no PR step** — no `git push`, no `gh`, no `/pr-to-base`. Opening
the PR is the next command, run by hand. This is the same terminal stance
`implement-tickets` takes toward `/code-review`.

### Halt / partial report

A run that ends with `unfixable` blockers, a stalled loop, a `reject` verdict, or
a red suite with the code budget spent prints a **partial report** instead of the
clean handoff:

- the **unresolved blockers** (or the `reject` reason), by id and axis;
- the **stage reached** and why it stopped;
- the **cycles spent** — `code_cycles` / `code_budget` and `scrutinize_cycles` / `scrutinize_budget`;
- the **`fix(review):` commits** that did land;
- the **`/review-to-pr continue`** command;
- the **`/retro-to-remedies`** command after it — finishing the Run stays the
  primary path.

Nothing is force-pushed, reset, or discarded on a halt.

## Run state — `.scratch/<feature-slug>/review-status.md`

One markdown file, the whole record. It has no per-turn state-header block; a
crash or a closed session loses nothing. Fields:

| field | holds |
| --- | --- |
| `review_point` | the pinned commit and how it was resolved |
| `feature_slug` | the resolved slug |
| `integration_branch` | the branch name and its current `HEAD` SHA |
| `spec_source` | `spec.md + issues/`, `spec.md`, or `commit-messages` |
| `stage` | the current stage (`0`–`5`, or a halt state) |
| `code_budget` | the `--rounds` value, default 1, ceiling 3 |
| `code_cycles` | completed two-axis reviews so far (≤ `code_budget`) |
| `scrutinize_budget` | the `--scrutinize-rounds` value, default 1, ceiling 6 |
| `scrutinize_cycles` | completed scrutinize + intra-sub-loop code-review passes (≤ `scrutinize_budget`) |
| `findings` | the ledger — one row per finding: `{id, axis, status: open \| resolved \| stalled \| unfixable, cluster}` |
| `fix_commits` | the `fix(review):` commits landed — `{sha, summary, finding_ids}`, in fix order |

Per cycle, the file also carries the code-review and scrutinize history: the
reviewed `HEAD` fingerprint and the new / resolved / still-open findings.

## `/review-to-pr status [slug]`

**Read-only.** Parse `review-status.md` and report the cycle history and the
findings ledger — mutating nothing, running no `code-review`, no `scrutinize`,
and no suite.

## `/review-to-pr continue [slug]` — resume with Reality reconciliation

Before trusting `review-status.md`, reconcile it against reality:

1. **Git refs.** Confirm the integration branch exists and its `HEAD` matches
   `review-status.md`. Confirm each recorded `fix_commits` sha is still reachable
   from the branch tip.
2. **Re-run the gates.** Re-run `code-review` against the pinned `review_point`
   and re-run the full suite on the current `HEAD`.
3. **Re-open on drift.** Any finding whose `fix(review):` commit no longer holds
   — the user hand-edited the tree, a later change broke it, or `code-review`
   reports it again — is re-opened in the ledger (`resolved` → `open`), and its
   commit is listed as **superseded** at the top of the report so the blast
   radius is visible.
4. **Apply new budgets.** `--rounds <n>` / `--scrutinize-rounds <n>` on the
   command set `code_budget` / `scrutinize_budget` to the new total — clamped to
   the ceilings (3 / 6) and refused below the cycles already spent. Without them
   the recorded budgets stand.
5. **Resume** from the stage `review-status.md` records, with the reconciled
   ledger — the cycle counts carry over unchanged. A finished run whose budget was
   raised re-enters Stage 1 (code) or Stage 3 (scrutinize) and runs only the added
   rounds, then Stage 4 and the handoff again.

A `list` sub-command across every `.scratch/*/review-status.md` is a deferred
follow-up.
