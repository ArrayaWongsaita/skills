# agy-implement — Feasibility & Design Notes

Status: **exploration / not yet specced**. This is research + a design proposal, not
an implementation plan. The natural next step is to run `/grill-to-tickets` on this
idea to produce the real `spec.md` + tickets.

---

## สรุปภาษาไทย (TL;DR)

- **ทำได้จริง.** `agy` มี primitive ครบทุกอย่างที่ต้องใช้: headless `-p`, JSON
  envelope ที่คืน `conversation_id` + `status` + `usage`, resume session ได้
  (`--conversation <id>`), เลือก model/effort/mode ได้, `--add-dir`, และรัน
  background ขนานกันได้ผ่าน Bash tool ของ agent หลัก
- **ส่วนที่ยากไม่ใช่ CLI** แต่เป็น 3 เรื่อง:
  1. **การรันขนานอย่างปลอดภัย** — ticket 2 ใบที่ "ไม่มี edge ต่อกัน" ในกราฟ ไม่ได้
     แปลว่าแก้ไฟล์คนละไฟล์ ต้องแยก `git worktree` ต่อ ticket แล้ว merge ทีหลัง
     พร้อมด่านตรวจ integration
  2. **การตัดสินว่า parallel ได้ไหม** ต้องดูมากกว่า dependency graph — ต้องเดา
     file touch-set ของแต่ละ ticket ด้วย
  3. **posture เรื่อง permission** ของ agent ที่รันไม่มีคนดู (`--dangerously-skip-permissions`
     vs `--sandbox` vs `--mode accept-edits`)
- **ข้อเสนอ:** สร้าง skill ชื่อ `agy-implement` (ต่อจาก `grill-to-tickets` ตรง ๆ)
  ที่ (1) อ่าน `.scratch/<slug>/issues/`, (2) สร้าง dependency DAG + วางแผน "waves",
  (3) dispatch `agy` — sequential เมื่อมี edge, parallel-in-worktrees เมื่อไม่มี,
  (4) verify acceptance criteria เอง, (5) merge + integration gate, (6) retry มี
  budget, (7) เก็บ state resume ได้
- คำถามที่ต้องให้เจ้าของตัดสิน อยู่ท้ายเอกสาร (§9)

---

## 1. What the skill is for

`grill-to-tickets` ends by publishing a DAG of tracer-bullet tickets under
`.scratch/<feature-slug>/issues/<NN>-<slug>.md` and then **stops**, handing off with:

```
/clear
/implement .scratch/<feature-slug>/issues/01-<first-ticket-slug>.md
```

That handoff assumes a human drives one ticket at a time in a fresh context window.

**`agy-implement` is the alternative terminal target for that handoff.** Instead of
one ticket per human turn, the main agent (Claude Code, "the orchestrator") reads the
whole `issues/` directory, plans an execution order, and dispatches `agy` subagents to
do the implementation — **sequentially when tickets have blocking edges, in parallel
when they don't** — then verifies, integrates, and reports.

It is the multi-agent, parallelizing counterpart of the single-context `implement`
skill.

---

## 2. What already exists in this repo

| Piece | Where | Relevance |
|---|---|---|
| Ticket format & DAG | `.agents/skills/to-tickets/SKILL.md`, `.scratch/grill-to-tickets/issues/*` | Input contract: `# NN: title`, `**Blocked by:**`, `**Status:** ready-for-agent`, `- [ ]` acceptance criteria |
| `grill-to-tickets` | `skills/agents/grill-to-tickets/SKILL.md` | Upstream producer; ends at the `/implement` handoff |
| `engineering-workflow` | `skills/agents/engineering-workflow/` | Pure-prompt control-plane precedent: state header, gate budgets, `MAX_TICKET_ATTEMPTS = 3`, "Sequential Ticket Execution Loop", Reality reconciliation, `.scratch/<slug>/status.md` |
| `implement` (Matt Pocock) | `.agents/skills/implement/SKILL.md` | Single-context baseline: `/tdd` at seams → typecheck → `/code-review` → commit |
| `qwen-agent` (9arm) | GitHub `thananon/9arm-skills/skills/engineering/qwen-agent` | The reference the user cited — see §4 |
| `agy` binary | `/Users/non/.local/bin/agy` | The subordinate agent CLI — see §3 |
| Commit-granularity rule | `~/.claude/.../memory/feature_commit_granularity.md` | "one commit per ticket in a numbered series, in order; commit an uncommitted predecessor first" — the skill must honor this |

`engineering-workflow`'s `feature-flow.md` step 7 already *describes* this loop but
delegates it: *"When subagents are supported (`has_subagents: true`), dispatch an
isolated transient subagent (`self`) per ticket."* `agy-implement` is essentially
**that step, made real, with an external CLI fleet and parallelism** — and could later
be what `engineering-workflow` dispatches to for `IMPLEMENTATION`.

---

## 3. The `agy` interface — verified capabilities

`agy` is a headless multi-model agent CLI (Claude-Code-shaped). Verified this session:

### Flags that matter

| Flag | Verified? | Use in this skill |
|---|---|---|
| `-p` / `--print` / `--prompt` | yes | Non-interactive single task |
| `--output-format json` | yes (probed) | Structured result — see envelope below |
| `--output-format stream-json` + `--input-format stream-json` | documented | Live progress events; multi-turn over stdin |
| `--json-schema <str\|path>` | documented | Enforce structured final output (e.g. a verification verdict) |
| `--conversation <id>` / `--continue` / `-c` | documented | **Resume a subagent for retry-with-feedback** |
| `--model <id>` | yes (`agy models`) | `claude-sonnet-4-6`, `claude-opus-4-6-thinking`, `gemini-3.7-flash-{low,medium,high}`, `gemini-3.1-pro-*`, `gpt-oss-120b-medium` |
| `--effort low\|medium\|high` | documented | Reasoning budget per task |
| `--mode accept-edits\|plan` | documented | `accept-edits` = auto-accept file edits (Bash still prompts) |
| `--dangerously-skip-permissions` | documented | Auto-approve everything (unsupervised) |
| `--sandbox` | documented | "terminal restrictions enabled" |
| `--add-dir <path>` (repeatable) | documented | Grant workspace access — **the worktree isolation hook** |
| `--project` / `--new-project` | documented | Session/project isolation |
| `--print-timeout <dur>` | documented, default **5m0s** | **Must be raised** for real implementation tasks (e.g. `45m`) |
| `--disable-slash-commands` | documented | Stop the subagent expanding its own skills/slash-commands inside the prompt |
| `--agent <name>` | documented | Select an agent persona (currently `agy agents` lists none) |
| `mcp` subcommand | documented | MCP server management |

### JSON envelope (probed with `agy -p "Reply with exactly: pong" --output-format json --model gemini-3.7-flash-low`)

```json
{
  "conversation_id": "f66501be-510d-4c0f-a0c1-2a0fde3d25f7",
  "status": "SUCCESS",
  "response": "pong\n",
  "duration_seconds": 2.35,
  "num_turns": 1,
  "usage": {
    "input_tokens": 14151, "output_tokens": 1, "thinking_tokens": 0,
    "cache_read_tokens": 0, "total_tokens": 14152
  }
}
```

- `conversation_id` → feed to `--conversation` for a follow-up turn (retry).
- `status` → `SUCCESS` seen; failure/timeout tokens **not yet observed** (validation task).
- `response` → final assistant text.
- `usage` → per-task cost accounting; roll up across the run.
- Note the **~14k-token floor** on `input_tokens` even for "pong" — `agy` loads its own
  system prompt + project context. Budget each task as `14k + ticket + spec + ADRs +
  files it reads + its own turns`.

### Gaps vs `claude-9arm` (the qwen-agent CLI)

- **No `--allowedTools`.** Permission scoping is coarse: default (prompts) /
  `--mode accept-edits` / `--dangerously-skip-permissions` / `--sandbox`. This is the
  single biggest design constraint — see §6.3.
- Session-resume is by `conversation_id`, not a transcript file path.

---

## 4. What `qwen-agent` teaches, and where this diverges

`qwen-agent` (full text captured in `references/qwen-agent-skill.md`) is a
**single-task delegation** skill. Its transferable mechanics:

| qwen-agent principle | Keep? | Adaptation for `agy-implement` |
|---|---|---|
| Self-contained prompt: absolute paths, explicit inputs/outputs/acceptance, zero conversation context | yes, **core** | The per-ticket prompt scaffold (§5.4). The ticket file already *is* mostly self-contained. |
| "Verify the output yourself — the subagent is cheaper and less reliable" | yes, **core** | Per-ticket verification gate (§5.5). Orchestrator runs the acceptance checks, not `agy`. |
| Background-redirect + `run_in_background` for 2+ independent jobs; collect logs | yes, **core** | The parallel-wave dispatch (§5.3) — but into worktrees, not the live tree. |
| `--output-format json`, extract a field | yes | Parse the envelope (§3). |
| Mind the context window; slice by file/dir | yes (softened) | Modern models have large windows, but still point `agy` at exact files; never "scan the repo". |
| Reserve for **menial, low-risk** work; keep judgment yourself | **tension** | Vertical-slice tickets need judgment. Either (a) use a strong `agy` model and treat `agy` as a *parallelism / context-isolation* mechanism, or (b) keep tickets small+mechanical with the orchestrator doing the thinking. This is decision Q2 in §9. |
| One `claude-9arm` call = one task, no planning, no DAG | no | `agy-implement` **is** the planner + scheduler + integrator. That's the whole point. |

**Bottom line:** `qwen-agent` is the *dispatch primitive*; `agy-implement` wraps a
*control plane* around a fleet of those dispatches.

---

## 5. Proposed design

### 5.1 Invocation & shape

- `/agy-implement .scratch/<feature-slug>/` (or a bare `<feature-slug>`; default to
  the most recent `.scratch/*/issues/` dir if omitted).
- `disable-model-invocation: true` + `agents/openai.yaml` with
  `allow_implicit_invocation: false` — matches every sibling (`grill-to-tickets`,
  `to-tickets`, `implement`, `engineering-workflow`). Explicit human invocation only.
- Pure-prompt, no scripts — matches the `engineering-workflow` "zero-script control
  plane" refactor (commit `c4e38ab`).
- Sub-commands mirroring `engineering-workflow`: `continue`, `status`, `list`.

### 5.2 Stage 0 — Plan (read-only)

1. **Load the ticket set.** Parse every `issues/<NN>-<slug>.md`: number, slug, title,
   `Blocked by` edges, `Status`, acceptance checkboxes.
2. **Build the dependency DAG.** Nodes = tickets, edges = `Blocked by`. Validate:
   acyclic, every referenced blocker exists, numbering matches topological order
   (the producer guarantees "numbered from 01 in dependency order").
3. **Compute waves.** Wave = maximal set of tickets whose blockers are all in earlier
   waves. Wave 0 = tickets with no blockers.
4. **Predict file touch-sets (parallel-safety pass).** For each ticket, estimate which
   files/dirs it will create or modify — from the ticket text, the parent `spec.md`,
   and a quick codebase look. Two same-wave tickets are **parallel-safe** only if their
   predicted touch-sets are disjoint *and* neither touches a known cross-cutting file
   (router, DI container, root schema, migrations dir, `package.json`, lockfiles,
   shared config). Overlapping tickets in the same wave are **serialized within the
   wave**.
   - This prediction is a heuristic and *will* sometimes be wrong → the integration
     gate (§5.6) is mandatory, not optional.
5. **Detect wide refactors.** A ticket described as expand/contract or "migrate call
   sites in batches" (per `to-tickets`' wide-refactor rule) is flagged: batches run
   sequentially on a shared integration branch, green promised only at the final
   integrate-and-verify ticket.
6. **Present the plan and pause for approval.** Show the wave table:

   ```
   Wave 0 (parallel):   01-schema-and-seed        02-auth-provider-config
   Wave 1 (serial):     03-login-route  ->  04-session-refresh   (shared: router.ts)
   Wave 2 (parallel):   05-profile-page           06-audit-log-view
   Integration gate after every wave.
   ```

   Report per ticket: model choice, predicted touch-set, why parallel/serial, retry
   budget. Wait for explicit "go". **No source mutation before this point.**

### 5.3 Stage 1 — Execute, wave by wave

For each wave, frontier-style (`engineering-workflow` "work the frontier"):

**Serial ticket** → one `agy` run in the live working tree (or the wave's integration
branch), orchestrator verifies, commits (§5.7), moves on.

**Parallel wave** → per ticket:

1. `git worktree add .scratch/<slug>/worktrees/<NN> -b tc/<slug>/<NN>` off the current
   integrated HEAD.
2. Launch background (Bash `run_in_background: true`):

   ```bash
   agy -p "$(cat .scratch/<slug>/prompts/<NN>.md)" \
     --add-dir "$PWD/.scratch/<slug>/worktrees/<NN>" \
     --model <chosen> --effort medium \
     --mode accept-edits \
     --output-format json \
     --print-timeout 45m \
     --disable-slash-commands \
     > .scratch/<slug>/logs/<NN>.json 2>&1
   ```

   (working directory of the `agy` process = the worktree; see §6.3 on `--mode` vs
   `--dangerously-skip-permissions`.)
3. The harness re-invokes the orchestrator as each background run finishes. On each
   completion: parse `logs/<NN>.json`, check `status`, run §5.5 verification **inside
   that worktree**.
4. When all wave tickets pass verification → §5.6 integration.

**Concurrency cap.** Default max 3–4 concurrent `agy` runs (cost, local CPU, and the
orchestrator's ability to reason about N parallel results). Configurable.

### 5.4 Per-ticket prompt scaffold (written to `.scratch/<slug>/prompts/<NN>.md`)

Adapted from `engineering-workflow`'s Prompt Scaffold + `qwen-agent`'s self-contained
rule:

```
# Task: <ticket title>

## Working directory
<absolute path to the worktree>  — all paths below are relative to it unless absolute.

## What to build
<verbatim "What to build" from the ticket>

## Acceptance criteria (you must satisfy every one)
<verbatim checkboxes>

## Context you need
- Parent spec: <abs path to spec.md>  (read the relevant sections only)
- Relevant ADRs: <abs paths>
- Domain glossary: <abs path to CONTEXT.md> — use this vocabulary in names and docs
- Seam / where this goes: <1–3 sentences from the plan>

## Method
- Use test-first development at the seams named above.
- Touch only what this ticket needs. Do NOT refactor unrelated code.
- Do NOT edit: <cross-cutting files this ticket must not touch, if serialized elsewhere>
- Run typecheck and the relevant test file(s) yourself before finishing.

## Constraints
- Do not commit, push, or open a PR.
- Do not scan the whole repo; read only the files listed or clearly required.
- If a required decision is missing from the spec, STOP and report it — do not guess.

## Return
End with: files created/modified, the exact verify commands you ran, and their output.
```

The orchestrator, not `agy`, decides model/effort per ticket:
- **strong** (`claude-sonnet-4-6`, effort medium/high) — default for behavior tickets.
- **cheap** (`gemini-3.7-flash-*`) — prefactors, wide-refactor migrate batches,
  scaffolding, pure mechanical edits.

### 5.5 Per-ticket verification gate

Orchestrator (not `agy`) does this, in the ticket's worktree:

1. Every acceptance checkbox → a concrete check (test run, grep, file exists, typecheck).
2. `agy status != SUCCESS`, or missing edits, or truncated output → treat as failure.
3. Run project typecheck + the ticket's test file(s).
4. Pass → mark ticket done, proceed. Fail → retry (§5.8).

### 5.6 Integration gate (after every wave)

1. Merge each passed worktree branch into the integration branch **in ticket-number
   order** (honors the commit-granularity memory).
2. On merge conflict (the file-overlap prediction was wrong): the **orchestrator**
   resolves it on the main thread — this is judgment work, never delegated to `agy`.
   If the conflict reveals a real design collision, the wave's plan was wrong → back to
   Stage 0 for those tickets.
3. Run **full typecheck + full test suite** on the integrated result.
4. Green → wave complete, `git worktree remove` the wave's worktrees, advance.
   Red → identify the culprit ticket, retry it (§5.8) or `BLOCKED`.

### 5.7 Commits

Per the `feature_commit_granularity` memory: **one commit per ticket, in number
order.** Options (decide in Q6, §9):
- (a) `agy` never commits; the orchestrator commits each ticket after its verification
  passes and it's integrated. Cleanest, recommended.
- (b) `agy` commits inside its worktree; orchestrator cherry-picks in order.
- Commits/pushes/PRs only when the user explicitly asks (repo-wide constraint from
  `grill-to-tickets` and `engineering-workflow`).

### 5.8 Retry & failure

- `MAX_TICKET_ATTEMPTS = 3` (matches `engineering-workflow`).
- Retry = `agy --conversation <id> -p "<verification output + which criteria failed +
  what to fix>"` — reuses the subagent's context, cheaper and more targeted than a
  cold restart.
- Attempt 3 fails → `BLOCKED` with `TICKET_VERIFICATION_FAILED`, failure output saved
  to state, that ticket's worktree kept for inspection, dependent tickets not started.
- A wave with any blocked ticket does not advance; independent later waves may still
  be offered to the user as a partial path.

### 5.9 State & resume

`.scratch/<feature-slug>/status.md` (same location `engineering-workflow` uses), a
compact record: wave table, per-ticket `{status, conversation_id, attempts, worktree,
commit, usage}`, integration-branch ref, cumulative `usage`.

`continue` applies **Reality reconciliation** (`engineering-workflow` discipline):
re-read git state, worktrees, and each ticket's acceptance checks before trusting the
recorded status; rewind to the earliest ticket whose reality no longer holds.

---

## 6. Feasibility risks & mitigations

### 6.1 "No dependency edge" != "safe to run in parallel" — **highest risk**

The `Blocked by` graph encodes *logical* ordering decided in the `to-tickets` quiz, not
*file-level* independence. Vertical slices cut through every layer, so unrelated
tickets routinely both touch routers, schemas, DI wiring, migrations, `package.json`.

**Mitigation:** (1) worktree isolation so parallel writes can't corrupt each other;
(2) the file-touch-set prediction pass (§5.2.4) to serialize likely-overlapping
tickets *before* dispatch; (3) the mandatory integration gate (§5.6) with the
orchestrator owning conflict resolution. Accept that parallelism is a *best-effort
optimization* with a sequential safety net, not a guarantee.

### 6.2 Worktree / merge complexity

Worktrees add moving parts: creation, cleanup, branch hygiene, merge ordering,
conflict resolution, and the case where `agy` in a worktree runs `npm install` and
mutates a shared lockfile.

**Mitigation:** keep worktrees under `.scratch/<slug>/worktrees/` (already a tracked
but scratch area), one integration branch per run, always merge in ticket-number
order, `git worktree remove` on wave completion, and a `status`-visible list so a
crashed run leaves an inspectable trail. Start with **parallelism opt-in** (Q3): ship
sequential-only first, add the parallel path once the sequential loop is solid.

### 6.3 Permission posture for unsupervised `agy` — **safety risk**

`agy` has no `--allowedTools`. To run unattended it needs `--mode accept-edits` (edits
auto-accepted, but **Bash still prompts** → it stalls on `npm test`) or
`--dangerously-skip-permissions` (arbitrary Bash, no prompts) or `--sandbox`.

**Options:**
- `--dangerously-skip-permissions` **confined to a git worktree** — blast radius is
  that worktree + whatever Bash can reach (network, global npm, `~`). Requires explicit
  per-run user opt-in. Simplest; least safe.
- `--sandbox` + `--mode accept-edits` — if the sandbox's "terminal restrictions" still
  permit the project's typecheck/test commands. Needs validation (Q5).
- Two-phase: `agy --mode plan` first (read-only plan), orchestrator reviews the plan,
  then `agy --dangerously-skip-permissions` to execute. Adds a turn but adds a checkpoint.

**Recommendation:** default to `--sandbox` + `accept-edits`; fall back to
worktree-confined `--dangerously-skip-permissions` with per-run opt-in. Make the posture
an explicit, logged decision in the plan output. Never run skip-permissions in the live
project tree.

### 6.4 Model quality — vertical slices aren't menial

`qwen-agent` explicitly says don't delegate judgment. A vertical slice through schema +
API + UI + tests is judgment.

**Mitigation:** default `agy` to a strong model for behavior tickets; reserve cheap
models for mechanical tickets; the per-ticket verification gate + integration gate
catch quality misses; `MAX_TICKET_ATTEMPTS` with targeted feedback. If a ticket needs
*this conversation's* context or real design work, the orchestrator does it itself
instead of dispatching (the `qwen-agent` "when in doubt, keep it" rule).

### 6.5 Context budget

~14k-token `agy` floor + spec + ADRs + files. Large specs or many ADRs could crowd a
small-window model.

**Mitigation:** the prompt scaffold points at *sections*, not whole files; pass only
ADRs in the ticket's area; prefer large-window models when the context is heavy;
watch for `qwen-agent`'s context-exhaustion symptoms (truncated edits, ignored later
instructions) during verification.

### 6.6 Observability of background runs

A hung `agy` in the background is invisible until `--print-timeout`.

**Mitigation:** `--output-format stream-json` to a log the orchestrator can tail for
progress events; or a watchdog that checks log mtime and flags a run with no output
for N minutes; surface long-running/stalled tickets in `status`. `duration_seconds` +
`num_turns` in the final envelope feed post-run tuning.

### 6.7 Nested skill/slash-command expansion

`agy` expands its own skills and `/slash-commands` in `-p` prompts unless
`--disable-slash-commands`. A ticket body containing `/implement` or a `$skill` token
could trigger unwanted behavior in the subagent.

**Mitigation:** always pass `--disable-slash-commands` to dispatched `agy` runs; the
orchestrator owns all skill routing.

### 6.8 Cost & concurrency

N strong-model agents in parallel, each retrying up to 3×, is real spend.

**Mitigation:** roll up `usage` from every envelope into `status.md`; per-run budget
ceiling with a pause-and-confirm; concurrency cap (§5.3); cheap models where safe.

### 6.9 Interaction with `engineering-workflow`

Both want to own the ticket-execution loop. Overlap → drift.

**Mitigation:** position `agy-implement` as the **executor** `engineering-workflow`
delegates `IMPLEMENTATION` to (the real `has_subagents` path), not a competitor. Its
dependency registry would gain a `agy-implement` entry with
`requiredFor: IMPLEMENTATION`. Standalone invocation stays valid for the
`grill-to-tickets` → `agy-implement` short path.

---

## 7. Where it sits in the ecosystem

```
/grill-to-tickets <idea>
        |  grilling -> domain-modeling -> to-spec -> scrutinize gate -> to-tickets
        v
.scratch/<slug>/issues/NN-*.md   (DAG of tracer-bullet tickets)   <- handoff point
        |
        |-(today)->  /clear ; /implement issues/01-*.md      (human, one ticket/turn)
        |
        `-(new)  ->  /agy-implement .scratch/<slug>/
                        |  plan waves -> dispatch agy fleet (serial|parallel)
                        |  -> verify each -> integrate per wave -> commit in order
                        v
                    working, tested code on an integration branch
                        |
                        `-> /code-review  (existing skill, separate pass — Q8)
```

- **vs `qwen-agent`:** that = 1 menial task → 1 cheap subagent, no planning.
  `agy-implement` = N judgment tasks → a planned fleet + integration.
- **vs `implement`:** that = do the tickets yourself in one context, `/tdd` +
  `/code-review` + commit. `agy-implement` = orchestrate `agy` to do them, with
  parallelism.
- **vs `engineering-workflow`:** that = full-lifecycle control plane that *delegates*
  implementation. `agy-implement` = the delegate.

---

## 8. Rough skill skeleton (for later)

```
skills/agents/agy-implement/
├── SKILL.md
│     frontmatter: name, description (span: read tickets -> plan waves -> dispatch
│       agy fleet -> verify -> integrate -> stop before review), disable-model-invocation
│     § Invocation (/agy-implement <dir>, continue, status, list)
│     § agy contract (the flags + JSON envelope + failure handling)
│     § Stage 0 Plan  (DAG, waves, touch-set prediction, approval pause)
│     § Stage 1 Execute (serial vs parallel-in-worktrees, prompt scaffold)
│     § Verification gate  § Integration gate  § Commits
│     § Retry budget & BLOCKED  § State & Reality reconciliation
│     § Constraints (no commit/push/PR unless asked; orchestrator owns conflict
│       resolution and all skill routing)
├── agents/openai.yaml            (allow_implicit_invocation: false)
├── references/
│   ├── agy-contract.md           (flags, envelope, model table, failure tokens)
│   ├── qwen-agent-skill.md       (captured verbatim reference)
│   ├── planning.md               (DAG build, wave computation, touch-set heuristic,
│   │                              wide-refactor handling)
│   ├── prompt-scaffold.md        (the per-ticket template)
│   └── worktree-integration.md   (worktree lifecycle, merge order, conflict routing)
└── evals/
    ├── trigger-evals.json        (/agy-implement triggers; NL feature requests don't)
    └── evals.json                (cases: pure linear chain; one parallel wave;
                                   file-overlap forces serial; ticket fails 3x -> BLOCKED;
                                   integration conflict -> orchestrator resolves;
                                   resume after crash mid-wave; wide-refactor sequence)
```
Plus `docs/skills/agents/agy-implement.md` (human guide) per repo convention, and a
`docs/decisions/NNNN-*.md` ADR for the standalone-vs-`engineering-workflow`-owned call.

---

## 9. Open questions for the owner

1. **Name.** `agy-implement`? (fits `grill-to-tickets` / `to-spec` / `to-tickets` /
   `pr-to-dev`). Alternatives: `implement-tickets`, `agy-fleet`, `dispatch-tickets`.
2. **Is `agy` a cost-saver or a parallelism mechanism?** i.e. cheap models + only
   mechanical tickets, or strong models run concurrently for context isolation +
   throughput? This sets the model defaults and the "delegate vs keep" line.
3. **Parallelism now or later?** Ship sequential-only first (simple, safe) and add the
   worktree parallel path as a second iteration — or is parallel a day-one requirement?
4. **Conflict resolution owner.** Confirm: the main Claude orchestrator always resolves
   merge/integration conflicts, `agy` never does. (Recommended.)
5. **Permission posture** (§6.3): default `--sandbox` + `--mode accept-edits`, or
   worktree-confined `--dangerously-skip-permissions` with per-run opt-in? Need to test
   whether `--sandbox` permits your projects' test/build commands.
6. **Commit model** (§5.7): orchestrator commits each verified ticket (recommended), or
   `agy` commits in-worktree and orchestrator cherry-picks in order?
7. **Ecosystem role:** standalone skill only, the `engineering-workflow` `IMPLEMENTATION`
   delegate, or both? Does it replace the `/implement` line in `grill-to-tickets`'s
   handoff, or live beside it?
8. **Review:** does `agy-implement` stop before review (hand off to `/code-review`
   like `grill-to-tickets` hands off), run `/code-review` per ticket, or once at the
   end? Same question for a final `/scrutinize` system gate.
9. **Scope:** greenfield feature tickets only, or also bug-fix tickets and
   `to-tickets`' wide-refactor expand-contract sequences?
10. **Invocation policy:** `disable-model-invocation: true` + `openai.yaml`
    `allow_implicit_invocation: false`, matching every sibling? (Assumed yes.)

---

## 10. Suggested validation experiments before speccing

Cheap probes that de-risk the spec:

1. **`agy` failure envelope.** Run `agy -p` with a deliberately impossible task and a
   short `--print-timeout`; capture the `status` value and envelope shape on
   failure/timeout. (Needed for §5.5 / §5.8.)
2. **`--sandbox` capability.** In a throwaway worktree, `agy --sandbox --mode
   accept-edits -p "run the test suite and report pass/fail"` on one of this repo's
   packages — does the sandbox permit `npm test` / `node`? (Decides Q5.)
3. **`--conversation` retry.** One `agy` task, then `agy --conversation <id> -p "now
   also do X"` — confirm context carries and the second turn's envelope. (Needed for
   §5.8.)
4. **`--json-schema` on the final result.** Enforce a `{verdict, files[], notes}`
   schema and confirm `response` obeys it. (Would simplify §5.5 parsing.)
5. **Two real parallel worktrees.** Take tickets `01` and `02` from
   `.scratch/grill-to-tickets/issues/`, run two `agy` background jobs in two worktrees,
   and dry-run the merge — see what actually collides. (Validates the §6.1 premise on
   real tickets.)
6. **`stream-json` progress.** Confirm what event stream `agy --output-format
   stream-json` emits, for the §6.6 watchdog.
