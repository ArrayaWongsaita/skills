# Dependency Registry

`engineering-workflow` is the one orchestration skill. Every specialist below
is an external package-like dependency. The orchestrator may discover, resolve,
route to, and report these skills; it must not copy, wrap, fork, or reimplement
their `SKILL.md` files.

The registry is expected configuration, not proof of installation. Before
relying on a dependency, audit the installed `SKILL.md`, runtime policy,
nearest plugin metadata, and available lock metadata. A source is `VERIFIED`
only when installed metadata or a lock record identifies the expected
repository. Otherwise report `UNVERIFIED` and `Source: UNKNOWN / requires
verification`; never guess from a skill name.

## Verified Discovery contract

The current Matt Pocock source is
[`skills/engineering/grill-with-docs/SKILL.md`](https://github.com/mattpocock/skills/blob/main/skills/engineering/grill-with-docs/SKILL.md).
Its exact skill name is `grill-with-docs`, and its frontmatter marks it
`disable-model-invocation: true`: it is user-invoked. Its seven-line contract
delegates the actual interview and domain work to `grilling` and
`domain-modeling`; those are transitive support skills, not workflow stages.

The Discovery input is the request or plan plus relevant repository context,
the existing glossary, and ADRs. Its output is shared decisions, clarified
terminology, open questions, `CONTEXT.md` glossary updates, and warranted ADR
references. The upstream skill does not declare a repository bootstrap of its
own. The downstream Matt engineering skills do require the one-time
`setup-matt-pocock-skills` bootstrap before they read or write tracker/workflow
configuration.

The current Skills CLI installs only explicitly selected skills; it does not
resolve the `grill-with-docs` calls to `grilling` or `domain-modeling`
automatically. The audit therefore expands the verified hard transitive
closure before Discovery and asks permission for any missing support skill.

## Core feature workflow

| Skill | Owner | Repository | Role | Requirement | Installation | Invocation |
|---|---|---|---|---|---|---|
| `grill-with-docs` | Matt Pocock | `mattpocock/skills` | Requirement discovery, domain clarification, decision capture, glossary/ADR preparation | `REQUIRED_NOW` for a normal feature | `npx skills add https://github.com/mattpocock/skills --skill grill-with-docs` | User-invoked; use the audited handoff/load target |
| `to-spec` | Matt Pocock | `mattpocock/skills` | Specification synthesis | `REQUIRED_LATER` after discovery | `npx skills add https://github.com/mattpocock/skills --skill to-spec` | User-invoked; hand off when the runtime requires it |
| `scrutinize` | thananon / 9arm-skills | `thananon/9arm-skills` | Blocking outsider/end-to-end design and system quality gate | `REQUIRED_LATER` before each design gate and required final system gate | `npx skills add https://github.com/thananon/9arm-skills --skill scrutinize` | Use the audited exact path or qualified `9arm-skills:scrutinize` |
| `to-tickets` | Matt Pocock | `mattpocock/skills` | Vertical ticket planning | `REQUIRED_LATER` after design `SHIP` | `npx skills add https://github.com/mattpocock/skills --skill to-tickets` | User-invoked; hand off when the runtime requires it |
| `implement` | Matt Pocock | `mattpocock/skills` | Implementation execution | `REQUIRED_LATER` for feature/bug implementation | `npx skills add https://github.com/mattpocock/skills --skill implement` | Disclose its source-defined commit side effect |
| `code-review` | Matt Pocock | `mattpocock/skills` | Two-axis standards/specification review | `REQUIRED_LATER` after every implementation and after final-system fixes | `npx skills add https://github.com/mattpocock/skills --skill code-review` | Use the audited path or `mattpocock-skills:code-review` |

## Transitive / supporting dependencies

These dependencies support an owning external skill. They do not become
top-level workflow stages.

| Skill | Owner | Repository | Role | Requirement | Installation | Invocation |
|---|---|---|---|---|---|---|
| `grilling` | Matt Pocock | `mattpocock/skills` | Relentless requirement and design interview | `TRANSITIVE`, required by `grill-with-docs` | `npx skills add https://github.com/mattpocock/skills --skill grilling` | Model-invoked by the owning skill |
| `domain-modeling` | Matt Pocock | `mattpocock/skills` | Domain terminology, glossary, and ADR discipline | `TRANSITIVE`, required by `grill-with-docs` | `npx skills add https://github.com/mattpocock/skills --skill domain-modeling` | Model-invoked by the owning skill |
| `tdd` | Matt Pocock | `mattpocock/skills` | Test-first implementation discipline | `TRANSITIVE` when the implementation/bug contract routes to it | `npx skills add https://github.com/mattpocock/skills --skill tdd` | Use only when the owning skill routes to it |
| `codebase-design` | Matt Pocock | `mattpocock/skills` | Deep-module and seam vocabulary | Supporting/conditional when a seam or interface decision is unclear | `npx skills add https://github.com/mattpocock/skills --skill codebase-design` | Consult as an external reference; do not replace the stage owner |

The verified Discovery graph is:

```text
engineering-workflow
    ↓
grill-with-docs (DISCOVERY)
    ├── grilling        (TRANSITIVE)
    └── domain-modeling (TRANSITIVE)
```

The orchestrator audits the two transitive children when it audits
`grill-with-docs`, but never routes to them independently during a normal
Feature flow. `implement` may route to `tdd`, and `tdd` may consult
`codebase-design`; those are source-defined supporting paths.

## Conditional dependencies

| Skill | Owner | Repository | Role | Requirement | Installation | Invocation |
|---|---|---|---|---|---|---|
| `prototype` | Matt Pocock | `mattpocock/skills` | Disposable empirical/UI/state experiment | `CONDITIONAL` for unresolved empirical uncertainty | `npx skills add https://github.com/mattpocock/skills --skill prototype` | Use only in `EXPLORATION[PROTOTYPE]` |
| `research` | Matt Pocock | `mattpocock/skills` | Authoritative current external/API fact investigation | `CONDITIONAL` for external evidence; may require subagents | `npx skills add https://github.com/mattpocock/skills --skill research` | Use only in `EXPLORATION[RESEARCH]` |
| `diagnosing-bugs` | Matt Pocock | `mattpocock/skills` | Reproduction, tracing, and root-cause diagnosis | `CONDITIONAL`/`REQUIRED_NOW` for `BUG` | `npx skills add https://github.com/mattpocock/skills --skill diagnosing-bugs` | Use at `DIAGNOSIS` |
| `wayfinder` | Matt Pocock | `mattpocock/skills` | Large-project decision map and frontier | `CONDITIONAL`/`REQUIRED_NOW` for `LARGE_PROJECT` | `npx skills add https://github.com/mattpocock/skills --skill wayfinder` | User-invoked; hand off when required |
| `post-mortem` | thananon / 9arm-skills | `thananon/9arm-skills` | Engineering record after an important validated fix | `CONDITIONAL` for eligible incidents/bug fixes | `npx skills add https://github.com/thananon/9arm-skills --skill post-mortem` | Use only after validation and contract compatibility is established |

Missing optional skills do not block an unrelated workflow and do not create
an installation prompt.

## Repository bootstrap

| Skill | Owner | Repository | Role | Requirement | Installation |
|---|---|---|---|---|---|
| `setup-matt-pocock-skills` | Matt Pocock | `mattpocock/skills` | One-time repository issue-tracker, labels, and domain-doc configuration | `REPOSITORY_BOOTSTRAP` when a downstream Matt skill requires setup | `npx skills add https://github.com/mattpocock/skills --skill setup-matt-pocock-skills` |

Installation and repository configuration are separate facts:

```text
Skill installed: YES
Repository configured: NO
```

Check for the provider's setup output (normally
`docs/agents/issue-tracker.md` and `docs/agents/domain.md`) before using a
downstream Matt skill that requires it. Ask before invoking
`setup-matt-pocock-skills`, perform it once per repository, and never rerun it
on every workflow invocation.

## Verification and installation policy

The displayed command form is verified against the current Skills CLI:
`npx skills add <package> --skill <name>`. The CLI accepts a full
GitHub URL, and the default scope is project-local when run from the target
repository. The local runtime must still provide `npx`; when network access or
project mutation is unavailable, provide the verified command as manual
instructions and persist `BLOCKED_DEPENDENCY`.

Before displaying or running a command:

1. Inspect whether the exact skill exists in project-local, user/global,
   plugin-provided, or runtime-native locations.
2. Inspect its frontmatter, plugin manifest, runtime policy, and lock metadata.
3. Verify its exact name and expected source. Existing-but-unverified skills
   are not reinstalled automatically; a source mismatch is reported and left
   in place until the user decides.
4. Show owner, repository, purpose, required stage, command, verification
   evidence, and install scope. Every proposal has `requiresApproval: true`.
5. Ask explicit permission before network, installation, setup, update,
   replacement, or removal. Approval to install does not authorize an update.
6. After an approved install, verify the file and source with a fresh audit
   before clearing the dependency blocker. Resume from the paused stage; do
   not restart discovery.

For a missing Discovery skill, report:

```text
Missing Skill

Skill: grill-with-docs
Purpose: Requirement discovery and domain/decision clarification.
Owner: Matt Pocock
Repository: mattpocock/skills
Needed At: DISCOVERY
Installation: npx skills add https://github.com/mattpocock/skills --skill grill-with-docs
Permission Required: Yes
```

Then ask: `The required "grill-with-docs" skill from Matt Pocock's mattpocock/skills repository is not installed. May I install it?`

For a missing transitive dependency, show the parent and preserve the same
permission boundary:

```text
Installed:
✓ grill-with-docs

Missing transitive dependency:
✗ domain-modeling

Required by:
grill-with-docs

Owner: Matt Pocock
Repository: mattpocock/skills
```

Because the current installer does not auto-install skill-to-skill
dependencies, the audit includes any missing transitive child in a verified,
permission-gated proposal. Compatible missing skills from one repository may
be grouped into one command. Do not install conditional skills prematurely or
substitute a similarly named implementation.

## Read-only inventory

`python3 scripts/dependency_audit.py --runtime <codex|claude> --inventory`
reports every registry entry with owner, expected source, role, category,
provenance, and `INSTALLED`/`MISSING`/`DISABLED`/`AMBIGUOUS`/
`PROVENANCE_MISMATCH`/`NOT_CHECKED` status. Inventory never installs or
updates anything. A route audit should instead pass only the dependencies
reachable by the current stage, including verified hard transitive children.
