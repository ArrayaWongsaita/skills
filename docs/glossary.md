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
| Workflow Orchestrator | ตัวควบคุมเวิร์กโฟลว์ | The explicit control plane that owns classification, routing, transitions, persisted state, gates, resume, and completion. / control plane ที่เป็นเจ้าของการจำแนก route, transition, state, gate, resume และ completion |
| Stage | ขั้นงาน | One persisted state in an engineering workflow with declared entry, input, discipline, output, exit, failure, and next-state contracts. / สถานะงานหนึ่งขั้นที่มี contract สำหรับเข้า ทำงาน ออก ล้มเหลว และไปต่อ |
| Gate | ด่านตรวจ | A bounded evidence review that must pass before a workflow advances; design, code, and system gates have independent budgets. / การตรวจหลักฐานแบบมีจำนวนรอบจำกัด โดย design, code และ system แยก budget กัน |
| Worker | ผู้ปฏิบัติงาน | A single invocation of an installed external specialist; it owns discipline work but never chooses the orchestrator's next state. / การเรียกใช้ external specialist หนึ่งครั้ง ซึ่งทำงานตาม discipline แต่ไม่มีสิทธิ์เลือก state ถัดไปของ orchestrator |
| External Specialist | ผู้เชี่ยวชาญภายนอก | An installed skill that owns one engineering discipline; the orchestrator supplies context and retains transition authority. / skill ที่ติดตั้งภายนอกและเป็นเจ้าของ discipline หนึ่งด้าน โดย orchestrator เป็นผู้ถือสิทธิ์ transition |
| Artifact Reference | การอ้างอิงอาร์ติแฟกต์ | A repository-relative path plus kind, producer stage, and content fingerprint stored in workflow state instead of the artifact body. / path, ชนิด, stage ผู้สร้าง และ fingerprint ที่เก็บใน state แทนเนื้อหาเต็ม |
| Workflow State | สถานะเวิร์กโฟลว์ | A compact versioned JSON record for workflow identity, classification, execution, evidence references, gates, dependencies, recovery, and revision. / JSON แบบ versioned ที่เก็บ identity, classification, execution, evidence refs, gates, dependencies, recovery และ revision |
| Reuse Catalog | แคตตาล็อกโค้ดที่ใช้ซ้ำได้ | A target project's `docs/reuse-catalog.md`, indexing its reusable code, the rules for using it, candidates, and survey coverage; it lists only code that exists. / ไฟล์ `docs/reuse-catalog.md` ของ project ที่รวบรวมโค้ดที่ใช้ซ้ำได้ กฎการใช้ candidate และ coverage ของการสำรวจ โดยมีเฉพาะโค้ดที่มีอยู่จริง |
| Reuse Field | ฟิลด์ Reuse | The `**Reuse:**` line on a ticket, with the fixed verbs `use`, `extend`, `create-shared`, `create-candidate`, `promote`; guidance and catalog bookkeeping, never an acceptance criterion. / บรรทัด `**Reuse:**` ใน ticket ที่ใช้คำกริยาตายตัว เป็นคำแนะนำและข้อมูลสำหรับอัปเดต catalog ไม่ใช่ acceptance criterion |
