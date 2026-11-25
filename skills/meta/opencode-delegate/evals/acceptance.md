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
| 12 | With `--status-file`, the printed status line is also written to the file when the turn ends, in one step (no `.tmp` left, missing folders created), and a file left by an earlier turn is removed when the next turn starts | `test_opencode_turn.py` |
| 13 | `--detach` returns at once with `started status-file=… log=… pid=…`, and the status file appears when the turn ends | `test_opencode_turn.py` |
| 14 | `--detach` without `--status-file`, or with a missing `opencode` or folder, or when the log or the status file's folder cannot be created, exits 3 before any process starts; the detached child is built from the parsed arguments, so an abbreviation such as `--det` cannot make it detach again | `test_opencode_turn.py` |
| 14b | `--detach` creates the log (empty) and the status file's folder before it starts the child, and sends the child's stderr to `<status-file>.err`, so a child that dies at once leaves a log whose age marks the start and a traceback | `test_opencode_turn.py` |
| 15 | SIGTERM stops opencode and what it started, writes `status=cancelled exit=4` to the status file, and the script exits 4 | `test_opencode_turn.py` |
| 16 | `SKILL.md` shows `--detach`, the status file and `kill -TERM`, and no longer tells the reader to wait for the harness to report | `test_skill_md.py` |

The tests were also run against two deliberate breaks of the script: killing only opencode and not its group fails check 8, and never recognising the waiting line fails check 6.

## Runs against the real opencode (v2.4.1, manual)

1. A one-word task ends by itself: `status=done`.
2. A task that starts `python3 -m http.server` as a background job: opencode prints `waiting for 1 background job`, the script stops it after the grace (`status=stopped`), nothing listens on the port afterwards, and `opencode session export <id>` prints JSON with `info` and `messages`.
3. **Wrong folder (bug found, fixed).** The first two fresh-agent runs both worked in the caller's folder, not in `--dir`, because opencode reads `$PWD` and `Popen(cwd=…)` leaves the caller's value. The unit tests had missed it because the stand-in read `os.getcwd()`. Check 4 now covers it, and a `pwd` task run from another folder prints the `--dir` folder.
4. **Fresh agent, with and without the skill** (a cheap model, the task "hand a job to opencode: write a file, start an HTTP server in the background, confirm it answers", each in its own scratch project):
   - With the skill linked in `.claude/skills/`, the agent loaded it, ran the job through `opencode_turn.py`, checked the file and the port itself, exported the session, and filed a problem line: a server the worker detached with `nohup` outlives the turn, which `SKILL.md` had said it did not. `SKILL.md` now says so.
   - Without the skill, the agent ran `opencode run` directly, redirected the output to files, and checked the result itself. It did not hang, because its worker detached the server with `nohup`.
   - This scenario does not separate the two: the hang only shows when the worker starts the server as an opencode background job (run 2). Not tested: a fresh agent facing that case without the skill, other models, other opencode versions.
5. **Detached turn (v2.4.1).** A one-word task started with `--detach --status-file <file> --archived`: the call returned after under a second with the `started …` line and no status file yet; about two seconds later the file held `status=done exit=0 log=<path>`, and the log ended with the same line. The session was deleted afterwards.
6. **Cancel against the real service (v2.4.1).** This machine runs opencode's background service, so stopping the client's process group might not stop the work. A detached turn was told to run `sleep 45` and then create `done.txt`. After a real `sleep` process appeared, `kill -TERM <pid>` gave `status=cancelled exit=4`, the `sleep` was gone at once, and 70 seconds later (longer than the sleep) `done.txt` did not exist. A first attempt proved nothing: `pgrep -f "sleep 45"` matched the turn script's own command line, so the cancel came before the model had started the command.
