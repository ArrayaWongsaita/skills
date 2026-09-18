# คู่มือการติดตั้งและใช้งาน Skill: agent-instructions-architect

- **หมวดหมู่ (Category):** `agents`
- **แหล่งติดตั้ง (Install Source):** `ArrayaWongsaita/skills`
- **ไฟล์นิยามหลัก (Definition):** [`skills/agents/agent-instructions-architect/SKILL.md`](../../skills/agents/agent-instructions-architect/SKILL.md)

---

## 1. agent-instructions-architect คืออะไรและมีไว้สำหรับทำอะไร?

`agent-instructions-architect` เป็น Skill สำหรับตรวจสอบ (Audit), ออกแบบ (Design), ติดตั้ง (Setup), ปรับโครงสร้าง (Refactor), ย้ายระบบ (Migrate) หรือตรวจสอบความถูกต้อง (Validate) สถาปัตยกรรมคำสั่งกำกับ AI Agent (**Instruction Architecture**) ในระดับ Repository สำหรับ **Single-Agent System**

### แนวคิดหลัก: Single Agent with Composable Expertise
Skill นี้ **ไม่สร้าง** ตัวแทนแยกย่อยหลายตัวที่ซ้ำซ้อน เช่น ไม่สร้าง frontend-agent, backend-agent, tester, reviewer แต่จะสร้างระบบความเชี่ยวชาญ (Expertise) ให้ Agent ตัวเดียวเลือกหยิบใช้ตามความจำเป็นผ่านหลักการ **Progressive Disclosure** (เปิดอ่านข้อมูลเฉพาะเมื่อต้องใช้จริง)

### แผนผังการกระจายหน้าที่ของไฟล์ (Responsibility Model)
```text
AGENTS.md          = ข้อมูลที่จำเป็นต้องรู้แทบทุกงาน + แผนที่การนำทาง + Routing & Safety Rules
nested AGENTS.md   = กฎเฉพาะเจาะจงของ Subtree หรือโฟลเดอร์ย่อย (เช่น packages/api/AGENTS.md)
SKILL.md           = ขั้นตอนการปฏิบัติงานที่ทำซ้ำได้ (HOW: ทำอย่างไร)
docs/standards     = ข้อกำหนดและมาตรฐานที่ Repository บังคับ (WHAT: ต้องทำอะไร)
ARCHITECTURE.md    = โครงสร้าง ขอบเขตการทำงาน ความขึ้นต่อกัน (Dependency Boundaries)
docs/decisions     = บันทึกเหตุผลการตัดสินใจทางสถาปัตยกรรม (ADR)
tooling / CI       = เครื่องมือตรวจสอบอัตโนมัติ (Linter, Formatter, Tests)
```

---

## 2. การพึ่งพา Skill อื่น (Dependencies) และการติดตั้ง

### พึ่งพา Skill อะไรบ้าง?
- **ไม่มีการพึ่งพา Skill ภายนอก (Zero External Skill Dependencies):**
  - เป็น Standalone Skill ที่มีสคริปต์ Python ในโฟลเดอร์ `scripts/` ของตัวเองสำหรับวิเคราะห์โครงสร้างคำสั่ง (`analyze_instruction_tree.py`, `evaluate_routing.py` ฯลฯ)

### สิ่งที่ต้องมีในสภาพแวดล้อม (System Prerequisites)
1. **Python 3.10 ขึ้นไป:** สำหรับรันสคริปต์วิเคราะห์โครงสร้างคำสั่งในโหมด Audit/Validate
2. **Git Repository:** ทำงานบน codebase ที่มีการจัดการเวอร์ชัน

### คำสั่งติดตั้ง

```bash
npx skills add ArrayaWongsaita/skills --skill agent-instructions-architect
```

---

## 3. วิธีการใช้งานและขั้นตอนการทำงาน (Usage & Workflow)

### คำสั่งเรียกใช้งาน (Invocation)
- Slash command: `/agent-instructions-architect [mode]`
- Codex command: `$agent-instructions-architect [mode]`
- หรือสั่งด้วยภาษาธรรมชาติ โดยระบุเป้าหมาย เช่น audit, setup, refactor, migrate หรือ validate

### โหมดการทำงาน 6 โหมด (Modes)
1. **Audit:** ตรวจสอบระบบคำสั่งเดิมที่มีอยู่ หาจุดซ้ำซ้อน ลิงก์เสีย ข้อขัดแย้ง และ Context ที่บวมเกินไป
2. **Design:** ออกแบบโครงสร้างคำสั่งใหม่ที่เหมาะสมกับขนาดและประเภทของ Repository
3. **Setup:** สร้าง `AGENTS.md` และโครงสร้าง Skills เริ่มต้นสำหรับ Repository ที่ยังไม่มี
4. **Refactor:** ย่อย `AGENTS.md` หรือ `CLAUDE.md` ขนาดยักษ์ให้บางลง และแยกเนื้อหาไปไว้ใน Scoped Skills หรือ Docs
5. **Migrate:** แปลงและประสานคำสั่งจากระบบอื่น (เช่น Claude Code rules, Copilot instructions, Cursor rules) เข้าสู่ระบบกลางที่ใช้ร่วมกันได้
6. **Validate:** ตรวจสอบความถูกต้องเชิงโครงสร้าง คำสั่งจริง และลิงก์อ้างอิงทั้งหมดผ่านสคริปต์อัตโนมัติ

---

### ขั้นตอนการทำงาน 6 ขั้นตอน

```text
1. ตรวจสอบ Repository (Stack, Monorepo/Small, CI, เอกสารเดิม)
      ↓
2. จำแนกข้อมูลตาม Taxonomy (แยก HOW, WHAT, Scope, Map)
      ↓
3. สร้างโครงสร้างที่เล็กที่สุด (Lean root AGENTS.md, ไม่สร้างโฟลเดอร์ว่าง)
      ↓
4. ออกแบบ Composable Skills (กำหนดคำอธิบาย WHEN + WHAT ชัดเจน)
      ↓
5. เพิ่ม Runtime Adapters เท่าที่จำเป็น (เช่น symlink สำหรับ Claude/Codex)
      ↓
6. ตรวจสอบความถูกต้องและทดสอบความกระชับของ Context
```

---

## 4. ตัวอย่างคำสั่งและ Prompt ใช้งานจริง

### ตัวอย่างที่ 1: ตั้งค่าระบบคำสั่งเริ่มต้นให้กับโปรเจกต์ใหม่
```text
ใช้ $agent-instructions-architect สำรวจ repository นี้ แล้วออกแบบระบบคำสั่งขนาดกะทัดรัด โดยให้ root AGENTS.md สั้นกระชับ นำมาตรฐานโค้ดเดิมมาใช้เป็น source of truth และสร้าง skill เฉพาะขั้นตอนที่ต้องทำซ้ำบ่อยๆ
```

### ตัวอย่างที่ 2: ตรวจสอบและ Refactor ไฟล์คำสั่งที่ยาวเกินไป
```text
/agent-instructions-architect ตรวจสอบไฟล์ AGENTS.md และ CLAUDE.md ปัจจุบันที่มีขนาดใหญ่เกินไป แยกข้อกำหนดเฉพาะทางออกเป็น skills และลดการใช้ token ที่ไม่จำเป็น
```

### ตัวอย่างที่ 3: ตรวจสอบความถูกต้อง (Validate)
```text
/agent-instructions-architect validate ตรวจสอบลิงก์อ้างอิง กฎ precedence และคำสั่งทั้งหมดในระบบ instruction ให้สมบูรณ์
```

---

## 5. ข้อควรระวังและสิ่งที่ไม่ควรใช้
- **ไม่ใช้สำหรับงานเขียนฟีเจอร์ของแอปพลิเคชัน:** Skill นี้มีไว้สำหรับจัดการเอกสารกำกับ AI เท่านั้น
- **หลีกเลี่ยงการสร้าง Sub-agent แบบไร้เหตุผล:** ห้ามแยกเป็น frontend-agent / backend-agent เพราะทำให้สับสนเรื่องความรับผิดชอบ
- **อย่าใส่กฎเยอะเกินไปใน Root `AGENTS.md`:** ใส่เฉพาะสิ่งที่ Agent จำเป็นต้องรู้ในเกือบทุกเทิร์น ส่วนรายละเอียดเชิงลึกให้ย้ายไปไว้ใน Skill หรือ Reference doc
