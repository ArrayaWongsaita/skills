# Writing a Part

You write one Part file of a course. A media-design step will later build slides and other media from this file alone, together with the course overview. That reader never sees the other Parts or the research notes. Everything the Part needs must be in the file.

## First, read

1. `references/part-template.md`: the exact structure, slot rules, citation and code rules.
2. `references/code-check.md`: how code examples and fixtures must look.

## Your inputs

The prompt gives you absolute paths to:
- `_work/scope.md`: learners, outcomes, delivery mode, output language
- `_work/outline.md`: your Part's sub-topics and position, the other Parts' titles, and the glossary
- `_work/research/parts/part-NN.md`: the deep notes for your Part
- the relevant broad notes: Teacher and Current state always, others as given
- `_work/code-check/env.json`, for technical topics
- the output path and today's date

## Write

- Follow `part-template.md` exactly: every section and every slot, in order.
- **Language:** write in the scope's output language, and keep established English technical terms. Use the glossary's wording for every term it defines.
- **Self-contained:** `Context` says what the learner already knows from earlier Parts, by name and substance. A bare "see Part 2" is not enough; restate the minimum the learner needs here.
- **Focused:** include only what serves this Part's objectives. Useful extras go to `Further reading`.
- **Sourced:** take facts only from the notes, and cite them inline with the notes' URLs. If the notes lack a source for something, leave it out. **Never invent a source, URL, number or API.**
- **Authored material:** write the analogies and explanations yourself, and mark analogies `(authored)`.
- **Outdated patterns** go under `Misconceptions`, with how to recognise them and the current replacement. They never appear in a worked example.

## Code (technical topics)

- Write each example to the conventions in `code-check.md`, with a snippet marker above it.
- When an example needs scripted model replies (tool calls, structured output, several turns), write its fixture to `_work/code-check/fixtures/<snippet-id>.json`.
- In self-paced courses, add the `**Expected output:**` block: a ```` ```text ```` block, shown exactly, for deterministic output; a ```` ```text illustrative ```` block for LLM-generated output.
- Outdated code shown under `Misconceptions` takes no snippet marker. It is never run.

## Frontmatter

- `code_status`: `"unverified"` when the Part has any snippet, `"none"` when it has none. The check rewrites it later.
- `versions`: the `resolved` map from `_work/code-check/env.json` for technical topics, otherwise `{}`.
- `generated`: today's date.

## Revision mode

Sometimes the prompt gives you a list of issues instead of a fresh Part. They come from the validator, the code check, or the consistency review.

- Fix exactly those issues. Leave everything else in the file as it is.
- For code failures, use the reason table in `code-check.md`, and rewrite the fixture when the snippet's model calls changed. For `expected output differs`, the prompt includes the actual output.
- Never add `status`, `reason` or `checked` attributes, or `> ⚠️ Unverified:` lines. The check writes those.

## When you finish

Reply in three to five lines with:
- the file path and the number of sub-topics
- the snippets and fixtures you wrote
- any slot that is thin because the notes had a gap
- `Skill problem: <what got in the way, and where>`, one line each, only when this brief, a script or a template got in your way
