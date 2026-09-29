# ADR 0005: subagent-implement is a standalone sibling of agy-implement, not a shared base

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-09-04

## Context / บริบท

`agy-implement` turns a `grill-to-tickets` ticket directory into working code by
dispatching one headless `agy` worker per ticket across several LLM providers.
Its stated purpose (feature ADR 0003) is **provider distribution** — no single
provider's quota becomes the bottleneck. Its own spec lists "a native-subagent
(Task tool) worker adapter" as out of scope and a deferred follow-up, and feature
ADR 0001 defers a shared-`references/` refactor "until a second provider sibling
actually exists".

`subagent-implement` เป็น sibling ตัวที่สองนั้น แต่ "why" ต่างกัน: มันมีไว้เพื่อ
**รักษา context ของ main agent ให้บาง** โดย dispatch subagent ของ harness เอง
หนึ่งตัวต่อหนึ่ง ticket เพื่อให้ file read / edit / test run ของ implementation
อยู่ใน context ของ worker ไม่ใช่ของ orchestrator

The two siblings differ in more than the dispatch call:

- **Purpose.** Provider distribution vs. orchestrator-context preservation.
- **Parallelism.** `agy-implement` ships waves, touch-set estimation, worktree
  scheduling, and a per-wave integration gate on day one. `subagent-implement`
  v1 is serial — one ticket at a time in dependency order — and defers
  parallelism.
- **Model handling.** `agy-implement` round-robins a provider list.
  `subagent-implement` omits the model entirely by default so the worker
  inherits the orchestrator's model and the skill stays portable across
  harnesses.
- **Verification economics.** `agy-implement`'s orchestrator reproduces the red
  state itself. `subagent-implement` dispatches a fresh `Explore` verifier per
  ticket so that work stays out of the orchestrator's context; the orchestrator
  keeps only the judgment.
- **State.** No per-provider usage roll-up; no external provider to fail over
  from.

## Decision / การตัดสินใจ

1. Build `subagent-implement` as a fully standalone skill under
   `skills/agents/subagent-implement/`, mirrored to
   `.agents/skills/subagent-implement/`, invoked directly as a third terminal
   target for the `grill-to-tickets` handoff, beside `/implement` and
   `/agy-implement`.
2. It owns its own copy of the planning, dispatch, verification, and
   state/resume machinery (`references/planning.md`,
   `references/dispatch-contract.md`, `references/prompt-scaffold.md`,
   `references/verification-and-integration.md`,
   `references/status-and-resume.md`).
3. It does not modify or depend on `grill-to-tickets`, `engineering-workflow`,
   `agy-implement`, any `mattpocock/skills`-sourced file, or `skills-lock.json`.
4. It stops before review — it hands off the `/code-review` and `/scrutinize`
   commands and runs neither, and it never pushes or opens a pull request.
5. v1 is serial and feature-ticket-only. Parallel execution via the Agent tool's
   `isolation: "worktree"`, and any shared-`references/` refactor with
   `agy-implement`, are deferred follow-ups.

## Consequences / ผลที่ตามมา

### Positive / ข้อดี

- Zero coupling to `agy-implement`, whose parallel-provider machinery would be
  dead weight here.
- The orchestrator's context holds only planning, two compact reports per
  ticket, and integration — the implementation reading and test runs never enter
  it.
- Portable across harnesses: no model identifier appears in the skill's logic.
- A drop-in third option for the `grill-to-tickets` handoff, with no change to
  any upstream skill.

### Trade-offs / ข้อแลกเปลี่ยน

- The DAG / frontier / `status.md` + Reality reconciliation discipline now exists
  in a third place in the repo and can drift.
- Serial-first means a large ticket set takes longer in wall-clock time than
  `agy-implement`'s parallel waves; the parallel follow-up closes that gap.
- The native subagent contract (background dispatch, `isolation: "worktree"`
  lifecycle, `SendMessage` resume) is confirmed on first real use rather than
  fully specified up front — the same posture `agy-implement` takes toward its
  `agy` envelope.

## Rejected alternatives / ทางเลือกที่ไม่เลือก

- **Extract a shared base skill + per-dispatch adapter now.** The two siblings
  are not congruent enough — different purpose, parallelism model, verification
  economics, and state — for a clean shared surface. Deferred until the shared
  parts stop diverging.
- **Add a native-subagent mode to `agy-implement` instead of a new skill.** It
  would entangle two different reasons-for-being in one control plane and force
  every `agy-implement` change to consider both.
- **Let the orchestrator pick a model per ticket by complexity.** Rejected for
  the same reason `agy-implement` rejected it (feature ADR 0003) and because a
  baked-in model table breaks portability across harnesses.
- **Keep full verification in the orchestrator.** That is exactly the
  file-reading and test-running the skill exists to move out of the
  orchestrator's context; a fresh verifier subagent preserves the
  "a different agent checks the work" rigor without the context cost.
