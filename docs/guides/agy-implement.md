# คู่มือการติดตั้งและใช้งาน Skill: agy-implement

- **หมวดหมู่ (Category):** `agents`
- **แหล่งติดตั้ง (Install Source):** `ArrayaWongsaita/skills`
- **ไฟล์นิยามหลัก (Definition):** [`skills/agents/agy-implement/SKILL.md`](../../skills/agents/agy-implement/SKILL.md)

---

## 1. agy-implement คืออะไรและมีไว้สำหรับทำอะไร?

`agy-implement` เป็น **Multi-Provider Implementation Orchestrator Skill** ที่รับชุด Tickets จาก `grill-to-tickets` ในโฟลเดอร์ `.scratch/<feature-slug>/issues/` แล้วนำมาขับเคลื่อนให้กลายเป็นโค้ดจริง

### จุดประสงค์หลักและคุณสมบัติเด่น: การกระจายโควต้า (Provider Distribution)
- หากมีชุด Tickets ขนาดใหญ่ (เช่น 5-15 tickets) การส่งงานให้ LLM เจ้าเดียวทำงานทั้งหมดอาจชนขีดจำกัด Rate Limit หรือโควต้าหมดได้
- `agy-implement` ออกแบบมาเพื่อ **กระจาย Token Spend ข้ามผู้ให้บริการ LLM หลายค่าย** (ผ่าน headless `agy`)
- วางแผนการรันงานเป็น **Execution Waves** ตาม Dependency DAG โดย Tickets ใน Wave เดียวกันที่อิสระจากกันจะถูกส่งไปรันแบบคู่ขนาน (Parallel) ใน Git Worktree แยกต่างหาก
- บังคับให้ทุก Ticket พัฒนาแบบ **Test-First (TDD)** โดย Orchestrator จะเป็นผู้ตรวจสอบ Red/Green และรัน Integration Gate เอง
- รวมงานเข้า **Integration Branch** แบบ 1 Commit ต่อ 1 Ticket และหยุดก่อนขั้นตอน Code Review

---

## 2. การพึ่งพา Skill อื่น (Dependencies) และการติดตั้ง

### พึ่งพา Skill อะไรบ้าง?
- **ไม่มีการพึ่งพา Skill ภายนอก (Zero External Skill Dependencies):**
  - เป็น Standalone Skill ตาม ADR 0004 ไม่ต้องลง `tdd` หรือ `implement` เพราะกติกาและ template prompt ถูกบรรจุอยู่ในตัวมันเองแล้ว

### สิ่งที่ต้องมีในสภาพแวดล้อม (System Prerequisites)
1. **Google Antigravity CLI (`agy`):** ติดตั้งและเรียกใช้ได้ในระบบ
2. **การตั้งค่าโมเดลและ Providers ใน `agy`:** ตั้งค่าให้ `agy` สามารถสลับใช้โมเดลต่างๆ ได้
3. **Git Worktree Support:** ระบบ Git ในเครื่องต้องรองรับคำสั่ง `git worktree`

### คำสั่งติดตั้ง

```bash
npx skills add ArrayaWongsaita/skills --skill agy-implement
```

---

## 3. วิธีการใช้งานและขั้นตอนการทำงาน (Usage & Workflow)

### คำสั่งเรียกใช้งาน (Invocation)
- Slash command: `/agy-implement [dir|slug]`
- Codex command: `$agy-implement [dir|slug]`

**คำสั่งย่อย (Sub-commands):**
- `/agy-implement continue [slug]` — กู้คืนการทำงานที่สะดุดหรือหลุดไป
- `/agy-implement status [slug]` — เรียกดูตารางความคืบหน้าราย Ticket (Read-only)
- `/agy-implement list` — ดูรายการงานทั้งหมด (Read-only)

---

### ขั้นตอนการทำงาน 2 ลำดับขั้น

```text
Stage 0: Plan (read-only)   ตรวจ tickets -> สร้าง DAG -> จัดแบ่ง Execution Waves
   │                        ประเมิน touch-set -> เลือก test seam -> แสดง Plan
   │ (หยุดรอการอนุมัติจากผู้ใช้ โดยไม่แตะต้องซอร์สโค้ด)
   ▼
Stage 1: Execute (ทำทีละ wave)
   │  - Dispatch `agy` worker 1 ตัวต่อ ticket ใน Git worktree แยก
   │  - Orchestrator รัน Verification Gate (ตรวจ red, green, typecheck, test diff)
   │  - รัน Wave Integration Gate: Squash-merge 1 commit ต่อ ticket และรัน suite รวม
   ▼
Stop: Handoff (ส่งมอบ integration branch พร้อมสรุปการใช้ token แต่ละค่าย และคำสั่ง /review-to-pr)
```

1. **Stage 0 — Plan (วางแผน - อ่านอย่างเดียว):**
   - วิเคราะห์ความขึ้นต่อกันของ Tickets และแบ่งกลุ่มออกเป็น **Waves**
   - คาดคะเนไฟล์ที่แต่ละ Ticket จะแตะ (Touch-set estimation) เพื่อหลีกเลี่ยง Merge Conflict
   - แสดงตารางแผนงานพร้อม Seam และผู้ให้บริการ แล้วหยุดรอการอนุมัติ
2. **Stage 1 — Execute (ลงมือทำงานทีละ Wave):**
   - สั่งรัน `agy` worker ในโหมด Headless พร้อมส่ง Prompt แบบ Test-first
   - Orchestrator ตรวจสอบผลงานด้วยตัวเองอย่างเข้มงวด
   - นำงานที่ผ่านมารวมเข้า Integration Branch ทีละ Commit
   - **Reuse Catalog:** prompt ของ worker มีบรรทัด `**Reuse:**` ของ ticket แบบคำต่อคำ และถ้า project มี `docs/reuse-catalog.md` จะมีตัวชี้แบบอ่านอย่างเดียวให้ค้นก่อนสร้าง helper ที่ไม่อยู่ในแผน ticket ที่มี `create-shared` / `create-candidate` / `extend` / `promote` จะได้ Reuse Plan ของ spec ไปด้วย
   - ตอน integrate orchestrator เขียนรายการลง catalog ใน commit ของแต่ละ ticket ทีละตัวตามลำดับเลข ticket (path จาก grep, use-when จาก Reuse Plan) worker ที่รัน parallel ใน wave เดียวกันแค่อ่าน catalog จึงไม่ชนกัน
3. **Stop — Handoff (ส่งมอบงาน):**
   - รายงานสรุปชื่อ Branch และตารางสรุปปริมาณ Token ที่ใช้ไปในแต่ละ Provider
   - แนะนำคำสั่งสำหรับการรีวิวในเซสชันใหม่:
     ```text
     /review-to-pr
     ```

---

### Seam, Context และการบันทึก budget ของ ticket

- **Seam:** worker ใช้ `**Seam:**` ของ ticket แบบ **verbatim** เป็นขอบเขตที่เขียนเทสต์ ไม่เลือก seam เอง — orchestrator ส่ง seam ที่ Planning เลือกไว้ให้ใน prompt
- **Context:** worker สร้าง **read list** ของตัวเองจากบรรทัด `**Context:**` ของ ticket โดยแยกเป็น read / change / create; `spec §` refs กลายเป็นรายการ section ที่อ่าน และไฟล์ read-only ที่ยังไม่ถูก track ใน worktree จะถูกส่งเป็น absolute path จาก main checkout ของ project
- **Path rule:** พาธที่อยู่ใน worktree ของ worker เขียนเป็น relative; พาธที่อยู่นอก worktree (spec แม่, ADR, ไฟล์ read-only ที่ untracked) เขียนเป็น absolute
- **การบันทึก budget:** `status.md` เก็บ `budget_estimate` ของแต่ละ ticket (ข้อความ `**Budget:**` แบบ **verbatim** หรือ `none` ถ้า ticket ไม่มี) คู่กับ `usage_total` ซึ่งเป็นผลรวม token จริงของ ticket นั้น (input + output + thinking/reasoning, ไม่นับ cache read) จากทุก usage report บน path ที่ส่ง ticket สำเร็จ; ถ้า `agy` ไม่รายงาน usage จะเป็น `unknown`

---

## 4. ตัวอย่างคำสั่งและ Prompt ใช้งานจริง

### ตัวอย่างที่ 1: รันโฟลเดอร์ Tickets ล่าสุด
```text
/agy-implement
```

### ตัวอย่างที่ 2: ระบุโฟลเดอร์ของฟีเจอร์
```text
/agy-implement .scratch/payment-gateway-integration/
```

### ตัวอย่างที่ 3: ดูสถานะปัจจุบัน
```text
/agy-implement status payment-gateway-integration
```

---

## 5. ข้อควรระวังและสิ่งที่ไม่ควรใช้
- **ต้องมีชุด Tickets ก่อนเสมอ:** ต้องผ่านการวางแผนจาก `grill-to-tickets` มาก่อน
- **เหมาะสำหรับงานที่มี Tickets จำนวนมาก:** หากมีเพียง 1-2 tickets เล็กๆ การใช้ `/subagent-implement` หรือ implement ปกติอาจเร็วกว่า
- **Skill นี้หยุดก่อน Review:** จะไม่มีการรัน Code Review และไม่เปิด PR บน GitHub ให้เอง
