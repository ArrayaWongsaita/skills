# Design: `foreman` skill

- Date: 2026-11-25
- Status: Approved 2026-11-25
- Location of the skill: `skills/meta/foreman/` (my call: next to `opencode-delegate`, which it builds on)
- Touches:
  - a new skill `foreman` (`SKILL.md`, `references/`, `scripts/`, `tests/`, `evals/acceptance.md`)
  - `skills/meta/opencode-delegate/` (`scripts/opencode_turn.py`, `SKILL.md`, its tests and acceptance file)
  - the test commands in the root `AGENTS.md`

## 1. Intent

The user hands a job to an agent and often is not at the keyboard while it runs. Today two things go wrong:

- **A question mid-run stalls the job.** The agent asks, the user is away, and the job waits hours for an answer to something the agent could have asked at the start or decided itself.
- **The main agent never learns that a worker finished.** In a real run the main agent started `opencode run` in the background and relied on the harness to wake it when it ended. The harness did not, so the finished work sat unchecked and the run stopped. `opencode-delegate`'s `SKILL.md` (line 36) tells the agent to do exactly that.

The user also wants the bulk of the work done by a cheaper model (OpenCode with a model of their choice, or subagents), with the stronger main model acting as foreman: it designs the work, hands out bounded tasks, checks every result itself, fixes what is wrong, and finishes. The user reviews only at the end, so the foreman's checking has to be real.

This skill makes the main agent that foreman, for any job, in any harness, with any worker.

### What success looks like

- The user gives a job in a few sentences, answers one round of questions, says "go", and later finds the result plus a log of every decision made for them. They were not asked anything in between, except for a serious problem.
- The foreman never ends its turn while a worker is running unless it has set up something that will wake it.
- Everything the foreman needs to continue lives in files, so a run survives a full context or a restart.
- At the end the user can see what was checked and how, what the foreman decided for them, and where to look first.

## 2. Goals, non-goals, anti-goals

### Goals

- One skill for any multi-step job, not tied to slides or to one harness: it describes capabilities (run a command, read and write files, ask the user, be woken later), not one product's tools.
- One round of questions before the work starts, after the foreman has looked at what the job refers to. Every question carries the foreman's proposed answer, so the user can reply "all as proposed".
- After "go", the foreman decides, checks and fixes alone and writes each decision down.
- A wake-up protocol that works whether or not the harness wakes the agent by itself.
- Low token use of the main agent while a worker runs.
- Works with OpenCode (through `opencode-delegate`), with subagents, or with the foreman doing a unit itself.

### Non-goals

- Domain rules. A job that has its own skill (for example `part-slides`) keeps its rules there; the foreman only decides who does which step.
- Changing `part-slides` or any other skill. If real runs show that a skill's user-approval gates fight the foreman, that becomes an issue for that skill.
- Running many workers in parallel (my call: one worker turn at a time in this version).
- Pushing, merging, deploying, sending or deleting for the user. These are on the default stop list.
- A scheduler or a task queue across jobs.

### Anti-goals (a failure even if it looks like success)

- The foreman reports "done" without having run the checks itself.
- The run stalls with no one knowing: a finished or dead worker that nobody noticed.
- A decision that belongs on the stop list is taken silently.
- An assumption of the foreman's is written down as if the user had said it.
- The foreman asks mid-run about something it could have decided or asked at the start.

## 3. Constraints

- The repo's conventions (`AGENTS.md`): a folder per skill with `SKILL.md`, `references/`, `scripts/` (stdlib Python 3.11 or later), `tests/` (pytest), `evals/acceptance.md`; the `## Reporting problems with this skill` section in `SKILL.md`; English for code, docs and commits; Conventional Commits with the skill as the scope; this repo is public, so no private paths or project content in any file.
- The conversation with the user is in the user's language; files stay English.
- Tests never call a model provider.
- The skill must not assume one harness. Where it names a harness feature, it is as an example.

## 4. Approaches

**How the foreman finds out a worker has finished**

| | What it is | Trade-off |
|---|---|---|
| A. Block and poll | The foreman never ends its turn. It waits in calls shorter than the harness's limit and loops until the worker is done. | Works anywhere with a shell. Each wait is a model round trip, and a harness may cap a long turn. |
| B. Wait to be woken | Start the worker in the background, end the turn, rely on the harness's notification. | Cheapest while waiting. Failed in a real run. |
| C. B plus a safety timer (the user's idea, refined) | Start the worker detached, with a status file written when it ends. Set a wake-up at 40 minutes besides any notification. At each wake-up read one status line; if the worker is not done, check it is alive and wait another 40 minutes. Where the harness has neither a notification nor a timer, fall back to A. | Few wake-ups, so the lowest token use. Worst case the foreman learns of a finished worker up to 40 minutes late, only if the notification fails. |

**Picked: C, with A as the fallback.** The user picked B with a 40-minute timer. I refined it so it cannot fail the way B did: a notification alone is never trusted, the check at each wake-up is one line of a status file, and a harness with no way to be woken uses A.

**Shape of the skill**

- *One generic skill, workers behind other skills* (picked): the foreman skill holds the method; `opencode-delegate` holds how to drive OpenCode. The user will use other harnesses and providers.
- *A foreman only for OpenCode*: simpler, rejected because the user said it should not be tied to Claude Code or OpenCode.

## 5. Design

### 5.1 The files of a run

Under `<work>/`, the folder the user names at intake (default `<cwd>/.foreman/<slug>/`):

| File | Holds |
|---|---|
| `brief.md` | the contract from intake (5.3), with `Status: go` once the user said go |
| `progress.md` | one row per unit of work: `todo`, `with worker`, `verifying`, `done`, `blocked`; the worker session id, status file and log for each |
| `decisions.md` | one line per decision taken for the user: `<unit> · <decision> · <why> · <alternative dropped>`, with `overrule?` on the ones the user is most likely to want to change |
| `skill-problems.md` | the repo's reporting list |

### 5.2 Start or resume

| What exists | Where you are |
|---|---|
| no `brief.md` | intake |
| `brief.md` without `Status: go` | show the brief again and wait for the user's go |
| go, units not done | read `progress.md`, then for each unit `with worker`: status file there means verify; no status file and the process alive means wait; dead means decide (resend, or take over) |
| every unit done | final report |

### 5.3 Intake: the only time the foreman asks

1. **Look first.** Read what the job points at (a repo, files, links, other skills it will use). Never ask what that already answers.
2. **Ask once.** One message with numbered questions, each with the foreman's proposal. Cover:
   - the goal, and what "done" is as checks the foreman can run itself;
   - the input and the scope, including what to leave out;
   - what the user keeps for themselves and what they hand over. By default everything not on the stop list is handed over, including approving the foreman's own plans where a skill has an approval step;
   - the stop list, with the default below for the user to edit;
   - the workers: which, which model, any cost, time or retry cap (default retry cap: see 5.4 step 5);
   - where work may happen and what it must not touch (a scratch copy or a worktree for `opencode --auto`);
   - the wake mode (5.5) and the interval (default 40 minutes);
   - where the files of the run go.
3. **Answers.** A question the user leaves open becomes an assumption in `brief.md`, labelled as the foreman's, never as the user's words.
4. **Write `brief.md`, show it, and wait for "go".** "Go" is the authority for everything after it.

**Default stop list** (serious problems; the user edits it at intake):
- it needs a credential, a secret or a payment;
- an irreversible or outward-facing action: delete, push, merge, deploy, send, anything outside the work folder;
- a finding that changes what the user would get (the source contradicts the request, the job cannot be done as asked);
- a cap in the brief is reached (cost, time, retries) with the job unfinished;
- a result the foreman has no way to check, on which the job's success depends.

Everything else is decided, and written in `decisions.md`.

### 5.4 The run loop

For each unit of work:

1. **Design.** The foreman decides what the unit is and what "done" is as a command. It plans the unit itself, since it is the stronger model, and approves its own plan where the brief says it may.
2. **Hand over.** To the worker, in the way its skill describes (for OpenCode: plan round, correct it, then build round, in one session). The message has the goal, the files it may touch, the done-command and what it must not do.
3. **Wait** (5.5).
4. **Verify.** The foreman runs the done-command itself, and opens the output. The worker's report is a claim. A unit is `done` only after this.
5. **Fix.** Send the failure back to the same worker session. The foreman fixes it itself instead when the fix is small, or when the worker has failed the same check twice. If the foreman cannot fix it after the brief's retry cap, that is a serious problem.
6. **Record.** Update `progress.md`, and `decisions.md` for any decision taken.

**On a serious problem:** mark that unit `blocked` with the question and what was tried, then continue with every unit that does not depend on it. Only when no unit can go on does the foreman stop, with one message: all queued questions, each with a recommendation, and what is already done. If the harness can notify the user, it does so once then.

**Finish:** a final report with the checks that were run and their results, the decisions the user may want to overrule, anything blocked and its question, and the three places to look first. Clean up the worker sessions, the servers the run started and the scratch copies it made.

### 5.5 Waiting for a worker

The foreman starts the worker detached, so the harness call returns at once, and the worker writes one line to a **status file** when its turn ends (one status file per turn, so an old line is never mistaken for a new result). The foreman picks a wake mode at intake and records it:

- `notify`: the harness wakes the agent when a background command ends. Never used alone.
- `timer`: the harness has a scheduled wake-up. Set one at the interval (40 minutes by default).
- `block`: nothing can wake the agent. It keeps its turn open and waits in bounded calls (the interval, or the longest call the harness allows, whichever is shorter) until the worker is done.

**Rule:** never end the turn with a worker running unless a `timer` wake-up is set. If neither `timer` nor `block` is possible, the foreman says so at intake and does not start.

At each wake-up the foreman reads the status line only:
- a final status (`done`, `failed`, `stopped`, `timeout`): go and verify;
- no status yet: the worker is running. If its log changed within the interval, set the timer again. If not, treat it as stalled: stop it and decide (resend or take over).

Between wake-ups the foreman does nothing. This is what keeps its token use low.

### 5.6 Scripts

My proposal for the interfaces; the builder may adjust them if the tests say so.

- `opencode_turn.py` gains `--detach` and `--status-file <path>`. With `--detach` it starts itself in a new session, prints `started status-file=<path> log=<path> pid=<pid>` and exits 0. When the turn ends it writes its usual `status=… exit=… log=…` line to the status file in one atomic step. This lives in `opencode-delegate`, which owns everything specific to OpenCode.
- `foreman/scripts/wait_status.py --status-file F [--log L] [--max SECONDS] [--stall SECONDS]` is worker-agnostic. It returns when the status file exists (prints its line, exit 0), or after `--max` seconds with `running` and the log's age (exit 10), or when the log has not changed for `--stall` seconds with `stalled` (exit 11). `--max 0` is an instant check, for a timer wake-up; a positive `--max` is the bounded wait of `block` mode.
- `opencode-delegate`'s `SKILL.md`: the line that says to run a long turn in the background and read the log when it reports is replaced by the detached start and a pointer to `foreman` for waiting.

### 5.7 Tests and acceptance

- pytest for both scripts and for `SKILL.md` (the frontmatter, every script and flag named exists, the reporting section is present), like `opencode-delegate`.
- Fresh-agent runs, each first without the skill to see what goes wrong, then with it:
  1. A job with ambiguous parts: one round of questions, none after "go".
  2. A planted serious problem (a needed key that is missing): the unit is parked, the rest continues, one message at the end.
  3. A worker that claims "done" with a wrong result: the foreman catches it with the done-command.
  4. A harness with no notification: the foreman sets a timer or blocks, and does not end its turn with a worker running.
  5. A run killed in the middle: a new agent continues from the files.
- A real run with OpenCode on a real job (the Playwright slides job the user described) before the skill is called finished.

## 6. What is left to the builder

- The exact wording of `SKILL.md` and the references (the intake brief, the stop list, the final report); `SKILL.md` stays short and puts the detail in `references/`.
- Whether `wait_status.py` also reads the process id to tell "dead" from "slow"; the design only requires the log-age test.
- The stall threshold default. The log of a thinking model can stay quiet for a long time, so it should be tuned in the real run, not guessed.
- How each harness is asked for its wake capabilities, and which one-line examples go into the skill. Verify them; do not write one from memory.
- Which branch to work on: `opencode-delegate` is not on `main` yet, and the foreman depends on its change.

## 7. My calls (the user can overrule)

- Name and place: `foreman`, `skills/meta/foreman/`.
- One worker turn at a time.
- The default stop list in 5.3.
- Retry cap: the foreman takes over after the worker fails the same check twice.
- State files in `<cwd>/.foreman/<slug>/` by default, asked at intake.
- No change to `part-slides` in this work.
