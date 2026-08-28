# Architecture

`engineering-workflow` is the control plane. It owns classification, routing,
durable state, transitions, gate budgets, bounded loops, resume, and the final
`COMPLETE`/`BLOCKED` decision. It does not contain a specialist method.

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
the returned result into state. It never creates a replacement skill or a
second copy of an external workflow. A missing dependency pauses the route;
there is no local fallback worker.

## Runtime adapters

Codex's documented skill surface supports explicit `$skill-name` activation,
implicit selection, repository/user skill paths, and
`allow_implicit_invocation: false`. It does not document a child-skill API.
The Codex adapter therefore audits and loads the exact resolved `SKILL.md`
path when the dependency is model-loadable; when its installed policy is
explicit-only, it records a user handoff with the real `$skill-name` command.
It never assumes a model-visible inventory or invents a child call.

Claude Code supports the `Skill` tool and qualified plugin names. A dependency
with `disable-model-invocation: true` cannot be called by Claude's model; the
runtime explicitly tells it not to reproduce that skill. The adapter persists
`USER_INVOCATION_REQUIRED`, gives the user the real `/skill-name` command, and
resumes after the user invokes it. Model-invocable plugin skills use their
qualified namespace; standalone skills use their exact audited name/path.

The orchestrator itself is explicit-only in Codex metadata. Claude installs
must use the documented `disable-model-invocation: true` frontmatter or the
equivalent `skillOverrides.<name> = "user-invocable-only"` setting.

## Persistence boundary

State contains identity, classification, stage/mode, compact transition
history, dependency resolutions/status, dependency-install pause/permission
records, independent design/system scrutinize counters and compact cycle
history, code gate counters, child IDs, and fingerprinted artifact references.
It never stores full specs, tickets, reviews, reports, or shell output.
Compare-and-swap uses `revision`; writes are lock-protected, fsynced, and
atomically replaced. Completed state is retained for audit and idempotency.

Design and system scrutinize each have `MAX_SCRUTINIZE_CYCLES=6`; cycle counts
only completed reviews. A non-`SHIP` result on cycle 6, or demonstrable
no-progress earlier, becomes `BLOCKED`. Final-system fixes return through
validation and code review before the next system review.

## Large-project composition

The parent stores a destination, frontier references, and child workflow IDs.
Each bounded feature has independent state and gates. Child state is never
copied into the parent. Assumption changes return to the external `wayfinder`
skill before new child scopes are created.

## Distribution

The repository remains CLI-first under ADR 0001. This change adds one
orchestrator skill only; external specialist packages are dependencies and no
plugin or marketplace bundle is authored here.
