# คู่มือการติดตั้งและใช้งาน Skill: tokenme-agent

- **หมวดหมู่ (Category):** `agents`
- **แหล่งติดตั้ง (Install Source):** `ArrayaWongsaita/skills`
- **ไฟล์นิยามหลัก (Definition):** [`skills/agents/tokenme-agent/SKILL.md`](../../skills/agents/tokenme-agent/SKILL.md)

---

## 1. tokenme-agent คืออะไรและมีไว้สำหรับทำอะไร?

`tokenme-agent` เป็น Skill ส่งต่องาน (Delegation Skill) ที่ให้ AI agent ยก subtask ที่เป็น **งานกลไก (mechanical)** และ **self-contained** ไปรันบน headless tokenme run ที่ถูกกว่า แทนการเผา context และ quota ของ host model โดย host ยังคงเป็นเจ้าของการตัดสินใจ คัดกรองว่างานไหนส่งได้ และตรวจผลทุกชิ้นด้วยตัวเองก่อนรายงานว่าเสร็จ

### จุดประสงค์หลักและคุณสมบัติเด่น

1. **ประหยัด context และ quota ของ host:** โยนงานกลไก — bulk rename, boilerplate, mechanical formatting, lint-and-report, สรุป log — ไปรันนอกบ้าน ทำให้ host เก็บ context ไว้กับงานที่ต้องใช้ดุลพินิจ
2. **คุมงบด้วย planning budget:** ทุก task ถูกคิดขนาดกับ planning budget 60k tokens (footprint บวก fixed overhead ของ run) โดยมีเพดาน 90k tokens ตามค่า compaction ใน tokenme settings file — window 128k ของโมเดลไม่ใช่ตัวเลขที่ใช้วางแผน งานที่เกินงบถูกแบ่งเป็น chunk ต่อไฟล์หรือต่อ directory แล้วรันเป็น delegate run แยกกัน
3. **bare run เป็นค่าเริ่มต้น:** ทุก delegate run เริ่มด้วย `--bare` ซึ่งตัด CLAUDE.md, hooks, skills และ MCP ออก เหลือ fixed overhead ประมาณ 1k tokens แทนประมาณ 28k tokens (วัดจริงเมื่อ 2026-10-02: 28,237 → 1,142 tokens) ข้อตกลงทุกอย่างที่งานต้องใช้ถูกเขียนลงใน prompt เสมอ เพราะ bare run อ่าน project instructions ไม่เห็น
4. **host เป็นผู้ตรวจงานเสมอ:** run นับว่าสำเร็จเมื่อ envelope ผ่าน result gate (`is_error` false, `subtype` success, `terminal_reason` completed, exit code เป็นศูนย์) และ tree หลังรันเทียบกับ baseline ก่อน dispatch แล้วมีแค่ไฟล์ที่ prompt ระบุเปลี่ยน จบด้วยการรัน test/build/lint เอง — สรุปผลของ run เป็นแค่ claim ที่ต้องตรวจ ไม่ใช่หลักฐาน
5. **โมเดลไม่ถูก hardcode:** โมเดลที่รับงานคือโมเดลที่ tokenme settings file กำหนด skill ทั้งชุดไม่มีชื่อหรือเวอร์ชันโมเดลใดเลย จึงไม่ต้องแก้เมื่อ gateway เปลี่ยนโมเดล

---

## 2. การพึ่งพา Skill อื่น (Dependencies) และการติดตั้ง

### พึ่งพา Skill อะไรบ้าง?

- **ไม่มีการพึ่งพา Skill ภายนอก (Zero External Skill Dependencies)**

### ซอฟต์แวร์และเครื่องมือที่ต้องมีในเครื่อง (System Prerequisites)

1. **คำสั่ง tokenme:** zsh alias `claude-tokenme` (คือ base command พร้อม `--settings ~/.claude/settings-tokenme.json`) สำหรับ shell ที่ alias ไม่ expand เช่น non-interactive shell หรือ Codex session ให้ใช้รูป expanded ตรง ๆ แทน — skill จะ preflight หาทั้งสองรูปก่อน dispatch แรกเสมอ ถ้าไม่มีทั้งสองรูป skill จะหยุดและให้คำแนะนำตั้งค่าครั้งเดียวแทนการส่งงานออกไป
2. **Allow rules ใน harness settings:** เพิ่ม `Bash(claude-tokenme:*)` และ `Bash(claude --settings:*)` ลงใน allow rules (เช่นใน `~/.claude/settings.json`) เพื่อให้ run เริ่มได้โดยไม่ติด permission prompt

### คำสั่งติดตั้ง

```bash
npx skills add ArrayaWongsaita/skills --skill tokenme-agent
```

---

## 3. วิธีการใช้งานและขั้นตอนการทำงาน (Usage & Workflow)

### คำสั่งเรียกใช้งาน (Invocation)

skill นี้เป็น model-invocable — agent จะหยิบไปใช้เองเมื่อจำงานกลไกที่ self-contained ได้ในแผนของตัวเอง และเรียกตรงก็ได้:

- Slash command: `/tokenme-agent <คำอธิบายภารกิจ>`
- Codex command: `$tokenme-agent <คำอธิบายภารกิจ>`
- ข้อความในงาน: พิมพ์ "use tokenme", "delegate this" หรือ "do this cheaply" ควบคู่กับงานที่สั่ง แล้ว agent จะพิจารณาส่ง subtask นั้นให้ tokenme

### เกณฑ์ก่อนส่งงาน (Eligibility checklist)

ตรวจทุกครั้งก่อน dispatch:

1. **Self-contained** — งานต้องไม่ต้องใช้บริบทจากแชทนี้ ถ้าต้องใช้ ให้ host เก็บงานไว้ทำเอง
2. **Fits the budget** — footprint (file bytes ÷ 4 × 1.5) บวก fixed overhead ต้องอยู่ใน 60k tokens เกินให้แบ่ง chunk ก่อน
3. **Verifiable by a diff or a test run** — ต้องมีวิธีตรวจผลด้วย `git diff` หรือการรัน test ที่ชัดเจน

และกฎ keep-local ต้องผ่านก่อนเสมอ: งานที่แตะ secrets, `.env` หรือ credential files, ticket ที่ระบุ `Risk: high`, code ที่ผู้ใช้ทำเครื่องหมายว่าห้ามออกจากเครื่อง, งาน design/architecture, security-sensitive edits และ debugging ที่ต้องใช้ดุลพินิจ — ทั้งหมดถูก host เก็บไว้ทำเอง

### ขั้นตอนการทำงานเบื้องหลัง

1. **Host เขียน prompt ลงไฟล์:** บันทึกคำสั่งและ acceptance criteria ลง `/tmp/tokenme-prompts/<task-id>.md` ด้วย absolute path ทั้งหมด ระบุไฟล์ที่อ่านและไฟล์ที่แก้ชัดเจน พร้อมเขียนข้อตกลง (เช่น naming convention) ลงใน prompt เต็ม ๆ เพราะ bare run อ่าน project instructions ไม่เห็น — prompt อ่านจากไฟล์ ไม่ inline ใน shell เพื่อกันปัญหา quoting
2. **รัน headless ผ่าน shell** (stdout กับ stderr แยกไฟล์กัน เพื่อไม่ให้ warning ของ gateway เข้าไปทำ JSON พัง):

   ```bash
   claude-tokenme -p "$(cat /tmp/tokenme-prompts/<task-id>.md)" \
     --bare \
     --output-format json \
     --no-session-persistence \
     --disable-slash-commands \
     --allowed-tools "Read Glob Grep Edit Write Bash" \
     --disallowed-tools "<deny list — see dispatch-contract.md>" \
     > /tmp/tokenme-runs/<task-id>.json \
     2> /tmp/tokenme-runs/<task-id>.err
   ```

   งานอ่านอย่างเดียว (สรุป log, ค้นหา) ใช้ `--allowed-tools "Read Glob Grep"` แทน เพื่อจำกัด run ให้อ่านได้อย่างเดียว ส่วน `--disallowed-tools` ใช้ชุดเดียวกันทุก run — deny list เป็น prefix rules ที่กัน git เปลี่ยน history และกันการเริ่ม `claude`/`claude-tokenme` ซ้อนกัน และ host verification เป็น backstop ของรูเล็กรูใหญ่ที่เหลือ รายการเต็มที่ใช้จริงอยู่ใน [dispatch-contract.md](../../skills/agents/tokenme-agent/references/dispatch-contract.md) ซึ่งเป็น canonical เสมอ — guide นี้จงใจไม่ copy รายการไว้ เพื่อไม่ให้เพี้ยนเมื่อ deny list ถูกแก้ใน contract

3. **ตรวจสถานะผ่าน result gate:** อ่าน exit code ก่อน (ต้องเป็นศูนย์) แล้ว parse envelope จาก result file — ต้องได้ `is_error` false, `subtype` success และ `terminal_reason` completed ค่าใดขาดข้อใด run นั้นล้มเหลว ให้อ่าน error file แล้วรายงาน stderr อาการ overflow (edit ที่ถูกตัดจบกลางคัน, ผลลัพธ์ที่ขาดไฟล์ที่สั่งไว้, terminal reason อื่นที่ไม่ใช่ completed) ถูกจับที่จุดเดียวกันนี้ แล้วแบ่ง chunk เล็กลงใหม่
4. **เทียบ baseline และรัน check เอง:** ก่อน dispatch host บันทึก HEAD, ผล `git status --porcelain --untracked-files=all` และ content hash ของทุกไฟล์ที่ prompt ระบุ (directory ที่ระบุถูกขยายเป็นรายไฟล์) หลังรันบันทึกซ้ำแล้วเทียบ — ไฟล์นอกชุดที่ระบุเปลี่ยน หรือ HEAD ขยับ run ถูกปฏิเสธ จบด้วยการรัน test/build/lint ที่งานมี สรุปผลของ run เป็น claim ไม่ใช่หลักฐาน
5. **ล้มเหลวแล้วทำอย่างไร:** retry หนึ่งครั้งด้วย chunk ที่เล็กลง เมื่อ retry ล้มอีก host ทำงานนั้นเอง — ไม่ loop ส่วน gateway หรือ authentication failure หยุดการ delegate ทันทีโดยไม่มี retry แล้ว host ทำเอง
6. **รันขนานเมื่อไร:** งานอิสระสองชิ้นที่ชุดไฟล์ไม่ซ้ำกัน (disjoint) รันพร้อมกันได้ในเบื้องหลัง โดยแต่ละ run มี result file กับ error file ของตัวเอง ปิดท้ายด้วย `wait` แล้วตรวจแยกทีละ run ตามชุดไฟล์ของมัน ถ้าไฟล์ไหนถูกระบุในสองงาน ให้แบ่งใหม่ให้ไม่ซ้ำ หรือรันตามลำดับแทน

---

## 4. ตัวอย่างคำสั่งและ Prompt ใช้งานจริง

### ตัวอย่างที่ 1: เปลี่ยนชื่อ helper ในไฟล์เล็ก ๆ สิบกว่าไฟล์

```text
/tokenme-agent เปลี่ยนชื่อ fetchUserData เป็น loadUserProfile ในทุกไฟล์ใต้ src/api/ แล้วอัปเดต import ให้ครบ อย่าแก้ไฟล์อื่น
```

### ตัวอย่างที่ 2: สรุป log ยาวเป็นตาราง

```text
/tokenme-agent อ่าน build.log ใน /tmp/build-2026-10-02/ แล้วสรุปเป็นตาราง: ขั้นตอน, เวลาที่ใช้, warning ที่พบ ห้ามแก้ไฟล์ใด ๆ
```

### ตัวอย่างที่ 3: สั่งผ่านข้อความในงาน

```text
ล้าง TODO ที่เก่ากว่าหนึ่งปีใน src/ ด้วย — ใช้ tokenme สำหรับพวกนี้ได้เลย (use tokenme)
```

---

## 5. ข้อควรระวังและสิ่งที่ไม่ควรใช้

- **งานที่แตะ secrets, `.env` หรือ credential files, ticket `Risk: high`, code ที่ห้ามออกจากเครื่อง:** host เก็บไว้ทำเอง และตรวจกฎนี้ก่อน dispatch เพราะ bare run อ่าน project instructions ไม่เห็น
- **งานที่ต้องใช้ดุลพินิจ:** การเลือก design/architecture, security-sensitive edits และ debugging ที่ต้องไล่เหตุผล — ราคาของ edit ที่ผิดกับงานพวกนี้แพงเกินกว่าจะส่งออก
- **งานที่ต้องใช้บริบทจากแชทนี้:** delegate run เป็น one-shot ที่ไม่เห็นบทสนทนา ถ้างานอ้าง "ตามที่คุยกันไว้" ให้ host ทำเอง
- **อย่าพึ่ง compaction:** run เริ่ม compact ที่ 90k tokens แล้วเนื้อหาที่หายไปไม่มีใครกู้คืนให้ — คุมทุก task ให้อยู่ใน planning budget และแบ่ง chunk เมื่อเกิน
- **macOS ไม่มี `timeout`:** skill ไม่พันคำสั่งด้วย `timeout` — run จบเมื่อ JSON ลง result file แล้ว
- **ระวังเรื่อง path ใน prompt:** ใช้ absolute path เสมอ และเขียน acceptance criteria ให้ตรวจสอบได้จริงหลัง run จบ
