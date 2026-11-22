# Scope interview (Stage 1)

The interview fills `_work/scope.md` so that no later stage has to ask the user again. Everything downstream (research perspectives, outline size, required slots, code checking) reads from it.

## How to ask

- Talk in the user's language.
- Ask **one question at a time**, and build each one on the previous answer.
- Skip anything the user already said in their request or an earlier answer.
- When a field has an obvious answer, propose it instead of asking ("I'll write this for self-paced learners, since you said there's no instructor"). The user can correct it at the playback.
- Ask the questions in this order, skipping the answered ones:
  1. the topic and its boundaries
  2. who the learners are and what they already know
  3. the outcomes
  4. the delivery mode
  5. the size
  6. constraints and must-include / must-avoid items

## Fields

| Key | How to fill it |
|---|---|
| `course` | Propose a lowercase-kebab ASCII slug from the topic, e.g. `langchain-langgraph`. It names the folder `courses/<course>/`. |
| `title` | Propose a course title in the output language. |
| `language` | Defaults to the user's language, as an ISO code (`"th"`, `"en"`). Ask only when it is unclear. |
| `delivery_mode` | `"self-paced"` (learners study alone) or `"instructor-led"`. Ask whether anyone will teach it. Self-paced turns on the required setup, self-check and common-errors slots. |
| `technical` | `true` for software and programming topics, otherwise `false`. Infer it and confirm it at playback. |
| `runtime` | `"python"` for Python topics, `"javascript"` or `"typescript"` for JS topics, `"none"` for non-technical topics. v1 checks only Python code; say so when the runtime is not Python. |
| `python` | `"3.12"` when the runtime is Python, otherwise `""`. |
| `packages` | Leave `[]` during the interview. Exact `==` pins are filled in after broad research (see `outline.md`). Ask only whether the user is bound to particular libraries or versions. |
| `size` | `"small"` (1–3 Parts), `"medium"` (4–8) or `"large"` (9+). The default is `"medium"`. Ask in the user's terms ("a short intro or a full course?"). |
| `outcomes` | The core of the scope: what learners can **do** after the course. See below. |

### Outcomes

- Ask: "When a learner finishes, what should they be able to do?"
- Turn each answer into an observable verb phrase: build, explain in their own words, debug, compare, choose, predict.
- "Understand X" and "know X" are not outcomes. Ask what the learner would do to show it, and write that down.
- Number them `O1..On`. Three to seven is typical. Each one later needs at least one Part.

## `_work/scope.md` layout

The frontmatter keys follow this exact order. The values are JSON literals.

```markdown
---
course: "langchain-langgraph"
title: "LangChain และ LangGraph สำหรับผู้เริ่มต้น"
language: "th"
delivery_mode: "self-paced"
technical: true
runtime: "python"
python: "3.12"
packages: []
size: "small"
outcomes: {"O1": "สร้าง agent ที่เรียกใช้ tool ได้", "O2": "สร้าง StateGraph ที่มี node และ edge ได้"}
---

## Learners
<Who they are, what they already know, the prerequisites they are assumed to have.>

## Boundaries
In: <what the course covers>. Out: <what it deliberately leaves out>.

## Must include / must avoid
<Anything the user insisted on, or ruled out.>

## Constraints
<Platform, versions, tools, time, anything else that limits the content.>
```

## Playback

End the stage by summarising the scope in the user's language, as a short list covering every field: topic, learners, outcomes, delivery mode, size, language, and the technical/runtime call. Ask what is wrong or missing. Apply the corrections, then show the summary again. Once the user confirms, the coordinator runs `course_state.py set-stage <course_dir> scope-confirmed`.
