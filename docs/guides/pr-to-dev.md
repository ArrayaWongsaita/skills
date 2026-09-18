# คู่มือการติดตั้งและใช้งาน Skill: pr-to-dev

- **หมวดหมู่ (Category):** `git`
- **แหล่งติดตั้ง (Install Source):** `ArrayaWongsaita/skills`
- **ไฟล์นิยามหลัก (Definition):** [`skills/git/pr-to-dev/SKILL.md`](../../skills/git/pr-to-dev/SKILL.md)

---

## 1. pr-to-dev คืออะไรและมีไว้สำหรับทำอะไร?

`pr-to-dev` เป็น **Git & GitHub Automation Skill** ที่ทำหน้าที่จัดเตรียมงานที่กำลังทำอยู่ในเครื่องอย่างปลอดภัยให้อยู่บน Working Branch ที่ผ่านการตรวจสอบแล้ว จากนั้นสร้างหรืออัปเดต Pull Request ที่มี Base ชี้ไปยัง branch `dev` โดยอัตโนมัติ

จุดเด่นสำคัญที่สุดของ `pr-to-dev` คือเป็น **State Machine ที่เน้นความปลอดภัยสูงสุด (Strict Safety Invariants)** ไม่ใช่เป็นเพียงสคริปต์รันคำสั่ง Git ทั่วไป มันจะไม่ยอมให้โค้ดพัง, ไม่เสี่ยงต่อการ Push ทับงานผู้อื่น และไม่ทำให้งานในเครื่องสูญหาย

### กฎความปลอดภัยที่เข้มงวด (Hard Safety Rules)
1. **ห้าม Commit งานลงบน `dev`, `main`, หรือ `master` เด็ดขาด**
2. **ยึด `origin/dev` เป็นฐานบูรณาการหลักเสมอ** (ไม่ใช้ local dev ที่อาจล้าสมัย)
3. **ห้ามใช้ `git add .` หรือ `git add -A` แบบสุ่มสี่สุ่มห้า:** บังคับเลือก Stage เฉพาะไฟล์ที่ผ่านการตรวจสอบแล้ว (Selective Staging) ป้องกันไม่ให้ไฟล์ความลับ (.env, credentials) หรือไฟล์ชั่วคราวหลุดเข้าไป
4. **ห้ามใช้ `git push --force` เด็ดขาด:** บังคับใช้ `--force-with-lease` ที่ระบุ Expected SHA แบบเจาะจงเมื่อต้องเขียนประวัติทับ
5. **ตรวจสอบความสดใหม่ (Freshness Check) ก่อน Push:** ตรวจสอบว่า `origin/dev` มีคนอื่น Push เข้ามาก่อนหน้าหรือไม่ ถ้ามี จะทำ Safe Rebase ซ้ำสูงสุด 2 ครั้ง
6. **ไม่ตัดสินใจเดาเองเมื่อเจอ Semantic Conflict:** หาก Rebase ติดขัดในส่วนที่มีความเสี่ยงสูง (เช่น Auth, Permissions, Database Migration, การคำนวณเงิน) จะหยุดและแจ้งผู้ใช้ทันที
7. **ป้องกันการเปิด PR ซ้ำซ้อน (Idempotent):** หากมี PR ของ Branch นี้ที่ชี้ไปที่ `dev` เปิดค้างอยู่แล้ว จะทำการอัปเดตแทนการสร้างใหม่

---

## 2. การพึ่งพา Skill อื่น (Dependencies) และการติดตั้ง

### พึ่งพา Skill อะไรบ้าง?
- **ไม่มีการพึ่งพา Skill อื่นเลย (Zero External Skill Dependencies):**
  - กระบวนการทำงานทั้ง 21 สเตต (State Machine) ถูกเขียนและบรรจุอยู่ในไฟล์ของตัวมันเองอย่างสมบูรณ์

### ซอฟต์แวร์และเครื่องมือที่ต้องมีในเครื่อง (System Prerequisites)
1. **Git CLI:** ติดตั้งอยู่ในระบบ
2. **GitHub CLI (`gh`):** ต้องติดตั้งและผ่านการล็อกอินยืนยันตัวตนเรียบร้อย:
   ```bash
   # ตรวจสอบสถานะการล็อกอิน
   gh auth status

   # หากยังไม่ได้ล็อกอิน ให้รัน:
   gh auth login
   ```
3. **ชุดทดสอบและ Linter ของโปรเจกต์:** เช่นคำสั่งรัน test, typecheck หรือ lint ที่ระบุใน `package.json`, `Makefile` หรือโครงสร้างของโปรเจกต์นั้นๆ

### คำสั่งติดตั้ง

รันคำสั่งติดตั้งตัว skill เดียวได้ทันที:

```bash
npx skills add ArrayaWongsaita/skills --skill pr-to-dev
```

---

## 3. วิธีการใช้งานและขั้นตอนการทำงาน (Usage & Workflow)

### คำสั่งเรียกใช้งาน (Invocation)
- Slash command: `/pr-to-dev`
- คำสั่งภาษาธรรมชาติ (Natural Language):
  - "Create PR to dev"
  - "Ship current work to dev"
  - "Prepare my changes for review"
  - "Commit and open a PR targeting dev"

---

### ขั้นตอนการทำงาน (State Machine Workflow)

```text
01 PREFLIGHT                       (ตรวจความสะอาดของ git, เครื่องมือ gh)
      ↓
02 FETCH_REMOTE                    (ดึงข้อมูลล่าสุดจาก origin)
      ↓
03-06 ANALYZE & CLASSIFY           (วิเคราะห์ diff, worktree และจำแนกขอบเขตงาน)
      ↓
07 PREPARE_BRANCH                  (เตรียม working branch เช่น feat/xxx หรือ fix/xxx)
      ↓
08 PRE_COMMIT_VALIDATION           (รัน lint, typecheck, test ในเครื่อง)
      ↓
09-10 SELECTIVE_STAGE & DIFF       (เลือก stage เฉพาะไฟล์ที่เกี่ยวข้องและตรวจ diff ซ้ำ)
      ↓
11 COMMIT                          (สร้าง Conventional Commit เช่น feat: ... หรือ fix: ...)
      ↓
12 CAPTURE_REMOTE_SHA              (บันทึก SHA ปัจจุบันบนรีโมต)
      ↓
13-14 REBASE_ON_ORIGIN_DEV         (Rebase บน origin/dev พร้อม Conflict Safety Gate)
      ↓
15 POST_REBASE_VALIDATION          (รันเทสต์ซ้ำหลัง Rebase เพื่อยืนยันว่าไม่พัง)
      ↓
16-17 VERIFY_DIFF & FRESHNESS      (ตรวจ diff รวมทั้งหมดที่จะปรากฏบน PR และตรวจ dev ซ้ำ)
      ↓
18 PUSH_WITH_SAFE_LEASE            (Push ขึ้น remote ด้วย safe lease)
      ↓
19-20 FIND_PR & CREATE_OR_UPDATE   (ค้นหา PR เดิมเพื่ออัปเดต หรือสร้าง PR ใหม่ไปยัง dev)
      ↓
21 REPORT                          (รายงานผลลัพธ์พร้อม URL ของ PR ที่สร้างสำเร็จ)
```

---

## 4. ตัวอย่างคำสั่งและ Prompt ใช้งานจริง

### ตัวอย่างที่ 1: เรียกคำสั่งโดยตรงหลังทำรีวิวเสร็จ
```text
/pr-to-dev
```

### ตัวอย่างที่ 2: สั่งด้วยภาษาธรรมชาติ
```text
ช่วยนำงานที่แก้ค้างอยู่ selective stage, commit, rebase เข้า origin/dev และเปิด PR ไปยัง dev ให้หน่อย
```

### ตัวอย่างรายงานผลลัพธ์ที่ได้เมื่อเสร็จสิ้น:
```text
PR prepared successfully.

Branch:
feat/subtitle-preferences

Commit(s):
a1b2c3d feat(player): add subtitle font size preference controls

Base:
origin/dev 9f8e7d6, freshness confirmed before push

Validation:
✓ pnpm test
✓ pnpm typecheck

Rebase:
✓ validated against origin/dev 9f8e7d6

PR:
#42 feat(player): add subtitle font size preference controls
feat/subtitle-preferences → dev

URL:
https://github.com/my-org/my-app/pull/42
```

---

## 5. ข้อควรระวังและสิ่งที่ไม่ควรใช้
- **ไม่ใช้สำหรับ Merge หรือ Deploy:** Skill นี้มีหน้าที่เตรียมและสร้าง/อัปเดต Pull Request เท่านั้น จะไม่มีการกด Merge PR, Deploy หรือจัดการ Release
- **ไม่ใช้สำหรับ PR ที่มีเป้าหมายเป็น `main`:** Skill นี้ถูกออกแบบมาเฉพาะสำหรับ Git Flow ที่เปิดเข้า branch `dev` เท่านั้น
- **ต้องล็อกอิน `gh` ให้เรียบร้อย:** หากไม่ได้ล็อกอิน GitHub CLI ขั้นตอน Preflight จะหยุดการทำงานทันทีเพื่อความปลอดภัย
- **อย่าวางไฟล์ความลับไว้ใน Worktree:** แม้ว่าจะมีระบบ Selective Staging ป้องกันไว้ แต่เพื่อความปลอดภัยสูงสุด ควรใส่ `.gitignore` ให้เรียบร้อย
