# ADR 0010: grill-to-tickets reviews the spec in a fresh context

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-09-24
- Relates to / เกี่ยวข้องกับ: ADR 0003 (`grill-to-tickets` as a standalone
  composite); replaces that skill's "keep every stage on the main thread" rule

## Context / บริบท

`grill-to-tickets` ran every stage, including the Stage 2 `scrutinize` review,
inline on one reasoning thread. `scrutinize` asks for an outsider who "reads the
artifact cold", but the inline reviewer is the same context that ran the
interview and wrote `spec.md`. It knows every answer the spec leaves out and
fills those gaps from memory, while the implementer later works from the files
alone. Research on LLM judges finds the same pattern: models rate their own
output above equal-quality output from others, and self-refinement amplifies
that bias.

The repository's own runs show it. Five gate reports sit under `.scratch/`:
four close through `FIX_THEN_SHIP` to `SHIP` in two or three cycles, one records
a single `FIX_THEN_SHIP` cycle, and none reaches `REWORK` or `REJECT`.
In `opencode-implement-hosted-model`, a spec passage contradicting a fix made in
the gate (`spec-nit-1`) "evaded two prior consistency sweeps" and surfaced only
when `review-to-pr` ran `scrutinize` in a different session.

`grill-to-tickets` รีวิว spec ใน context เดียวกับที่เขียน จึงมองไม่เห็นช่องว่างที่ตัวเองรู้คำตอบอยู่แล้ว

## Decision / การตัดสินใจ

1. Each Stage 2 cycle dispatches `scrutinize` to a fresh subagent. Its brief is
   file paths only: `spec.md`, `decisions.md`, `CONTEXT.md`, `adr/`, the root
   `CONTEXT.md` and `docs/adr/`, `docs/reuse-catalog.md`, and the repository.
   From cycle 2 it also receives the previous cycle's blocking findings (id plus
   one line) so it can mark each resolved or still present under the same id.
2. The reviewer edits nothing. It returns its findings and `scrutinize`'s
   closing line.
3. The main thread keeps everything else: verdict normalization, `REWORK`-kind
   diagnosis, spec edits, cycle accounting, stall detection, and the report.
4. With no subagent available in the harness, the review runs inline and the
   cycle records `reviewer: inline`, so the weaker review stays visible.
5. Stages 0, 1, and 3 stay on the main thread. The two dispatches in the skill
   are fact lookups (the Reuse survey) and this review; neither makes a
   decision.

## Consequences / ผลที่ตามมา

### Positive / ข้อดี

- The review reads what the implementer will read. A gap only the conversation
  fills becomes a finding instead of passing silently.
- The review costs no main-thread context beyond its returned findings, which
  keeps the planning thread shorter.

### Trade-offs / ข้อแลกเปลี่ยน

- Each cycle pays a subagent's cold-start reading of the spec and the code it
  traces.
- The reviewer lacks the conversation by design. Findings it raises that
  `decisions.md` already answers are spec-level: the spec must say what the log
  settled.
- A finding's id is stable only because each brief carries the previous
  cycle's ids; the stall rule depends on that brief.

## Rejected alternatives / ทางเลือกที่ไม่เลือก

- Keep the review inline with a stronger "read it cold" instruction: the
  reviewer cannot forget what is in its own context.
- Run all of Stage 2, fixes included, in a subagent: routing and the
  decision-level return to Stage 0 need the main thread, where the user is.
