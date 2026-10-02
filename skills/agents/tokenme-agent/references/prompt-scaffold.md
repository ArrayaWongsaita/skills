# Prompt Scaffold

The text of the prompt file is the whole of what a delegate run sees. The
host fills one of the two templates below and writes the result to the
prompt file the dispatch contract reads
(`/tmp/tokenme-prompts/<task-id>.md`) before dispatch. What may be
delegated at all is decided first, in
[delegation-policy.md](delegation-policy.md); how the run is launched is in
[dispatch-contract.md](dispatch-contract.md).

## What every prompt carries

A delegate run is one shot with no conversation context: it reads the prompt
file and nothing else. The prompt carries everything the run needs:

- **Absolute paths** — every path the prompt mentions is absolute, from the
  workspace root down to each named file. A relative path or a shorthand
  like "the file from earlier" makes the run guess, and a guessing run
  opens or edits the wrong file.
- **Named inputs and outputs** — the files the run reads, the files it may
  edit, and the report it returns are each named with their absolute paths.
- **Checkable acceptance criteria** — each criterion is a command to run, a
  diff to read, or a fact to find in the result file, so the host can check
  it after the run instead of taking the run's word for it.
- **No references to earlier turns** — the prompt never points at this
  chat; it repeats whatever the run needs in full. "As discussed above"
  hands the run nothing it can act on.

## Conventions travel in the prompt

The default run is bare, and a bare run reads no project instructions — no
CLAUDE.md, no hooks, no skills — so a convention the task must follow
reaches the run only through the prompt text. The host writes each
convention out in full instead of naming the file it lives in. Given a task
that must follow a naming convention, the prompt states the convention
itself — "name every new test file `<module>.test.mjs`" — not "follow the
project's naming rules". The conventions field of the edit template below
is where they go.

## Rules the prompt carries

The deny list in [dispatch-contract.md](dispatch-contract.md) blocks the
history-changing git commands and a nested run mechanically; the prompt
states the same rules in words, so the run meets them where the prefix
patterns do not reach:

- Leave git history alone: `git commit`, `git push`, and `git reset` are
  forbidden, along with every other pattern on the deny list.
- Do the work yourself: start no other `claude` or `claude-tokenme` run,
  and hand no part of the task to one.
- Touch only the files the prompt names: the host compares the tree after
  the run and rejects a change outside that set.

## Template: read-only task

Pair this template with the read-only tool scoping in
[dispatch-contract.md](dispatch-contract.md): the run reads the named
inputs and its report arrives in the JSON result file.

```markdown
# Objective
Summarise the five largest error spikes in
/absolute/path/to/project/logs/build.log.

# Inputs
- Workspace root: /absolute/path/to/project
- Read: /absolute/path/to/project/logs/build.log
[Every path absolute; the run reads nothing outside this list.]

# Instructions
1. Search the named inputs for [the pattern, written out].
2. Count and rank [the matches, with the rule stated].

# Acceptance criteria
- [ ] The report names the five spikes with timestamps and line numbers
      from /absolute/path/to/project/logs/build.log.
- [ ] The counts match what the host finds by running [the same search].
- [ ] The named inputs are unchanged.

# Rules
- This run reads only: it edits and writes no file.
- Leave git history alone: no `git commit`, no `git push`, no `git reset`.
- Do the work yourself: start no other `claude` or `claude-tokenme` run.
```

## Template: edit task

Pair this template with the edit-and-verify tool scoping in
[dispatch-contract.md](dispatch-contract.md): the run edits the named files
and runs the verification command itself.

```markdown
# Objective
Rename [symbol] to [new name] in every file named below.

# Inputs
- Workspace root: /absolute/path/to/project
- Edit exactly these files:
  - /absolute/path/to/project/src/one.ts
  - /absolute/path/to/project/src/two.ts
[A directory named here is expanded by the host to its files before
dispatch.]

# Conventions
- Name every new test file `<module>.test.mjs`.
- [Every convention the task needs, written out in full — a bare run reads
  no project instructions.]

# Instructions
1. Apply the change the same way in every named file.
2. Run [the verification command] and confine any follow-up to the named
   files.

# Acceptance criteria
- [ ] `git diff --stat` names only the files listed above.
- [ ] [The verification command] exits 0.
- [ ] Every new file name follows the convention written above.

# Rules
- Leave git history alone: no `git commit`, no `git push`, no `git reset`.
- Do the work yourself: start no other `claude` or `claude-tokenme` run.
- Touch only the files the prompt names.
```
