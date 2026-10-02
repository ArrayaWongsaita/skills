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

| Ticket | Wave | Backend | Touch set | Status | Session ID | Attempts | Branch | Commit | Budget estimate | Usage total | Verifier usage total |
| --- | --- | --- | --- | --- | --- | ---: | --- | --- | ---: | ---: | ---: |
| 01 | 1 | native | `src/main.mjs` | integrated | `<session-id>` | 1 | `implement-tickets-work/<feature-slug>/01` | `<sha>` | `<Budget line or none>` | `<reported total or unknown>` | `<reported total or unknown>` |
```

Keep one row per ticket in dependency order. Record its wave, selected backend,
touch set, current status, latest session ID, ticket attempts, worker branch,
integrated commit, and `budget_estimate` from the ticket's Budget line verbatim
(`none` if absent). Record the run mode (`Run mode: serial` or `Run mode: parallel`), the
integration branch, and the current integration commit above the table. Status progresses through pending, dispatched,
verifying, verified, integrated, or `BLOCKED` with its reason.

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

The halt report names blocked tickets and their reasons:

- each blocked ticket, status token, and failure reason;
- held tickets and their blocking dependencies;
- independent tickets available as a partial path; and
- the resume command: `/implement-tickets continue <feature-slug>`.

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
3. Read the run mode from the `Run mode:` line. A record with no `Run mode:`
   line predates the mode and counts as parallel when any wave holds more than
   one ticket, otherwise as serial. A mode change needs approval because it
   changes the waves.
4. Re-present the Plan using reconciled Git state, current blockers, and
   eligible tickets. Wait for approval before dispatching.
5. Resume from the earliest eligible frontier. Keep blocked tickets and their
   dependants held; an explicit continue may proceed with the independent
   partial path.

Update `status.md` as dispatches return, verifiers report, tickets integrate,
and gates pass or fail. A gate-triggered serial redispatch increments the
culprit's `Attempts` by one; infrastructure failures do not count as ticket
attempts.
