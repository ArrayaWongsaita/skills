---
name: implement-tickets
description: Implement a published spec by following the installed upstream implement-spec skill from start to finish, while keeping a Run status file that shows every ticket and its state. Stops before the code review when a ticket is stuck or still waiting.
disable-model-invocation: true
---

# Implement Tickets

Run the upstream `implement-spec` flow on one spec and keep a Run status the
person can open at any time. This skill owns no planner, script, or reference
set; it reads the installed upstream skills and follows them, with the additions
below placed around their steps. No upstream step is changed.

Invocation: `/implement-tickets <spec reference>` or `$implement-tickets <spec reference>`.
The reference is a path, an issue number, or a URL. It takes a spec reference and
nothing else. Start only when the person invokes it. This skill covers a first run.

## Preflight

Locate the `SKILL.md` of each skill below, taking the first of these that exists:

1. `.agents/skills/<skill>/SKILL.md`
2. `.claude/skills/<skill>/SKILL.md`
3. `~/.agents/skills/<skill>/SKILL.md`
4. `~/.claude/skills/<skill>/SKILL.md`

- `implement-spec`
- `tdd`
- `code-review`

When any is missing, stop before any work, name each missing skill, and print its
install line, then wait:

```text
npx skills add mattpocock/skills --skill implement-spec
npx skills add mattpocock/skills --skill tdd
npx skills add mattpocock/skills --skill code-review
```

The project's Tracker doc is `docs/agents/issue-tracker.md`. When it is missing,
stop and point to the upstream setup skill; do not guess where specs and tickets
live:

```text
npx skills add mattpocock/skills --skill setup-matt-pocock-skills
```

## Flow

Read the located `implement-spec` `SKILL.md` and follow it in this one context,
as written. It names `tdd` for each implementer and `code-review` for the closing
review; follow both as it says. Add only this:

1. Turn the argument into the canonical spec reference, before anything is looked
   up: the spec file's path from the repository root for a local Tracker, the
   spec's identifier in the form the Tracker doc uses for a remote one. A number
   and a URL of the same spec are one reference.
2. After the integration branch is created and before any ticket is handed out,
   write the Run status with every row `waiting`.
3. Update the Run status at each event listed under Run status.
4. With a local Tracker, give subagents the spec and tickets as absolute paths in
   the main checkout; a Tracker directory that git ignores does not exist in a
   worktree.
5. Tell each merger to end the commit message as the Trailer rule says.
6. Apply the Stopping rule where upstream would go on to `code-review`.
7. When upstream's last step is complete, set the run state to `finished`.

## Run status

Only this context writes it. It is `status.md` in the feature's directory under
`.scratch/`: the directory that holds the spec for a local Tracker; for a remote
one, a directory named from the spec's Tracker identifier and a slug of its title.

Header: the canonical spec reference, the integration branch, the pull request
when one exists, the run state (`open` or `finished`), and the time of the last
update. Then one row per ticket:

```text
| Ticket | Title | Blocked by | Status | Commit |
```

Ticket is the identifier in the Tracker's own form; Commit is the commit on the
integration branch that merged the ticket. Status is one of:

- `waiting`: not handed to an implementer.
- `in progress`: handed to an implementer and not yet merged.
- `done`: merged onto the integration branch.
- `stuck`: the implementer or the merger failed, or ended without a usable result.

Write at these events: the first write above, a ticket handed out, a ticket
merged, a ticket becoming `stuck`, a pull request opened, and the run finishing.
A `stuck` ticket gets one line under the table giving the reason and the location
of its kept worktree. Tickets blocked by a `stuck` ticket stay `waiting` while
independent tickets keep going.

A file is a Run status only when its table header is exactly the five columns
above. When `status.md` at the target location is anything else, it is not a Run
status: stop, say so, and leave it as it is.

Before the first write, when the project is a git repository that does not ignore
the file, add a local exclude (`.git/info/exclude`) for that one file, change no
tracked file, and tell the person.

## Trailer

Tell the merger to end the message of the commit that lands a ticket on the
integration branch with a trailer naming that ticket. For a remote Tracker the
trailer holds the ticket's Tracker identifier. For a local Tracker it holds the
feature directory name and the ticket number, so tickets of different features
never share a trailer.

## Stopping rule

When no ticket is `in progress`, no ticket can be handed out, and at least one is
`stuck` or `waiting`, stop before `code-review` and before any ticket is closed.
Run the upstream cleanup for the worktrees of `done` tickets and keep each `stuck`
ticket's worktree. Report the stuck tickets with their reasons, the tickets they
hold, and anything that could not be removed.
