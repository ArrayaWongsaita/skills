---
name: grill-to-tickets
description: Carry one idea from a relentless interview to published tickets by following the installed upstream planning skills in one context, with one outside review of the spec before tickets are cut. Stops at published tickets and never implements.
disable-model-invocation: true
---

# Grill To Tickets

Take one idea through the upstream planning flow in one command, then stop. This
skill owns no spec format, no ticket format, and no copy of an upstream skill; it
reads the installed upstream skills and follows them.

Invocation: `/grill-to-tickets <idea>` or `$grill-to-tickets <idea>`. It takes an
idea and nothing else. Start only when the person invokes it.

## Preflight

Locate the `SKILL.md` of each skill below, taking the first of these that exists:

1. `.agents/skills/<skill>/SKILL.md`
2. `.claude/skills/<skill>/SKILL.md`
3. `~/.agents/skills/<skill>/SKILL.md`
4. `~/.claude/skills/<skill>/SKILL.md`

- `grill-with-docs`
- `grilling`
- `domain-modeling`
- `to-spec`
- `scrutinize`
- `to-tickets`

When any is missing, stop before the interview, name each missing skill, and
print its install line, then wait:

```text
npx skills add mattpocock/skills --skill grill-with-docs
npx skills add mattpocock/skills --skill grilling
npx skills add mattpocock/skills --skill domain-modeling
npx skills add mattpocock/skills --skill to-spec
npx skills add mattpocock/skills --skill to-tickets
npx skills add thananon/9arm-skills --skill scrutinize
```

The project's Tracker doc is `docs/agents/issue-tracker.md`. When it is missing,
stop and point to the upstream setup skill; do not guess where specs and tickets
live:

```text
npx skills add mattpocock/skills --skill setup-matt-pocock-skills
```

## Flow

Run each stage by reading the located `SKILL.md` and following it in this one
context, in this order:

1. `grill-with-docs`: the interview. It names `grilling` and `domain-modeling`; follow both.
2. `to-spec`: write and publish the spec, including its seam check with the person.
3. `scrutinize`: one outside review of the published spec, as in Review below.
4. `to-tickets`: cut tickets from the published spec, including its quiz.

Pause only where the upstream skills pause, plus the choice of findings in Review.

## Domain doc

Before the interview, read the project's domain doc (`docs/agents/domain.md`)
when there is one. Write glossary terms and ADRs where it says, in the format of
the existing files. Without a domain doc the upstream defaults apply.

## Review

Dispatch one fresh subagent. Give it the published spec reference and the located
`scrutinize` skill. It reads the spec from the Tracker, edits nothing, and returns
its findings and verdict. Without subagents, run the review in this context and
say so.

Show every finding with its rationale and evidence. The person chooses which
findings to fix. Show the verdict and do not route on it: there is no round
budget, no automatic second review, and no return to an earlier stage. The person
may ask for another review.

Apply the chosen fixes to the published spec:

- Local Tracker: edit the spec file.
- Remote Tracker: replace the spec's body when the Tracker's tool can edit a
  body; otherwise add the corrections as a comment on the spec.

## Tickets

Pass the published spec reference to `to-tickets` as its source, so tickets are
cut from the corrected spec and each links to it.

## Handoff

Print the spec reference, the ticket references, and the next commands:

```text
/clear
/implement-tickets <spec reference>
```

Stop there. Do not implement.
