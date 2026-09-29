# Agy Agent

- Category / หมวด: `agents`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/agents/agy-agent/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

เปิดทางให้ AI harness ตัวอื่น (เช่น Claude Code, Cursor, Codex CLI, OpenCode, Aider ฯลฯ) สามารถสั่งงานและส่งต่อ (delegate) ภารกิจไปยัง **Antigravity CLI (`agy`)** เพื่อทำงานแบบ headless subagent ได้อย่างราบรื่น

การทำงานใช้สถาปัตยกรรม **Zero External Dependencies** ตามแนวทางของ `agy-implement` ทำงานผ่าน native shell และโปรโตคอล **File-Based I/O** โดยไม่ต้องติดตั้ง Python หรือ runtime เสริมใดๆ ช่วยประหยัด token/quota ของโมเดลหลัก และรองรับการเลือกโมเดล (Model Selection) ให้เหมาะกับแต่ละงาน พร้อมปลดล็อก **Context Window ขนาด 1,000,000+ tokens** ของ Gemini บน `agy`

Reference contract อ้างอิงจากเอกสารทางการ: <https://antigravity.google/docs/cli/headless/>

ติดตั้ง:

```bash
npx skills add ArrayaWongsaita/skills --skill agy-agent
```

### การเรียกใช้ (Invocation)

เรียกแบบชัดเจนเท่านั้น (explicit only) — skill นี้ dispatch headless agent พร้อมอนุมัติ tool ทั้งหมด จึงทำงานเมื่อผู้ใช้สั่งด้วยชื่อ:

- Slash command: `/agy-agent <task>`
- Codex: `$agy-agent <task>`
- ภาษาธรรมชาติ: "ใช้ agy", "delegate งานนี้ให้ agy", "ให้ antigravity ช่วยทำ"

`SKILL.md` ตั้ง `disable-model-invocation: true` และ `openai.yaml` ตั้ง `allow_implicit_invocation: false` — host จะไม่เรียก skill นี้เองโดยอัตโนมัติ

### การเลือกโมเดลให้เหมาะกับงาน (Model Selection)

Reasoning tier เป็นส่วนหนึ่งของ model slug (`-high` / `-medium` / `-low`) ใช้ `--effort` เฉพาะตอนที่ slug ไม่มี tier ที่ต้องการ — อย่าใส่คู่กับ slug ที่ระบุ tier อยู่แล้ว รัน `agy models` เพื่อยืนยัน slug ปัจจุบัน (สาย Flash เปลี่ยนเวอร์ชันบ่อย ให้ route ตาม tier ไม่ใช่เลขเวอร์ชัน)

| รูปแบบภารกิจ | Tier แนะนำ (slug ณ 2026-09-03) | เหตุผล |
|---|---|---|
| **สแกนโค้ดทั้ง Repo / อ่าน Log ยักษ์ (1M+ tokens)** | Flash / high — `gemini-3.8-flash-high` | Context กว้างมหาศาล ความเร็วสูง ประหยัด token |
| **งานวิเคราะห์บั๊กซับซ้อน / Concurrency / สถาปัตยกรรม** | Pro / high — `gemini-3.1-pro-high` | ใช้ Reasoning เชิงลึกในการไล่ logic ซับซ้อน |
| **งานกลไก / Boilerplate / Bulk Rename** | Flash / medium — `gemini-3.8-flash-medium` | ต้องการความเร็ว ทำงานตรงไปตรงมา ไม่เปลือง reasoning |
| **งานขอความเห็นที่สอง (Second Opinion)** | โมเดลคนละค่ายกับ host — `gemini-3.1-pro-high` เมื่อ host เป็น Claude, `claude-sonnet-4-6` เมื่อไม่ใช่ | ลด Confirmation Bias ด้วยโมเดลคนละค่าย |

### ควรใช้เมื่อไร

- ต้องการสำรวจ อ่าน หรือค้นหาข้อมูลใน codebase ทั้งโปรเจกต์ หรือวิเคราะห์ไฟล์ล็อก/stack trace ขนาดมหึมาที่เกินความจุ context ของโมเดลใน harness หลัก
- งานเขียนโค้ดเชิงกลไก (mechanical tasks) เช่น ทำ bulk rename, สร้าง boilerplate, แปลง type definitions, จัด formatting หรือเขียน docstring และ scaffold เทสต์
- ต้องการส่งต่องานไปยังโมเดลเฉพาะทาง เช่น ใช้ Pro tier วิเคราะห์ concurrency หรือใช้ Flash tier อ่านบริบทขนาดใหญ่
- ต้องการให้ subagent รันชุดคำสั่ง ทดสอบ build หรือรัน test suite แล้วสรุปผลลัพธ์ Pass/Fail กลับมา
- ผู้ใช้ระบุคำสั่งชัดเจน เช่น "ใช้ agy", "delegate งานนี้ให้ agy", "ให้ antigravity ช่วยทำ"

### ไม่ควรใช้เมื่อไร

- งานที่ต้องถามคำถามเจาะลึกเพื่อขอการตัดสินใจจากผู้ใช้โดยตรง (Interactive clarifications)
- งานแก้โค้ดเพียง 1-2 บรรทัดที่ harness หลักสามารถใช้เครื่องมือแก้ไขไฟล์ได้ในทันที (overhead จากการเปิด subagent จะช้ากว่า)
- งานที่ต้องอาศัยบริบทการสนทนาอย่างลึกซึ้งจากบทสนทนาก่อนหน้าในแชทหลัก โดยที่บริบทนั้นไม่ได้ถูกบันทึกไว้ในไฟล์หรือ prompt
- งานรัน execution waves ของ tracer-bullet tickets จาก `grill-to-tickets` (กรณีนี้ให้ใช้ `agy-implement` แทน)

### วิธีทำงานหลัก (File-Based I/O Protocol)

1. **เลือกโมเดลตามประเภทงาน**: ประเมินขนาด Context และความลึกของ Reasoning เพื่อกำหนด `--model` (และ `--effort` เฉพาะเมื่อจำเป็น)
2. **เขียน Prompt ลงไฟล์ชั่วคราว**:
   เขียนคำสั่งลง `/tmp/agy-prompts/<task-id>.md` โดยระบุ absolute path ทั้งหมด พร้อม acceptance criteria ที่วัดผลได้จริง (เพื่อป้องกันปัญหา Shell Escaping) หากต้องการผลลัพธ์แบบ machine-checkable ให้เขียน JSON schema ไว้ที่ `/tmp/agy-prompts/<task-id>.schema.json` แล้วส่งผ่าน `--json-schema`
3. **สั่งรัน `agy` ผ่าน Shell** (แยก stdout กับ stderr คนละไฟล์):
   ```bash
   agy -p "$(cat /tmp/agy-prompts/<task-id>.md)" \
     --model gemini-3.8-flash-high \
     --dangerously-skip-permissions \
     --output-format json \
     --print-timeout 15m \
     --disable-slash-commands \
     [--json-schema /tmp/agy-prompts/<task-id>.schema.json] \
     > /tmp/agy-logs/<task-id>.json \
     2> /tmp/agy-logs/<task-id>.err
   ```
   `--dangerously-skip-permissions` เป็นค่า default ของ skill นี้ (เพราะถูกสั่งแบบ explicit และงานมักต้องรัน test/build) — ถ้างานเป็น read-only analysis หรือไม่ไว้ใจ scope ของ prompt ให้เปลี่ยนเป็น `--sandbox --mode accept-edits`
4. **ตรวจผลลัพธ์และส่งต่องาน (Resume)**:
   - เช็ค exit code ก่อน (`0` สำเร็จ / `1` error / `2` validation error)
   - parse envelope แล้วตรวจ `status == "SUCCESS"` — ค่าอื่น (`ERROR`, `CANCELED`, `INTERRUPTED`, `INVALID`, `WAITING`, `RUNNING`) หรือ envelope หาย = failure ให้อ่าน field `error` และไฟล์ `.err`
   - ดึงเนื้อหาจาก `response` หรือ `structured_output` (เมื่อใช้ `--json-schema`)
   - หากต้องปรับปรุงงาน ใช้ resume ด้วย `conversation_id`:
     ```bash
     agy --conversation "<conversation_id>" \
       -p "$(cat /tmp/agy-prompts/<task-id>-followup.md)" \
       --dangerously-skip-permissions \
       --output-format json \
       --disable-slash-commands \
       > /tmp/agy-logs/<task-id>-followup.json \
       2> /tmp/agy-logs/<task-id>-followup.err
     ```

### ไฟล์ที่เกี่ยวข้อง

- `references/model-routing.md` — ตารางจับคู่ประเภทงานกับโมเดล และเกณฑ์การตัดสินใจ
- `references/agy-contract.md` — ข้อกำหนด CLI flag, permission modes, JSON envelope schema, exit codes
- `references/prompt-scaffold.md` — แม่แบบ prompt สำหรับงานสำรวจ repo, วิเคราะห์ log, งานกลไก, และ test & fix
- `references/multi-turn-workflow.md` — วงจรการ resume ด้วย conversation_id, verification gate, retry budget
- `evals/evals.json` — ชุดทดสอบพฤติกรรม 5 เคสตามมาตรฐาน benchmark
- `evals/trigger-evals.json` — เคสทดสอบการ trigger skill

---

## English / ภาษาอังกฤษ

### Purpose

Enable other AI harnesses (such as Claude Code, Cursor, Codex CLI, OpenCode, Aider, etc.) to seamlessly delegate tasks to a Google Antigravity subagent via the headless `agy` CLI.

Following the zero-dependency architecture of `agy-implement`, it relies solely on native POSIX shell and the **File-Based I/O Protocol** without external language runtimes. It preserves the host agent's context while enabling task-aware model routing and unlocking Gemini's massive **1M+ token context window**. Contract details follow the official reference: <https://antigravity.google/docs/cli/headless/>.

Install with:

```bash
npx skills add ArrayaWongsaita/skills --skill agy-agent
```

### Invocation

Explicit only — this skill dispatches a headless agent with blanket tool approval, so it runs when the human asks for it by name:

- Slash command: `/agy-agent <task>`
- Codex: `$agy-agent <task>`
- Natural language: "use agy", "delegate to agy", "ask antigravity to …"

`SKILL.md` sets `disable-model-invocation: true` and `openai.yaml` sets `allow_implicit_invocation: false` — the host will not auto-route to this skill.

### Task-Aware Model Selection

The reasoning tier is part of the model slug (`-high` / `-medium` / `-low`). Pass `--effort` only when the slug lacks the tier you want — not alongside a slug that already names it. Run `agy models` to confirm current slugs (the Flash line moves fast; route by tier, not version).

| Task Archetype | Recommended Tier (slug as of 2026-09-03) | Rationale |
|---|---|---|
| **Whole-Repo Survey / Massive Logs (1M+ tokens)** | Flash / high — `gemini-3.8-flash-high` | Vast context window, ultra-fast, quota-efficient |
| **Deep Reasoning / Complex Bugs / Concurrency** | Pro / high — `gemini-3.1-pro-high` | Multi-step logical depth for intricate root causes |
| **Fast Mechanical / Boilerplate / Bulk Rename** | Flash / medium — `gemini-3.8-flash-medium` | High throughput for straightforward transformations |
| **Cross-Provider Second Opinion** | A family different from the host — `gemini-3.1-pro-high` when the host is Claude, `claude-sonnet-4-6` when it is not | Reduces confirmation bias via an independent family |

### Use it when

- You need to ingest huge files, massive build logs, or survey an entire multi-package repository without overflowing the host agent's context window.
- Routing specific tasks to targeted tiers, such as the Pro tier for difficult concurrency debugging or a Flash tier for big context scans.
- Offloading mechanical, well-scoped tasks: bulk renames, boilerplate generation, interface migrations, docstrings, or test scaffolding.
- Running autonomous build, test, and verification tasks and reporting results back.
- Requesting an independent second-opinion review or analysis from another frontier model family.

### Do not use it when

- The task requires interactive clarification or dialogue with the human user.
- Trivial 1-2 line edits where calling an external CLI incurs more overhead than executing directly in the host harness.
- Tasks requiring subtle conversational context accumulated across numerous prior turns that are not captured in the filesystem.
- Multi-ticket wave execution from `grill-to-tickets` (use `agy-implement` instead).

### Core Workflow (File-Based I/O Protocol)

1. **Select Model & Tier**: Match the task profile against the model routing matrix; set `--model` (and `--effort` only when needed).
2. **Write Prompt to Temporary File**: Save instructions to `/tmp/agy-prompts/<task-id>.md` with absolute paths and verifiable acceptance criteria. For a machine-checkable return, write a schema to `/tmp/agy-prompts/<task-id>.schema.json` and pass `--json-schema`.
3. **Dispatch Headless `agy`** (stdout and stderr to separate files):
   ```bash
   agy -p "$(cat /tmp/agy-prompts/<task-id>.md)" \
     --model gemini-3.8-flash-high \
     --dangerously-skip-permissions \
     --output-format json \
     --print-timeout 15m \
     --disable-slash-commands \
     [--json-schema /tmp/agy-prompts/<task-id>.schema.json] \
     > /tmp/agy-logs/<task-id>.json \
     2> /tmp/agy-logs/<task-id>.err
   ```
   `--dangerously-skip-permissions` is this skill's default; swap it for `--sandbox --mode accept-edits` when the task is read-only or the prompt scope is broad.
4. **Verify and Resume**:
   - Check the exit code first (`0` success, `1` error, `2` validation error).
   - Parse the envelope and confirm `status == "SUCCESS"`. Any of `ERROR`, `CANCELED`, `INTERRUPTED`, `INVALID`, `WAITING`, `RUNNING`, or a missing envelope is a failure — read `error` and the `.err` file.
   - Extract `response`, or `structured_output` when a schema was enforced.
   - Resume via `agy --conversation <conversation_id>` if corrections are required.
