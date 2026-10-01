# ADR 0019: grill-to-tickets tiers, parked questions, and one pause

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-09-30
- Amends / แก้ไข: ADR 0013 decision 3 and ADR 0017 decision 3

## Context / บริบท

Equal-length interview questions spend attention on safe defaults. Unanswered
questions need a visible home, and a separate review-budget interruption adds
another pause. Preflight records lock data that no later step consumes.

คำถามทุกข้อใช้พื้นที่เท่ากันแม้มีค่าเริ่มต้นที่ปลอดภัย คำถามที่ยังตอบไม่ได้ต้องมี
ที่เก็บชัดเจน การถามจำนวนรอบ review แยกเพิ่มการหยุด และข้อมูล lock ใน Preflight
ไม่มีขั้นตอนใดนำไปใช้

## Decision / การตัดสินใจ

1. Tag every interview question, blind-spot round included, `hard` or `easy`.
   Hard changes a story, interface, test seam, or is hard to reverse; show full
   text and a recommendation. Easy gets one line with a safe default and is
   answered by exception. Unsure means hard; the person can promote easy.

   ทุกคำถามรวม blind-spot round มี tier hard หรือ easy ตามผลต่อการออกแบบ
   hard มีคำถามเต็มและคำตอบแนะนำ easy มี default บรรทัดเดียว ถ้าไม่แน่ใจใช้ hard
   ผู้ใช้ยก easy เป็น hard ได้

2. Store unanswered questions in `parked.md` beside `decisions.md`, with question,
   reason, blocking status, default assumption, owner, and status. Open blockers
   hold the pause; accepted defaults and confirmed non-blockers become
   `resolved: assumed`. Stage 1 puts defaults in Further Notes; pause and handoff
   list assumed entries. Link the excuse/reality/action rationalization table
   from the skill; reviewer briefs remain focused on their review.

   เก็บคำถามที่พักไว้ใน parked.md พร้อมข้อมูลหกช่อง blocker ที่เปิดอยู่ขวาง pause
   ค่าเริ่มต้นที่ยอมรับเป็น resolved: assumed และไปอยู่ใน Further Notes
   แสดงสมมติฐานทั้งตอน pause และ handoff พร้อมลิงก์ตารางทางลัดจาก skill

3. This amends ADR 0013 decision 3: Preflight records only the skill and path
   found. Lookup order and stop-and-install behavior stay; `npx skills check`
   checks updates. Older log entries remain valid and are kept.

   แก้ ADR 0013 decision 3 ให้ Preflight บันทึกเฉพาะชื่อ skill และ path ที่พบ
   คงลำดับการค้นหาและการหยุดเมื่อติดตั้งไม่ครบ ใช้ npx skills check ตรวจ update
   เก็บ log เก่าไว้และยังใช้งานได้

4. This amends ADR 0017 decision 3: the Stage 0 pause asks confirmation and the
   review maximum together, proposing 3; 0 skips and `--review N` answers up
   front. Missing or invalid values ask at the pause. State stores the answer
   and rounds used. Stage 2 reads State; only an older resumed run without an
   answer asks there. Resume and decision re-grill preserve the answer and spent
   rounds; recorded State wins over flags on continue.

   แก้ ADR 0017 decision 3 ให้ถาม confirmation และจำนวนรอบใน Stage 0 pause
   เดียวกัน เสนอ 3 และ 0 ข้ามได้ flag ตอบล่วงหน้า ค่าที่ผิดหรือขาดให้ถาม
   บันทึกคำตอบและรอบที่ใช้ใน State ส่วน Stage 2 อ่าน State และถามเฉพาะ run เก่า
   ที่ไม่มีคำตอบ resume และ re-grill ไม่เติมรอบหรือถามซ้ำ State มีสิทธิ์เหนือ flag

## Consequences / ผลที่ตามมา

Attention follows decision risk, unanswered questions remain explicit, and fresh
runs have one confirmation pause. Classification still needs judgment; the
parked artifact adds state to maintain. Formats, checker, manifest, upstream
skills, and earlier runs stay compatible. Full flow details live in the
[canonical skill](../../skills/agents/grill-to-tickets/SKILL.md) and its references.

ผู้ใช้ใช้เวลากับความเสี่ยงของการตัดสินใจ คำถามที่ยังตอบไม่ได้ไม่หาย และ run ใหม่
ยืนยันใน pause เดียว แต่การเลือก tier ยังต้องใช้วิจารณญาณและต้องดูแลสถานะเพิ่ม
รูปแบบ checker manifest และ skill ต้นทางยังเข้ากันกับ run เก่า

## Rejected alternatives / ทางเลือกที่ไม่เลือก

Keeping equal question weight, guessing deferred answers, and asking the budget
again at Stage 2 preserve the original friction. Comparing lock hashes would
introduce an update-validation mechanism outside this planning skill.

ไม่เลือกคำถามที่หนักเท่ากัน การเดาคำตอบที่พักไว้ หรือถามจำนวนรอบซ้ำใน Stage 2
เพราะคงปัญหาเดิม ไม่เพิ่มการเทียบ lock hash ซึ่งเป็นกลไกตรวจ update นอกขอบเขต
