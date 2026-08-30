# ADR 0001: Subagent Prompt Scaffold, Ticket Retry Budget, and Capability Evals

- Status / สถานะ: Proposed / นำเสนอ
- Date / วันที่: 2026-08-31

## Context / บริบท

หลังจากปรับปรุง `engineering-workflow` ให้เป็น Universal Orchestrator ที่รองรับ Sequential Subagent Ticket Execution Loop เราจำเป็นต้องเพิ่มความเข้มงวด (Hardening) และลดความแปรปรวน (Variance) ในการทำงานของ Agent ผ่านการกำหนดโครงสร้าง Prompt มาตรฐาน, การจำกัดรอบการพยายามแก้ไขต่อตั๋วงาน (Per-Ticket Retry Budget), การเพิ่มคู่มือ Directive สำหรับติดตั้งใน Repository ต่างๆ และการเพิ่มชุด Evals สำหรับประเมินผล

## Decisions / การตัดสินใจ

1. **5-Section Subagent Prompt Scaffold**:
   - กำหนดแม่แบบ Prompt มาตรฐานใน `references/states.md` ประกอบด้วย 5 ส่วน: Target, Context & Seam, Verification, Constraints, และ Return Format
2. **Per-Ticket Retry Budget (`MAX_TICKET_ATTEMPTS = 3`)**:
   - กำหนดเพดานความพยายามของ Subagent ต่อ Ticket ไว้ที่ 3 ครั้ง หากยังรัน Verification test ไม่ผ่าน จะเปลี่ยนสถานะเป็น `BLOCKED (TICKET_VERIFICATION_FAILED)` พร้อมแนบ Log ความผิดพลาด
3. **Multi-Harness Directives in Documentation**:
   - เพิ่มตัวอย่าง Configuration/Directives ใน `docs/skills/agents/engineering-workflow.md` สำหรับนำไปวางใน `AGENTS.md`, `CLAUDE.md`, และ `.cursorrules`
4. **Capability Benchmark Evals**:
   - เพิ่มชุดทดสอบ Evals ใน `evals/evals.json` เพื่อวัดผลการตัดสินใจของ Agent ภายใต้สภาวะ `has_subagents: true` และ `has_subagents: false`

## Consequences / ผลที่ตามมา

- Subagent ทำงานได้อย่างแม่นยำ ไม่พ่น Log รกกลับมายัง Orchestrator
- ป้องกันการวนลูปซ่อมโค้ดไม่รู้จบ (Anti-hang & Token-safe)
- ผู้ใช้สามารถติดตั้งและเปิดใช้งาน Workflow ในโปรเจกต์ใหม่ได้ง่ายดาย
- มีระบบประเมินผลความถูกต้องตามมาตรฐานสากล
