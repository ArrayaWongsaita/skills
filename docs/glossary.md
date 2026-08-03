# Glossary / คำศัพท์กลาง

คำศัพท์ต่อไปนี้ใช้เป็นความหมายกลางใน repo นี้ เพื่อให้ชื่อใน README, คู่มือ และ validator สอดคล้องกัน

The following terms are the shared vocabulary for this repository.

| Term | ภาษาไทย | Definition / ความหมาย |
| --- | --- | --- |
| Skill | สกิว | Reusable instructions in a directory whose entry point is `SKILL.md`. / ชุดคำสั่งที่นำกลับมาใช้ได้ โดยมี `SKILL.md` เป็น entry point |
| Skill Guide | คู่มือ Skill | Human-facing documentation in `docs/skills/`, separate from agent instructions. / เอกสารสำหรับคนใน `docs/skills/` ที่แยกจากคำสั่ง agent |
| Category | หมวด | The single primary directory grouping a skill, such as `agents` or `nextjs`. / directory หลักหนึ่งเดียวที่ใช้จัดกลุ่ม skill |
| Group Install | ติดตั้งแบบกลุ่ม | Installing multiple named skills with repeated `--skill` flags. / การติดตั้งหลาย skill ด้วย `--skill` ซ้ำกัน |
| Source of Truth | แหล่งข้อมูลหลัก | The canonical file that owns a rule or behavior. For a skill, this is `SKILL.md`. / ไฟล์หลักที่เป็นเจ้าของกฎหรือ behavior |
| Skill Index | ดัชนี Skill | Generated catalog at `docs/skills/README.md`, grouped by category. / สารบัญที่สร้างอัตโนมัติและแบ่งตามหมวด |
| Validator | ตัวตรวจสอบ | A deterministic check that detects invalid metadata, missing guides, and stale generated files. / การตรวจแบบ deterministic สำหรับ metadata เอกสาร และไฟล์ generated |
