# ADR 0014: Measure tickets before limiting them

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-09-25

## Context / บริบท

A ticket now carries its test boundary and its read set: `**Seam:**` (one test
boundary from the spec's Testing Decisions), `**Context:**` (the Read set, with
its read-only, `(edit)`, `(new)`, `(from NN)`, and `(edit from NN)` markers), and
`**Budget:**` (the checker's measured read tokens, criteria, and modules). The
measurement is nearly free — the checker already reads every file and spec
section a ticket needs — while a guessed limit needs calibration evidence the
repository does not have. In the only real ticket set so far, every ticket
passed first time, yet any proposed limit would have flagged most of them.

ticket แต่ละใบมี `**Seam:**` (ขอบเขตทดสอบเดียวจาก Testing Decisions ของ spec),
`**Context:**` (Read set พร้อม marker อ่าน/edit/new/from) และ `**Budget:**`
ที่ checker วัดให้ การวัดแทบไม่มีต้นทุนเพิ่ม แต่การตั้ง limit แบบเดาต้องอาศัย
หลักฐานที่ยังไม่มี — ticket set จริงชุดเดียวที่ผ่านมาสำเร็จทุกใบ ในขณะที่ limit
ที่เดาไว้จะเตือนเกือบทุกใบ

## Decision / การตัดสินใจ

1. Every ticket carries `**Seam:**`, `**Context:**`, and `**Budget:**`, written
   by `check-tickets.mjs --write-budget` from its measurement. The Budget line
   records an estimate; it sets no limit.
2. The implementers use the Seam verbatim and build the worker's read list from
   Context, and record `budget_estimate` (the Budget line verbatim) beside
   `usage_total` (the ticket's actual cost) per ticket.
3. No limits, profiles, over-budget warnings, or readiness dry-runs ship yet.
   They are deferred to the later feature `ticket-budget-calibration`, which
   starts once at least five tickets carry both `budget_estimate` and
   `usage_total`, and which covers Budget profiles and limits, over-budget
   warnings, readiness dry-runs, Retro Budget misses and calibration, and
   `docs/ticket-budget.md`.

## Consequences / ผลที่ตามมา

### Positive / ข้อดี

- Every ticket's size is visible in the budget table before implementation.
- The later limits will be calibrated against real numbers, so they will not
  flag work that passes.

### Trade-offs / ข้อแลกเปลี่ยน

- Until the later feature, oversized tickets are visible in the budget table but
  not flagged; nothing stops a too-large ticket from being dispatched.

## Rejected alternatives / ทางเลือกที่ไม่เลือก

- **Ship provisional limits with warnings and dry-runs now.** They are a cost on
  every run, calibrated against nothing; in the only real ticket set, any
  guessed limit would have flagged most of the tickets that passed first time.
