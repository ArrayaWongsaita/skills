# ADR 0025: tokenme-agent delegate runs are bare by default and planned against a 90k ceiling

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-10-02

## Context / บริบท

A delegate run pays a fixed overhead before it does any work. Measured on
2026-10-02: a trivial headless run costs 28,237 input tokens of fixed
overhead (about $0.14); the same run with `--bare` costs 1,142 tokens (about
$0.006); and `--bare` with an explicit allowed-tools list still edited a file
and ran a shell command, with no permission denials. Meanwhile the tokenme
settings file sets its compaction window (`autoCompactWindow`) at 90,000
tokens although the model context cap is 128,000, and a delegate run has no
host in the loop to recover whatever compaction drops mid-task.

delegate run มี fixed overhead ที่ต้องจ่ายก่อนทำงานอะไรเลย วัดเมื่อ 2026-10-02: headless run
ธรรมดาหนึ่ง run มี fixed overhead 28,237 input tokens (ประมาณ $0.14); run เดียวกันเมื่อใส่
`--bare` เหลือ 1,142 tokens (ประมาณ $0.006); และ `--bare` ที่ระบุ allowed-tools ชัด ๆ
ยังแก้ไฟล์และรัน shell command ได้ โดยไม่มีการปฏิเสธสิทธิ์เลย ในขณะเดียวกัน tokenme settings file
ตั้งหน้าต่าง compaction (`autoCompactWindow`) ไว้ที่ 90,000 tokens ทั้งที่ context cap ของโมเดล
คือ 128,000 และ delegate run ไม่มี host คอยอยู่ใน loop ที่จะกู้สิ่งที่ compaction ทิ้งไปกลางงานคืน

## Decision / การตัดสินใจ

1. Every delegate run is bare by default (`--bare`): no CLAUDE.md, no hooks,
   no skills, no MCP — every convention the task needs travels in the prompt
   text instead. A task that truly depends on project instructions a bare
   run cannot read may drop the flag; the host then adds about 28k tokens of
   overhead to the budget check before dispatch.
2. Every task is sized against a 60k-token planning budget — the task's
   footprint (file bytes ÷ 4 × 1.5) plus the run's fixed overhead (about 1k
   bare, about 28k not bare) — with 90k as the ceiling, the compaction
   setting in the tokenme settings file. The 128k window is not the planning
   number.
3. Oversized work is split into per-file or per-directory chunks that run as
   separate delegate runs; the split, not compaction, is what brings a task
   back inside the budget.

1. ทุก delegate run เป็น bare เป็นค่าเริ่มต้น (`--bare`): ตัด CLAUDE.md, hooks, skills และ
   MCP ออกหมด ข้อตกลงทุกอย่างที่งานต้องใช้เดินทางผ่าน prompt text แทน task ที่จำเป็นต้องใช้
   project instructions ที่ bare run อ่านไม่เห็นจริง ๆ จึงจะเลิกใช้ flag ได้ โดย host เพิ่ม overhead
   อีกประมาณ 28k tokens ลงในการตรวจงบก่อน dispatch
2. ทุก task ถูกคิดขนาดกับ planning budget 60k tokens — footprint ของงาน (file bytes ÷ 4 × 1.5)
   บวก fixed overhead ของ run (ประมาณ 1k เมื่อ bare, ประมาณ 28k เมื่อไม่ bare) — โดยมี 90k เป็น
   เพดาน ตามค่า compaction ใน tokenme settings file ส่วน window 128k ไม่ใช่ตัวเลขที่ใช้วางแผน
3. งานที่เกินงบถูกแบ่งเป็น chunk ต่อไฟล์หรือต่อ directory แล้วรันเป็น delegate run แยกกัน
   ตัวแบ่งต่างหากจาก compaction ต่างหาก คือสิ่งที่ดึง task กลับเข้ามาอยู่ในงบได้

## Rejected alternatives / ทางเลือกที่ปฏิเสธ

- Planning against the 128k window: the run starts compacting at 90k, far
  below 128k, and a compacting delegate run drops context no one is present
  to recover.
- Relying on compaction to absorb oversized tasks: compaction is a lossy
  recovery with no host watching; sizing and splitting happen before
  dispatch instead.
- Non-bare by default: measured on 2026-10-02 it pays about 28,237 tokens of
  fixed overhead per run instead of 1,142 — about 25 times — for project
  context the prompt can carry explicitly, which is what makes small
  mechanical tasks too expensive to delegate at all.

- วางแผนกับ window 128k: run เริ่ม compact ตั้งแต่ 90k ต่ำกว่า 128k มาก และ delegate run ที่
  กำลัง compact ทิ้ง context ไปโดยไม่มีใครอยู่เก็บคืน
- พึ่ง compaction ดูดงานที่เกินงบ: compaction เป็นการกู้คืนแบบสูญเสีย โดยไม่มี host คอยดู
  การคิดขนาดและการแบ่งจึงต้องเกิดก่อน dispatch แทน
- ไม่ใช้ bare เป็นค่าเริ่มต้น: วัดเมื่อ 2026-10-02 ต้องจ่าย fixed overhead ประมาณ 28,237 tokens
  ต่อ run แทนที่จะเป็น 1,142 — ราว 25 เท่า — เพื่อ project context ที่ prompt เขียนใส่ได้ชัด ๆ
  อยู่แล้ว ซึ่งทำให้งานกลไกชิ้นเล็กแพงเกินกว่าจะ delegate ได้เลย

## Consequences / ผลที่ตามมา

- A delegation costs about 1k tokens of overhead instead of about 28k, which
  is what makes small mechanical tasks worth delegating at all.
- Prompts are longer by design: every convention the task needs is written
  out in the prompt text, and the skill's prompt-scaffold templates exist to
  hold them.
- The budget numbers are defaults tied to the tokenme settings file: if its
  compaction setting moves from 90,000, the 60k planning budget and the 90k
  ceiling move with it.
- A task that genuinely needs project instructions keeps its escape hatch —
  drop `--bare` — at the measured price of adding about 28k tokens of
  overhead to its budget check.

- การ delegate หนึ่งครั้งมี overhead ประมาณ 1k tokens แทนที่จะเป็นประมาณ 28k ซึ่งเป็นเหตุผลว่า
  ทำไมงานกลไกชิ้นเล็กจึงคุ้มที่จะส่งออก
- prompt ยาวขึ้นโดยดีไซน์: ข้อตกลงทุกอย่างที่งานต้องใช้ถูกเขียนลง prompt text เต็ม ๆ และแม่แบบ
  prompt-scaffold ของ skill ก็มีไว้สำหรับเก็บสิ่งเหล่านี้
- ตัวเลขงบเป็นค่าเริ่มต้นที่ผูกกับ tokenme settings file: ถ้าค่า compaction ขยับจาก 90,000
  planning budget 60k และเพดาน 90k ก็ขยับตาม
- task ที่จำเป็นต้องใช้ project instructions จริง ๆ ยังมีทางออก — เลิกใช้ `--bare` —
  โดยแลกกับราคาที่วัดไว้คือ overhead อีกประมาณ 28k tokens ที่เพิ่มลงในการตรวจงบ
