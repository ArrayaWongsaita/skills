# Dependency Registry

`engineering-workflow` has one orchestration skill. Every specialist below is
an external package-like dependency. The orchestrator may discover, resolve,
route to, and report these skills; it must not copy, wrap, fork, or reimplement
their `SKILL.md` files.

The registry is expected configuration, not proof of installation. Before
relying on a dependency, audit the installed `SKILL.md`, runtime policy,
nearest plugin metadata, and available lock metadata. A source is `VERIFIED`
only when installed metadata or a lock record identifies the expected
repository. Otherwise report `UNVERIFIED` and `Source: UNKNOWN / requires
verification`; never guess from a skill name.

## Core feature workflow

| Skill | Owner | Repository | Role | Requirement | Installation | Invocation |
|---|---|---|---|---|---|---|
| `grill-with-docs` | leejianrong | `leejianrong/claude-skills` | Requirement discovery, domain clarification, assumptions, glossary, decisions, ADR capture | `REQUIRED_NOW` for a normal feature | `npx skills@latest add leejianrong/claude-skills --skill=grill-with-docs` | Use the audited exact path; if user-only, hand off `/grill-with-docs` |
| `to-spec` | Matt Pocock | `mattpocock/skills` | Specification synthesis | `REQUIRED_LATER` after discovery | `npx skills@latest add mattpocock/skills --skill=to-spec` | Use the audited exact path; if user-only, hand off `/to-spec` |
| `scrutinize` | thananon | `thananon/9arm-skills` | Blocking outsider/end-to-end design and system quality gate | `REQUIRED_LATER` before each design gate and required final system gate | `npx skills@latest add thananon/9arm-skills --skill=scrutinize` | Use the audited exact path or qualified `9arm-skills:scrutinize` |
| `to-tickets` | Matt Pocock | `mattpocock/skills` | Vertical ticket planning | `REQUIRED_LATER` after design `SHIP` | `npx skills@latest add mattpocock/skills --skill=to-tickets` | Use the audited exact path; if user-only, hand off `/to-tickets` |
| `implement` | Matt Pocock | `mattpocock/skills` | Implementation execution | `REQUIRED_LATER` for feature/bug implementation | `npx skills@latest add mattpocock/skills --skill=implement` | Use the audited exact path; disclose source-defined side effects before invocation |
| `code-review` | Matt Pocock | `mattpocock/skills` | Two-axis standards/specification review | `REQUIRED_LATER` after every implementation and after final-system fixes | `npx skills@latest add mattpocock/skills --skill=code-review` | Use the audited path or `mattpocock-skills:code-review`; never Claude's bare collision |

## Conditional, transitive, and repository setup dependencies

| Skill | Owner | Repository | Role | Requirement | Installation | Invocation |
|---|---|---|---|---|---|---|
| `setup-matt-pocock-skills` | Matt Pocock | `mattpocock/skills` | One-time repository workflow configuration | `TRANSITIVE` when a Matt skill requires setup | `npx skills@latest add mattpocock/skills --skill=setup-matt-pocock-skills` | Invoke once per repository after checking setup output |
| `tdd` | Matt Pocock | `mattpocock/skills` | Test-first implementation discipline | `TRANSITIVE` when the installed implementation/bug contract requires it | `npx skills@latest add mattpocock/skills --skill=tdd` | Use only when the owning skill routes to it |
| `codebase-design` | Matt Pocock | `mattpocock/skills` | Deep-module and seam vocabulary | `CONDITIONAL` when an interface/seam decision is unclear | `npx skills@latest add mattpocock/skills --skill=codebase-design` | Consult as an external dependency; do not replace the stage owner |
| `prototype` | Matt Pocock | `mattpocock/skills` | Disposable empirical/UI/state experiment | `CONDITIONAL` for unresolved empirical uncertainty | `npx skills@latest add mattpocock/skills --skill=prototype` | Use in `EXPLORATION[PROTOTYPE]` only when routing requires it |
| `research` | Matt Pocock | `mattpocock/skills` | Authoritative current external/API fact investigation | `CONDITIONAL` for external evidence; may require subagents | `npx skills@latest add mattpocock/skills --skill=research` | Use in `EXPLORATION[RESEARCH]` only when routing requires it |
| `diagnosing-bugs` | Matt Pocock | `mattpocock/skills` | Reproduction, tracing, and root-cause diagnosis | `CONDITIONAL`/`REQUIRED_NOW` for `BUG` | `npx skills@latest add mattpocock/skills --skill=diagnosing-bugs` | Use at `DIAGNOSIS` |
| `wayfinder` | Matt Pocock | `mattpocock/skills` | Large-project decision map and frontier | `CONDITIONAL`/`REQUIRED_NOW` for `LARGE_PROJECT` | `npx skills@latest add mattpocock/skills --skill=wayfinder` | Use at `WAYFINDING`; if user-only, hand off `/wayfinder` |
| `post-mortem` | thananon | `thananon/9arm-skills` | Engineering record after an important validated fix | `CONDITIONAL` for eligible incidents/bug fixes | `npx skills@latest add thananon/9arm-skills --skill=post-mortem` | Use only after validation and contract compatibility are established |

The `category` and route-specific `requirement` in the audit output are the
source of truth for whether a conditional skill is currently needed. Missing
optional skills do not block an unrelated workflow and do not create an
installation prompt.

## Verification and installation policy

The installation commands above are based on the Skills CLI's documented
project-local form, the Matt Pocock and 9arm repository READMEs, and the
leejianrong repository layout. The CLI supports selecting one or more skills
with `--skill`; run the command from the target repository so its default
scope remains project-local. If the runtime does not provide `npx`, network
access, or project skill mutation, show the command as manual instructions and
mark the workflow `BLOCKED_DEPENDENCY`.

Before displaying or running a command:

1. Inspect whether the exact skill already exists in project-local, user/global,
   plugin-provided, or runtime-native locations.
2. Inspect its frontmatter, plugin manifest, runtime policy, and lock metadata.
3. Verify its actual name and expected source. Existing-but-unverified skills
   are not reinstalled automatically; a source mismatch is reported and left
   in place until the user decides.
4. Show owner, repository, purpose, required stage, command, verification
   evidence, and install scope. Every proposal has `requiresApproval: true`.
5. Ask explicit permission before network, installation, setup, update,
   replacement, or removal. Approval to install does not authorize an update.
6. After an approved install, verify the file and source with a fresh audit
   before clearing the dependency blocker. Resume from the paused stage; do not
   restart discovery.

Group missing skills from the same compatible repository into one request. Do
not install conditional skills prematurely. Do not substitute a similarly
named repository, a local approximation, or a newly authored sibling skill.

## Repository bootstrap

Skill installation and repository bootstrap are separate facts:

```text
to-spec: INSTALLED
setup-matt-pocock-skills: INSTALLED
repository setup: MISSING
```

Check for the provider's setup output (normally
`docs/agents/issue-tracker.md` and `docs/agents/domain.md`) before using a
Matt skill that requires it. If missing, ask before invoking
`setup-matt-pocock-skills`; do not create those files as a replacement and do
not rerun setup on every workflow.

## Read-only inventory

`python3 scripts/dependency_audit.py --runtime <codex|claude> --inventory`
reports every registry entry with owner, expected source, role, category,
provenance, and `INSTALLED`, `MISSING`, `DISABLED`, `AMBIGUOUS`,
`PROVENANCE_MISMATCH`, or `NOT_CHECKED` status. Inventory never installs or
updates anything. A route audit should instead pass only the dependencies
needed at the current stage.
