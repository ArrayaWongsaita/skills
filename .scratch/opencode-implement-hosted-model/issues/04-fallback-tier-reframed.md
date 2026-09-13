# 04: Fallback tier — reframed rationale, unchanged mechanism, renamed flag

**What to build:** Keep the automatic native-subagent fallback tier's trigger
list and dispatch/verification/budget mechanics exactly as they are today.
Replace every "a local model is weak and slow" justification with the
capability-ceiling framing: any single resolved model can hit a ceiling, and
three failed attempts is a signal to try a structurally different executor.
Rename the suppression flag's alias from `--strict-local` to `--opencode-only`
(the guarantee it names — stay inside `opencode`, spend no Claude tokens, send
no code off the machine via fallback — no longer has anything to do with
"local").

**Blocked by:** 03

**Status:** done

- [x] `references/fallback.md` retains the three triggers unchanged in
      mechanism: a ticket too large even for the resolved model's window (now
      a rare runtime edge case rather than a planning-time prediction, since
      no context-budget estimate exists anymore); the verification budget
      (`MAX_TICKET_ATTEMPTS = 3`) exhausted on the main path; `opencode`-
      process failures exhausted (`MAX_OPENCODE_RETRIES = 3`, per Ticket 02's
      fresh-dispatch rule)
- [x] `references/fallback.md` retains dispatch mechanics unchanged: discard
      the ticket's partial worktree and worker branch, cut a fresh worker
      branch from the **current** integration `HEAD` (per Ticket 03, this may
      already include former wave-mates' work), dispatch one native subagent
      (`isolation: "worktree"`, `subagent_type` = the `--fallback-agent`
      value, default `general-purpose`, never `fork`) with the whole-ticket
      test-first prompt, no approval pause
- [x] `references/fallback.md`'s opening rationale is rewritten: dropped —
      "a 27B local model is weak and slow"; added — any single resolved
      model, however capable, has a capability ceiling, and a third failed
      attempt on that model is a signal to try a structurally different
      executor (a native Claude subagent with different context and tools)
      rather than a fourth attempt on the same model
- [x] `references/fallback.md` retains the fallback subagent's verification
      and retry unchanged: the same orchestrator-run verification gate as a
      main-path ticket; a verification failure resumes the same subagent via
      `SendMessage` with the specific failure, up to `MAX_TICKET_ATTEMPTS`; a
      subagent crash or lost session re-dispatches fresh and counts as one
      attempt; the third fallback verification failure yields
      `BLOCKED (TICKET_VERIFICATION_FAILED)`
- [x] `references/fallback.md` and SKILL.md rename the suppression flag's
      alias from `--strict-local` to `--opencode-only`; `--no-fallback`
      remains the primary flag name unchanged; `--strict-local` keeps working
      as a deprecated alias for one release (documented as deprecated, not
      removed outright)
- [x] `references/fallback.md`'s "Cost and privacy — recorded and disclosed"
      section is updated to note the main path now also spends real money
      (`tokens.main`, Ticket 05) — the fallback path is no longer the only
      spend disclosed, though it remains the only path whose spend leaves the
      machine
- [x] `evals/evals.json`: fallback still fires automatically on
      verification-budget exhaustion and on `opencode`-failure exhaustion,
      never on a transient `opencode` hiccup within budget; fallback still
      does the whole ticket from a clean worker branch; fallback's own budget
      exhaustion still yields `BLOCKED (TICKET_VERIFICATION_FAILED)`;
      `--opencode-only` suppresses fallback the same way `--no-fallback` did;
      `--strict-local` still works as a deprecated alias
- [x] `npm run validate` and `npm test` pass
