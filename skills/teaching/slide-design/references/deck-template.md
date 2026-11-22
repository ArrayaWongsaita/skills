# The deck contract (`slide-design/deck@1`)

Three readers use this file:
- **The coordinator**, at Stages 1 and 4, to plan slides and read validator messages.
- **Every section writer**, at Stage 3, to write slides in the exact form.
- **The downstream skill** that builds the slides in Google Slides or React. It builds from the deck and the vocabulary file alone.

`scripts/contract.py` holds the same values as code. If the two ever disagree, the script wins; fix this file.

## Files

All paths are under `courses/<slug>/`:

| Path | What |
|---|---|
| `slides/visual-vocabulary.md` | the course's visual vocabulary (`slide-design/vocabulary@1`), shared by every deck |
| `slides/part-NN-<slug>.md` | one deck per Part, with the same file name as the Part |
| `slides/_work/part-NN/state.md` | run state, written by `deck_state.py` |
| `slides/_work/part-NN/storyboard.md` | the approved plan |
| `slides/_work/part-NN/diagrams.md` | every diagram of the deck, in full |
| `slides/_work/part-NN/new-concepts.json` | concepts this Part adds to the vocabulary |
| `slides/_work/part-NN/deck-notes.md` | the coordinator's notes for the builder |
| `slides/_work/part-NN/sections/<key>.md` | one draft per section: `opening`, `N.k`, `closing` |
| `slides/_work/part-NN/review.md` | the learner review |

The downstream skill reads only the deck and the vocabulary file. `_work/` is scratch for this skill.

## Frontmatter

One `key: value` per line. Every value is a JSON literal. Keys, in this order:

| Key | Value |
|---|---|
| `template` | `"slide-design/deck@1"` |
| `course` | the course slug |
| `part` | the Part number |
| `title` | the Part title, identical to the Part file |
| `source_file` | the Part file name |
| `source_generated` | the Part's `generated` date; a later Part date means the deck is stale |
| `language` | the slide text language, such as `"th"` |
| `vocabulary` | `"visual-vocabulary.md"` |
| `vocabulary_version` | the vocabulary's `version` when the deck was assembled |
| `slide_count` | the number of slides |
| `code_status` | copied from the Part |
| `generated` | the assembly date, `"YYYY-MM-DD"` |

## Body, in order

1. `# Part N: <title>`
2. `## Deck notes`: the learner profile, that the deck is read without narration, and Part gaps. Then two generated lists: `### Visuals to produce` (each illustration to generate and screenshot to capture, by slide id) and `### Code status` (each snippet that is not verified, with its reason).
3. One `##` section per deck section: `## Opening`, then `## N.k <sub-topic title>` for each sub-topic in Part order, then `## Closing`.
4. `## Diagrams`: one ```` ```diagram ```` JSON block per diagram.
5. `## Code listings`: one `### <snippet id>` per snippet the slides show. Each holds a ```` ```listing ```` JSON block `{"snippet", "status", "reason"}`, then the complete snippet, verbatim, in a fence of its language. A slide shows an excerpt; the learner needs the whole program to run it.

## A slide

````text
### <id> · <layout>

```slide
{"layout": "<layout>", "purpose": "<the one new thing>", "from": ["<Part ref>"], "sources": ["<url>"], …layout keys}
```

**Title:** <text>

**Body:** <text>

```visual
{…}
```
````

- **Id:** `<part>-<nnn>`, sequential in deck order from `001`. In drafts only, a split slide may carry a letter: `1-007a`. Assembly renumbers every id.
- **Slide block:** the first block of the slide, one line of JSON.
  - `layout`: equals the heading's layout
  - `purpose`: the single new thing the learner gains, at most 120 characters
  - `from`: Part refs this slide's content comes from: a Part section (`"Core mental model"`) or a sub-topic slot (`"1.2/Core knowledge"`). A sub-topic ref belongs only in that sub-topic's section.
  - `sources`: the URLs this slide's claims rely on, taken from the Part
  - layout keys: `code` takes `snippet`, `lines` and `highlight`; `output` takes `snippet`; `answer` takes `revisit`
- **Fields:** a line that starts with a bold label. The text runs to the next label, block or heading. Lists inside a field use `1. ` or `- `. The labels are fixed:
  `**Title:**`, `**Body:**`, `**Items:**`, `**Left:**`, `**Right:**`, `**Takeaway:**`, `**Question:**`, `**Answer:**`, `**Why:**`, `**Symptom:**`, `**Cause:**`, `**Fix:**`, `**Task:**`, `**Solution:**`, `**Notice:**`
- **Visual block:** at most one ```` ```visual ```` JSON block (see Visuals below).
- **Content blocks:** any other fenced block. A block right after `**Left:**` or `**Right:**` belongs to that panel. Any other block belongs to the slide.

## Layouts

A closed set. Lengths count visible characters: Thai vowel and tone marks, and emoji variation selectors, take no width.

| Layout | Use | Required fields | Optional fields | Visual | Content blocks |
|---|---|---|---|---|---|
| `cover` | Part opening | Title | Body | optional | none |
| `focus` (A) | one point or a hook; the title is a full sentence | Title, Body | | required | none |
| `explain` (B) | the default explanation | Title, Body | | required | none |
| `steps` (C) | a process or a structure with parts | Title, Items (2–6, numbered) | | required, a diagram whose visible badges are numbered 1…n | none |
| `compare` | old vs current, wrong vs right | Title, Left, Right, Takeaway | | none | optional, in each panel |
| `code` | one step of a code walkthrough | Title, Body | Notice | none | exactly one: the excerpt |
| `output` | what the learner should see | Title, Body | Notice | none | exactly one: the expected output |
| `error` | a common error | Title, Cause, Fix | Symptom | none | the error text, when the Part gives one |
| `objectives` | what the learner will be able to do | Title, Items | | optional | none |
| `setup` | prerequisites and setup | Title, Items | | optional | command blocks from the Part |
| `terms` | key terms | Title, Items (1–5) | | optional | none |
| `question` | a self-check question; Body says "think first, then go on" | Question, Body | Items (choices) | optional | none |
| `answer` | the self-check answer | Answer, Why | | optional | none |
| `practice` | practice | Title, Task | Items (hints), Solution (only when the Part gives one) | optional | none |
| `summary` | recap, back to the core mental model | Title, Items | | optional | none |
| `sources` | further reading and sources as links | Title, Items | | none | none |

Titles are at most 70 characters. A `Notice` is at most 150 and is required on `code` and `output` slides whose snippet is not verified. The other limits, per item for Items:

| Layout | Field | Limit |
|---|---|---|
| `cover` | Body | 120 |
| `focus` | Body | 160 |
| `explain` | Body | 420 |
| `steps` | Items | 80 |
| `compare` | Left | 200 |
| `compare` | Right | 200 |
| `compare` | Takeaway | 120 |
| `code` | Body | 300 |
| `output` | Body | 200 |
| `error` | Symptom | 150 |
| `error` | Cause | 150 |
| `error` | Fix | 150 |
| `objectives` | Items | 120 |
| `setup` | Items | 120 |
| `terms` | Items | 100 |
| `question` | Question | 200 |
| `question` | Body | 80 |
| `question` | Items | 80 |
| `answer` | Answer | 150 |
| `answer` | Why | 300 |
| `practice` | Task | 300 |
| `practice` | Items | 120 |
| `practice` | Solution | 300 |
| `summary` | Items | 100 |
| `sources` | Items | 200 |

### Code, output and other blocks

- **`code`:** `snippet` names a Part snippet. `lines` lists the shown ranges, `[[first, last], …]`, 1-based, ascending, not overlapping. `highlight` lists the emphasised ranges, inside the shown ones. The block holds exactly those lines of the snippet, joined in order, in the snippet's language.
- **`output`:** the block equals the Part's expected output, with the same info string (```` ```text illustrative ```` when the Part marks the output illustrative). The Body says so when it is illustrative.
- **`setup`, `error`, `compare` blocks:** text that appears verbatim in the Part. Nothing is invented.
- **Inline code** in any field appears verbatim in the Part.
- **`answer`:** `revisit` is the id of an earlier slide the learner can go back to.

## Visuals

`visual` blocks have a `kind`: `diagram`, `illustration` or `screenshot`. `references/visuals.md` says when to use which.

**`diagram`:** the slide's state of one diagram from `## Diagrams`.

```json
{"kind": "diagram", "diagram": "d-agent-loop", "show": ["n-user", "n-model", "e-ask"], "new": ["e-ask"], "highlight": ["n-model"], "dim": []}
```

- `show`: the elements visible on this slide. Every other element is hidden.
- `new`: exactly the elements this slide shows that the previous slide on the same diagram did not; on the first slide, all of `show`. The builder draws them emphasised, as a build step.
- `highlight`: elements shown before and emphasised here.
- `dim`: elements shown faded.
- `new`, `highlight` and `dim` are subsets of `show` and do not overlap.
- A shown edge needs both its ends shown, a badge or note its `near` element, and a group all its members.

**`illustration`:** `description` (slide language), `prompt` (English, ending with the vocabulary's illustration style), `alt`, `fallback`.

**`screenshot`:** `url` (from the Part), `capture` (what screen, in what state, what to highlight), `fallback`.

A **fallback** is either a diagram state without `new` (`{"kind": "diagram", "diagram": …, "show": …, "highlight": …, "dim": …}`) or `{"kind": "text", "text": "…"}`.

### Diagram definitions

```json
{"id": "d-agent-loop", "title": "วงรอบของ agent", "canvas": [12, 6],
 "nodes": [{"id": "n-model", "label": "Model", "concept": "model", "at": [5, 1], "size": [3, 1]}],
 "edges": [{"id": "e-call", "from": "n-model", "to": "n-tool", "label": "tool call", "style": "solid"}],
 "groups": [{"id": "g-agent", "label": "agent", "concept": "agent", "members": ["n-model", "n-tool"]}],
 "badges": [{"id": "b1", "n": 1, "near": "n-model"}],
 "notes": [{"id": "t-loop", "text": "วนจนได้คำตอบ", "near": "e-call"}]}
```

- `id` looks like `d-<name>`. Element ids are lowercase, unique across all element kinds.
- `canvas` is `[columns, rows]`, at most 24 × 14. A node sits at `at` `[column, row]` and covers `size` `[width, height]` cells, inside the canvas. Nodes never overlap.
- `concept` is a vocabulary concept id. It gives the node its shape and colour role.
- An edge goes between nodes or groups, never to itself. `style` is `solid` or `dashed`.
- Labels are at most 24 characters, note text at most 60.

## The vocabulary file (`slide-design/vocabulary@1`)

Frontmatter `template`, `course`, `version`, `updated`, then:
- `## Colour roles` and a ```` ```roles ```` JSON block: role → suggested hex
- `## Concepts` and a ```` ```concepts ```` JSON list: `{"id", "meaning", "shape", "role", "icon", "added_in"}`
- `## Illustration style` and a ```` ```style ```` JSON string: one English sentence

The file is append-only. `vocabulary.py add` adds concepts and bumps `version`; changing an existing concept is refused, because earlier decks use it.

## What the downstream skill must not do

- Read the Part. Everything it needs is in the deck and the vocabulary.
- Re-theme concept roles inconsistently. It may change the hex values, but one role keeps one colour across every deck.
- Merge build steps into one slide, or move elements between steps. Each slide is one step.
- Change slide text, code or output.

## Versioning

Renaming a heading, a field label or a JSON key, or changing what one means, is a breaking change: bump `deck@1` to `deck@2` in `contract.py` and here. Adding an optional key that builders may ignore is not.

## A filled example

A section draft, as a writer writes it to `sections/1.2.md`:

<!-- example:deck -->
````markdown
## 1.2 สร้าง agent ที่เรียก tool

### 1-015 · explain

```slide
{"layout": "explain", "purpose": "เห็นว่า create_agent ต่อ tool เข้ากับ model", "from": ["1.2/Core knowledge"], "sources": ["https://docs.langchain.com/oss/python/langchain/agents"]}
```

**Title:** `create_agent` ต่อ tool เข้ากับ model

**Body:** `create_agent` รับโมเดลและรายการ tool เมื่อโมเดลตัดสินใจว่าต้องใช้ tool ก็จะส่ง tool call ออกไป

```visual
{"kind": "diagram", "diagram": "d-agent-loop", "show": ["n-user", "n-model", "e-ask", "e-answer", "n-tool", "e-call"], "new": ["n-tool", "e-call"], "highlight": [], "dim": []}
```

### 1-017 · code

```slide
{"layout": "code", "purpose": "เห็นการประกาศ tool ด้วย @tool", "from": ["1.2/Worked example"], "sources": [], "snippet": "1.2-a", "lines": [[5, 8]], "highlight": [[5, 5]]}
```

**Title:** ขั้นที่ 1: ประกาศ tool

**Body:** ใส่ `@tool` บนฟังก์ชันธรรมดาให้กลายเป็น tool

```python
@tool
def get_weather(city: str) -> str:
    """Get the weather for a city."""
    return f"แดดออกที่ {city}"
```

### 1-023 · question

```slide
{"layout": "question", "purpose": "ทบทวนว่า agent เลือก tool อย่างไร", "from": ["1.2/Self-check"], "sources": []}
```

**Question:** agent รู้ได้อย่างไรว่าควรเรียก tool ไหน?

**Body:** ลองตอบในใจก่อน แล้วค่อยไปหน้าถัดไป

### 1-024 · answer

```slide
{"layout": "answer", "purpose": "ยืนยันคำตอบและโยงกลับไปที่โค้ดประกาศ tool", "from": ["1.2/Self-check"], "sources": [], "revisit": "1-017"}
```

**Answer:** จากชื่อและ docstring ของ tool

**Why:** ตอนประกาศด้วย `@tool` ชื่อฟังก์ชันและ docstring กลายเป็นคำอธิบายที่โมเดลอ่าน
````
<!-- /example:deck -->
