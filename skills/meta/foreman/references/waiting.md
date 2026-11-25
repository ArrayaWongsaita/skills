# Waiting for a worker

You learn that a worker finished from a status file that it writes when its turn ends. A harness may wake you when a background command ends, and in a real run it did not: the work finished and nobody noticed. So never rely on that alone.

This page is for a worker you start as a command (OpenCode). A subagent your harness runs for you reports through the harness. `<opencode-delegate>` below is the folder of the `opencode-delegate` skill.

## The wake modes

Decide at intake which your harness offers, and write it in `brief.md`:

- `notify`: the harness wakes you when a background command ends. Never used alone.
- `timer`: the harness has a scheduled wake-up (a timer, a cron-like tool). Set one for the interval, 40 minutes by default, every time a worker is running.
- `block`: nothing can wake you. You keep your turn open and wait in bounded calls (below).

**The rule:** you never end your turn while a worker is running unless a `timer` wake-up is set. With `notify` only, also set a timer, or use `block`. If you can do neither (for example your turn is cut off before the worker can finish), say so at intake and do not start.

## Start a turn

```bash
python3 <opencode-delegate>/scripts/opencode_turn.py --detach \
  --status-file <work>/turns/<unit>-<n>.status --out <work>/turns/<unit>-<n>.log \
  --dir <project> --session <id> "<message>"
```

It returns at once with `started status-file=… log=… pid=…`. Put the status file, the log and the pid in the unit's row in `progress.md`. One status file per turn: `<n>` counts the turns of the unit, so an old file is never mistaken for a new result.

## At each wake-up

Read one line. Nothing else, so waking costs few tokens.

```bash
python3 <skill>/scripts/wait_status.py --status-file <work>/turns/<unit>-<n>.status \
  --log <work>/turns/<unit>-<n>.log --max 0 --stall 2400
```

| Output | Exit | What you do |
|---|---|---|
| `status=done …` (or `failed`, `stopped`, `timeout`, `cancelled`) | 0 | The turn ended. Verify (`run-loop.md`). For `failed` or `timeout`, read the end of the log, then resend or take over. |
| `running log-age=<n>s` | 10 | The worker is alive and its log moved within the limit. Set the next wake-up, another 40 minutes, and do nothing until then. |
| `stalled log-age=<n>s` | 11 | The log has not changed for the whole interval. `kill -TERM <pid>` (the status file then says `status=cancelled exit=4`), then resend a smaller task or take the unit over. |
| a message on stderr | 3 | The call was wrong: `--stall` needs `--log`. |

The stall limit is the interval, 2400 seconds, by default. It is a default to tune: the log of a thinking model can stay quiet for a long time.

## Block mode

Nothing wakes you, so keep waiting in calls the harness will not cut off:

```bash
python3 <skill>/scripts/wait_status.py --status-file <status> --log <log> --max <seconds> --stall 2400
```

`<seconds>` is the shorter of the interval and the longest call your harness allows. Many cut a shell call at about 10 minutes; use 540 when you do not know. A shell tool's default timeout can be shorter than the longest call it allows (some default to 2 minutes): if it takes a timeout setting, set it above `<seconds>`; if a call is still cut off, lower `--max`. Exit 10 means call it again; exit 0 or 11 ends the wait. Run nothing else between the calls.
