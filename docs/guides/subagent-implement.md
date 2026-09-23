# คู่มือการติดตั้งและใช้งาน Skill: subagent-implement

- **หมวดหมู่ (Category):** `agents`
- **แหล่งติดตั้ง (Install Source):** `ArrayaWongsaita/skills`
- **ไฟล์นิยามหลัก (Definition):** [`skills/agents/subagent-implement/SKILL.md`](../../skills/agents/subagent-implement/SKILL.md)

---

## 1. subagent-implement คืออะไรและมีไว้สำหรับทำอะไร?

`subagent-implement` เป็น **Implementation Orchestrator Skill** ที่รับชุด Tickets ที่ผ่านการวางแผนและตรวจสอบมาแล้วจาก `grill-to-tickets` (หรือ `to-tickets`) ในโฟลเดอร์ `.scratch/<feature-slug>/issues/` แล้วนำมาขับเคลื่อนให้กลายเป็นโค้ดจริงที่ทำงานได้

### จุดประสงค์หลักและคุณสมบัติเด่น
1. **รักษา Context ของ Main Agent ให้สะอาดและบาง (Preserve Main Agent Context):**
   - การลงมืออ่านไฟล์โค้ดทั้งโปรเจกต์, การแก้ไขไฟล์, และการรัน Test Suite มักจะกินโทเค็นและทำให้บริบทของ Main Agent บวมและเบลอได้ง่าย
   - `subagent-implement` แก้ปัญหานี้โดยให้ Main Agent (Orchestrator) ทำหน้าที่แค่วางแผน DAG, สั่งงาน (Dispatch), อ่านรายงานสรุป และรวมโค้ด (Squash-merge) เท่านั้น
   - งานเขียนโค้ดและรันเทสต์ทั้งหมดจะถูกผลักไปทำใน **Worker Subagent** แยกบริบทต่างหาก
2. **สร้างงานแบบ Test-First (TDD Enforced):**
   - ทุก Ticket จะถูก Worker พัฒนาด้วยเทคนิค TDD (Red ➔ Green ➔ Refactor)
3. **มี Verifier Subagent สดใหม่คอยตรวจความจริง:**
   - มี **Verifier Subagent** แยกต่างหากคอยทำซ้ำสภาวะ Red State (ยืนยันว่าเทสต์เขียนมาแล้วต้องล้มจริงเพราะยังไม่มีฟังก์ชันนั้น ไม่ใช่ล้มเพราะ syntax หรือ import error) และตรวจผล Green พร้อม Full Test Suite
4. **รวมงานแบบ 1 Commit ต่อ 1 Ticket:**
   - รวมโค้ดเข้า **Integration Branch** ทีละ Ticket ตามลำดับความขึ้นต่อกัน (Dependency Order)
5. **หยุดก่อนเข้าสู่กระบวนการ Review:**
   - เมื่อพัฒนาครบทุก Ticket จะส่งมอบ Integration Branch พร้อมแนะนำคำสั่ง `/review-to-pr` โดยไม่รีวิวและไม่เปิด PR เอง

---

## 2. การพึ่งพา Skill อื่น (Dependencies) และการติดตั้ง

### พึ่งพา Skill อะไรบ้าง?
- **ไม่มีการพึ่งพา Skill ภายนอก (Zero External Skill Dependencies):**
  - ออกแบบเป็น Standalone ตาม ADR 0005 ไม่พึ่งพา skill `tdd`, `implement`, หรือ `agy-implement`
  - กฎการทำ TDD (Red-Green-Refactor) และข้อจำกัดต่าง ๆ ถูกบรรจุอยู่ใน Prompt Scaffold (`prompt-scaffold.md`) เรียบร้อยแล้ว

### สิ่งที่ต้องมีในสภาพแวดล้อม (Harness & System Prerequisites)
1. **สภาพแวดล้อม AI Agent ที่รองรับ Subagents:** เช่น Claude Code, Antigravity, OpenCode หรือ Codex
2. **รองรับ Git Worktree (`isolation: "worktree"`):** เพื่อให้ Worker แต่ละตัวมีพื้นที่ทำงานแยกต่างหาก ไม่ชนกับ Working Directory หลัก
3. **Git CLI:** ติดตั้งอยู่ในเครื่องพร้อมใช้งาน

### คำสั่งติดตั้ง

รันคำสั่งติดตั้งตัว skill เดียวได้ทันที:

```bash
npx skills add ArrayaWongsaita/skills --skill subagent-implement
```

---

## 3. วิธีการใช้งานและขั้นตอนการทำงาน (Usage & Workflow)

### คำสั่งเรียกใช้งาน (Invocation)
- Slash command: `/subagent-implement [dir|slug]`
- Codex command: `$subagent-implement [dir|slug]`

**รูปแบบพารามิเตอร์:**
- `/subagent-implement` — ไม่ระบุพาธ ระบบจะค้นหาโฟลเดอร์ `.scratch/*/issues/` ที่แก้ไขล่าสุดให้อัตโนมัติและถามยืนยัน
- `/subagent-implement .scratch/my-feature/` — ระบุพาธโฟลเดอร์ของฟีเจอร์โดยตรง
- `/subagent-implement my-feature` — ระบุเฉพาะชื่อ slug ของฟีเจอร์

**ตัวเลือกเสริม (Run Options):**
- `--agent <name>`: ล็อกประเภทของ Worker subagent ตลอดทั้งการทำงาน
- `--model <id>`: ส่งต่อ model ID ให้ Worker subagent (ปกติจะ inherit จากตัวหลัก)

**คำสั่งย่อย (Sub-commands):**
- `/subagent-implement continue [slug]` — กู้คืนการทำงานที่ค้างอยู่ (Reality reconciliation)
- `/subagent-implement status [slug]` — ดูสถานะ ticket ตารางงาน และ blockers (Read-only)
- `/subagent-implement list` — ดูรายการงานทั้งหมดที่เคยรัน (Read-only)

---

### โครงสร้างไฟล์ที่สร้างขึ้น (Run Artifacts)
ไฟล์สถานะและรายงานทั้งหมดจะถูกจัดเก็บไว้ใต้ `.scratch/<feature-slug>/`:
```text
.scratch/<feature-slug>/
├── issues/            # ข้อมูลนำเข้า: ไฟล์ tickets (NN-<slug>.md)
├── spec.md            # ข้อมูลนำเข้า: ข้อกำหนดของฟีเจอร์
├── status.md          # บันทึกสถานะการรัน: ตาราง ticket, สถานะรายข้อ, branch
├── prompts/<NN>.md    # Prompt ที่สร้างขึ้นให้ Worker ของแต่ละ ticket
└── reports/<NN>.md    # รายงานผลลัพธ์จาก Worker และ Verifier ของแต่ละ ticket
```

---

### ขั้นตอนการทำงาน 2 ลำดับขั้น

```text
Stage 0: Plan (read-only)   ตรวจ ticket -> สร้าง DAG -> จัดลำดับ dependency
   │                        กำหนด test seam และเลือก subagent ต่อ ticket -> แสดง Plan
   │ (หยุดรอการยืนยันจากผู้ใช้ โดยยังไม่แก้ไขซอร์สโค้ดใดๆ)
   ▼
Stage 1: Execute (ทำทีละ ticket ตามลำดับ frontier)
   │  - Dispatch Worker subagent (ทำใน worktree แยก, prompt แบบ test-first)
   │  - Dispatch Verifier subagent สดใหม่ (ตรวจ red, green, typecheck, full suite)
   │  - Orchestrator ตัดสินผลจากรายงาน -> Squash-merge 1 commit เข้า integration branch
   ▼
Stop: Handoff (ส่งมอบ integration branch พร้อมคำสั่ง /review-to-pr หรือ /code-review)
```

1. **Stage 0 — Plan (วางแผน - อ่านอย่างเดียว):**
   - อ่าน Tickets ทั้งหมด และสร้างกราฟความขึ้นต่อกัน (Dependency DAG)
   - ตรวจสอบว่าไม่มี Cycle (A รอ B และ B รอ A) และหมายเลข Ticket เรียงลำดับถูกต้อง
   - เลือก **Test Seam** (รอยต่อของระบบที่จะเขียนเทสต์ดัก) ให้กับแต่ละ Ticket ตามที่ระบุใน `spec.md`
   - แสดงตาราง **Plan** ให้ผู้ใช้เห็น และ **หยุดรอการอนุมัติ** โดยยังไม่แตะต้องซอร์สโค้ด
2. **Stage 1 — Execute (ลงมือทีละ Ticket):**
   - **Worker Subagent:** สร้าง branch `subagent-implement/<slug>/<NN>` ใน Git Worktree แยก, เขียนเทสต์ให้ล้ม (Red), เขียนโค้ดให้ผ่าน (Green), ปรับแต่ง (Refactor), แล้ว commit ลง worker branch
   - **Verifier Subagent (Explore agent):** สวมบทบาทผู้ตรวจสอบอิสระ ดึงเฉพาะไฟล์เทสต์ไปรันเพื่อยืนยันว่า Red จริง จากนั้นตรวจผล Green, Typecheck และ Full Suite ทั้งหมด คืนหลักฐานเชิงประจักษ์โดยไม่ตัดสินความ
   - **Orchestrator Judgment & Integration:** Main Agent ประเมินรายงาน (เทสต์กลวงหรือไม่? ครอบคลุม acceptance criteria ไหม?) หากผ่านจะทำ squash-merge 1 commit เข้าสู่ integration branch
   - หากเทสต์ไม่ผ่าน มีสิทธิ์ลองแก้ซ้ำได้สูงสุด 3 ครั้ง (`MAX_TICKET_ATTEMPTS = 3`)
   - **Reuse Catalog:** prompt ของ worker มีบรรทัด `**Reuse:**` ของ ticket แบบคำต่อคำ และถ้า project มี `docs/reuse-catalog.md` จะมีตัวชี้แบบอ่านอย่างเดียว ให้ worker ค้นก่อนสร้าง helper, component, hook หรือ test factory ที่ไม่อยู่ในแผน ถ้าบรรทัด Reuse มี `create-shared` / `create-candidate` / `extend` / `promote` worker จะได้ส่วน Reuse Plan ของ spec ไปด้วย เพื่อสร้าง interface ตามที่ตกลงไว้สำหรับผู้ใช้ทุกราย
   - ตอน squash-merge orchestrator เขียนรายการลง catalog ใน commit ของ ticket นั้นเลย (grep หา path ในไฟล์ที่ worker แก้, ใช้ use-when จาก Reuse Plan, ไม่อ่านโค้ด) ถ้าหา symbol ไม่เจอจะไม่เขียน และบันทึกไว้ใน `status.md` ถ้า project ไม่มี catalog ขั้นนี้ถูกข้ามทั้งหมด
3. **Stop — Handoff (ส่งมอบงาน):**
   - แสดงข้อความสรุปชื่อ Integration Branch พร้อมคำสั่งสำหรับขั้นตอน Review ต่อไปในเซสชันใหม่:
     ```text
     /review-to-pr
     ```

---

## 4. ตัวอย่างคำสั่งและ Prompt ใช้งานจริง

### ตัวอย่างที่ 1: รันโฟลเดอร์ล่าสุดอัตโนมัติ
```text
/subagent-implement
```

### ตัวอย่างที่ 2: ระบุโฟลเดอร์ฟีเจอร์อย่างเจาะจง
```text
/subagent-implement .scratch/subtitle-preferences/
```

### ตัวอย่างที่ 3: ตรวจสอบสถานะงานปัจจุบัน
```text
/subagent-implement status subtitle-preferences
```

---

## 5. ข้อควรระวังและคำแนะนำในการใช้งาน
- **ต้องมี Tickets ก่อนเสมอ:** อย่าเรียก skill นี้หากยังไม่มี tickets ใน `.scratch/<slug>/issues/` ให้ใช้ `/grill-to-tickets` ก่อน
- **ไม่เปิด PR อัตโนมัติ:** Skill นี้จะหยุดอยู่ที่การสร้าง Integration Branch ที่คอมมิตครบและผ่านเทสต์เท่านั้น ไม่มีการทำ `git push` หรือสร้าง PR
- **กรณีพบข้อติดขัด (BLOCKED):** หากมี Ticket ใดไม่สามารถผ่านเกณฑ์ได้ครบ 3 ครั้ง ระบบจะหยุดเฉพาะสายงานนั้นและบันทึกเหตุผลใน `status.md` เพื่อให้คุณตรวจสอบ worktree ได้โดยตรง
