# Implementers update the catalog at integration, from text they already hold

A ticket that creates, extends, or promotes a module must leave a catalog entry
behind. The implementer's orchestrator writes it in the ticket's squash-merge
commit — the same commit that already ticks the ticket's checkboxes and sets its
`Status:` — deriving all three parts of the entry without reading code:

- **symbol** — from the ticket's Reuse field;
- **file** — by grepping that symbol within the worker's reported changed files
  (the grep doubles as the existence check ADR 0001 requires);
- **use-when** — from the spec's Reuse Plan.

Why the orchestrator and not the worker: `agy-implement` and
`opencode-implement` run workers in parallel worktrees, and two workers editing
one catalog file would collide at merge. Integration is serial in all three
implementers, so orchestrator writes never conflict. Why derive instead of
asking the worker for an entry block: it keeps the worker prompt's Return
contract unchanged and keeps the orchestrator's work text-only
(`subagent-implement` ADRs 0001/0002) — a grep and a line of Markdown, no code
read.

Trade-off: the entry carries the planned use-when, not a description of the code
as actually written. Acceptable, because an entry is a pointer — the agent that
uses the module reads its real interface from the file. A shared module a worker
creates *without* it being in the Reuse field gets no entry at integration; the
next Reuse survey or `review-to-pr` catches it.
