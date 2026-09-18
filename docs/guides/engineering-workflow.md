# คู่มือการติดตั้งและใช้งาน Skill: engineering-workflow

- **หมวดหมู่ (Category):** `agents`
- **แหล่งติดตั้ง (Install Source):** `ArrayaWongsaita/skills`
- **ไฟล์นิยามหลัก (Definition):** [`skills/agents/engineering-workflow/SKILL.md`](../../skills/agents/engineering-workflow/SKILL.md)

---

## 1. engineering-workflow คืออะไรและมีไว้สำหรับทำอะไร?

`engineering-workflow` เป็น **Grand Cognitive Orchestration Control Plane** ที่ออกแบบมาเพื่อควบคุมและกำกับทิศทางการทำงานของ AI Agent สำหรับงานวิศวกรรมซอฟต์แวร์เต็มรูปแบบ ไม่ว่าจะเป็นการสร้าง **Feature ใหม่**, การสืบสวนและแก้ **Bug / Incident**, หรือการขับเคลื่อน **โปรเจกต์ขนาดใหญ่ (Large Project)**

### จุดประสงค์หลักและคุณสมบัติเด่น
1. **Pure-Prompt & Zero-Script:**
   - ทำงานผ่านการควบคุมพฤติกรรมของ AI (Pure Prompt Reasoning) และบันทึก State ผ่านไฟล์ Markdown ไม่ต้องพึ่งพา External Runtime สคริปต์
2. **Mandatory State Anchor Header:**
   - บังคับให้ Agent แสดง Header สถานะ เช่น `### 📋 Workflow: [FEATURE: SPECIFICATION]` ในทุกข้อความตอบกลับ เพื่อตรึงบริบทและความสนใจ (Attention) ไม่ให้ AI ตอบออกนอกกรอบ
3. **Adaptive Quality Gates & Bounded Loops:**
   - บังคับใช้โหมดอ่านอย่างเดียว (Read-Only) ในช่วงเริ่มต้น และหยุดขออนุมัติจากผู้ใช้ก่อนแตะต้องโค้ด
   - จำกัดงบประมาณการรีวิว: Code Review สูงสุดไม่เกิน **3 รอบ**, Design/System Review สูงสุดไม่เกิน **6 รอบ**
4. **Resumable Transitions:**
   - บันทึกสถานะงานลงใน `.scratch/<feature-slug>/status.md` สามารถปิดเซสชันแล้วกลับมาพิมพ์ `/engineering-workflow continue` เพื่อทำต่อได้จากจุดเดิม

---

## 2. การพึ่งพา Skill อื่น (Dependencies) และการติดตั้ง

`engineering-workflow` ทำหน้าที่เป็นผู้กำกับ (Orchestrator) และมอบหมายงานในแต่ละขั้นตอนให้แก่ **Specialist Skills** ภายนอก:

### Skills ที่จำเป็นสำหรับเส้นทางพัฒนา Feature (Core Feature Flow)

| Skill ที่พึ่งพา | ผู้พัฒนา / Repository | หน้าที่ใน Workflow |
| :--- | :--- | :--- |
| **`grill-with-docs`** | `mattpocock/skills` | สัมภาษณ์ขุดคุ้ยความต้องการและสร้างโมเดลโดเมน |
| **`to-spec`** | `mattpocock/skills` | จัดทำเอกสารข้อกำหนด `spec.md` |
| **`scrutinize`** | `thananon/9arm-skills` | รัน Design Review Gate และ System Review Gate |
| **`to-tickets`** | `mattpocock/skills` | แตกงานเป็น Vertical Tracer-bullet Tickets |
| **`implement`** | `mattpocock/skills` | ลงมือพัฒนาโค้ดแบบ Test-First |
| **`code-review`** | `mattpocock/skills` | รีวิวโค้ด 2 แกนคู่ขนาน (Standards & Spec) |

### Skills เสริมสำหรับงานเฉพาะทาง (Optional / Bug / Incident Flow)
- `diagnosing-bugs` (`mattpocock/skills`) — สืบสวนหาสาเหตุของบั๊ก
- `post-mortem` (`thananon/9arm-skills`) — บันทึกสรุปบทเรียนและวิเคราะห์ RCA
- `prototype` (`mattpocock/skills`) — สร้าง prototype ชั่วคราวเพื่อทดสอบสมมุติฐาน
- `wayfinder` (`mattpocock/skills`) — นำทางสำหรับโปรเจกต์ขนาดใหญ่

---

### คำสั่งติดตั้งทั้งหมด

```bash
# 1. ติดตั้งตัวควบคุมหลัก (engineering-workflow)
npx skills add ArrayaWongsaita/skills --skill engineering-workflow

# 2. ติดตั้ง Specialist Skills หลักสำหรับ Feature Flow
npx skills add mattpocock/skills --skill grill-with-docs
npx skills add mattpocock/skills --skill to-spec
npx skills add mattpocock/skills --skill to-tickets
npx skills add mattpocock/skills --skill implement
npx skills add mattpocock/skills --skill code-review
npx skills add thananon/9arm-skills --skill scrutinize

# 3. (ทางเลือก) ติดตั้ง Skills สำหรับงานบั๊กและสำรวจระบบ
npx skills add mattpocock/skills --skill diagnosing-bugs
npx skills add thananon/9arm-skills --skill post-mortem
npx skills add mattpocock/skills --skill prototype
```

---

## 3. วิธีการใช้งานและขั้นตอนการทำงาน (Usage & Workflow)

### คำสั่งเรียกใช้งาน (Invocation)
- Slash command: `/engineering-workflow <โจทย์งาน>`
- Codex command: `$engineering-workflow <โจทย์งาน>`
- สั่งด้วยภาษาธรรมชาติ: `"run engineering workflow for <request>"`

**คำสั่งย่อย (Sub-commands):**
- `/engineering-workflow continue [slug]` — กู้คืนและทำงานต่อ
- `/engineering-workflow status [slug]` — ตรวจสอบสถานะปัจจุบัน
- `/engineering-workflow list` — ดูรายการงานทั้งหมด

---

### ขั้นตอนการทำงานแบบ Feature Flow

```text
DISCOVERY          grill-with-docs ➔ CONTEXT.md, adr/
   ↓
SPECIFICATION      to-spec ➔ spec.md
   ↓
DESIGN_REVIEW      scrutinize ➔ design-review.md (งบ 6 รอบ)
   ↓
PLANNING           to-tickets ➔ issues/NN-<slug>.md
   ↓ (หยุดขออนุมัติจากผู้ใช้ก่อนเริ่มเขียนโค้ด)
IMPLEMENTATION     implement (ทีละ ticket, TDD, squash-merge)
   ↓
CODE_REVIEW        code-review ➔ fix loops (งบ 3 รอบ)
   ↓
SYSTEM_REVIEW      scrutinize (ถ้าแตะส่วนเสี่ยง) ➔ full suite green
   ↓
COMPLETE / HANDOFF สรุปผลงานและส่งมอบ
```

---

### การตั้งค่าคำสั่งกำกับ Agent ในโปรเจกต์ (Harness Directives)

นำข้อความนี้ไปวางใน `AGENTS.md` หรือ `CLAUDE.md` เพื่อให้ Agent ทราบว่าต้องใช้ `engineering-workflow` สำหรับงานสำคัญ:

```markdown
## Engineering Workflow Directive
เมื่อได้รับคำขอพัฒนาฟีเจอร์, แก้ไขบั๊กสำคัญ หรือโปรเจกต์ขนาดใหญ่:
1. เรียกใช้ `.agents/skills/engineering-workflow/SKILL.md`
2. แสดง State Anchor Header `### 📋 Workflow: [<STAGE>]` ทุกเทิร์น
3. บันทึกและอัปเดตสถานะใน `.scratch/<slug>/status.md`
4. หยุดรอการอนุมัติก่อนแก้ไขโค้ดจริงเสมอ
```

---

## 4. ตัวอย่างคำสั่งและ Prompt ใช้งานจริง

### ตัวอย่างที่ 1: พัฒนาฟีเจอร์ใหม่แบบครบวงจร
```text
/engineering-workflow เพิ่มระบบ Rate Limiting ให้กับ Authentication Endpoint โดยป้องกัน Brute Force ด้วย Sliding Window Counter บน Redis
```

### ตัวอย่างที่ 2: สืบสวนและแก้ Incident บั๊กซับซ้อน
```text
/engineering-workflow สืบสวนสาเหตุที่ Order บางรายการถูกตัดเงินซ้ำซ้อนในระบบชำระเงินเมื่อผู้ใช้กดยืนยันพร้อมกันหลายครั้ง
```

---

## 5. ข้อควรระวังและสิ่งที่ไม่ควรใช้
- **ไม่ใช้กับงานคำถามหรืออ่านไฟล์เดี่ยวๆ:** หากเป็นงานเล็กๆ หรือการตอบคำถามสั้นๆ ให้คุยปกติหรือเรียก specialist skill ตรงๆ
- **ต้องติดตั้ง Specialist Skills ให้พร้อม:** เพราะตัวมันเองทำหน้าที่เป็น Orchestrator คอยส่งต่องาน หากไม่มี specialist skills ระบบจะหยุดเตือนให้ติดตั้ง
