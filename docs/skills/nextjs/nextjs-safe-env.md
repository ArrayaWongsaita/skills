# Next.js Safe Env

- Category / หมวด: `nextjs`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/nextjs/nextjs-safe-env/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

ใช้ตั้งค่า audit refactor และ debug environment variables ใน Next.js ให้ type-safe ด้วย schema ที่แยก client/server และรักษาขอบเขต React Server Component อย่างเคร่งครัด

### ควรใช้เมื่อไร

- สร้างหรือปรับปรุง env modules ที่ใช้ Zod
- เพิ่ม เปลี่ยนชื่อ หรือจัดประเภทตัวแปร environment
- ตรวจ `process.env` ที่เข้าถึงผิดฝั่ง client/server
- แก้ missing-env, `server-only` import หรือ build/runtime timing
- ตัดสินใจระหว่าง eager validation กับ lazy runtime validation
- ตรวจ App Router, Pages Router, Middleware หรือ tooling ที่โหลด env ต่างกัน

### ไม่ควรใช้เมื่อไร

ไม่ควรใช้เพื่อเปิดเผย secret ให้ browser, แก้ boundary error ด้วยการเติม `NEXT_PUBLIC_` แบบไม่ตรวจ exposure หรือเปลี่ยน env library เดิมโดยไม่มี scope ชัดเจน

### วิธีทำงานหลัก

```text
Inspect -> Classify values -> Trace consumers -> Choose validation timing -> Implement -> Verify
```

หลักสำคัญคือให้ client module อ่านเฉพาะ public values แบบ static, ให้ server module มี `server-only`, ไม่ส่ง config object ที่มี secret ข้าม boundary และตรวจว่า env พร้อมตอน build หรือ runtime ก่อนเลือกเวลาของ validation

### ตัวอย่าง prompt

```text
Audit this Next.js app's process.env usage. Classify every variable, identify client-reachable imports, and propose split client/server Zod modules without printing any secret values.
```

### ติดตั้ง

ติดตั้งเฉพาะ skill นี้:

```bash
npx skills add ArrayaWongsaita/skills --skill nextjs-safe-env
```

ติดตั้งทั้งหมวด `nextjs` (ปัจจุบันมี skill นี้เป็นสมาชิกเดียว):

```bash
npx skills add ArrayaWongsaita/skills --skill nextjs-safe-env
```

### ไฟล์ที่เกี่ยวข้อง

- `references/env-patterns.md` — patterns สำหรับ schema, timing และ runtime boundary
- `SKILL.md` — workflow และ guardrails ฉบับเต็ม

## English / ภาษาอังกฤษ

### Purpose

Use this skill to set up, audit, refactor, and debug type-safe environment variables in Next.js with split client/server schemas and strict React Server Component boundaries.

### Use it when

- Creating or refactoring Zod-backed env modules
- Adding, renaming, or classifying environment variables
- Auditing `process.env` access across client and server boundaries
- Fixing missing-env, `server-only`, or build/runtime timing errors
- Choosing eager validation versus lazy runtime validation
- Reasoning about App Router, Pages Router, Middleware, or external tooling

### Do not use it when

Do not use it to expose secrets to browsers, fix a boundary error by blindly adding `NEXT_PUBLIC_`, or replace an existing env library without explicit scope.

### Main workflow

```text
Inspect -> Classify values -> Trace consumers -> Choose validation timing -> Implement -> Verify
```

Keep client modules limited to statically accessed public values, mark server modules `server-only`, never pass secret-bearing config objects across boundaries, and choose validation timing from evidence about when the deployment provides environment variables.

### Example prompt

```text
Audit this Next.js app's process.env usage. Classify every variable, identify client-reachable imports, and propose split client/server Zod modules without printing any secret values.
```

### Install

Install only this skill:

```bash
npx skills add ArrayaWongsaita/skills --skill nextjs-safe-env
```

Install the `nextjs` category (currently containing this one skill):

```bash
npx skills add ArrayaWongsaita/skills --skill nextjs-safe-env
```

### Related files

- `references/env-patterns.md` — schema, timing, and runtime-boundary patterns
- `SKILL.md` — the complete workflow and guardrails
