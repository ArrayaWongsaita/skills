# คู่มือการติดตั้งและใช้งาน Skill: review-to-pr

- **หมวดหมู่ (Category):** `agents`
- **แหล่งติดตั้ง (Install Source):** `ArrayaWongsaita/skills`
- **ไฟล์นิยามหลัก (Definition):** [`skills/agents/review-to-pr/SKILL.md`](../../skills/agents/review-to-pr/SKILL.md)

---

## 1. review-to-pr คืออะไรและมีไว้สำหรับทำอะไร?

`review-to-pr` เป็น **Review & Fix Orchestrator Skill** ที่รับช่วงต่อจาก Integration Branch ที่ได้จากการลงโค้ด (เช่น จาก `subagent-implement`, `agy-implement`, หรือ `implement`) ซึ่งมี commit ราย ticket ครบแล้วและเทสต์เบื้องต้นผ่านแล้ว แต่ **ยังไม่เคยผ่านการรีวิวโค้ดอย่างจริงจัง**

Skill นี้จะนำ Branch ดังกล่าวมาผ่านกระบวนการตรวจสอบคุณภาพโค้ด, แก้ไขข้อบกพร่อง, ตรวจสอบความเสี่ยงของระบบ และรันชุดทดสอบเต็ม จนได้สถานะที่ "พร้อมเปิด Pull Request (PR-ready)" อย่างแท้จริง

### จุดประสงค์หลักและคุณสมบัติเด่น
1. **รีวิวแบบ 2 แกนคู่ขนาน (Two-axis Code Review):**
   - **Standards axis:** ตรวจสอบตามมาตรฐานโค้ดของ Repository และ Code Smells พื้นฐาน รวมถึง `docs/reuse-catalog.md` ถ้ามี (จับโค้ดที่ซ้ำกับ module ที่มีอยู่แล้วนอก diff ซึ่ง smell "Duplicated Code" ปกติมองไม่เห็น)
   - **Spec axis:** ตรวจสอบความตรงตามข้อกำหนด (Acceptance Criteria จาก `spec.md`) และป้องกันการเขียนโค้ดเกินขอบเขต (Scope Creep)
2. **จัดกลุ่ม Blockers และแก้เป็น Commit ที่ชัดเจน:**
   - นำประเด็นที่เป็นข้อบกพร่องสำคัญ (Blockers) มาจัดกลุ่ม (Clustering)
   - สั่งแก้ไขและสร้าง commit ใหม่เป็น `fix(review): <summary>` ต่อท้ายบน integration branch โดยไม่เอาไปรวมกลืน (squash) กับ commit เดิมของ ticket เพื่อให้เห็นประวัติการแก้ที่ชัดเจน
3. **มี System Scrutinize Gate เมื่อเข้าเกณฑ์เสี่ยง:**
   - หาก Diff ของโค้ดแตะส่วนสำคัญของระบบ (Routing, Auth, Database Schema, Migrations, Shared Config, หรือกระทบหลายโมดูล) จะเรียก `scrutinize` เข้ามาตรวจเชิงสถาปัตยกรรมทั้งระบบ
4. **จำกัดงบประมาณการรีวิวเพื่อไม่ให้วนลูปไม่รู้จบ (Bounded Loops):**
   - Code Review จำกัดไม่เกิน **3 รอบ**
   - Scrutinize Gate จำกัดไม่เกิน **6 รอบ**
   - มีระบบตรวจจับการไม่คืบหน้า (No-progress / Stall detection) เพื่อหยุดแจ้งมนุษย์ทันทีหากแก้ไม่ตรงจุด
5. **หยุดก่อนเปิด PR (Safe Terminal Stance):**
   - ทำงานเสร็จแล้วจะส่งมอบรายงานพร้อมแนะนำคำสั่ง `/pr-to-dev` โดยไม่ทำการ `git push` หรือสร้าง PR ขึ้น GitHub เองโดยพลการ

---

## 2. การพึ่งพา Skill อื่น (Dependencies) และการติดตั้ง

`review-to-pr` ทำงานโดยการประสานงานและเรียกใช้ Sub-skills ในขั้นตอนการรีวิว ดังนี้:

| ชื่อ Skill ที่พึ่งพา | เจ้าของ / Repository | หน้าที่ใน Workflow |
| :--- | :--- | :--- |
| **`code-review`** | `mattpocock/skills` | รันการรีวิวโค้ด 2 แกน (Standards และ Spec) ผ่าน parallel sub-agents (Stage 1) |
| **`scrutinize`** | `thananon/9arm-skills` | รันการตรวจเชิงสถาปัตยกรรมระดับระบบ (System Gate) ใน Stage 3 เมื่อโค้ดมีความเสี่ยงสูง |

### สิ่งที่ต้องมีในสภาพแวดล้อม (Harness Prerequisites)
- สภาพแวดล้อม AI ที่รองรับ **Subagents** สำหรับรันรีวิวคู่ขนาน (Parallel sub-agents) และส่งต่อ Worker Subagent สำหรับกรณีแก้ Blocker ที่ซับซ้อน

### คำสั่งติดตั้งทั้งหมด

รันคำสั่งต่อไปนี้ผ่าน Terminal:

```bash
# 1. ติดตั้งตัว skill หลัก (review-to-pr)
npx skills add ArrayaWongsaita/skills --skill review-to-pr

# 2. ติดตั้ง skills ที่พึ่งพา (Dependencies)
npx skills add mattpocock/skills --skill code-review
npx skills add thananon/9arm-skills --skill scrutinize
```

---

## 3. วิธีการใช้งานและขั้นตอนการทำงาน (Usage & Workflow)

### คำสั่งเรียกใช้งาน (Invocation)
รันคำสั่งขณะที่ Git อยู่บน **Integration Branch**:
- Slash command: `/review-to-pr [<ref>|<slug>]`
- Codex command: `$review-to-pr [<ref>|<slug>]`

**รูปแบบการระบุ Argument:**
- `/review-to-pr` — ตรวจสอบ branch ปัจจุบัน เทียบกับ `git merge-base main HEAD`
- `/review-to-pr <ref>` — กำหนดจุดเริ่มต้นรีวิวเจาะจง (Commit SHA, Branch, หรือ Tag)
- `/review-to-pr <slug>` — ระบุชื่อ feature directory ใน `.scratch/<slug>/`

**คำสั่งย่อย (Sub-commands):**
- `/review-to-pr continue [slug]` — กู้คืนการรีวิวที่ค้างอยู่ (ตรวจสอบ branch, commit เดิม และเปิด finding ที่ยังไม่คลี่คลายขึ้นมาใหม่)
- `/review-to-pr status [slug]` — เรียกดูประวัติ cycle และรายการ findings (Read-only)

---

### โครงสร้างไฟล์ที่สร้างขึ้น (Run Artifacts)
ข้อมูลการตรวจสอบและบันทึกข้อบกพร่องจะถูกเก็บไว้ที่ `.scratch/<feature-slug>/review-status.md`:
```text
.scratch/<feature-slug>/
├── spec.md            # ข้อมูลนำเข้า: สำหรับตรวจแกน Spec
├── issues/            # ข้อมูลนำเข้า: รายการ ticket
├── review-status.md   # บันทึกสถานะ: review point, ประวัติรอบ, บัญชี findings, รายการ fix commits
└── prompts/fix-<n>.md # Prompt ที่สร้างให้ Worker สำหรับแก้ปัญหาแต่ละกลุ่ม
```

---

### ขั้นตอนการทำงาน 6 ลำดับขั้น

```text
Stage 0: Pin the review point (read-only)   ตรวจความพร้อม -> ปัก review point -> บันทึก review-status.md
   │ (หยุดรอการยืนยันจากผู้ใช้)
   ▼
Stage 1: Two-axis code-review    code-review inline -> จำแนก blockers -> กำหนดเส้นทาง
   │  (มี blockers ➔ Stage 2)    (ผ่านฉลุย / ไม่มี blocker ➔ Stage 3)
   ▼
Stage 2: Fix the blockers        จัดกลุ่ม -> สั่งแก้ (inline หรือ worker) -> commit fix(review):
   │  (เสร็จแล้ววนกลับไป Stage 1 เพื่อรีวิวซ้ำ สูงสุด 3 รอบ)
   ▼
Stage 3: System scrutinize       ประเมินเกณฑ์ความเสี่ยง (ADR 0003) -> ถ้าเข้าเกณฑ์ให้รัน scrutinize
   ▼
Stage 4: Full suite green        รัน Typecheck เต็ม และ Test Suite ทั้งหมดให้เขียว
   │  (ถ้าพังจะถือเป็น blocker ใหม่และกลับไป Stage 2)
   ▼
Stage 5: Handoff                 สรุปรายงาน, แสดง commit และส่งมอบคำสั่ง /pr-to-dev
```

1. **Stage 0 — Pin Review Point (ปักหมุดจุดรีวิว):**
   - ตรวจสอบว่า Working Tree สะอาด และระบุจุดอ้างอิงเทียบกับ `main` บันทึกลง `review-status.md` แล้วหยุดรอคำยืนยัน
2. **Stage 1 — Two-axis Code-review (รีวิว 2 แกน):**
   - สั่งรัน `code-review` แสดงผลแกน Standards และ Spec เคียงข้างกัน
   - คัดกรองข้อบกพร่อง: ถ้าขัดมาตรฐานที่มีผลเสียชัดเจน หรือโค้ดไม่ตรง Spec จะจัดเป็น **Blocker** นำไปแก้ใน Stage 2
   - โค้ดที่ซ้ำกับ module ใน Reuse Catalog (เช่น ตัว format เงินตัวที่สองข้าง `formatCurrency`) หรือไม่ทำตาม Rule ของ catalog เป็น Blocker เมื่อมีผลเสียจริง เช่น สอง implementation ที่อาจทำงานไม่ตรงกันในอนาคต
3. **Stage 2 — Fix the Blockers (แก้ไขข้อบกพร่อง):**
   - รวมกลุ่ม Blocker ที่เกี่ยวข้องกัน
   - ถ้าแก้หลายไฟล์หรือต้องแก้เทสต์ จะส่งให้ Worker Subagent ใน Worktree จัดการ; ถ้าแก้จุดเดียวง่ายๆ จะแก้แบบ Inline
   - คอมมิตผลลัพธ์เป็น `fix(review): <summary>` แล้ววนกลับไป Stage 1
4. **Stage 3 — System Scrutinize (ตรวจสถาปัตยกรรมเชิงลึก):**
   - ประเมิน Checklist ความเสี่ยง: แตะ routing, auth, schema, migrations หรือกระจายหลายโมดูลหรือไม่
   - หากเข้าข่าย จะรัน `scrutinize` เพื่อเจาะลึก Trace เส้นทางโค้ดจริง
5. **Stage 4 — Full Suite Green (ตรวจสอบภาพรวม):**
   - รัน Typecheck ทั้งระบบและ Unit/Integration Test ทั้งหมด ยืนยันว่าไม่มีส่วนใดพัง
6. **Stage 5 — Handoff (ส่งมอบ):**
   - พิมพ์ข้อความสรุปผลการรีวิวและแนะนำให้เปิด PR ด้วย:
     ```text
     /pr-to-dev
     ```

---

## 4. ตัวอย่างคำสั่งและ Prompt ใช้งานจริง

### ตัวอย่างที่ 1: รันรีวิว Branch ปัจจุบัน
```text
/review-to-pr
```

### ตัวอย่างที่ 2: รันรีวิวโดยระบุ Review Point เจาะจง
```text
/review-to-pr origin/dev
```

### ตัวอย่างที่ 3: กู้คืนการรีวิวที่ค้างไว้
```text
/review-to-pr continue subtitle-preferences
```

---

## 5. ข้อควรระวังและคำแนะนำในการใช้งาน
- **ต้องรันบน Integration Branch เท่านั้น:** ไม่ควรรันบน branch `main` หรือ `dev`
- **ไม่เปิด PR ให้เอง:** วัตถุประสงค์ของ skill นี้คือเตรียม Branch ให้พร้อมรีวิวเท่านั้น การเปิด PR ให้ส่งต่อไปที่ `/pr-to-dev`
- **อย่าข้ามการติดตั้ง dependencies:** ต้องมี `code-review` และ `scrutinize` ในระบบเพื่อให้ขั้นตอนการตรวจสอบทำงานได้จริง
