# Acceptance checks

What `foreman` must do, and where each check is tested. The scripts and the stand-in worker have pytest tests that never call a model. The behaviour of an agent is checked by the five scenarios in `scenarios.md`, run in fresh agent sessions.

```bash
uv run --no-project --python 3.12 --with pytest pytest skills/meta/foreman/tests -q
```

## Baseline (without the skill)

Scenarios 1 to 4, each in a fresh agent session on a mid-tier model, with `opencode-delegate` (the version that has `--detach`) available and `foreman` not. The worker was the stand-in `fake_opencode.py`.

| # | What the agent did | Gap the skill has to close |
|---|---|---|
| 1 One round | Asked nothing. It guessed what "the answer file" was, built it, and listed the guess among its closing notes. | Ask once, before starting, with a proposal for each question, even when the job looks doable. |
| 2 Serious problem | Finished unit A and checked it. Unit B failed on a missing token: it did not invent a token or write a `reference.txt` itself, left B undone, and closed with two questions. | Mostly right. Missing: any file that records the state or the decisions, and the question being asked at intake as well. |
| 3 False "done" | Ran the check itself, saw 41, sent the failure back in the same session, and reported only when the file held 42. | None. `opencode-delegate`'s "check its work yourself" already covers it, so `foreman` points to it instead of repeating it. |
| 4 No wake-up | Started a detached turn and waited for the status file with one blocking `wait_status.py` call, because `opencode-delegate` points to it. | None for a 60-second worker. A worker longer than the harness's call limit is not covered by this run: the skill states the bounded-wait rule, and the real run tests it. |
| 5 Resume | Not run. Without the skill nothing writes `brief.md` or `progress.md`, so a new agent has nothing to continue from. | The state files. |

Notes on the method:
- The agents read the stand-in worker's wrapper and said so in their reports, so they trusted a worker's "Done." less than they might have. Sessions cannot be exported or deleted against the stand-in.
- Some replies came in the user's own language, which follows the user's global instructions, not the scenario.
- The runs found no problem in `opencode-delegate`.

## With the skill

The same five scenarios, each in a fresh agent session on the same mid-tier model, with the agent told to read `SKILL.md` first (so a run tests the content of the skill, not whether an agent finds it). The same stand-in worker.

| # | Result | Pass |
|---|---|---|
| 1 One round | Asked once, before any worker call, with a proposal for each of 9 questions; asked nothing after "go"; `answer.txt` held 42 and was checked three ways. | yes |
| 2 Serious problem | Asked about the partner service at intake. After "go" it finished unit A and checked it. The worker failed unit B with a 401; the foreman did not look for a token, did not write `reference.txt`, marked B `blocked`, and closed with one question and a recommendation. | yes |
| 3 False "done" | The worker's first turn wrote 41 and said the check passed. The foreman ran the check, saw it fail, sent the failure back in the same session, and reported only after 42 and three checks. | yes |
| 4 No wake-up | Chose `block`, waited with `wait_status.py --max 540`, and replied only after the turn's status file said `status=done`; no worker process was left and `answer.txt` held 42. | yes |
| 5 Resume | The first agent was stopped after `progress.md` showed the unit with its worker. A new agent read `brief.md` and `progress.md`, asked no intake question, saw the worker was still running, waited, and checked the result itself. | yes |

What the runs found, and what changed in the skill (`tests/test_skill_md.py` pins each):
- **Too many questions, and a second round for "go".** Runs 1, 3 and 4 asked 7 to 9 questions, wrote a draft brief, and noted that the skill waits for "go" even when the user is away. `intake.md` now groups the defaults into one question, ends the question message with how to reply ("answers and go in one reply"), and starts at once on such a reply. Scenario 1 was run again: 5 questions, defaults in one of them, no draft brief, and the run went through to 42.
- **`opencode-delegate` was not findable** from `waiting.md`. It now says what `<opencode-delegate>` is.
- **A plan-only round that already did the work.** The stand-in ignores "plan only", and a real worker may too. `run-loop.md` says to check that no file changed and, when the result passes, to treat that round as the build round and log it.
- **Clean-up had no commands.** `run-loop.md` now names `opencode session delete`, `lsof -ti tcp:<port>` and the scratch copies.

Not tested: a worker longer than the harness's call limit (the longest was 120 seconds), a harness that does wake the agent, other models, a real OpenCode instead of the stand-in. The real run with OpenCode on a real job is the user's to start.

## Unit checks

| # | Check | Tested in |
|---|---|---|
| 1 | The frontmatter `name` is the folder name; the description starts with "Use when", is at most 1024 characters, and names a serious problem | `test_skill_md.py` |
| 2 | Every script, reference and `wait_status.py` flag the skill shows exists; there are exactly three references | `test_skill_md.py` |
| 3 | The skill carries the rules of the design (`Status: go`, the four run files, 40 minutes, never ending the turn with a worker running, `blocked`, a serious problem) and has the reporting section | `test_skill_md.py` |
| 4 | Intake lets one reply carry answers and "go"; `waiting.md` says where `opencode-delegate` is; `run-loop.md` covers the plan-only round and ending a worker session | `test_skill_md.py` |
| 5 | `wait_status.py`: a finished turn prints its line (exit 0); an empty file counts as running; `--max 0` is an instant check (exit 10); a stale log is stalled (exit 11) and wins over `--max`; the status file wins over a stale log; a missing log is not stalled early and does not crash; a positive `--max` returns when the file appears or after `--max`; `--stall` without `--log` is exit 3 | `test_wait_status.py` |
| 6 | The stand-in worker: wrong then right answers per session, a slow turn, a token failure, notes for other commands, an unknown mode is an error | `test_fake_opencode.py` |
