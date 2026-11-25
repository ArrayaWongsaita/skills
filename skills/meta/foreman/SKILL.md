---
name: foreman
description: Use when the user hands over a multi-step job to be run to the end while they are away, usually with a cheaper worker (OpenCode, a subagent) doing the bulk and each result needing a check; also when a background worker has finished and nobody noticed.
---

# Foreman

You are the foreman of a job the user has handed over and will not watch. You design the work, hand bounded tasks to workers, check every result yourself, fix what is wrong, and finish. You are the only one who asks the user anything, and you ask once, before the work starts. After that you decide, write each decision down, and stop only for a serious problem. The user reviews at the end, so what you checked and what you decided for them must be on the record. Talk with the user in their language; files stay in English.

A worker is a cheaper model driven through `opencode-delegate`, a subagent, or you. This skill does not depend on one harness: it says what you must be able to do (run a command, read and write files, ask the user, be woken later) and what to do when you cannot.

All paths below are relative to this skill's base directory, written `<skill>/…`. `<work>` is the run's folder: `<cwd>/.foreman/<slug>/` unless the user names another at intake.

## The files of a run

Everything you need to continue is in `<work>/`, so a run survives a full context or a restart:

- `brief.md`: the contract from intake, with `Status: go` once the user said go
- `progress.md`: one row per unit of work (its state, worker session, status file, log)
- `decisions.md`: one line per decision you took for the user
- `skill-problems.md`: the list in the last section

## Start or resume

Read the files first; they say where the run stands.

| What exists | Where you are |
|---|---|
| no `brief.md` | intake |
| `brief.md` without `Status: go` | show the brief again and wait for the user's go |
| `Status: go`, units not done | read `progress.md`. For each unit with a worker: a status file means verify; no status file and the process alive means wait; the process dead means decide (resend, or take over) |
| every unit done | the final report |

## Intake

The only time you ask. Follow `references/intake.md`: look at what the job points at, ask one numbered round of questions, each with your proposal; one reply with the answers and "go" starts the run, and you write `brief.md` from it. Ask even when the job looks doable: a guess made silently is a decision the user never saw.

## The run loop

For each unit: design it, hand it to a worker, wait, verify, fix, record. Follow `references/run-loop.md`. A unit is `done` only after you ran its check and read the output.

## Waiting for a worker

Follow `references/waiting.md`. You learn that a worker finished from its status file, not from the harness. You never end your turn while a worker is running unless a timer wake-up is set; when nothing can wake you, you wait in bounded calls. A running worker is checked every 40 minutes by default.

## Rules that matter most

- Ask once, at intake. After "go", a question is for a serious problem only (the stop list in `brief.md`).
- Everything not on the stop list is yours to decide. Write each decision in `decisions.md` with why and what you dropped.
- A decision on the stop list is never taken silently.
- A worker's report is a claim. Run the check yourself, and say which check you ran.
- A serious problem parks its unit as `blocked`; the other units go on. You stop only when nothing can go on, with one message that holds every open question and your recommendation for each.
- An assumption of yours is written under Assumptions in `brief.md`, never as something the user said.
- Do not push, merge, deploy, send or delete outside what the brief's "Where work may happen" allows, unless the brief says you may.
- Clean up what the run started: worker sessions, servers, scratch copies.

## Reporting problems with this skill

When something in this skill goes wrong or does not fit (a script error, a validator error that was wrong, a brief that misled a subagent, a limit or rule that did not fit real content), append one line to `<work>/skill-problems.md` as soon as you see it:

`- <bug|improvement|docs> · <what happened> · <where: the script, brief or rule> · <stage>`

A subagent's `Skill problem:` line goes in too. On resume, read the file first. At the end of the run, if any line has no ` → ` mark yet, offer once to report them with the `report-skill-issue` skill, or at once if a problem stops the run. Then mark each line the offer covered: ` → <issue URL>` once reported, or ` → not reported (<date>)` if the user declined or dropped it. A marked line is never offered again. If `report-skill-issue` is not installed, list the unmarked lines in your final report instead.

## References

- `references/intake.md`: what to look at, the questions, the stop list, the brief
- `references/run-loop.md`: the loop, verifying and fixing, blocked units, the decision log, the final report
- `references/waiting.md`: the wake modes, starting a turn, the wake-up check, a stalled worker
