# ADR 0027: grill-to-tickets and implement-tickets follow the upstream skills

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-10-11
- Supersedes / แทนที่: ADR 0002, 0003, 0006, 0010, 0012, 0013, 0014, 0016, 0017, 0018, 0019, 0020, 0021, 0022, 0023
- ADR 0004 and 0007 were already superseded by ADR 0020; decision 6 retires the skills they introduced. / ADR 0004 และ 0007 ถูกแทนที่โดย ADR 0020 ไปแล้ว ข้อ 6 เลิกใช้ skill ที่สองฉบับนั้นสร้าง

## Context / บริบท

[ADR 0015](0015-retire-skills-duplicated-by-mattpocock.md) retired the owned
planning and implementation skills in favor of `mattpocock/skills`, and
[ADR 0016](0016-restore-skills-retired-by-adr-0015.md) restored them a day
later because the owned implementers were preferred at the time.

Since then `grill-to-tickets` and `implement-tickets` have been used on real
work, alongside the upstream flow. The steps the owned skills add (the ticket
checker, Budget lines, review gates, the verifier) cost more time and tokens
than they returned, and the upstream flow gave a result the owner preferred
with fewer steps. The owned ticket format also ties both skills to local files
under `.scratch/`, while the upstream skills work with any tracker.

[ADR 0015](0015-retire-skills-duplicated-by-mattpocock.md) เลิกใช้ skill ของ
repo ไปใช้ `mattpocock/skills` และ
[ADR 0016](0016-restore-skills-retired-by-adr-0015.md) กู้คืนในวันถัดมา
เพราะตอนนั้นยังชอบ implementer ของ repo มากกว่า

หลังจากนั้นได้ใช้ `grill-to-tickets` กับ `implement-tickets` กับงานจริง
ควบคู่กับ flow ของ upstream ขั้นตอนที่ skill ของ repo เพิ่มเข้ามา (ticket
checker, บรรทัด Budget, review gate, verifier) ใช้เวลาและ token มากกว่าประโยชน์ที่ได้
และ flow ของ upstream ให้ผลที่เจ้าของพอใจกว่าด้วยขั้นตอนน้อยกว่า อีกทั้ง format
ของ ticket ที่ repo เป็นเจ้าของผูกทั้งสอง skill ไว้กับไฟล์ local ใน `.scratch/`
ขณะที่ skill ของ upstream ใช้ได้กับทุก tracker

## Decision / การตัดสินใจ

1. `grill-to-tickets` follows the installed upstream skills in one context, in
   this order: `grill-with-docs` (`grilling` and `domain-modeling`), `to-spec`,
   `scrutinize`, `to-tickets`. It finds each `SKILL.md` where it is installed
   and follows it. It owns no spec format, no ticket format, and no copy of an
   upstream skill.
2. `scrutinize` runs once, in a fresh subagent that reads the published spec
   from the tracker. The person chooses which findings to fix. There is no
   round budget and no verdict routing.
3. `implement-tickets` follows `implement-spec` as it stands, including
   parallel worktrees, the merger, `code-review`, and the pull request. It adds
   three things:
   - a Run status at `.scratch/<feature-slug>/status.md`: the spec, the
     integration branch, the pull request, and one row per ticket with its
     blockers, its state (`waiting`, `in progress`, `done`, `stuck`), and its
     commit;
   - a rerun of the same command continues the run on the recorded
     integration branch and pull request: each commit that lands a ticket
     names that ticket, and a ticket is `done` exactly when such a commit is
     on the integration branch, whatever the file says; a finished run is
     reported and left unchanged;
   - the run stops before `code-review` while any ticket is `stuck` or still
     `waiting`.
4. Both skills work with whichever tracker `docs/agents/issue-tracker.md`
   describes, local or remote, because they leave reading and writing the
   tracker to the upstream skills.
5. Remove the owned spec and ticket formats, the ticket checker, the planner,
   the manifest, the decision log, parked questions, the blind-spot pass, the
   design-review budget, the ticket review, the verifier, the integration gate,
   the run report, every flag, and `continue`.
6. Retire `review-to-pr`, `agy-implement`, `opencode-implement`,
   `retro-to-remedies`, and `engineering-workflow`, with their guides, skill
   pages, and tests. Each reads a format decision 5 removes. Keep `agy-agent`,
   `tokenme-agent`, and `pr-to-base`.
7. The contract tests of the two skills pin only what breaks a skill when it
   goes missing: the flow order, the upstream skills Preflight requires, the
   exact files each skill ships, that neither skill can be invoked by a model,
   the Run status columns and states, and that each skill's own rules (the
   review stage, the rerun rule, the stopping rule) are present.
8. `docs/glossary.md` is the one glossary. `docs/agents/domain.md` points at
   it, and `grill-to-tickets` writes glossary terms and ADRs where that file
   says, in place of the upstream default locations.

1. `grill-to-tickets` ทำตาม skill ของ upstream ที่ติดตั้งอยู่ ในบริบทเดียว
   ตามลำดับ: `grill-with-docs` (`grilling` กับ `domain-modeling`), `to-spec`,
   `scrutinize`, `to-tickets` โดยหา `SKILL.md` ของแต่ละตัวจากที่ติดตั้งแล้วทำตาม
   ไม่เป็นเจ้าของ format ของ spec หรือ ticket และไม่ถือสำเนา skill ของ upstream
2. `scrutinize` รันรอบเดียวใน subagent ใหม่ที่อ่าน spec ที่ publish แล้วจาก tracker
   ผู้ใช้เลือกว่าจะแก้ finding ข้อไหน ไม่มีงบรอบและไม่มีการ route verdict
3. `implement-tickets` ทำตาม `implement-spec` ตามที่เป็น รวม parallel worktree,
   merger, `code-review` และ pull request แล้วเพิ่มสามอย่าง:
   - Run status ที่ `.scratch/<feature-slug>/status.md`: spec, integration branch,
     pull request และหนึ่งแถวต่อ ticket พร้อม blocker, สถานะ (`waiting`,
     `in progress`, `done`, `stuck`) และ commit
   - รันคำสั่งเดิมซ้ำเพื่อทำต่อบน integration branch และ pull request เดิม:
     commit ที่นำ ticket เข้า integration branch ระบุ ticket นั้น และ ticket เป็น
     `done` ก็ต่อเมื่อมี commit เช่นนั้นอยู่บน integration branch ไม่ว่าไฟล์จะบอกอย่างไร
     ส่วนรันที่จบแล้วจะถูกรายงานและไม่ถูกแก้
   - หยุดก่อน `code-review` เมื่อยังมี ticket ที่ `stuck` หรือ `waiting`
4. ทั้งสอง skill ใช้ได้กับ tracker ที่ `docs/agents/issue-tracker.md` ระบุ
   ทั้ง local และ remote เพราะปล่อยให้ skill ของ upstream อ่านและเขียน tracker
5. ลบ format ของ spec และ ticket, ticket checker, planner, manifest, decision log,
   parked questions, blind-spot pass, งบรอบ design review, ticket review, verifier,
   integration gate, run report, flag ทั้งหมด และ `continue`
6. เลิกใช้ `review-to-pr`, `agy-implement`, `opencode-implement`,
   `retro-to-remedies` และ `engineering-workflow` พร้อม guide, หน้า skill และ test
   เพราะแต่ละตัวอ่าน format ที่ข้อ 5 ลบ เก็บ `agy-agent`, `tokenme-agent` และ
   `pr-to-base` ไว้
7. contract test ของสอง skill ตรึงเฉพาะสิ่งที่ถ้าหายแล้ว skill ทำงานผิด: ลำดับ flow,
   skill ของ upstream ที่ Preflight ต้องการ, รายชื่อไฟล์ที่แต่ละ skill ส่งมอบ,
   การที่ model เรียก skill เองไม่ได้, คอลัมน์กับสถานะของ Run status และการมีอยู่ของ
   กฎของแต่ละ skill เอง (ขั้น review, กฎรันซ้ำ, กฎหยุด)
8. `docs/glossary.md` เป็น glossary ไฟล์เดียว `docs/agents/domain.md` ชี้มาที่ไฟล์นี้
   และ `grill-to-tickets` เขียนคำใน glossary กับ ADR ตามที่ไฟล์นั้นระบุ
   แทนตำแหน่งตั้งต้นของ upstream

## Rejected alternatives / ทางเลือกที่ปฏิเสธ

- Keep some owned ticket fields or the checker beside the upstream skills: any
  one of them needs an owned format, which works only on local files.
- A skill that only lists the upstream commands for the person to type: one
  run was preferred.
- Keep the extras that need no format (the decision log, parked questions, the
  blind-spot pass, a gate after every merge): the upstream flow has none of
  them and was preferred as it is.
- Close each ticket in the tracker right after its merge, so the tracker is the
  record of a run in progress: it overrides the step where `implement-spec`
  closes work, and a tracker that closes tickets through the pull request
  cannot do it.

- เก็บ field ของ ticket บางตัวหรือ checker ไว้คู่กับ skill ของ upstream:
  ตัวใดตัวหนึ่งก็ต้องมี format ของตัวเอง ซึ่งใช้ได้กับไฟล์ local เท่านั้น
- skill ที่แค่บอกลำดับคำสั่งของ upstream ให้ผู้ใช้พิมพ์เอง: ต้องการรันครั้งเดียวจบ
- เก็บของเสริมที่ไม่ผูกกับ format (decision log, parked questions, blind-spot pass,
  gate หลังทุก merge): flow ของ upstream ไม่มีสิ่งเหล่านี้และเป็นที่พอใจตามที่เป็น
- ปิด ticket ใน tracker ทันทีหลัง merge เพื่อให้ tracker เป็นบันทึกของรันที่ยังไม่จบ:
  เป็นการ override ขั้นที่ `implement-spec` ปิดงาน และ tracker ที่ปิด ticket
  ผ่าน pull request ทำแบบนั้นไม่ได้

## Consequences / ผลที่ตามมา

- An upstream update reaches both skills through `npx skills update` with no
  merge work. A change in upstream behavior also changes these skills.
- No code checks the tickets: story coverage, blocking edges, and size are
  judged by the person at the `to-tickets` quiz.
- A grilling session that ends before `to-spec` cannot be resumed; only the
  glossary terms and ADRs already written survive.
- Glossary terms and ADRs from every feature are written to tracked files, not
  to `.scratch/<feature>/`.
- A whole ticket set can no longer run on the `agy` or `opencode` backends;
  `agy-agent` still delegates one task at a time.
- A failure shows at the closing `code-review`, not after the merge that
  caused it.
- Runs recorded under the old `status.md` format are not continued.

- update ของ upstream มาถึงทั้งสอง skill ผ่าน `npx skills update` โดยไม่ต้อง merge
  และพฤติกรรมของ upstream ที่เปลี่ยนก็เปลี่ยน skill ทั้งสองด้วย
- ไม่มีโค้ดตรวจ ticket: ผู้ใช้เป็นคนตัดสิน story coverage, blocking edge และขนาด
  ตอน quiz ของ `to-tickets`
- การ grill ที่จบก่อนถึง `to-spec` ทำต่อไม่ได้ เหลือแค่คำใน glossary กับ ADR
  ที่เขียนไปแล้ว
- คำใน glossary และ ADR ของทุก feature ถูกเขียนลงไฟล์ที่ track อยู่ ไม่ใช่ใน
  `.scratch/<feature>/`
- รัน ticket ทั้งชุดบน backend `agy` หรือ `opencode` ไม่ได้อีก ส่วน `agy-agent`
  ยังมอบงานทีละชิ้นได้
- ความผิดพลาดปรากฏตอน `code-review` ท้ายสุด ไม่ใช่หลัง merge ที่ทำให้เกิด
- รันที่บันทึกด้วย `status.md` รูปแบบเดิมจะไม่ถูกทำต่อ
