# คู่มือการติดตั้งและใช้งาน Skill: implement-tickets

- **หมวดหมู่ (Category):** `agents`
- **แหล่งติดตั้ง (Install Source):** `ArrayaWongsaita/skills`
- **ไฟล์นิยามหลัก (Definition):** [`skills/agents/implement-tickets/SKILL.md`](../../skills/agents/implement-tickets/SKILL.md)

---

## 1. implement-tickets คืออะไร

`implement-tickets` implement spec ที่เผยแพร่แล้วด้วยคำสั่งเดียว โดยทำตาม skill `implement-spec` ของ upstream ที่ติดตั้งไว้ตั้งแต่ต้นจนจบ (integration branch เดียว, implementer หนึ่งตัวต่อ ticket ใน worktree ของตัวเองที่สร้างด้วย `tdd`, merger, `code-review` และ pull request) แล้วเพิ่มเพียง **Run status** ที่เปิดดูได้ทุกเมื่อ

skill นี้ไม่มี planner, script, ticket checker หรือชุด reference ของตัวเอง จึงใช้ได้กับ Tracker ทั้งแบบ local (ไฟล์ markdown) และ remote (เช่น GitHub Issues) และเมื่อ upstream เปลี่ยน skill นี้จะเปลี่ยนตามในการรันครั้งถัดไป skill นี้ครอบคลุมการรันครั้งแรก

---

## 2. การติดตั้ง

```bash
# 1. ติดตั้ง skill หลัก
npx skills add ArrayaWongsaita/skills --skill implement-tickets

# 2. ติดตั้ง skill ของ upstream ที่ต้องใช้
npx skills add mattpocock/skills --skill implement-spec
npx skills add mattpocock/skills --skill tdd
npx skills add mattpocock/skills --skill code-review
```

ตอนเริ่ม skill จะทำ **Preflight** หา `SKILL.md` ของทั้งสามตัวตามลำดับ `.agents/skills/` → `.claude/skills/` → `~/.agents/skills/` → `~/.claude/skills/` ถ้าขาดตัวไหนจะหยุดและพิมพ์คำสั่งติดตั้งของตัวนั้น

project ต้องมี Tracker doc (`docs/agents/issue-tracker.md`) ถ้าไม่มี skill จะหยุดและชี้ไปที่ skill ตั้งค่าของ upstream:

```bash
npx skills add mattpocock/skills --skill setup-matt-pocock-skills
```

---

## 3. วิธีใช้งาน

- Slash command: `/implement-tickets <spec reference>`
- Codex command: `$implement-tickets <spec reference>`

spec reference คือ path, เลข issue หรือ URL รับเฉพาะ reference ไม่มี flag และจะเริ่มเมื่อผู้ใช้เรียกเท่านั้น (ปิด model invocation ใน frontmatter และปิด implicit invocation ใน metadata ของ Codex)

### ลำดับการทำงาน

1. **Reference:** แปลง argument เป็น spec reference แบบ canonical (path จาก root ของ repository สำหรับ local, identifier ของ Tracker สำหรับ remote) ก่อนค้นหาสิ่งใด
2. **Implement:** ทำตาม `implement-spec` ตามที่เป็น โดยไม่เปลี่ยนขั้นใดของ upstream
3. **Run status:** เขียน `status.md` หลังสร้าง integration branch และก่อนแจก ticket แรก แล้วอัปเดตทุกเหตุการณ์
4. **Trailer:** ให้ merger ปิดข้อความ commit ที่นำ ticket เข้า integration branch ด้วย trailer ที่ระบุ ticket (identifier ของ Tracker สำหรับ remote; ชื่อ directory ของ feature กับเลข ticket สำหรับ local)
5. **หยุดก่อนรีวิว:** ถ้าไม่มี ticket `in progress` แจกต่อไม่ได้ และมี ticket `stuck` หรือ `waiting` จะหยุดก่อน `code-review` และก่อนปิด ticket ล้าง worktree ของ ticket ที่ `done` เก็บของ ticket ที่ `stuck` แล้วรายงานเหตุผลและ ticket ที่ถูกรั้งไว้
6. **จบ:** เมื่อขั้นสุดท้ายของ upstream เสร็จ สถานะ run เป็น `finished`

---

## 4. Run status

ไฟล์ `status.md` ใน directory ของ feature ใต้ `.scratch/` (local: directory ที่เก็บ spec; remote: directory ที่ตั้งชื่อจาก identifier ของ spec ตามด้วย slug ของชื่อ)

- **ส่วนหัว:** spec reference แบบ canonical, integration branch, pull request (เมื่อมี), สถานะ run (`open` หรือ `finished`) และเวลาที่อัปเดตล่าสุด
- **ตาราง:** หนึ่งแถวต่อ ticket คอลัมน์ Ticket, Title, Blocked by, Status, Commit ตามลำดับนี้
- **สถานะ:** `waiting` (ยังไม่แจก), `in progress` (แจกแล้วยังไม่ merge), `done` (merge เข้า integration branch แล้ว), `stuck` (implementer หรือ merger ทำไม่สำเร็จหรือจบโดยไม่มีผลที่ใช้ได้)
- **ticket ที่ `stuck`:** มีหนึ่งบรรทัดใต้ตารางบอกเหตุผลและตำแหน่ง worktree ที่เก็บไว้ ส่วน ticket ที่ถูกรั้งไว้ยังเป็น `waiting` ขณะที่ ticket อิสระทำต่อ
- **การป้องกัน:** ถ้าไฟล์ยังไม่ถูก git ignore จะเพิ่ม local exclude ให้ไฟล์นั้นก่อนเขียนครั้งแรกและบอกผู้ใช้ ถ้ามี `status.md` ที่หัวตารางไม่ตรงห้าคอลัมน์ run จะหยุดและไม่แตะไฟล์

---

## 5. ตัวอย่าง

```text
/implement-tickets .scratch/saved-searches/spec.md
```

---

## 6. ข้อควรระวัง

- **ติดตั้ง skill ของ upstream ให้ครบ:** ขาดตัวใดตัวหนึ่ง Preflight จะหยุดก่อนเริ่มงาน
- **ต้องมี Tracker doc:** รัน `setup-matt-pocock-skills` ก่อนถ้ายังไม่มี
- **ความผิดพลาดปรากฏตอน `code-review` ท้ายสุด:** ไม่มี gate หลัง merge แต่ละครั้ง
- **รันที่บันทึกด้วย `status.md` รูปแบบเดิมจะไม่ถูกทำต่อ:** ไฟล์นั้นถูกปฏิเสธและไม่ถูกแก้
- **ยังไม่ครอบคลุมการทำต่อ:** คู่มือนี้อธิบายการรันครั้งแรกเท่านั้น
