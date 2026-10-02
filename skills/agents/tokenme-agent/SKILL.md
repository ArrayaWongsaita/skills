---
name: tokenme-agent
description: Delegate mechanical, self-contained subtasks — a rename across small files, boilerplate, mechanical formatting, lint-and-report, log summarising — to a cheap headless tokenme run so host context and quota stay available for work that needs judgment. Load it when you recognise a mechanical, self-contained subtask in your own plan, or when the task text says "use tokenme", "delegate this", or "do this cheaply". Keep on the host anything touching secrets, credentials or `.env` files, high-risk tickets, code the user marked as staying local, design and architecture choices, and tasks that need this chat's earlier context.
---

# tokenme-agent

Delegate a mechanical, self-contained subtask to a cheap headless tokenme run
instead of spending host context and quota on it. The host keeps the judgment
and the verification; the delegated run does the repetitive work.

## Invocation

Three entry points load this skill:

- Model invocation — the skill loads on its own when you recognise a
  mechanical, self-contained subtask in your current work. A rename across
  small files is the canonical example: recognise one and delegate it through
  the workflow below instead of doing it yourself.
- Phrasing inside any task text — when the task text says "use tokenme",
  "delegate this", or "do this cheaply" for one of its subtasks, treat the
  phrase as naming this skill for that subtask and consider delegating that
  subtask, even though the user typed no command.
- Direct invocation by name:
  - Universal / slash command: `/tokenme-agent <task description>`
  - Codex command: `$tokenme-agent <task description>`

## What to delegate

A subtask qualifies when it is mechanical (the steps are already decided) and
self-contained (it needs nothing from this conversation):

- A rename across small files, mechanical formatting, boilerplate generation.
- Batch edits with a checkable acceptance criterion.
- Read-only crunching with a fixed output, such as summarising a large log.

Keep on the host anything touching secrets, `.env` or credential files,
tickets marked `Risk: high`, or code the user has marked as staying local;
keep design, architecture, and debugging that needs judgment there too, plus
any task that depends on this chat's earlier context.

## Workflow

1. **Recognise** the subtask — from your own plan, or from "use tokenme",
   "delegate this", or "do this cheaply" phrasing in the task text — and
   check it against What to delegate.
2. **Delegate** the subtask to a headless tokenme run through a
   self-contained prompt.
3. **Verify** the outcome yourself before reporting done; treat the delegated
   run's report as a claim to check, and report with your own verification
   behind it.
