# Run status, failure, and resume

Each approved run is recorded in `.scratch/<feature-slug>/status.md`. This
single Markdown file is the run record. Its first line is exactly
`skill: implement-tickets`:

```markdown
skill: implement-tickets
# Run status: <feature-slug>

Run mode: serial
Integration branch: `implement-tickets/<feature-slug>`
Integration commit: `<current-sha>`
Usage is reported as given and is possibly cache-inclusive.

| Ticket | Wave | Backend | Touch set | Extras | Status | Session ID | Attempts | Branch | Commit | Budget estimate | Usage total | Verifier usage total |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | ---: | ---: | ---: |
| 01 | 1 | native | `src/main.mjs` | `none` | integrated | `<session-id>` | 1 | `implement-tickets-work/<feature-slug>/01` | `<sha>` | `<Budget line or none>` | `<reported total or unknown>` | `<reported total or unknown>` |
```

Keep one row per ticket in dependency order. Record its wave, selected backend,
touch set, accepted extras, current status, latest session ID, ticket attempts, worker branch,
integrated commit, and `budget_estimate` from the ticket's Budget line verbatim
(`none` if absent). Record the run mode (`Run mode: serial` or `Run mode: parallel`), the
integration branch, and the current integration commit above the table. The Extras column sits after the Touch set column and lists the ticket's
accepted extra files (`none` when there are none). Write a ticket's extras to
the run state when they are accepted, not at the end of the wave, so a crash
loses nothing. A clean-merge overlap (paths shared by two tickets that merged
cleanly with a green gate) is recorded as a note in the Extras cell of the row
of both tickets. Status progresses through pending, dispatched,
verifying, verified, integrated, `BLOCKED (TOUCH_SET_APPROVAL)` for a parked
ticket, or `BLOCKED` with its reason.

`usage_total` is the sum of the usage reported by every dispatch and resume on
the delivering path for the ticket. Add each invocation's reported usage as
given; it is possibly cache-inclusive. It is `unknown` when none was reported
on that path. `verifier_usage_total` separately sums usage reported by verifier
dispatches; use `unknown` if none was reported.

## Verification failure and partial path

After three failed verification attempts, mark the ticket
`BLOCKED (TICKET_VERIFICATION_FAILED)`. Finish and judge any ticket already in
flight, then stop at the next frontier. Hold every transitive dependant of the
blocked ticket. Dependants are held; stop at the next frontier and preserve the
rest of the wave and integrated commits. Report independent tickets as an
available partial path and do not start them until
the person resumes the run.

A deny-list or cap hit marks the ticket `BLOCKED (TOUCH_SET_APPROVAL)` and
keeps its work on the worker branch; it is parked rather than a failure. This
block is an exception to the halt rule for other blocks above: the run does not
stop at the next frontier, and it stops only when every unintegrated ticket is
held or blocked. See the dispatch contract's "Deny-list and cap hits" section
and "Hold set and release" below.

The halt report names blocked tickets and their reasons:

- each blocked ticket, status token, and failure reason;
- held tickets and their blocking dependencies;
- independent tickets available as a partial path;
- every unanswered parked question, in every halt report, including one for
  another blocked ticket; when every remaining ticket is held, the report
  names those questions and the resume command; and
- the resume command: `/implement-tickets continue <feature-slug>`.

## Hold set and release

A parked ticket holds only what it must. The hold set is the parked ticket,
every ticket in its wave or a later one whose declared or effective touch set
overlaps the parked ticket's effective touch set, and all their transitive
dependants. A parked ticket with an unknown touch set holds all later tickets.

- Tickets outside the hold set keep running, including tickets in later waves;
  wave N is integrated before wave N+1 starts for those tickets, and the wave
  gate runs without any held ticket.
- A held ticket already in flight or verified finishes and is verified, but is
  not merged until release. Held tickets that were never dispatched resume in
  their original wave and ticket order after release, on the post-release base,
  before the next unstarted frontier.
- A held ticket that is also deferred for a conflict stays held; its drain round
  runs after the release.
- The hold stays until the parked ticket integrates. If the parked ticket ends
  blocked after its attempts, the holds that exist only because of overlap lift
  and its dependants stay held.

### Question, answer, and notes line

The question is shown at the end of the wave where the ticket was parked, and
the run does not wait for the answer. When several tickets were parked in the
wave, their questions are shown together, once, at the end of that wave. It is stored with its answer in a notes
line under the run-state table, keyed by ticket number:

```markdown
Notes: 04 question: `<extras and reason>`; answer: `<approve|reject|pending>`; release pre-pass: `<sha>`
Notes: 07 question: `<extras and reason>`; answer: `<approve|reject|pending>`; release pre-pass: `none`
```

Each parked ticket has its own `Notes:` line, so several tickets can be parked at
once. The release pre-pass sha is `none` until the release pass starts; the
orchestrator writes the pre-pass commit there before the pass merges anything, and
it stays until the pass's gate passes. Record the answer when it arrives and read
it at every frontier. Clear a ticket's line, not the other tickets' lines, once
its frontier has acted on it: on release, after the gate passes, or on rejection,
when the fresh dispatch starts. A redispatch that parks again writes a new
question. A crash in between loses nothing.

### Approval

On approval a fresh verifier checks the branch, as in the verification
contract's "Approved parked branch" section. The ticket then merges in a release
pass, a mini-wave described in the integration gate; its own pre-pass commit is
recorded in the notes line as the gate base. The gate runs, and the hold is
released after it passes.

### Rejection

On rejection the extras are dropped and the ticket gets a fresh dispatch from the
latest integration commit, told to stay inside its declared files and avoid the
denied paths. Each such dispatch costs one attempt, and the hold stays until the
ticket integrates; a redispatch that parks again costs another attempt, until
the attempts end in the existing blocked state.

## Read-only inspection

`/implement-tickets status [slug]` reads the selected `status.md` and reports
its ticket rows, current integration reference, and run state.
`/implement-tickets list` reads discovered `.scratch/*/status.md` files and
prints one summary per run. Both commands are read-only: they only read state
and change nothing. They do not reconcile refs, rewrite status, or start agents.

## Continue and reconcile

Run `/implement-tickets continue [slug]` to resume. For continue, a status.md
without the first line `skill: implement-tickets` is refused; tell the person
to recover the old skill from git history or start over. Do not infer the old
format.

For a valid status file:

1. Reconcile each recorded integration branch, commit, worker branch, and ticket
   commit against Git. Verify the integrated ticket sequence against the saved
   commits and acceptance evidence.
2. If Git has drifted from the recorded, verified sequence, identify the last
   good ticket commit and rewind the integration branch to it with
   `git checkout -B <integration-branch> <sha>`. Record the discarded commits
   and invalidate affected ticket state before dispatching again.
3. Read each ticket's accepted extras back from the Extras column and Git;
   accepted extras stay accepted.
4. Read the run mode from the `Run mode:` line. A record with no `Run mode:`
   line predates the mode and counts as parallel when any wave holds more than
   one ticket, otherwise as serial. A mode change needs approval because it
   changes the waves.
5. Re-present the Plan using reconciled Git state, current blockers, and
   eligible tickets. When `continue` re-presents the Plan, rerun the manifest
   check against the current spec and ticket files. If `spec.md` was edited
   between sessions, include the spec-hash warning in the Plan. Wait for
   approval before dispatching, unless only accepted
   extras happened: then reconcile Git and resume without a new approval, and
   re-ask only unanswered parked questions. A change to the run mode, waves,
   blockers, ticket set, budget, backend, or concurrency, or an edit the
   person requests, still needs approval.
   `continue` re-asks any unanswered parked question; that is a question about
   extras, not a Plan approval. It derives held and deferred state from the
   parked rows, the notes line, and Git, so no extra status token is added.
6. Resume from the earliest eligible frontier. Keep blocked tickets and their
   dependants held. After a `BLOCKED (TOUCH_SET_APPROVAL)` park, `continue`
   resumes the unheld tickets without the explicit-continue gate, because that
   block is an exception to the halt rule; only after another block, such as
   `BLOCKED (TICKET_VERIFICATION_FAILED)`, may an explicit continue proceed
   with the independent partial path.

Update `status.md` as dispatches return, verifiers report, tickets integrate,
and gates pass or fail. A gate-triggered serial redispatch increments the
culprit's `Attempts` by one; infrastructure failures do not count as ticket
attempts.
