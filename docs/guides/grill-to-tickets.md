# คู่มือการติดตั้งและใช้งาน Skill: grill-to-tickets

- **หมวดหมู่ (Category):** `agents`
- **แหล่งติดตั้ง (Install Source):** `ArrayaWongsaita/skills`
- **ไฟล์นิยามหลัก (Definition):** [`skills/agents/grill-to-tickets/SKILL.md`](../../skills/agents/grill-to-tickets/SKILL.md)

---

## 1. grill-to-tickets คืออะไรและมีไว้สำหรับทำอะไร?

`grill-to-tickets` เป็น **Standalone Composite Skill** ที่ออกแบบมาเพื่อรับผิดชอบช่วงการวางแผน (Planning Phase) ของการพัฒนาซอฟต์แวร์ โดยทำหน้าที่นำเสนอไอเดียเริ่มต้นเพียงหนึ่งไอเดีย (One Idea) ผ่านกระบวนการสัมภาษณ์แบบเจาะลึก, ถอดแบบโมเดลเชิงโดเมน, เขียนข้อกำหนด (Specification), ตรวจสอบความสมบูรณ์ผ่านเกณฑ์การออกแบบ (Design Review Gate) และแตกงานออกเป็น Tickets ที่พร้อมลงมือพัฒนาจริงในระดับย่อย (Tracer-bullet Vertical Tickets)

### จุดประสงค์หลักและคุณสมบัติเด่น
1. **จบกระบวนการวางแผนในคำสั่งเดียว:** ครอบคลุมตั้งแต่วิเคราะห์ความต้องการจนได้ Tickets ที่สมบูรณ์
2. **รักษา Context Window:** กระบวนการสัมภาษณ์, จัดทำ Spec, เขียน Ticket และตัดสินใจใน quiz จะรันบน reasoning thread เดียวกัน มี 2 ขั้นตอนที่ dispatch subagent: Stage 2 ส่ง `scrutinize` รีวิว spec ใน context ใหม่ ส่วน Stage 3 ส่ง fresh reviewer ทำ Ticket review เพื่อหา ambiguity ใน ticket จากนั้น skill จะ **หยุดส่งมอบงาน (Handoff)** โดยไม่ลงมือเขียนโค้ด (Implement) เอง เพื่อให้เซสชันถัดไปเริ่มด้วย Context ที่สดใหม่
3. **มี Design Review Gate ในตัว:** เลือกแนวทางการทบทวนได้ระหว่าง workflow; ดูคำศัพท์กลางใน [glossary](../../docs/glossary.md) และกติกาใน [สัญญา Design Review Gate](../../skills/agents/grill-to-tickets/references/design-review-gate.md)
4. **Standalone โดยสมบูรณ์:** มีกติกาและกลไกของตัวเอง ไม่แตะต้องหรือแก้ไข skill ต้นทางภายนอก

---

## 2. การพึ่งพา Skill อื่น (Dependencies) และการติดตั้ง

`grill-to-tickets` เป็น Composite Skill ที่ทำงานโดยการสั่งรันแบบ **Inline Execution** (อ่านข้อกำหนดและทำตามขั้นตอนในบริบทเดียวกัน) skill นี้ **owns รูปแบบ spec และ ticket เป็นของตัวเอง** แทนการพึ่งพา skill ที่เขียนสองรูปแบบนั้น:

| ไฟล์รูปแบบที่ skill เป็นเจ้าของ | ที่มา | ใช้ในขั้นตอน |
| :--- | :--- | :--- |
| `references/spec-format.md` | ดัดแปลงจาก skill เขียน spec ของ `mattpocock/skills` พร้อมแนบ `references/UPSTREAM-LICENSE.md` | Stage 1 — เขียน `spec.md` ตามหัวข้อมาตรฐาน |
| `references/ticket-format.md` | ดัดแปลงจาก skill แตก ticket ของ `mattpocock/skills` พร้อมแนบ `references/UPSTREAM-LICENSE.md` | Stage 3 — เขียน ticket ลง `issues/NN-<slug>.md` |

และมี **stage skill** ที่ติดตั้งแยกอีก 3 ตัว ซึ่งเป็นวิธีทำงาน (method) ที่ skill นี้ทำตามแบบ inline:

| ชื่อ Skill ที่พึ่งพา | เจ้าของ / Repository | หน้าที่ใน Workflow |
| :--- | :--- | :--- |
| **`grilling`** | `mattpocock/skills` | สัมภาษณ์ขุดคุ้ยความต้องการและทางเลือกในการออกแบบ (Stage 0) |
| **`domain-modeling`** | `mattpocock/skills` | กำหนดคำศัพท์เฉพาะทาง, Ubiquitous Language และบันทึก ADR (Stage 0) |
| **`scrutinize`** | `thananon/9arm-skills` | ตรวจสอบคุณภาพและช่องโหว่ของ Spec ใน Design Review Gate (Stage 2) |

### คำสั่งติดตั้งทั้งหมด

รันคำสั่งต่อไปนี้ผ่าน Terminal ในโฟลเดอร์โปรเจกต์ของคุณ:

```bash
# 1. ติดตั้งตัว skill หลัก (grill-to-tickets)
npx skills add ArrayaWongsaita/skills --skill grill-to-tickets

# 2. ติดตั้ง stage skills ที่พึ่งพา (Dependencies)
npx skills add mattpocock/skills --skill grilling
npx skills add mattpocock/skills --skill domain-modeling
npx skills add thananon/9arm-skills --skill scrutinize
```

ตอนเริ่ม (และตอน `continue`) skill จะทำ **Preflight** หา `SKILL.md` ของ stage skill ทั้ง 3 ตัวตามลำดับ `.agents/skills/` → `.claude/skills/` → `~/.agents/skills/` → `~/.claude/skills/` จึงใช้ได้ทั้งแบบติดตั้งใน project และแบบ global (`-g`) ถ้าขาดตัวไหนจะหยุดก่อน Stage 0 และพิมพ์คำสั่งติดตั้งเฉพาะตัวที่ขาด สำหรับแต่ละตัวที่เจอ Preflight จะบันทึกเฉพาะชื่อ skill และ path ที่พบ ถ้าต้องเช็ก update ใช้ `npx skills check`

---

## 3. วิธีการใช้งานและขั้นตอนการทำงาน (Usage & Workflow)

### คำสั่งเรียกใช้งาน (Invocation)
Skill นี้ถูกตั้งค่าแบบ Explicit Invocation (ต้องเรียกใช้ผ่านคำสั่งโดยตรงเท่านั้น):
- Slash command: `/grill-to-tickets <คำอธิบายไอเดียหรือฟีเจอร์>`
- Codex command: `$grill-to-tickets <คำอธิบายไอเดียหรือฟีเจอร์>`
- ทำต่อจากรอบที่ค้างไว้ (เช่น หลัง `/clear` หรือ session หลุด): `/grill-to-tickets continue <feature-slug>` โดย skill จะอ่าน State ใน `decisions.md` แล้วทำต่อจากจุดเดิม ไม่ถามคำถามที่ตอบไปแล้วซ้ำ

### โครงสร้างไฟล์ที่สร้างขึ้น (Feature-scoped Storage)
ไฟล์ผลลัพธ์ทั้งหมดจะถูกจัดเก็บแยกไว้ใต้โฟลเดอร์ `.scratch/<feature-slug>/` โดยไม่ปะปนกับโค้ดหลัก:
```text
.scratch/<feature-slug>/
├── decisions.md        # Decision Log: ทุกคำถาม คำตอบแนะนำ คำตอบจริง และ State ของ run
├── parked.md           # คำถามที่พักไว้ พร้อมสมมติฐานและสถานะ
├── CONTEXT.md          # พจนานุกรมคำศัพท์เชิงโดเมน (Ubiquitous Language)
├── adr/                # บันทึกการตัดสินใจทางสถาปัตยกรรม (NNNN-<slug>.md)
├── spec.md             # เอกสารข้อกำหนดของฟีเจอร์ (Specification)
├── design-review.md    # รายงานผลการตรวจสอบ Design Review Gate
├── issues/             # รายการ tickets ที่พร้อมพัฒนา (NN-<slug>.md)
└── manifest.json       # derived planning snapshot สำหรับ handoff
```

### ขั้นตอนการทำงาน 4 ลำดับขั้น

คำศัพท์ใน Stage 0 ได้แก่ tier `hard` / `easy`, `parked` และ `resolved: assumed`;
ดู [glossary](../../docs/glossary.md) สำหรับศัพท์กลาง และยึด [สัญญา grill-to-tickets หลัก](../../skills/agents/grill-to-tickets/SKILL.md),
[Decision Log](../../skills/agents/grill-to-tickets/references/decision-log.md),
[สัญญาคำถามที่พักไว้](../../skills/agents/grill-to-tickets/references/parked-questions.md),
[สัญญา Blind-spot pass](../../skills/agents/grill-to-tickets/references/blind-spot-pass.md),
[สัญญา Design Review Gate](../../skills/agents/grill-to-tickets/references/design-review-gate.md)
และ [ตาราง rationalization](../../skills/agents/grill-to-tickets/references/rationalizations.md)
เป็นแหล่งกติกาการทำงาน


```text
Stage 0: Grill        grilling + domain-modeling  → CONTEXT.md, adr/
   │ pause · confirm + ask review maximum
   ▼
Stage 1: Spec         spec-format.md               → spec.md
   ▼
Stage 2: Design Review Gate   scrutinize (subagent ใหม่) → design-review.md
   │ review complete
   ▼
Stage 3: Tickets      ticket-format.md + checker   → issues/NN-<slug>.md + manifest.json + Ticket review
   ▼
Stop: Handoff message (/clear, DAG summary + recommended implementer แล้ว /implement-tickets)
```

1. **Stage 0 — Grill (สัมภาษณ์และสร้างโมเดลโดเมน):**
   - สัมภาษณ์และทำ domain modeling เพื่อสร้าง `decisions.md`, `CONTEXT.md` และ `adr/`; ปิดช่วงค้นหาด้วย blind-spot pass ก่อนเข้าสู่ Stage 1
   - ดูสัญญาหลักและ references ที่ลิงก์ไว้ด้านบนสำหรับ tier ของคำถาม, parked questions, blind-spot pass และ Stage 0 pause
2. **Stage 1 — Spec (จัดทำเอกสารข้อกำหนด):**
   - สังเคราะห์บันทึก Stage 0 เป็น `spec.md` ตามรูปแบบที่ skill เป็นเจ้าของเอง (`references/spec-format.md`); ศัพท์อย่าง Scenario และ Test Seam ใช้ตาม [glossary](../../docs/glossary.md) และสัญญาหลัก
3. **Stage 2 — Design Review Gate (ตรวจสอบการออกแบบ):**
   - ส่ง `scrutinize` ใน context ใหม่มาตรวจ spec; ดู [สัญญา Design Review Gate](../../skills/agents/grill-to-tickets/references/design-review-gate.md) สำหรับการตีความผลและทางเดินต่อ
4. **Stage 3 — Tickets (แตกชิ้นงานย่อย):**
   - แตก `spec.md` เป็น Tracer-bullet vertical slices ใน `issues/<NN>-<slug>.md` เรียงตาม dependency
   - ทุก ticket ระบุ stories ที่ส่งมอบและ dependency พร้อม **Seam**, **Context** และ **Budget** ตามรูปแบบใน `references/ticket-format.md`
   - checker รายงานความครอบคลุม, budget, DAG และ warnings; manifest สำหรับ handoff อยู่ที่ `.scratch/<feature-slug>/manifest.json` และมี `recommendedImplementers: ["implement-tickets"]` ทุก wave width ดู [สัญญา grill-to-tickets หลัก](../../skills/agents/grill-to-tickets/SKILL.md) สำหรับกฎ checker และ manifest
   - **Ticket review (Stage 3.5):** หลัง checker PASS และก่อน quiz ให้ทำ ticket review ดู [สัญญา grill-to-tickets หลัก](../../skills/agents/grill-to-tickets/SKILL.md) และ [brief สำหรับผู้รีวิว ticket](../../skills/agents/grill-to-tickets/references/ticket-review.md) สำหรับรายละเอียด
   - **เสนอ `Risk: high` ที่ quiz:** skill เสนอ `Risk: high` พร้อมเหตุผลตามกฎใน [ticket-format reference](../../skills/agents/grill-to-tickets/references/ticket-format.md); ผู้ใช้ยืนยันหรือปฏิเสธทีละ ticket และเฉพาะ high ที่ยืนยันแล้วเท่านั้นที่ถูกเขียนลงไฟล์ ticket ส่วน ticket อื่นเขียนโดยไม่มีฟิลด์ Risk
   - ดูสัญญาหลักสำหรับการจัดการ warnings และการแก้ ticket ระหว่าง quiz
5. **Stop — Handoff (ส่งมอบงาน):**
   - พิมพ์ข้อความ handoff ตามลำดับ: `/clear` → **DAG summary** → `recommended implementer` จาก checker → `Manifest: .scratch/<feature-slug>/manifest.json` เมื่อมี → คำสั่ง `/implement-tickets`
   - handoff ระบุ parked questions ที่รับเป็นสมมติฐาน; ดู [สัญญาคำถามที่พักไว้](../../skills/agents/grill-to-tickets/references/parked-questions.md) สำหรับรายละเอียด
   - แสดงข้อความสรุปและแนะนำขั้นตอนสำหรับเซสชันถัดไป:
     ```text
     # 1. .scratch/ อยู่ในเครื่องและถูก git ignore จึงไม่ต้อง commit
     /clear
     # 2. วาง DAG summary สุดท้ายจาก checker
     wave 0: 01
     wave 1: 02, 03
     maximum wave width: 2
     critical-path length: 2
     recommended implementer: implement-tickets
     Manifest: .scratch/<feature-slug>/manifest.json
     # 3. implement ทั้งโฟลเดอร์ใน session ใหม่
     /implement-tickets .scratch/<feature-slug>/
     ```

---

## 4. ตัวอย่างคำสั่งและ Prompt ใช้งานจริง

### ตัวอย่างที่ 1: เพิ่มระบบตั้งค่าฟอนต์ซับไตเติล
```text
/grill-to-tickets เพิ่มการตั้งค่าขนาดฟอนต์ subtitle ในหน้า player settings ให้ผู้ใช้ปรับเองได้และจำค่าไว้ต่อเครื่อง
```

### ตัวอย่างที่ 2: ระบบ Export รายงานเป็น Excel แบบ Asynchronous
```text
/grill-to-tickets สร้างระบบ Export รายงานสรุปยอดขายรายเดือนเป็นไฟล์ Excel ผ่าน Background Job พร้อมส่งอีเมลแจ้งเตือนเมื่อเสร็จ
```

---

## 5. ข้อควรระวังและคำแนะนำในการใช้งาน
- **อย่าใช้เมื่อต้องการเขียนโค้ดทันที:** หากต้องการให้เขียนโค้ดเสร็จสรรพในรอบเดียว ควรใช้ `/engineering-workflow` แทน
- **ติดตั้ง stage skill ให้ครบ:** หากขาด stage skill ใดใน 3 ตัวข้างต้น Preflight จะหยุดก่อนเริ่มสัมภาษณ์และบอกคำสั่งติดตั้งตัวที่ขาด
- **ไม่ต้องตั้งค่า issue tracker:** ไฟล์ใน `.scratch/<feature-slug>/` คือ tracker ของ skill นี้ และรูปแบบที่ skill เป็นเจ้าของ (`references/spec-format.md`, `references/ticket-format.md`) ไม่มีขั้นตอน publish ไป tracker, ติด label หรือรัน `/setup-matt-pocock-skills`
- **รีเซ็ต Context หลังเสร็จสิ้น:** เมื่อได้ Tickets ครบแล้ว ให้พิมพ์ `/clear` ก่อนเริ่ม implement เพื่อให้สมองของ AI ทำงานได้อย่างเต็มประสิทธิภาพที่สุด
