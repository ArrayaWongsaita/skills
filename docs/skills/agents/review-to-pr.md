# Review To PR

- Category / หมวด: `agents`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/agents/review-to-pr/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

รับ **integration branch** ที่ `implement`, `agy-implement`, หรือ `subagent-implement`
ทิ้งไว้ — หนึ่ง commit ต่อหนึ่ง ticket, test เขียว, แต่ยังไม่มีใคร review — แล้วพาไปจนถึง
สถานะพร้อมเปิด PR โดย agent หลัก (**orchestrator**) ปัก review point, รัน `code-review`
สองแกนเป็น loop ที่มีขอบเขต, จับ blocker เป็น cluster แล้วลง `fix(review):` commit
หนึ่งอันต่อหนึ่ง cluster บน branch เดิม, รัน `scrutinize` เป็น system gate แบบมีเงื่อนไข,
ทำให้ suite เต็มเขียว แล้ว **หยุดก่อนเปิด PR** — การเปิด PR เป็นคำสั่งถัดไปที่รันเอง

ติดตั้ง:

```bash
npx skills add ArrayaWongsaita/skills --skill review-to-pr
```

### ควรใช้เมื่อไร

- มี integration branch จาก `implement` / `agy-implement` / `subagent-implement` ที่
  verify แล้วแต่ยังไม่ได้ review และอยากขับ §8–9 ของ feature-flow ด้วยคำสั่งเดียว
- อยากได้ loop `code-review` สองแกนที่มี budget สามรอบ, การจับ blocker เป็น cluster,
  system `scrutinize` แบบมีเงื่อนไข, และ suite เขียว ด้วยกติกาเดียวกับ implement siblings
- อยากให้ fix ลงเป็น `fix(review):` commit แยก ไม่ยัดกลับเข้า ticket commit

### ไม่ควรใช้เมื่อไร

- ยังไม่มี integration branch ที่ verify แล้ว — รัน `/implement`, `/agy-implement`, หรือ
  `/subagent-implement` ก่อน
- อยากขับทั้ง lifecycle รวมทั้ง discovery และ spec — ใช้ `/engineering-workflow`
- อยาก review `spec.md` ก่อนแตก ticket — นั่นคือ Design Review Gate ของ
  `grill-to-tickets`
- เป็น branch แก้บั๊กหรือ incident — v1 รองรับเฉพาะ feature integration branch
- อยากให้เปิด PR ให้ด้วย — skill นี้ปริ้นต์คำสั่ง `/pr-to-dev` แต่ไม่รันเอง

### วิธีทำงานหลัก

เรียก `/review-to-pr` จาก integration branch (หรือ `/review-to-pr <ref>` เพื่อ override
review point, `/review-to-pr <slug>` เพื่อระบุ feature directory)

1. **Stage 0 — ปัก review point (read-only)**: preflight tree สะอาด, resolve review
   point (`<ref>` ที่ระบุ ไม่งั้น `git merge-base main HEAD`), resolve slug + spec
   source, เขียน `review-status.md`, หยุดรอ approve
2. **Stage 1 — code-review สองแกน**: รัน `code-review` inline เทียบ review point,
   normalize finding เป็น blocking / non-blocking, blocker → Stage 2, ไม่มี → Stage 3
   (budget สามรอบ, หยุดก่อนถ้ารอบไหนไม่ขยับ) ถ้า repo มี `docs/reuse-catalog.md`
   แกน Standards จะใช้เป็นมาตรฐานด้วย โค้ดที่ซ้ำกับ module ใน catalog หรือไม่ทำตาม
   Rule ของ catalog จะถูกรายงานพร้อมอ้างบรรทัดใน catalog
3. **Stage 2 — แก้ blocker**: จับเป็น cluster, cluster ที่ต้องแตะ test หรือหลายไฟล์ →
   worker + verifier subagent, cluster ไฟล์เดียวไม่แตะ test → แก้ inline, ลง
   `fix(review):` commit หนึ่งอันต่อ cluster แล้วกลับ Stage 1
4. **Stage 3 — system `scrutinize`**: รันเฉพาะเมื่อ diff cross-cutting / risky ตาม
   checklist ADR 0003, normalize verdict, sub-loop `scrutinize → fix → tests →
   code-review → scrutinize` (budget หกรอบ แยกจาก code budget)
5. **Stage 4 — suite เขียว**: verifier สด รัน typecheck เต็มและ test suite เต็มบน
   integration branch, red → blocker ใหม่กลับ Stage 2
6. **Stage 5 — handoff**: ปริ้นต์ branch, verdict, `fix(review):` commit, บรรทัด suite
   เขียว, และคำสั่ง `/retro-to-remedies` ก่อน `/pr-to-dev` — ไม่ push ไม่เปิด PR

sub-command: `continue` resume พร้อม Reality reconciliation, `status` อ่านอย่างเดียว

### ตัวอย่าง prompt

```text
/review-to-pr
```

### ไฟล์ที่เกี่ยวข้อง

- `references/review-point.md` — preflight, resolve review point, resolve slug +
  spec source, `review-status.md` เริ่มต้น, การ pause
- `references/review-loop.md` — การเรียก `code-review` inline สองแกน (รวม Reuse Catalog เป็นมาตรฐานของแกน Standards), การ normalize
  blocking / non-blocking, findings ledger, budget สามรอบ, การหยุดแบบ no-progress
- `references/fix-dispatch.md` — clustering, กติกา dispatch-vs-inline, contract
  worker + verifier ที่ copy จาก `subagent-implement`, `MAX_FIX_ATTEMPTS = 3`,
  `fix(review):` commit, การจัดการ unfixable
- `references/scrutiny-gate.md` — checklist cross-cutting / risky, การรัน
  `scrutinize` inline, การ normalize verdict, sub-loop ที่ code-review ไม่ข้าม,
  budget หกรอบอิสระ
- `references/status-and-resume.md` — field set `review-status.md`, halt / partial
  report, `continue` (Reality reconciliation), `status`
- `evals/evals.json` — เคสพฤติกรรม หนึ่งเคสต่อ decision branch, รูปแบบ benchmark ของ
  `skill-creator`
- `evals/trigger-evals.json` — กันไม่ให้ description อ่านเหมือน model-invocable

## English / ภาษาอังกฤษ

### Purpose

Take the **integration branch** that `implement`, `agy-implement`, or
`subagent-implement` left — one verified commit per ticket, tests green, nobody
has reviewed it — and drive it to a PR-ready state. The main agent — the
**orchestrator** — pins the review point, runs the two-axis `code-review` as a
bounded loop, clusters the blockers and lands one `fix(review):` commit per
cluster on the branch in place, runs a conditional system `scrutinize` gate, gets
the full test suite green, and **stops before the PR**. Opening the PR is the next
command, run by hand.

It is `engineering-workflow`'s feature-flow §8–9 split out standalone, the same
way `grill-to-tickets` is §1–3 and `subagent-implement` is §7.

Install with:

```bash
npx skills add ArrayaWongsaita/skills --skill review-to-pr
```

### Use it when

- You have a verified-but-unreviewed integration branch from `implement`,
  `agy-implement`, or `subagent-implement` and want feature-flow §8–9 as one
  command with the same budgets and stop rules.
- You want the bounded two-axis `code-review` loop, blocker clustering, the
  conditional system `scrutinize`, and a green full suite run the same way every
  time.
- You want review fixes to land as their own `fix(review):` commits rather than
  folded back into the ticket commits.

### Do not use it when

- There is no verified integration branch yet — run `/implement`,
  `/agy-implement`, or `/subagent-implement` first.
- You want the full lifecycle including discovery and specification — use
  `/engineering-workflow`.
- You want a design review of a `spec.md` before tickets — that is
  `grill-to-tickets`'s Design Review Gate.
- The branch is a bug fix or an incident — v1 accepts feature integration
  branches only.
- You want the PR opened for you — this skill prints the `/pr-to-dev` command and
  runs no PR step.

### Main workflow

Invoke `/review-to-pr` from the integration branch (or `/review-to-pr <ref>` to
override the review point, `/review-to-pr <slug>` to name the feature directory).

1. **Stage 0 — Pin the review point (read-only)**: preflight a clean tree,
   resolve the review point (an explicit `<ref>`, else `git merge-base main
   HEAD`), resolve the slug and spec source, write `review-status.md`, and pause
   for approval.
2. **Stage 1 — Two-axis code-review**: run `code-review` inline against the
   review point, normalize each finding to blocking or non-blocking, route
   blockers to Stage 2 and a clean review to Stage 3 (three-cycle budget, early
   stop on a no-progress cycle). When the repository has `docs/reuse-catalog.md`,
   the Standards axis reviews against it too, so a new module duplicating a
   catalogued one, or code bypassing a catalog Rule, is a cited violation.
3. **Stage 2 — Fix the blockers**: cluster the blockers; a cluster that needs a
   test or touches several files goes to a worker + verifier subagent, a
   one-file no-test cluster is applied inline; land one `fix(review):` commit per
   cluster and return to Stage 1.
4. **Stage 3 — System scrutinize**: run `scrutinize` inline only when the diff is
   cross-cutting or risky by the ADR 0003 checklist, normalize the verdict, and
   drive the sub-loop `scrutinize → fix → tests → code-review → scrutinize` on
   its own six-cycle budget.
5. **Stage 4 — Full suite green**: a fresh verifier runs the whole typecheck and
   the whole test suite on the integration branch; a red suite is a new blocker
   back to Stage 2.
6. **Stage 5 — Handoff**: print the branch, the verdicts, the `fix(review):`
   commits, the green-suite line, and the `/retro-to-remedies` command on the
   line before `/pr-to-dev`. It never pushes or opens a PR.

Sub-commands: `continue` resumes with Reality reconciliation; `status` is
read-only.

### Example prompt

```text
/review-to-pr
```

### Related files

- `references/review-point.md` — the preflight, review-point resolution, feature
  slug and spec-source resolution, the initial `review-status.md`, and the pause
- `references/review-loop.md` — the inline two-axis `code-review` call
  (including the Reuse Catalog as a Standards-axis source), blocking vs
  non-blocking normalization, the findings ledger, the three-cycle budget, and
  the no-progress early stop
- `references/fix-dispatch.md` — clustering, the dispatch-vs-inline rule, the
  worker + verifier contract copied from `subagent-implement`,
  `MAX_FIX_ATTEMPTS = 3`, the `fix(review):` commit, and unfixable handling
- `references/scrutiny-gate.md` — the cross-cutting / risky checklist, the inline
  `scrutinize` pass, verdict normalization, the never-skipped code-review in the
  sub-loop, and the independent six-cycle budget
- `references/status-and-resume.md` — the `review-status.md` field set, the halt
  / partial report, `continue` (Reality reconciliation), and `status`
- `evals/evals.json` — behavioral cases, one per decision branch, in
  `skill-creator`'s benchmark format; run on demand, not in CI
- `evals/trigger-evals.json` — guards that the skill's description does not read
  as model-invocable (the skill is `disable-model-invocation`)
