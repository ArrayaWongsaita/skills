# Ubiquitous Language & Context: Universal Engineering Workflow

## Core Domain Terms

| Term | ความหมาย |
|---|---|
| **Universal Control Plane** | ตัวควบคุม Workflow กลางที่ทำงานได้บนทุก AI Agent (Antigravity, Cursor, Windsurf, Roo Code, Aider, Claude Code, Codex ฯลฯ) |
| **Capability-Based Resolution** | การตรวจสอบเงื่อนไขตาม "ความสามารถจริง" ของ Agent (เช่น มี subagent หรือไม่, รัน bash ได้หรือไม่) แทนการล็อคชื่อ runtime/แบรนด์ |
| **Sequential Ticket Execution Loop** | ลูปการสั่งงาน Subagent ให้ทำทีละ Ticket ตามลำดับความขึ้นต่อกัน (Dependency order 1..N) ที่ได้รับจาก `to-tickets` |
| **Transient Subagent Worker** | การ Spawn Subagent ชนิด Default (`self`) ขึ้นมาทำงานเป็นราย Ticket เพื่อแยก Context Window ให้สะอาด ไม่บวม และป้องกัน Hallucination |
| **Progressive Phase Boundary** | การเลือกวิธีจัดการ Context Boundary อัตโนมัติ: ถ้า Agent รองรับ Subagent ให้ Fork context ทันที; ถ้าไม่รองรับ ให้แนะนำคำสั่ง `/clear` เป็น Fallback |
| **Markdown-First Interface** | การเผยแพร่และควบคุมผ่านเอกสาร Markdown มาตรฐาน (`SKILL.md`, `AGENTS.md`) และ Python CLI โดยไม่ต้องผูกมัดกับโครงสร้าง Server ซับซ้อน |
| **Gate Counter & Budget** | โควตารอบการรีวิวแบบจำกัด (Design 6, Code 3, System 6) ที่ป้องกันการวนลูปไม่รู้จบ |
