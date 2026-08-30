# Ubiquitous Language & Context: Engineering Workflow Hardening

## Core Domain Terms

| Term | ภาษาไทย | ความหมาย |
|---|---|---|
| **Subagent Prompt Scaffold** | โครงสร้างแม่แบบคำสั่ง Subagent | โครงสร้าง Prompt มาตรฐานที่ Orchestrator ใช้ส่งมอบงานราย Ticket ให้ Subagent ประกอบด้วย Target, Context, Verification, Constraints และ Output Format เพื่อลดความแปรปรวน (Variance) |
| **Per-Ticket Retry Budget** | โควตารอบการแก้งานราย Ticket | เพดานจำกัดรอบการพยายามแก้ไขของ Subagent สำหรับ 1 Ticket (`MAX_TICKET_ATTEMPTS = 3`) หากรัน Verification ไม่ผ่านครบ 3 รอบ จะเข้าสู่สถานะ `BLOCKED (TICKET_VERIFICATION_FAILED)` ทันที |
| **Project Agent Directives** | คำสั่งกำกับ Agent ประจำ Repo | ข้อความสั้นที่ใส่ใน `AGENTS.md`, `CLAUDE.md`, หรือ `.cursorrules` เพื่อแนะนำให้ AI Agent ริเริ่มใช้ `engineering-workflow` เมื่อได้รับคำสั่งระดับ Feature หรือ Bug |
| **Capability Eval Benchmark** | ชุดทดสอบประเมินผลความสามารถ | รายการ Evals ใน `evals.json` ที่ตรวจสอบความถูกต้องของการตัดสินใจของ Agent ภายใต้ Capability Matrix ต่างๆ |
