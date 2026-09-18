# คู่มือการติดตั้งและใช้งาน Skill: grill-to-tickets

- **หมวดหมู่ (Category):** `agents`
- **แหล่งติดตั้ง (Install Source):** `ArrayaWongsaita/skills`
- **ไฟล์นิยามหลัก (Definition):** [`skills/agents/grill-to-tickets/SKILL.md`](../../skills/agents/grill-to-tickets/SKILL.md)

---

## 1. grill-to-tickets คืออะไรและมีไว้สำหรับทำอะไร?

`grill-to-tickets` เป็น **Standalone Composite Skill** ที่ออกแบบมาเพื่อรับผิดชอบช่วงการวางแผน (Planning Phase) ของการพัฒนาซอฟต์แวร์ โดยทำหน้าที่นำเสนอไอเดียเริ่มต้นเพียงหนึ่งไอเดีย (One Idea) ผ่านกระบวนการสัมภาษณ์แบบเจาะลึก, ถอดแบบโมเดลเชิงโดเมน, เขียนข้อกำหนด (Specification), ตรวจสอบความสมบูรณ์ผ่านเกณฑ์การออกแบบ (Design Review Gate) และแตกงานออกเป็น Tickets ที่พร้อมลงมือพัฒนาจริงในระดับย่อย (Tracer-bullet Vertical Tickets)

### จุดประสงค์หลักและคุณสมบัติเด่น
1. **จบกระบวนการวางแผนในคำสั่งเดียว:** ครอบคลุมตั้งแต่วิเคราะห์ความต้องการจนได้ Tickets ที่สมบูรณ์
2. **รักษา Context Window:** กระบวนการสัมภาษณ์, จัดทำ Spec, รีวิว และแตก Ticket จะรันอยู่บน reasoning thread เดียวกันแบบต่อเนื่อง จากนั้นจะ **หยุดส่งมอบงาน (Handoff)** ทันทีที่ออก Tickets เสร็จ โดยไม่ลงมือเขียนโค้ด (Implement) เอง เพื่อให้เซสชันถัดไปที่ต้องเขียนโค้ดเริ่มต้นด้วย Context ที่สดใหม่และสะอาด
3. **มี Design Review Gate ในตัว:** มีระบบตรวจคัดกรอง Spec ด้วย `scrutinize` ที่จำกัดงบประมาณไม่เกิน 6 รอบ, ตรวจจับการติดขัด (Stall detection) และแยกทางแก้แบบ Spec-level ออกจาก Decision-level อย่างชัดเจน
4. **Standalone โดยสมบูรณ์:** มีกติกาและกลไกของตัวเอง ไม่แตะต้องหรือแก้ไข skill ต้นทางภายนอก

---

## 2. การพึ่งพา Skill อื่น (Dependencies) และการติดตั้ง

`grill-to-tickets` เป็น Composite Skill ที่ทำงานโดยการสั่งรันแบบ **Inline Execution** (อ่านข้อกำหนดและทำตามขั้นตอนในบริบทเดียวกัน) ซึ่งพึ่งพา Sub-skills ดังต่อไปนี้:

| ชื่อ Skill ที่พึ่งพา | เจ้าของ / Repository | หน้าที่ใน Workflow |
| :--- | :--- | :--- |
| **`grilling`** | `mattpocock/skills` | สัมภาษณ์ขุดคุ้ยความต้องการและทางเลือกในการออกแบบ (Stage 0) |
| **`domain-modeling`** | `mattpocock/skills` | กำหนดคำศัพท์เฉพาะทาง, Ubiquitous Language และบันทึก ADR (Stage 0) |
| **`to-spec`** | `mattpocock/skills` | สังเคราะห์ผลการตัดสินใจออกมาเป็นไฟล์ข้อกำหนด `spec.md` (Stage 1) |
| **`scrutinize`** | `thananon/9arm-skills` | ตรวจสอบคุณภาพและช่องโหว่ของ Spec ใน Design Review Gate (Stage 2) |
| **`to-tickets`** | `mattpocock/skills` | แตก Spec ออกเป็น vertical tracer-bullet tickets (Stage 3) |

### คำสั่งติดตั้งทั้งหมด

รันคำสั่งต่อไปนี้ผ่าน Terminal ในโฟลเดอร์โปรเจกต์ของคุณ:

```bash
# 1. ติดตั้งตัว skill หลัก (grill-to-tickets)
npx skills add ArrayaWongsaita/skills --skill grill-to-tickets

# 2. ติดตั้ง skills ที่พึ่งพา (Dependencies)
npx skills add mattpocock/skills --skill grilling
npx skills add mattpocock/skills --skill domain-modeling
npx skills add mattpocock/skills --skill to-spec
npx skills add mattpocock/skills --skill to-tickets
npx skills add thananon/9arm-skills --skill scrutinize
```

---

## 3. วิธีการใช้งานและขั้นตอนการทำงาน (Usage & Workflow)

### คำสั่งเรียกใช้งาน (Invocation)
Skill นี้ถูกตั้งค่าแบบ Explicit Invocation (ต้องเรียกใช้ผ่านคำสั่งโดยตรงเท่านั้น):
- Slash command: `/grill-to-tickets <คำอธิบายไอเดียหรือฟีเจอร์>`
- Codex command: `$grill-to-tickets <คำอธิบายไอเดียหรือฟีเจอร์>`

### โครงสร้างไฟล์ที่สร้างขึ้น (Feature-scoped Storage)
ไฟล์ผลลัพธ์ทั้งหมดจะถูกจัดเก็บแยกไว้ใต้โฟลเดอร์ `.scratch/<feature-slug>/` โดยไม่ปะปนกับโค้ดหลัก:
```text
.scratch/<feature-slug>/
├── CONTEXT.md          # พจนานุกรมคำศัพท์เชิงโดเมน (Ubiquitous Language)
├── adr/                # บันทึกการตัดสินใจทางสถาปัตยกรรม (NNNN-<slug>.md)
├── spec.md             # เอกสารข้อกำหนดของฟีเจอร์ (Specification)
├── design-review.md    # รายงานผลการตรวจสอบ Design Review Gate
└── issues/             # รายการ tickets ที่พร้อมพัฒนา (NN-<slug>.md)
```

### ขั้นตอนการทำงาน 4 ลำดับขั้น

```text
Stage 0: Grill        grilling + domain-modeling  → CONTEXT.md, adr/
   │ (หยุดรอการยืนยันจากผู้ใช้เมื่อคำถามหมด)
   ▼
Stage 1: Spec         to-spec                     → spec.md
   ▼
Stage 2: Design Review Gate   scrutinize          → design-review.md   (จำกัดงบ 6 รอบ)
   │ (เมื่อผลเป็น SHIP)
   ▼
Stage 3: Tickets      to-tickets                  → issues/NN-<slug>.md
   ▼
Stop: Handoff message (แนะนำคำสั่ง /clear และ /subagent-implement ต่อไป)
```

1. **Stage 0 — Grill (สัมภาษณ์และสร้างโมเดลโดเมน):**
   - สำรวจบริบทเดิมใน repo (`CONTEXT.md`, `docs/adr/`)
   - สัมภาษณ์ถามตอบทีละประเด็นโดยมีตัวเลือกแนะนำ (ใช้ `grilling`)
   - บันทึกคำศัพท์ลง `CONTEXT.md` และบันทึกการตัดสินใจยากๆ ลง `adr/` ทันที (ใช้ `domain-modeling`)
   - เมื่อตัดสินใจครบแล้ว จะสรุปและหยุดรอคำยืนยันจากผู้ใช้ก่อนก้าวต่อไป
2. **Stage 1 — Spec (จัดทำเอกสารข้อกำหนด):**
   - รวบรวมผลการตัดสินใจมาเขียนเป็น `spec.md` ตามหัวข้อมาตรฐาน พร้อมกำหนด Test Seams (รอยต่อสำหรับทดสอบ)
3. **Stage 2 — Design Review Gate (ตรวจสอบการออกแบบ):**
   - รัน `scrutinize` ตรวจ `spec.md` และสรุปผลเป็น 1 ใน 4 ผลลัพธ์:
     - `SHIP`: ผ่านเกณฑ์ ➔ ไปยัง Stage 3
     - `FIX_THEN_SHIP`: มีจุดต้องแก้ไขเล็กน้อย ➔ ปรับแก้ใน `spec.md` แล้วตรวจซ้ำ
     - `REWORK`: ร่าง spec ไม่ชัดเจน (Spec-level) ให้แก้ spec หรือมีประเด็นที่ยังไม่ได้ตัดสินใจ (Decision-level) ให้กลับไปสัมภาษณ์ใหม่ใน Stage 0
     - `REJECT`: สถาปัตยกรรมหรือทิศทางไม่ผ่าน ➔ หยุดทำงานเพื่อให้มนุษย์ตัดสินใจ
4. **Stage 3 — Tickets (แตกชิ้นงานย่อย):**
   - เมื่อผ่านเกณฑ์ `SHIP` จะนำ `spec.md` มาแตกเป็น Tracer-bullet vertical slices เก็บไว้ใน `issues/<NN>-<slug>.md` เรียงตามลำดับ Dependency
5. **Stop — Handoff (ส่งมอบงาน):**
   - แสดงข้อความสรุปและแนะนำคำสั่งสำหรับเซสชันถัดไป เช่น:
     ```text
     /clear
     /subagent-implement .scratch/<feature-slug>/
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
- **อย่าลืมติดตั้ง Skills ที่พึ่งพาให้ครบ:** หากขาด skill ใดใน 5 ตัวข้างต้น กระบวนการ inline ใน Stage นั้นๆ อาจสะดุดหรือไม่สมบูรณ์
- **รีเซ็ต Context หลังเสร็จสิ้น:** เมื่อได้ Tickets ครบแล้ว ให้พิมพ์ `/clear` ก่อนเริ่ม implement เพื่อให้สมองของ AI ทำงานได้อย่างเต็มประสิทธิภาพที่สุด
