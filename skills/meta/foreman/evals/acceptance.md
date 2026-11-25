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

(filled in by the runs of Task 7)
