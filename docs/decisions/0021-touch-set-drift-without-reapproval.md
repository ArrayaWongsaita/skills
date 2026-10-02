# ADR 0021: Touch-set drift without re-approval

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-10-02
- Narrows / จำกัดขอบเขต: ADR 0020 decision 1 (Plan approval gate)

## Context / บริบท

ADR 0020 puts execution behind the core's Plan approval gate but does not say
what that gate covers. In practice unattended runs stalled on every extra file a
worker touched beyond its ticket's declared touch set, even when no sibling
ticket overlapped (one ticket added `docs/research.md`, another added
`Deck.tsx`). The integration gate, the verifier, and ticket-order squash-merge
already detect real conflicts, so a per-file approval adds waiting without
adding safety.

ADR 0020 ระบุว่าการ execute ต้องผ่านการอนุมัติ Plan ของ core แต่ไม่ได้ระบุว่า
การอนุมัตินั้นครอบคลุมอะไร ในทางปฏิบัติ run ที่ไม่มีคนเฝ้าหยุดรอทุกครั้งที่ worker
แตะไฟล์เพิ่มนอก touch set ที่ ticket ประกาศไว้ แม้ไม่มี ticket พี่น้องที่ทับซ้อนก็ตาม
ขณะที่ integration gate, verifier และการ squash-merge ตามลำดับ ticket
ตรวจจับ conflict จริงได้อยู่แล้ว การขออนุมัติรายไฟล์จึงเพิ่มเวลารอโดยไม่เพิ่มความปลอดภัย

## Decision / การตัดสินใจ

1. The Plan approval covers the run mode, waves, blockers, ticket set, budget,
   backend, and concurrency. A ticket's declared touch set is a planning baseline, not an
   approval boundary.
2. Extras (files touched beyond the declared touch set) are accepted
   automatically, recorded in the run state, and reported at each wave end and
   in the final handoff, unless they hit the deny-list, exceed 5 files per
   ticket, or cause a real conflict with a sibling ticket.
3. A real conflict defers the ticket to a drain round in the same wave. A
   deny-list or cap hit parks the ticket as `BLOCKED (TOUCH_SET_APPROVAL)` while
   independent tickets continue.
4. Serial (one ticket per wave) is the default run mode; `--parallel` opts in
   and `--concurrency N` implies it. This clarifies ADR 0020, whose statement
   that waves are planned in parallel by default is read as describing the
   planner's capability, and it fits ADR 0020 decision 4, the parallel
   validation gate.

1. Plan approval ครอบคลุมโหมดการรัน, wave, blocker, ชุด ticket, budget, backend
   และ concurrency touch set ที่ ticket ประกาศไว้เป็นเพียง baseline ของการวางแผน ไม่ใช่ขอบเขตการอนุมัติ
2. Extras (ไฟล์ที่แตะนอก touch set) ยอมรับอัตโนมัติ บันทึกใน run state และรายงานตอนจบ
   wave กับใน handoff สุดท้าย ยกเว้นกรณีชน deny-list, เกิน 5 ไฟล์ต่อ ticket
   หรือเกิด conflict จริงกับ ticket พี่น้อง
3. conflict จริงเลื่อน ticket ไปทำใน drain round ของ wave เดิม ส่วนการชน deny-list
   หรือ cap จะพัก ticket เป็น `BLOCKED (TOUCH_SET_APPROVAL)` โดย ticket ที่เป็นอิสระยังทำต่อ
4. Serial (หนึ่ง ticket ต่อ wave) เป็นโหมดเริ่มต้น `--parallel` เป็นการเลือกเปิดใช้
   และ `--concurrency N` หมายถึง `--parallel` ด้วย ข้อนี้ชี้แจง ADR 0020
   และสอดคล้องกับ gate การ validate parallel ใน decision 4 ของ ADR 0020

## Rejected alternatives / ทางเลือกที่ปฏิเสธ

- Ask on every extra: breaks unattended runs.
- Defer on any path overlap: wastes finished, verified work when the merge is clean.
- Defer to the next wave: mixes the ticket with its dependants and loses the
  invariant that wave N is fully integrated before wave N+1 starts.
- Keep parallel as the default: parallel is not yet validated (ADR 0020
  decision 4).
- Add a strict flag that restores per-extra approval: a second mode to test and
  document for a behavior the gates already cover.

- ถามทุกครั้งที่มี extra: ทำให้ run ที่ไม่มีคนเฝ้าหยุดชะงัก
- เลื่อนเมื่อ path ทับกันเพียงเล็กน้อย: ทิ้งงานที่เสร็จและตรวจแล้วทั้งที่ merge สะอาด
- เลื่อนไป wave ถัดไป: ปนกับ ticket ที่พึ่งพา และเสียหลักว่า wave N รวมครบก่อนเริ่ม wave N+1
- คง parallel เป็นค่าเริ่มต้น: parallel ยังไม่ผ่านการ validate (ADR 0020 decision 4)
- เพิ่ม strict flag เพื่อคืนการอนุมัติรายไฟล์: เป็นโหมดที่สองที่ต้องทดสอบและเขียนเอกสาร
  ทั้งที่ gate เดิมครอบคลุมพฤติกรรมนี้แล้ว

## Consequences / ผลที่ตามมา

- Unattended runs no longer stall on harmless extras, and every extra stays
  visible in the run state and the reports.
- The loose conflict rule (a real conflict, not any path overlap) depends on the
  project's tests to catch a semantic conflict: two tickets can merge cleanly
  yet still break each other's behavior, and only the full-suite gate will show
  it.
- Serial as the default means a first run is slower until parallel mode is
  validated and opted into.

- run ที่ไม่มีคนเฝ้าไม่หยุดเพราะ extras ที่ไม่เป็นอันตราย และทุก extra ยังตรวจย้อนได้จาก
  run state และรายงาน
- กฎ conflict แบบหลวม (conflict จริง ไม่ใช่ path ทับกันทุกกรณี) พึ่ง test ของโปรเจกต์
  ในการจับ semantic conflict: สอง ticket อาจ merge สะอาดแต่ทำให้พฤติกรรมของกันและกันพัง
  ซึ่งมีเพียง full-suite gate ที่จะเห็น
- ค่าเริ่มต้นแบบ serial ทำให้ run แรกช้ากว่าจนกว่า parallel จะผ่านการ validate และถูกเลือกใช้
