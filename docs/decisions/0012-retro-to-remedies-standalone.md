# ADR 0012: retro-to-remedies is a standalone skill between review-to-pr and pr-to-dev

- Date / วันที่: 2026-09-24

## Status / สถานะ

Accepted / ยอมรับแล้ว

ยอมรับแล้ว — `retro-to-remedies` เป็น skill แบบ standalone ตั้งอยู่ระหว่าง `review-to-pr` และ `pr-to-dev`

## Context / บริบท

Every completed Run in the engineering workflow (`grill-to-tickets` → implementer → `review-to-pr`) records friction, findings, and lessons into `.scratch/<feature-slug>/` artifacts. In practice, these records often languish in temporary files, failing to improve future runs. Without a dedicated step to harvest these lessons and update the environment, future runs repeatedly encounter the exact same failures.

ทุก Run ที่เสร็จสิ้นจะทิ้งประวัติการทำงานและข้อผิดพลาดไว้ใน `.scratch/<feature-slug>/` แต่บทเรียนเหล่านั้นมักหยุดอยู่แค่นั้น ไม่ถูกนำมาเปลี่ยนเป็น automated check หรือข้อกำหนดใหม่ ทำให้ agent ตัวถัดไปต้องเผชิญกับข้อผิดพลาดเดิมซ้ำๆ

## Decision / การตัดสินใจ

1. **Standalone Architecture**: Build `retro-to-remedies` as a fully standalone skill under `skills/agents/retro-to-remedies/`, which is the only tracked copy ([ADR 0011](0011-keep-planning-notes-and-installed-skills-local.md) keeps installed copies out of the repository). It operates independently from other skills and owns its own run-state parsers.
2. **Placement in the Pipeline (ADR 0004)**: Place the skill between `review-to-pr` and `pr-to-dev` on the integration branch. This ensures all primary sources are finalized before retro analysis begins. Applied text remedies are committed directly on the branch as `chore(retro): <remedy>`, allowing the eventual pull request to carry both the feature changes and the environmental improvements. Refuse invocation on `main`, `master`, or `dev`.
3. **Classification Rule (ADR 0001)**: Classify misses deterministically. Mechanical misses become automated Checks. Judgement misses become Standards in `CODING_STANDARDS.md` or Reuse Catalog rules. Navigation issues become Pointers in `AGENTS.md`. Stale instructions become Prunes. Missing tools or context become Access remedies. Skill issues become Skill fixes.
4. **Text Remedies vs Code Remedies (ADR 0002)**: The retro directly applies and commits only Text remedies (Standards, Pointers, Prunes) upon user confirmation. Code remedies (Checks, Skill fixes, Access) require implementation and testing, so they are handed off as `/grill-to-tickets` prompts rather than built ad-hoc during the retro.
5. **Durable Retro Log (ADR 0003)**: Maintain a per-project ledger at `docs/retro-log.md` recording all proposed remedies, underlying misses, and human decisions. This prevents re-proposing declined items and provides the primary signal for identifying recurrence and failed remedies.

## Consequences / ผลที่ตามมา

### Positive / ข้อดี

- Closes the learning loop: lessons from finished runs directly strengthen the project environment.
- Mechanical rules become automated checks rather than expensive prompt context.
- Pull requests carry the feature code alongside its retro-derived standards and documentation pointers.
- Stable tracking across runs through `docs/retro-log.md`.

### Trade-offs / ข้อแลกเปลี่ยน

- Adds one additional step to the feature lifecycle before opening a PR.
- Code remedies must go through a separate `/grill-to-tickets` cycle rather than applying immediately.

## Rejected Alternatives / ทางเลือกที่ไม่เลือก

- **Fold into `review-to-pr` as a final stage**: Rejected because `review-to-pr` is already complex, and retries/retros must be runnable on older runs that did not pass through `review-to-pr`.
- **Run after PR merge on a separate branch**: Rejected because it separates the lesson from the motivating pull request and incurs extra branching overhead.
- **Apply code remedies directly within the retro**: Rejected because checks and skill fixes require rigorous test-driven implementation and review loops.
