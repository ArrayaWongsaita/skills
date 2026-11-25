#!/usr/bin/env python3
"""Check, or wait for, the status file of a worker's turn. It does not care which worker wrote it.

    wait_status.py --status-file FILE [--log LOG] [--max 0] [--stall SECONDS] [--poll 1.0]

It prints one line and exits:

    the first line of FILE, exit 0      the turn ended (the line says how: done, failed, ...)
    stalled log-age=<n>s, exit 11       FILE does not exist and LOG has not changed for more than --stall seconds
    running log-age=<n>s, exit 10       FILE does not exist after --max seconds ("unknown" when there is no --log)
    an error on stderr, exit 3          --stall was given without --log

`--max 0` (the default) is one instant check, for a timer wake-up. A positive `--max` waits up to that many seconds,
checking every `--poll` seconds, and returns as soon as the file appears or the log is stalled. An empty status file
counts as not there yet. A log that does not exist yet is as old as this call.
"""
import argparse
import sys
import time
from pathlib import Path


def read_status(path: Path) -> str | None:
    """The first line of the status file, or None when the file is missing or empty."""
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return None
    lines = text.strip().splitlines()
    return lines[0] if lines else None


def log_age(log: Path | None, began: float) -> float | None:
    """Seconds since the log last changed; a log that is not there yet counts from the start of the call."""
    if log is None:
        return None
    try:
        return max(0.0, time.time() - log.stat().st_mtime)
    except FileNotFoundError:
        return time.time() - began


def parse(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check or wait for a worker's status file.")
    parser.add_argument("--status-file", required=True, help="the file the worker writes when its turn ends")
    parser.add_argument("--log", help="the worker's log; its age tells a slow worker from a stalled one")
    parser.add_argument("--max", type=float, default=0, help="seconds to wait for the status file (default 0: check once)")
    parser.add_argument("--stall", type=float, help="seconds without a change of --log after which the worker is stalled")
    parser.add_argument("--poll", type=float, default=1.0, help="seconds between checks while waiting")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse(argv)
    if args.stall is not None and not args.log:
        print("error: --stall needs --log, the file whose age is measured", file=sys.stderr)
        return 3
    status_file = Path(args.status_file)
    log = Path(args.log) if args.log else None
    began = time.time()
    while True:
        line = read_status(status_file)
        if line is not None:
            print(line)
            return 0
        age = log_age(log, began)
        if args.stall is not None and age is not None and age > args.stall:
            print(f"stalled log-age={int(age)}s")
            return 11
        remaining = args.max - (time.time() - began)
        if remaining <= 0:
            print(f"running log-age={'unknown' if age is None else f'{int(age)}s'}")
            return 10
        time.sleep(min(args.poll, remaining))


if __name__ == "__main__":
    sys.exit(main())
