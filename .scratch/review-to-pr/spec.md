# review-to-pr — Specification

Feature slug: `review-to-pr`. Glossary: [CONTEXT.md](CONTEXT.md). Decisions:
[adr/0001](adr/0001-standalone-feature-flow-8-9-split.md),
[adr/0002](adr/0002-fix-commits-per-blocker-cluster.md),
[adr/0003](adr/0003-system-scrutinize-conditional-on-risk.md),
[adr/0004](adr/0004-review-point-merge-base-with-main.md). Repo ADR:
[docs/decisions/0006](../../docs/decisions/0006-review-to-pr-standalone.md).

## Problem Statement

`implement`, `agy-implement`, and `subagent-implement` all stop at the same
place: a verified integration branch — one commit per ticket, tests green — that
nobody has reviewed. Each one hands off with the same line, `/code-review since
<merge-base with main>` then `/scrutinize`, and leaves the rest to me.

Doing "the rest" by hand is a loop I run the same way every time: two-axis
code-review against the merge-base, triage the blockers, fix them, re-review,
decide whether the change is cross-cutting enough to warrant a system
`scrutinize`, run that sub-loop if so, get the full suite green, and only then
open the PR. It is `engineering-workflow`'s feature-flow §8–9, and I want it as
one command with the same budgets, the same stall rules, and the same
"stops before the PR" discipline the implement siblings already have.

## Solution

`/review-to-pr` (from the integration branch, no argument) or
`/review-to-pr <ref>` to override the review point or `/review-to-pr <slug>` to
name the feature directory. Options: `--agent <name>` pins the fix-worker
subagent type; `--model <id>` is a raw pass-through, omitted by default.

The **orchestrator** works in six stages:

0. **Pin the review point (read-only).** Preflight a clean tree on the
   integration branch. Resolve the review point — an explicit `<ref>` wins,
   otherwise `git merge-base main HEAD`. Resolve the feature slug (an explicit
   `<slug>`, else the branch-name stem, else the most recent `.scratch/*/`
   named back) and load `spec.md` + `issues/` for the Spec axis if they exist;
   with neither, the Spec axis runs against the commit messages alone and the
   handoff says so. Write `review-status.md`. Present the review point, the
   commit/file counts, and the spec source, and pause for approval.
1. **Two-axis code-review.** Run `code-review` inline against the review point —
   Standards axis and Spec axis as parallel sub-agents. Normalize each finding
   to blocking or non-blocking (`gates.md` rules). Blockers → Stage 2; none →
   Stage 3.
2. **Fix the blockers.** Group blockers into clusters. A cluster needing a new
   or changed test, or spanning more than one file, goes to a test-first
   **worker** subagent and a fresh **verifier** (the `subagent-implement`
   contract); a one-file no-test-change cluster is hand-applied inline. Run the
   affected tests and the typecheck. Land each cluster as one `fix(review):
   <summary>` commit on the integration branch. Return to Stage 1. Budget: three
   code-review cycles is the ceiling; a cycle that resolves no blocker and turns
   up nothing new ends the loop early.
3. **System scrutinize — only if cross-cutting or risky.** Judge the integrated
   diff against the checklist in ADR 0003. Not cross-cutting → skip, note it,
   go to Stage 4. Cross-cutting → run `scrutinize` inline end-to-end, normalize
   the closing verdict (`ship` / `fix-then-ship` / `rework` / `reject`). A
   non-`ship` verdict enters the sub-loop `scrutinize → fix → tests or typecheck
   → code-review → scrutinize` (the code-review step is never skipped). Budget:
   six scrutinize cycles is the ceiling, independent of the code budget; the
   same blocking findings surviving two consecutive cycles end it early.
4. **Full suite green.** A fresh verifier runs the whole typecheck and the whole
   test suite on the integration branch. Red → the failure is a new blocker,
   back to Stage 2 (one code cycle).
5. **Handoff.** Print the integration branch name, the code-review and
   scrutinize verdicts, the green-suite confirmation, the `fix(review):` commits
   added, and the `/pr-to-dev` command for a fresh context. The run performs no
   PR step — no `git push`, no `gh`, no `/pr-to-dev` — the same terminal stance
   `subagent-implement` takes toward `/code-review`. Opening the PR is the next
   command, run by hand.

`/review-to-pr continue` resumes with Reality reconciliation; `/review-to-pr
status` is read-only.

## User Stories

1. As a developer, I want to run `/review-to-pr` on the branch
   `subagent-implement` / `agy-implement` / `implement` left me, with no
   argument, and have it review the whole feature against the merge-base with
   `main`.
2. As a developer, I want to override the review point with `/review-to-pr
   <ref>` and name the feature directory with `/review-to-pr <slug>` when the
   branch name does not match the `.scratch/` slug.
3. As a developer, I want the skill to refuse to start unless I invoked it
   explicitly (`/review-to-pr` or `$review-to-pr`).
4. As a developer, I want Stage 0 to be read-only — a clean-tree preflight, a
   pinned review point recorded in `review-status.md`, and a pause for my
   approval before any fix is made.
5. As a developer, I want the two-axis `code-review` run against the pinned
   review point, its Standards and Spec findings reported side by side, and each
   finding sorted into blocking or non-blocking by the `gates.md` rules.
6. As a developer, I want blockers grouped into clusters and each cluster landed
   as exactly one `fix(review):` commit appended to the integration branch,
   never folded into a ticket commit.
7. As a developer, I want a cluster that needs a test or touches several files
   dispatched to a test-first worker and checked by a fresh verifier, so the
   fix work stays out of the orchestrator's context; a trivial one-file fix
   applied inline.
8. As a developer, I want a fix that fails its worker three times left as an
   open blocker — recorded, not hand-coded around — and named in the handoff as
   "not PR-ready".
9. As a developer, I want the code-review loop bounded to three cycles, and a
   cycle that makes no progress — no blocker resolved, nothing new found — to
   end it early with a report.
10. As a developer, I want the system `scrutinize` pass to run only when the
    integrated change is cross-cutting or risky by the ADR 0003 checklist, and
    the handoff to state whether it ran and why.
11. As a developer, I want a non-`ship` scrutinize verdict to drive the sub-loop
    `scrutinize → fix → tests → code-review → scrutinize` on its own independent
    six-cycle budget, with the code-review step never skipped.
12. As a developer, I want the full typecheck and full test suite run on the
    integration branch as the last gate, and a red suite treated as a new
    blocker rather than a silent pass.
13. As a developer, I want the handoff to give me the branch, the verdicts, the
    fix commits, and the `/pr-to-dev` command — and to push nothing and open no
    PR; opening the PR is a separate command I run next.
14. As a developer, I want run state in `.scratch/<slug>/review-status.md` and
    `/review-to-pr continue` to reconcile against reality — re-run the suite,
    re-open any finding whose fix no longer holds — before resuming.
15. As a developer, I want `/review-to-pr status` to report the cycle history
    and the findings ledger without mutating anything.

## Implementation Decisions

- **Name** `review-to-pr`. Location `skills/agents/review-to-pr/`, mirrored
  byte-identical to `.agents/skills/review-to-pr/`. Human guide at
  `docs/skills/agents/review-to-pr.md`. Symlink
  `.claude/skills/review-to-pr → ../../.agents/skills/review-to-pr`.
- **Invocation** explicit only: `disable-model-invocation: true` +
  `agents/openai.yaml` `allow_implicit_invocation: false`. Sub-commands
  `continue`, `status`.
- **Argument** optional. An argument that `git rev-parse --verify` resolves is
  the review-point override; otherwise it is a feature slug for
  `.scratch/<slug>/`. No argument → integration branch is the current branch,
  review point is `git merge-base main HEAD`, slug is the branch-name stem
  (`subagent-implement/foo` → `foo`) or the most recent `.scratch/*/` named
  back to the user.
- **Pure prompt, no scripts.** Review-point resolution, blocker normalization,
  clustering, the cross-cutting judgment, and verdict normalization are prose
  the orchestrator follows. `references/` holds the procedures; `SKILL.md` holds
  the workflow.
- **Reference set** (5): `review-point.md`, `review-loop.md`, `fix-dispatch.md`,
  `scrutiny-gate.md`, `status-and-resume.md`.
- **Review point** default `git merge-base main HEAD`, pinned for the run,
  recorded in `review-status.md`, reused verbatim by `continue` (ADR 0004).
- **Code-review** inline `code-review` against the review point, unchanged —
  two parallel axes, reported side by side, not reranked. Blocking vs
  non-blocking per `gates.md` "Code normalization".
- **Code budget** three cycles is the ceiling; one completed two-axis review
  consumes one; a no-progress cycle (no blocker resolved, nothing new found)
  ends the loop before the ceiling. `feature-flow.md` §8 sets the ceiling; the
  no-progress early stop is this skill's, because a fix cycle that moved nothing
  will not move on a retry.
- **Fix dispatch** a cluster with a test change or >1 file → worker subagent
  (`isolation: "worktree"`, worker branch `review-to-pr/<slug>/fix-<n>` cut from
  integration `HEAD`, self-contained test-first prompt) + fresh `Explore`
  verifier returning raw evidence; the orchestrator judges. A one-file
  no-test-change cluster is applied inline, with the affected tests + typecheck
  run inline as the sanctioned context cost. `MAX_FIX_ATTEMPTS = 3`; the same
  worker resumed via `SendMessage`; a crash counts as one attempt.
- **Fix commit** one `fix(review): <summary>` per cluster, appended to the
  integration branch in the order fixes are made (ADR 0002). A dispatched fix
  is squash-merged from its worker branch as that one commit.
- **System gate** conditional on the cross-cutting / risky checklist (ADR
  0003); when it runs, inline `scrutinize` end-to-end over `git diff
  <review-point>...HEAD`, verdict normalized to `ship` / `fix-then-ship` /
  `rework` / `reject`, sub-loop `scrutinize → fix → tests or typecheck →
  code-review → scrutinize`. Independent six-cycle ceiling; the same blocking
  findings surviving two consecutive cycles end it early (the `design-review-
  gate.md` stall rule). The intra-sub-loop `code-review` is a gate check that
  consumes a scrutinize cycle, not a code cycle.
- **Full suite** a fresh `Explore` verifier runs the whole typecheck and whole
  suite on the integration branch `HEAD` before handoff; red → new blocker,
  back to Stage 2. If the code ceiling is already spent, stop and report the red
  suite as unresolved — not PR-ready.
- **review-status.md** fields: `review_point`, `feature_slug`,
  `integration_branch`, `spec_source`, `stage`, `code_cycles`,
  `scrutinize_cycles`, a `findings` ledger (`{id, axis, status: open |
  resolved | stalled | unfixable, cluster}`), and the `fix_commits` list. No
  per-turn state header; the file is the whole record.
- **Handoff** prints the branch, verdicts, fix commits, green-suite line, and
  `/pr-to-dev`. It runs no `git push`, no `gh`, and no PR step — opening the PR
  is the next command, run by hand.
- **Argument-is-both** an argument that resolves as a git ref *and* names a
  `.scratch/<slug>/` directory is taken as the review-point override; the slug
  then falls back to the branch stem.
- v1 accepts feature integration branches only.

## Testing Decisions

`review-to-pr` is a prompt document with no executable code, so tests exercise
**external behaviour only**: given a scenario (an integration branch + a review
point + a described `code-review` / `scrutinize` result), does the orchestrator
pin the right review point, make the right blocking / non-blocking call, cluster
and commit fixes the right way, run or skip the system gate correctly, and stop
where it should. Tests assert on observable choices — the pinned review point,
which findings block, dispatch vs inline, whether the system gate runs, whether
the loop ends early or continues, that it never opens a PR — never on wording.

The **eval harness** is the one seam (`evals/evals.json`, one case per decision
branch; `evals/trigger-evals.json` for routing). Anything below it (real
subagent dispatch, `isolation: "worktree"`, `SendMessage` resume) is covered by
the first-use confirmation checklist in `references/fix-dispatch.md`, not by an
eval — the same contract `subagent-implement` confirms. `tests/review-to-pr-
contract.test.mjs` and `tests/review-to-pr-evals.test.mjs` guard the `.agents/`
mirror, the reference-set agreement, positive steering, and drift between the
skill prose and the eval claims — the same shape as the `subagent-implement`
and `agy-implement` contract tests.

Named contract seams for the implement pass:

- Canonical + mirror `SKILL.md` byte-identical; frontmatter `name` =
  `review-to-pr`; `disable-model-invocation: true`; description ≥ 80 chars and
  naming the span (review, blocker, scrutinize, suite, PR / handoff).
- `agents/openai.yaml` in both copies with `display_name`, `short_description`,
  `$review-to-pr` in `default_prompt`, `allow_implicit_invocation: false`.
- The five reference files: linked from `SKILL.md`, shipped (nothing extra),
  byte-identical across copies, listed in the guide.
- `docs/decisions/0006-review-to-pr-standalone.md` named in `SKILL.md` and
  bilingual (`# ADR 0006:` / `## Status` / `## Context` / `## Decision` /
  `## Consequences`, each with a Thai line).
- Bilingual guide: `## ภาษาไทย / Thai` + `## English / ภาษาอังกฤษ` sections and
  `npx skills add ArrayaWongsaita/skills --skill review-to-pr`.
- Skill body steers positively — no `Never` / no `Do not`.
- Sub-commands `continue` and `status` documented; `--agent` and `--model`
  documented; Stage 0–5 headings present.
- `evals/evals.json` `skill_name` = `review-to-pr`, unique ids/names, every
  `prompt` carries `/review-to-pr` or `$review-to-pr`; `trigger-evals.json` has
  positive and negative cases, negatives never using an explicit invocation.

## Out of Scope

- Running `/pr-to-dev`, `gh`, or `git push` — the handoff prints the command;
  the run performs no PR step.
- Issue-tracker mutation.
- Bug-fix and incident branches — v1 accepts feature integration branches only.
- The design-review gate on a `spec.md` — that is `grill-to-tickets` /
  `grill-with-docs` Phase 2. This skill's `scrutinize` pass is the system gate
  on integrated code.
- Parallel fix dispatch — v1 fixes clusters serially.
- Inferring a target branch other than `main` from remote HEAD or CI config —
  a non-`main` target needs the explicit `<ref>` argument.
- Folding `fix(review):` commits into ticket commits (ADR 0002).
- A `list` sub-command — deferred follow-up.
- Modifying `engineering-workflow`, `grill-to-tickets`, `agy-implement`,
  `subagent-implement`, `mattpocock/skills` files, or `skills-lock.json`.

## Further Notes

### First-use confirmation checklist

Assumptions about the harness's Agent / Task tool, confirmed on the first real
fix dispatch and folded back into `references/fix-dispatch.md` (identical to
`subagent-implement`'s list, because the contract is copied):

1. A non-fork subagent dispatched in the background re-invokes the orchestrator
   on completion.
2. `isolation: "worktree"` keeps a worktree that has commits, path + branch
   recoverable by the orchestrator.
3. `SendMessage` resumes a backgrounded worker with its context intact.
4. Whether the final report carries token usage (bonus for `review-status.md`).
5. `Explore` reads deeply enough to summarise a test diff; if not, the verifier
   becomes `general-purpose` instructed to write nothing.

### Relationship to the implement siblings

`review-to-pr` names `implement`, `agy-implement`, and `subagent-implement` as
its three upstreams. `implement` and `agy-implement` are on `main` today;
`subagent-implement` lands with its own PR (repo ADR 0005). The prose references
are skill-name mentions, not file links, so `review-to-pr` builds and validates
from `main` regardless of merge order.

### Deferred follow-ups

- Parallel fix dispatch with a per-batch re-review.
- `list` sub-command across every `.scratch/*/review-status.md`.
- Shared-`references/` refactor across `agy-implement`, `subagent-implement`,
  and `review-to-pr` once the shared parts stabilise.
- Bug-flow / incident-branch support.
- `engineering-workflow` §8–9 delegate wiring, if `engineering-workflow`
  survives.
