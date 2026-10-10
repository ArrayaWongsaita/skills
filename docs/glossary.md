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
| Seam | รอยต่อสำหรับทดสอบ | The boundary at which a feature's behavior is tested. / ขอบเขตที่ใช้ทดสอบ behavior ของ feature |
| delegate run | การรันมอบงาน | One headless `claude-tokenme -p` invocation that carries one self-contained task to the model behind the tokenme settings file. / การเรียก `claude-tokenme -p` แบบ headless หนึ่งครั้งที่ส่ง self-contained task หนึ่งงานไปให้โมเดลที่ tokenme settings file กำหนด |
| claude-tokenme | คำสั่ง claude-tokenme | Zsh alias for `claude --settings ~/.claude/settings-tokenme.json`; it routes to the tokenme gateway, and the model is whatever that settings file configures, not hardcoded in the skill. / alias ของ zsh สำหรับ `claude --settings ~/.claude/settings-tokenme.json` ซึ่ง route ไปยัง tokenme gateway โดยโมเดลกำหนดใน settings file นั้น ไม่ได้ hardcode ไว้ใน skill |
| footprint | ขนาดงานโดยประมาณ | Estimated tokens of work a delegate run consumes: bytes of files read ÷ 4 × 1.5 (edits and output); it excludes the fixed overhead, which the budget check adds on top (about 1k bare, about 28k not bare). / ค่าประมาณ token ที่ delegate run ใช้ คือ ไบต์ของไฟล์ที่อ่าน ÷ 4 × 1.5 (รวม edit และ output) โดยไม่รวม fixed overhead ซึ่งการตรวจงบจะบวกเพิ่มเอง (ประมาณ 1k เมื่อ bare, ประมาณ 28k เมื่อไม่ bare) |
| planning budget | งบวางแผน | 60k tokens (footprint plus overhead) per delegate run; the 128k window is not the planning number. / 60k tokens (footprint บวก overhead) ต่อ delegate run หนึ่งงาน ส่วน window 128k ไม่ใช่ตัวเลขที่ใช้วางแผน |
| ceiling | เพดาน | 90k tokens (`autoCompactWindow`), above which the run compacts and is no longer trustworthy. / 90k tokens (`autoCompactWindow`) เหนือกว่านั้น run จะ compact และไม่น่าเชื่อถืออีกต่อไป |
| bare run | รันแบบ bare | A delegate run started with `--bare`: no CLAUDE.md, hooks, skills or MCP (about 1k tokens of overhead instead of about 28k); every convention the task needs travels in the prompt. / delegate run ที่เริ่มด้วย `--bare` ตัด CLAUDE.md, hooks, skills และ MCP ออก (overhead ประมาณ 1k tokens แทนประมาณ 28k) โดยข้อตกลงทุกอย่างที่งานต้องใช้เดินทางผ่าน prompt |
| envelope | ซองผลลัพธ์ | The `--output-format json` result object; `is_error`, `subtype`, `terminal_reason`, `num_turns` and `usage` decide whether the run counts as success. / อ็อบเจกต์ผลลัพธ์จาก `--output-format json` โดย `is_error`, `subtype`, `terminal_reason`, `num_turns` และ `usage` เป็นตัวตัดสินว่า run นับเป็นความสำเร็จหรือไม่ |
| host | โฮสต์ | The agent that calls the skill; it stays the authority on correctness and verifies every delegate run. / agent ที่เรียกใช้ skill เป็นผู้ชี้ขาดเรื่องความถูกต้องและตรวจ delegate run ทุก run ด้วยตัวเอง |
| Tracker | ที่เก็บ spec และ ticket | Where a project keeps its specs and tickets, as its `docs/agents/issue-tracker.md` describes. A tracker is local (markdown files in the repository) or remote (an issue service such as GitHub Issues). / ที่ที่ project เก็บ spec และ ticket ตามที่ `docs/agents/issue-tracker.md` ระบุ มีสองชนิดคือ local (ไฟล์ markdown ใน repository) และ remote (บริการ issue เช่น GitHub Issues) |
| Run status | สถานะการรัน | The record that shows a person which state each ticket of one implementation run is in. / บันทึกที่บอกผู้ใช้ว่า ticket แต่ละใบในการ implement หนึ่งรันอยู่ในสถานะใด |
