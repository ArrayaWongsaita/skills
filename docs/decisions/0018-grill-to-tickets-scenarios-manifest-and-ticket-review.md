# ADR 0018: Scenarios, manifest, and ticket review for grill-to-tickets

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-09-30
- Amends / แก้ไข: ADR 0014 and ADR 0010 decision 5

## Context / บริบท

Stories need concrete examples before they are broken into tickets. A `Scenario:`
line under a user story gives the author and reviewer an observable example to
trace into a test. A passing ticket check also needs a stable summary of the
spec fingerprint and ticket DAG, while the ticket files remain the source of
truth. Finally, a fresh worker can still find a ticket unclear after the
checker passes, when the person planning the work can answer the question
cheaply.

เรื่องราวผู้ใช้ต้องมีตัวอย่างที่ชัดเจนก่อนแตกเป็น ticket บรรทัด `Scenario:`
ใต้ user story ทำให้ผู้เขียนและผู้รีวิวเห็นตัวอย่างที่สังเกตและตามไปถึง test ได้
เมื่อ checker ผ่านแล้วก็ควรมีสรุป fingerprint ของ spec และ DAG ของ ticket ที่คงที่
โดยไฟล์ ticket ยังเป็นแหล่งข้อมูลหลัก และผู้ลงมือคนใหม่อาจพบว่ายังมี ticket
กำกวมหลัง checker ผ่าน ช่วงที่ผู้วางแผนยังตอบคำถามได้โดยมีต้นทุนต่ำ

## Decision / การตัดสินใจ

1. A new spec gives every numbered user story one or more indented, one-line
   `Scenario: given … when … then …` examples. A spec with no scenarios remains
   valid for older work and receives a warning; a spec that starts using
   scenarios must supply one for every story.

   spec ใหม่มีตัวอย่างสถานการณ์ทดสอบ (`Scenario: given … when … then …`) แบบบรรทัดเดียวที่เยื้องใต้
   numbered user story ทุกเรื่อง อย่างน้อยหนึ่งตัว spec เก่าที่ไม่มี scenario
   ยังใช้ได้และได้ warning; ถ้า spec เริ่มใช้ scenario ต้องมีให้ทุก story

2. On a passing `--write-budget` run, `check-tickets.mjs` writes a derived
   `manifest.json` beside `issues/`. It records the spec SHA-256, waves, maximum
   wave width, critical-path length, recommended implementers, and planning-time
   ticket facts. It has no timestamp or `Status`, so the same inputs produce
   identical bytes and ticket files remain the source for ticket facts.

   เมื่อ `--write-budget` ผ่าน `check-tickets.mjs` เขียน `manifest.json` ที่ได้มา
   จากข้อมูลข้างเคียง `issues/` โดยเก็บ SHA-256 ของ spec, waves, ความกว้างสูงสุด
   ของ wave, critical-path length, implementer ที่แนะนำ และข้อมูล ticket ตอนวางแผน
   ไม่มี timestamp หรือ `Status` ดังนั้น input เดิมให้ bytes เดิมและไฟล์ ticket
   ยังคงเป็นแหล่งข้อมูลของ ticket

3. After the checker passes and before the quiz, Stage 3 includes one Stage 3.5
   ticket review by a fresh reviewer. It reads the ticket set and the files
   named in each ticket's `**Context:**` line, then returns `READY` or `ASK` for
   every ticket. `ASK` carries the question a fresh worker would have to ask.
   The review checks ambiguity only; it is not a Budget check and sets no limit.
   The quiz shows each `ASK` beside that ticket's Seam, Context, and Budget.

   หลัง checker ผ่านและก่อน quiz, Stage 3 มี Ticket review (รีวิว ticket) หนึ่งรอบใน Stage 3.5
   โดย fresh reviewer อ่านชุด ticket และไฟล์ที่ระบุในบรรทัด `**Context:**` ของแต่ละใบ
   แล้วตอบ `READY` หรือ `ASK` สำหรับทุก ticket โดย `ASK` ต้องมีคำถามที่ worker
   คนใหม่จะต้องถาม การรีวิวตรวจเฉพาะความกำกวม ไม่ใช่ Budget check และไม่กำหนด limit
   quiz แสดง `ASK` ข้าง Seam, Context และ Budget ของ ticket นั้น

4. The ticket review runs once by default. `--ticket-review 0` skips it. The
   main thread fixes or acknowledges `ASK` items, runs the checker again, and
   logs the verdicts and resolutions in `decisions.md`; a second review starts
   only when the person asks. `continue` keeps the recorded `done` or `skipped`
   state.

   ticket review ทำงานหนึ่งครั้งเป็นค่าเริ่มต้น และ `--ticket-review 0` ใช้ข้ามได้
   main thread แก้หรือ acknowledge รายการ `ASK`, รัน checker ซ้ำ และบันทึก verdict
   กับการแก้ไว้ใน `decisions.md`; เริ่มรีวิวรอบที่สองเมื่อผู้ใช้ขอเท่านั้น ส่วน
   `continue` ใช้ State `done` หรือ `skipped` ที่บันทึกไว้

5. This is the ambiguity-only form of the readiness dry-runs ADR 0014 deferred.
   That deferral is lifted for the ticket review alone. Limits, profiles,
   over-budget warnings, and Budget calibration stay deferred. The default-on
   cost is accepted because this review needs no calibration data, sets no
   limit, and can catch a blocking question before implementation, while
   `--ticket-review 0` lets a person opt out of its one fresh-reviewer pass.

   นี่คือ readiness dry-run รูปแบบตรวจเฉพาะความกำกวมที่ ADR 0014 เคยเลื่อนออกไป
   จึงยกเว้นการเลื่อนนั้นเฉพาะ ticket review ส่วน limits, profiles, over-budget
   warnings และ Budget calibration ยังคงเลื่อนออกไป ยอมรับต้นทุนที่เปิดเป็นค่าเริ่มต้น
   เพราะการรีวิวนี้ไม่ต้องใช้ข้อมูล calibration ไม่กำหนด limit และจับคำถามที่ขวางงาน
   ได้ก่อนเริ่ม implement โดยผู้ใช้เลือกข้ามการรีวิว fresh reviewer หนึ่งรอบได้ด้วย
   `--ticket-review 0`

6. This amends decision 5 of ADR 0010. Its earlier rule said Stages 0, 1, and 3
   stay on the main thread and the only dispatches are fact lookups and the
   Stage 2 spec review. Stage 3 now also dispatches the ticket reviewer. The
   interview, spec writing, ticket writing, and the rest of Stage 3 stay on the
   main thread.

   ข้อนี้แก้ decision 5 ของ ADR 0010 ซึ่งเดิมกำหนดให้ Stage 0, 1 และ 3 อยู่ใน
   main thread และส่ง subagent เฉพาะ fact lookup กับ spec review ใน Stage 2
   ตอนนี้ Stage 3 ส่ง ticket reviewer ด้วย ส่วน interview, การเขียน spec,
   การเขียน ticket และส่วนอื่นของ Stage 3 ยังอยู่ใน main thread

## Consequences / ผลที่ตามมา

### Positive / ข้อดี

- Scenarios connect user stories to observable behavior before tickets exist.
- The manifest makes the passing check's DAG and spec fingerprint easy to find
  without replacing the feature files as the source of truth.
- A person can resolve ambiguity while tickets are still being planned, before
  an implementer spends time on a question.

- Scenario เชื่อม user story กับ behavior ที่สังเกตได้ก่อนมี ticket
- manifest ทำให้หา DAG และ fingerprint ของ spec หลัง checker ผ่านได้ง่าย
  โดยไม่แทนที่ไฟล์ feature ในฐานะแหล่งข้อมูลหลัก
- ผู้วางแผนแก้ความกำกวมได้ตอนที่ ticket ยังอยู่ในขั้นวางแผน ก่อน implementer
  จะเสียเวลาไปกับคำถาม

### Trade-offs / ข้อแลกเปลี่ยน

- The default review adds one fresh-reviewer dispatch to a run. It is a
  deliberate, narrow cost that catches questions early and has an explicit
  skip flag.
- The manifest is a derived snapshot; ticket changes require a passing checker
  run to refresh it.

- ค่าเริ่มต้นเพิ่มการ dispatch fresh reviewer หนึ่งครั้งต่อ run เป็นต้นทุนที่จำกัด
  เพื่อจับคำถามตั้งแต่ต้นและมี flag สำหรับข้ามโดยตรง
- manifest เป็น snapshot ที่สร้างจากข้อมูลต้นทาง เมื่อ ticket เปลี่ยนต้องรัน
  checker ให้ผ่านเพื่อสร้างใหม่

## Rejected alternatives / ทางเลือกที่ไม่เลือก

- Keep readiness dry-runs fully deferred: the ticket review reads only for
  ambiguity and does not invent an uncalibrated Budget limit.
- Make the review opt-in: most ticket ambiguity is cheapest to fix before the
  quiz and implementation, and the one-pass cost is easy to skip with a flag.
- Store ticket status or timestamps in the manifest: both would make a
  planning snapshot stale or noisy as implementation proceeds.

- เลื่อน readiness dry-run ทุกแบบต่อไป: ticket review ตรวจเฉพาะความกำกวมและ
  ไม่สร้าง Budget limit ที่ยังไม่มี calibration
- ให้รีวิวเป็น opt-in: ความกำกวมของ ticket แก้ได้ถูกที่สุดก่อน quiz และ implement
  และข้ามต้นทุนการรีวิวหนึ่งรอบได้ง่ายด้วย flag
- เก็บ status หรือ timestamp ใน manifest: ทั้งคู่ทำให้ snapshot ตอนวางแผน
  เก่าหรือเกิด diff ที่ไม่จำเป็นเมื่อเริ่ม implement
