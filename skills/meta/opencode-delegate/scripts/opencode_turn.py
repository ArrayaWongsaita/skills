#!/usr/bin/env python3
"""Run one `opencode run` turn and make sure it ends.

OpenCode does not exit by itself when it has started a background job (a preview server, a watcher): it prints
"waiting for N background job" and stays. This runs the turn in its own process group, writes everything it prints
to a log, and when the log has ended on that line for `--grace` seconds it stops opencode and its process group.
A process the worker detached from that group (`nohup`, `setsid`) is not stopped.

    opencode_turn.py --session ses_ID --out LOG [--dir PROJECT] [--model M] [--title T] [--archived]
                     [--grace 20] [--timeout 3600] [--status-file FILE] [--detach] [--opencode PATH] MESSAGE

It prints one line, `status=<done|stopped|failed|timeout|cancelled> exit=<code> log=<path>`, and exits 0 when opencode
finished or was stopped while waiting, 1 when opencode failed, 2 on a timeout, 3 when it could not start (including a
session id that does not start with "ses", which opencode rejects), 4 when the turn was cancelled with SIGTERM
(opencode and what it started are stopped first).

With `--status-file` the same line is also written to FILE when the turn ends, in one atomic step, so a reader sees
either no file or the whole line. A file left by an earlier turn is removed when the turn starts.

With `--detach` (which needs `--status-file`) the script starts itself in a new session and returns at once, so the
caller's tool call does not have to stay open. It prints `started status-file=<path> log=<path> pid=<pid>` and exits 0,
or exits 3 before starting anything when the folder or `opencode` is missing, or the log or the status file's folder
cannot be created. The log is created empty first, so its age says when the turn began even if the child dies at once,
and the child's stderr goes to `<status-file>.err`. The turn runs on; its end is the status file, and `kill -TERM <pid>`
cancels it.
"""
import argparse
import contextlib
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
SESSION_PREFIX = "ses"  # opencode rejects any other id: 'Expected a string starting with "ses"'


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


def write_status(path: Path, line: str) -> None:
    """Write `line` to `path` so that a reader never sees a half-written file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_name(path.name + ".tmp")
    partial.write_text(line + "\n", encoding="utf-8")
    os.replace(partial, path)


@contextlib.contextmanager
def cancel_flag():
    """Collect SIGTERM in a list instead of dying, so the turn can stop opencode and write its status."""
    received: list[int] = []
    previous = signal.signal(signal.SIGTERM, lambda signum, frame: received.append(signum))
    try:
        yield received
    finally:
        signal.signal(signal.SIGTERM, previous)


def child_command(args: argparse.Namespace) -> list[str]:
    """The command that runs this script again, without `--detach`, as the detached child.

    Built from the parsed arguments, not from `sys.argv`: argparse accepts abbreviations such as `--det`, and
    filtering the raw arguments for "--detach" would miss one and start the script again and again."""
    cmd = [
        sys.executable, str(Path(__file__).resolve()),
        "--session", args.session, "--out", str(Path(args.out).resolve()), "--dir", str(Path(args.dir).resolve()),
        "--grace", str(args.grace), "--timeout", str(args.timeout),
        "--status-file", str(Path(args.status_file).resolve()), "--opencode", args.opencode,
    ]
    if args.model:
        cmd += ["--model", args.model]
    if args.title:
        cmd += ["--title", args.title]
    if args.archived:
        cmd.append("--archived")
    return cmd + ["--", args.message]


def parse(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run one opencode turn and make sure it ends.")
    parser.add_argument("message", help="the message to send")
    parser.add_argument("--session", required=True, help='session id starting with "ses", such as ses_fixlogin01: continued if it exists, created if not')
    parser.add_argument("--out", required=True, help="log file for everything opencode prints")
    parser.add_argument("--dir", default=".", help="project folder to run in (default: the current one)")
    parser.add_argument("--model", help="provider/model#variant; see `opencode models`")
    parser.add_argument("--title")
    parser.add_argument("--archived", action="store_true", help="keep the session out of session lists")
    parser.add_argument("--grace", type=float, default=20, help="seconds the log must end on the waiting line before opencode is stopped")
    parser.add_argument("--timeout", type=float, default=3600, help="seconds before the turn is stopped as a timeout")
    parser.add_argument("--status-file", help="also write the final status line to this file when the turn ends")
    parser.add_argument("--detach", action="store_true", help="start the turn in the background and return at once; needs --status-file")
    parser.add_argument("--opencode", default="opencode", help="the opencode binary")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse(argv)
    if not args.session.startswith(SESSION_PREFIX):
        print(f'error: --session must start with "{SESSION_PREFIX}", such as ses_fixlogin01 (ses_ then letters and digits); opencode rejects any other id', file=sys.stderr)
        return 3
    project = Path(args.dir)
    if not project.is_dir():
        print(f"error: project folder not found: {project}", file=sys.stderr)
        return 3
    binary = args.opencode if os.sep in args.opencode else shutil.which(args.opencode)
    if not binary or not os.access(binary, os.X_OK):
        print(f"error: opencode not found: {args.opencode}", file=sys.stderr)
        return 3
    args.opencode = binary
    if args.detach:
        if not args.status_file:
            print("error: --detach needs --status-file, the file the finished turn is reported in", file=sys.stderr)
            return 3
        status_path = Path(args.status_file).resolve()
        log_path = Path(args.out).resolve()
        try:
            status_path.unlink(missing_ok=True)
            log_path.parent.mkdir(parents=True, exist_ok=True)
            log_path.touch()  # its age marks the start, even when the child dies before it writes anything
            status_path.parent.mkdir(parents=True, exist_ok=True)
            crash = status_path.with_name(status_path.name + ".err").open("wb")  # what the child's stderr says if it crashes
        except OSError as error:
            print(f"error: cannot create the log, the status folder or the crash file: {error}", file=sys.stderr)
            return 3
        with crash:
            child = subprocess.Popen(child_command(args), start_new_session=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=crash)
        print(f"started status-file={status_path} log={log_path} pid={child.pid}")
        return 0
    log = Path(args.out)
    log.parent.mkdir(parents=True, exist_ok=True)
    status_file = Path(args.status_file) if args.status_file else None
    if status_file:
        status_file.unlink(missing_ok=True)

    started = time.monotonic()
    waiting_since = None
    # opencode takes its folder from $PWD, and Popen(cwd=...) leaves the caller's PWD in place.
    env = {**os.environ, "PWD": str(project.resolve())}
    with cancel_flag() as cancelled, log.open("wb") as sink:
        proc = subprocess.Popen(command(args), cwd=project, env=env, stdin=subprocess.DEVNULL, stdout=sink, stderr=subprocess.STDOUT, start_new_session=True)
        while True:
            if cancelled:
                stop(proc)
                status, exit_code = "cancelled", 4
                break
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
        if status == "cancelled":
            sink.write(b"\n[opencode_turn] cancelled by opencode_turn: it received SIGTERM\n")
        sink.write(f"[opencode_turn] {summary}\n".encode())
    if status_file:
        write_status(status_file, summary)
    print(summary)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
