---
name: review-to-pr
description: Pick up a verified-but-unreviewed integration branch where implement, agy-implement, or subagent-implement stopped and drive it to a PR-ready state — pin a review point, run a bounded two-axis code-review loop, cluster the blockers and land each as one fix(review) commit, run a conditional system scrutinize gate, get the full suite green, then hand off the PR command without opening the PR.
disable-model-invocation: true
---

# Review To PR

Take the integration branch that `implement`, `agy-implement`, or
`subagent-implement` left — one verified commit per ticket, tests green, nobody
has reviewed it — and drive it to a PR-ready state. The main agent — the
**orchestrator** — pins the review point, runs each `code-review` and
`scrutinize` pass, judges the findings, dispatches or hand-applies the fixes,
lands one `fix(review):` commit per blocker cluster on the branch in place, gets
the full suite green, and stops at the handoff. The Retro and the PR are the next
commands, run by hand.

This is `engineering-workflow`'s feature-flow §8–9 split out standalone, the same
way `grill-to-tickets` is §1–3 and `subagent-implement` is §7. It carries its own
copy of the review-loop, fix-dispatch, scrutiny-gate, review-point, and
state/resume machinery so it builds and validates on its own.

```
Stage 0: Pin the review point (read-only)   preflight -> review point -> slug + spec
   |                                        write review-status.md
   | (pause: explicit approval, nothing outside .scratch/<slug>/ touched)
   v
Stage 1: Two-axis code-review    code-review inline -> normalize findings -> route
   |  blockers -> Stage 2      no blockers -> Stage 3
   v
Stage 2: Fix the blockers   cluster -> dispatch or inline -> one fix(review): commit
   |  -> back to Stage 1   (code budget: three cycles, early stop on no progress)
   v
Stage 3: System scrutinize -- only if cross-cutting or risky
   |  skip -> Stage 4 with a note      run -> scrutinize inline -> sub-loop
   v
Stage 4: Full suite green   fresh verifier runs the whole typecheck + whole suite
   |  red -> new blocker -> Stage 2
   v
Stage 5: Handoff   branch, verdicts, fix commits, green-suite line
         /retro-to-remedies -> /pr-to-dev, run by hand; no PR step
```

## Invocation

Explicit invocation only:

- Universal / slash command: `/review-to-pr [<ref>|<slug>]`
- Codex command: `$review-to-pr [<ref>|<slug>]`

Run from the integration branch. The argument is optional:

- **omitted** — the integration branch is the current branch, the review point is
  `git merge-base main HEAD`, and the feature slug is the branch-name stem
  (`subagent-implement/foo` → `foo`) or the most recent `.scratch/*/` directory
  named back to you for confirmation.
- **`<ref>`** — an argument that `git rev-parse --verify` resolves is the review
  point override (a commit SHA, branch, or tag).
- **`<slug>`** — otherwise the argument names the feature directory
  `.scratch/<slug>/`.

An argument that resolves as a git ref *and* names a `.scratch/<slug>/` directory
is taken as the review-point override; the slug then falls back to the branch
stem.

Run options, set once at invocation:

- `--agent <name>` — pin every fix-worker subagent to this type for the run.
- `--model <id>` — pass this model to every worker as a raw value. Omitted by
  default, so workers inherit the orchestrator's model and the skill stays
  portable across harnesses.

Codex policy is declared in `agents/openai.yaml`
(`allow_implicit_invocation: false`). Claude Code installations rely on
`disable-model-invocation: true`.
A run or a sub-command begins only on an explicit human invocation.

## Sub-commands

Detailed in [references/status-and-resume.md](references/status-and-resume.md).

- `/review-to-pr continue [slug]` — resume an interrupted run with Reality
  reconciliation: confirm the branch and its recorded `fix(review):` commits
  still exist, re-run `code-review` and the full suite, re-open any finding whose
  fix no longer holds, then resume from the recorded stage.
- `/review-to-pr status [slug]` — the cycle history and the findings ledger,
  read-only.

A `list` sub-command across every `.scratch/*/review-status.md` is a deferred
follow-up.

## Feature-scoped storage

Every run artifact lives under the feature slug.

```
.scratch/<feature-slug>/
├── spec.md            # input, when present: the feature specification for the Spec axis
├── issues/            # input, when present: the ticket set for the Spec axis
├── review-status.md   # run state: review point, cycle history, findings ledger, fix commits
└── prompts/fix-<n>.md # one self-contained worker prompt per dispatched cluster
```

## Stage 0 — Pin the review point (read-only)

Follow [references/review-point.md](references/review-point.md). Stage 0 reads
git and the feature directory and writes only
`.scratch/<feature-slug>/review-status.md` — it mutates nothing else, cuts no
branch, and makes no fix. In short:

1. **Preflight.** The working tree is clean on the integration branch; a dirty
   tree stops and asks, stashing nothing. `main` resolves.
2. **Resolve the review point.** An argument `git rev-parse --verify` resolves
   wins; otherwise `git merge-base main HEAD`. An unresolvable ref or an empty
   `git diff <review-point>...HEAD` halts Stage 0 with the reason named.
3. **Resolve the feature slug and spec source.** Slug: an explicit `<slug>`
   argument, else the branch-name stem, else the most recently modified
   `.scratch/*/` directory named back for confirmation. Load `spec.md` and
   `issues/` for the Spec axis when they exist; with neither, the Spec axis runs
   against the commit messages alone and the handoff records the degraded mode.
4. **Write `review-status.md`** with `review_point`, `feature_slug`,
   `integration_branch`, `spec_source`, and `stage`.
5. **Pause.** Present the review point, the commit and file counts, and the spec
   source, then wait for explicit approval before Stage 1.

## Stage 1 — Two-axis code-review

Follow [references/review-loop.md](references/review-loop.md). Run `code-review`
inline against the review point pinned in Stage 0 — the **Standards axis** and
the **Spec axis** as parallel sub-agents, reported side by side, neither reranked
nor merged. When the repository has a Reuse Catalog (`docs/reuse-catalog.md`),
the Standards axis also reviews against it as a documented standard, so a new
module duplicating a catalogued one — or code bypassing a catalog Rule — is a
cited violation. Normalize each finding to blocking or non-blocking by the
`gates.md` "Code normalization" rule, and record every finding in the ledger.
Route on the result: any blocker → Stage 2; none → Stage 3.

The code budget is **three completed two-axis reviews**. Editing between reviews
consumes no cycle. A cycle that resolves no blocker and turns up nothing new ends
the loop early with a report — a fix cycle that moved nothing will move nothing
on a retry.

## Stage 2 — Fix the blockers

Follow [references/fix-dispatch.md](references/fix-dispatch.md). Group the
cycle's blockers into clusters — one cluster per coherent fix. For each cluster:

- A cluster that needs a new or changed test, or spans more than one file, goes
  to a test-first **worker** subagent (`isolation: "worktree"`, a non-`fork`
  type) and a fresh **verifier** subagent — the worker+verifier contract copied
  from `subagent-implement`.
- A cluster confined to one file with no test change is hand-applied inline, with
  the affected tests and the typecheck run inline as the sanctioned context cost.

Land each cluster as exactly one `fix(review): <summary>` commit appended to the
integration branch, in the order the fixes are made, and record it in
`review-status.md`. `MAX_FIX_ATTEMPTS = 3`: a verification gap resumes the same
worker via `SendMessage` with the specific detail; a crash counts as one attempt.
A cluster that fails three attempts leaves its blockers `unfixable` in the
ledger, keeps its worktree, and is named in the handoff as "not PR-ready". Then
return to Stage 1.

## Stage 3 — System scrutinize — only if cross-cutting or risky

Follow [references/scrutiny-gate.md](references/scrutiny-gate.md). Judge the
integrated diff against the cross-cutting / risky checklist (feature ADR 0003,
spelled out in the reference) — the diff touches routing, a DI container, a root
schema, a migrations directory, shared config, auth, concurrency or locking, or
an on-wire / on-disk format; or it spans many modules; or the code-review loop
surfaced a structural finding.

- **None of those** → skip Stage 3, note "self-contained — skipped" for the
  handoff, go to Stage 4.
- **Otherwise** → run `scrutinize` inline end-to-end over
  `git diff <review-point>...HEAD` and normalize the closing one-liner to exactly
  `ship` / `fix-then-ship` / `rework` / `reject`. `ship` → Stage 4;
  `fix-then-ship` or `rework` → the sub-loop `scrutinize → fix → tests or
  typecheck → code-review → scrutinize`, with the `code-review` step always run;
  `reject` → stop and report the single biggest reason for a human decision.

The scrutinize budget is **six cycles, independent of the code budget**. The same
blocking findings surviving two consecutive cycles end the sub-loop early. The
handoff always records whether the gate ran and why.

## Stage 4 — Full suite green

A fresh `Explore` verifier runs the whole project typecheck and the whole test
suite on the integration branch `HEAD`. Green → Stage 5. Red → the failure is a
new blocker: back to Stage 2 for one code cycle. If the code ceiling is already
spent, stop and report the red suite as unresolved — not PR-ready.

## Stage 5 — Handoff

Print the handoff and stop:

```text
Integration branch <branch> is reviewed.

code-review:  <clean | N fix(review): commits landed>   cycles: <n>/3
scrutinize:   <ran: <checklist item> — <verdict> | self-contained — skipped>
full suite:   green on <HEAD sha>

fix(review): commits added:
  <sha>  fix(review): <summary>
  ...

The next commands, in a fresh context — the Retro, then the PR:
/retro-to-remedies
/pr-to-dev
```

The run performs no PR step — no `git push`, no `gh`, no `/pr-to-dev` — the same
terminal stance `subagent-implement` takes toward `/code-review`. A run that
ended with `unfixable` blockers or a red suite prints the partial report from
[references/status-and-resume.md](references/status-and-resume.md) instead: the
unresolved blockers, the stage reached, the cycles spent, the
`/review-to-pr continue` command, then `/retro-to-remedies` — finishing the Run
stays the primary path.

## State, failure, and resume

Follow [references/status-and-resume.md](references/status-and-resume.md). Run
state lives in `.scratch/<feature-slug>/review-status.md` — `review_point`,
`feature_slug`, `integration_branch`, `spec_source`, `stage`, `code_cycles`,
`scrutinize_cycles`, the `findings` ledger (`{id, axis, status, cluster}`), and
the `fix_commits` list. The file is the whole record; a crash or a closed session
loses nothing.

## Constraints

- The orchestrator's own steps stay text-only — resolve the review point, run
  each `code-review` and `scrutinize` pass, judge the findings, write prompts,
  cluster, commit, write `review-status.md`. The file-heavy work of a real fix —
  reading implementation files, editing across files, running the affected tests
  — goes to a worker subagent, except a one-file no-test cluster applied inline.
- Fix commits are `fix(review):` commits appended to the integration branch, one
  per cluster, in the order the fixes are made. They stay their own commits
  rather than folding into a ticket commit (feature ADR 0002).
- The run performs no PR step — `git push`, `gh`, `/pr-to-dev`, and issue-tracker
  updates are all left for the human. The handoff prints the `/retro-to-remedies`
  and `/pr-to-dev` commands; running them is the next step, by hand.
- Keep `engineering-workflow`, `grill-to-tickets`, `agy-implement`,
  `subagent-implement`, every `mattpocock/skills`-sourced file, and
  `skills-lock.json` exactly as they are — this skill is standalone by design
  (see `docs/decisions/0006-review-to-pr-standalone.md`).
