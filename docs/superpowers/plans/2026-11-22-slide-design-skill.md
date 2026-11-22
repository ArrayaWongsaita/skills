# slide-design Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `slide-design` skill. It takes one `course-research` Part file at a time, plans a storyboard the user approves, has writers fill in each section, and produces a checked, tool-neutral deck design (`slide-design/deck@1`) plus a course-wide visual vocabulary. A later skill builds the deck in Google Slides or React from these files.

**Architecture:** A coordinator `SKILL.md` drives stages 0–6, with one gate (storyboard approval). It dispatches section writers and a learner-eye reviewer, whose briefs live in `references/*.md`. Deterministic work runs as stdlib Python scripts the coordinator calls:
- `deck_state.py`: resumable state that enforces the gate
- `vocabulary.py`: the append-only visual vocabulary
- `assemble_deck.py`: section drafts → deck
- `validate_deck.py`: structure, length, diagrams, coverage and fidelity

Shared parsing lives in small support modules. `contract.py` is the single source of truth for the deck contract.

**Tech Stack:** Markdown (Agent Skills `SKILL.md`), Python ≥3.11 stdlib, pytest through `uv`.

**Spec:** `docs/superpowers/specs/2026-11-22-slide-design-skill-design.md`. Read it first; this plan argues from it. The input contract is `skills/teaching/course-research/references/part-template.md`.

## Global Constraints

- Skill directory: `skills/teaching/slide-design/`. Frontmatter `name: slide-design` must equal the directory name.
- Every script uses the stdlib only and runs on the system `python3` (≥3.11). Each entry script inserts its own directory into `sys.path`, as `course-research`'s scripts do.
- **Self-contained:** nothing imports from or calls `skills/teaching/course-research/`. `frontmatter.py` is copied, not shared.
- Test command (every task): `uv run --no-project --python 3.12 --with pytest pytest skills/teaching/slide-design/tests -q`
- Input templates: only `course-research/part@1` and `course-research/overview@1`. Any other value is an error that names the expected id.
- Frontmatter in every file the skill reads or writes uses the JSON-literal subset: one `key: value` per line, and each value is JSON.
- Headings, frontmatter keys, field labels and JSON keys are fixed English (values in `contract.py`). Slide text is in the Part's language. Image prompts are English.
- Text length is `mdtext.visible_length`: code points minus Unicode categories `Mn`, `Me` and `Cf`.
- Repo documents, code and commit messages are in English. One commit per task, conventional style `feat(slide-design): …`, `docs(slide-design): …` or `test(slide-design): …`.
- Subagents are dispatched with `subagent_type="general-purpose"` and no `model`.

Plan decisions that refine the spec. Each is a gap the spec left open, decided here:

1. **Two more layouts, `objectives` and `setup`.** The spec's default opening order has objectives and setup slides, but its layout table has no layout for them. Both take Title + Items, with an optional visual. `setup` may hold command blocks, which must appear verbatim in the Part.
2. **Inline code must come from the Part.** Every inline code span in slide text, and every code block in a `setup`, `error` or `compare` slide, must appear verbatim somewhere in the Part body. This is how "no new code" becomes checkable.
3. **Sub-topic content stays in its section.** A `from` ref `N.k/<slot>` may only appear in section `N.k`. Part-level refs may appear anywhere.
4. **Shown elements must be closed.** A shown edge needs both its ends shown, a badge or note needs its `near` element shown, and a group needs all its members shown.
5. **Field and file details:**
   - A `Notice` field is required on `code` and `output` slides whose snippet is not `verified`.
   - Every URL in a slide's `sources` or text must appear in the Part.
6. **New files, support modules:** `contract.py`, `frontmatter.py`, `mdtext.py`, `part_reader.py`, `deck.py` and `diagram_checks.py`.
7. **New files, scripts and coordinator inputs:**
   - `vocabulary.py` enforces append-only mechanically.
   - The coordinator writes `_work/part-NN/deck-notes.md` and `_work/part-NN/new-concepts.json`.
8. **`deck_state.py init` refuses to overwrite** an existing state unless given `--force`. This avoids course-research's deferred M13.

## Review Focus

1. **Thai and emoji text in length limits.** Combining vowels, tone marks and emoji variation selectors must not count toward a limit: `"ที่นี่"` counts 2. Tests in Task 1 and Task 8.
2. **A writer splits a slide (`1-008a`).** Assembly must renumber every later slide and rewrite answer `revisit` pointers. Assembling twice gives identical output. Tests in Task 7.
3. **A snippet that is unverified or skipped.** Its status must be copied into the listing, and its slides must carry a `Notice`. It must not be silently treated as verified. Tests in Task 2, Task 7 and Task 8.
4. **A Part edited after its deck was made.** It must be reported as stale, not validated against the new Part as if nothing changed. Test in Task 8.
5. **A later Part's run tries to change an existing concept.** It must be refused, so earlier decks keep their look. Re-adding an identical concept must not bump the version. Tests in Task 4.

---

### Task 1: Contract, text utilities and test scaffold

**Files:**
- Create: `skills/teaching/slide-design/scripts/contract.py`
- Create: `skills/teaching/slide-design/scripts/frontmatter.py`: a verbatim copy of `skills/teaching/course-research/scripts/frontmatter.py`
- Create: `skills/teaching/slide-design/scripts/mdtext.py`
- Create: `skills/teaching/slide-design/tests/conftest.py`
- Create: `skills/teaching/slide-design/tests/fixtures/course/{00-overview.md, part-01-first-agent.md, part-02-graphs.md}`: verbatim copies from `skills/teaching/course-research/tests/fixtures/valid-course/`
- Test: `tests/test_frontmatter.py`: a copy of course-research's `test_frontmatter.py`
- Test: `tests/test_mdtext.py`

**Interfaces:**
- Produces, in `contract.py` (constants only, exact values):
  ```python
  PART_TEMPLATE_ID = "course-research/part@1"
  OVERVIEW_TEMPLATE_ID = "course-research/overview@1"
  DECK_TEMPLATE_ID = "slide-design/deck@1"
  VOCABULARY_TEMPLATE_ID = "slide-design/vocabulary@1"
  PART_FILE_RE = re.compile(r"^part-(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$")
  OVERVIEW_FILE = "00-overview.md"
  SLIDES_DIR = "slides"; VOCABULARY_FILE = "visual-vocabulary.md"; WORK_DIR = "_work"   # work dir: slides/_work/part-NN
  PART_SECTIONS = (...)       # same 11 names as course-research contract.PART_SECTIONS
  SUBTOPIC_SLOTS = (...)      # same 7 names as course-research contract.SUBTOPIC_SLOTS
  COVERED_SECTIONS = ("Objectives", "Prerequisites and setup", "Key terms", "Core mental model", "Real-world task", "Practice material", "Bridge to next part", "Further reading", "Sources")
  COVERED_SLOTS = ("Core knowledge", "Worked example", "Analogy", "Misconceptions", "Common errors and fixes", "Self-check")
  EMPTY_SLOT = "_None._"; EXPECTED_OUTPUT_LABEL = "**Expected output:**"; ILLUSTRATIVE_TAG = "illustrative"; UNVERIFIED_PREFIX = "> ⚠️ Unverified:"
  SNIPPET_MARKER_RE = re.compile(r"^<!-- snippet (?P<attrs>.+?) -->$"); ATTR_RE = re.compile(r'([a-z_]+)="([^"]*)"')
  SNIPPET_STATUSES = ("verified", "unverified", "skipped")
  DECK_FRONTMATTER_KEYS = ("template", "course", "part", "title", "source_file", "source_generated", "language", "vocabulary", "vocabulary_version", "slide_count", "code_status", "generated")
  VOCABULARY_FRONTMATTER_KEYS = ("template", "course", "version", "updated")
  NOTES_HEADING, DIAGRAMS_HEADING, LISTINGS_HEADING = "Deck notes", "Diagrams", "Code listings"
  OPENING, CLOSING = "Opening", "Closing"
  SLIDE_ID_RE = re.compile(r"^(?P<part>\d+)-(?P<n>\d{3})$")
  DRAFT_ID_RE = re.compile(r"^(?P<part>\d+)-(?P<n>\d{3})(?P<split>[a-z]?)$")
  SLIDE_HEADING_RE = re.compile(r"^### (?P<id>\S+) · (?P<layout>[a-z]+)\s*$")
  FIELD_RE = re.compile(r"^\*\*(?P<name>[A-Z][a-z]+):\*\*\s?(?P<rest>.*)$")
  FIELDS = ("Title", "Body", "Items", "Left", "Right", "Takeaway", "Question", "Answer", "Why", "Symptom", "Cause", "Fix", "Task", "Solution", "Notice")
  Layout = namedtuple("Layout", "required optional visual content")   # visual: required|optional|none; content: none|code|output|error|setup|panels
  LAYOUTS = {
      "cover": Layout(("Title",), ("Body",), "optional", "none"),
      "focus": Layout(("Title", "Body"), (), "required", "none"),
      "explain": Layout(("Title", "Body"), (), "required", "none"),
      "steps": Layout(("Title", "Items"), (), "required", "none"),
      "compare": Layout(("Title", "Left", "Right", "Takeaway"), (), "none", "panels"),
      "code": Layout(("Title", "Body"), ("Notice",), "none", "code"),
      "output": Layout(("Title", "Body"), ("Notice",), "none", "output"),
      "error": Layout(("Title", "Cause", "Fix"), ("Symptom",), "none", "error"),
      "objectives": Layout(("Title", "Items"), (), "optional", "none"),
      "setup": Layout(("Title", "Items"), (), "optional", "setup"),
      "terms": Layout(("Title", "Items"), (), "optional", "none"),
      "question": Layout(("Question", "Body"), ("Items",), "optional", "none"),
      "answer": Layout(("Answer", "Why"), (), "optional", "none"),
      "practice": Layout(("Title", "Task"), ("Items", "Solution"), "optional", "none"),
      "summary": Layout(("Title", "Items"), (), "optional", "none"),
      "sources": Layout(("Title", "Items"), (), "none", "none"),
  }
  META_KEYS = ("layout", "purpose", "from", "sources")
  LAYOUT_META_KEYS = {"code": ("snippet", "lines", "highlight"), "output": ("snippet",), "answer": ("revisit",)}
  ITEM_COUNTS = {"steps": (2, 6), "terms": (1, 5)}
  VISUAL_KINDS = ("diagram", "illustration", "screenshot"); FALLBACK_KINDS = ("diagram", "text")
  SHAPES = ("box", "rounded-box", "circle", "cylinder", "document", "person", "cloud")
  DEFAULT_ROLES = {"primary": "#1A73E8", "secondary": "#7B61FF", "accent": "#F29900", "success": "#188038", "warning": "#F9AB00", "danger": "#D93025", "neutral": "#5F6368"}
  EDGE_STYLES = ("solid", "dashed"); CANVAS_MAX = (24, 14)
  ELEMENT_ID_RE = re.compile(r"^[a-z][a-z0-9-]*$"); DIAGRAM_ID_RE = re.compile(r"^d-[a-z0-9]+(?:-[a-z0-9]+)*$")
  TITLE_LIMIT, PURPOSE_LIMIT, NOTICE_LIMIT, LABEL_LIMIT, NOTE_LIMIT = 70, 120, 150, 24, 60
  FIELD_LIMITS = {  # (layout, field) -> limit; for Items the limit applies to each item
      ("cover", "Body"): 120, ("focus", "Body"): 160, ("explain", "Body"): 420, ("steps", "Items"): 80,
      ("compare", "Left"): 200, ("compare", "Right"): 200, ("compare", "Takeaway"): 120,
      ("code", "Body"): 300, ("output", "Body"): 200,
      ("error", "Symptom"): 150, ("error", "Cause"): 150, ("error", "Fix"): 150,
      ("objectives", "Items"): 120, ("setup", "Items"): 120, ("terms", "Items"): 100,
      ("question", "Question"): 200, ("question", "Body"): 80, ("question", "Items"): 80,
      ("answer", "Answer"): 150, ("answer", "Why"): 300,
      ("practice", "Task"): 300, ("practice", "Items"): 120, ("practice", "Solution"): 300,
      ("summary", "Items"): 100, ("sources", "Items"): 200,
  }
  STAGES = ("storyboard", "storyboard-approved", "writing", "checking", "reviewing", "done")
  SECTION_STATUSES = ("pending", "written", "checked")
  ```
- Produces, in `mdtext.py`:
  - `Heading(level: int, text: str, line: int)` and `Block(lang: str, info: str, start: int, end: int)`: frozen dataclasses. `start` and `end` are the 0-based fence line indexes; `lang` is the first word of the info string, lowercased.
  - `Doc(lines, headings, blocks)`, with:
    - `block_text(block) -> str`: the lines between the fences, joined with `\n`
    - `block_at(line) -> Block | None`
    - `end_of(heading) -> int`: the index of the next heading with level ≤ its level, else `len(lines)`
  - `scan(text: str) -> Doc`: handles ```` ``` ```` and `~~~` fences; headings are only recognised outside fences.
  - `visible_length(text: str) -> int`
  - `inline_code(text: str) -> list[str]`, using `` `([^`\n]+)` ``
  - `urls(text: str) -> list[str]`, using `https?://[^\s<>()\[\]`"']+`
- Produces, in `conftest.py`:
  - it inserts `scripts/` into `sys.path`
  - fixtures `skill_dir -> Path`, `fixtures_dir -> Path`, and `course(tmp_path) -> Path`, which copytrees `tests/fixtures/course` into `tmp_path/"course"` and returns it
  - helper `edit(path: Path, old: str, new: str, first: bool = False) -> None`. By default it asserts `old` occurs exactly once and replaces it. With `first=True` it asserts at least one occurrence and replaces only the first, which is the slide copy, since listings come last.

- [ ] **Step 1: Write the failing tests** in `tests/test_mdtext.py` (and copy `test_frontmatter.py`):

```python
def test_scan_ignores_headings_inside_fences():
    doc = scan("# A\n```python\n# not a heading\n```\n## B\n")
    assert [(h.level, h.text) for h in doc.headings] == [(1, "A"), (2, "B")]

def test_block_info_and_text():
    doc = scan("x\n```text illustrative\nline 1\nline 2\n```\n")
    block = doc.blocks[0]
    assert (block.lang, block.info, doc.block_text(block)) == ("text", "text illustrative", "line 1\nline 2")

@pytest.mark.parametrize("text,count", [("ที่นี่", 2), ("แดดออก", 6), ("🌤️", 1), ("สวัสดี", 4), ("agent", 5)])
def test_visible_length_ignores_combining_marks(text, count):
    assert visible_length(text) == count

def test_inline_code_and_urls():
    text = "ใช้ `init_chat_model` ([Source](https://docs.langchain.com/oss/python/langchain/models))"
    assert inline_code(text) == ["init_chat_model"]
    assert urls(text) == ["https://docs.langchain.com/oss/python/langchain/models"]

def test_layout_table_is_consistent():
    for name, layout in LAYOUTS.items():
        assert set(layout.required) | set(layout.optional) <= set(FIELDS), name
        assert layout.visual in ("required", "optional", "none") and layout.content in ("none", "code", "output", "error", "setup", "panels")
    assert {layout for layout, _ in FIELD_LIMITS} <= set(LAYOUTS)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run --no-project --python 3.12 --with pytest pytest skills/teaching/slide-design/tests -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'mdtext'`. The copied frontmatter tests also fail until the copy of `frontmatter.py` exists.

- [ ] **Step 3: Implement `contract.py`, copy `frontmatter.py`, and implement `mdtext.py`**

`scan` follows course-research's `validate_course.scan`, but records the full info string as well.

- [ ] **Step 4: Run tests to verify they pass**

Run: the test command.
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add skills/teaching/slide-design
git commit -m "feat(slide-design): add contract, text utilities and test scaffold"
```

---

### Task 2: Part and overview reader

**Files:**
- Create: `skills/teaching/slide-design/scripts/part_reader.py`
- Test: `tests/test_part_reader.py`

**Interfaces:**
- Consumes: `contract` (template ids, sections, slots, marker regexes), `frontmatter.parse`, `mdtext.scan`, `mdtext.urls`
- Produces:
  ```python
  class PartError(ValueError): ...
  @dataclass(frozen=True)
  class Snippet:
      id: str; lang: str; code: str; status: str; reason: str; subtopic: str
      expected: str | None; expected_info: str   # info string of the Expected output fence, "" when none
  @dataclass(frozen=True)
  class SubTopic:
      key: str; title: str; slots: dict[str, str]  # key "1.2"; slot name -> raw text, stripped
  @dataclass(frozen=True)
  class Part:
      path: Path; meta: dict; number: int; title: str; body: str
      sections: dict[str, str]; subtopics: list[SubTopic]; snippets: dict[str, Snippet]; urls: frozenset[str]
      def section_keys(self) -> list[str]: ...         # ["opening", "1.1", ..., "closing"]
      def slot_refs(self) -> list[str]: ...            # coverable refs, in document order
      def ref_text(self, ref: str) -> str | None: ...  # "Objectives" or "1.2/Analogy" -> raw text; None if no such ref
  def find_part(course_dir: Path, number: int) -> Path    # exactly one part-NN-*.md, else PartError
  def read_part(path: Path) -> Part
  @dataclass(frozen=True)
  class Overview:
      meta: dict; title: str; glossary: list[tuple[str, str, str]]   # (term, meaning, English term)
  def read_overview(course_dir: Path) -> Overview
  ```
- Rules:
  - **Snippet status:** a `skip` attribute gives `skipped`, with the reason set to the skip text. Otherwise the `status` attribute is used. With neither, the status is `unverified` with reason `not checked`.
  - **Expected output:** after the closing fence, skip blank lines and one `> ⚠️ Unverified:` line, then expect the label, then the next fence.
  - **Coverable refs:** the `COVERED_SECTIONS` that are not `_None._`, plus `N.k/<slot>` for the `COVERED_SLOTS` that are not `_None._`. Sub-topic refs go at the position of `## Sub-topics`.

- [ ] **Step 1: Write the failing tests**

```python
def test_reads_fixture_part(course):
    part = read_part(find_part(course, 1))
    assert (part.number, part.title) == (1, "Agent ตัวแรกด้วย create_agent")
    assert part.section_keys() == ["opening", "1.1", "1.2", "closing"]

def test_slot_refs_skip_empty_slots(course):
    assert read_part(find_part(course, 1)).slot_refs() == [
        "Objectives", "Prerequisites and setup", "Key terms", "Core mental model", "Real-world task",
        "1.1/Core knowledge", "1.1/Worked example", "1.1/Misconceptions", "1.1/Common errors and fixes", "1.1/Self-check",
        "1.2/Core knowledge", "1.2/Worked example", "1.2/Analogy", "1.2/Misconceptions", "1.2/Common errors and fixes", "1.2/Self-check",
        "Practice material", "Bridge to next part", "Further reading", "Sources"]

def test_snippet_code_status_and_expected_output(course):
    snippet = read_part(find_part(course, 1)).snippets["1.1-a"]
    assert snippet.code.splitlines()[0] == "from langchain.chat_models import init_chat_model"
    assert len(snippet.code.splitlines()) == 5
    assert (snippet.lang, snippet.status, snippet.subtopic, snippet.expected_info) == ("python", "verified", "1.1", "text illustrative")
    assert snippet.expected.startswith("(ตัวอย่าง")

@pytest.mark.parametrize("marker,status,reason", [
    ('<!-- snippet id="1.1-a" status="unverified" reason="boom" -->', "unverified", "boom"),
    ('<!-- snippet id="1.1-a" skip="needs a key" -->', "skipped", "needs a key"),
    ('<!-- snippet id="1.1-a" -->', "unverified", "not checked"),
])
def test_snippet_status_mapping(course, marker, status, reason):
    path = find_part(course, 1)
    edit(path, '<!-- snippet id="1.1-a" status="verified" checked="2026-11-22" -->', marker)
    snippet = read_part(path).snippets["1.1-a"]
    assert (snippet.status, snippet.reason) == (status, reason)

def test_ref_text_and_urls(course):
    part = read_part(find_part(course, 1))
    assert part.ref_text("1.2/Analogy").startswith("เหมือนพนักงาน")
    assert part.ref_text("1.1/Analogy") == "_None._" and part.ref_text("9.9/Analogy") is None
    assert "https://docs.langchain.com/oss/python/langchain/models" in part.urls

def test_rejects_other_template(course):
    path = find_part(course, 1)
    edit(path, '"course-research/part@1"', '"course-research/part@2"')
    with pytest.raises(PartError, match="course-research/part@1"):
        read_part(path)

def test_find_part_missing(course):
    with pytest.raises(PartError, match="part 3"):
        find_part(course, 3)

def test_read_overview(course):
    overview = read_overview(course)
    assert overview.title == "LangChain และ LangGraph สำหรับผู้เริ่มต้น"
    assert overview.glossary == [("เอเจนต์", "โมเดลที่ตัดสินใจเรียก tool เองเป็นวงรอบ", "Agent")]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: the test command.
Expected: FAIL with `ModuleNotFoundError: No module named 'part_reader'`.

- [ ] **Step 3: Implement `part_reader.py`** with the interfaces and rules above.

- [ ] **Step 4: Run tests to verify they pass**

Run: the test command.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/teaching/slide-design
git commit -m "feat(slide-design): read course-research Part and overview files"
```

---

### Task 3: Run state (`deck_state.py`)

**Files:**
- Create: `skills/teaching/slide-design/scripts/deck_state.py`
- Test: `tests/test_deck_state.py`

**Interfaces:**
- Consumes: `contract.STAGES`, `contract.SECTION_STATUSES`, `part_reader.find_part`, `part_reader.read_part`, `frontmatter`
- Produces:
  - `state_path(course_dir: Path, part: int) -> Path`, which is `<course_dir>/slides/_work/part-NN/state.md`
  - `StateError(ValueError)`
  - `new_state(sections: list[str], language: str) -> dict`, with keys `stage`, `sections` (an ordered dict of key → status), `language` and `updated`
  - `load_state(course_dir, part) -> dict` and `save_state(course_dir, part, state)`. The file holds frontmatter plus a regenerated table of sections and statuses.
  - `transition(state, stage) -> dict`
  - `set_section(state, key, status) -> dict`
  - `reset_sections(state, keys: list[str]) -> dict`
  - `next_action(state) -> str`
  - CLI:
    ```
    deck_state.py init <course_dir> <part> --language <code> [--force]
    deck_state.py show <course_dir> <part>                      # JSON: stage, sections, language, next_action
    deck_state.py set-stage <course_dir> <part> <stage>
    deck_state.py set-section <course_dir> <part> <key> <status>
    deck_state.py reset-sections <course_dir> <part> (<key> ... | --all)
    ```
    Exit 1 with `error: …` on stderr on any `StateError` or `PartError`.
- Rules:
  - **Forward moves:** only one stage at a time.
    - Entering `checking` needs every section at `written` or later.
    - Entering `done` needs every section `checked`.
  - **Backward and redo moves:**
    - Moving back to `storyboard` is allowed from any later stage. It keeps the statuses.
    - Moving to `writing` from `checking`, `reviewing` or `done` is allowed only when some section is `pending`.
    - Every other move is an error.
  - **Section statuses:**
    - `written` is allowed only at stage `writing`, and only from `pending`.
    - `checked` is allowed only at stage `reviewing`, and only from `written`.
  - **`next_action` exact strings:**

    | Stage | `next_action` |
    |---|---|
    | `storyboard` | `"plan the storyboard and diagrams, run validate_deck.py --diagrams, and present them at the gate"` |
    | `storyboard-approved` | `"add the new concepts to the vocabulary, then move to stage writing"` |
    | `writing`, sections pending | `"write sections <k1>, <k2>"` |
    | `writing`, none pending | `"move to stage checking"` |
    | `checking` | `"assemble the deck and run validate_deck.py until it exits 0, then move to stage reviewing"` |
    | `reviewing`, sections not checked | `"review the deck, then mark sections <k…> checked"` |
    | `reviewing`, all checked | `"move to stage done"` |
    | `done` | `"nothing left; report to the user"` |

- [ ] **Step 1: Write the failing tests**

```python
def test_init_reads_sections_from_the_part(course):
    state_path(course, 1).unlink(missing_ok=True)   # Task 7 adds a fixture state
    run_cli("init", course, "1", "--language", "th")
    shown = json.loads(run_cli("show", course, "1").stdout)
    assert shown["stage"] == "storyboard" and shown["language"] == "th"
    assert shown["sections"] == {"opening": "pending", "1.1": "pending", "1.2": "pending", "closing": "pending"}

def test_init_refuses_existing_state(course):
    state_path(course, 1).unlink(missing_ok=True)
    run_cli("init", course, "1", "--language", "th")
    result = run_cli("init", course, "1", "--language", "th", check=False)
    assert result.returncode == 1 and "state exists" in result.stderr
    assert run_cli("init", course, "1", "--language", "en", "--force").returncode == 0

def test_gate_cannot_be_skipped():
    with pytest.raises(StateError, match="cannot move from storyboard to writing"):
        transition(new_state(["opening"], "th"), "writing")

def test_checking_needs_every_section_written():
    state = walk(new_state(["opening", "1.1"], "th"), "storyboard-approved", "writing")
    state = set_section(state, "opening", "written")
    with pytest.raises(StateError, match="1.1"):
        transition(state, "checking")

def test_status_moves_only_at_their_stage():
    state = walk(new_state(["opening"], "th"), "storyboard-approved", "writing")
    with pytest.raises(StateError):
        set_section(state, "opening", "checked")
    state = walk(set_section(state, "opening", "written"), "checking", "reviewing")
    assert set_section(state, "opening", "checked")["sections"]["opening"] == "checked"

def test_redo_a_section_and_back_to_storyboard():
    state = done_state(["opening", "1.1"])          # helper: walks to done with all sections checked
    with pytest.raises(StateError, match="pending"):
        transition(state, "writing")
    redo = transition(reset_sections(state, ["1.1"]), "writing")
    assert redo["sections"] == {"opening": "checked", "1.1": "pending"}
    assert transition(state, "storyboard")["sections"] == state["sections"]

def test_next_action_lists_pending_sections():
    state = walk(new_state(["opening", "1.1", "closing"], "th"), "storyboard-approved", "writing")
    assert next_action(set_section(state, "opening", "written")) == "write sections 1.1, closing"
```

`walk`, `done_state` and `run_cli` (a subprocess call of the script with `sys.executable`) are test helpers in this file.

- [ ] **Step 2: Run tests to verify they fail**

Run: the test command.
Expected: FAIL with `ModuleNotFoundError: No module named 'deck_state'`.

- [ ] **Step 3: Implement `deck_state.py`** with the interfaces and rules above, modelled on course-research's `course_state.py`.

- [ ] **Step 4: Run tests to verify they pass**

Run: the test command.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/teaching/slide-design
git commit -m "feat(slide-design): add resumable run state with the storyboard gate"
```

---

### Task 4: Visual vocabulary (`vocabulary.py`)

**Files:**
- Create: `skills/teaching/slide-design/scripts/vocabulary.py`
- Create: `tests/fixtures/course/slides/visual-vocabulary.md`: a fixture written by `save()`, with the content below
- Test: `tests/test_vocabulary.py`

**Interfaces:**
- Consumes: `contract` (`VOCABULARY_TEMPLATE_ID`, `SHAPES`, `DEFAULT_ROLES`, `ELEMENT_ID_RE`), `frontmatter`, `mdtext.scan`
- Produces:
  ```python
  class VocabularyError(ValueError): ...
  @dataclass
  class Vocabulary:
      course: str; version: int; updated: str; roles: dict[str, str]; concepts: dict[str, dict]; style: str
  def vocabulary_path(course_dir: Path) -> Path   # <course_dir>/slides/visual-vocabulary.md
  def load(course_dir: Path) -> Vocabulary          # VocabularyError when missing or malformed
  def save(course_dir: Path, vocab: Vocabulary) -> None
  def init_vocabulary(course: str, style: str) -> Vocabulary        # version 0, DEFAULT_ROLES, no concepts
  def add_concepts(vocab: Vocabulary, new: list[dict], part: int) -> Vocabulary
  ```
  CLI:
  ```
  vocabulary.py init <course_dir> --course <slug> --style "<sentence>"   # refuses when the file exists
  vocabulary.py add  <course_dir> <concepts.json> --part <N>
  vocabulary.py show <course_dir>                                       # JSON
  ```
- **File layout** (`save` writes it, `load` reads it):
  - Frontmatter `template`, `course`, `version`, `updated`.
  - `# Visual vocabulary`
  - `## Colour roles` + a ```` ```roles ```` JSON block holding a role → hex map
  - `## Concepts` + a ```` ```concepts ```` JSON block holding a list, one concept object per line
  - `## Illustration style` + a ```` ```style ```` JSON block holding a single string
  - Thai text is written unescaped (`ensure_ascii=False`).
- **Concept object:** `{"id", "meaning", "shape", "role", "icon", "added_in"}`. `icon` may be `""`. `add_concepts` sets `added_in`.
- **`add_concepts` rules:**
  - It validates the id regex, `shape ∈ SHAPES` and `role ∈ roles`.
  - An existing id with an identical `meaning`, `shape`, `role` and `icon` is skipped.
  - An existing id with any difference raises `VocabularyError`, with a message containing `append-only`.
  - `version` goes up by 1 only when at least one concept was added, and `updated` is set to today.
- **Fixture content:**
  - `course` `"langchain-langgraph"`, `version` 1
  - style `"Flat vector illustration, soft colours, simple shapes, plain white background, no text."`
  - concepts, all `added_in` 1, with icon `""`:

    | id | shape | role |
    |---|---|---|
    | `user` | person | neutral |
    | `model` | rounded-box | primary |
    | `tool` | box | accent |
    | `agent` | box | primary |
    | `function` | box | secondary |
    | `value` | document | neutral |

  - meanings in Thai, one line each

- [ ] **Step 1: Write the failing tests**

```python
CONCEPT = {"id": "graph", "meaning": "กราฟของ node", "shape": "box", "role": "secondary", "icon": ""}

def test_fixture_loads(course):
    vocab = load(course)
    assert vocab.version == 1 and set(vocab.concepts) == {"user", "model", "tool", "agent", "function", "value"}
    assert vocab.style.endswith("no text.")

def test_add_appends_and_bumps_version(course):
    vocab = add_concepts(load(course), [CONCEPT], part=2)
    assert vocab.version == 2 and vocab.concepts["graph"]["added_in"] == 2
    save(course, vocab)
    assert load(course).concepts["graph"]["meaning"] == "กราฟของ node"

def test_identical_concept_is_skipped_without_bump(course):
    same = {k: v for k, v in load(course).concepts["model"].items() if k != "added_in"}
    assert add_concepts(load(course), [same], part=2).version == 1

def test_changing_a_concept_is_refused(course):
    changed = {**load(course).concepts["model"], "role": "accent"}
    with pytest.raises(VocabularyError, match="append-only"):
        add_concepts(load(course), [changed], part=2)

@pytest.mark.parametrize("bad", [{**CONCEPT, "shape": "hexagon"}, {**CONCEPT, "role": "pink"}, {**CONCEPT, "id": "Graph"}])
def test_invalid_concepts_are_refused(course, bad):
    with pytest.raises(VocabularyError):
        add_concepts(load(course), [bad], part=2)

def test_cli_init_refuses_existing_file(course):
    result = run_cli("init", course, "--course", "x", "--style", "s", check=False)
    assert result.returncode == 1 and "exists" in result.stderr
```

- [ ] **Step 2: Run tests to verify they fail**

Run: the test command.
Expected: FAIL with `ModuleNotFoundError: No module named 'vocabulary'`.

- [ ] **Step 3: Implement `vocabulary.py`, then write the fixture** by calling `save()` once from a throwaway snippet, so the fixture matches the writer exactly.

- [ ] **Step 4: Run tests to verify they pass**

Run: the test command.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/teaching/slide-design
git commit -m "feat(slide-design): add the append-only visual vocabulary"
```

---

### Task 5: Deck parser (`deck.py`)

**Files:**
- Create: `skills/teaching/slide-design/scripts/deck.py`
- Test: `tests/test_deck.py`

**Interfaces:**
- Consumes: `contract` (heading, field and id regexes, section headings), `frontmatter`, `mdtext.scan`
- Produces:
  ```python
  @dataclass
  class CodeBlock: lang: str; info: str; text: str; line: int          # line: 1-based line of the opening fence
  @dataclass
  class Field: name: str; text: str; items: list[str]; blocks: list[CodeBlock]; line: int
  @dataclass
  class Slide:
      id: str; layout: str; line: int; section: str
      meta: dict; fields: dict[str, Field]; visual: dict | None; blocks: list[CodeBlock]
  @dataclass
  class Section: heading: str; key: str | None; line: int; slides: list[Slide]
  @dataclass
  class Listing: snippet: str; meta: dict; code: CodeBlock | None; line: int
  @dataclass
  class Deck:
      meta: dict; title: str; notes: str; sections: list[Section]
      diagrams: dict[str, dict]; diagram_blocks: list[str]          # raw text of each diagram block, in order
      listings: dict[str, Listing]; headings: list[str]             # every ## heading, in order
      errors: list[tuple[int, str]]                                 # (1-based line, message)
      def slides(self) -> list[Slide]: ...
  def section_key(heading: str) -> str | None        # "Opening"->"opening", "Closing"->"closing", "1.2 …"->"1.2", else None
  def parse_sections(text: str, first_line: int = 1) -> tuple[list[Section], list[tuple[int, str]]]
  def parse_diagrams(text: str, first_line: int = 1) -> tuple[dict[str, dict], list[str], list[tuple[int, str]]]
  def parse_deck(text: str) -> Deck
  def meta_block(meta: dict) -> str                  # "```slide\n" + one-line json.dumps(ensure_ascii=False) + "\n```"
  ```
- **Slide grammar** (`deck-template.md` in Task 9 documents the same thing):
  - A slide starts at `### <id> · <layout>`. Its first fenced block must be ```` ```slide ```` holding a JSON object.
  - **Fields:**
    - A field starts at a `FIELD_RE` line. Its text is the rest of that line plus the following lines, up to the next field line, fence or heading. The text is stripped, and blank lines inside it are kept.
    - `items` are the field's lines that start with `1. ` (any number) or `- `, without the marker.
  - **Fenced blocks:**
    - ```` ```visual ```` is the visual JSON; there is at most one.
    - Any other block belongs to the current field when that field is `Left` or `Right`. Otherwise it goes in `Slide.blocks`.
  - **Parse errors**, each recorded with a line number rather than raised:
    - an unknown field label
    - a repeated field
    - a missing or invalid `slide` block
    - an invalid `visual` JSON
    - text outside any field
- **Deck grammar:**
  - frontmatter
  - `# Part N: <title>`
  - `## Deck notes`, whose text is the notes
  - one `##` section per deck section; slides are parsed only in sections whose `section_key` is not `None`
  - `## Diagrams` holding ```` ```diagram ```` JSON blocks
  - `## Code listings` holding `### <snippet-id>` blocks, each a ```` ```listing ```` JSON block followed by one code fence

- [ ] **Step 1: Write the failing tests**

````python
SLIDE = '''## 1.1 เรียกโมเดล

### 1-007 · explain

```slide
{"layout": "explain", "purpose": "รู้ว่า init_chat_model ทำอะไร", "from": ["1.1/Core knowledge"], "sources": []}
```

**Title:** สร้างโมเดลจากชื่อ

**Body:** ย่อหน้าแรก

ย่อหน้าที่สอง

```visual
{"kind": "diagram", "diagram": "d-init", "show": ["n-name"], "new": ["n-name"], "highlight": [], "dim": []}
```
'''

def test_parse_slide_fields_and_visual():
    sections, errors = parse_sections(SLIDE)
    slide = sections[0].slides[0]
    assert errors == [] and sections[0].key == "1.1"
    assert (slide.id, slide.layout, slide.section) == ("1-007", "explain", "1.1")
    assert slide.fields["Body"].text == "ย่อหน้าแรก\n\nย่อหน้าที่สอง"
    assert slide.visual["diagram"] == "d-init" and slide.meta["from"] == ["1.1/Core knowledge"]

def test_items_and_panels():
    text = ("## Opening\n\n### 1-001 · compare\n\n```slide\n{\"layout\": \"compare\"}\n```\n\n"
            "**Left:** บทความเก่า\n\n```python\nold()\n```\n\n**Right:** ปัจจุบัน\n\n**Takeaway:** ใช้แบบใหม่\n\n"
            "**Items:**\n1. หนึ่ง\n2. สอง\n- [doc](https://x.y)\n")
    slide = parse_sections(text)[0][0].slides[0]
    assert slide.fields["Left"].blocks[0].text == "old()" and slide.blocks == []
    assert slide.fields["Items"].items == ["หนึ่ง", "สอง", "[doc](https://x.y)"]

@pytest.mark.parametrize("bad,message", [
    ("```slide\n{not json}\n```", "slide block is not valid JSON"),
    ("**Title:** a\n\n**Title:** b", "repeated field Title"),
    ("```slide\n{}\n```\n\n**Colour:** x", "unknown field Colour"),
    ("**Title:** no slide block", "missing slide block"),
])
def test_parse_errors_carry_line_numbers(bad, message):
    _, errors = parse_sections("## Opening\n\n### 1-001 · cover\n\n" + bad + "\n")
    assert any(message in text and line > 0 for line, text in errors)

def test_section_key():
    assert [section_key(h) for h in ("Opening", "1.2 สร้าง agent", "Closing", "Diagrams")] == ["opening", "1.2", "closing", None]

def test_meta_block_is_one_line_unescaped():
    assert meta_block({"layout": "cover", "purpose": "เปิด"}) == '```slide\n{"layout": "cover", "purpose": "เปิด"}\n```'
````

- [ ] **Step 2: Run tests to verify they fail**

Run: the test command.
Expected: FAIL with `ModuleNotFoundError: No module named 'deck'`.

- [ ] **Step 3: Implement `deck.py`** with the interfaces and grammar above. `parse_deck` uses `parse_sections` and `parse_diagrams` on the matching `##` regions, passing the right `first_line`.

- [ ] **Step 4: Run tests to verify they pass**

Run: the test command.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/teaching/slide-design
git commit -m "feat(slide-design): parse deck, section draft and diagram files"
```

---

### Task 6: Diagram checks (`diagram_checks.py`)

**Files:**
- Create: `skills/teaching/slide-design/scripts/diagram_checks.py`
- Create: `tests/fixtures/course/slides/_work/part-01/diagrams.md` (`# Diagrams` + the two blocks below) and `tests/fixtures/course/slides/_work/part-01/new-concepts.json` (`[]`)
- Test: `tests/test_diagram_checks.py`

**Interfaces:**
- Consumes: `contract` (`SHAPES`, `EDGE_STYLES`, `CANVAS_MAX`, id regexes, `LABEL_LIMIT`, `NOTE_LIMIT`, `TITLE_LIMIT`), `mdtext.visible_length`, `deck.Slide`, `deck.parse_diagrams`
- Produces:
  ```python
  def element_kinds(diagram: dict) -> dict[str, str]                 # element id -> "node" | "edge" | "group" | "badge" | "note"
  def check_diagram(diagram: dict, concepts: set[str]) -> list[str]  # list of messages, empty when valid
  def check_states(slides: list[Slide], diagrams: dict[str, dict]) -> list[tuple[str, str]]   # (slide id, message)
  ```
- **`check_diagram` rules, with message fragments:**
  - Ids:
    - the id must match `DIAGRAM_ID_RE`
    - element ids must match `ELEMENT_ID_RE` and be unique across all kinds: `duplicate element id <id>`
  - Canvas and positions:
    - canvas `[cols, rows]` must be ints from 1 up to `CANVAS_MAX`
    - each node has int `at [c, r] ≥ 0` and `size [w, h] ≥ 1`, with `c+w ≤ cols` and `r+h ≤ rows`: `node <id> is outside the canvas`
    - node rectangles must not intersect; touching edges are fine: `nodes overlap: <a>, <b>`
  - Concepts:
    - every node concept, and every group concept that is given, must be known: `unknown concept '<c>'`
  - References:
    - edge `from`/`to` must be a node or group: `edge <id>: unknown node '<x>'`
    - edges may not form self-loops
    - edge `style ∈ EDGE_STYLES`
    - group `members` must be nodes, at least 1
    - badge `n` must be unique positive ints; badge and note `near` must be a node, edge or group
  - Text: labels ≤ `LABEL_LIMIT`, note text ≤ `NOTE_LIMIT`, title ≤ `TITLE_LIMIT`: `label too long: <id>`
- **`check_states` rules**, for every slide whose `visual.kind == "diagram"`, and for every `fallback` of kind `diagram`:
  - References and sets:
    - the diagram must exist: `unknown diagram '<id>'`
    - every id in `show`, `new`, `highlight` and `dim` must exist
    - `new`, `highlight` and `dim` are subsets of `show`: `<key> is not a subset of show`
    - `new`, `highlight` and `dim` are pairwise disjoint: `highlight and dim overlap`
  - Closure: `edge <e> shown without <n>`, `badge <b> shown without <x>`, `group <g> shown without <n>`.
  - **New rule** (main visuals only, not fallbacks). Let `prev` be the latest earlier slide whose main visual uses the same diagram. Then `new` must equal `show − prev.show`, or `show` when there is no `prev`. The message is `` `new` does not match what this slide adds: expected [<sorted ids>] ``. A fallback may not have `new`: `fallback diagram takes no new`.
  - **Steps:**
    - a `steps` slide's visual must be a diagram
    - its visible badge numbers must be exactly `1..len(Items)`: `steps items (<n>) do not match visible badges [<sorted ns>]`
- **Fixture diagrams** (exact JSON):
  ```json
  {"id": "d-agent-loop", "title": "วงรอบของ agent", "canvas": [12, 6],
   "nodes": [{"id": "n-user", "label": "ผู้ใช้", "concept": "user", "at": [0, 2], "size": [2, 1]},
             {"id": "n-model", "label": "Model", "concept": "model", "at": [5, 1], "size": [3, 1]},
             {"id": "n-tool", "label": "Tool", "concept": "tool", "at": [5, 4], "size": [3, 1]}],
   "edges": [{"id": "e-ask", "from": "n-user", "to": "n-model", "label": "คำถาม", "style": "solid"},
             {"id": "e-call", "from": "n-model", "to": "n-tool", "label": "tool call", "style": "solid"},
             {"id": "e-result", "from": "n-tool", "to": "n-model", "label": "ผลลัพธ์", "style": "dashed"},
             {"id": "e-answer", "from": "n-model", "to": "n-user", "label": "คำตอบ", "style": "solid"}],
   "groups": [{"id": "g-agent", "label": "agent", "concept": "agent", "members": ["n-model", "n-tool"]}],
   "badges": [{"id": "b1", "n": 1, "near": "n-model"}, {"id": "b2", "n": 2, "near": "e-call"}, {"id": "b3", "n": 3, "near": "e-result"}],
   "notes": []}
  ```
  ```json
  {"id": "d-init", "title": "init_chat_model สร้างโมเดลจากชื่อ", "canvas": [12, 3],
   "nodes": [{"id": "n-name", "label": "\"openai:gpt-5\"", "concept": "value", "at": [0, 1], "size": [3, 1]},
             {"id": "n-init", "label": "init_chat_model", "concept": "function", "at": [4, 1], "size": [4, 1]},
             {"id": "n-chat", "label": "model", "concept": "model", "at": [9, 1], "size": [3, 1]}],
   "edges": [{"id": "e-name", "from": "n-name", "to": "n-init", "label": "", "style": "solid"},
             {"id": "e-make", "from": "n-init", "to": "n-chat", "label": "", "style": "solid"}],
   "groups": [], "badges": [], "notes": []}
  ```

- [ ] **Step 1: Write the failing tests**

```python
CONCEPTS = {"user", "model", "tool", "agent", "function", "value"}

def test_fixture_diagrams_are_valid(fixtures_dir):
    diagrams, _, errors = parse_diagrams((fixtures_dir / "course/slides/_work/part-01/diagrams.md").read_text(encoding="utf-8"))
    assert errors == [] and set(diagrams) == {"d-agent-loop", "d-init"}
    assert [m for d in diagrams.values() for m in check_diagram(d, CONCEPTS)] == []

@pytest.mark.parametrize("change,message", [
    (lambda d: d["nodes"][2].update(at=[5, 1]), "nodes overlap: n-model, n-tool"),
    (lambda d: d["nodes"][2].update(at=[11, 4]), "node n-tool is outside the canvas"),
    (lambda d: d["nodes"][0].update(concept="robot"), "unknown concept 'robot'"),
    (lambda d: d["edges"][0].update(to="n-zzz"), "edge e-ask: unknown node 'n-zzz'"),
    (lambda d: d["badges"][1].update(id="b1"), "duplicate element id b1"),
    (lambda d: d["nodes"][0].update(label="ก" * 25), "label too long: n-user"),
])
def test_diagram_errors(agent_loop, change, message):     # agent_loop: a deep copy of the fixture d-agent-loop
    change(agent_loop)
    assert any(message in m for m in check_diagram(agent_loop, CONCEPTS))

def test_new_must_match_what_the_slide_adds(diagrams):
    slides = slides_with([("explain", show(["n-user", "n-model", "e-ask"]), "same"),
                          ("explain", show(["n-user", "n-model", "e-ask", "n-tool", "e-call"], new=["n-tool"]), "")])
    assert check_states(slides, diagrams) == [("1-002", "`new` does not match what this slide adds: expected [e-call, n-tool]")]

def test_closure_and_subsets(diagrams):
    slides = slides_with([("explain", show(["n-model", "e-call"], highlight=["e-call"], dim=["e-call"]), "same")])
    messages = [m for _, m in check_states(slides, diagrams)]
    assert "edge e-call shown without n-tool" in messages and "highlight and dim overlap" in messages

def test_steps_items_match_badges(diagrams):
    slides = slides_with([("steps", show(["n-model", "n-tool", "e-call", "b1", "b2"]), "same")], items=3)
    assert ("1-001", "steps items (3) do not match visible badges [1, 2]") in check_states(slides, diagrams)

def test_fallback_is_outside_the_new_rule(diagrams):
    fallback = {"kind": "illustration", "fallback": {"kind": "diagram", "diagram": "d-agent-loop", "show": ["n-model"], "new": ["n-model"]}}
    assert ("1-001", "fallback diagram takes no new") in check_states(slides_with([("explain", fallback, "")]), diagrams)
```

`slides_with(specs, items=0)` builds `deck.Slide` objects with ids `1-001…`. A spec `"same"` means `new` is computed to be correct. `show(...)` builds a diagram visual on `d-agent-loop`. Both, plus the `agent_loop` and `diagrams` fixtures, are test helpers in this file.

- [ ] **Step 2: Run tests to verify they fail**

Run: the test command.
Expected: FAIL with `ModuleNotFoundError: No module named 'diagram_checks'`.

- [ ] **Step 3: Implement `diagram_checks.py`, then write the fixture files**

- [ ] **Step 4: Run tests to verify they pass**

Run: the test command.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/teaching/slide-design
git commit -m "feat(slide-design): check diagram geometry and per-slide build states"
```

---

### Task 7: Assemble the deck (`assemble_deck.py`) and the fixture drafts

**Files:**
- Create: `skills/teaching/slide-design/scripts/assemble_deck.py`
- Create, under `tests/fixtures/course/slides/_work/part-01/`:
  - `state.md`, written by `deck_state.save_state`: stage `checking`, every section `written`, language `th`
  - `deck-notes.md`
  - `sections/opening.md`, `sections/1.1.md`, `sections/1.2.md`, `sections/closing.md`
- Modify: `tests/conftest.py`, adding a fixture `assembled(course) -> Path` that calls `assemble(course, 1, today="2026-11-30")` and helper `drop_slide(text: str, slide_id: str) -> str`
- Test: `tests/test_assemble_deck.py`

**Interfaces:**
- Consumes:
  - `part_reader` (`find_part`, `read_part`)
  - `deck_state.load_state` (for `language`)
  - `vocabulary.load` (for `version`)
  - `deck` (`parse_sections`, `parse_diagrams`, `meta_block`)
  - `contract`
- Produces:
  ```python
  class AssembleError(ValueError): ...
  def renumber(sections: list[Section], part: int) -> dict[str, str]   # every draft id -> final id; a split's base id maps to its first slide
  def assemble(course_dir: Path, part: int, today: str | None = None) -> Path   # writes <course_dir>/slides/<part file name>
  ```
  CLI: `assemble_deck.py <course_dir> <part>`. Exit 1 with `error: …` on `AssembleError`, `PartError` or `StateError`.
- **Inputs:**
  - Drafts are read in `Part.section_keys()` order from `sections/<key>.md`. A missing draft raises `missing section draft: <key>`, and a draft with parse errors raises an error listing them.
  - `deck-notes.md` is optional and treated as empty when absent.
- **Renumbering:**
  - Final ids are `<part>-<nnn>`, sequential in deck order from `001`.
  - Each slide heading is rewritten, and its `slide` block is re-emitted with `meta_block`, with `revisit` mapped through `renumber`.
  - Every other draft line is copied verbatim.
- **Output, in order:**
  1. Frontmatter in `DECK_FRONTMATTER_KEYS` order:
     - `source_file` is the Part file name and `source_generated` is the Part's `generated`
     - `language` comes from the state; `vocabulary` is `"visual-vocabulary.md"`; `vocabulary_version` is the vocabulary's `version`
     - `slide_count` is the number of slides; `code_status` comes from the Part; `generated` is `today` or the real date
  2. `# Part N: <title>`
  3. `## Deck notes`: the notes text, then two generated subsections. Each is `### <name>`, a blank line, then its lines:
     - `### Visuals to produce`: one `- <slide id> <kind>: <description or capture>` line per illustration or screenshot, else `_None._`
     - `### Code status`: one `- <snippet id> <status>: <reason>` line per referenced snippet that is not `verified`, else `_None._`
  4. The sections.
  5. `## Diagrams`: the raw blocks from `diagrams.md`, in order.
  6. `## Code listings`: in Part order, one entry per snippet referenced by a `code` or `output` slide. Each is `### <id>`, then a ```` ```listing ```` block `{"snippet", "status", "reason"}`, then a fence in the snippet's `lang` holding its exact code.
- **Fixture drafts.** The Thai text is the implementer's to write. It must stay within `FIELD_LIMITS` and use only inline code found in the Part. Later tests edit the deck text, so pin these formats:
  - Every `visual` block is exactly `json.dumps(visual, ensure_ascii=False)` on one line, with keys in the order `kind, diagram, show, new, highlight, dim` and ids in the order the table lists them.
  - Every field's text starts on its label line (`**Body:** <text>`).
  - Every slide's `Title` is unique.

  | Draft id | Final id | Layout | `from` | Visual or layout-specific meta |
  |---|---|---|---|---|
  | **opening.md** | | | | |
  | 1-001 | 1-001 | cover | Real-world task | — |
  | 1-002 | 1-002 | focus | Real-world task | `d-agent-loop` show `n-user n-model e-ask e-answer`, new = show |
  | 1-003 | 1-003 | objectives | Objectives | — (Items: O1, O3) |
  | 1-004 | 1-004 | setup | Prerequisites and setup | a `text` block holding the Part's `pip install …` line verbatim |
  | 1-005 | 1-005 | terms | Key terms | — (Items: Agent) |
  | 1-006 | 1-006 | steps | Core mental model | `d-agent-loop` show all 11 elements, new `n-tool e-call e-result g-agent b1 b2 b3`; 3 Items |
  | **1.1.md** | | | | |
  | 1-007 | 1-007 | explain | 1.1/Core knowledge | `d-init` show all, new all |
  | 1-008 | 1-008 | code | 1.1/Worked example | snippet `1.1-a`, lines `[[1,1]]`, highlight `[[1,1]]` |
  | 1-008a | 1-009 | code | 1.1/Worked example | snippet `1.1-a`, lines `[[3,5]]`, highlight `[[4,5]]` |
  | 1-009 | 1-010 | output | 1.1/Worked example | snippet `1.1-a`, a `text illustrative` block equal to the Part's |
  | 1-010 | 1-011 | compare | 1.1/Misconceptions | text panels using `` `ChatOpenAI` `` and `` `init_chat_model` `` |
  | 1-011 | 1-012 | error | 1.1/Common errors and fixes | a `text` block `ValueError: Unable to infer model provider` |
  | 1-012 | 1-013 | question | 1.1/Self-check | — |
  | 1-013 | 1-014 | answer | 1.1/Self-check | revisit `1-007` |
  | **1.2.md** | | | | |
  | 1-014 | 1-015 | explain | 1.2/Core knowledge | show `n-user n-model e-ask e-answer`, new `[]`, highlight `n-model` |
  | 1-015 | 1-016 | explain | 1.2/Core knowledge | show + `n-tool e-call`, new `n-tool e-call` |
  | 1-016 | 1-017 | explain | 1.2/Core knowledge | show + `e-result g-agent`, new `e-result g-agent` |
  | 1-017 | 1-018 | code | 1.2/Worked example | snippet `1.2-a`, lines `[[1,8]]`, highlight `[[5,8]]` |
  | 1-018 | 1-019 | code | 1.2/Worked example | snippet `1.2-a`, lines `[[11,13]]`, highlight `[[11,11]]` |
  | 1-019 | 1-020 | output | 1.2/Worked example | snippet `1.2-a` |
  | 1-020 | 1-021 | explain | 1.2/Analogy | illustration; its prompt ends with the vocabulary style; fallback diagram `d-agent-loop` show `n-model n-tool e-call e-result` |
  | 1-021 | 1-022 | compare | 1.2/Misconceptions | text panels using `` `create_react_agent` ``, `` `langgraph.prebuilt` ``, `` `langchain.agents.create_agent` `` |
  | 1-022 | 1-023 | error | 1.2/Common errors and fixes | a Symptom field, no block |
  | 1-023 | 1-024 | question | 1.2/Self-check | — |
  | 1-024 | 1-025 | answer | 1.2/Self-check | revisit `1-017` (becomes `1-018`) |
  | **closing.md** | | | | |
  | 1-025 | 1-026 | summary | Core mental model | show the 8 non-badge elements, new `[]` |
  | 1-026 | 1-027 | practice | Practice material | — |
  | 1-027 | 1-028 | focus | Bridge to next part | same show, new `[]`, highlight `g-agent` |
  | 1-028 | 1-029 | sources | Further reading, Sources | Items: the Part's links |

- [ ] **Step 1: Write the failing tests**

```python
def test_frontmatter(assembled):
    meta, _ = frontmatter.parse(assembled.read_text(encoding="utf-8"))
    assert list(meta) == list(DECK_FRONTMATTER_KEYS)
    assert meta == {"template": "slide-design/deck@1", "course": "langchain-langgraph", "part": 1, "title": "Agent ตัวแรกด้วย create_agent",
                    "source_file": "part-01-first-agent.md", "source_generated": "2026-11-22", "language": "th",
                    "vocabulary": "visual-vocabulary.md", "vocabulary_version": 1, "slide_count": 29, "code_status": "verified", "generated": "2026-11-30"}

def test_ids_renumbered_and_revisit_rewritten(assembled):
    deck = parse_deck(assembled.read_text(encoding="utf-8"))
    assert deck.errors == [] and [s.key for s in deck.sections] == ["opening", "1.1", "1.2", "closing"]
    assert [s.id for s in deck.slides()] == [f"1-{n:03d}" for n in range(1, 30)]
    by_id = {s.id: s for s in deck.slides()}
    assert by_id["1-014"].meta["revisit"] == "1-007" and by_id["1-025"].meta["revisit"] == "1-018"

def test_listings_and_generated_notes(assembled):
    deck = parse_deck(assembled.read_text(encoding="utf-8"))
    assert list(deck.listings) == ["1.1-a", "1.2-a"] and deck.listings["1.1-a"].meta["status"] == "verified"
    assert deck.listings["1.2-a"].code.text == read_part(find_part(assembled.parents[1], 1)).snippets["1.2-a"].code
    assert "1-021 illustration:" in deck.notes and "### Code status\n\n_None._" in deck.notes

def test_assembling_twice_is_identical(course):
    first = assemble(course, 1, today="2026-11-30").read_text(encoding="utf-8")
    assert assemble(course, 1, today="2026-11-30").read_text(encoding="utf-8") == first

def test_missing_draft(course):
    (course / "slides/_work/part-01/sections/closing.md").unlink()
    with pytest.raises(AssembleError, match="missing section draft: closing"):
        assemble(course, 1)

def test_skipped_snippet_is_listed(course):
    edit(find_part(course, 1), '<!-- snippet id="1.2-a" status="verified" checked="2026-11-22" -->', '<!-- snippet id="1.2-a" skip="needs an OpenAI key" -->')
    deck = parse_deck(assemble(course, 1).read_text(encoding="utf-8"))
    assert deck.listings["1.2-a"].meta["status"] == "skipped" and "- 1.2-a skipped: needs an OpenAI key" in deck.notes
```

- [ ] **Step 2: Run tests to verify they fail**

Run: the test command.
Expected: FAIL with `ModuleNotFoundError: No module named 'assemble_deck'`.

- [ ] **Step 3: Implement `assemble_deck.py`, then write the fixture drafts, notes and state**

- [ ] **Step 4: Run tests to verify they pass**

Run: the test command.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/teaching/slide-design
git commit -m "feat(slide-design): assemble section drafts into the deck"
```

---

### Task 8: Validator (`validate_deck.py`)

**Files:**
- Create: `skills/teaching/slide-design/scripts/validate_deck.py`
- Modify: `tests/conftest.py`, adding helpers that locate a slide with `deck.parse_deck` and then call `edit`:
  - `set_field(path, slide_id, field, value)` replaces `**F:** <old text>`
  - `add_field(path, slide_id, field, value)` inserts `**F:** value` before the slide's `**Title:**` line
  - `set_meta(path, slide_id, key, value)` replaces the slide's `meta_block`
  - `set_visual(path, slide_id, visual)` replaces its one-line `visual` block
- Test: `tests/test_validate_deck.py`

**Interfaces:**
- Consumes: `part_reader`, `vocabulary.load`, `deck.parse_deck`, `deck.parse_diagrams`, `diagram_checks`, `mdtext` (`visible_length`, `inline_code`, `urls`), `contract`
- Produces:
  ```python
  @dataclass(frozen=True)
  class Issue: level: str; where: str; message: str      # level "error" | "warning"; where: slide id, "frontmatter", a diagram id or "line N"
  def validate(course_dir: Path, part: int) -> list[Issue]
  def validate_diagrams(course_dir: Path, part: int) -> list[Issue]   # _work/part-NN/diagrams.md vs vocabulary ∪ new-concepts.json; a missing vocabulary counts as empty
  ```
  CLI: `validate_deck.py <course_dir> <part> [--diagrams] [--json]`. It prints `error: <where>: <message>` and `warning: …` lines, or a JSON list. Exit 1 if any error, else 0.
- **Checks** (message fragments in quotes):
  - **Parse:** every `deck.errors` entry becomes an error.
  - **Frontmatter:**
    - keys and order: `frontmatter keys must be …`
    - values against the Part: `frontmatter <key> should be <expected>`
    - `slide_count`; `vocabulary_version` from 1 to the current version
  - **Stale:** when `source_generated` ≠ the Part's `generated`: `stale: the Part changed after this deck (Part generated <date>)`
  - **Headings:**
    - `##` headings must be exactly `Deck notes`, `Opening`, one `N.k <title>` per sub-topic with the Part's titles, `Closing`, `Diagrams` and `Code listings`: `sections must be …`
    - deck notes must not be empty
  - **Slide basics:**
    - ids match `SLIDE_ID_RE` with this Part's number and run from `001`: `slide ids must be sequential`
    - the heading layout equals `meta.layout`, and the layout is known: `unknown layout '<x>'`
    - meta keys are in `META_KEYS` ∪ `LAYOUT_META_KEYS[layout]`
    - `purpose` is non-empty and within `PURPOSE_LIMIT`
    - `from` is non-empty
  - **Fields:**
    - each required field is present: `missing field <F>`
    - fields outside required ∪ optional are refused: `field <F> not allowed in <layout>`
    - item counts follow `ITEM_COUNTS`
    - `error` slides need a `Symptom` field or an error block
  - **Lengths:**
    - `Title` within `TITLE_LIMIT`; each `FIELD_LIMITS` entry; `Notice` within `NOTICE_LIMIT`
    - message: `too long: <F> has <n> characters, limit <L>`, using `visible_length`
  - **Visual by layout:**
    - `required`: `needs a visual`; `none`: `takes no visual`
    - `kind` in `VISUAL_KINDS`
    - illustrations need non-empty `description`, `prompt` and `alt`, and the prompt must end with the vocabulary style: `prompt must end with the illustration style`
    - screenshots need a `url` from the Part and a `capture`
    - both need a `fallback` of a known kind: `needs a fallback`
    - text fallbacks need `text`
  - **References:**
    - each `from` ref exists in the Part and is not `_None._`: `unknown ref` / `ref points to an empty slot`
    - a `N.k/…` ref may only be used in section `N.k`: `content from <N.k> in section <M.j>`
    - `revisit` must name an earlier slide: `revisit must point to an earlier slide`
  - **Coverage:**
    - every `Part.slot_refs()` entry appears in some `from`: `not covered: <ref>`
    - every Part snippet appears as some code slide's `snippet`: `not covered: snippet <id>`
  - **Code fidelity:**
    - `code` slides:
      - one block, in the snippet's `lang`
      - `lines` are ascending, non-overlapping 1-based ranges inside the snippet
      - `highlight` ranges fall inside the shown ranges
      - the block text equals the snippet lines of those ranges, joined with `\n`: `code excerpt differs from snippet <id>`
    - `output` slides: one block whose text equals the snippet's expected output and whose info string equals the Part's: `output differs from the Part for snippet <id>`
    - `setup`, `error` and `compare` panel blocks: their stripped text must appear in the Part body: `block not in the Part`
    - inline code spans in any field: each must appear in the Part body: ``inline code not in the Part: `<x>` ``
    - a `code` or `output` slide whose snippet is not `verified` needs a `Notice`: `needs a Notice: snippet <id> is <status>`
  - **Sources:** URLs in `meta.sources` and in field text must be Part URLs: `source not in the Part: <url>`
  - **Listings:**
    - the listing ids equal the snippets referenced by code and output slides
    - each listing's code, lang, status and reason equal the Part's: `listing <id> differs from the Part` / `listing status`
  - **Diagrams:**
    - `check_diagram` against the vocabulary's concepts for every deck diagram
    - `check_states` for all slides
    - a diagram no slide uses is a warning: `unused diagram`

- [ ] **Step 1: Write the failing tests**

```python
def errors(course): return [f"{i.where}: {i.message}" for i in validate(course, 1) if i.level == "error"]

def test_assembled_fixture_is_valid(course, assembled):
    assert errors(course) == []

CODE_1_009 = 'model = init_chat_model("openai:gpt-5")'
@pytest.mark.parametrize("old,new,message", [
    (CODE_1_009, 'model = init_chat_model("openai:gpt-4")', "1-009: code excerpt differs from snippet 1.1-a"),
    ('"at": [5, 4]', '"at": [5, 1]', "nodes overlap: n-model, n-tool"),
    ('"concept": "tool"', '"concept": "robot"', "unknown concept 'robot'"),
    ('"layout": "summary"', '"layout": "summery"', "unknown layout 'summery'"),
    ('"revisit": "1-018"', '"revisit": "1-029"', "1-025: revisit must point to an earlier slide"),
    ('slide_count: 29', 'slide_count: 30', "frontmatter slide_count should be 29"),
])
def test_mutations_are_caught(course, assembled, old, new, message):
    edit(assembled, old, new, first=True)
    assert any(message in e for e in errors(course))
```

The six spec acceptance mutations, each with its own test:
- `test_missing_slot`: `drop_slide(text, "1-011")` gives `not covered: 1.1/Misconceptions`.
- `test_new_mismatch`: change 1-016's `"new"` to `["n-tool"]`. Expected: `` 1-016: `new` does not match what this slide adds: expected [e-call, n-tool] ``.
- `test_text_over_limit`: set 1-007's Body to `"ก" * 421`. Expected: `1-007: too long: Body has 421 characters, limit 420`.
- `test_thai_marks_do_not_count`: set 1-007's Body to `"ที่" * 140` (140 visible, 420 code points). Expected: no `too long` error.
- `test_stale_part`: edit the Part's `generated: "2026-11-22"` to `"2026-12-01"`. Expected: `stale: the Part changed after this deck`.
- `test_inline_code_not_in_part`: append `` `get_weather("Bangkok")` `` to 1-015's Body. Expected: ``1-015: inline code not in the Part: `get_weather("Bangkok")` ``.

The next three tests cover fidelity:
- `test_unverified_snippet_needs_notice`: mark `1.1-a` `status="unverified" reason="boom"` in the Part and re-assemble.
  - Expected: `1-008: needs a Notice: snippet 1.1-a is unverified`.
  - Then `add_field` a `Notice` to the drafts of 1-008, 1-008a and 1-009 (final 1-008, 1-009 and 1-010) and re-assemble. No Notice error remains.
- `test_source_not_in_part`: add `"https://example.com/x"` to 1-007's `sources`. Expected: `source not in the Part: https://example.com/x`.
- `test_cross_section_ref`: set 1-010's `from` to `["1.2/Worked example"]`. Expected: `content from 1.2 in section 1.1`.

The last three test the two modes:
- `test_illustration_rules`:
  - remove 1-021's `fallback`. Expected: `needs a fallback`.
  - cut the style off the prompt. Expected: `prompt must end with the illustration style`.
- `test_diagrams_mode`:
  - On the fixture, `validate_diagrams(course, 1) == []`.
  - With a node concept `"graph"` that is missing from the vocabulary, there is an `unknown concept 'graph'` error.
  - After writing `[{"id": "graph", "meaning": "x", "shape": "box", "role": "secondary", "icon": ""}]` to `new-concepts.json`, it is clean again.
- `test_cli_exit_codes`: the CLI exits 0 on the assembled fixture and 1 after any mutation above.

The mutations edit the deck file directly, except where a test says to change the Part or a draft and re-assemble.

- [ ] **Step 2: Run tests to verify they fail**

Run: the test command.
Expected: FAIL with `ModuleNotFoundError: No module named 'validate_deck'`.

- [ ] **Step 3: Implement `validate_deck.py`** with the interfaces and checks above. If the fixture drafts from Task 7 fail a check, fix the fixture, not the check.

- [ ] **Step 4: Run tests to verify they pass**

Run: the test command.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/teaching/slide-design
git commit -m "feat(slide-design): validate deck structure, diagrams, coverage and fidelity"
```

---

### Task 9: Reference briefs

**Files:**
- Create, under `skills/teaching/slide-design/references/`:
  - `deck-template.md`
  - `storyboard.md`
  - `visuals.md`
  - `section-writer.md`
  - `learner-review.md`
- Test: `tests/test_references.py`

**Interfaces:**
- Consumes: `contract` (`DECK_TEMPLATE_ID`, `VOCABULARY_TEMPLATE_ID`, `LAYOUTS`, `FIELDS`, `FIELD_LIMITS`, `SHAPES`, `VISUAL_KINDS`), `deck.parse_sections`
- Produces the five briefs. Each opens with who reads it and when. Content each must carry:
  - **`deck-template.md`**: the contract the downstream skill relies on.
    - Files and paths (`slides/`, `_work/part-NN/`), and the frontmatter key table.
    - The deck body order; the slide grammar (heading, `slide` block, field labels, `visual` block, content blocks); the layout table with each layout's fields, visual and content.
    - The `FIELD_LIMITS` table; the meta keys per layout; the visual and diagram JSON with build-state semantics (`show`, `new`, `highlight`, `dim`); listings; the vocabulary file layout.
    - What the downstream skill must not do: read the Part, re-theme concept roles inconsistently, or merge build steps into one slide.
    - A filled example of 3–5 slides between `<!-- example:deck -->` and `<!-- /example:deck -->`, as a section draft.
    - The version-bump rule.
  - **`storyboard.md`**: how the coordinator plans Stage 1 and presents Stage 2.
    - Sections, the default order (opening, sub-topic, closing, as in spec §6.2) and when to deviate.
    - Choosing a layout per slide, with B (`explain`) as the default explanation.
    - The term rule: known terms are prior knowledge from `Context`, earlier Parts and earlier slides; opening slides before `terms` may name but not rely on a term; Part gaps; `terms` holds at most 5 terms.
    - Planning diagrams in full in `diagrams.md` and checking them with `--diagrams`.
    - The file layouts of `storyboard.md`, `new-concepts.json` and `deck-notes.md`, and the storyboard table columns (id, layout, purpose, from, visual).
    - What `deck-notes.md` holds: the learner profile, that the deck is read without narration, and Part gaps.
    - The gate presentation checklist (spec §6.2 Stage 2), plus the proposed illustration-style sentence on the first Part's run.
  - **`visuals.md`**:
    - When to use each visual kind; diagrams first; why not Mermaid.
    - The fixed-grid layout guidance; build steps and `highlight`; closure.
    - Every `SHAPES` value, and colour roles from the vocabulary.
    - Illustration prompts in English ending with the style; screenshot capture notes; fallbacks for both.
  - **`section-writer.md`**: the writer's brief.
    - Inputs; output `sections/<key>.md`; storyboard ids; split ids such as `1-007a`.
    - What may change within the section and what must be reported (spec §6.2 Stage 3).
    - No facts, code, error messages or analogies beyond the Part; inline code only as it appears in the Part.
    - Code excerpts by line range; `Notice` for snippets that are not verified.
    - Conversational text in the glossary's terms, within the limits.
    - **Revision mode**: fix only the listed issues.
  - **`learner-review.md`**: the reviewer's brief.
    - Pass 1 as the learner, reading the vocabulary and the deck only, with the six flags from spec §6.2 Stage 5.
    - Pass 2 for fidelity against the Part.
    - Severity **Blocking** / **Minor** with the spec's examples; the term rule.
    - Part gaps are reported, not sent to writers.
    - The output `review.md` as a table: slide id, pass, severity, issue, suggested fix.
    - **Round 2** rechecks only the revised slides.

- [ ] **Step 1: Write the failing tests**

```python
def read(skill_dir, name): return (skill_dir / "references" / name).read_text(encoding="utf-8")

def test_deck_template_names_the_whole_contract(skill_dir):
    text = read(skill_dir, "deck-template.md")
    assert DECK_TEMPLATE_ID in text and VOCABULARY_TEMPLATE_ID in text
    assert [l for l in LAYOUTS if f"`{l}`" not in text] == []
    assert [f for f in FIELDS if f"**{f}:**" not in text] == []
    assert [k for k, v in FIELD_LIMITS.items() if str(v) not in text] == []

def test_deck_template_example_parses(skill_dir):
    text = read(skill_dir, "deck-template.md")
    example = text.split("<!-- example:deck -->")[1].split("<!-- /example:deck -->")[0]
    example = example.split("````markdown\n", 1)[1].rsplit("````", 1)[0]
    sections, errors = parse_sections(example)
    assert errors == [] and len({s.layout for s in sections[0].slides}) >= 3

@pytest.mark.parametrize("name,needles", [
    ("storyboard.md", ["prior knowledge", "Part gap", "at most 5 terms", "_None._", "diagrams.md", "new-concepts.json", "deck-notes.md", "--diagrams"]),
    ("visuals.md", [*SHAPES, *VISUAL_KINDS, "fallback", "Mermaid", "build step", "highlight"]),
    ("section-writer.md", ["Revision mode", "sections/<key>.md", "1-007a", "Notice", "no new facts"]),
    ("learner-review.md", ["Blocking", "Minor", "Round 2", "Part gap", "review.md", "prior knowledge"]),
])
def test_briefs_carry_their_rules(skill_dir, name, needles):
    text = read(skill_dir, name)
    assert [n for n in needles if n not in text] == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: the test command.
Expected: FAIL with `FileNotFoundError` for `references/deck-template.md`.

- [ ] **Step 3: Write the five briefs** with the content above, in English, following the house style of `skills/teaching/course-research/references/`: short sections, imperative, one rule per line.

- [ ] **Step 4: Run tests to verify they pass**

Run: the test command.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/teaching/slide-design
git commit -m "docs(slide-design): add the deck contract and the storyboard, visuals, writer and review briefs"
```

---

### Task 10: Coordinator `SKILL.md` and acceptance checklist

**Files:**
- Create: `skills/teaching/slide-design/SKILL.md`
- Create: `skills/teaching/slide-design/evals/acceptance.md`
- Test: `tests/test_skill_md.py`

**Interfaces:**
- Consumes: every script CLI from Tasks 3, 4, 7 and 8; every reference from Task 9; `contract.STAGES`
- Produces:
  - **`SKILL.md`** with frontmatter `name: slide-design` and a `description` of at most 1024 characters. The description says when to use the skill (after `course-research`, one Part at a time, to design slides that learners read alone) and when not to (making the slide files themselves, or research).
  - **The body**, mirroring course-research's `SKILL.md` structure:
    - The role of the coordinator. `<skill>` and `<course_dir>` path conventions. The stage list with the exact `deck_state.py` commands.
    - **Stage 0:**
      - Find the Part and run `deck_state.py init … --language`.
      - Tell the user the cost: one writer per section, plus one reviewer.
      - For an existing state, offer: continue, redo a section, or redo the storyboard.
      - Run `validate_deck.py` and look for `stale`.
    - **Stage 1:** follow `references/storyboard.md`, and run `validate_deck.py <course_dir> <N> --diagrams`.
    - **Stage 2 (gate):** the presentation. Then:
      - first Part only: `vocabulary.py init`
      - every Part: `vocabulary.py add … --part N`
      - `set-stage storyboard-approved` and then `writing`
    - **Stage 3:** dispatch writers, at most 5 per turn, with the prompt below, then `set-section … written`.
    - **Stage 4:** `assemble_deck.py`, then `validate_deck.py`. Revision mode for at most 2 rounds. Diagram errors go to the coordinator.
    - **Stage 5:** the reviewer prompt, at most 2 rounds, then `set-section … checked`.
    - **Stage 6:** the report.
    - Without a subagent tool, every role runs inline.
    - The references list.
  - **Writer prompt:**
    ```
    Write section <key> of the slide deck for Part <N> of the course in <course_dir>.

    Inputs: <course_dir>/00-overview.md, <course_dir>/<part file>, <work>/storyboard.md, <work>/diagrams.md, <course_dir>/slides/visual-vocabulary.md
    Your slides: <storyboard ids for this section>
    Output: <work>/sections/<key>.md

    As a first step, read <skill>/references/section-writer.md and follow it.
    ```
  - **Reviewer prompt:**
    ```
    Review the slide deck <course_dir>/slides/<part file> for Part <N>.

    Learner profile: <the Part's Context>
    Round: <1 | 2: recheck slides <ids> for issues <list>>
    Output: <work>/review.md

    As a first step, read <skill>/references/learner-review.md and follow it.
    ```
  - **`evals/acceptance.md`**: the spec's §8 checks as a table (check, how to run, pass condition), plus a recipe for the first real run: install the skill by symlink only after the user agrees, then run it on a real Part from the first `course-research` run.

- [ ] **Step 1: Write the failing tests**

```python
def test_frontmatter_name_matches_dir(skill_dir, skill_md):
    data, _ = frontmatter.parse(skill_md)
    assert data["name"] == "slide-design" == skill_dir.name
    assert 0 < len(data["description"]) <= 1024 and "course-research" in data["description"]

def test_links_every_reference(skill_dir, skill_md):
    assert [p.name for p in sorted((skill_dir / "references").glob("*.md")) if f"references/{p.name}" not in skill_md] == []

@pytest.mark.parametrize("needle", ["scripts/deck_state.py", "scripts/vocabulary.py", "scripts/assemble_deck.py", "scripts/validate_deck.py", "--diagrams", "--language", "stale"])
def test_mentions_every_script_and_flag(skill_md, needle):
    assert needle in skill_md

def test_mentions_every_stage_and_the_gate(skill_md):
    assert [s for s in STAGES if f"`{s}`" not in skill_md] == []
    assert "Never dispatch writers before the user approves the storyboard" in skill_md

def test_acceptance_lists_the_spec_checks(skill_dir):
    text = (skill_dir / "evals" / "acceptance.md").read_text(encoding="utf-8")
    assert [n for n in ("exit 0", "overlapping node", "unknown concept", "missing slot", "`new`", "over its limit", "reuses the vocabulary", "learner pass") if n not in text] == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: the test command.
Expected: FAIL with `FileNotFoundError` for `SKILL.md`.

- [ ] **Step 3: Write `SKILL.md` and `evals/acceptance.md`** with the content above.

- [ ] **Step 4: Run tests to verify they pass**

Run: the test command.
Expected: PASS. The whole suite is green.

- [ ] **Step 5: Commit**

```bash
git add skills/teaching/slide-design
git commit -m "feat(slide-design): add coordinator SKILL.md and acceptance checklist"
```
