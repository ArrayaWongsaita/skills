# 03: Owner tickets, the Reuse field, and the implementer handoff

**What to build:** The tickets `grill-to-tickets` publishes now carry reuse
through to implementation. Each new shared module has exactly one owner ticket
(the first vertical slice that consumes it) and every consumer is blocked by it;
a promote becomes a prefactor ticket; every ticket has a `**Reuse:**` line with
fixed verbs, kept out of acceptance criteria. The handoff points at the
catalog-aware directory implementers and reminds the user to commit first.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `references/reuse-pass.md` specifies the Stage 3 rules: one owner ticket
      per create-shared (the first consuming vertical slice, never a horizontal
      utils ticket) whose acceptance criteria include the module's behaviour at
      its interface; every other consumer lists the owner in `Blocked by`; each
      promote becomes a prefactor ticket blocking its consumer.
- [ ] It defines the Reuse field placed after `Blocked by` —
      `` **Reuse:** use `a` · extend `b` (<change>) · create-shared `c` · create-candidate `d` · promote `e` ``
      or `**Reuse:** none` — and states it is never an acceptance criterion, with
      the reason (every criterion must map to a new test in the implementers'
      verification gate).
- [ ] It specifies the pre-quiz check: each create-shared has one owner, each
      consumer is blocked by it, no reuse statement sits in acceptance criteria.
- [ ] `SKILL.md` Stage 3 points to these rules and includes the Reuse field in
      what the quiz shows per ticket.
- [ ] The `SKILL.md` handoff names `/subagent-implement .scratch/<feature-slug>/`
      first with `agy-implement` / `opencode-implement` as alternatives, and tells
      the user to commit `.scratch/<feature-slug>/` plus any
      `docs/reuse-catalog.md` or instruction-file change before running one.
- [ ] `docs/guides/grill-to-tickets.md` and
      `docs/skills/agents/grill-to-tickets.md` show the same handoff (they
      currently disagree: `/subagent-implement` vs `/implement`) and describe
      owner tickets and the Reuse field.
- [ ] `evals/evals.json`: case 1's handoff expectation is updated; new cases —
      two tickets consume one new shared module → one owner, the other blocked by
      it; a reuse statement drafted as a checkbox → moved to the Reuse field.
- [ ] `tests/grill-to-tickets-contract.test.mjs` asserts the owner rule, the five
      verbs, the not-a-criterion rule, and the new handoff (replacing the
      `/implement .scratch/<feature-slug>/issues/01-` assertion).
- [ ] `npm run validate` and `npm test` pass.
