---
name: opencode-delegate
description: Use when a bounded task could be handed to the OpenCode CLI (`opencode run`) as a headless worker, for example to build or test something with a cheaper model, to run another skill against a real model, or to split off separable work; also when an `opencode run` call never returns and its output ends with "waiting for N background job".
---

# OpenCode delegate

OpenCode is a coding agent you can drive from the command line. You give it one bounded task in a project folder, it works alone, and you check what it did. You stay the judge: its report is a claim, not evidence.

All paths below are relative to this skill's base directory, written `<skill>/…`.

## Hand it a task, or keep it

Hand over a task that is bounded, that you can check with a command you run yourself (tests, a build, a file that must exist), and that is cheap to redo. Running another skill against a real model to see whether it holds up is a good fit.

Keep a decision that belongs to the user, anything outside the project folder, a push or a merge, anything with secrets, and anything destructive. `--auto` approves every permission that is not explicitly denied, so run it only in a folder where everything it can do is acceptable: a scratch copy or a worktree, never the user's only copy.

## Before the first run

- `opencode --version`, then `opencode run --help` for any flag not named here. The CLI changes between versions; this was checked on v2.4.1.
- `opencode models` lists `provider/model`; a variant is a `#variant` suffix (`provider/model#max`). Take the model from the user or from that list. Leave `--model` out to use the user's default. The models available depend on the user's account.

## One turn

```bash
python3 <skill>/scripts/opencode_turn.py --dir <project> --session <id> --out <log> \
  [--model provider/model#variant] [--title <text>] [--archived] [--grace 20] [--timeout 3600] \
  [--status-file <file>] [--detach] "<message>"
```

It runs `opencode run --auto -s <id> …` in `<project>`, writes everything opencode prints to `<log>`, and prints one line: `status=<done|stopped|failed|timeout|cancelled> exit=<n> log=<path>`. A failed turn whose last lines show a cancelled input request or a dropped connection says so before the log: `cause=input-cancelled` or `cause=connection-reset`.

- **Why not call `opencode run` yourself:** when a task starts a background job (a preview server, a watcher), opencode does not exit. It prints `waiting for 1 background job` and stays. The script stops it once the log has ended on that line for `--grace` seconds, and stops everything opencode started with it. A server it started as a background job dies with the turn; start your own afterwards if you need one. A server the worker detached itself (`nohup … &`, `setsid`) is outside that group and outlives the turn, so check `lsof -ti tcp:<port>` afterwards and stop what you find.
- **Exit codes:** 0 finished or stopped while only waiting, 1 opencode failed, 2 timed out, 3 could not start (no `opencode`, no such folder, a session id that does not start with `ses`), 4 cancelled.
- **`--session`:** an id that starts with `ses`, such as `ses_fixlogin01` (`ses_`, then letters and digits). opencode rejects any other, so the script stops with exit 3 before it starts. It continues that session if it exists and creates it if not. Use one id per task and reuse it for every follow-up turn.
- **`--dir`:** opencode takes its folder from `$PWD`, so a plain `cd` in a shell works and a subprocess `cwd` alone does not. The script sets both. If you run `opencode run` yourself, `cd` into the project first.
- **Long turns:** start with `--detach --status-file <file>`. The call returns at once with `started status-file=… log=… pid=…`, and the turn runs on in its own session. The status file gets the `status=…` line when the turn ends, in one step, so it either does not exist or is whole. Nothing else tells you, so do not count on the harness to wake you: read the status file yourself, or wait on it with the `foreman` skill's `wait_status.py` if that skill is installed. Use one status file per turn. The log is created empty at once, so its age says when the turn began, and a child that crashes leaves its traceback in `<status-file>.err`. `kill -TERM <pid>` cancels the turn: opencode and what it started stop, and the file says `status=cancelled exit=4`.

## Two rounds: plan, then build

1. Ask for a plan only, with no files written. Read it and correct it.
2. Send "approved, build it" with your corrections in the same `--session`.

A cheaper model does much better with a plan you corrected than with a task it plans and builds in one go.

## The message

It has none of your context. State the goal, the files and folders it may touch, what "done" is as a command it can run, and what it must not do. To let it use a skill, symlink the skill into `<project>/.claude/skills/<name>` and check in the log that it read the skill's `SKILL.md`.

## Check its work yourself

- Run the build, the tests or the check, and open the output. A model said it had looked at every screenshot and had missed text overlapping on three slides.
- `opencode session export <id>` prints JSON with `info` and `messages`, so you can see which commands it ran and what they returned.
- When done, `opencode session delete <id>`. `--archived` keeps scripted sessions out of the user's session lists.

## When it goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| The call never returns; the log ends `waiting for N background job` | A background job keeps opencode alive | Use `opencode_turn.py` |
| The turn sits waiting for approval | `--auto` was left out | `opencode_turn.py` always adds it |
| A page or a check shows another project's content | An earlier run's server still holds the port | `lsof -ti tcp:<port>` before you start; stop what you find |
| Files appear in the folder you ran from, not the project | `$PWD` still pointed at your folder | Use `opencode_turn.py --dir`, or `cd` first |
| Files changed outside the task's folder | It ran in the user's only copy | Run in a scratch copy or a worktree |
| It says "done" and the result is wrong | Nobody ran the check | Check it yourself, then send the failure back in the same session |
| `status=failed … cause=input-cancelled` | The worker asked for something `--auto` cannot answer (such as a web search), often after the work was done | The work may be finished: read the files before you send the task again |
| `status=failed … cause=connection-reset` | The connection dropped at the end of the turn | The work may be finished: read the files before you send the task again |
| `status=stopped`, and the worker started a background job | It was waiting on its own job when it was stopped | The work may be finished: read the files, and run the job yourself if its result is missing |

## Reporting problems with this skill

When something in this skill goes wrong or does not fit (a script error, a flag that changed, a brief that misled a subagent, a limit or rule that did not fit real content), append one line to a list you keep in the conversation as soon as you see it:

`- <bug|improvement|docs> · <what happened> · <where: the script, brief or rule> · <stage>`

A subagent's `Skill problem:` line goes in too. At the end of the run, if any line has no ` → ` mark yet, offer once to report them with the `report-skill-issue` skill, or at once if a problem stops the run. Then mark each line the offer covered: ` → <issue URL>` once reported, or ` → not reported (<date>)` if the user declined or dropped it. A marked line is never offered again. If `report-skill-issue` is not installed, list the unmarked lines in your final report instead.
