# Dependency Policy

`engineering-workflow` is the only orchestration skill. Specialists remain
external package-like dependencies; a missing dependency pauses its stage and
never causes this repository to create, copy, wrap, or substitute a worker.

## Canonical registry

[`../data/dependencies.json`](../data/dependencies.json) is the single source
of truth for dependency identity, provenance expectations, stage requirement,
expected invocation mode, transitive relationships, and install source.
`dependency_audit.py` reads that file directly. Tests validate the same file.
Do not independently maintain dependency tables or install commands in
Markdown or Python.

The registry is expected configuration, not runtime truth. In particular it
does not claim that a skill is installed, enabled, compatible, model-invocable,
or installed at a particular scope/version. The audit discovers those facts
from installed files, policy, plugin metadata, and lock metadata.

## Provider policy

Matt Pocock's `mattpocock/skills` is canonical whenever the required
engineering skill exists there. The intentional exceptions are:

- `scrutinize` from `thananon/9arm-skills`
- `post-mortem` from `thananon/9arm-skills`

Do not add fallback providers, and do not treat a colliding bare name as a
provider match. A source is `VERIFIED` only when installed metadata or a lock
record identifies the expected repository. Otherwise report
`UNKNOWN / requires verification`; never infer ownership from the skill name.

## Stage-scoped audit

Audit only the dependency needed for the immediate stage. Expand its declared
hard transitive children, but do not audit the rest of the route. Examples:

- normal Feature `DISCOVERY`: `grill-with-docs` plus its declared transitive
  support;
- `DESIGN_REVIEW` or required `SYSTEM_REVIEW`: `scrutinize`;
- Bug `DIAGNOSIS`: `diagnosing-bugs`;
- `EXPLORATION[PROTOTYPE]`: `prototype` only after that mode is selected.

`tdd` and `codebase-design` are audited only when the installed owning
contract actually routes to them. Missing conditional or future-stage skills
do not block startup and do not produce installation prompts.

Within one workflow session, reuse the audited registry version, script path,
runtime capability, and unchanged external `SKILL.md` resolution. Re-audit
when entering a newly dependent stage, after installation, after provenance or
policy changes, or when the recorded content hash no longer matches. A new
session validates only facts that could have changed.

## Installation boundary

The registry stores the canonical repository/install source, not permanent CLI
syntax. A missing-dependency audit therefore returns an unverified install
intent and performs no mutation. Only when installation is actually needed:

1. inspect the active runtime's supported installer or documented installer
   interface once;
2. derive and verify the exact command and scope for the named skills/source;
3. show skill, owner, repository, role, needed stage, exact command, and scope;
4. ask for explicit permission;
5. execute only the approved command;
6. re-audit installed files and provenance before resuming the paused stage.

Do not present an unverified command as executable. Do not treat an unrelated
continuation message as approval. Installation approval does not authorize an
update, source replacement, removal, broader scope, or repository setup.
Compatible missing skills may be grouped only after the installer syntax and
scope for that exact group are verified.

## Repository bootstrap

Skill installation and repository configuration are different facts. Check
`setup-matt-pocock-skills` only when a downstream Matt skill's current contract
requires repository configuration and the expected configuration is absent.
Ask before invoking it and do not run it once per workflow.

## Runtime and contract checks

The audit resolves exact installed paths/qualified identities, enabled state,
invocation policy, provenance, side effects declared by the registry, and
required capabilities. Claude user-only skills require a real user handoff.
Codex uses the exact audited path only when its installed policy permits model
loading. `research` and the two-axis `code-review` block when their required
subagent capability is unavailable.

Inspect an external `SKILL.md` when first validating it, when its content hash
or provenance changes, or when invocation/compatibility is uncertain. Do not
re-read an unchanged definition during the same session.

For `dependencies`/`skills`, an explicit full inventory is read-only and may
report missing optional entries without proposing installation.
