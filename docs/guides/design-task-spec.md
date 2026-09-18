# คู่มือการติดตั้งและใช้งาน Skill: design-task-spec

- **หมวดหมู่ (Category):** `agents`
- **แหล่งติดตั้ง (Install Source):** `ArrayaWongsaita/skills`
- **ไฟล์นิยามหลัก (Definition):** [`skills/agents/design-task-spec/SKILL.md`](../../skills/agents/design-task-spec/SKILL.md)

---

## 1. design-task-spec คืออะไรและมีไว้สำหรับทำอะไร?

`design-task-spec` เป็น Skill สำหรับ **เปลี่ยนคำขอพัฒนาซอฟต์แวร์ที่ยังคลุมเครือให้กลายเป็นเอกสาร Task Specification ที่ตัดสินใจครบถ้วนทุกมิติ (Decision-Complete)** เพื่อส่งมอบต่อให้ Agent อื่นหรือวิศวกรนำไปลงมือพัฒนา (Implement) ได้ทันทีโดยไม่ต้องคาดเดาหรือตัดสินใจเรื่องสถาปัตยกรรมเอง

### จุดประสงค์หลักและคุณสมบัติเด่น
1. **ออกแบบครบวงจร:** ครอบคลุมทั้ง Scope, สถาปัตยกรรม, ขอบเขตสัญญา (API/Schema Contracts), พฤติกรรมเมื่อเกิดข้อผิดพลาด (Failure Behavior), แผนการส่งมอบ (Delivery Plan) และเกณฑ์การตรวจรับงาน (Acceptance Criteria)
2. **อิงหลักฐานเชิงประจักษ์จาก Codebase:** ตรวจสอบโครงสร้างโค้ดเดิม, สัญญาที่มีอยู่, การทดสอบเดิม ก่อนที่จะถามคำถาม เพื่อถามเฉพาะเรื่องที่ต้องตัดสินใจจริงๆ
3. **หยุดที่การส่งมอบงาน (Ready-for-Implementation):** Skill นี้สร้างเฉพาะเอกสารข้อกำหนดและแผนงานเท่านั้น **ไม่ลงมือแก้ไขโค้ดโปรแกรมจริง** เพื่อรักษาความชัดเจนของหน้าที่

---

## 2. การพึ่งพา Skill อื่น (Dependencies) และการติดตั้ง

`design-task-spec` เรียกใช้ Sub-skills ในขั้นตอนการสัมภาษณ์และจัดระเบียบคำศัพท์:

| ชื่อ Skill ที่พึ่งพา | เจ้าของ / Repository | หน้าที่ใน Workflow |
| :--- | :--- | :--- |
| **`grilling`** | `mattpocock/skills` | สัมภาษณ์เจาะลึกทางเลือกเชิงสถาปัตยกรรมและข้อแลกเปลี่ยน (Trade-offs) |
| **`domain-modeling`** | `mattpocock/skills` | กำหนดคำศัพท์เชิงโดเมนและขอบเขตของโมเดล |

### คำสั่งติดตั้งทั้งหมด

รันคำสั่งต่อไปนี้ใน Terminal:

```bash
# 1. ติดตั้งตัว skill หลัก (design-task-spec)
npx skills add ArrayaWongsaita/skills --skill design-task-spec

# 2. ติดตั้ง skills ที่พึ่งพา (Dependencies)
npx skills add mattpocock/skills --skill grilling
npx skills add mattpocock/skills --skill domain-modeling
```

---

## 3. วิธีการใช้งานและขั้นตอนการทำงาน (Usage & Workflow)

### คำสั่งเรียกใช้งาน (Invocation)
- Slash command: `/design-task-spec <โจทย์หรือฟีเจอร์>`
- Codex command: `$design-task-spec <โจทย์หรือฟีเจอร์>`

---

### ขั้นตอนการทำงาน 6 ลำดับขั้น

```text
1. โหลด grilling และ domain-modeling
      ↓
2. สำรวจ Repository, เอกสาร, Tests และ API Contracts ปัจจุบัน
      ↓
3. สร้างร่างเอกสาร Task Document ในสถานะ `draft`
      ↓
4. เลือก Coverage Modules (เช่น Persistence, Auth, Observability, Migration)
      ↓
5. สัมภาษณ์เฉพาะ Decision Frontier ที่ยังไม่ได้ข้อยุติ
      ↓
6. ยืนยันความเข้าใจร่วมกันและเปลี่ยนสถานะเป็น `ready-for-implementation`
```

1. **สำรวจหลักฐานก่อนถาม:** ตรวจสอบ stack, โครงสร้างโค้ด และการตั้งค่าเดิมในโปรเจกต์
2. **สร้าง Task Document (`draft`):** บันทึก Scope, ข้อสมมุติฐาน (Assumptions), และข้อจำกัด
3. **ตรวจสอบความครอบคลุม (Coverage Checklist):** ไล่ตรวจตามประเภทงาน เช่น
   - Schema & Data Migration
   - Error Handling & Retries
   - Observability (Logs, Metrics)
   - Rollback Plan
4. **ถามเฉพาะจุดสำคัญ:** สัมภาษณ์ผู้ใช้เฉพาะประเด็นที่ส่งผลกระทบทางสถาปัตยกรรม
5. **ส่งมอบงาน (`ready-for-implementation`):** เมื่อผู้ใช้ยืนยันเอกสาร จะบันทึกสถานะพร้อมส่งมอบและหยุดทำงานทันที

---

## 4. ตัวอย่างคำสั่งและ Prompt ใช้งานจริง

### ตัวอย่างที่ 1: ออกแบบระบบ Idempotency ให้ API
```text
ใช้ $design-task-spec ตรวจ Repository และออกแบบ Task Specification สำหรับเพิ่ม Idempotency ให้ Payment Webhook API ปิด Decision ที่เกี่ยวข้องกับการรับ Request ซ้ำ, การเก็บ State, การ Retry, และ Rollback โดยยังไม่แก้ Implementation Code
```

### ตัวอย่างที่ 2: ออกแบบการย้ายระบบ Authentication ไปใช้ JWT + Refresh Token
```text
/design-task-spec ออกแบบงาน Migration ระบบ Auth จาก Session-based ไปเป็น JWT พร้อม Refresh Token Rotation โดยครอบคลุมเรื่อง Data Migration, Token Expiry, และการรองรับ Backward Compatibility
```

---

## 5. ข้อควรระวังและสิ่งที่ไม่ควรใช้
- **ไม่ใช้เมื่อต้องการโค้ดทันที:** หากต้องการให้ลงมือเขียนโค้ดทันที ให้ใช้ implementation skills แทน
- **เอกสารคือสัญญาการส่งมอบ:** เมื่อสถานะเป็น `ready-for-implementation` แปลว่า Agent ถัดไปสามารถทำงานได้โดยไม่ต้องหยุดถามคำถามเพิ่มเติมเรื่องสถาปัตยกรรมอีก
