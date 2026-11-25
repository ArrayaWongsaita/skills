#!/usr/bin/env python3
"""A stand-in for `opencode run --auto -s <id> [...] <message>`, used by the foreman's scenarios (evals/scenarios.md).

It never calls a model. Behaviour comes from the environment:

    FAKE_STATE    a folder where it counts the calls of each session (required)
    FAKE_MODE     claims-done (default): the first call of a session writes `answer.txt` containing 41 and says the
                  check passes; later calls of the same session write 42.
                  slow: sleeps FAKE_SECONDS (default 30), then writes `answer.txt` containing 42.
                  needs-token: a message that mentions "partner service" fails with a missing-token error; any other
                  message behaves like slow with FAKE_SECONDS (default 1).
    FAKE_SECONDS  seconds to sleep in `slow` and `needs-token`

Any command other than `run` (`--version`, `models`, `session ...`) and `run --help` print a one-line note and exit 0.
It writes into the current folder, like opencode does.
"""
import os
import sys
import time
from pathlib import Path


def write_answer(text: str) -> None:
    Path("answer.txt").write_text(text + "\n", encoding="utf-8")


def main(argv: list[str]) -> int:
    if argv[:1] != ["run"] or "--help" in argv:
        print("fake opencode: a stand-in that only runs `opencode run --auto -s <id> <message>`; see its docstring")
        return 0
    session = argv[argv.index("-s") + 1]
    message = argv[-1]
    mode = os.environ.get("FAKE_MODE", "claims-done")
    state = Path(os.environ["FAKE_STATE"])
    state.mkdir(parents=True, exist_ok=True)
    counter = state / f"{session}.count"
    calls = int(counter.read_text()) + 1 if counter.exists() else 1
    counter.write_text(str(calls))

    if mode == "claims-done":
        write_answer("41" if calls == 1 else "42")
        print("Done. The check passes." if calls == 1 else "Fixed. The answer is 42 now.", flush=True)
    elif mode == "slow":
        time.sleep(float(os.environ.get("FAKE_SECONDS", "30")))
        write_answer("42")
        print("Done.", flush=True)
    elif mode == "needs-token":
        if "partner service" in message.lower():
            print("401 Unauthorized: the partner service needs an API token that is not configured. I cannot continue.", flush=True)
            return 1
        time.sleep(float(os.environ.get("FAKE_SECONDS", "1")))
        write_answer("42")
        print("Done.", flush=True)
    else:
        print(f"unknown FAKE_MODE: {mode}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
