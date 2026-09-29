# ADR 0007: opencode-implement is a standalone local-first sibling of the implement family

- Date / วันที่: 2026-09-07

## Status / สถานะ

Accepted / ยอมรับแล้ว

ยอมรับแล้ว — `opencode-implement` เป็น skill standalone ตัวที่สามในตระกูล implement
ขับ ticket set ด้วย local model ผ่าน `opencode` และ fall back เป็น native subagent
อัตโนมัติเมื่อ local ทำไม่ได้

## Context / บริบท

`implement`, `agy-implement`, and `subagent-implement` all take a `grill-to-tickets`
ticket directory to a verified integration branch and stop before review. Each has a
different reason for being: `implement` is one ticket per human-driven context;
`agy-implement` spreads token spend across LLM providers; `subagent-implement` keeps the
main agent's context lean by dispatching native subagents.

`opencode-implement` เพิ่มเหตุผลที่สี่: รัน implementation ทั้งหมดบน **local model ที่
ฟรีและเป็นส่วนตัว** ผ่าน `opencode run` (default `ollama/qwen3.8:27b-mlx-32k`) — ไม่เสีย
API token/quota, โค้ดไม่ออกจากเครื่อง, ทำงาน offline ได้ (probe ยืนยัน `cost: 0`)

The local model forces two mechanisms the hosted-model siblings do not have:

- **Criterion-level decomposition.** The model runs in a 32k window with ~11k gone before
  any ticket work (probed). Every ticket is split into an ordered chain of sub-steps, one
  acceptance criterion each by default, split finer when a criterion still will not fit.
  Sub-step state passes by a worker-branch commit plus a compact progress note, never by
  `opencode` session resume.
- **Automatic native-subagent fallback.** A weak local model hits its ceiling often (a
  probe task hung 40+ minutes). A ticket the local path cannot deliver — a sub-step too
  big to split, three failed verification attempts, or `opencode` failing past its retry
  budget — escalates automatically, with no approval pause, to one native harness
  subagent for the whole ticket. `--no-fallback` suppresses it for a run that must spend
  zero Claude tokens and keep all code local.

Execution is serial and parallelism is a non-goal, not a deferred follow-up: one Ollama
instance serializes inference regardless of how many workers are dispatched, and the
target machine (38.7 GB RAM, ~18 GB model) has no room for concurrent workers.

Repo ADR 0005 rejected adding a native-subagent *mode* to `agy-implement` because it
would split one skill's reason-for-being in two. That objection does not apply here: the
subagent path is a strictly-worse safety valve on a single control plane, not a co-equal
mode — see feature ADR 0007.

## Decision / การตัดสินใจ

1. Build `opencode-implement` as a fully standalone skill under
   `skills/agents/opencode-implement/`, mirrored byte-identical to
   `.agents/skills/opencode-implement/`, with the symlink
   `.claude/skills/opencode-implement → ../../.agents/skills/opencode-implement`. It is
   invoked directly as a fourth terminal target for the `grill-to-tickets` handoff,
   beside `/implement`, `/agy-implement`, and `/subagent-implement`.
2. It owns its own copy of the planning, decomposition, worker-contract, fallback,
   worktree-integration, and state/resume machinery in `references/`, so it can diverge
   from the other implement siblings freely.
3. It does not modify or depend on `grill-to-tickets`, `agy-implement`,
   `subagent-implement`, `engineering-workflow`, any `mattpocock/skills`-sourced file, or
   `skills-lock.json`. Its references to the sibling skills are skill-name mentions, not
   file links, so it builds and validates from `main` regardless of merge order.
4. It stops before review — the handoff prints `/code-review since <merge-base with
   main>` then `/scrutinize`, and the run performs neither, never pushes, and opens no
   PR.
5. Serial execution is permanent (feature ADR 0005). The subagent fallback is on by
   default and disclosed in the Plan and the handoff; `--no-fallback` opts out.

การตัดสินใจ: สร้างเป็น skill standalone เต็มตัว เป็นเจ้าของ machinery ของตัวเอง
ไม่แก้และไม่พึ่ง skill อื่น รันแบบ serial ถาวร fallback เปิด default แต่เปิดเผยและปิดได้

## Consequences / ผลที่ตามมา

### Positive / ข้อดี

- A `grill-to-tickets → opencode-implement` short path that implements a whole feature
  at zero API cost and with the code never leaving the machine, needing no orchestrator
  and no dependency-registry entry.
- The criterion-level decomposition and the fallback-tier logic can evolve independently
  of the hosted-model siblings, for which they would be dead weight.
- A drop-in fourth option for the `grill-to-tickets` handoff, with no change to any
  upstream skill.

### Trade-offs / ข้อแลกเปลี่ยน

- The DAG / frontier / verification-gate / integration-gate / `status.md` + Reality
  reconciliation discipline now exists in a fifth place in the repo (with `implement` is
  a sixth) and can drift. A shared-`references/` refactor across the implement family is
  a deferred follow-up — the same posture ADRs 0003–0006 take. Three implement siblings
  with aligned specs is a better basis for that refactor than two.
- A large ticket set is an hours-long serial run; the skill is a background / overnight
  tool, and its value rests on `status.md` and `continue` being reliable across a crash
  or a closed laptop.
- The `opencode` worker contract (interleaved JSONL event stream, session capture, git
  snapshots, unattended bash, the real context floor) is confirmed by validation probes
  during implementation rather than fully specified up front — the same posture
  `agy-implement` takes toward its `agy` envelope. Two probes are design-blocking and run
  before the ticket set is finalised.

machinery ตระกูล implement อยู่ในที่ที่ห้าของ repo และ drift ได้ — shared-`references/`
refactor เป็น follow-up ที่เลื่อนไว้; run ใหญ่ใช้เวลาหลายชั่วโมง เป็นเครื่องมือ
background ที่พึ่ง `status.md` + `continue`

## Rejected alternatives / ทางเลือกที่ไม่เลือก

- **Fork `agy-implement`'s parallel-wave core.** The wave / touch-set / concurrency
  machinery exists to spread load across providers; one local Ollama instance serializes
  inference regardless, so it would be pure overhead (feature ADR 0005).
- **Build it as a thin variant sharing `subagent-implement`'s references.** The
  serial-execution shape is close, but the dispatch contract, criterion-level
  decomposition, and fallback tier are not — and repo ADR 0005 already found the siblings
  not congruent enough for a shared surface.
- **`BLOCKED` on every local-model ceiling instead of a fallback.** A weak model hits its
  ceiling often; the run would stall constantly (feature ADR 0007).
- **Wire it into `engineering-workflow` as an `IMPLEMENTATION` delegate.** Rejected for
  the same reason ADRs 0004–0006 rejected it — it couples the skill to one the owner may
  remove.

## Addendum (2026-09-13) — local-execution framing superseded

This ADR's Context and Decision above describe `opencode-implement` as it shipped:
built around a local, free, private Ollama model, with criterion-level
decomposition and serial-only execution as direct consequences of that
model's constraints. The user has since stopped using local models in
`opencode` entirely and moved to a resolved, pinned **hosted** model. The
`opencode-implement-hosted-model` feature reworks the skill accordingly:
decomposition and serial-only dispatch are dropped in favor of wave
computation and parallel dispatch (converging with `agy-implement`'s
execution shape), and the "zero-cost, private, local" framing above no longer
applies — every ticket on the main path now spends real, disclosed token
usage (`tokens.main`) against the resolved model.

This ADR's differentiation-by-local-execution framing is therefore
**superseded**, not reversed: `opencode-implement` remains standalone (this
ADR's Decision §1–4 still hold — its own copy of the planning/worktree/
verification/state machinery, no dependency on the sibling skills, stopping
before review), and it keeps its one differentiator the hosted-model
siblings still lack — the automatic native-subagent fallback tier (feature
ADR 0007, amended, not reversed, by
`adr/0003-fallback-tier-retained.md` in the local `.scratch/opencode-implement-hosted-model/` notes).
What changes is only *why* the skill is standalone: no longer "runs on a
local model," but "resolves and pins exactly one hosted model per run, with
`opencode` (not `agy`) as its delegate CLI and a fallback tier `agy-implement`
does not have."

See the local notes `.scratch/opencode-implement-hosted-model/adr/0001-hosted-only.md`
for the decision record and `.scratch/opencode-implement-hosted-model/spec.md`
for the full migration spec. `.scratch/` is ignored by version control
([ADR 0011](0011-keep-planning-notes-and-installed-skills-local.md)), so those
notes exist only in the author's checkout. The original text above is left as a
historical record and is not rewritten.

การตัดสินใจเดิมด้านบนอธิบาย `opencode-implement` แบบที่ปล่อยครั้งแรก — รันบน local
model (Ollama) ฟรีและเป็นส่วนตัว ผู้ใช้เลิกใช้ local model ใน `opencode` แล้วย้ายไปใช้
hosted model ที่ resolve แล้ว pin ไว้ตัวเดียวต่อ run กรอบ "local-execution" ด้านบนจึงถูก
**แทนที่ (superseded)** ไม่ใช่ถูกล้ม — skill ยังคง standalone และยังมี fallback tier
เป็นจุดต่างจาก `agy-implement` เหมือนเดิม รายละเอียดอยู่ที่
`.scratch/opencode-implement-hosted-model/adr/0001-hosted-only.md`
