# Part and overview template (`course-research/part@1`, `course-research/overview@1`)

This is the contract between this skill and the downstream skill that designs media from one Part at a time. Part writers follow it exactly. The downstream skill reads `00-overview.md` and **one** Part file, never the others, so every Part file must be understandable on its own.

Headings and frontmatter keys are fixed English keys; `scripts/contract.py` holds the canonical lists, and `scripts/validate_course.py` enforces them. Body text is in the scope's output language, keeping established English technical terms in English.

## Files

```
courses/<course-slug>/
├── 00-overview.md
├── part-01-<slug>.md      ← NN is two digits, 01..n with no gaps; slug is lowercase-kebab ASCII
├── part-02-<slug>.md
└── _work/                 ← run state, notes, code-check; the downstream skill does not read it
```

## Frontmatter rules

- The file starts with `---`, one `key: value` per line, then `---`.
- Every value is a JSON literal: strings in double quotes, numbers bare, lists `[...]`, maps `{...}`.
- Keys appear exactly as listed, in this order:

| Key | Value |
|---|---|
| `template` | `"course-research/part@1"` |
| `course` | the course slug from scope |
| `part` | the Part number as an integer, matching the filename |
| `title` | the Part title, identical to the H1 after `Part N: ` |
| `outcomes` | the scope outcome ids this Part serves, e.g. `["O1", "O3"]`; never empty |
| `prerequisite_parts` | earlier Part numbers the learner must finish first, e.g. `[1, 2]`; `[]` for none |
| `versions` | technical course: `{name: version}` from `_work/code-check/env.json` `resolved`; otherwise `{}` |
| `code_status` | `"unverified"` when the Part has code, `"none"` when it has none; `check_code.py` rewrites it after the check |
| `generated` | today's date, `"YYYY-MM-DD"` |

## Part skeleton

Angle-bracket text is guidance. Replace it.

<!-- skeleton:part -->
````markdown
---
template: "course-research/part@1"
course: "langchain-langgraph"
part: 1
title: "<Part title>"
outcomes: ["O1"]
prerequisite_parts: []
versions: {"langchain": "1.5.2", "langgraph": "1.2.24"}
code_status: "unverified"
generated: "2026-11-22"
---
# Part 1: <Part title>

## Context
<Who the learner is, what they already know at this point (name what earlier Parts taught), and the delivery mode.>

## Objectives
<For each outcome served: "O1: after this Part the learner can <observable verb> …". Never "understand".>

## Prerequisites and setup
<Exact knowledge and setup steps needed before starting: installs with pinned versions, accounts, API keys and where to get them.>

## Key terms
<Each new term with a one-line meaning, before the sub-topics use it. Use the glossary's wording.>

## Core mental model
<The one idea that must survive after the details fade, in two or three sentences.>

## Real-world task
<The concrete task or problem this Part lets the learner solve. It opens the Part.>

## Sub-topics

### 1.1 <Sub-topic title>

#### Core knowledge
<The explanation, cited inline.>

#### Worked example
<A worked case. For technical topics: a snippet marker, the code, and its Expected output block.>

#### Analogy
<An authored comparison marked "(authored)", or _None._>

#### Misconceptions
<What learners commonly get wrong, including outdated patterns and how to recognise them, cited; or _None._>

#### Common errors and fixes
<Error message or symptom → cause → fix.>

#### Self-check
<Questions with answers and why the answer is right.>

#### Sources
<Every URL this sub-topic relied on, as a list of [title](URL).>

## Practice material
<Raw cases, problems and data the media designer can build activities from. Not finished activities.>

## Bridge to next part
<What the next Part builds on from this one; for the last Part, where to go after the course.>

## Further reading
<Useful material outside the outcomes, with links; or _None._>

## Sources
<Every URL used anywhere in this Part.>
````
<!-- /skeleton:part -->

## Slot rules

- Every section and every sub-topic slot heading is always present, in the order above.
- Sub-topics are bite-sized, one idea each, numbered `N.1` to `N.m` with no gaps.
- When an optional slot is intentionally empty, write `_None._` alone. Never leave a slot blank.
- Always required, so `_None._` is not allowed: `Core knowledge`, `Worked example`, `Sources`.
- Also required in **self-paced** courses: `Common errors and fixes`, `Self-check`, and the section `Prerequisites and setup`. A learner studying alone has no one to ask, so these replace the instructor.
- `Analogy`, `Misconceptions`, `Further reading` may be `_None._`. Do not invent a weak analogy to fill the slot.

## Citations

- Facts, numbers, API behaviour, version-specific details and claims about practice carry an inline `[Source](URL)` right after the claim.
- Each sub-topic's `Sources` slot lists every URL that sub-topic used. The Part-level `## Sources` lists every URL in the Part.
- Analogies and explanations you wrote yourself need no citation. Mark analogies `(authored)`.
- No source, no claim. If research could not confirm it, leave it out.

## Outdated patterns

Self-paced learners will find old tutorials. Teach them to recognise old code under `Misconceptions`:

> Outdated: `from langgraph.prebuilt import create_react_agent` (before LangGraph 1.0). How to recognise it: imports from `langgraph.prebuilt`. Current: `from langchain.agents import create_agent` ([Source](https://docs.langchain.com/oss/python/migrate/langgraph-v1)).

Outdated code never appears in a `Worked example`.

## Code examples

Follow `references/code-check.md` for what the code must look like. In the Part file:

- Put a marker line directly above every code fence whose language is `python`, `py`, `javascript`, `js`, `typescript` or `ts`:
  `<!-- snippet id="1.2-a" -->`
  The id is `<part>.<sub-topic>-<letter>` and is unique in the course.
- A snippet that cannot run without a real external service gets a reason:
  `<!-- snippet id="1.2-b" skip="needs a running Postgres server" -->`
  A non-Python snippet always needs `skip`.
- In self-paced courses, after the closing fence write the line `**Expected output:**` and then a ```` ```text ```` block.
- Output that comes from an LLM call starts with `(illustrative — a real LLM's wording will differ)`. Deterministic output (state, graph structure, computed values) is shown exactly.
- Never write `status`, `reason` or `checked` attributes, or `> ⚠️ Unverified:` lines. `check_code.py` writes those.

## Overview skeleton

`## Freshness` is required for technical courses and may be omitted otherwise.

<!-- skeleton:overview -->
````markdown
---
template: "course-research/overview@1"
course: "langchain-langgraph"
title: "<Course title>"
research_date: "2026-11-22"
versions: {"langchain": "1.5.2", "langgraph": "1.2.24"}
---
# <Course title>

## Scope
<Topic and boundaries, learners and their prior knowledge, delivery mode, output language.>

## Learning outcomes
<Each outcome as "- **O1** <observable outcome>".>

## Part map
<Table: | # | Title | Outcomes | Prerequisite parts | Summary |, one row per Part, titles exactly as in the Part files.>

## Prerequisite map
<Which Part needs which, each edge with its evidence tag (Strong / Supporting / Inferred).>

## Glossary
<Table: | Term | Meaning | English term |. Writers use these exact terms.>

## Freshness
<Versions referenced, research date, and the one-line rule for spotting outdated material.>

## Out of scope and further reading
<What the course deliberately leaves out, with links where useful.>
````
<!-- /skeleton:overview -->

## Template version

`part@1` and `overview@1` are versions of a contract. Renaming a heading or a frontmatter key, or changing a slot rule, breaks the downstream skill: bump the version in `scripts/contract.py` and in this file together.
