# ADR 0002: One orchestrator over installed engineering skills

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-08-26

## Context / บริบท

Engineering work crosses discovery, specification, planning, implementation,
diagnosis, and review. The repository already depends on specialist skills from
leejianrong, Matt Pocock, and 9arm. Some upstream workflows are user-only in
Claude Code or have source-defined side effects (for example, `implement`
commits), while Claude's bundled `/code-review` collides with the external name.

งานเดิมสร้าง sibling skills ที่ทำหน้าที่ซ้ำกับ dependency ภายนอก ทำให้ source
of truth แตกออกเป็นหลายชุดและซ่อนข้อจำกัด invocation ของ runtime

## Decision / การตัดสินใจ

1. Author exactly one new skill: `engineering-workflow`.
2. Keep classification, routing, state, transitions, gates, bounded loops,
   dependency selection, resume/reconciliation, and `COMPLETE`/`BLOCKED`
   decisions inside that skill.
3. Treat `grill-with-docs`, `to-spec`, `scrutinize`, `to-tickets`, `implement`,
   `code-review`, `tdd`, `prototype`, `diagnosing-bugs`, `wayfinder`, `research`,
   `post-mortem`, and `codebase-design` as installed external dependencies.
   The orchestrator references their exact contract and never copies their
   instructions into a replacement skill.
4. Audit the actual installed `SKILL.md`, agent metadata, runtime settings, and
   plugin manifests before each route. Record exact path/namespace, policy,
   enabled state, content hash, provenance, and required capabilities. The
   registry is expected configuration, not proof of ownership; an unverified
   or mismatched source is reported rather than guessed or replaced.
5. Codex uses the audited exact path because the official skill surface does
   not document a child-skill API. Claude uses the `Skill` tool for
   model-invocable dependencies and a real user handoff for
   `disable-model-invocation: true` dependencies. No invocation workaround or
   imitation is invented.
6. Retain the repository's CLI-first distribution decision from ADR 0001; do
   not create a plugin or marketplace bundle.
7. `scrutinize` is a blocking design and system quality gate. Each gate has an
   independent maximum of six completed review cycles, supports no-progress
   early blocking, and never executes cycle seven automatically. Final-system
   fixes return through validation and code review before re-review.
8. Dependency installation, setup, update, replacement, and removal are
   permission-gated. Optional dependencies are checked only when a route needs
   them, and an approved install must be re-audited before resume.

เราเลือก one-orchestrator/zero-replacement-worker เพื่อให้ dependency ภายนอก
เป็นแหล่งความจริงเดียว และให้ `BLOCKED` เป็นผลลัพธ์ที่ซื่อสัตย์เมื่อ runtime
เรียก skill ไม่ได้ แทนการลดคุณภาพหรือคัดลอก workflow

## Consequences / ผลที่ตามมา

The repository has one new skill, durable and auditable control state, and
conditional specialist routing. A runtime may pause for user-only invocation,
missing subagents, provider collision, or an incompatible installed contract.
Those pauses are visible and resumable; no specialist method is silently
reimplemented.

## Rejected alternatives / ทางเลือกที่ไม่เลือก

- Eight public replacement workers: rejected because they duplicate installed
  source-of-truth skills.
- A monolithic skill containing requirement, TDD, diagnosis, or review manuals:
  rejected because it forks specialist behavior.
- Direct model calls to Claude user-only skills: rejected by Claude runtime.
- Bare visible skill names: rejected because Codex inventory can be shortened
  and Claude's `code-review` has a built-in collision.
- Best-effort single-agent substitutes for subagent-required research/review:
  rejected because they weaken the external contract.
