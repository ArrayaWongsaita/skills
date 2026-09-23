# คู่มือการติดตั้งและใช้งาน Skill: opencode-implement

- **หมวดหมู่ (Category):** `agents`
- **แหล่งติดตั้ง (Install Source):** `ArrayaWongsaita/skills`
- **ไฟล์นิยามหลัก (Definition):** [`skills/agents/opencode-implement/SKILL.md`](../../skills/agents/opencode-implement/SKILL.md)

---

## 1. opencode-implement คืออะไรและมีไว้สำหรับทำอะไร?

`opencode-implement` เป็น **Implementation Orchestrator Skill** ที่รับชุด Tickets จาก `grill-to-tickets` (ใน `.scratch/<feature-slug>/issues/`) แล้วนำมาพัฒนาเป็นโค้ดจริงโดยทำงานผ่าน **Hosted Model ตัวเดียวที่เลือกและตรึงไว้ตลอดการทำงาน (Pinned Model)** ผ่านเครื่องมือ `opencode` CLI

### จุดประสงค์หลักและคุณสมบัติเด่น
1. **ทำงานบน Hosted Model ตัวเดียวแบบคู่ขนาน (Execution Waves):**
   - วางแผนลำดับงานเป็น Waves และเปิดให้ Tickets ที่เป็นอิสระต่อกันทำงานแบบคู่ขนาน (Parallel) ใน Git Worktrees ได้สูงสุดตาม Concurrency Cap (ค่าเริ่มต้น 4 ตัวพร้อมกัน)
2. **มีระบบสลับไปใช้ Subagent อัตโนมัติ (Automatic Fallback to Native Subagent):**
   - หากโมเดลที่เลือกทำงานใดไม่สำเร็จ หรือพบข้อจำกัดทางเทคนิค ระบบจะ **สลับส่งต่อ Ticket นั้นไปให้ Native Subagent ของ Harness ช่วยทำให้โดยอัตโนมัติ** โดยไม่ต้องหยุดถามผู้ใช้ซ้ำ
3. **รวมโค้ดทันทีราย Ticket (Per-Ticket Integration):**
   - ทันทีที่ Ticket ใดผ่านการตรวจสอบ จะถูก Squash-merge 1 Commit เข้า Integration Branch ทันที ไม่ต้องรอให้เพื่อนใน Wave เดียวกันเสร็จหมด
4. **ใช้โค้ดเดิมซ้ำผ่าน Reuse Catalog:**
   - prompt ของ worker และ fallback subagent มีบรรทัด `**Reuse:**` ของ ticket แบบคำต่อคำ และถ้า project มี `docs/reuse-catalog.md` จะมีตัวชี้แบบอ่านอย่างเดียวให้ค้นก่อนสร้าง helper ที่ไม่อยู่ในแผน
   - ตอน integrate orchestrator เขียนรายการของ module ที่ ticket สร้าง / ขยาย / promote ลง catalog ใน commit ของ ticket นั้นเอง ทีละ ticket (path จาก grep, use-when จาก Reuse Plan) ถ้าไม่มี catalog ขั้นนี้ถูกข้าม
5. **รายงาน Token แยกเส้นทางชัดเจน:**
   - แสดงสรุป Token ที่ใช้บนเส้นทางหลัก (`tokens.main`) และเส้นทางสำรอง (`tokens.fallback`) อย่างโปร่งใส

---

## 2. การพึ่งพา Skill อื่น (Dependencies) และการติดตั้ง

### พึ่งพา Skill อะไรบ้าง?
- **ไม่มีการพึ่งพา Skill ภายนอก (Zero External Skill Dependencies):**
  - ตัวมันเองเป็น Standalone ไม่ต้องติดตั้ง `tdd` หรือ `implement`

### สิ่งที่ต้องมีในสภาพแวดล้อม (System Prerequisites)
1. **OpenCode CLI (`opencode`):** ต้องติดตั้งอยู่ในระบบและตั้งค่า Provider/Model เรียบร้อย
   ```bash
   opencode --version
   ```
2. **Git Worktree Support:** รองรับการสร้าง worktree แยก
3. **Harness Subagent Support:** สำหรับรองรับกรณีที่ต้อง Fallback ไปยัง Native Subagent

### คำสั่งติดตั้ง

```bash
npx skills add ArrayaWongsaita/skills --skill opencode-implement
```

---

## 3. วิธีการใช้งานและขั้นตอนการทำงาน (Usage & Workflow)

### คำสั่งเรียกใช้งาน (Invocation)
- Slash command: `/opencode-implement [dir|slug]`
- Codex command: `$opencode-implement [dir|slug]`

**ตัวเลือกเสริม (Run Options):**
- `--model <provider/model>`: ระบุโมเดลเจาะจง (ถ้าไม่ระบุ จะดึงค่าเริ่มต้นของ `opencode` มาตรึงไว้)
- `--fallback-agent <name>`: ระบุ subagent สำหรับ fallback (ค่าเริ่มต้น `general-purpose`)
- `--no-fallback` (หรือ `--opencode-only`): ปิดระบบ fallback บังคับใช้เฉพาะโมเดลของ opencode เท่านั้น

**คำสั่งย่อย (Sub-commands):**
- `/opencode-implement continue [slug]` — กู้คืนการทำงานที่ค้างอยู่
- `/opencode-implement status [slug]` — ตรวจสอบสถานะและรายงานผล (Read-only)

---

### ขั้นตอนการทำงาน 2 ลำดับขั้น

```text
Stage 0: Plan (read-only)   ตรวจ tickets -> จัดแบ่ง Waves -> คำนวณ Touch-sets
   │                        กำหนด Concurrency Cap -> เลือก test seam -> แสดง Plan
   │ (หยุดรอการอนุมัติจากผู้ใช้)
   ▼
Stage 1: Execute (ทำทีละ Wave, Parallel ใน Worktree)
   │  - ตรึงโมเดล (Pin Model) และ Dispatch `opencode run` worker
   │  - Orchestrator รัน Verification Gate (Red/Green/Suite)
   │  - หากล้มเหลว ➔ Fallback ไปยัง Native Subagent อัตโนมัติ
   │  - Squash-merge 1 commit ต่อ ticket ทันทีที่ผ่าน
   ▼
Stop: Handoff (ส่งมอบ integration branch พร้อมรายงาน token และคำสั่ง /review-to-pr)
```

---

## 4. ตัวอย่างคำสั่งและ Prompt ใช้งานจริง

### ตัวอย่างที่ 1: รันด้วยการตั้งค่าอัตโนมัติ
```text
/opencode-implement .scratch/search-filter-upgrade/
```

### ตัวอย่างที่ 2: ระบุโมเดลเฉพาะเจาะจง
```text
/opencode-implement .scratch/search-filter-upgrade/ --model anthropic/claude-3-7-sonnet
```

### ตัวอย่างที่ 3: บังคับไม่ให้ Fallback ไปโมเดลอื่น
```text
/opencode-implement .scratch/search-filter-upgrade/ --no-fallback
```

---

## 5. ข้อควรระวังและสิ่งที่ไม่ควรใช้
- **ต้องมีชุด Tickets ก่อนเสมอ:** ใช้งานร่วมกับ output จาก `grill-to-tickets`
- **ตรวจสอบการเชื่อมต่อของ `opencode`:** ตรวจสอบว่า `opencode` สามารถเรียกโมเดลที่ต้องการได้จริงก่อนเริ่มรันงาน
- **หยุดก่อน Review:** ไม่มีการเปิด PR บน GitHub ให้เอง ให้ใช้คำสั่ง `/review-to-pr` และ `/pr-to-dev` ต่อตามลำดับ
