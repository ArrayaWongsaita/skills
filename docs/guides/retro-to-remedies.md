# คู่มือการใช้งาน Skill: retro-to-remedies

- **หมวดหมู่ (Category):** `agents`
- **แหล่งติดตั้ง (Install Source):** `ArrayaWongsaita/skills`
- **ไฟล์นิยามหลัก (Definition):** [`skills/agents/retro-to-remedies/SKILL.md`](../../skills/agents/retro-to-remedies/SKILL.md)

---

## 1. retro-to-remedies คืออะไรและมีไว้สำหรับทำอะไร?

`retro-to-remedies` เป็น **Workflow Retrospective Skill** ที่ทำหน้าที่ปิดช่องว่างระหว่าง "บทเรียนที่บันทึกไว้ในระหว่างการทำฟีเจอร์" กับ "การปรับปรุงสภาพแวดล้อมการทำงาน (Environment)"

ในระหว่างที่ฟีเจอร์หนึ่งๆ ดำเนินการผ่านขั้นตอน `grill-to-tickets` → implementer → `review-to-pr` จะมีบันทึกสิ่งที่ผิดพลาดหรือสิ่งที่ต้องปรับปรุงเกิดขึ้นเสมอ (เช่น blocking findings ใน `review-status.md`, ข้อผิดพลาดหรือ incident ใน `status.md`, การ rework ใน `design-review.md`) หากไม่มีขั้นตอนนี้ บทเรียนเหล่านั้นจะค้างอยู่ใน `.scratch/` และจางหายไป ทำให้การทำงานในรอบถัดไปพบกับปัญหาเดิมซ้ำอีก

`retro-to-remedies` เข้ามาอ่าน Primary sources เหล่านั้น และแปลงสิ่งที่ผิดพลาด (Misses) ให้เป็นมาตรการแก้ไข (Remedies) ที่ชัดเจน 6 ชนิด:
1. **Check**: สร้างกฎตรวจสอบแบบอัตโนมัติ (deterministic check เช่น test, lint rule, CI job) สำหรับ Mechanical miss
2. **Standard**: บันทึกมาตรฐานใหม่ลงใน `CODING_STANDARDS.md` หรือ Reuse Catalog สำหรับ Judgement miss
3. **Pointer**: เพิ่มการนำทางเอกสารลงใน `AGENTS.md`
4. **Skill fix**: ปรับปรุงคำสั่งของ skill ที่มีข้อผิดพลาด
5. **Prune**: ลบคำสั่งหรือเอกสารที่หมดอายุและไม่ส่งผลต่อพฤติกรรมของ agent
6. **Access**: เพิ่มการเข้าถึงข้อมูลที่ agent ขาดไป (เช่น logs, permissions)

---

## 2. ตำแหน่งในลำดับการทำงาน (Workflow Chain)

`retro-to-remedies` วางตัวอยู่ในขั้นตอนสำคัญของ engineering pipeline:

```text
review-to-pr ──► retro-to-remedies ──► pr-to-dev
```

- **รับช่วงต่อจาก `review-to-pr`**: เมื่อการรีวิวโค้ดสองแกนผ่านพ้นและชุดทดสอบเขียวทั้งหมดแล้ว `review-to-pr` จะแนะนำให้เรียกใช้ `/retro-to-remedies`
- **ส่งต่อไปยัง `pr-to-dev`**: หลังจาก Text remedies ถูก commit ลงบน integration branch และ Code remedies ถูกแปลงเป็น prompt ส่งมอบแล้ว ผู้ใช้จึงรัน `/pr-to-dev` เพื่อเปิด Pull Request ต่อไป ทำให้ Pull Request นั้นแบกรับทั้งตัวฟีเจอร์และบทเรียนที่ได้จากฟีเจอร์นั้นไปพร้อมกัน

---

## 3. วิธีการเรียกใช้งาน (Invocation)

เรียกใช้งานผ่านคำสั่ง:

```text
/retro-to-remedies [<feature-slug>] [--transcript] [--fresh]
```

หรือใช้ Codex shortcut:

```text
$retro-to-remedies
```

### การระบุ Feature Slug

ลำดับความสำคัญในการหา Feature Slug:
1. **Argument**: ใช้ `<feature-slug>` ที่ระบุในคำสั่งโดยตรง
2. **Integration branch stem**: สกัดชื่อ slug จากชื่อ branch ปัจจุบัน เช่น `subagent-implement/<slug>`
3. **Directory ใน `.scratch/`**: หา directory ใน `.scratch/*/` ที่แก้ไขล่าสุด และถามยืนยันกับผู้ใช้ก่อนทำงาน

### กฎความปลอดภัยของ Branch

Skill นี้ปฏิเสธการทำงานบน branch `main`, `master`, หรือ `dev` โดยเด็ดขาด หากพบว่าอยู่บน branch ดังกล่าว จะหยุดการทำงานทันทีโดยไม่อ่านไฟล์ใดๆ และแนะนำชื่อ branch ที่ควรสร้างให้ผู้ใช้

---

## 4. ขั้นตอนการทำงานและ Primary Sources ที่อ่าน (Stages)

### Stage 0 — Collect (read-only)

Stage 0 ทำหน้าที่รวบรวมหลักฐานทั้งหมดจาก Run โดย **อ่านอย่างเดียว (read-only) และไม่แก้ไขไฟล์ run-state ใดๆ ทั้งสิ้น**:
- **`docs/retro-log.md` (เมื่อมีไฟล์อยู่)**: อ่านก่อนการอ่าน Primary sources เพื่อติดตามผล (follow-up) สำหรับแต่ละ Remedy ที่ยังอยู่ในสถานะ `handed-off` หนึ่งครั้ง:
  - `done` → `applied` (ผู้ใช้ยืนยันว่าการเปลี่ยนแปลงถูกนำไปปรับใช้ใน Environment เรียบร้อยแล้ว)
  - `still pending` → คงสถานะ `handed-off` (ยังคงรอดำเนินการอยู่)
  - `drop` → `declined` (ตัดสินใจไม่ทำต่อ)
- **`review-status.md`**: อ่าน blocking findings ทั้งหมด, carried findings (status `open` และ non-blocking), findings ที่ `unfixable` หรือ `stalled`, และ budget รอบรีวิวที่เกิน 1 cycle
- **Implementer `status.md`**: ตั๋วที่ต้อง retry (attempts > 1), ตั๋วที่ติด `BLOCKED`, และบทเรียนทั้งหมดใน notes (harness notes, gotchas, incidents)
- **Implementer reports หรือ logs** (`reports/<NN>.md`, `logs/<NN>.json`, `logs/<NN>.jsonl`): ข้อผิดพลาดในการ verify (verification failures) พร้อมสาเหตุ
- **`design-review.md`**: ทุกรอบที่ไม่ได้รับคำตัดสิน `SHIP` พร้อมระบุประเภท `REWORK`
- **Git history**: ประวัติ commit บน integration branch ได้แก่ `fix(review):` commits และ reverts นับตั้งแต่ `review_point` หรือ merge-base กับ `main`
- **Session transcript**: อ่านเฉพาะเมื่อระบุ `--transcript` หรือเมื่อไม่พบ directory `.scratch/<feature-slug>/` (ซึ่งจะถามยืนยันกับผู้ใช้ก่อนอ่าน)

หากพบว่ามี expected sources ใดที่ขาดหายไป (เช่น Run ที่ผ่าน upstream `/implement` ไม่มี `status.md`) Stage 0 จะบันทึกและแสดงรายชื่อไฟล์ที่ขาดหายไปไว้ในส่วนเปิดของรายงาน และทำงานต่อไปด้วยข้อมูลเท่าที่มีอยู่ เกณฑ์เสร็จสิ้นของ Stage 0 คือ: แหล่งข้อมูลที่มีอยู่ทั้งหมดถูกอ่าน และ Misses ทุกตัวระบุพิกัดที่มา (location: file, id/line/SHA) พร้อมข้อความยกมาตรงตัว (verbatim quote)

### Stage 1 — Classify and report

Stage 1 ทำหน้าที่นำ Misses ทั้งหมดมาประมวลผลเป็นมาตรการปรับปรุงสภาพแวดล้อม (Environment Remedies):
- **จับคู่กับ Retro Log ก่อนการจำแนก (Matching Against the Log)**:
  - **Same-Occurrence Rule**: Miss ที่ระบุ slug และ location อยู่แล้วใน log ถือเป็นเหตุการณ์เดิม (same occurrence) ไม่นับเป็น recurrence เช่น การรัน Retro ซ้ำใน Run เดิมหลังจากบันทึก log ไปแล้ว จะไม่นับ Misses เดิมเป็นการเกิดซ้ำ
  - **Recurrence**: การเกิดซ้ำ คือ Miss ที่มาจาก Run อื่น หรือเกิดขึ้นหลังจาก commit ของ Remedy ใน Run เดียวกัน
  - **Failed Remedy Escalation**: หาก Miss ที่เกิดซ้ำตรงกับ Remedy ที่เคย `applied` แล้ว จะถือเป็น Failed Remedy และยกระดับไปสู่ชนิดที่เข้มงวดขึ้น:
    - Standard → Check สำหรับกฎที่เป็น mechanical
    - Pointer → ปรับถ้อยคำให้ชัดเจนขึ้น (sharper wording) แล้ว inline เนื้อหา
    - Check หรือ Skill fix → เสนอ follow-up ชนิดเดิมที่อ้างอิงการเกิดซ้ำ
  - **The Declined Rule**: Remedy ที่เคยถูก `declined` จะถูกเสนอขึ้นมาใหม่ก็ต่อเมื่อ Miss นั้นเกิดซ้ำขึ้นมาอีกครั้งหลังจากการ decline เท่านั้น โดยจะแสดงทั้งสองเหตุการณ์ (both occurrences: เหตุการณ์เดิมและเหตุการณ์ใหม่ที่เกิดซ้ำ) เป็นหลักฐาน หากไม่มีการเกิดซ้ำใหม่หลังจากการ decline จะไม่ถูกเสนอขึ้นมาอีก
- **รวมสาเหตุและตัดข้อเสนอที่ไม่มีหลักฐาน (Evidence Bar)**: รวม Misses ที่แชร์สาเหตุเดียวกันเข้าด้วยกันเป็นหนึ่ง Remedy และตัดข้อเสนอใดๆ ที่ไม่มีข้อความยกมาตรงตัว (verbatim quote) และตำแหน่งพิกัด (location) ออกจากรายงานโดยสิ้นเชิง
- **กฎการจำแนกตามลำดับ (Ordered Rule)**: จำแนกประเภท Remedy ตามกฎ 6 ข้อตามลำดับ:
  1. หากการทำตามคำสั่งของ skill ตรงตัวทำให้เกิด Miss เพราะคำสั่งผิดหรือล้าสมัย → **Skill fix** (แต่หาก agent เบี่ยงเบนจากคำสั่งที่ถูกต้อง จะตกไปยังกฎข้อถัดไปเพื่อสร้าง Check)
  2. กฎตายตัวสามารถตรวจจับได้ (Mechanical miss) → **Check** (test, lint rule, hook, CI)
  3. ต้องใช้การตัดสินใจเจตนาของมนุษย์ (Judgement miss) → **Standard** ใน `CODING_STANDARDS.md` หรือกฎใน Reuse Catalog สำหรับ reuse convention
  4. ใช้ความพยายามในการค้นหาเอกสาร/ไฟล์ → **Pointer** ใน `AGENTS.md`
  5. ขาดแคลนข้อมูลที่เข้าถึงไม่ได้ (เช่น logs, permission) → **Access**
  6. คำสั่งในโปรเจกต์หมดอายุหรือไม่ส่งผล → **Prune** (จำกัดเฉพาะ `AGENTS.md`, `CLAUDE.md`, `CODING_STANDARDS.md` และ Reuse Catalog)
- **การจัดลำดับตามความสำคัญ (Ranking Order)**: เรียงลำดับความสำคัญโดยนำ Failed Remedy ขึ้นก่อน → ตามด้วย Recurring Remedy → ตามด้วยต้นทุนสูง (review blocker, BLOCKED ticket, failed verification, รอบที่ไม่ได้ SHIP) → ข้อเสนออื่นๆ
- **Carried findings และ Open bugs**: นำ Carried findings จาก `review-status.md` ทุกข้อมาจับคู่กับ Remedy หรือ proposed decline (ไม่ปล่อยให้ค้างโดยไร้คำตอบ) และแยก defect ของโค้ดฟีเจอร์เป็น Open bugs สำหรับ `/diagnosing-bugs` เท่านั้น (ไม่ถือเป็น Remedy)
- **โครงสร้างรายงานและคำตอบ 4 แบบ**: เขียนรายงานลง `.scratch/<feature-slug>/retro.md` เรียงตาม 6 ส่วน (sources read/missing, handed-off follow-ups, project Remedies, Skill fixes, Carried findings, Open bugs) จากนั้นหยุดพัก (pause) รอให้ผู้ใช้ตอบคำถาม 4 ตัวเลือก:
  - `apply`: อนุมัติให้นำ Text remedies (Standard, Pointer, Prune) ไปแก้ไขและ commit ลง branch
  - `hand off`: ส่งมอบ Code remedies (Check, Skill fix, Access) ไปเป็น prompt สำหรับ `/grill-to-tickets`
  - `decline`: ปฏิเสธมาตรการแก้ไข
  - `defer`: เลื่อนการตัดสินใจออกไปก่อน

### Stage 2 — Apply and hand off

เมื่อผู้ใช้เลือกคำตอบในรายงาน Retro report เรียบร้อยแล้ว Stage 2 จะดำเนินการดังนี้:
- **การนำ Text remedies ไปปรับใช้ตามปลายทาง**:
  - **Standard**: บันทึกลง `CODING_STANDARDS.md` (หากยังไม่มีไฟล์ จะสร้างขึ้นมาใหม่พร้อม short header) หรือลงในหมวด Rules ของ Reuse Catalog หากเป็น reuse convention
  - **Pointer**: บันทึกบรรทัดนำทางลงใน `AGENTS.md` (หากไม่มีให้ลง `CLAUDE.md`, หากไม่มีทั้งคู่ให้สร้าง `AGENTS.md` ใหม่)
  - **Prune**: ลบบรรทัดคำสั่งที่ล้าสมัยออกจาก instruction file ที่ถืออยู่ (`AGENTS.md`, `CLAUDE.md`, `CODING_STANDARDS.md`, หรือ Reuse Catalog)
- **กฎ 1 Commit ต่อ 1 Remedy และการบันทึก Retro Log**: commit การเปลี่ยนแปลง Text remedies แต่ละข้อที่อนุมัติลงบน working branch แยกจากกันเป็น `chore(retro): <remedy>` (สามรายการที่อนุมัติจะได้ 3 commits) พร้อมกับ entry ของ Remedy นั้นใน `docs/retro-log.md` ใน commit เดียวกัน และบันทึก SHA ของแต่ละ commit กลับลงในรายงาน Retro report ส่วนผลลัพธ์อื่นๆ ทั้งหมดจะถูก commit ใน commit สุดท้าย `chore(retro): log <feature-slug>`
- **รัน Check Scripts หนึ่งรอบ**: รัน script ตรวจสอบที่มีอยู่ในโปรเจกต์ (`validate`, `check`, `lint`, `test`) อย่างละหนึ่งรอบ หากมีคำสั่งใดล้มเหลว (ผลเป็นสีแดง) จะหยุดทำงานทันทีก่อนเข้าสู่ handoff พร้อมระบุชื่อคำสั่งที่ล้มเหลวและ commit ที่ตามหลัง
- **การส่งมอบ (Handoff)**: แสดง ready-to-run prompt สำหรับ Code remedies (เช่น `/grill-to-tickets` สำหรับ Check, Skill fix, Access) ที่ตอบรับด้วย `hand off` (รายการเหล่านี้จะไม่ถูก apply หรือ commit ในรอบนี้) จากนั้นพิมพ์ `/pr-to-dev` เป็นขั้นตอนถัดไป โดยการรันจะไม่ทำการ `git push`, ไม่เปิด pull request, และเปิด GitHub issue เฉพาะเมื่อผู้ใช้ร้องขออย่างชัดเจนเท่านั้น

---

## 5. การบันทึกผลอย่างถาวรใน Retro Log (`docs/retro-log.md`)

ทุกๆ Run ของ Retro จะทิ้งบันทึกถาวรไว้ใน `docs/retro-log.md` ประจำโปรเจกต์ ซึ่งมีคุณสมบัติดังนี้:
- **สร้างขึ้นในการรัน Retro ครั้งแรก**: หากยังไม่มีไฟล์ Retro แรกจะสร้าง `docs/retro-log.md` พร้อม self-describing header comment เพื่ออธิบาย entry format, สถานะของ Outcome, และ id rule
- **อ่านโดย Retro เท่านั้น**: เฉพาะ Retro เท่านั้นที่อ่านไฟล์นี้เพื่อตรวจสอบ recurrence และหลีกเลี่ยงการเสนอ Remedy ที่เคยถูกปฏิเสธซ้ำ ดังนั้นจึงไม่มีการเพิ่ม Pointer ชี้ไปยัง Retro Log ใน `AGENTS.md` หรือ `CLAUDE.md` เพื่อไม่ให้เปลือง context ของ agent ในการทำงานทั่วไป
- **Id Rule**: แต่ละ Remedy จะได้รับ id ในรูปแบบ `R-<feature-slug>-<NN>` โดยกำหนดหมายเลขลำดับภายใน Run ที่เสนอ Remedy นั้นเป็นครั้งแรก และ id นี้จะไม่เปลี่ยนแปลงตลอดไป ทำให้ parallel feature branches ไม่มีวันสร้าง id ซ้ำกัน
- **สถานะ Outcomes ทั้ง 4**:
  - `applied`: มาตรการถูกนำไปปรับใช้แล้วจริง (ไม่ว่าจะโดย Retro ทำทันที หรือได้รับการยืนยันว่าเสร็จสิ้นหลังจาก hand off)
  - `handed-off`: มาตรการประเภท Code remedy ได้รับการส่งมอบเป็น prompt แล้ว แต่ยังไม่ได้รับการยืนยันว่าเสร็จสิ้น
  - `declined`: ผู้ใช้ปฏิเสธมาตรการแก้ไข
  - `deferred`: ผู้ใช้เลื่อนการตัดสินใจออกไปก่อน
- **กฎการ Commit (Two Commit Rules)**:
  1. Remedy ที่ถูก `applied` จะถูกบันทึก entry ลงใน `docs/retro-log.md` ภายใน commit เดียวกันกับการเปลี่ยนแปลงไฟล์ของ Remedy นั้นเป็น `chore(retro): <remedy>`
  2. ผลลัพธ์อื่นๆ ทั้งหมด (`handed-off`, `declined`, `deferred`) จะถูกบันทึกลงใน commit สุดท้ายเพียงหนึ่ง commit คือ `chore(retro): log <feature-slug>` เพื่อให้ log บันทึกผลลัพธ์ครบถ้วนแม้จะไม่มี Remedy ใดถูก apply ในรอบนั้นก็ตาม
- **การเรียนรู้ข้าม Run (Cross-Run Learning)**:
  - ใน Stage 0 มีการถามติดตามผลของ `handed-off` Remedies (done → `applied`, still pending → `handed-off`, drop → `declined`)
  - ใน Stage 1 มีการจับคู่กับ log: ตรวจสอบ same-occurrence, ตรวจจับ recurrence (ซึ่งทำให้ `applied` กลายเป็น Failed Remedy และยกระดับมาตรการ), และเคารพการ decline โดยจะเสนอใหม่เฉพาะเมื่อมี Miss เกิดซ้ำหลังการ decline พร้อมแสดงทั้งสองเหตุการณ์


