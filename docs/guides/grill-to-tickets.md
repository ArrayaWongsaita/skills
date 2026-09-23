# คู่มือการติดตั้งและใช้งาน Skill: grill-to-tickets

- **หมวดหมู่ (Category):** `agents`
- **แหล่งติดตั้ง (Install Source):** `ArrayaWongsaita/skills`
- **ไฟล์นิยามหลัก (Definition):** [`skills/agents/grill-to-tickets/SKILL.md`](../../skills/agents/grill-to-tickets/SKILL.md)

---

## 1. grill-to-tickets คืออะไรและมีไว้สำหรับทำอะไร?

`grill-to-tickets` เป็น **Standalone Composite Skill** ที่ออกแบบมาเพื่อรับผิดชอบช่วงการวางแผน (Planning Phase) ของการพัฒนาซอฟต์แวร์ โดยทำหน้าที่นำเสนอไอเดียเริ่มต้นเพียงหนึ่งไอเดีย (One Idea) ผ่านกระบวนการสัมภาษณ์แบบเจาะลึก, ถอดแบบโมเดลเชิงโดเมน, เขียนข้อกำหนด (Specification), ตรวจสอบความสมบูรณ์ผ่านเกณฑ์การออกแบบ (Design Review Gate) และแตกงานออกเป็น Tickets ที่พร้อมลงมือพัฒนาจริงในระดับย่อย (Tracer-bullet Vertical Tickets)

### จุดประสงค์หลักและคุณสมบัติเด่น
1. **จบกระบวนการวางแผนในคำสั่งเดียว:** ครอบคลุมตั้งแต่วิเคราะห์ความต้องการจนได้ Tickets ที่สมบูรณ์
2. **รักษา Context Window:** กระบวนการสัมภาษณ์, จัดทำ Spec และแตก Ticket จะรันอยู่บน reasoning thread เดียวกันแบบต่อเนื่อง ยกเว้นการรีวิว spec ที่แยกไปรันใน subagent ตัวใหม่เพื่อให้มองแบบคนนอก จากนั้นจะ **หยุดส่งมอบงาน (Handoff)** ทันทีที่ออก Tickets เสร็จ โดยไม่ลงมือเขียนโค้ด (Implement) เอง เพื่อให้เซสชันถัดไปที่ต้องเขียนโค้ดเริ่มต้นด้วย Context ที่สดใหม่และสะอาด
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
- ทำต่อจากรอบที่ค้างไว้ (เช่น หลัง `/clear` หรือ session หลุด): `/grill-to-tickets continue <feature-slug>` โดย skill จะอ่าน State ใน `decisions.md` แล้วทำต่อจากจุดเดิม ไม่ถามคำถามที่ตอบไปแล้วซ้ำ

### โครงสร้างไฟล์ที่สร้างขึ้น (Feature-scoped Storage)
ไฟล์ผลลัพธ์ทั้งหมดจะถูกจัดเก็บแยกไว้ใต้โฟลเดอร์ `.scratch/<feature-slug>/` โดยไม่ปะปนกับโค้ดหลัก:
```text
.scratch/<feature-slug>/
├── decisions.md        # Decision Log: ทุกคำถาม คำตอบแนะนำ คำตอบจริง และ State ของ run
├── CONTEXT.md          # พจนานุกรมคำศัพท์เชิงโดเมน (Ubiquitous Language)
├── adr/                # บันทึกการตัดสินใจทางสถาปัตยกรรม (NNNN-<slug>.md)
├── spec.md             # เอกสารข้อกำหนดของฟีเจอร์ (Specification)
├── design-review.md    # รายงานผลการตรวจสอบ Design Review Gate
└── issues/             # รายการ tickets ที่พร้อมพัฒนา (NN-<slug>.md)
```

มีไฟล์ระดับ project เพียงไฟล์เดียวที่อยู่นอก `.scratch/` และใช้ต่อข้ามฟีเจอร์ คือ **Reuse Catalog** `docs/reuse-catalog.md` (พร้อมบรรทัดชี้ไปหาใน `AGENTS.md` หรือ `CLAUDE.md`) ซึ่งเก็บรายการโค้ดที่ใช้ซ้ำได้ของ project เพื่อให้รอบถัดไปสำรวจเฉพาะส่วนที่เปลี่ยน:
```text
docs/reuse-catalog.md
├── Where shared code lives   # shared code อยู่ที่ไหน
├── Rules                     # กฎการใช้ เช่น "แสดงเงินด้วย formatCurrency"
├── Shared                    # รายการใน shared layer: `symbol` — `path` — use for: ...
├── Candidates                # โค้ดที่น่าจะ reuse ได้แต่ยังมีผู้ใช้รายเดียว
└── Coverage                  # ส่วนที่สำรวจแล้ว และวันที่สำรวจล่าสุด
```

### ขั้นตอนการทำงาน 4 ลำดับขั้น

```text
Stage 0: Grill        reuse survey + grilling + domain-modeling  → CONTEXT.md, adr/, docs/reuse-catalog.md
   │ (หยุดรอการยืนยันจากผู้ใช้เมื่อคำถามหมด)
   ▼
Stage 1: Spec         to-spec                     → spec.md
   ▼
Stage 2: Design Review Gate   scrutinize          → design-review.md   (จำกัดงบ 6 รอบ)
   │ (เมื่อผลเป็น SHIP)
   ▼
Stage 3: Tickets      to-tickets                  → issues/NN-<slug>.md
   ▼
Stop: Handoff message (commit ไฟล์วางแผน, /clear แล้ว /subagent-implement)
```

1. **Stage 0 — Grill (สัมภาษณ์และสร้างโมเดลโดเมน):**
   - สำรวจบริบทเดิมใน repo (`CONTEXT.md`, `docs/adr/`)
   - **Reuse survey:** อ่าน `docs/reuse-catalog.md` ตรวจว่าทุกรายการยังมีอยู่จริง (drift check) แล้วสำรวจเฉพาะส่วนที่ไม่อยู่ใน Coverage และไฟล์ที่เปลี่ยนหลังวันที่ใน Coverage ผลที่เจอเขียนกลับลง catalog ถ้ายังไม่มี catalog จะสร้างจาก template พร้อมเพิ่มบรรทัดชี้ใน `AGENTS.md` (หรือ `CLAUDE.md`)
   - ทางเลือกเรื่อง reuse ที่ต้องตัดสินจริง เช่น ขยายของเดิมหรือสร้างใหม่ จะถูกถามเป็นคำถามพร้อมคำตอบแนะนำ
   - สัมภาษณ์ถามตอบทีละประเด็นโดยมีตัวเลือกแนะนำ (ใช้ `grilling`)
   - ทุกรอบคำถามถูกบันทึกลง `decisions.md` ตอนถาม และบันทึกคำตอบก่อนถามรอบถัดไป เพื่อให้การตัดสินใจไม่หายเมื่อ context ถูก compact หรือ `/clear`
   - บันทึกคำศัพท์ลง `CONTEXT.md` และบันทึกการตัดสินใจยากๆ ลง `adr/` ทันที (ใช้ `domain-modeling`)
   - **Blind-spot pass:** เมื่อไม่เหลือคำถามใน frontier จะไล่เช็ค 9 หมวดที่การสัมภาษณ์อาจไม่เคยแตะ (scope, data, flow, quality attributes เช่น performance/security, integrations, edge cases, constraints, terminology, completion signals) ให้คะแนนแต่ละหมวดเป็น `clear` / `partial` / `missing` / `n/a` ช่องว่างที่จะเปลี่ยน spec ได้กลายเป็นคำถามรอบสุดท้ายไม่เกิน 5 ข้อ ที่เหลือเขียนเป็นสมมติฐานให้เห็นชัด (ดัดแปลงจาก `/clarify` ของ GitHub Spec Kit)
   - เมื่อตัดสินใจครบแล้ว จะสรุปคำศัพท์ การตัดสินใจ ตาราง blind-spot พร้อมสมมติฐาน และการเปลี่ยนแปลงของ catalog แล้วหยุดรอคำยืนยันจากผู้ใช้ก่อนก้าวต่อไป
2. **Stage 1 — Spec (จัดทำเอกสารข้อกำหนด):**
   - รวบรวมผลการตัดสินใจจาก `decisions.md`, `CONTEXT.md` และ `adr/` มาเขียนเป็น `spec.md` ตามหัวข้อมาตรฐาน พร้อมกำหนด Test Seams (รอยต่อสำหรับทดสอบ) ทุกการตัดสินใจใน log ต้องปรากฏใน spec
   - ใต้ Implementation Decisions มี **Reuse Plan** บอกว่าแต่ละ module จะ ใช้ของเดิม / ขยายของเดิม / สร้างเป็น shared (พร้อม interface และผู้ใช้ที่ระบุชื่อ) / สร้างเป็น candidate / promote candidate / แยกไว้โดยตั้งใจ
   - เกณฑ์สร้าง shared: ต้องมีผู้ใช้จริงตั้งแต่ 2 story ขึ้นไป (หรือ caller เดิม 1 + story 1 หรือคุณยืนยันว่ามีฟีเจอร์ถัดไปใช้แน่) ถ้าไม่ถึงให้เป็น candidate ที่ออกแบบให้ดึงออกมาได้ภายหลัง
3. **Stage 2 — Design Review Gate (ตรวจสอบการออกแบบ):**
   - แต่ละรอบส่ง `scrutinize` ไปรันใน **subagent ตัวใหม่** ที่เห็นแค่ไฟล์ (`spec.md`, `decisions.md`, `CONTEXT.md`, `adr/`, reuse catalog และ repo) ไม่เห็นบทสนทนา จึงอ่าน spec แบบเดียวกับที่ implementer จะอ่าน และไม่แก้ไฟล์ใด ๆ ส่วน context หลักเป็นคน normalize verdict แก้ spec และนับ cycle (เหตุผลอยู่ใน ADR 0010)
   - สรุปผลการตรวจ `spec.md` เป็น 1 ใน 4 ผลลัพธ์:
     - `SHIP`: ผ่านเกณฑ์ ➔ ไปยัง Stage 3
     - `FIX_THEN_SHIP`: มีจุดต้องแก้ไขเล็กน้อย ➔ ปรับแก้ใน `spec.md` แล้วค้นทั้ง spec หาทุกประโยคที่พูดเรื่องเดียวกัน (story, implementation decision, Reuse Plan, further notes) แก้ให้ตรงกันจนค้นคำเดิมไม่เจอ แล้วจึงตรวจซ้ำ
     - `REWORK`: ร่าง spec ไม่ชัดเจน (Spec-level) ให้แก้ spec หรือมีประเด็นที่ยังไม่ได้ตัดสินใจ (Decision-level) ให้กลับไปสัมภาษณ์ใหม่ใน Stage 0
     - `REJECT`: สถาปัตยกรรมหรือทิศทางไม่ผ่าน ➔ หยุดทำงานเพื่อให้มนุษย์ตัดสินใจ
   - ทุกรอบตรวจ **reuse lens** ด้วย: spec สร้างของที่ catalog มีอยู่แล้ว, logic ที่หลาย story ใช้แต่ไม่มีเจ้าของ, หรือ shared ที่มีผู้ใช้ไม่ถึงเกณฑ์ ➔ `FIX_THEN_SHIP` ส่วนทางเลือกขยาย-หรือ-สร้างใหม่ที่ยังไม่มีใครตัดสิน ➔ `REWORK` แบบ decision-level
4. **Stage 3 — Tickets (แตกชิ้นงานย่อย):**
   - เมื่อผ่านเกณฑ์ `SHIP` จะนำ `spec.md` มาแตกเป็น Tracer-bullet vertical slices เก็บไว้ใน `issues/<NN>-<slug>.md` เรียงตามลำดับ Dependency
   - shared module ใหม่แต่ละตัวมี **ticket เจ้าของ (owner ticket)** เพียงใบเดียว คือ vertical slice แรกที่ใช้ ticket อื่นที่ใช้ต้องรอ ticket เจ้าของ (Blocked by) จึงไม่มีทางเขียนซ้ำกันแม้รัน parallel ส่วน promote จะกลายเป็น prefactor ticket
   - ทุก ticket มีบรรทัด `**Reuse:**` ต่อจาก `**Blocked by:**` ใช้คำกริยาตายตัว `use` / `extend` / `create-shared` / `create-candidate` / `promote` (หรือ `none`) เช่น
     ```markdown
     **Reuse:** use `formatCurrency` · create-shared `buildReportRows`
     ```
   - เรื่อง reuse ห้ามเขียนเป็น acceptance checkbox เพราะ implementer ต้องมี test ใหม่รองรับทุก criterion ข้อ "ใช้ X" เขียน test ไม่ได้ ticket จะ verify ไม่ผ่านจนติด `BLOCKED`
5. **Stop — Handoff (ส่งมอบงาน):**
   - แสดงข้อความสรุปและแนะนำขั้นตอนสำหรับเซสชันถัดไป:
     ```text
     # 1. commit .scratch/<feature-slug>/ และ docs/reuse-catalog.md (implementer เริ่มได้เฉพาะ working tree ที่สะอาด)
     /clear
     /subagent-implement .scratch/<feature-slug>/
     # หรือ /agy-implement หรือ /opencode-implement ด้วย argument เดียวกัน
     ```
   - implementer ทั้งสามตัวส่งบรรทัด Reuse ให้ worker และอัปเดต `docs/reuse-catalog.md` เมื่อแต่ละ ticket เข้า branch

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
