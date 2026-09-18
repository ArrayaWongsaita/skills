# คู่มือการติดตั้งและใช้งาน Skill: agy-agent

- **หมวดหมู่ (Category):** `agents`
- **แหล่งติดตั้ง (Install Source):** `ArrayaWongsaita/skills`
- **ไฟล์นิยามหลัก (Definition):** [`skills/agents/agy-agent/SKILL.md`](../../skills/agents/agy-agent/SKILL.md)

---

## 1. agy-agent คืออะไรและมีไว้สำหรับทำอะไร?

`agy-agent` เป็น Skill สะพานเชื่อม (Bridge Skill) ที่เปิดทางให้ AI Agent Harness อื่นๆ (เช่น Claude Code, Cursor, Codex CLI, OpenCode, Aider) สามารถสั่งงานและส่งต่อ (Delegate) ภารกิจเฉพาะด้านไปยัง **Google Antigravity CLI (`agy`)** เพื่อให้ทำงานเป็น Headless Subagent ในพื้นหลัง

### จุดประสงค์หลักและคุณสมบัติเด่น
1. **ปลดล็อก Context Window ขนาด 1,000,000+ Tokens:**
   - เหมาะอย่างยิ่งสำหรับการสแกน Codebase ทั้งโปรเจกต์ขนาดใหญ่ หรืออ่านไฟล์ล็อก/Build Output มหึมาที่โมเดลของ Agent หลักรับไม่ไหว
2. **ประหยัด Token และ Quota ของโมเดลหลัก:**
   - โยนงานที่ใช้ Context เยอะหรืองานกลไกที่ตรงไปตรงมาไปรันบน `agy` ทำให้ Host Agent ประหยัดโควต้า
3. **Zero External Dependencies (File-Based I/O Protocol):**
   - ทำงานผ่าน Native Shell Command และสื่อสารผ่านไฟล์ชั่วคราว ไม่ต้องติดตั้ง Runtime เสริม
4. **เลือกใช้โมเดลตามความเหมาะสมของงาน (Task-Aware Model Selection):**
   - สามารถเลือกใช้โมเดลสาย Gemini ในตระกูล Pro สำหรับงานใช้เหตุผลลึกซึ้ง หรือ Flash สำหรับงานประมวลผลเร็ว

---

## 2. การพึ่งพา Skill อื่น (Dependencies) และการติดตั้ง

### พึ่งพา Skill อะไรบ้าง?
- **ไม่มีการพึ่งพา Skill ภายนอก (Zero External Skill Dependencies)**

### ซอฟต์แวร์และเครื่องมือที่ต้องมีในเครื่อง (System Prerequisites)
1. **Google Antigravity CLI (`agy`):** ต้องติดตั้งอยู่ในระบบและสามารถเรียกผ่าน Terminal ได้
   ```bash
   # ตรวจสอบการติดตั้ง agy
   agy --version
   ```
2. **การยืนยันตัวตน (Authentication):** ล็อกอินบัญชี Google หรือตั้งค่า Credentials ของ `agy` เรียบร้อยแล้ว

### คำสั่งติดตั้ง

```bash
npx skills add ArrayaWongsaita/skills --skill agy-agent
```

---

## 3. วิธีการใช้งานและขั้นตอนการทำงาน (Usage & Workflow)

### คำสั่งเรียกใช้งาน (Invocation)
Skill นี้ถูกตั้งค่าแบบ Explicit-only (AI จะไม่เรียกใช้เองอัตโนมัติ ต้องสั่งด้วยชื่อ):
- Slash command: `/agy-agent <คำอธิบายภารกิจ>`
- Codex command: `$agy-agent <คำอธิบายภารกิจ>`
- คำสั่งภาษาธรรมชาติ: "ใช้ agy สแกน...", "delegate งานนี้ให้ agy", "ให้ antigravity ช่วยทำ..."

---

### ตารางการเลือกโมเดลให้เหมาะกับงาน (Model Selection Matrix)

| รูปแบบภารกิจ | โมเดลและ Tier แนะนำ | เหตุผล |
| :--- | :--- | :--- |
| **สแกนโค้ดทั้ง Repo / อ่าน Log มหาศาล (1M+ tokens)** | `gemini-3.8-flash-high` | Context กว้างมหาศาล ความเร็วสูง ประหยัด token |
| **วิเคราะห์บั๊กซับซ้อน / Concurrency / Architecture** | `gemini-3.1-pro-high` | ใช้ Reasoning เชิงลึกในการไล่ Logic ซับซ้อน |
| **งานกลไก / Boilerplate / Bulk Rename / Format** | `gemini-3.8-flash-medium` | ประมวลผลเร็ว ไม่เปลือง reasoning budget |
| **ขอความเห็นที่สอง (Cross-Provider Second Opinion)** | `gemini-3.1-pro-high` (เมื่อ Host เป็น Claude) | ช่วยลด Confirmation Bias จากโมเดลคนละค่าย |

---

### ขั้นตอนการทำงานเบื้องหลัง (File-Based I/O Protocol)

1. **Host Agent เขียน Prompt ลงไฟล์ชั่วคราว:**
   - เขียนคำสั่งและ Acceptance Criteria ลง `/tmp/agy-prompts/<task-id>.md` เพื่อป้องกันปัญหา Shell Escaping
2. **สั่งรัน `agy` แบบ Headless ผ่าน Shell:**
   ```bash
   agy -p "$(cat /tmp/agy-prompts/<task-id>.md)" \
     --model gemini-3.8-flash-high \
     --dangerously-skip-permissions \
     --output-format json \
     --print-timeout 15m \
     --disable-slash-commands \
     > /tmp/agy-logs/<task-id>.json \
     2> /tmp/agy-logs/<task-id>.err
   ```
3. **ตรวจสอบสถานะและแยกแยะผลลัพธ์ (Verify Envelope):**
   - ตรวจสอบ Exit Code (`0` = สำเร็จ)
   - Parse JSON Envelope ตรวจสอบว่า `status == "SUCCESS"`
4. **ส่งงานต่อหรือแก้ซ้ำ (Resume multi-turn):**
   - หากต้องแก้ต่อ สามารถเรียกผ่าน `--conversation "<conversation_id>"` เพื่อสานต่อบริบทเดิมได้ทันที

---

## 4. ตัวอย่างคำสั่งและ Prompt ใช้งานจริง

### ตัวอย่างที่ 1: สแกน Codebase หาจุดที่ยังใช้ API รุ่นเก่า
```text
/agy-agent ช่วยสำรวจโค้ดทั้งโปรเจกต์ ค้นหาทุกไฟล์ที่ยังเรียกใช้ legacyAuthService แล้วทำตารางสรุปไฟล์พร้อมบรรทัดและวิธีแปลงเป็น AuthService ตัวใหม่
```

### ตัวอย่างที่ 2: วิเคราะห์ไฟล์ Log ขนาดยักษ์
```text
/agy-agent อ่านไฟล์ build.log ขนาด 200MB ในโฟลเดอร์ temp แล้ววิเคราะห์หาสาเหตุของ Native Crash ที่เกิดขึ้นระหว่างรัน E2E test
```

### ตัวอย่างที่ 3: ขอความเห็นที่สอง (Second Opinion) เกี่ยวกับสถาปัตยกรรม
```text
/agy-agent ช่วยวิเคราะห์ข้อดีข้อเสียของการเปลี่ยนระบบแคชจาก Redis เดี่ยวไปเป็น Redis Cluster ใน architecture.md โดยขอความเห็นในมุมมองของ High Availability
```

---

## 5. ข้อควรระวังและสิ่งที่ไม่ควรใช้
- **ไม่เหมาะกับงานแก้โค้ดสั้นๆ 1-2 บรรทัด:** การเปิดกระบวนการ subagent จะมี overhead สูงกว่าการแก้ตรงๆ
- **ไม่เหมาะกับงานที่ต้องถามตอบโต้ตอบกับผู้ใช้ (Interactive):** `agy` จะรันแบบอัตโนมัติจนเสร็จสิ้น
- **ระวังเรื่อง Path ใน Prompt:** ควรสื่อสารด้วย Absolute Path เสมอเพื่อให้ Subagent อ้างอิงไฟล์ได้แม่นยำ
- **ไม่ใช้สำหรับรัน tickets แบบ wave:** หากต้องการรันชุด ticket ของฟีเจอร์ ให้ใช้ `agy-implement` แทน
