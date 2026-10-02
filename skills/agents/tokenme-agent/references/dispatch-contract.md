# Dispatch Contract

How the host launches one delegate run: the preflight, the command forms, the
flags every run carries, and the tool scoping that goes with each task kind.
What may be delegated at all is decided first, in
[delegation-policy.md](delegation-policy.md); how large a run may be is
checked against [budget-and-chunking.md](budget-and-chunking.md).

## Preflight

Check the tokenme command before the first dispatch:

```bash
command -v claude-tokenme
```

An alias resolves only in the shell that defines it. Where aliases do not
expand — a non-interactive shell, a subprocess, a Codex session — use the
expanded form, `claude --settings <tokenme-settings-file>`: the same base
command with the tokenme settings file named outright. When neither form is
available, stop and give the user the one-time setup below instead of
dispatching.

The model is whatever the tokenme settings file configures. This contract
names no model and no version, so a gateway swap needs no edit here.

## One-time harness setup

Add both command forms to the harness settings' allow rules (for example in
`~/.claude/settings.json`) so a delegate run starts without an interactive
permission prompt:

```json
{
  "permissions": {
    "allow": [
      "Bash(claude-tokenme:*)",
      "Bash(claude --settings:*)"
    ]
  }
}
```

## The dispatch command

Write the prompt to a file and give each run its own output files:

```bash
mkdir -p /tmp/tokenme-prompts /tmp/tokenme-runs
```

Every delegate run is one shot — headless print mode, bare by default, JSON
out, nothing persisted, slash commands off — and its prompt is read from the
prompt file, so quotes and backticks in the task text stay out of the shell:

```bash
claude-tokenme -p "$(cat /tmp/tokenme-prompts/<task-id>.md)" \
  --bare \
  --output-format json \
  --no-session-persistence \
  --disable-slash-commands \
  --allowed-tools "<tool set for the task kind — see tool scoping>" \
  --disallowed-tools "<deny list — see the deny list>" \
  > /tmp/tokenme-runs/<task-id>.json \
  2> /tmp/tokenme-runs/<task-id>.err
```

| Piece | What it does |
|---|---|
| `-p "$(cat /tmp/tokenme-prompts/<task-id>.md)"` | Headless print mode; the prompt is read from the prompt file |
| `--bare` | Minimal mode — skips CLAUDE.md discovery, hooks, plugins and auto-memory, and holds the run's fixed overhead at about 1k tokens instead of about 28k |
| `--output-format json` | One JSON result on stdout |
| `--no-session-persistence` | The run leaves no session on disk and cannot be resumed |
| `--disable-slash-commands` | A literal `/command` token in the prompt stays literal |
| `--allowed-tools` | The tool set for the task kind, below — and the restriction itself: a headless run has no permission prompt to ask at, so a tool outside the list is denied |
| `--disallowed-tools` | The mechanical deny list, below; a denied pattern wins over the allow list |
| `> /tmp/tokenme-runs/<task-id>.json` and `2> /tmp/tokenme-runs/<task-id>.err` | stdout to the result file, stderr to a separate error file |

The two redirections stay separate. stdout carries the JSON result and
stderr carries the gateway's warnings; one warning merged into the result
file breaks the JSON parse. The command is not wrapped in `timeout` — macOS
ships none — and the run is over when the JSON is in the result file.

Where the alias does not expand, the expanded form swaps the command name
only — `claude --settings <tokenme-settings-file>` in place of
`claude-tokenme` — and every flag stays as written.

## Bare by default

`--bare` is the default for every delegate run; it is what holds the fixed
overhead at about 1k tokens instead of about 28k. Drop it only when a task
truly depends on project instructions a bare run cannot read; the host then
adds about 28k tokens of overhead to the budget check in place of the 1k
bare figure before dispatch. A run that is not bare sees the project's
instructions and its skills, and it carries the same tool scoping and the
same deny list as any other run.

## Tool scoping by task kind

Set `--allowed-tools` from the task kind before dispatch.

**Read-only** — searching, summarising a log, reading a large file for an
answer. The list names the three read tools, which restricts the run to
them:

```bash
--allowed-tools "Read Glob Grep"
```

A headless run has no permission prompt to ask at, so a tool outside the
list is denied: the run cannot edit a file or run a shell command. Measured
under bare on 2026-10-02 — a run scoped this way could not append to a file.

**Edit and verify** — a rename across files, a formatting pass, lint and
report. The list adds edit, write and shell to the read tools, named
explicitly so an unattended run does not stall on a permission prompt:

```bash
--allowed-tools "Read Glob Grep Edit Write Bash"
```

## The deny list

Every run whose tool set includes the shell carries the mechanical deny list
on the `--disallowed-tools` flag, and a run that is not bare carries the
same deny list:

```bash
--disallowed-tools "Bash(git commit:*) Bash(git push:*) Bash(git reset:*) Bash(git checkout:*) \
Bash(git clean:*) Bash(git stash:*) Bash(git rebase:*) Bash(git merge:*) Bash(git pull:*) \
Bash(git restore:*) Bash(git switch:*) Bash(git cherry-pick:*) Bash(git revert:*) Bash(git am:*) \
Bash(git -C:*) Bash(git -c:*) \
Bash(claude:*) Bash(claude-tokenme:*)"
```

The git patterns block the history-changing shell commands — commit, push,
reset, checkout, clean, stash, rebase, merge, pull, restore, switch,
cherry-pick, revert, am — and the `-C` and `-c` global flags, so a delegate
run leaves history alone. The last two entries block starting another
`claude` or `claude-tokenme` run: a delegate run does the work itself, and
the prompt carries the same rule in words.

The patterns are prefix rules: each matches the shell command the run
starts with, and the coverage has holes — `env claude`, an absolute path to
the binary, `sh -c`, or a nested run that leaves no file change gets past
them. Host verification is the backstop: after the run, the host compares
what changed against the tree it recorded before dispatch, and a change
outside the named files rejects the run. Measured under bare on 2026-10-02 —
a run denied `git commit` had the commit refused.
