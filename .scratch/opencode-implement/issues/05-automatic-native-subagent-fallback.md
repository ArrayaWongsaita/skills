# 05: Automatic native-subagent fallback

**What to build:** When the local path cannot deliver a ticket — a criterion that cannot
be split fine enough to fit the context budget, the verification gate failed
`MAX_TICKET_ATTEMPTS` times, or `opencode` failed past `MAX_OPENCODE_RETRIES` — the
orchestrator discards the ticket's partial worktree and worker branch and dispatches one
native harness subagent for the **whole ticket** from clean integration `HEAD`, verifies
it with the same orchestrator-run gate, and integrates it the same way. Escalation is
automatic, with no approval pause. `--no-fallback` suppresses it and produces the
corresponding `BLOCKED` state instead.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] `references/fallback.md` specifies the three triggers
      (`TICKET_TOO_LARGE_FOR_CONTEXT`, verification budget exhausted, `opencode` failure
      past `MAX_OPENCODE_RETRIES`), that an `opencode` hiccup *within* the retry budget
      is retried locally not escalated, and that escalation is automatic and unattended
      (adr/0007)
- [ ] `references/fallback.md` specifies the dispatch — Agent tool, `subagent_type` =
      `--fallback-agent` value (default `general-purpose`), `isolation: "worktree"`,
      background; the ticket's partial local worktree and worker branch are discarded and
      a fresh worker branch is cut from integration `HEAD`; the whole-ticket test-first
      prompt (no progress-note / decomposition machinery); retry via `SendMessage` with
      the specific failure; a subagent crash/loss counts as one attempt and re-dispatches
      fresh — contract shape adapted (copied, not imported) from
      `subagent-implement`'s `references/dispatch-contract.md`
- [ ] The fallback result runs through the **same** orchestrator verification gate as a
      local worker; only when the fallback subagent also fails its full attempt budget
      does the ticket become `BLOCKED (TICKET_VERIFICATION_FAILED)`
- [ ] `--no-fallback` / `--strict-local` suppresses the fallback entirely:
      `TICKET_TOO_LARGE_FOR_CONTEXT` → `BLOCKED (TICKET_TOO_LARGE_FOR_CONTEXT)`,
      verification budget exhausted → `BLOCKED (TICKET_VERIFICATION_FAILED)`
- [ ] SKILL.md Stage 1 "Fallback" section drives the above; the Plan's predicted `path`
      column and `status.md` record `local` vs `subagent-fallback`, and every actual
      escalation is recorded in `status.md`
- [ ] `evals/evals.json` cases: verification fails 3× on the local model → fallback fires
      automatically with no pause, path becomes `subagent-fallback`;
      `TICKET_TOO_LARGE_FOR_CONTEXT` with fallback on → subagent directly, no `BLOCKED`;
      same with `--no-fallback` → `BLOCKED (TICKET_TOO_LARGE_FOR_CONTEXT)`; `opencode`
      failure past `MAX_OPENCODE_RETRIES` → fallback fires; fallback subagent does the
      whole ticket from clean `HEAD`, partial worktree discarded; fallback subagent also
      fails its budget → `BLOCKED (TICKET_VERIFICATION_FAILED)`; orchestrator never
      hand-codes a hard ticket
- [ ] `npm run validate` and `npm test` pass
