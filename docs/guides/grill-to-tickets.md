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
3. **มี Design Review Gate ในตัว:** ผู้ใช้กำหนดขอบเขตการรีวิวเอง (เสนอ 3 รอบ, 0 คือข้าม, หรือใช้ `--review N`); ดูกติกาเรื่องทางออกเมื่อหมดรอบหรือติดขัดได้ที่ [สัญญา Design Review Gate](../../skills/agents/grill-to-tickets/references/design-review-gate.md)
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

ตอนเริ่ม (และตอน `continue`) skill จะทำ **Preflight** หา `SKILL.md` ของ stage skill ทั้ง 3 ตัวตามลำดับ `.agents/skills/` → `.claude/skills/` → `~/.agents/skills/` → `~/.claude/skills/` จึงใช้ได้ทั้งแบบติดตั้งใน project และแบบ global (`-g`) ถ้าขาดตัวไหนจะหยุดก่อน Stage 0 และพิมพ์คำสั่งติดตั้งเฉพาะตัวที่ขาด สำหรับแต่ละตัวที่เจอ Preflight จะบันทึก path ที่เจอและค่า hash ที่ lock ของมันถืออยู่ (`skills-lock.json` ของ project หรือ `~/.agents/.skill-lock.json`) ตามที่ lock เขียนไว้ โดยไม่คำนวณหรือเทียบใหม่ ถ้าต้องเช็ก update ของ stage skill ใช้ `npx skills check`

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
├── manifest.json       # snapshot จาก checker: spec fingerprint, DAG และข้อมูล ticket ตอนวางแผน
└── issues/             # รายการ tickets ที่พร้อมพัฒนา (NN-<slug>.md)
```

### ขั้นตอนการทำงาน 4 ลำดับขั้น

```text
Stage 0: Grill        grilling + domain-modeling  → CONTEXT.md, adr/
   │ (หยุดรอการยืนยันจากผู้ใช้เมื่อคำถามหมด)
   ▼
Stage 1: Spec         spec-format.md               → spec.md (Scenario ใต้ทุก user story)
   ▼
Stage 2: Design Review Gate   scrutinize (subagent ใหม่) → design-review.md   (ผู้ใช้กำหนดจำนวนรอบ)
   │ (เมื่อผลเป็น SHIP)
   ▼
Stage 3: Tickets      ticket-format.md + checker   → issues/NN-<slug>.md + manifest.json + Ticket review
   ▼
Stop: Handoff message (/clear, DAG summary + recommended implementer แล้ว /subagent-implement)
```

1. **Stage 0 — Grill (สัมภาษณ์และสร้างโมเดลโดเมน):**
   - สำรวจบริบทเดิมใน repo (`CONTEXT.md`, `docs/adr/`)
   - สัมภาษณ์ถามตอบทีละประเด็นโดยมีตัวเลือกแนะนำ (ใช้ `grilling`)
   - ทุกรอบคำถามถูกบันทึกลง `decisions.md` ตอนถาม และบันทึกคำตอบก่อนถามรอบถัดไป เพื่อให้การตัดสินใจไม่หายเมื่อ context ถูก compact หรือ `/clear`
   - บันทึกคำศัพท์ลง `CONTEXT.md` และบันทึกการตัดสินใจยากๆ ลง `adr/` ทันที (ใช้ `domain-modeling`)
   - **Blind-spot pass:** เมื่อไม่เหลือคำถามใน frontier จะไล่เช็ค 9 หมวดที่การสัมภาษณ์อาจไม่เคยแตะ (scope, data, flow, quality attributes เช่น performance/security, integrations, edge cases, constraints, terminology, completion signals) ให้คะแนนแต่ละหมวดเป็น `clear` / `partial` / `missing` / `n/a` ช่องว่างที่จะเปลี่ยน spec ได้กลายเป็นคำถามรอบสุดท้ายไม่เกิน 5 ข้อ ที่เหลือเขียนเป็นสมมติฐานให้เห็นชัด (ดัดแปลงจาก `/clarify` ของ GitHub Spec Kit)
   - เมื่อตัดสินใจครบแล้ว จะสรุปคำศัพท์ การตัดสินใจ ตาราง blind-spot พร้อมสมมติฐาน แล้วหยุดรอคำยืนยันจากผู้ใช้ก่อนก้าวต่อไป
2. **Stage 1 — Spec (จัดทำเอกสารข้อกำหนด):**
   - รวบรวมผลการตัดสินใจจาก `decisions.md`, `CONTEXT.md` และ `adr/` มาเขียนเป็น `spec.md` ตาม `references/spec-format.md` ซึ่งเป็นรูปแบบที่ skill เป็นเจ้าของเอง พร้อมกำหนด Test Seams (รอยต่อสำหรับทดสอบ) และเขียน Scenario แบบบรรทัดเดียว `Scenario: given … when … then …` ใต้ทุก user story ใหม่ หนึ่ง story มีได้หลาย Scenario; ทุกการตัดสินใจใน log ต้องปรากฏใน spec
3. **Stage 2 — Design Review Gate (ตรวจสอบการออกแบบ):**
   - แต่ละรอบส่ง `scrutinize` ไปรันใน **subagent ตัวใหม่** ที่เห็นแค่ไฟล์ (`spec.md`, `decisions.md`, `CONTEXT.md`, `adr/` และ repo) ไม่เห็นบทสนทนา จึงอ่าน spec แบบเดียวกับที่ implementer จะอ่าน และไม่แก้ไฟล์ใด ๆ ส่วน context หลักเป็นคน normalize verdict แก้ spec และนับ cycle (เหตุผลอยู่ใน ADR 0010)
   - สรุปผลการตรวจ `spec.md` เป็น 1 ใน 4 ผลลัพธ์:
     - `SHIP`: ผ่านเกณฑ์ ➔ ไปยัง Stage 3
     - `FIX_THEN_SHIP`: มีจุดต้องแก้ไขเล็กน้อย ➔ ปรับแก้ใน `spec.md` แล้วค้นทั้ง spec หาทุกประโยคที่พูดเรื่องเดียวกัน (story, implementation decision, further notes) แก้ให้ตรงกันจนค้นคำเดิมไม่เจอ แล้วจึงตรวจซ้ำ
     - `REWORK`: ร่าง spec ไม่ชัดเจน (Spec-level) ให้แก้ spec หรือมีประเด็นที่ยังไม่ได้ตัดสินใจ (Decision-level) ให้กลับไปสัมภาษณ์ใหม่ใน Stage 0
     - `REJECT`: สถาปัตยกรรมหรือทิศทางไม่ผ่าน ➔ หยุดทำงานเพื่อให้มนุษย์ตัดสินใจ
4. **Stage 3 — Tickets (แตกชิ้นงานย่อย):**
   - หลัง `SHIP`, การข้ามด้วย `0`, หรือผู้ใช้เลือกไปต่อหลังหมดรอบ/ติด stall ให้นำ `spec.md` มาแตกเป็น Tracer-bullet vertical slices เก็บไว้ใน `issues/<NN>-<slug>.md` เรียงตามลำดับ Dependency
   - ทุก ticket มีบรรทัด `**Stories:**` ต่อจาก `**Blocked by:**` บอกเลข user story ใน spec ที่ ticket นั้นส่งมอบ เช่น `2, 5` หรือช่วง `3-6` (ticket prefactor ใช้ `none`) โดย acceptance criteria ของ ticket มาจาก Scenario ของ story ที่ ticket ส่งมอบ
   - ทุก ticket มีบรรทัด `**Seam:**` (ขอบเขตทดสอบเดียวจาก Testing Decisions ของ spec), `**Context:**` (Read set ของ worker: `spec §` refs และไฟล์ พร้อม marker อ่านอย่างเดียว / `(edit)` / `(new)` / `(from NN)` / `(edit from NN)`) และ `**Budget:**` (ผลวัดของ checker: read tokens, จำนวน criteria, จำนวน modules) เรียงต่อจาก `**Stories:**` ตามลำดับ Seam → Context → Budget
   - ก่อน quiz ให้รันสคริปต์ตรวจ ticket ที่มากับ skill พร้อม `--write-budget` เพื่อให้มันเขียน Budget line จากผลวัด:
     ```bash
     node <โฟลเดอร์ของ skill>/scripts/check-tickets.mjs .scratch/<feature-slug>/ --write-budget
     ```
     สคริปต์ตรวจว่า Scenario ที่ใช้มี `given`, `when`, `then` เรียงตามลำดับและทุก story มี Scenario; spec เก่าที่ไม่มี Scenario ผ่านพร้อม warning ส่วน Scenario ที่ขาดหรือผิดรูปแบบเป็น error ตรวจต่อว่าทุก story มี ticket, `Stories` และ `Blocked by` ชี้ของที่มีจริง (blocker ต้องเลขต่ำกว่า), และ Seam/Context/Budget ครบ เป็นบรรทัดเดียว เรียงถูก และอ้างถึงของจริง ทุกครั้งที่ `--write-budget` จบด้วย PASS จะเขียน `.scratch/<feature-slug>/manifest.json` ซึ่งเป็น snapshot ที่สร้างจาก spec fingerprint, DAG และ planning facts ของ ticket ไม่มี Status หรือ timestamp แก้จนขึ้น `result: PASS` แล้วแสดงตาราง story coverage, ตาราง budget, สรุป DAG และ warning ทุกตัวใน quiz
   - **Ticket review (Stage 3.5):** หลัง checker พิมพ์ PASS และก่อน quiz ส่ง fresh reviewer ไปอ่าน ticket set กับไฟล์ที่ระบุใน `**Context:**` ของแต่ละ ticket แล้วให้ verdict `READY` หรือ `ASK: <คำถามที่ worker ใหม่ต้องถาม>` ครบทุกใบ รีวิวนี้ตรวจเฉพาะ ambiguity ไม่ใช่ Budget check และไม่ตั้ง limit; ค่าเริ่มต้นทำหนึ่งครั้ง ส่วน `--ticket-review 0` ใช้ข้ามได้
     - แสดงคำถาม `ASK` ข้าง `Seam`, `Context` และ `Budget` ใน quiz ให้คนตัดสินใจว่าจะ fix หรือ acknowledge แล้ว main thread รัน checker ด้วย `--write-budget` ซ้ำและบันทึกผลใน `## Ticket review` ของ `decisions.md`
     - `continue` อ่าน State `ticket review: done` หรือ `skipped` เพื่อไม่เริ่มซ้ำ; review รอบสองเริ่มเมื่อผู้ใช้ขอเท่านั้น
   - warning ที่ checker ออกให้มี 3 แบบ และไม่เปลี่ยนผล `PASS` / `FAIL`: acceptance criterion ที่พูดถึงการรัน suite หรือ tool (`npm test`, `tests pass`, `typecheck passes`, `lint passes`, `suite passes`); ticket สองใบที่แก้ path เดียวกัน (`(edit)`, `(new)` หรือ `(edit from NN)`) โดยไม่มีใบไหน block อีกใบทางอ้อม (transitively); และ feature ที่มีเกิน 15 ticket
   - warning ทุกตัวที่ checker รายงานต้องถูกบันทึกใต้ `## Ticket warnings` ใน `decisions.md` บรรทัดละหนึ่งตัว เป็น `<warning> — acknowledged` หรือ `<warning> — fixed: <change>` จึงจะถือว่า Stage 3 เสร็จ
   - รัน checker ซ้ำด้วย `--write-budget` ทุกครั้งที่ quiz ทำให้ ticket เปลี่ยน
5. **Stop — Handoff (ส่งมอบงาน):**
   - พิมพ์ข้อความ handoff ตามลำดับ: `/clear` → **DAG summary** จาก checker (wave, ความกว้างสูงสุด, critical-path length) → บรรทัด `.scratch/<feature-slug>/manifest.json` (เมื่อ checker run สุดท้ายเขียน manifest สำเร็จ) → บรรทัด `recommended implementer` ที่บอกว่า `subagent-implement`, `agy-implement` หรือ `opencode-implement` เหมาะกับ ticket set นี้ (ชื่อ skill ไม่มี slash นำหน้า) → คำสั่ง `/subagent-implement`
   - `recommended implementer` เลือกจาก maximum wave width (จำนวน ticket มากสุดที่ทำพร้อมกันได้ใน wave เดียว): 1 → `subagent-implement`, 2 → ทั้งสามตัว, 3 ขึ้นไป → `agy-implement` หรือ `opencode-implement` เป็นคำแนะนำเท่านั้น คุณเป็นคนเลือกเอง
   - แสดงข้อความสรุปและแนะนำขั้นตอนสำหรับเซสชันถัดไป:
     ```text
     # 1. .scratch/ อยู่ในเครื่องและถูก git ignore จึงไม่ต้อง commit (implementer เริ่มได้เฉพาะ working tree ที่สะอาด)
     /clear
     # 2. วาง DAG summary สุดท้ายจาก checker
     wave 0: 01
     wave 1: 02, 03
     maximum wave width: 2
     critical-path length: 2
     manifest: .scratch/<feature-slug>/manifest.json
     recommended implementer: subagent-implement, agy-implement, opencode-implement
     # 3. implement ทั้งโฟลเดอร์ใน session ใหม่
     /subagent-implement .scratch/<feature-slug>/
     # หรือ /agy-implement หรือ /opencode-implement ด้วย argument เดียวกัน
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
