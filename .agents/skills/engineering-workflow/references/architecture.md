# Architecture

`engineering-workflow` is the control plane. It owns classification, routing,
durable state, transitions, gate budgets, bounded loops, resume, and the final
`COMPLETE`/`BLOCKED` decision. Installed specialist skills retain sole ownership of
their respective disciplines.

```text
explicit user request
        |
engineering-workflow
        |-- dependencies.json ----> canonical expected dependency metadata
        |-- dependency_audit.py --> immediate-stage dependency/provenance/status
        |                              + permission-gated install proposal
        |-- state-machine.json ----> canonical executable transition graph
        |-- workflow_state.py ----> .agents/workflows/<id>.json
        `-- external engineering skill --> repository artifacts/evidence
```

The external skill remains the source of truth. The orchestrator supplies the
request, bounded artifact references, and repository context, then normalizes
the returned result into state. It maintains external dependencies as distinct
packages. A missing dependency pauses the route until installed.

## Runtime adapters

Codex's documented skill surface supports explicit `$skill-name` activation,
implicit selection, repository/user skill paths, and
`allow_implicit_invocation: false`. The Codex adapter audits and loads the
exact resolved `SKILL.md` path when the dependency is model-loadable; when its
installed policy is explicit-only, it records a user handoff with the real
`$skill-name` command. It relies strictly on audited filesystem paths and explicit handoffs.

Claude Code supports the `Skill` tool and qualified plugin names. A dependency
with `disable-model-invocation: true` requires user invocation. The adapter
persists `USER_INVOCATION_REQUIRED`, provides the user with the real `/skill-name`
command, and resumes after user invocation. Model-invocable plugin skills use
their qualified namespace; standalone skills use their exact audited name/path.

The orchestrator itself is explicit-only in Codex metadata. Claude installs
must use the documented `disable-model-invocation: true` frontmatter or the
equivalent `skillOverrides.<name> = "user-invocable-only"` setting.

## Persistence boundary

State contains identity, classification, stage/mode, compact transition
history, dependency resolutions/status, dependency-install pause/permission
records, independent design/system scrutinize counters and compact cycle
history, code gate counters, child IDs, and fingerprinted artifact references.
Full specs, tickets, reviews, and reports reside as repository files.
Compare-and-swap uses `revision`; writes are lock-protected, fsynced, and
atomically replaced. Completed state is retained for audit and idempotency.

Design and system scrutinize each have `MAX_SCRUTINIZE_CYCLES=6`; cycle counts
track completed reviews. A non-`SHIP` result on cycle 6, or demonstrable
no-progress earlier, transitions to `BLOCKED`. Final-system fixes return through
validation and code review before the next system review.

## Script interfaces

The orchestrator interacts with two local helper scripts: `dependency_audit.py` and `workflow_state.py`.

### `dependency_audit.py` (Read-only)

Audits stage dependencies and provenance without mutating the environment.

```text
python3 <skill>/scripts/dependency_audit.py
  --runtime <codex|claude>
  [--search-root <path>]...
  (--require <skill>... |
   --workflow-type <FEATURE|BUG|LARGE_PROJECT> [--stage <stage>] [--stage-mode <RESEARCH|PROTOTYPE>] |
   --inventory)
  [--risk <LOW|MEDIUM|HIGH|CRITICAL>]
  [--uncertainty <LOW|MEDIUM|HIGH|CRITICAL>]
  [--characteristic <name>]... [--reduced] [--incident]
  [--has-subagents] [--orchestrator-skill <SKILL.md>]
  [--repository-root <path>] [--require-repository-setup]
```

- `--workflow-type` with `--stage`: audits only the immediate stage and its declared hard transitive children.
- `--inventory`: outputs full registry inventory for inspection (`dependencies`/`skills` command).
- Exit `0`: all requested stage dependencies resolve.
- Exit `2`: issue detected (`MISSING_DEPENDENCY`, `DISABLED_DEPENDENCY`, `AMBIGUOUS_DEPENDENCY`, `PROVENANCE_MISMATCH`, `SUBAGENT_CAPABILITY_REQUIRED`, `REPOSITORY_SETUP_REQUIRED`, `INVOCATION_POLICY_INCOMPATIBLE`).

### `workflow_state.py` (Atomic CAS State Machine)

Manages durable workflow state in `.agents/workflows/<id>.json`. Uses atomic compare-and-swap (CAS) via `revision` and advisory file locks.

Global syntax: `python3 <skill>/scripts/workflow_state.py [--root <repository>] <subcommand>`

#### Read-only subcommands:
- `list [--include-complete]`: lists tracked workflows.
- `status [<workflow-id>]`: displays concise summary of active stage, mode, gate counters, and blockers.

#### Mutating subcommands:
- `init <request> [--type <FEATURE|BUG|LARGE_PROJECT>] [--parent <id>]`
- `reconstruct <id> <request> [--type <FEATURE|BUG|LARGE_PROJECT>]`
- `transition <id> <target> [--mode <stage-mode>] --reason <text>`
- `classify <id> <type> <risk> <uncertainty> --scope <text> [--characteristic <name>]... [--incident]`
- `block <id> <code> <message> [--owner <owner>]`
- `unblock <id> --reason <text>`
- `register-artifact <id> <kind> <relative-path> <producer-stage>`
- `set-work-item <id> <reference>`
- `set-mitigation <id> <outstanding|resolved> --reason <text>`
- `record-dependencies <id> <audit-json-path>`
- `add-child <id> <child-id>`
- `verify <id> [--command-json '<JSON argv array>']...`
- `gate <id> <design|code|system> [--blocker <finding>]...`
- `scrutinize <id> <design|system> <verdict> [finding/progress options]`
- `request-installation <id> <dependencies-json> <verified-proposals-json> --needed-at <stage> --reason <text>`
- `installation-decision <id> <approved|declined> --reason <text>`
- `reconcile [<id>] [--run-checks]`

## Large-project composition

The parent stores a destination, frontier references, and child workflow IDs.
Each bounded feature maintains independent state and gates. Assumption
changes return to the external `wayfinder` skill before new child scopes are created.

## Distribution

The repository remains CLI-first under ADR 0001. This change adds one
orchestrator skill directly, maintaining external specialist packages as dependencies.
