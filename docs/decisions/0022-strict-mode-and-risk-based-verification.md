# ADR 0022: Strict mode and risk-based verification

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-10-02
- Narrows / จำกัดขอบเขต: ADR 0020 decision 1 (Plan approval gate) and its per-ticket verifier: the approval pause and the verifier for every ticket now belong to strict runs only / ข้อ 1 ของ ADR 0020 (gate การอนุมัติ Plan) และ verifier ของทุก ticket: การหยุดรออนุมัติและ verifier ทุก ticket เป็นของ strict run เท่านั้น
- Overrides / แทนที่บางส่วน: ADR 0021's rejected-alternative argument that a strict flag is a "second mode to test and document"; ADR 0021's decisions are kept unchanged / เหตุผลของ ADR 0021 ที่ปฏิเสธ strict flag เพราะเป็น "โหมดที่สองที่ต้องทดสอบและเขียนเอกสาร" โดยการตัดสินใจทั้งหมดของ ADR 0021 ยังคงอยู่
- Superseded in part by / ถูกแทนที่บางส่วนโดย: ADR 0023 (decision 1, `--strict`) / ADR 0023 (ข้อ 1, `--strict`)

## Context / บริบท

ADR 0020 puts every run behind a Plan approval pause and sends every worker
report to a fresh verifier. That is the safest setting, but most tickets in a
well-specified set are low risk, and the pause stops unattended runs while the
verifier for each one adds time and cost. ADR 0021 rejected a strict flag as a
second mode to test and document, but it had in mind a flag that restores
per-extra approval. Strictness here is a two-behavior switch (pause and verify
everything, or print the Plan and verify what is risky), and both behaviors are
tested and documented, so that argument no longer applies.

ADR 0020 ให้ทุก run หยุดรออนุมัติ Plan และส่งรายงาน worker ทุกชิ้นให้ verifier ใหม่ตรวจ
ซึ่งปลอดภัยที่สุด แต่ ticket ส่วนใหญ่ในชุดที่เขียน spec ดีมีความเสี่ยงต่ำ การหยุดรอทำให้ run ที่ไม่มีคนเฝ้าชะงัก
และ verifier ทุก ticket เพิ่มเวลาและต้นทุน ADR 0021 ปฏิเสธ strict flag โดยหมายถึง flag ที่คืนการอนุมัติรายไฟล์
แต่ strictness ในที่นี้เป็นสวิตช์สองพฤติกรรม (หยุดและตรวจทุกอย่าง หรือพิมพ์ Plan แล้วตรวจเฉพาะที่เสี่ยง)
ซึ่งทดสอบและเขียนเอกสารครบทั้งสองฝั่ง เหตุผลนั้นจึงใช้ไม่ได้อีก

## Decision / การตัดสินใจ

1. `--strict` pauses for Plan approval and verifies every ticket with a fresh
   verifier; nothing else changes with it. It adds no per-extra approval, warning
   pause, or smaller retry budget.
2. A run with no flag is in default strictness: it prints the Plan and starts
   without a pause, and a fresh verifier runs only for risky tickets. A ticket is
   risky when it is marked `Risk: high` or shows a risk signal (a counted retry,
   measured extras, an unknown touch set, incomplete evidence, or a rerun after a
   real merge conflict). A `Risk: low` field never lowers a signal.
3. Workers report red, green, and typecheck evidence in the existing Red output,
   Green output, and Test → criterion table sections of the worker report, each
   with command and exit code. The envelope schema and installed adapters do not
   change.
4. `grill-to-tickets` proposes `Risk: high` by rule and the person confirms each
   one at the ticket quiz.
5. ADR 0021's decisions (the approval scope, automatic extras, drain rounds and
   parked hits, and the serial default) are kept. Strict does not restore
   per-extra approval.

1. `--strict` หยุดรออนุมัติ Plan และใช้ verifier ใหม่ตรวจทุก ticket ไม่มีอะไรอื่นเปลี่ยนไปกับมัน
   ไม่เพิ่มการอนุมัติรายไฟล์ warning pause หรือลด retry budget
2. การรันที่ไม่มี flag อยู่ใน default strictness: พิมพ์ Plan แล้วเริ่มทำงานโดยไม่หยุด และใช้ verifier ใหม่เฉพาะ
   ticket ที่เสี่ยง คือ ticket ที่ระบุ `Risk: high` หรือมีสัญญาณเสี่ยง (retry ที่นับ, extras ที่วัดได้,
   touch set ที่ไม่ทราบ, หลักฐานไม่ครบ หรือ rerun หลัง merge conflict จริง) ส่วน `Risk: low` ไม่ลดสัญญาณเสี่ยง
3. Worker รายงานหลักฐาน red, green และ typecheck ในหัวข้อ Red output, Green output และตาราง
   Test → criterion เดิมของรายงาน พร้อมคำสั่งและ exit code โดย envelope schema และ adapter ที่ติดตั้งแล้วไม่เปลี่ยน
4. `grill-to-tickets` เสนอ `Risk: high` ตามกฎ และผู้ใช้ยืนยันทีละใบตอน quiz ticket
5. การตัดสินใจทั้งหมดของ ADR 0021 ยังคงอยู่ strict ไม่คืนการอนุมัติรายไฟล์

## Rejected alternatives / ทางเลือกที่ปฏิเสธ

- Strict restoring per-extra approval: contradicts ADR 0021.
- Evidence as a mandatory envelope field: breaks every installed adapter.
- A second skill wrapping `implement-spec`: no state to resume from, and it binds
  to upstream prose.
- Keeping the pause and the verifier for every ticket as the only behavior: slows
  unattended runs on low-risk tickets for no added safety.

- strict ที่คืนการอนุมัติรายไฟล์: ขัดกับ ADR 0021
- หลักฐานเป็นฟิลด์บังคับใน envelope: ทำให้ adapter ที่ติดตั้งแล้วใช้ไม่ได้ทั้งหมด
- skill ที่สองห่อ `implement-spec`: ไม่มี state ให้ resume และผูกกับข้อความของ upstream
- คงการหยุดรอและ verifier ทุก ticket เป็นพฤติกรรมเดียว: ทำให้ ticket เสี่ยงต่ำช้าลงโดยไม่เพิ่มความปลอดภัย

## Consequences / ผลที่ตามมา

- A default run starts unattended and skips the verifier for non-risky tickets
  with complete evidence; the handoff lists every ticket that skipped it, and the
  run record keeps a Verifier column.
- Interrupting the run is the only brake in default strictness; people who want
  review before dispatch pass `--strict`.
- Run records written before strictness existed are read as strict.
