#!/usr/bin/env python3
"""Run one `opencode run` turn and make sure it ends.

OpenCode does not exit by itself when it has started a background job (a preview server, a watcher): it prints
"waiting for N background job" and stays. This runs the turn in its own process group, writes everything it prints
to a log, and when the log has ended on that line for `--grace` seconds it stops opencode and its process group.
A process the worker detached from that group (`nohup`, `setsid`) is not stopped.

    opencode_turn.py --session ID --out LOG [--dir PROJECT] [--model M] [--title T] [--archived]
                     [--grace 20] [--timeout 3600] [--opencode PATH] MESSAGE

It prints one line, `status=<done|stopped|failed|timeout> exit=<code> log=<path>`, and exits 0 when opencode finished
or was stopped while waiting, 1 when opencode failed, 2 on a timeout, 3 when it could not start.
"""
import argparse
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
WAITING = re.compile(r"waiting for \d+ background[^\n]*\s*$")
TAIL_BYTES = 4096
POLL_SECONDS = 0.2
TERM_SECONDS = 5


def command(args: argparse.Namespace) -> list[str]:
    cmd = [args.opencode, "run", "--auto", "-s", args.session]
    if args.model:
        cmd += ["--model", args.model]
    if args.title:
        cmd += ["--title", args.title]
    if args.archived:
        cmd.append("--archived")
    return cmd + [args.message]


def ends_waiting(log: Path) -> bool:
    """True when the last text in the log is opencode's "waiting for N background job" line."""
    with log.open("rb") as handle:
        handle.seek(0, os.SEEK_END)
        handle.seek(max(0, handle.tell() - TAIL_BYTES))
        tail = handle.read().decode("utf-8", errors="replace")
    return WAITING.search(ANSI.sub("", tail)) is not None


def stop(proc: subprocess.Popen) -> None:
    """End opencode and everything it started: they share one process group."""
    for sig, wait in ((signal.SIGTERM, TERM_SECONDS), (signal.SIGKILL, TERM_SECONDS)):
        try:
            os.killpg(proc.pid, sig)
        except ProcessLookupError:
            break
        try:
            proc.wait(timeout=wait)
            break
        except subprocess.TimeoutExpired:
            continue


def parse(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run one opencode turn and make sure it ends.")
    parser.add_argument("message", help="the message to send")
    parser.add_argument("--session", required=True, help="session id: continued if it exists, created if not")
    parser.add_argument("--out", required=True, help="log file for everything opencode prints")
    parser.add_argument("--dir", default=".", help="project folder to run in (default: the current one)")
    parser.add_argument("--model", help="provider/model#variant; see `opencode models`")
    parser.add_argument("--title")
    parser.add_argument("--archived", action="store_true", help="keep the session out of session lists")
    parser.add_argument("--grace", type=float, default=20, help="seconds the log must end on the waiting line before opencode is stopped")
    parser.add_argument("--timeout", type=float, default=3600, help="seconds before the turn is stopped as a timeout")
    parser.add_argument("--opencode", default="opencode", help="the opencode binary")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse(argv)
    project = Path(args.dir)
    if not project.is_dir():
        print(f"error: project folder not found: {project}", file=sys.stderr)
        return 3
    binary = args.opencode if os.sep in args.opencode else shutil.which(args.opencode)
    if not binary or not os.access(binary, os.X_OK):
        print(f"error: opencode not found: {args.opencode}", file=sys.stderr)
        return 3
    args.opencode = binary
    log = Path(args.out)
    log.parent.mkdir(parents=True, exist_ok=True)

    started = time.monotonic()
    waiting_since = None
    # opencode takes its folder from $PWD, and Popen(cwd=...) leaves the caller's PWD in place.
    env = {**os.environ, "PWD": str(project.resolve())}
    with log.open("wb") as sink:
        proc = subprocess.Popen(command(args), cwd=project, env=env, stdin=subprocess.DEVNULL, stdout=sink, stderr=subprocess.STDOUT, start_new_session=True)
        while True:
            code = proc.poll()
            if code is not None:
                status, exit_code = ("done", 0) if code == 0 else ("failed", 1)
                break
            now = time.monotonic()
            if now - started > args.timeout:
                stop(proc)
                status, exit_code = "timeout", 2
                break
            if ends_waiting(log):
                waiting_since = waiting_since if waiting_since is not None else now
                if now - waiting_since >= args.grace:
                    stop(proc)
                    status, exit_code = "stopped", 0
                    break
            else:
                waiting_since = None
            time.sleep(POLL_SECONDS)

    summary = f"status={status} exit={exit_code} log={log}"
    with log.open("ab") as sink:
        if status == "stopped":
            sink.write(b"\n[opencode_turn] stopped by opencode_turn: opencode was only waiting for its own background job\n")
        sink.write(f"[opencode_turn] {summary}\n".encode())
    print(summary)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
