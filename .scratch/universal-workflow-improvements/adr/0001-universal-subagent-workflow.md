# ADR 0001: Universal Capability-Based Routing with Sequential Subagent Execution

- Status / สถานะ: Proposed / นำเสนอ
- Date / วันที่: 2026-08-31

## Context / บริบท

เดิม `engineering-workflow` ถูกออกแบบโดยอ้างอิงสภาพแวดล้อมเฉพาะทาง เช่น Claude Code และ Codex (ตรวจจับผ่าน `--runtime <claude|codex>`) และใช้คำสั่ง `/clear` เพื่อให้มนุษย์รีเซ็ต Context Window ก่อนเริ่ม Stage `IMPLEMENTATION` 

ในปัจจุบันมี AI Coding Agents หลากหลายแพลตฟอร์ม (Antigravity, Cursor, Windsurf, Roo Code, Aider ฯลฯ) ที่มีความสามารถแตกต่างกัน การยึดติดกับชื่อ runtime ทำให้การพกพา (Portability) ลดลง นอกจากนี้ ในกรณีที่ Agent รองรับ Subagents การบังคับให้ผู้ใช้ต้องมากด `/clear` ถือเป็น Friction ที่ขัดจังหวะความเป็น Autonomous

## Decisions / การตัดสินใจ

1. **Capability-Based Detection**:
   - ปรับการตรวจสอบใน `dependency_audit.py` และสเปก ให้ตรวจสอบ Capabilities จริง (`has_subagents`, `has_bash_tool`, `is_interactive`) แทนการเช็คชื่อแบรนด์หรือ runtime name
2. **Sequential Subagent Execution Loop for Tickets**:
   - เมื่อผ่าน Stage `PLANNING` (`to-tickets`) แล้ว Orchestrator จะวนลูปประมวลผล Ticket ตามลำดับ (1..N)
   - แต่ละ Ticket จะถูก Dispatch ไปยัง Transient Subagent (`TypeName: "self"`) พร้อม Prompt ที่แนบเฉพาะ Ticket และ Acceptance Criteria เพื่อรักษาระดับ Smart Zone (Clean Context)
   - Subagent รายงานผลลัพธ์ (Diff + Test Passing) กลับมายัง Orchestrator เพื่อตรวจสอบ State CAS ก่อนเดินหน้า Ticket ถัดไป
3. **Progressive Phase Boundary Handling**:
   - หาก `has_subagents: true` ➔ รัน Subagent อัตโนมัติโดยไม่ต้องพึ่งพา `/clear`
   - หาก `has_subagents: false` (Single-session CLI) ➔ แนะนำคำสั่ง `/clear` + `continue` เป็น Fallback มาตรฐาน
4. **Markdown-First / Rules-First Distribution**:
   - เน้นย้ำความเรียบง่ายและเป็นสากลด้วย Markdown instructions (`SKILL.md`, `AGENTS.md`) และ Python CLI ที่ใช้ Standard Library ล้วน โดยไม่ผูกมัดกับโครงสร้าง Server ซับซ้อน

## Consequences / ผลที่ตามมา

- Skill สามารถนำไปใช้งานบน Agent ใดๆ ก็ตามในโลกได้อย่างราบรื่น
- เพิ่มประสิทธิภาพการทำงานแบบ Autonomous เมื่ออยู่บน Harness ที่รองรับ Subagents
- ไม่สูญเสียความเข้ากันได้ย้อนหลัง (Backward-compatible) กับผู้ใช้ Terminal CLI ทั่วไป
