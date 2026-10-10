# Grill to Tickets

- Category / หมวด: `agents`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/agents/grill-to-tickets/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

พา idea เดียวจากการสัมภาษณ์ไปจนถึง ticket ที่เผยแพร่แล้ว ด้วยคำสั่งเดียว แล้ว **หยุด** โดยทำตาม skill ของ upstream ที่ติดตั้งไว้ใน context เดียว: สัมภาษณ์ด้วย `grill-with-docs`, เขียน spec ด้วย `to-spec`, ให้ `scrutinize` รีวิว spec ที่เผยแพร่แล้วหนึ่งรอบ แล้วแตก ticket ด้วย `to-tickets` skill นี้ไม่มี format ของ spec หรือ ticket เป็นของตัวเอง จึงใช้ได้ทั้ง Tracker แบบ local และ remote และไม่ลงมือ implement

ติดตั้ง:

```bash
npx skills add ArrayaWongsaita/skills --skill grill-to-tickets
```

ต้องติดตั้ง skill ของ upstream ด้วย:

```bash
npx skills add mattpocock/skills --skill grill-with-docs
npx skills add mattpocock/skills --skill grilling
npx skills add mattpocock/skills --skill domain-modeling
npx skills add mattpocock/skills --skill to-spec
npx skills add mattpocock/skills --skill to-tickets
npx skills add thananon/9arm-skills --skill scrutinize
```

ตอนเริ่ม **Preflight** จะหา `SKILL.md` ของทั้งหกตัวใน `.agents/skills/`, `.claude/skills/`, `~/.agents/skills/` และ `~/.claude/skills/` ตามลำดับ ถ้าขาดตัวไหนจะหยุดและพิมพ์คำสั่งติดตั้งของตัวนั้น ถ้า project ไม่มี `docs/agents/issue-tracker.md` จะหยุดและชี้ไปที่ `setup-matt-pocock-skills`

### ควรใช้เมื่อไร

- มี idea ใหม่และอยากได้ spec กับ ticket ที่ผ่านการรีวิวจากคนนอกก่อนเริ่มเขียนโค้ด
- อยากรัน flow วางแผนของ upstream ครบด้วยคำสั่งเดียว

### ไม่ควรใช้เมื่อไร

- ถ้าต้องการแค่ขั้นเดียว เรียก `/grill-with-docs`, `/to-spec`, `/scrutinize` หรือ `/to-tickets` ตรง ๆ

### วิธีทำงานหลัก

เรียก `/grill-to-tickets <idea>` หรือ `$grill-to-tickets <idea>` (รับเฉพาะ idea ไม่มี flag) จากนั้น:

1. **สัมภาษณ์**: ทำตาม `grill-with-docs`; ก่อนเริ่มอ่าน domain doc ของ project (ถ้ามี) แล้วเขียนคำศัพท์และ ADR ตามที่ doc นั้นระบุ
2. **Spec**: ทำตาม `to-spec` รวมถึงการเช็ก test seam กับผู้ใช้ แล้วเผยแพร่ไปที่ Tracker
3. **รีวิว**: subagent ใหม่หนึ่งตัวรัน `scrutinize` โดยอ่าน spec จาก Tracker และไม่แก้อะไร ผู้ใช้เห็นทุก finding แล้วเลือกเองว่าจะแก้ข้อไหน ไม่มีรอบจำกัดและไม่มีรีวิวซ้ำอัตโนมัติ ส่วน fix ที่เลือกจะถูกใส่ใน spec ที่เผยแพร่ (ไฟล์เมื่อเป็น local; body หรือ comment เมื่อเป็น remote) ถ้าไม่มี subagent จะรีวิวใน context หลักและบอกผู้ใช้
4. **Ticket**: ส่ง reference ของ spec ที่เผยแพร่ให้ `to-tickets` เป็น source
5. **Handoff**: พิมพ์ reference ของ spec, ของ ticket และคำสั่งถัดไป (`/clear` แล้ว `/implement-tickets <spec reference>`)

### ตัวอย่าง prompt

```text
/grill-to-tickets เพิ่มการตั้งค่าขนาดฟอนต์ subtitle ในหน้า player settings ให้ผู้ใช้ปรับเองได้และจำค่าไว้ต่อเครื่อง
```

### ไฟล์ที่เกี่ยวข้อง

- `agents/openai.yaml` — metadata สำหรับ Codex โดยปิด implicit invocation
- `evals/` — trigger evals และ scenario evals

## English / ภาษาอังกฤษ

### Purpose

Carry one idea from an interview to published tickets in one command, then **stop**. The skill follows the installed upstream skills in one context: the `grill-with-docs` interview, `to-spec`, one `scrutinize` review of the published spec, then `to-tickets`. It owns no spec or ticket format, so it works with a local or a remote Tracker, and it never implements.

Install:

```bash
npx skills add ArrayaWongsaita/skills --skill grill-to-tickets
```

Install the upstream skills it follows:

```bash
npx skills add mattpocock/skills --skill grill-with-docs
npx skills add mattpocock/skills --skill grilling
npx skills add mattpocock/skills --skill domain-modeling
npx skills add mattpocock/skills --skill to-spec
npx skills add mattpocock/skills --skill to-tickets
npx skills add thananon/9arm-skills --skill scrutinize
```

**Preflight** looks for the six `SKILL.md` files in `.agents/skills/`, `.claude/skills/`, `~/.agents/skills/`, then `~/.claude/skills/`. A missing one stops the run with its install line. A project without `docs/agents/issue-tracker.md` stops the run and is pointed to `setup-matt-pocock-skills`.

### Use it when

- You have a new idea and want a spec and tickets that an outside reader has checked before any code is written.
- You want the whole upstream planning flow from one command.

### Do not use it when

- You need only one stage. Call `/grill-with-docs`, `/to-spec`, `/scrutinize`, or `/to-tickets` directly.

### Main workflow

Call `/grill-to-tickets <idea>` or `$grill-to-tickets <idea>`. It takes an idea and nothing else.

1. **Interview**: follow `grill-with-docs`. Before it starts the skill reads the project's domain doc when there is one and writes glossary terms and ADRs where that doc says.
2. **Spec**: follow `to-spec`, including its seam check with you, and publish the spec to the Tracker.
3. **Review**: one fresh subagent runs `scrutinize`, reads the spec from the Tracker, and edits nothing. You see every finding and choose which to fix; there is no round budget and no automatic second review. Chosen fixes go into the published spec: the file for a local Tracker; the body, or a comment when the tool cannot edit a body, for a remote one. Without subagents the review runs in the main context and the run says so.
4. **Tickets**: pass the published spec reference to `to-tickets` as its source.
5. **Handoff**: print the spec reference, the ticket references, and the next commands (`/clear`, then `/implement-tickets <spec reference>`).

### Example prompt

```text
/grill-to-tickets Add a subtitle font-size preference to the player settings panel, remembered per device.
```

### Related files

- `agents/openai.yaml`: Codex metadata with implicit invocation off.
- `evals/`: trigger evals and scenario evals.
