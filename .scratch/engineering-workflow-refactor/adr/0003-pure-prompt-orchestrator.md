# ADR 0003: Pure-Prompt Orchestrator with Markdown Artifacts

- Status / สถานะ: Proposed / เสนอ
- Date / วันที่: 2026-08-31

## Context / บริบท

ADR 0002 กำหนดให้มี One orchestrator สำหรับ engineering skills แต่ในทางปฏิบัติ การพึ่งพา Python scripts (`workflow_state.py`, `dependency_audit.py`) ทำให้เกิดข้อจำกัด:
1. Environment Compatibility: เครื่องที่ไม่มี Python 3 หรือมี Environment แตกต่างกันจะไม่สามารถรันสคริปต์ได้
2. Agent Compliance: Agent มักจะมองข้ามคำสั่ง CLI ภายนอก และพุ่งตรงไปแก้โค้ดทันที (Action Bias)
3. Visibility: ข้อมูล State ใน JSON ถูกซ่อนไว้ ไม่โปร่งใสต่อการตรวจสอบของมนุษย์ในระหว่างทำงาน

## Decision / การตัดสินใจ

1. ปรับปรุง `skills/agents/engineering-workflow` ให้เป็น **Pure-Prompt Architecture** 100% โดยไม่ต้องพึ่งพา Script ภายนอกใดๆ
2. ใช้ **Markdown State Artifact** (`.scratch/<feature-slug>/status.md` หรือ `.agents/workflows/<id>.md`) บันทึกสถานะ, แผนงาน, และ Gate Checklist ผ่าน Tool สร้าง/แก้ไขไฟล์มาตรฐาน
3. กำหนด **Mandatory State Anchor Block** ให้ Agent พิมพ์สถานะปัจจุบันออกมาเป็นหัวข้อแรกในทุกข้อความตอบกลับเพื่อตรึงสมาธิ (Attention Pinning)
4. ใช้ **Adaptive Quality Gating**:
   - งานขนาดเล็ก (Low risk): หยุดขอ Approval 1 ครั้งหลังสรุปแผน ก่อนเริ่มเขียนโค้ด
   - งานขนาดใหญ่ (High risk): หยุดขอ Approval หลัง Discovery, หลัง Spec, และหลัง Ticket Breakdown พร้อมคำแนะนำ `/clear` ก่อนเริ่ม Implement
5. รองรับ **Dual Mode**: สั่งงานผ่าน Subagents เมื่อ Environment รองรับ หรือใช้ Phase Boundaries ใน Single-Session CLI
