# ADR 0023: Implement Tickets is a minimal serial core

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-10-02
- Supersedes / แทนที่: ADR 0020 decisions 2 and 4 (adapters and the parallel validation gate); ADR 0021 in full (touch-set drift, drain rounds, parked tickets, serial-by-default); ADR 0022 decision 1 (`--strict`) / ADR 0020 ข้อ 2 และ 4 (adapter และ gate การ validate parallel), ADR 0021 ทั้งฉบับ (touch-set drift, drain round, ticket ที่พักไว้, serial เป็นค่าเริ่มต้น) และ ADR 0022 ข้อ 1 (`--strict`)
- Keeps / คงไว้: ADR 0020 decisions 1 and 3 (one core, retire the standalone core), ADR 0022 decisions 2–4 (risk-based verification, worker evidence, `Risk: high` in tickets)

## Context / บริบท

`implement-tickets` grew to about 2,100 lines: seven run options, three
subcommands, an adapter contract with an envelope schema, a parallel wave
planner, touch-set conflict handling with drain rounds and parked tickets, and a
strict switch. The owner never uses `--parallel` (large tasks collide on shared
configuration, so waves stay width one) and never uses `--with`. Parallel mode
was also never validated (ADR 0020 decision 4). Every unused path still costs
context on each run, a test surface that multiplies across backend, mode,
strictness and resume, and sediment that hides the working core.

`implement-tickets` โตเป็นราว 2,100 บรรทัด: option เจ็ดตัว, subcommand สามตัว,
adapter contract พร้อม envelope schema, parallel wave planner, การจัดการ touch-set
conflict ด้วย drain round และ ticket ที่พักไว้ และสวิตช์ strict เจ้าของไม่เคยใช้
`--parallel` (งานใหญ่ชนกันที่ config ร่วม wave จึงกว้างแค่หนึ่ง) และไม่เคยใช้ `--with`
อีกทั้ง parallel ไม่เคยผ่านการ validate (ADR 0020 ข้อ 4) ทุกเส้นทางที่ไม่ได้ใช้ยังกิน context
ในทุก run เพิ่มพื้นที่ทดสอบที่คูณกันตาม backend, mode, strictness และ resume
และเป็น sediment ที่บังแกนที่ทำงานจริง

## Decision / การตัดสินใจ

1. The core runs tickets serially in ascending ticket number: one native worker
   in an isolated worktree, an optional fresh verifier, a squash-merge onto
   `implement-tickets/<slug>`, then the full typecheck and test suite, before the
   next ticket starts. Blockers always have lower numbers, so ticket order is the
   dependency order and no wave planner is needed.
2. The only backend is native harness subagents. Remove `--with`, `--agent`,
   `--model`, the adapter contract, the envelope schema, adapter lookup in
   preflight, and the adapter-owned worktrees. `agy-implement` and
   `opencode-implement` stay separate skills for other backends.
3. Remove `--parallel`, `--concurrency`, `--serial`, the parallel validation
   procedure and marker, the concurrency cap, and background dispatch with
   timeouts. A parallel mode returns only as its own decision with evidence that
   it pays for itself.
4. Remove `--strict` and the approval pause. The run prints the Plan and starts.
   A fresh verifier runs only for risky tickets under ADR 0022 decision 2; the
   risk signals are a counted retry, measured touch-set extras, an unknown touch
   set, and incomplete evidence.
5. Touch-set extras stay a measured fact and a risk signal. They are listed in
   the handoff. A worker that strays outside its ticket's files for a reason the
   acceptance criteria do not explain is rejected by the orchestrator at the
   cost of one attempt. The deny-list, the five-file cap, parked tickets, hold
   sets, release passes, and drain rounds go.
6. The only subcommand is `continue [slug]`. `status.md` is a plain run record
   a person reads directly; `status` and `list` go. The run record drops usage
   totals, session IDs, and budget estimates.

1. core รัน ticket แบบ serial ตามเลข ticket จากน้อยไปมาก: worker native หนึ่งตัวใน
   worktree แยก, verifier ใหม่ (เมื่อจำเป็น), squash-merge ลง `implement-tickets/<slug>`
   แล้วรัน typecheck และ test suite เต็ม ก่อนเริ่ม ticket ถัดไป blocker เลขน้อยกว่าเสมอ
   ลำดับเลขจึงเป็นลำดับ dependency และไม่ต้องมี wave planner
2. backend เดียวคือ native harness subagent ลบ `--with`, `--agent`, `--model`,
   adapter contract, envelope schema, การค้นหา adapter ใน preflight และ worktree
   ที่ adapter เป็นเจ้าของ `agy-implement` กับ `opencode-implement` ยังเป็น skill แยกสำหรับ backend อื่น
3. ลบ `--parallel`, `--concurrency`, `--serial`, ขั้นตอนและ marker การ validate parallel,
   concurrency cap และ background dispatch พร้อม timeout parallel กลับมาได้ในฐาน
   การตัดสินใจใหม่ที่มีหลักฐานว่าคุ้มเท่านั้น
4. ลบ `--strict` และการหยุดรออนุมัติ run พิมพ์ Plan แล้วเริ่มทำงาน ใช้ verifier ใหม่เฉพาะ
   ticket ที่เสี่ยงตาม ADR 0022 ข้อ 2 สัญญาณเสี่ยงคือ retry ที่นับ, extras ที่วัดได้,
   touch set ที่ไม่ทราบ และหลักฐานไม่ครบ
5. touch-set extras ยังเป็นข้อเท็จจริงที่วัดและเป็นสัญญาณเสี่ยง และแสดงใน handoff
   ถ้า worker แตะไฟล์นอก ticket โดยเกณฑ์ยอมรับอธิบายไม่ได้ orchestrator ปฏิเสธโดยนับหนึ่ง attempt
   deny-list, cap ห้าไฟล์, ticket ที่พักไว้, hold set, release pass และ drain round ถูกลบ
6. subcommand เดียวคือ `continue [slug]` `status.md` เป็นบันทึกที่คนอ่านตรง ๆ
   ลบ `status` และ `list` และตัดยอด usage, session ID และ budget estimate ออกจากบันทึก

## Rejected alternatives / ทางเลือกที่ปฏิเสธ

- Keep `--parallel` hidden behind a reference: it still needs the planner,
  conflict rules, and tests, and its value is unproven.
- Keep `--strict` as an approval-only flag: `--strict` was the cheapest of the
  removed options, but the owner can read the printed Plan and interrupt, so the
  pause did not earn a second mode.
- Keep the deny-list: it guarded unattended parallel drift; in a serial run the
  orchestrator sees each ticket's measured extras and the verifier runs on them.

- เก็บ `--parallel` ไว้หลัง reference: ยังต้องมี planner, กฎ conflict และ tests
  ทั้งที่ประโยชน์ยังไม่พิสูจน์
- เก็บ `--strict` เป็น flag อนุมัติอย่างเดียว: เป็น option ที่ถูกที่สุดในกลุ่มที่ลบ
  แต่เจ้าของอ่าน Plan ที่พิมพ์และขัดจังหวะได้ การหยุดรอจึงไม่คุ้มกับโหมดที่สอง
- เก็บ deny-list: มันกัน drift ของ run ขนานที่ไม่มีคนเฝ้า ใน run แบบ serial
  orchestrator เห็น extras ที่วัดได้ของทุก ticket และ verifier ตรวจให้

## Consequences / ผลที่ตามมา

- The skill and its references shrink to one path to read and test; a first run
  of independent tickets is slower than a working parallel mode would be.
- Extras that touch lockfiles, CI workflows, or ADRs are no longer blocked by a
  rule: they make the ticket risky, so a fresh verifier runs, and the handoff
  lists them for review.
- Runs recorded under the old format are refused by `continue`; recover them
  from git history or start over.
- `grill-to-tickets` handoff text no longer mentions `--with`; the `review-to-pr`
  copy of the worker and verifier contract never named the removed options and
  stays as is.

- skill และ references เหลือเส้นทางเดียวที่ต้องอ่านและทดสอบ run แรกของ ticket
  ที่เป็นอิสระต่อกันช้ากว่า parallel ที่ใช้ได้จริง
- extras ที่แตะ lockfile, CI workflow หรือ ADR ไม่ถูกกฎบล็อกอีก แต่ทำให้ ticket เสี่ยง
  จึงมี verifier ใหม่ตรวจ และ handoff แสดงรายการให้ตรวจตอน review
- run ที่บันทึกด้วยรูปแบบเดิมถูก `continue` ปฏิเสธ ให้กู้จาก git history หรือเริ่มใหม่
- ข้อความ handoff ของ `grill-to-tickets` ไม่พูดถึง `--with` อีก ส่วนสำเนา contract
  worker/verifier ใน `review-to-pr` ไม่เคยอ้างถึง option ที่ถูกลบ จึงคงไว้ตามเดิม
