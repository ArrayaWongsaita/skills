# Dispatch Contract

How the host launches one delegate run: the preflight, the command forms, the
flags every run carries, the tool scoping that goes with each task kind, and
the checks that decide afterwards whether the run succeeded — plus the rule
that lets independent runs go in parallel. What may be delegated at all is
decided first, in [delegation-policy.md](delegation-policy.md); how large a
run may be is checked against
[budget-and-chunking.md](budget-and-chunking.md).

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
| `--disallowed-tools` | The mechanical deny list, below; a denied pattern wins over the allow list. A run whose tool set names no shell — the bare read-only run — is the one shape that drops the flag |
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

## The result gate

Reading the result is the host's job, and the gate comes first. The
envelope — the JSON object the `--output-format json` flag writes to the
result file — is read together with the command's exit code. A run counts as
successful only when all four hold:

- the envelope shows `is_error` false
- the envelope's `subtype` reports success
- the envelope's `terminal_reason` is `completed`
- the exit code is zero

Any one of the four failing fails the run. Given an envelope with `is_error`
true — or any other failed combination — the host reads the error file,
reports stderr, and treats the run as failed. The `terminal_reason` check is
also where an overflowed run shows itself:
[budget-and-chunking.md](budget-and-chunking.md) names the overflow symptoms
and the re-split that answers them.

## The baseline comparison

The gate clears the envelope; it says nothing about which files the run
touched. Before dispatch, the host records the tree it is handing over: HEAD
from `git rev-parse`, and the full porcelain status list, which names
untracked files one by one:

```bash
git rev-parse HEAD
git status --porcelain --untracked-files=all
```

Alongside the two commands, the host records a content hash of every file
the prompt names, and of every file the status list already shows as
modified or untracked. A named directory is expanded by the host to its
files before dispatch, and a file created under a named directory counts as
named. After the run finishes, the host records the same three again and
compares.

The comparison catches what the prefix rules miss: a new untracked file
appears in the status list, a commit the run made moves HEAD, and an edit to
a file that was already dirty changes that file's own hash — every recorded
file is hashed individually, so none of the three hides behind another's
entry.

The run is rejected when a file outside the named set changed or HEAD
moved. Parallel runs are attributed by their disjoint file sets: each run's
comparison ignores the other runs' file sets.

The comparison cannot see two kinds of change: gitignored files — `.env`,
build output — never appear in the status list, and ref changes that leave
HEAD in place — `git branch -f`, `git tag`, `git update-ref`,
`git --git-dir` — move nothing the comparison records. Host verification is
the backstop, and it needs a tree the host can read: a tree carrying
uncommitted host work the host cannot account for is cleaned up or committed
first, so the baseline records the run's changes alone.

## Parallel runs

Two independent delegations run at the same time only when their file sets
are disjoint. A task's file set is the files its prompt names, expanded the
way the baseline comparison expands them — a named directory contributes
its files, and a file created under a named directory counts as named. The
host writes each task's set down before launching and compares the sets:
one file named by two prompts, or named by one prompt and sitting under
another task's named directory, is an overlap.

An overlap is answered before any launch: the host splits the shared file
into one task's set alone, or serialises — the second run launches only
after the first has passed its gate and its comparison. The split that
makes the sets disjoint is the same split an oversized job needs, sized by
[budget-and-chunking.md](budget-and-chunking.md).

The worked case is two tasks that edit different directories: their sets
are disjoint, so the host records one baseline for both, writes both prompt
files, and launches each run as a background shell job with its own result
file and its own error file:

```bash
claude-tokenme -p "$(cat /tmp/tokenme-prompts/<task-a-id>.md)" \
  --bare \
  --output-format json \
  --no-session-persistence \
  --disable-slash-commands \
  --allowed-tools "<tool set for task A>" \
  --disallowed-tools "<deny list>" \
  > /tmp/tokenme-runs/<task-a-id>.json \
  2> /tmp/tokenme-runs/<task-a-id>.err &

claude-tokenme -p "$(cat /tmp/tokenme-prompts/<task-b-id>.md)" \
  --bare \
  --output-format json \
  --no-session-persistence \
  --disable-slash-commands \
  --allowed-tools "<tool set for task B>" \
  --disallowed-tools "<deny list>" \
  > /tmp/tokenme-runs/<task-b-id>.json \
  2> /tmp/tokenme-runs/<task-b-id>.err &

wait
```

Every flag is the single run's — the command form, the tool scoping and the
deny list are unchanged — and each command ends with `&`, which hands the
run to the shell as a background job; the two redirections stay separate,
as for any run. The shell's `wait` holds the host until both jobs have
finished. After the wait, each run is judged on its own: the gate reads its
envelope and its exit code from its own result and error file, and the
comparison attributes every change to the run whose file set holds the
changed file. Task A's comparison ignores the other run's file set — a
change inside task B's set is not a rejection of task A — while a change
outside every run's set still rejects. A parallel run that fails is
retried alone, under the rules in When a run fails.

## The host's own verification

The gate and the comparison clear the run's mechanics; the work itself is
checked the same way. The host runs a test, build or lint check where the
task has one, and reads the result itself. The run's own summary — its
account of what it did and why it is done — is a claim to check, not proof:
a run whose summary disagrees with the comparison or the check is failed
like any other, and the host reports done on the strength of its own
verification.

## When a run fails

A run that fails the gate, the comparison, or the host's verification is
retried once, with a narrower chunk — a smaller file set or a smaller slice
of the task, sized again against the planning budget in
[budget-and-chunking.md](budget-and-chunking.md). When the retry fails too,
the host does the task itself. The policy ends there: one retry, then the
host — the host does not loop a failing delegation.

A gateway or authentication failure stops delegation at once, without a
retry: the host reads the error file, reports stderr, and does the task
itself. A dead endpoint or a rejected credential stays dead across retries,
so the quota goes to the host's own work instead.
