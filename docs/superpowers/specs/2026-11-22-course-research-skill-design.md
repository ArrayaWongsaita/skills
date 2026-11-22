# Design: `course-research` skill

- Date: 2026-11-22
- Status: Draft, awaiting approval
- Location of the skill: `skills/teaching/course-research/` (my call; follows this repo's earlier `skills/<category>/<name>/` layout)

## 1. Intent

The user makes learning media (slides first, other formats later). Before designing any media they need a deep, correct, well-ordered body of knowledge about the topic. This skill produces that body of knowledge:

1. It interviews the user about scope (topic, who the learners are, what they already know, what they must be able to do afterwards).
2. It researches the topic deeply on the web.
3. It organises what it found into **Parts**, each split into **sub-topics**, in an order that teaches well.
4. It writes **one self-contained research document per Part**, plus an overview.

A second skill, which the user will build later and separately, takes **one Part at a time**, designs it in detail, and turns it into media such as slides. That downstream skill is the main reader of this skill's output. It sees the overview and a single Part file, never the other Parts.

The first real use is **LangChain + LangGraph** for learners who must be able to **study on their own with no instructor**.

### What success looks like

- The downstream skill can design media for any Part from `00-overview.md` plus that one Part file, without researching again.
- A self-paced learner using media built from these files never gets stuck: setup steps are explicit, code runs, and they can check their own understanding.
- The user edits the outline and the Part files little before handing them on. Instructional Agents (arXiv 2508.19611) used faculty revision effort as its measure. This skill borrows that measure.

## 2. Goals, non-goals, anti-goals

### Goals

- A scope interview that ends in **measurable learning outcomes** ("after the course the learner can <verb> ...").
- Broad research from several perspectives, then an ordered outline built on a prerequisite map that is checked against real curricula.
- **One approval checkpoint on the outline** before the expensive deep research.
- Deep research per Part, then Part documents in a fixed template, every factual claim cited.
- Rules for technical topics: official sources first, version pinning, and outdated patterns flagged.
- Code examples verified by running them against fake LLM models, with no API keys and no spend.
- Work that can be resumed after an interruption, and a single Part that can be redone.

### Non-goals

- No slides, scripts, narration or any finished media.
- No detailed lesson or activity design. The Part file supplies raw material (cases, problems, examples), and the downstream skill designs the activities.
- Not a general research Q&A tool. `deep-research` already covers that.
- No real LLM calls during code verification (decided: fake models only).
- Building the downstream skill is out of scope. This skill only fixes the contract it will read.

### Anti-goals (failure even if everything "runs")

- Part files that read like an encyclopedia: content that serves no learning outcome.
- Deprecated or outdated APIs taught as current. For LangChain this is the biggest real risk.
- Uncited or invented facts, and code that does not run.
- A Part file that cannot be understood without reading other Parts.
- A self-paced learner stuck with no way forward because of a missing setup step, an unstated prerequisite, or no way to check themselves.
- A topic order that comes from LLM guesswork alone, with nothing to ground it.

## 3. Constraints

- **Runtime:** Claude Code with the Agent tool (subagents), WebSearch, and WebFetch or the `web-fetch` agent. If no subagent tool exists, run the same stages inline at reduced breadth and write the same files.
- **Cost:** Anthropic reports that multi-agent research uses about 15× the tokens of a chat. Research effort must scale with scope size (see §6.7), and the plan is shown to the user before the broad research starts.
- **Fast-moving libraries:** LangChain and LangGraph reached 1.0 on 2025-10-22. `create_react_agent` is deprecated in favour of `langchain.agents.create_agent`, and legacy code moved to `langchain-classic`. The newest versions confirmed during this design were langchain 1.3.0 and langgraph 1.2.0 (May 2026). The two packages must be pinned together; a known issue shows mismatched versions break `create_agent` imports.
- **Code verification** needs a local Python 3 interpreter. It creates an isolated environment per course. `GenericFakeChatModel` does not implement `bind_tools`, so tool-calling examples need a small subclass.
- **Language:** the skill talks to the user in the user's language (Thai for this user). The output language is a scope field, defaulting to the user's language. Established English technical terms stay in English. Sources may be in any language.
- **Repo conventions:** the directory name equals the frontmatter `name`. The skill is installed with `npx skills add ArrayaWongsaita/skills`.

## 4. Approaches considered

| # | Approach | Trade-off | Outcome |
|---|---|---|---|
| 1 | **One self-contained skill**: a coordinator `SKILL.md` plus its own prompt files for researcher, outliner, part-writer and code-checker, borrowing proven patterns from `deep-research` | Most to write. Full control over teaching-specific research prompts and the Part contract. Resumable through files on disk. | **Picked** |
| 2 | Thin wrapper that calls the existing `deep-research` skill for the research stage | Least to write, but `deep-research` imposes its own flow: it asks its own questions, allows one extra round, and writes one narrative report. Its output is not slot-shaped. It would have to run many times, and it is a synced skill that can change underneath us. | Rejected |
| 3 | Several small skills (scope / research+outline / part-writer) | Each piece is small and can be rerun, but the user has to chain them by hand, which goes against "one skill that starts by asking scope". Approach 1 gets rerunnability through resumable state. | Rejected |
| — | Single agent, no subagents | Cheapest, but a whole course overflows one context. Anthropic found multi-agent beat single-agent by 90.2% on breadth-heavy research. | Dropped (kept only as the no-subagent fallback) |

The user picked approach 1.

## 5. Research basis for the design

These findings shaped the workflow and the template. They came from the conversation's recon.

| Finding | Source | What it changes |
|---|---|---|
| Backward design: set outcomes and evidence before choosing content | Wiggins & McTighe, *Understanding by Design* | The interview ends in measurable outcomes. Every Part maps to at least one outcome. Content that serves no outcome goes to "Further reading". |
| Multi-perspective question asking before outlining gives better organisation and breadth than an outline-first RAG baseline | STORM (arXiv 2402.14207) | Broad research runs from several perspectives (§6.2), and the outline comes after it. |
| Iterative expand-and-reflect raises knowledge density | OmniThink (EMNLP 2025) | Researchers loop: find gaps, search, fetch, reflect. |
| LLM-only prerequisite extraction is inaccurate without grounding signals such as instructor ordering | InstructKG (arXiv 2602.17111); arXiv 2507.18479 | Prerequisite edges are checked against how existing curricula order the topic. Ambiguous or two-way edges are dropped. The user approves the outline. |
| Task-centred instruction in the cycle activation → demonstration → application → integration, with worked examples early | Merrill, First Principles of Instruction | A Part opens with a real task, carries worked examples, and supplies practice material. |
| Pre-training (know key terms first, supported in 13 of 16 tests) and segmenting (user-paced, bite-size chunks) | Mayer, multimedia learning principles | Each Part has a Key terms block, and sub-topics are kept bite-size. |
| Each subagent needs an objective, an output format, source guidance and boundaries. Effort-scaling rules belong in prompts. Shared-context work fits multi-agent badly. | Anthropic, multi-agent research system | Briefs are fixed-format, scaling rules are explicit, and a shared glossary goes to every writer. |
| Give the reader the smallest set of high-signal tokens | Anthropic, effective context engineering | The Part file is dense. Raw notes stay in `_work/`. |
| Slide pipelines work global view → logical-flow outline → section-grounded content | DocPres (INLG 2024), PPTAgent | The overview gives the global view, the Part file gives the flow, and each sub-topic is grounded with sources. |

## 6. The design (decided)

### 6.1 Stages

```
0. Start / resume      → pick the course folder; if one exists, read state and offer: continue / redo part(s) / change outline / restart
1. Scope interview     → _work/scope.md  ──► user confirms the scope summary
2. Broad research      → _work/research/broad/*.md   (perspectives in parallel)
3. Outline             → _work/outline.md + glossary  ──► USER APPROVES (hard gate)
4. Deep research       → _work/research/parts/part-NN.md   (one researcher per Part)
5. Write + verify      → 00-overview.md, part-NN-<slug>.md; code check; consistency check
6. Report              → summary in chat: where the files are, what failed verification, open gaps
```

There are two user touch-points. Stage 1 confirms the scope summary, which is cheap. Stage 3 approves the outline, which is the hard gate: no deep research runs before it. Everything else runs without stopping.

### 6.2 Stage 1: scope interview

The skill asks in the user's language, one question at a time, and skips anything the user already said. The scope form (`_work/scope.md`) has these fields:

- **Topic** and its boundaries (in / out)
- **Learners:** who they are, what they already know, and the prerequisites they are assumed to have
- **Learning outcomes:** numbered `O1..On`. Each is observable ("can build / explain / debug / compare ..."), never "understand".
- **Delivery mode:** self-paced, or with an instructor
- **Output language**
- **Size:** rough length or number of Parts, which feeds effort scaling
- **Technical topic?** If yes: language/runtime, target library versions (default: latest stable at research time), and the platform learners use
- **Constraints and must-includes / must-avoids**

The stage ends by playing the summary back for the user to correct.

### 6.3 Stage 2: broad research

Researchers run in parallel, each with one perspective:

| Perspective | Looks for |
|---|---|
| Beginner | Questions newcomers ask, where they start, the prerequisite knowledge they lack |
| Practitioner | What matters in real use, and real tasks and use cases (the source of task-centred openings) |
| Teacher | Misconceptions, sticking points, common errors |
| Existing curricula | How official tutorials, textbooks and good courses order this topic (the grounding for prerequisite order). Records each curriculum's date and the version it targets. |
| Current state (technical topics only) | Current stable versions, changelogs, migration guides, deprecations, and **how to recognise outdated code** |

Research rules, borrowed from `deep-research`'s researcher and extended:

- Each note file has the sections Takeaway / Cited findings / Inferences / Gaps. Every finding carries an inline `[Source](URL)`. Nothing is fabricated, and anything that cannot be sourced goes under Gaps.
- Primary sources over aggregators. Pages are fetched, not judged from snippets. Conflicting sources are noted.
- Technical topics: official docs, API reference, changelog and migration guides come first. Each version-specific fact records its version and date. Tutorials older than the current major version count as outdated. They are mined only for "how outdated code looks", never as instructions. For ordering they may still support version-independent concept dependencies (§6.4).

### 6.4 Stage 3: outline

1. List the concepts and skills the outcomes need.
2. Build prerequisite edges and tag each one with its evidence (my call, settled after the builder check):
   - **Strong:** current official docs state the dependency, or the current official tutorial / learning path teaches A before B. For technical topics, the current official learning path counts as a reference curriculum and is the primary one.
   - **Supporting:** another reference curriculum orders it that way. A curriculum older than the current major version supports only version-independent concept dependencies, such as "tool calling before agents". It never supports API-structural ordering, such as a chain-first sequence built around deprecated APIs.
   - **Inferred:** no source; the outliner's own reasoning.

   Drop two-way or ambiguous edges. Inferred edges are never dropped silently. The outline shows them flagged, so the user decides at the gate.
3. Group into Parts, order them along the prerequisite map, and map each Part to the outcomes it serves. Any outcome no Part serves is a defect.
4. Split each Part into bite-size sub-topics.
5. Draft the **glossary**: each term with its definition in the output language, English terms kept. It goes to every writer in Stage 5 so the Parts stay consistent.
6. Put leftovers that serve no outcome into "Further reading".

The user sees the Parts and sub-topics, the outcome mapping, and the evidence tag behind each ordering decision, with inferred edges flagged. They can edit, reorder, add or drop. The loop repeats until they approve. Changing the outline later sends it back through this gate, and only the affected Parts are rerun.

### 6.5 Stage 4: deep research per Part

Each Part gets one researcher, briefed with the Part's objectives, its sub-topics, the slots it must fill (§6.8), the version constraints, and the relevant broad notes. Notes go to `_work/research/parts/part-NN.md` in the same note format.

### 6.6 Stage 5: write and verify

- **Writing:** each Part gets one writer. Its inputs are the scope, the approved outline, the glossary, that Part's notes and the relevant broad notes. It writes `part-NN-<slug>.md` to the template. The overview is written once all Parts exist.
- **Code check (technical topics, Python in v1):**
  - Create an isolated environment in `_work/code-check/` and install the pinned versions from scope.
  - Run every code example as a standalone snippet. The harness swaps the real model for a fake from `langchain_core` (`GenericFakeChatModel` / `FakeListChatModel`; a subclass with `bind_tools` for tool-calling examples). The code shown to learners stays the code they will run with a real model.
  - Deprecation warnings count as failures.
  - When a snippet fails, the writer revises it against official docs, up to 2 attempts. If it still fails, the snippet is marked unverified in the Part file with the reason, and the final report lists it.
  - Snippets that cannot run without a real external service, and non-Python snippets, are marked unverified with the reason.
  - Output produced by a fake model is labelled as illustrative ("a real LLM's wording will differ"). Deterministic output (state, graph structure, non-LLM values) can be shown as exact.
- **Consistency check:**
  - Every Part maps to at least one outcome, and every outcome is covered.
  - Part N's "Bridge to Part N+1" matches Part N+1's prerequisites.
  - Glossary terms are used consistently.
  - No factual claim lacks a citation.
  - The required slots are filled (§6.8).

### 6.7 Effort scaling

The skill embeds explicit scaling rules, sized from the scope's size field. Broad research uses 4 perspectives, or 5 for technical topics. Deep research uses one researcher per Part, run in batches when the course is large. Writers follow the same pattern. Before Stage 2 the skill tells the user how many researchers will run. The exact numbers and batch size are left to the builder (§7).

### 6.8 Output layout and the Part contract

```
<cwd>/courses/<course-slug>/
├── 00-overview.md
├── part-01-<slug>.md
├── part-02-<slug>.md
├── ...
└── _work/                      ← resume state and audit trail; the downstream skill does not read it
    ├── state.md                ← current stage + per-Part status (researched / written / code-checked)
    ├── scope.md
    ├── outline.md
    ├── research/broad/<perspective>.md
    ├── research/parts/part-NN.md
    └── code-check/             ← environment, extracted snippets, run log
```

The `courses/` location is my call. The downstream skill reads `00-overview.md` plus one Part file.

**`00-overview.md`** contains:

- Title, research date, and versions referenced
- Scope: topic, learners, prerequisites, delivery mode, language
- Outcomes `O1..On`
- Part map: a table with columns #, title, outcomes served, prerequisite Parts, one-line summary
- The prerequisite map (Mermaid or text)
- The glossary
- A freshness note for technical topics
- Out-of-scope items and Further reading

**`part-NN-<slug>.md`** starts with YAML frontmatter:

```yaml
template: course-research/part@1
course: <course-slug>
part: N
title: <title>
outcomes: [O1, O3]
prerequisite_parts: [1, 2]
versions: {langchain: "1.3.0", langgraph: "1.2.0"}   # technical topics only
code_status: verified | partial | unverified | none
generated: 2026-11-22
```

The headings are fixed and in English, because they are stable keys for the downstream skill (my call). The content is in the output language.

```
# Part N: <title>
## Context            — who the learner is, what they know by now (from earlier Parts), delivery mode
## Objectives         — outcomes served + "after this Part the learner can <verb> ..."
## Prerequisites and setup
## Key terms          — pre-training: names + one-line meaning, before the sub-topics
## Core mental model  — the idea that must survive after details fade
## Real-world task    — the task or problem this Part enables (task-centred opening)
## Sub-topics
### N.1 <title>
  - Core knowledge
  - Worked example    — for technical topics: code + expected output + verification status
  - Analogy           — authored, marked as such
  - Misconceptions    — including how to recognise outdated patterns
  - Common errors and fixes
  - Self-check        — questions + answers + why
  - Sources
### N.2 ...
## Practice material  — raw cases and problems, not designed activities
## Bridge to Part N+1
## Further reading
## Sources
```

In **self-paced** mode, "Prerequisites and setup", "Common errors and fixes", "Self-check" and expected outputs are required. In instructor-led mode they are optional. Analogies and authored explanations need no citation. Facts, numbers, API behaviour and claims about practice always do.

Changing headings or frontmatter keys is a breaking change for the downstream skill, so the template carries a version (`part@1`).

### 6.9 Resume and redo

`_work/state.md` records the stage and the status of each Part. When the skill is invoked on an existing course folder, it offers:

- Continue from where the run stopped
- Redo one or more Parts: re-research, rewrite and re-check them, then re-check the bridges with the neighbouring Parts
- Change the outline, which returns to the Stage 3 gate
- Restart

## 7. Left to the builder

- The exact prompt wording for each role and the interview phrasing
- Whether the outline step runs in the coordinator or a subagent
- Researcher tool-call budgets, the effort-scaling numbers, and batch sizes
- How the code-check harness swaps the model (for example a setup block the harness replaces, or a fixture), as long as the code learners see is the code they would run
- The environment tool (`uv` if present, otherwise `venv`)
- Mermaid or a text list for the prerequisite map
- Subagent model choice
- The eval harness, and whether to add a human guide under `docs/skills/teaching/`

## 8. Acceptance checks for the first build

Run with the topic LangChain + LangGraph, self-paced learners, Thai output:

1. The skill asks scope questions first and ends with numbered, observable outcomes.
2. It stops at the outline and does not start deep research without approval.
3. Every Part file has the frontmatter and fixed headings, and can be understood alone.
4. No deprecated API (for example `create_react_agent` or `LLMChain`) appears as current practice. Where it appears, it is in Misconceptions, as outdated code to recognise.
5. Code examples run against the fake-model harness on the pinned versions. Failures are marked, not hidden.
6. Every factual claim carries a source, and the overview records versions and the research date.
7. Interrupting the run and invoking the skill again continues from `state.md`.
