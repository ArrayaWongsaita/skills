# ADR 0024: tokenme-agent is model-invocable, guarded by rules in the skill

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-10-02

## Context / บริบท

The dispatch skills in this library — `agy-agent` and `opencode-implement` —
are explicit-only: their frontmatter sets `disable-model-invocation: true` and
their agent config sets `allow_implicit_invocation: false`, because they send a
headless agent out with broad tool approval and should run only when the user
asks for them by name. `tokenme-agent` is adapted from the 9arm original it
replaces, and that original is model-invocable. The owner's working style needs
that behaviour kept: any agent should be able to hand a mechanical,
self-contained subtask to the cheaper gateway run on its own, without the user
typing a command for each one and without wiring an orchestrator such as
`implement-tickets` to the skill.

skill dispatch ที่มีอยู่ใน library นี้ — `agy-agent` และ `opencode-implement` — เป็นแบบ
explicit-only: frontmatter ตั้ง `disable-model-invocation: true` และ agent config ตั้ง
`allow_implicit_invocation: false` เพราะทั้งคู่ส่ง headless agent ออกไปพร้อมสิทธิ์ tools กว้าง
จึงควรรันเฉพาะเมื่อผู้ใช้เรียกด้วยชื่อ `tokenme-agent` ดัดแปลงมาจากต้นฉบับ 9arm ที่มาแทนที่
ซึ่งต้นฉบับเป็น model-invocable และเจ้าของต้องการคงพฤติกรรมนี้ไว้: agent ตัวใดควรยก subtask ที่
mechanical และ self-contained ไปให้ gateway run ที่ถูกกว่าได้ด้วยตัวเอง โดยผู้ใช้ไม่ต้องพิมพ์คำสั่ง
ทีละงาน และไม่ต้องผูก orchestrator อย่าง `implement-tickets` เข้ากับ skill

## Decision / การตัดสินใจ

1. `tokenme-agent` ships model-invocable: `SKILL.md` carries no
   `disable-model-invocation` frontmatter, and `agents/openai.yaml` sets
   `allow_implicit_invocation: true`.
2. The description and the Invocation section aim the skill at mechanical,
   self-contained work, name the phrases that reach it — "use tokenme",
   "delegate this", "do this cheaply" — and state what stays on the host, so
   the routing surface carries its own exclusions.
3. The guards are mandatory parts of the skill's text: hard keep-local rules
   (secrets, `.env` or credential files, `Risk: high` tickets, code the user
   marks as staying local) checked by the host before dispatch, a
   three-point eligibility checklist, mandatory host verification of every
   outcome, and a no-recursion rule that blocks a delegate run from starting
   another `claude` or `claude-tokenme` run.
4. `implement-tickets` stays untouched and unaware of the skill: delegation
   happens because an agent recognises the work, not because an orchestrator
   learned a new flag.

1. `tokenme-agent` เป็น model-invocable: `SKILL.md` ไม่ใส่ frontmatter
   `disable-model-invocation` และ `agents/openai.yaml` ตั้ง
   `allow_implicit_invocation: true`
2. description และหัวข้อ Invocation ชี้ skill ไปที่งาน mechanical ที่ self-contained
   ระบุวลีที่เรียกมันได้ — "use tokenme", "delegate this", "do this cheaply" —
   พร้อมบอกงานที่คงอยู่กับ host ทำให้หน้า routing มีกันหลงทางในตัวเอง
3. กันหลง (guards) เป็นส่วนบังคับในตัว skill: keep-local rules ที่เข้ม (secrets,
   `.env` หรือ credential files, ticket `Risk: high`, code ที่ผู้ใช้ทำเครื่องหมายว่า
   ห้ามออกจากเครื่อง) โดย host ตรวจก่อน dispatch, eligibility checklist สามข้อ,
   การที่ host ตรวจผลทุกชิ้นเสมอ และกฎ no-recursion ที่กัน delegate run เริ่ม
   `claude` หรือ `claude-tokenme` ซ้อนอีกที
4. `implement-tickets` ไม่ถูกแก้และไม่รู้จัก skill นี้: การ delegate เกิดเพราะ agent
   จำงานได้ ไม่ใช่เพราะ orchestrator เรียน flag ใหม่

## Rejected alternatives / ทางเลือกที่ปฏิเสธ

- Explicit-only invocation like the siblings (`disable-model-invocation:
  true`): every delegation would start with the user typing a command, or
  each orchestrator would need its own wiring to reach the skill — exactly
  the coupling and the per-call friction the owner asked to avoid.

- เรียกแบบ explicit-only เหมือนพี่น้อง (`disable-model-invocation: true`): การ delegate
  ทุกครั้งต้องเริ่มจากผู้ใช้พิมพ์คำสั่ง หรือไม่ orchestrator แต่ละตัวต้องถูกเดินสายเรียก skill
  ซึ่งเป็น coupling และ friction ต่อการเรียกแต่ละครั้งที่เจ้าของขอให้เลี่ยงพอดี

## Consequences / ผลที่ตามมา

- Code leaves the machine for the gateway without a per-call request. That
  exposure is why the guards are mandatory rather than advice: the
  keep-local check runs on the host before dispatch (a bare run reads no
  project instructions, so the host check is the only check), the host
  verifies every outcome itself, and the deny list blocks nested runs.
- The description is load-bearing: it routes tasks in and keeps the wrong
  ones out, so the trigger evals cover should-trigger and should-not-trigger
  cases and regressions in that wording are caught.
- The decision is scoped to `tokenme-agent`, whose gateway run is cheap,
  one-shot and verified; `agy-agent` and `opencode-implement` keep their
  explicit-only setting.

- code ออกจากเครื่องไปหา gateway ได้โดยไม่ต้องขอต่อการเรียกหนึ่งครั้ง ๆ exposure นี้เอง
  ที่ทำให้ guards เป็นข้อบังคับ ไม่ใช่คำแนะนำ: host ตรวจ keep-local ก่อน dispatch (bare run
  อ่าน project instructions ไม่เห็น การตรวจของ host จึงเป็นการตรวจเดียว), host ตรวจผลทุกชิ้น
  ด้วยตัวเอง และ deny list กันการเริ่ม run ซ้อน
- description แบกหน้าที่จริง: มันดึงงานที่ใช่เข้ามาและกันงานที่ไม่ใช่ออก จึงต้องมี trigger evals
  ครบทั้ง should-trigger และ should-not-trigger เพื่อจับ regression ของถ้อยคำนี้
- การตัดสินใจนี้ครอบคลุมเฉพาะ `tokenme-agent` ที่ gateway run ของมันถูก one-shot และถูกตรวจ
  ส่วน `agy-agent` กับ `opencode-implement` คงค่า explicit-only ตามเดิม
