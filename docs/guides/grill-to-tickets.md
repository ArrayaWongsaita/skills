# คู่มือการติดตั้งและใช้งาน Skill: grill-to-tickets

- **หมวดหมู่ (Category):** `agents`
- **แหล่งติดตั้ง (Install Source):** `ArrayaWongsaita/skills`
- **ไฟล์นิยามหลัก (Definition):** [`skills/agents/grill-to-tickets/SKILL.md`](../../skills/agents/grill-to-tickets/SKILL.md)

---

## 1. grill-to-tickets คืออะไร

`grill-to-tickets` พา idea หนึ่งอันจากการสัมภาษณ์ไปจนถึง ticket ที่เผยแพร่แล้วด้วยคำสั่งเดียว โดยทำตาม skill ของ upstream ที่ติดตั้งไว้ใน context เดียวตามลำดับ:

1. `grill-with-docs` สัมภาษณ์ (ใช้ `grilling` และ `domain-modeling`)
2. `to-spec` เขียนและเผยแพร่ spec
3. `scrutinize` รีวิว spec ที่เผยแพร่แล้วหนึ่งรอบ
4. `to-tickets` แตก ticket

skill นี้ไม่มี format ของ spec หรือ ticket ไม่มี checker และไม่มีชุด reference ของตัวเอง จึงใช้ได้กับ Tracker ทั้งแบบ local (ไฟล์ markdown) และ remote (เช่น GitHub Issues) และเมื่อ upstream เปลี่ยน skill นี้จะเปลี่ยนตามในการรันครั้งถัดไป จบที่ ticket ที่เผยแพร่แล้วและ **ไม่ implement**

---

## 2. การติดตั้ง

```bash
# 1. ติดตั้ง skill หลัก
npx skills add ArrayaWongsaita/skills --skill grill-to-tickets

# 2. ติดตั้ง skill ของ upstream ที่ต้องใช้
npx skills add mattpocock/skills --skill grill-with-docs
npx skills add mattpocock/skills --skill grilling
npx skills add mattpocock/skills --skill domain-modeling
npx skills add mattpocock/skills --skill to-spec
npx skills add mattpocock/skills --skill to-tickets
npx skills add thananon/9arm-skills --skill scrutinize
```

ตอนเริ่ม skill จะทำ **Preflight** หา `SKILL.md` ของทั้งหกตัวตามลำดับ `.agents/skills/` → `.claude/skills/` → `~/.agents/skills/` → `~/.claude/skills/` ถ้าขาดตัวไหนจะหยุดและพิมพ์คำสั่งติดตั้งของตัวนั้น

project ต้องมี Tracker doc (`docs/agents/issue-tracker.md`) ถ้าไม่มี skill จะหยุดและชี้ไปที่ skill ตั้งค่าของ upstream:

```bash
npx skills add mattpocock/skills --skill setup-matt-pocock-skills
```

---

## 3. วิธีใช้งาน

- Slash command: `/grill-to-tickets <idea>`
- Codex command: `$grill-to-tickets <idea>`

รับเฉพาะ idea ไม่มี flag และไม่มีรูปแบบ `continue` และจะเริ่มเมื่อผู้ใช้เรียกเท่านั้น (ปิด model invocation ใน frontmatter และปิด implicit invocation ใน metadata ของ Codex)

### ลำดับการทำงาน

1. **สัมภาษณ์:** ก่อนเริ่ม skill อ่าน domain doc ของ project (`docs/agents/domain.md`) ถ้ามี แล้วเขียนคำศัพท์และ ADR ตามที่ doc นั้นระบุ ในรูปแบบเดียวกับไฟล์ที่มีอยู่ ถ้าไม่มี doc ใช้ค่าเริ่มต้นของ upstream
2. **Spec:** ทำตาม `to-spec` รวมถึงการเช็ก test seam กับผู้ใช้ แล้วเผยแพร่ไปที่ Tracker
3. **รีวิว:** subagent ใหม่หนึ่งตัวรัน `scrutinize` โดยอ่าน spec จาก Tracker และไม่แก้อะไร ผู้ใช้เห็นทุก finding พร้อมเหตุผลและหลักฐาน แล้วเลือกเองว่าจะแก้ข้อไหน verdict ถูกแสดงแต่ไม่ได้ใช้ตัดสินทางเดิน ไม่มีรอบจำกัดและไม่มีรีวิวซ้ำอัตโนมัติ (ขอรีวิวซ้ำเองได้) ถ้า harness ไม่มี subagent จะรีวิวใน context หลักและบอกผู้ใช้
4. **แก้ spec:** fix ที่เลือกถูกใส่ใน spec ที่เผยแพร่: แก้ไฟล์เมื่อ Tracker เป็น local; แทน body เมื่อ Tracker แบบ remote มี tool แก้ body ได้ ไม่เช่นนั้นเพิ่มเป็น comment
5. **Ticket:** ส่ง reference ของ spec ที่เผยแพร่ให้ `to-tickets` เป็น source เพื่อให้ ticket แตกจาก spec ที่แก้แล้วและลิงก์กลับมาที่ spec
6. **Handoff:** พิมพ์ reference ของ spec, ของ ticket และคำสั่งถัดไป

```text
/clear
/implement-tickets <spec reference>
```

---

## 4. ตัวอย่าง

```text
/grill-to-tickets เพิ่มการตั้งค่าขนาดฟอนต์ subtitle ในหน้า player settings ให้ผู้ใช้ปรับเองได้และจำค่าไว้ต่อเครื่อง
```

---

## 5. ข้อควรระวัง

- **ติดตั้ง skill ของ upstream ให้ครบ:** ขาดตัวใดตัวหนึ่ง Preflight จะหยุดก่อนเริ่มสัมภาษณ์
- **ต้องมี Tracker doc:** รัน `setup-matt-pocock-skills` ก่อนถ้ายังไม่มี
- **รีเซ็ต Context หลังเสร็จ:** พิมพ์ `/clear` ก่อนเริ่ม implement
- **สัมภาษณ์ที่จบก่อนเขียน spec ทำต่อไม่ได้:** ต้องเริ่มคำสั่งใหม่
