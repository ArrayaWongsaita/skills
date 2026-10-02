# ADR 0020: Implement Tickets is the one core for the implement family

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-09-30
- Supersedes / แทนที่: ADR 0004, ADR 0005, and ADR 0007 for the implement family
- Narrowed by / ถูกจำกัดโดย: ADR 0021 narrows decision 1 (Plan approval no longer covers touch-set extras) / ADR 0021 จำกัดข้อ 1 (การอนุมัติ Plan ไม่ครอบคลุม touch-set extras)

## Context / บริบท

The implement family grew as separate skills with overlapping ticket planning,
worker, verification, and integration responsibilities. `implement-tickets`
now provides a complete shared core: it can run without an installed adapter,
uses native subagents by default, and plans tickets into parallel waves. Other
execution backends can be added without copying the core's planning and run
contracts.

ตระกูล implement เติบโตเป็น skill แยกกันทั้งที่มีหน้าที่วางแผน ticket,
ส่ง worker, ตรวจสอบ และรวมงานที่ทับซ้อนกัน ปัจจุบัน `implement-tickets`
เป็น core ที่ใช้งานได้โดยไม่ต้องติดตั้ง adapter ใช้ native subagent เป็นค่าเริ่มต้น
และวางแผน ticket เป็น wave ขนานได้ ส่วน backend อื่นเพิ่มได้โดยไม่ต้องทำสำเนา core

## Decision / การตัดสินใจ

1. Use `implement-tickets` as the one core for the implement family. It defaults
   to native subagents and plans parallel waves from blockers and touch sets.
   Execution remains behind the core's Plan approval gate.
2. Install other backends as separate adapter skills named
   `implement-tickets-<backend>` and select one with `--with <backend>`. The core
   remains complete and usable without an adapter.
3. Retire the prior standalone core with no alias. Keep `agy-implement` and
   `opencode-implement` behaviorally unchanged until their adapters ship.
4. Gate parallel readiness on a recorded human validation run. The parallel
   readiness decision stays pending until a human run is completed and its dated
   result is recorded in this ADR.

ใช้ `implement-tickets` เป็น core เดียวของตระกูล โดยใช้ native subagent เป็น
ค่าเริ่มต้นและคำนวณ parallel wave จาก blocker กับ touch set; การทำงานยังต้องรอ
การอนุมัติ Plan ของ core

ติดตั้ง backend อื่นเป็น adapter skill แยกชื่อ `implement-tickets-<backend>`
และเลือกด้วย `--with <backend>` โดย core ยังคงใช้งานได้โดยไม่มี adapter

เลิกใช้ core standalone เดิมโดยไม่สร้าง alias และคงพฤติกรรมของ `agy-implement`
กับ `opencode-implement` ไว้จนกว่า adapter ของแต่ละตัวจะส่งมอบ

ความพร้อมของ parallel execution ต้องรอผล human validation ที่บันทึกไว้
จะยังไม่ถือว่าพร้อมจนกว่าจะมีคนทำ run และบันทึกผลพร้อมวันที่ไว้ใน ADR นี้

## Consequences / ผลที่ตามมา

- One core owns the shared ticket plan, waves, worker contract, and integration
  flow; native execution requires no separate install.
- Provider-specific behavior stays behind adapter contracts while the existing
  agy and opencode skills remain available during migration.
- Parallel readiness is explicitly gated by evidence from the live harness, not
  inferred from the deterministic wave planner alone.

core เดียวเป็นเจ้าของ Plan, wave, contract ของ worker และขั้นตอน integration
โดยไม่ต้องติดตั้งเพิ่มสำหรับ native execution

พฤติกรรมเฉพาะ backend อยู่หลัง adapter contract และ skill ของ agy กับ opencode
ยังใช้งานต่อได้ระหว่างการย้ายระบบ

ความพร้อมของ parallel execution ต้องอ้างหลักฐานจาก harness ที่ใช้งานจริง
ไม่อนุมานจากผลของ wave planner แบบ deterministic เพียงอย่างเดียว

## Rejected alternatives / ทางเลือกที่ไม่เลือก

- Keep three standalone implementations as equal core paths. Rejected because
  they duplicate the shared plan and execution contract and make the family
  harder to keep consistent.
- Keep an alias for the prior standalone core. Rejected because it would preserve two
  names for the same core and make future adapter selection unclear.
- Declare parallel readiness from automated checks alone. Rejected because the
  live human validation has not yet been recorded.

ไม่เลือกเก็บ implementation แยกสามชุดเป็น core เทียบเท่ากัน เพราะจะทำซ้ำ contract
และทำให้รักษาความสอดคล้องของตระกูลได้ยาก

ไม่เลือกเก็บ alias ของ core standalone เดิม เพราะจะมีสองชื่อสำหรับ core เดียว
และทำให้การเลือก adapter ในอนาคตไม่ชัดเจน

ไม่ประกาศความพร้อมของ parallel จาก automated check เพียงอย่างเดียว
เพราะยังไม่มีผล human validation ที่บันทึกไว้

## Parallel validation record / บันทึกผล parallel validation

Status: awaiting human validation. No result has been recorded; parallel
readiness remains gated. Follow
[`parallel-validation.md`](../../skills/agents/implement-tickets/references/parallel-validation.md)
in a disposable scratch repository, then record the date, harness setup, and
the observed result for each required check here. Keep the reference marker at
`status: not validated` unless every check passes. After a successful run, set
the marker to `status: validated YYYY-MM-DD` using the run date.

สถานะ: กำลังรอ human validation และยังไม่มีการบันทึกผล
หลังทำ run ให้บันทึกวันที่ การตั้งค่า harness และผลของแต่ละ check ไว้ที่นี่
ความพร้อมของ parallel ยังคงถูกกั้นไว้จนกว่าจะมีผลสำเร็จที่บันทึกไว้
