# Acceptance checks

What `opencode-delegate` must do, and where each check is tested. Python tests are in `tests/` and use a stand-in `opencode` script, so they never call a model.

```bash
uv run --no-project --python 3.12 --with pytest pytest skills/meta/opencode-delegate/tests -q
```

| # | Check | Tested in |
|---|---|---|
| 1 | The frontmatter `name` is the folder name, and the description starts with "Use when" and names the "waiting for N background job" symptom | `test_skill_md.py` |
| 2 | Every script and flag that `SKILL.md` shows exists in `opencode_turn.py` | `test_skill_md.py` |
| 3 | A turn runs `opencode run --auto -s <id>` in the project folder with the model, title, `--archived` and the message | `test_opencode_turn.py` |
| 4 | The worker's `$PWD` is the project folder, not the caller's | `test_opencode_turn.py` |
| 5 | A failed run exits 1 and keeps its output | `test_opencode_turn.py` |
| 6 | A run whose log ends on the waiting line is stopped after the grace, with status `stopped` and exit 0 | `test_opencode_turn.py` |
| 7 | A run that keeps working after the waiting line is not stopped | `test_opencode_turn.py` |
| 8 | What the run started in its process group dies with it | `test_opencode_turn.py` |
| 9 | A run that does not finish times out with exit 2 and is killed | `test_opencode_turn.py` |
| 10 | A missing `opencode` or project folder exits 3 with a message | `test_opencode_turn.py` |
| 11 | `SKILL.md` warns that opencode follows `$PWD` and that a detached server outlives the turn | `test_skill_md.py` |

The tests were also run against two deliberate breaks of the script: killing only opencode and not its group fails check 8, and never recognising the waiting line fails check 6.

## Runs against the real opencode (v2.4.1, manual)

1. A one-word task ends by itself: `status=done`.
2. A task that starts `python3 -m http.server` as a background job: opencode prints `waiting for 1 background job`, the script stops it after the grace (`status=stopped`), nothing listens on the port afterwards, and `opencode session export <id>` prints JSON with `info` and `messages`.
3. **Wrong folder (bug found, fixed).** The first two fresh-agent runs both worked in the caller's folder, not in `--dir`, because opencode reads `$PWD` and `Popen(cwd=…)` leaves the caller's value. The unit tests had missed it because the stand-in read `os.getcwd()`. Check 4 now covers it, and a `pwd` task run from another folder prints the `--dir` folder.
4. **Fresh agent, with and without the skill** (a cheap model, the task "hand a job to opencode: write a file, start an HTTP server in the background, confirm it answers", each in its own scratch project):
   - With the skill linked in `.claude/skills/`, the agent loaded it, ran the job through `opencode_turn.py`, checked the file and the port itself, exported the session, and filed a problem line: a server the worker detached with `nohup` outlives the turn, which `SKILL.md` had said it did not. `SKILL.md` now says so.
   - Without the skill, the agent ran `opencode run` directly, redirected the output to files, and checked the result itself. It did not hang, because its worker detached the server with `nohup`.
   - This scenario does not separate the two: the hang only shows when the worker starts the server as an opencode background job (run 2). Not tested: a fresh agent facing that case without the skill, other models, other opencode versions.
