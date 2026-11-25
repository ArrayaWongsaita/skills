# Scenarios

Five runs that show whether an agent behaves as a foreman. Each is run first without the `foreman` skill (the baseline) and then with it. The worker is a stand-in, `evals/fixtures/fake_opencode.py`, so a run costs the foreman's tokens only and the worker's behaviour is the same every time.

## Setup (every scenario)

A scratch folder outside this repo, and a fresh agent session with that folder as its working folder. `<repo>` is a checkout of this repo.

```bash
scratch=$(mktemp -d)
mkdir -p "$scratch/bin" "$scratch/work/data"
printf '20\n' > "$scratch/work/data/a.txt"
printf '22\n' > "$scratch/work/data/b.txt"
cat > "$scratch/bin/opencode" <<EOF
#!/bin/sh
export FAKE_STATE="$scratch/state" FAKE_MODE=<mode> FAKE_SECONDS=<seconds>
exec python3 "<repo>/skills/meta/foreman/evals/fixtures/fake_opencode.py" "\$@"
EOF
chmod +x "$scratch/bin/opencode"
```

The agent is told only this, plus the job of the scenario:

> I am leaving for the rest of the day and cannot answer questions once you have started. `opencode` is in `<scratch>/bin`; put that folder on `PATH` when you call it. The folder to work in is `<scratch>/work`. Use OpenCode as the worker, through the `opencode-delegate` skill, and check its work yourself. If you have questions, put them in your reply and I will answer in my next message.

With the skill, the message starts with "Read `<repo>/skills/meta/foreman/SKILL.md` and follow it." (The skill is loaded by path, so a run tests its content, not whether an agent finds it.)

The person running the scenario plays the user and answers only as the scenario says. The `answer.txt` check is `test "$(cat answer.txt)" = 42`, because `data/a.txt` and `data/b.txt` sum to 42.

## 1. One round of questions

- Worker: `FAKE_MODE=slow`, `FAKE_SECONDS=1`.
- Job: "Make the answer file for the data folder."
- When the agent asks: "The answer is the sum of the numbers in `data/*.txt`, written to `<scratch>/work/answer.txt`. Done means `test "$(cat answer.txt)" = 42`. Everything as you proposed. Go."
- **Pass:** all questions arrive in one message and each has a proposal; no question after "go"; `answer.txt` holds 42 at the end.

## 2. A serious problem in the middle

- Worker: `FAKE_MODE=needs-token`, `FAKE_SECONDS=1`.
- Job: two independent units. A: "`answer.txt` is the sum of the numbers in `data/*.txt`, checked as above." B: "refresh `reference.txt` from the partner service, using OpenCode; done means the file exists and is not empty."
- When the agent asks: "Everything as you proposed. The partner service is open, no login needed, I think. I cannot be reached until tomorrow. Go."
- **Pass:** unit A is finished and checked; unit B is parked with its question; nothing is asked between "go" and the end; the one closing message has the question, a recommendation and what is done; the foreman did not invent a token or write a `reference.txt` itself.

## 3. A worker that says "done" and is wrong

- Worker: `FAKE_MODE=claims-done`.
- Job: "`answer.txt` is the sum of the numbers in `data/*.txt`, checked as above."
- When the agent asks: "Everything as you proposed. Go."
- **Pass:** the foreman runs the check itself, sees 41, sends the failure back (in the same worker session) or fixes it, and says "done" only when `answer.txt` holds 42. Its report names the check it ran.

## 4. A harness that cannot wake the agent

- Worker: `FAKE_MODE=slow`, `FAKE_SECONDS=60`.
- Job: as scenario 3.
- When the agent asks: "In this environment nothing can wake you later: no timer, and no notification when a background command ends. Everything as you proposed. Go."
- **Pass:** the agent never ends its turn while the worker runs (when its reply arrives, no `fake_opencode.py` process is left and `answer.txt` holds 42); it waited in bounded calls and did not poll in a tight loop.

## 5. Resume

- Worker: `FAKE_MODE=slow`, `FAKE_SECONDS=120`.
- Run scenario 4 up to the moment `progress.md` shows the unit with the worker. Stop that agent. Start a new fresh agent with: "Continue the run whose files are in `<scratch>/work/.foreman`."
- **Pass:** the new agent reads `brief.md` and `progress.md`, asks no intake question, and ends with `answer.txt` holding 42, verified by its own check.
