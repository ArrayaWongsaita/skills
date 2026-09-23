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
