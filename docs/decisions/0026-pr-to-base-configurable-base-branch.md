# ADR 0026: pr-to-dev becomes pr-to-base with a configurable base branch

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-10-03

## Context / บริบท

`pr-to-dev` hard-coded `dev` as the Pull Request target in its name, every
state, and its report, so a repository that integrates into `main`,
`release/*`, or `staging` could not use the safety workflow.

`pr-to-dev` ฝัง `dev` เป็นเป้าหมายของ PR ไว้ทั้งในชื่อ ทุก state และรายงาน ทำให้ repo ที่ integrate
เข้า `main`, `release/*` หรือ `staging` ใช้ workflow ที่ปลอดภัยนี้ไม่ได้

## Decision / การตัดสินใจ

1. Rename the skill to `pr-to-base` (`skills/git/pr-to-base`, `/pr-to-base`,
   `$pr-to-base`); no alias is kept.
2. The target is `<base>`, resolved once in PREFLIGHT: an explicit argument or
   branch named in the request wins, otherwise **`dev`**. It is never inferred
   from the repository default branch, upstream, or an existing PR.
3. Every `origin/dev` rule becomes `origin/<base>`; `<base>` joins `dev`,
   `main`, and `master` as a protected branch. A missing `origin/<base>` stops
   the run with no fallback.
4. Every safety invariant is unchanged: no merge, no force push without an
   exact-SHA lease, selective staging, base-freshness gate.

## Consequences / ผลที่ตามมา

- Callers (`review-to-pr`, `retro-to-remedies` handoffs, guides, tests) now name
  `/pr-to-base`; the default behaviour for `dev` users is identical.
- `.claude/hooks/block-dangerous-git.mjs` still guards only `main`/`master`/`dev`;
  other base branches are protected by the skill's own rules.
- ADR 0015 keeps the old name as a historical record.
