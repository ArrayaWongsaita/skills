# 06: SKILL.md, run options, handoff, ADR addendum, and full eval suite

**What to build:** Bring SKILL.md's description, prose, diagram, run options,
and completion handoff in line with Tickets 01–05. Add a short addendum to the
repo-level standalone decision record noting its local-execution framing is
superseded. Reconcile the full eval suite end-to-end against the spec's
Testing Decisions.

**Blocked by:** 01, 02, 03, 04, 05

**Status:** ready-for-agent

- [ ] SKILL.md's frontmatter `description`, opening paragraph, and ASCII
      diagram describe a hosted-model, wave/parallel skill — no "local",
      "Ollama", "zero-cost", "private", or "slow background tool" language
      remains anywhere in SKILL.md or `references/`
- [ ] SKILL.md's "Run options" section lists `--model provider/model` with **no
      skill-level default** (resolved-and-pinned per Ticket 02 when omitted),
      `--fallback-agent <name>` (default `general-purpose`), and
      `--opencode-only` as the primary suppression flag with `--no-fallback`
      and `--strict-local` documented as deprecated aliases (Ticket 04); lists
      the **concurrency cap** among the editable Plan-approval parameters
      alongside `FIRST_EVENT_TIMEOUT` / `STALL_INTERVAL` / `WORKER_TIMEOUT` /
      `MAX_TICKET_ATTEMPTS` / `MAX_OPENCODE_RETRIES`
- [ ] SKILL.md's preflight description drops every Ollama-specific check and
      failure message
- [ ] SKILL.md's completion handoff names the integration branch, one-commit-
      per-ticket confirmation, **cumulative token usage for both paths**
      (`tokens.main`, `tokens.fallback`), the pinned resolved model name, and
      the `/code-review` + `/scrutinize` commands to run next — no "local
      runs are cost: 0" language remains
- [ ] `docs/decisions/0007-opencode-implement-standalone.md` gets a short,
      dated addendum noting its differentiation-by-local-execution framing is
      superseded by this feature, linking to
      `.scratch/opencode-implement-hosted-model/adr/0001-hosted-only.md` — the
      original text is not rewritten, only appended to
- [ ] `docs/skills/agents/opencode-implement.md` (human guide) is updated to
      match: no stale local-model instructions, run options, or example
      commands remain
- [ ] `evals/trigger-evals.json` keeps the existing trigger/non-trigger set,
      replacing any Ollama-specific non-trigger case with a generic
      "mentions a hosted model" non-trigger case, consistent with
      `disable-model-invocation: true`
- [ ] `evals/evals.json` is reconciled end-to-end against spec.md's Testing
      Decisions "Keep unchanged" / "Add" / "Drop" lists: no leftover
      step-plan / sub-step / progress-note / per-sub-step-checkpoint cases
      remain; every wave / parallel-dispatch / per-ticket-integration /
      model-pin / two-rule-retry / fallback-reframing / cost-disclosure case
      introduced in Tickets 01–05 is present exactly once
- [ ] `npm run validate` and `npm test` pass
