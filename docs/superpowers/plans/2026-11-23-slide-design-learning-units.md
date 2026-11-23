# Learning units in slide-design (deck@2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `slide-design` plans each Part as small learning units, ordered by what is needed first. Every unit opens with a divider. Every chapter ends by assembling its units. All of this lands in a `deck@2` file that `react-slides` renders, with the current unit shown in each slide's header.

**Architecture:**
- A new unit map (`_work/part-NN/units.json`, checked by `scripts/units.py`) is approved at the gate. It is copied into the deck as a `## Units` section.
- Three layouts join the contract: `map`, `topic` and `assemble`. A slide's unit is inferred from the nearest `topic` slide before it (`deck.slide_units`).
- The validator enforces the structure (`scripts/unit_checks.py`).
- `react-slides` reads both `deck@1` and `deck@2`, and renders the new layouts and the unit header.

**Tech Stack:** stdlib Python 3.11+ with pytest; the `react-slides` template is Vite + React + TypeScript with vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-slide-design-learning-units-design.md`. Read it before starting any task.

## Global Constraints

**Shared code:**
- Stdlib Python only, 3.11 or later. Each script puts its own folder on `sys.path`.
- `contract.py`, `deck.py`, `mdtext.py` and `frontmatter.py` must stay byte-identical between `skills/teaching/slide-design/scripts/` and `skills/teaching/react-slides/scripts/`. `react-slides/tests/test_fixture.py::test_shared_modules_match_slide_design` enforces this. Edit the `slide-design` copy, then `cp` it to `react-slides` in the same task.

**Contract values:**
- `slide-design` writes only `"slide-design/deck@2"`. Readers accept `("slide-design/deck@1", "slide-design/deck@2")`.
- **Unit id:** `^u-[a-z0-9]+(?:-[a-z0-9]+)*$`.
- **Chapter id:** the sub-topic key (`1.2`), or the key plus a letter (`1.2a`, `1.2b`, …) when a sub-topic has two or more chapters.
- **Part assembly:** the `assembles` value of the closing's assembly is `"part"`.
- **Limits:** a unit title is at most 40 visible characters, a goal at most 120, and a chapter holds 1–6 units.
- **Slide text:** a `topic` slide's Title equals its unit's `title` and its Body equals the unit's `goal`, character for character. The `map` Body limit is 120, the `topic` Body limit 120, and the `assemble` Body limit 300.
  - The spec suggested 160 for the `topic` Body. It is 120 because the Body equals the goal, whose limit is 120. Record this in `deck-template.md` next to the limit.
- **Assembly rule:** a single-unit chapter has no `assemble` slide. A chapter of two or more units has at least one.

**Repo rules:**
- Repository text is in English. Fixtures are made up: never copy a user's course content.
- One commit per task, in Conventional Commits with the skill as the scope (`feat(slide-design): …`, `feat(react-slides): …`). A task that changes both skills uses the scope of the skill it is about.
- Run these test commands from the repo root. `RS` is `skills/teaching/react-slides`.
  - **slide-design:** `uv run --no-project --python 3.12 --with pytest pytest skills/teaching/slide-design/tests -q`
  - **react-slides template:** `npm --prefix $RS/template ci && npm --prefix $RS/template test && npm --prefix $RS/template run build`
  - **react-slides Python:** `uv run --no-project --python 3.12 --with pytest pytest $RS/tests -q`
- A task that touches a shared module runs both skills' tests.

## Review Focus

1. **A `deck@1` deck from an earlier run, built by the new `react-slides`:** it renders exactly as before, with no unit header and no error. A `deck@1` deck that uses `map`, `topic` or `assemble` is refused, with a message naming `slide-design/deck@2`. Covered by Task 3 `test_deck_at_1_loads_without_units` and `test_deck_at_1_refuses_new_layouts`.
2. **Resuming a run started before this change** (`_work` has no `units.json`): `--plan` and `assemble_deck.py` both name the missing file and say to redo the storyboard, instead of failing with a traceback. Covered by Task 1 `test_plan_without_units_file` and Task 4 `test_missing_units_file_is_named`.
3. **A writer's split id inside a unit** (`1-010a`) keeps its unit after renumbering, and `slide_units` keys by the final id. Covered by Task 2 `test_slide_units_follow_split_ids` and the Task 4 fixture, which keeps a split inside a unit.
4. **A sub-topic split into chapters** (`1.2a`, `1.2b`): `1.2b`'s assembly may label `1.2a`'s units, but a label naming a later chapter's unit is refused. Covered by Task 5 `test_label_scope_in_split_chapters`.
5. **A Thai unit title** with tone and vowel marks counts only visible characters toward the 40-character limit. JSX-special characters in a title (`{`, `<`) reach the page verbatim, because titles travel as JSON data and never as JSX text. Covered by Task 1 `test_thai_marks_do_not_count_in_titles` and Task 3 `test_units_travel_as_data`.

---

### Task 1: Unit map file and `--plan`

**Files:**
- Create: `skills/teaching/slide-design/scripts/units.py`
- Create: `skills/teaching/slide-design/tests/test_units.py`
- Create: `skills/teaching/slide-design/tests/fixtures/course/slides/_work/part-01/units.json`
- Modify: `skills/teaching/slide-design/scripts/contract.py` (constants only), then copy it to `skills/teaching/react-slides/scripts/contract.py`
- Modify: `skills/teaching/slide-design/scripts/validate_deck.py` (`validate_plan`, the `--plan` flag)
- Modify: `skills/teaching/slide-design/tests/test_validate_deck.py`

**Interfaces:**
- Produces in `contract.py`:
  - `UNITS_FILE = "units.json"`
  - `UNIT_ID_RE = re.compile(r"^u-[a-z0-9]+(?:-[a-z0-9]+)*$")`
  - `CHAPTER_ID_RE = re.compile(r"^(?P<section>\d+\.\d+)(?P<letter>[a-z]?)$")`
  - `UNIT_TITLE_LIMIT = 40`, `UNIT_GOAL_LIMIT = 120`, `CHAPTER_UNITS_MAX = 6`
  - `PART_ASSEMBLY = "part"`
  - `CHAPTER_KEYS = ("id", "section", "title", "units")`
  - `UNIT_KEYS = ("id", "title", "goal", "needs", "moved_from", "reason")`
- Produces in `units.py`:
  - `class UnitsError(ValueError)`
  - `load_units(path: Path) -> dict`. It raises `UnitsError` for a missing file, invalid JSON, or a value that is not an object.
  - `check_units(data: dict, subtopic_keys: list[str]) -> list[str]`. It returns messages, and is empty when the map is valid.
  - `units_by_id(data: dict) -> dict[str, dict]`
  - `unit_chapters(data: dict) -> dict[str, str]`, mapping a unit id to its chapter id.
  - `chapter_list(data: dict) -> list[dict]`, the chapters in map order.
- Produces in `validate_deck.py`: `validate_plan(course_dir: Path, part: int) -> list[Issue]`. It returns `validate_diagrams(...)` issues plus unit-map issues, each with `where="units.json"`.

- [ ] **Step 1: Write the fixture unit map** `tests/fixtures/course/slides/_work/part-01/units.json`. Later tasks rely on these exact ids and texts:

```json
{"chapters": [
  {"id": "1.1", "section": "1.1", "title": "เรียกโมเดลด้วย init_chat_model", "units": [
    {"id": "u-init-model", "title": "สร้างโมเดลจากชื่อ", "goal": "สร้างโมเดลจากชื่อแบบ provider:model แล้วส่งคำถามแรก", "needs": []}]},
  {"id": "1.2", "section": "1.2", "title": "สร้าง agent ที่เรียก tool", "units": [
    {"id": "u-tool", "title": "ประกาศ tool", "goal": "เปลี่ยนฟังก์ชันธรรมดาเป็น tool ด้วย @tool", "needs": []},
    {"id": "u-agent", "title": "ต่อ tool เข้ากับ agent", "goal": "สร้าง agent จากโมเดลกับ tool แล้วส่งคำถาม", "needs": ["u-tool"]}]}
]}
```

- [ ] **Step 2: Write the failing tests** in `tests/test_units.py`.
  - Build `VALID` with `json.loads` of the fixture file.
  - Add a helper `mutate(fn) -> dict` that deep-copies `VALID`, applies `fn` and returns the copy.

```python
def test_valid_map_has_no_errors():
    assert check_units(VALID, ["1.1", "1.2"]) == []

@pytest.mark.parametrize("change,message", [
    (lambda d: d["chapters"][0]["units"][0].update(id="init"), "unit init: id must look like u-<words>"),
    (lambda d: d["chapters"][1]["units"][1].update(id="u-tool"), "duplicate unit u-tool"),
    (lambda d: d["chapters"][1]["units"][0].update(title="ก" * 41), "unit u-tool: title has 41 characters, limit 40"),
    (lambda d: d["chapters"][1]["units"][0].update(goal="ก" * 121), "unit u-tool: goal has 121 characters, limit 120"),
    (lambda d: d["chapters"][1]["units"][0].update(needs=["u-agent"]), "unit u-tool: needs must name earlier units, not u-agent"),
    (lambda d: d["chapters"][1]["units"][0].update(needs=["u-tool"]), "unit u-tool: needs must name earlier units, not u-tool"),
    (lambda d: d["chapters"].pop(1), "sub-topic 1.2 has no chapter"),
    (lambda d: d["chapters"].reverse(), "chapter 1.1: chapters must follow the Part's sub-topic order"),
    (lambda d: d["chapters"][0].update(id="1.1a"), "chapter 1.1a: id must be 1.1 for a single chapter"),
    (lambda d: d["chapters"][0].update(section="1.2"), "chapter 1.1: id must start with its section 1.2"),
    (lambda d: d["chapters"][1]["units"].extend({"id": f"u-x{i}", "title": "t", "goal": "g", "needs": []} for i in range(5)), "chapter 1.2: a chapter has 1 to 6 units, has 7"),
    (lambda d: d["chapters"][1]["units"][0].update(moved_from="1.1", reason="r"), "unit u-tool: moved_from must be a later sub-topic than 1.2"),
    (lambda d: d["chapters"][0]["units"][0].update(moved_from="1.2"), "unit u-init-model: a moved unit needs a reason"),
    (lambda d: d["chapters"][0]["units"][0].update(reason="r"), "unit u-init-model: reason is only for a moved unit"),
    (lambda d: d["chapters"][0].update(colour="red"), "chapter 1.1: unknown key 'colour'"),
    (lambda d: d.update(chapters=[]), "the unit map has no chapters"),
])
def test_bad_maps_are_caught(change, message):
    assert message in check_units(mutate(change), ["1.1", "1.2"])

SPLIT = {"chapters": [VALID["chapters"][0],
    {"id": "1.2a", "section": "1.2", "title": "a", "units": [VALID["chapters"][1]["units"][0]]},
    {"id": "1.2b", "section": "1.2", "title": "b", "units": [VALID["chapters"][1]["units"][1]]}]}

def test_split_chapters_take_letters_in_order():
    assert check_units(SPLIT, ["1.1", "1.2"]) == []
    renamed = copy.deepcopy(SPLIT); renamed["chapters"][2]["id"] = "1.2c"
    assert "chapter 1.2c: split chapters of 1.2 must be 1.2a, 1.2b, … in order" in check_units(renamed, ["1.1", "1.2"])
    plain = copy.deepcopy(SPLIT); plain["chapters"][1]["id"] = "1.2"
    assert "chapter 1.2: id must carry a letter when 1.2 has 2 chapters" in check_units(plain, ["1.1", "1.2"])
```

```python
def test_thai_marks_do_not_count_in_titles():  # Review Focus 5
    title = "ที่" * 20  # 40 visible characters, 60 code points
    assert check_units(mutate(lambda d: d["chapters"][1]["units"][0].update(title=title)), ["1.1", "1.2"]) == []

def test_load_units_errors(tmp_path):
    with pytest.raises(UnitsError, match="no unit map at .*units.json: write it at Stage 1, or redo the storyboard"):
        load_units(tmp_path / "units.json")
    (tmp_path / "units.json").write_text("{", encoding="utf-8")
    with pytest.raises(UnitsError, match="units.json is not valid JSON"):
        load_units(tmp_path / "units.json")

def test_helpers():
    assert unit_chapters(VALID) == {"u-init-model": "1.1", "u-tool": "1.2", "u-agent": "1.2"}
    assert list(units_by_id(VALID)) == ["u-init-model", "u-tool", "u-agent"]
    assert [c["id"] for c in chapter_list(VALID)] == ["1.1", "1.2"]
```

  In `tests/test_validate_deck.py`:

```python
def test_plan_mode(course):
    assert [i for i in validate_plan(course, 1) if i.level == "error"] == []

def test_plan_without_units_file(course):  # Review Focus 2
    (course / WORK / "units.json").unlink()
    assert any("no unit map" in i.message and i.where == "units.json" for i in validate_plan(course, 1))

def test_plan_reports_unit_errors(course):
    edit(course / WORK / "units.json", '"needs": ["u-tool"]', '"needs": ["u-nope"]')
    assert any("needs must name earlier units, not u-nope" in i.message for i in validate_plan(course, 1))

def test_cli_plan_flag(course):
    assert run_cli(course, 1, "--plan").returncode == 0
```

- [ ] **Step 3: Run the new tests and check that they fail**

Run: `uv run --no-project --python 3.12 --with pytest pytest skills/teaching/slide-design/tests/test_units.py skills/teaching/slide-design/tests/test_validate_deck.py -q`
Expected: FAIL, with `ModuleNotFoundError: No module named 'units'` and `validate_plan` not importable.

- [ ] **Step 4: Implement**
  - **Constants:** add them to `contract.py`, then copy the file to `react-slides/scripts/contract.py`.
  - **`units.py`:** write the functions above.
    - Count lengths with `mdtext.visible_length`.
    - Check `needs` against the units that came before, in map order, across all chapters.
    - Check `moved_from` against the order of `subtopic_keys`.
    - A chapter's `section` must be in `subtopic_keys`.
  - **`validate_plan`:** it reads `_work/part-NN/units.json`. The Part's sub-topic keys come from `read_part(find_part(...)).subtopics`.
  - **`main`:** accept `--plan` and dispatch to `validate_plan`. Update the usage line and the module docstring.

- [ ] **Step 5: Run both skills' tests and check that they pass**

Run: the slide-design command, then the react-slides Python command.
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add skills/teaching/slide-design skills/teaching/react-slides/scripts/contract.py
git commit -m "feat(slide-design): check a Part's unit map with --plan"
```

---

### Task 2: Shared parser reads `## Units` and infers slide units

**Files:**
- Modify: `skills/teaching/slide-design/scripts/contract.py`, `skills/teaching/slide-design/scripts/deck.py`, then copy both to `skills/teaching/react-slides/scripts/`
- Modify: `skills/teaching/slide-design/tests/test_deck.py`
- Modify: `skills/teaching/react-slides/scripts/deck_reader.py` (template check only)
- Modify: `skills/teaching/react-slides/tests/test_deck_reader.py`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces in `contract.py`:
  - `UNITS_HEADING = "Units"`
  - `DECK_TEMPLATE_IDS = ("slide-design/deck@1", "slide-design/deck@2")`. `DECK_TEMPLATE_ID` stays `deck@1` until Task 4.
- Produces in `deck.py`:
  - `Deck.units: dict | None`. It is `None` when the deck has no `## Units` section.
  - Parsing: a `## Units` section without a ```` ```units ```` block gives the error `(line, "Units: missing the units block")`. Invalid JSON gives `(line, "Units: the units block is not valid JSON (<error>)")`.
  - `slide_units(sections: list[Section]) -> dict[str, str | None]`, mapping each slide id to its unit:
    - A `topic` slide maps to its `meta["unit"]`, and the slides after it in the same section inherit that unit.
    - An `assemble` slide, and every slide after it until the next `topic`, maps to `None`.
    - Each section starts at `None`.
- Produces in `deck_reader.py`: `render_errors` accepts any template in `contract.DECK_TEMPLATE_IDS`.

- [ ] **Step 1: Write the failing tests** in `tests/test_deck.py`. Build the draft text with the existing slide-block conventions: one `### <id> · <layout>` heading, a ```` ```slide ```` block and the fields.

```python
def test_units_section_is_parsed():
    deck = parse_deck(MINIMAL_DECK.replace("## Diagrams", '## Units\n\n```units\n{"chapters": []}\n```\n\n## Diagrams'))
    assert deck.units == {"chapters": []} and deck.errors == []

def test_units_section_without_a_block():
    deck = parse_deck(MINIMAL_DECK.replace("## Diagrams", "## Units\n\n## Diagrams"))
    assert any("Units: missing the units block" in m for _, m in deck.errors)

def test_units_section_with_bad_json():
    deck = parse_deck(MINIMAL_DECK.replace("## Diagrams", "## Units\n\n```units\n{\n```\n\n## Diagrams"))
    assert any("Units: the units block is not valid JSON" in m for _, m in deck.errors)

def test_deck_without_units_section_has_none():
    assert parse_deck(MINIMAL_DECK).units is None

def test_slide_units_follow_topics_and_reset_at_assembly():
    sections, _ = parse_sections(draft("1.2", [("1-001", "topic", {"unit": "u-a"}), ("1-002", "explain", {}),
                                              ("1-003", "topic", {"unit": "u-b"}), ("1-004", "code", {}),
                                              ("1-005", "assemble", {}), ("1-006", "compare", {})]))
    assert slide_units(sections) == {"1-001": "u-a", "1-002": "u-a", "1-003": "u-b", "1-004": "u-b", "1-005": None, "1-006": None}

def test_slide_units_follow_split_ids():  # Review Focus 3
    sections, _ = parse_sections(draft("1.2", [("1-001", "topic", {"unit": "u-a"}), ("1-001a", "code", {})]))
    assert slide_units(sections) == {"1-001": "u-a", "1-001a": "u-a"}

def test_slide_units_reset_per_section():
    text = draft("1.1", [("1-001", "topic", {"unit": "u-a"})]) + "\n\n" + draft("1.2", [("1-002", "explain", {})])
    sections, _ = parse_sections(text)
    assert slide_units(sections)["1-002"] is None
```

  - `MINIMAL_DECK` is the smallest deck text `parse_deck` accepts: frontmatter, `# Part 1: …`, `## Deck notes`, `## Opening` with one slide, `## Diagrams` and `## Code listings`. Use the shapes `test_deck.py` already has where it can.
  - `draft(key, rows)` writes `## <key> T` and one slide per row. The fields are `**Title:** t` and `**Body:** b`, and the slide block is `{"layout": layout, "purpose": "p", "from": [], "sources": [], **meta}`.

  In `react-slides/tests/test_deck_reader.py`, rewrite `test_wrong_templates_are_refused` against the part 2 deck (`slides/part-02-graphs.md`), which stays `deck@1` for the rest of the plan:
  - Part 2 as it is loads with `deck_reader.load(course, 2)`.
  - With its template replaced by `"slide-design/deck@9"`, it raises `DeckError` naming `slide-design/deck@1` and `slide-design/deck@2`.

- [ ] **Step 2: Run the new tests and check that they fail**

Run: `uv run --no-project --python 3.12 --with pytest pytest skills/teaching/slide-design/tests/test_deck.py -q`
Expected: FAIL. `slide_units` is not defined, and `Deck` has no `units`.

- [ ] **Step 3: Implement**
  - **`parse_deck`:** handle `UNITS_HEADING` next to `DIAGRAMS_HEADING`, taking the first ```` ```units ```` block in the section.
  - **`slide_units`:** add it to `deck.py`. Update the module docstring to name `deck@2`.
  - **Copy:** copy `contract.py` and `deck.py` to `react-slides/scripts/`.
  - **`deck_reader.render_errors`:** check `template in contract.DECK_TEMPLATE_IDS`. The message lists both accepted ids.

- [ ] **Step 4: Run both skills' tests and check that they pass**

Run: the slide-design command and the react-slides Python command.
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add skills/teaching/slide-design/scripts skills/teaching/slide-design/tests skills/teaching/react-slides/scripts skills/teaching/react-slides/tests
git commit -m "feat(slide-design): parse a deck's unit map and infer each slide's unit"
```

---

### Task 3: The `map`, `topic` and `assemble` layouts, rendered by react-slides

This task is one deliverable because the shared `contract.LAYOUTS` drives `react-slides`' layout-coverage fixture test and its end-to-end compile. Adding a layout without its component breaks both.

**Files:**
- Modify: `skills/teaching/slide-design/scripts/contract.py`, then copy it to react-slides
- Modify: `skills/teaching/slide-design/references/deck-template.md`, covering:
  - the layouts table
  - the limits table
  - the slide-block keys
  - a new "Units" subsection for the `## Units` block format and the `assemble` labels
- In `skills/teaching/react-slides/`, modify:
  - **scripts:** `scripts/deck_reader.py`, `scripts/tsx_writer.py`
  - **components:** under `template/src/components/`: `types.ts`, `Deck.tsx`, `SlideFrame.tsx`, `layouts.tsx`, `code.tsx`, `Visual.tsx`, `diagram/Diagram.tsx` and `index.ts`
  - **template support:** `template/src/strings.ts`, and `template/src/__fixtures__/typecheck.tsx` if it lists components
  - **docs:** `references/components.md`, `SKILL.md`
- Create: `skills/teaching/react-slides/template/src/components/units.ts`, `units.test.ts`
- Tests to update:
  - Python: `tests/test_deck_reader.py`, `tests/test_tsx_writer.py`, `tests/test_fixture.py`
  - TS: `layouts.test.tsx`, `code.test.tsx`, `diagram/Diagram.test.tsx`, `Deck.test.tsx`
- Fixture: `tests/fixtures/courses/langchain-agents/slides/part-01-first-agent.md`. It becomes `deck@2`, and part 02 stays `deck@1`.

**Interfaces:**
- Consumes: `Deck.units`, `slide_units` and `DECK_TEMPLATE_IDS` (Task 2). `PART_ASSEMBLY` (Task 1).
- Produces in `contract.py`:
  - `LAYOUTS["map"] = Layout(("Title",), ("Body",), "none", "none")`
  - `LAYOUTS["topic"] = Layout(("Title", "Body"), (), "optional", "none")`
  - `LAYOUTS["assemble"] = Layout(("Title", "Body"), ("Notice",), "optional", "assembly")`
  - `LAYOUT_META_KEYS["topic"] = ("unit",)`
  - `LAYOUT_META_KEYS["assemble"] = ("assembles", "labels", "snippet", "lines")`
  - `FIELD_LIMITS` entries `("map", "Body"): 120`, `("topic", "Body"): 120` and `("assemble", "Body"): 300`
  - `UNIT_LAYOUTS = ("map", "topic", "assemble")`, the layouts that need `deck@2`
- Produces in `tsx_writer.py`:
  - `COMPONENTS["map"] == "MapSlide"`, `COMPONENTS["topic"] == "Topic"`, `COMPONENTS["assemble"] == "Assemble"`
  - `GENERATOR_VERSION = 2`
  - Every slide with a unit gets the prop `unit="<id>"`.
  - `assemble` gets `assembles`, `labels` and, when present, `snippet` and `lines`.
  - `part_data_ts` exports `units: Units`, which is the deck's map, or `{"chapters": []}` for `deck@1`. It keeps only the keys `id`, `section`, `title` and `units`, and per unit `id`, `title`, `goal` and `needs`.
  - `part_tsx` passes `units={units}` to `<Deck>`.
- Produces in TS `types.ts`:
  - `UnitDef = { id: string; title: string; goal: string; needs: string[] }`
  - `ChapterDef = { id: string; section: string; title: string; units: UnitDef[] }`
  - `Units = { chapters: ChapterDef[] }`
  - `AssemblyLabel = { unit?: string; chapter?: string; lines?: Range[]; elements?: string[] }`
  - `Base` gains `unit?: string`.
- Produces in TS `units.ts`: `unitPosition(units: Units, id: string): { chapter: ChapterDef; unit: UnitDef; n: number; m: number } | null`, with `n` 1-based within the chapter.
- Produces in TS `Deck.tsx`: `Deck` takes an optional `units?: Units`, defaulting to `{ chapters: [] }`. `DeckValue` gains `units: Units`.
- Produces in TS `layouts.tsx`, all exported from `index.ts`:
  - `MapSlide(props: Base & { title: Rich; body?: Rich })`. It lists every chapter and its units from `useDeck().units`.
  - `Topic(props: Base & { unit: string; title: Rich; body: Rich; visual?: Visual })`. It shows `t(language, 'unit')` with `{n}`/`{m}` filled in, the title and the body. Under them comes the chapter's unit list, each `<li data-unit-state="done|current|todo">`.
  - `Assemble(props: Base & { title: Rich; body: Rich; notice?: Rich; assembles: string; labels: AssemblyLabel[]; snippet?: string; lines?: Range[]; visual?: Visual })`.
    - **Code:** a `CodeBlock` with `groups`.
    - **Diagram:** a `VisualSlot` with `labels`.
    - **Both:** a legend `<ol className="rs-assembly-legend">`, one `<li>` per label, numbered from 1. Each names its unit's title, or its chapter's title for `"part"`.
- Produces in TS `code.tsx`: `CodeBlock` gains `groups?: { n: number; lines: Range[] }[]`. Rows inside a group carry `data-group={n}`, and the group's first row shows the number in the gutter.
- Produces in TS `Visual.tsx` and `Diagram.tsx`: an optional `labels?: { n: number; elements: string[] }[]`. Each labelled element's `<g data-el>` carries `data-label={n}`, and the drawing shows the number by the group.
- Produces in TS `strings.ts`: the key `unit`, with en `'Unit {n}/{m}'` and th `'เรื่อง {n}/{m}'`.
- Produces in TS `SlideFrame.tsx`: when `slide.unit` resolves through `unitPosition`, the topline reads `Part {part} · {section} · {unit string} {unit title}`. Otherwise it is unchanged.
- **Look:** the look of the three layouts is the builder's call (spec §7). Keep the existing style: white, hand-drawn lines and Mali. Use no `data-field` on generated chrome, such as the unit list, the legend or the kicker. Only the deck's fields carry `data-field`, so the verbatim check stays exact.

- [ ] **Step 1: Update the react-slides fixture deck** `part-01-first-agent.md` to `deck@2`.
  - **Template:** set the template to `"slide-design/deck@2"`.
  - **`## Units`:** add a section before `## Diagrams`, with these chapters:
    - chapter `1.1` (title `รู้จัก agent`): unit `u-what-agent`, title `agent คืออะไร`, goal `บอกได้ว่า agent ต่างจากการเรียกโมเดลครั้งเดียวอย่างไร`
    - chapter `1.2` (title `สร้าง agent ที่เรียก tool`):
      - unit `u-declare-tool`, title `ประกาศ tool`, goal `ประกาศ tool ด้วย @tool`
      - unit `u-run-agent`, title `เรียก agent`, goal `สร้าง agent แล้วอ่านคำตอบ`, needs `["u-declare-tool"]`
  - **Insert new slides, and move no existing slide:**
    - a `map` slide after `1-001`
    - a `topic` slide first in each sub-topic section, whose Title and Body equal its unit's title and goal
    - a second `topic` (`u-run-agent`) in `1.2`, just before the old `1-012`
    - an `assemble` code slide right after the old `1-012`, with the slide block `"assembles": "1.2", "snippet": "1.2-a", "lines": [[1, 11]], "labels": [{"unit": "u-declare-tool", "lines": [[4, 8]]}, {"unit": "u-run-agent", "lines": [[10, 11]]}]`, and lines 1–11 of `1.2-a` as its block
    - an `assemble` diagram slide with `"assembles": "part"` first in `## Closing`, labelling chapters `1.1` and `1.2` on the core diagram
  - **Renumber:** renumber ids and `revisit` pointers. Old→new: 001→001, 002→003, 003→004, 004→005, 005→007, 006→008, 007→009, 008→010, 009→011, 010→013, 011→014, 012→016, 013→018, 014→019, 015→020, 016→021, 017→023, 018→024, 019→025.
  - **Count:** set `slide_count: 25`.
  - **Format:** write the Units block as `json.dumps(…, ensure_ascii=False, indent=2)` would, which is the assembler's format. In each new slide block, put `layout, purpose, from, sources` first and the layout keys after, so the test strings below occur exactly once.
  - **Tests:** update every slide id the react-slides Python tests name, using the same mapping.

- [ ] **Step 2: Write the failing Python tests**

```python
# test_fixture.py
def test_part_one_uses_every_layout_and_visual_kind():  # unchanged body; now needs map, topic and assemble too
    ...
def test_part_two_is_deck_at_1():
    assert _meta(2)["template"] == "slide-design/deck@1" and _deck(2).units is None

# test_deck_reader.py
PART2 = "slides/part-02-graphs.md"

def test_deck_at_1_loads_without_units(course):  # Review Focus 1
    assert deck_reader.load(course, 2).deck.units is None

def test_deck_at_1_refuses_new_layouts(course):  # Review Focus 1
    text = (course / PART2).read_text(encoding="utf-8")
    head = text.index("### 2-002 · explain")
    rest = text[head:].replace("### 2-002 · explain", "### 2-002 · topic", 1).replace('"layout": "explain"', '"layout": "topic", "unit": "u-x"', 1)
    (course / PART2).write_text(text[:head] + rest, encoding="utf-8")
    with pytest.raises(deck_reader.DeckError, match="a topic slide needs slide-design/deck@2"):
        deck_reader.load(course, 2)

def test_deck_at_2_needs_units(course):
    replace(course / PART2, '"slide-design/deck@1"', '"slide-design/deck@2"')
    with pytest.raises(deck_reader.DeckError, match="Units: a deck@2 deck needs its unit map"):
        deck_reader.load(course, 2)

@pytest.mark.parametrize("old,new,message", [
    ('"unit": "u-what-agent"}', '"unit": "u-nope"}', "topic unit 'u-nope' is not in Units"),
    ('"assembles": "part"', '"assembles": "9.9"', "assembles '9.9' is not a chapter in Units"),
    ('"lines": [[10, 11]]}', '"lines": [[90, 91]]}', "label lines [[90, 91]] are not inside the shown lines"),
])
def test_unit_render_errors(course, old, new, message):
    replace(course / "slides/part-01-first-agent.md", old, new)
    with pytest.raises(deck_reader.DeckError, match=re.escape(message)):
        deck_reader.load(course, 1)
```

  `test_deck_reader.py` needs `import re` for `re.escape`.

```python
# test_tsx_writer.py
def test_new_layouts_get_their_components():
    assert (tsx_writer.COMPONENTS["map"], tsx_writer.COMPONENTS["topic"], tsx_writer.COMPONENTS["assemble"]) == ("MapSlide", "Topic", "Assemble")

def test_slides_in_a_unit_carry_it(course):
    tsx = tsx_writer.part_tsx(deck_reader.load(course, 1), 1)
    assert 'unit="u-run-agent"' in tsx and "units={units}" in tsx

def test_units_travel_as_data(course):  # Review Focus 5
    replace(course / "slides/part-01-first-agent.md", '"title": "เรียก agent"', '"title": "a {b} <c>"')
    replace(course / "slides/part-01-first-agent.md", "**Title:** เรียก agent", "**Title:** a {b} <c>")
    loaded = deck_reader.load(course, 1)
    assert '"title": "a {b} <c>"' in tsx_writer.part_data_ts(loaded, 1)
    assert "a {b} <c>" not in tsx_writer.part_tsx(loaded, 1).replace('{"a {b} <c>"}', "")  # the Title field is quoted as a string expression

def test_assemble_props(course):
    tsx = tsx_writer.part_tsx(deck_reader.load(course, 1), 1)
    assert 'assembles="1.2"' in tsx and "labels={[" in tsx and 'assembles="part"' in tsx
```

- [ ] **Step 3: Write the failing TS tests**
  - **`layouts.test.tsx`:** add `MapSlide`, `Topic` and `Assemble` cases and change the count to `19`. `DeckFixture` must pass a small `units` value; extend `__fixtures__/DeckFixture.tsx` to accept `units`. Then:
    - `test('topic shows its position and marks units done, current and to come')`: for a chapter of three units with the slide on unit 2, the page has the text `เรื่อง 2/3` and the states `['done', 'current', 'todo']` in order.
    - `test('assemble labels its code lines and lists the units')`: rows 5–8 carry `data-group="1"`, and the legend lists the unit titles in label order.
    - `test('a part assembly lists chapter titles')`
  - **`units.test.ts`:** `unitPosition` returns `{n: 2, m: 3}` for the middle unit, and `null` for an unknown id.
  - **`Deck.test.tsx`:** a slide with `unit` shows `Part 1 · 1.2 … · เรื่อง 1/2 <title>` in `.rs-topline`. A slide without one shows the topline as before.
  - **`Diagram.test.tsx`:** labelled elements carry `data-label`.
  - **`code.test.tsx`:** without `groups`, no row carries `data-group`.

- [ ] **Step 4: Run all react-slides tests and check that they fail**

Run: the react-slides template command and the react-slides Python command.
Expected: FAIL. The new components are missing, the contract has no new layouts, and the fixture uses unknown layouts.

- [ ] **Step 5: Implement the contract, `deck-template.md` and the copy**
  - **`contract.py`:** add the values listed under Interfaces.
  - **`deck-template.md`:** document the three layouts, their limits, the `unit`/`assembles`/`labels` keys, the `## Units` block format and the label rules (spec §5.4). `slide-design/tests/test_references.py::test_deck_template_names_the_whole_contract` must keep passing.
  - **Copy:** copy `contract.py` to react-slides.

- [ ] **Step 6: Implement `deck_reader.py`**
  - **Content blocks:** add `"assembly"` to `BLOCK_CONTENT`.
  - **`deck@1`:** a `UNIT_LAYOUTS` slide in a `deck@1` deck gives `f"a {layout} slide needs slide-design/deck@2"`.
  - **`deck@2` without units:** a `deck@2` deck without a parsed `units` dict gives `"Units: a deck@2 deck needs its unit map"`.
  - **`topic`:** the `unit` must be a unit in `deck.units`.
  - **`assemble`:**
    - `assembles` must be a chapter id or `"part"`.
    - `labels` must be a non-empty list of dicts, each naming a known unit or chapter.
    - With `snippet`: run the existing `_code` excerpt check on it, generalised to `assemble`. Label `lines` must lie inside the shown lines.
    - With a diagram visual: label `elements` must be known elements of that diagram.

- [ ] **Step 7: Implement `tsx_writer.py`** as listed under Interfaces.
  - Get each slide's unit from `deck.slide_units(d.sections)`.
  - Bump `GENERATOR_VERSION` to 2.

- [ ] **Step 8: Implement the TS side** as listed under Interfaces.
  - **`index.ts`:** export `MapSlide`, `Topic` and `Assemble`.
  - **Styles:** add CSS for `.rs-unit-map`, `.rs-part-map`, `.rs-assembly-legend` and the code-group gutter mark, in the template's existing stylesheet.

- [ ] **Step 9: Update the docs**
  - **`references/components.md`:**
    - add the three components and their props
    - say a slide's `unit` prop drives the header
    - say `deck@1` decks render without units
  - **`SKILL.md`:**
    - the input becomes `slide-design/deck@2`, and `deck@1` is still read
    - "one slide of each layout" covers the new three
  - **Tests:** `test_references.py::test_components_md_lists_every_component` must pass, and it now includes `MapSlide`, `Topic` and `Assemble`.

- [ ] **Step 10: Run all tests of both skills and check that they pass**

Run: the slide-design command, the react-slides template command (`ci`, `test`, `build`) and the react-slides Python command, which includes `test_app_build.py`.
Expected: all pass, with the end-to-end build not skipped.

- [ ] **Step 11: Commit**

```bash
git add skills/teaching/slide-design/scripts/contract.py skills/teaching/slide-design/references/deck-template.md skills/teaching/react-slides
git commit -m "feat(react-slides): render deck@2 map, topic and assemble slides and the unit header"
```

---

### Task 4: The assembler writes `deck@2`, and the fixture is migrated

**Files:**
- Modify: `skills/teaching/slide-design/scripts/contract.py` (`DECK_TEMPLATE_ID = "slide-design/deck@2"`), then copy it to react-slides
- Modify: `skills/teaching/slide-design/scripts/assemble_deck.py`
- Modify: `skills/teaching/slide-design/scripts/validate_deck.py` (`_headings` only)
- Modify: `skills/teaching/slide-design/references/deck-template.md` (template id, body order, the `### Part ordering problems` list)
- Modify the fixture drafts: `skills/teaching/slide-design/tests/fixtures/course/slides/_work/part-01/sections/{opening,1.1,1.2,closing}.md`
- Modify tests: `skills/teaching/slide-design/tests/test_assemble_deck.py`, `test_validate_deck.py`, `test_diagram_checks.py`, `test_deck.py`, and any other test that names a fixture deck id

**Interfaces:**
- Consumes: `load_units` and `UnitsError` (Task 1). The new layouts (Task 3).
- Produces in `assemble_deck.py`:
  - It reads `_work/part-NN/units.json` with `load_units`. A `UnitsError` becomes an `AssembleError` with the same message.
  - **Units section:** it writes `## Units` before `## Diagrams` as ```` ```units ```` + `json.dumps(data, ensure_ascii=False, indent=2)`.
  - **Part ordering problems:** after `### Code status` in the deck notes, it writes `### Part ordering problems`. That is one line per moved unit, `- <unit id> (<unit title>): from <moved_from> to <chapter id>: <reason>`, or `_None._`.
  - **Snippets:** it counts snippets on `assemble` slides as referenced.
- Produces in `validate_deck._headings`: the expected order is Deck notes, Opening, the sub-topics, Closing, Units, Diagrams, Code listings.

- [ ] **Step 1: Rewrite the fixture drafts to this final deck order.** Write new draft ids freely, but keep exactly one split id inside a unit: the second `1.1` code slide is drafted `1-010a`, as before. Keep every existing slide's text unless an item below says otherwise.

| deck id | section | layout | what |
|---|---|---|---|
| 001–002 | opening | cover, focus | unchanged |
| 003 | opening | map | Title `เส้นทางของ Part นี้`, from `["Objectives"]` |
| 004–007 | opening | objectives, setup, terms, steps | unchanged |
| 008 | 1.1 | topic | unit `u-init-model`, Title and Body equal to the map, from `["1.1/Core knowledge"]` |
| 009–016 | 1.1 | explain, code, code (split), output, compare, error, question, answer | old 007–014 |
| 017 | 1.2 | topic | unit `u-tool`, from `["1.2/Worked example"]` |
| 018 | 1.2 | code | old 018 (the `@tool` lines) |
| 019 | 1.2 | error | old 023 (docstring) |
| 020 | 1.2 | topic | unit `u-agent`, from `["1.2/Core knowledge"]` |
| 021–023 | 1.2 | explain ×3 | old 015–017 |
| 024 | 1.2 | code | old 019 (`create_agent` lines) |
| 025 | 1.2 | explain | old 021 (analogy) |
| 026 | 1.2 | assemble | `"assembles": "1.2"`, snippet `1.2-a`, `"lines": [[1, 13]]`, labels `[{"unit": "u-tool", "lines": [[5, 8]]}, {"unit": "u-agent", "lines": [[11, 13]]}]`, the block is lines 1–13 verbatim, from `["1.2/Worked example"]` |
| 027–030 | 1.2 | output, compare, question, answer | old 020, 022, 024, 025; the answer's `revisit` points at deck 018 |
| 031 | closing | assemble | `"assembles": "part"`, a diagram visual of `d-agent-loop` showing every node and edge, labels `[{"chapter": "1.1", "elements": ["n-model"]}, {"chapter": "1.2", "elements": ["n-tool", "e-call", "e-result"]}]`, from `["Core mental model"]` |
| 032–035 | closing | summary, practice, focus, sources | old 026–029 |

  - **Diagrams:** fix every diagram `new` list that the validator then reports. Inserting slides changes what each slide adds over the one before.
  - **Old→new deck ids** for the test updates: 001→001, 002→002, 003→004, 004→005, 005→006, 006→007, 007→009, 008→010, 009→011, 010→012, 011→013, 012→014, 013→015, 014→016, 015→021, 016→022, 017→023, 018→018, 019→024, 020→027, 021→025, 022→028, 023→019, 024→029, 025→030, 026→032, 027→033, 028→034, 029→035. The `slide_count` becomes 35.

- [ ] **Step 2: Write the failing tests** in `test_assemble_deck.py`.

```python
def test_deck_is_deck_at_2_with_its_units(course, assembled):
    deck = parse_deck(assembled.read_text(encoding="utf-8"))
    assert deck.meta["template"] == "slide-design/deck@2"
    assert deck.units == json.loads((course / WORK / "units.json").read_text(encoding="utf-8"))
    assert deck.headings[-3:] == ["Units", "Diagrams", "Code listings"]

def test_part_ordering_problems_list_moved_units(course):
    edit(course / WORK / "units.json", '"needs": []}]}', '"needs": [], "moved_from": "1.2", "reason": "1.1 needs it"}]}', first=True)
    text = assemble(course, 1, today="2026-11-30").read_text(encoding="utf-8")
    assert "### Part ordering problems\n- u-init-model (สร้างโมเดลจากชื่อ): from 1.2 to 1.1: 1.1 needs it" in text

def test_no_moves_writes_none(assembled):
    assert "### Part ordering problems\n_None._" in assembled.read_text(encoding="utf-8")

def test_missing_units_file_is_named(course):  # Review Focus 2
    (course / WORK / "units.json").unlink()
    with pytest.raises(AssembleError, match="units.json: write it at Stage 1, or redo the storyboard"):
        assemble(course, 1, today="2026-11-30")

def test_assemble_snippets_are_listed(assembled):
    assert "### 1.2-a" in assembled.read_text(encoding="utf-8")
```

  Update the existing tests to the new ids with the mapping. In `test_validate_deck.py`:
  - `'slide_count: 29'` becomes `'slide_count: 35'`.
  - The `revisit` mutation targets the new answer ids.
  - `test_assembled_fixture_is_valid` must hold with no errors and no warnings.

- [ ] **Step 3: Run the slide-design tests and check that they fail**

Run: the slide-design command.
Expected: FAIL. The template is still `deck@1` and the deck has no Units section.

- [ ] **Step 4: Implement**
  - **Contract:** set `DECK_TEMPLATE_ID` and copy `contract.py` to react-slides.
  - **Assembler:** make the changes listed under Interfaces.
  - **Validator:** update the `_headings` expected order.
  - **`deck-template.md`:** update the frontmatter `template` row, the "Body, in order" list (Units before Diagrams) and the deck notes' three generated lists.
  - **Assembler docstring:** update it to `deck@2`.

- [ ] **Step 5: Run both skills' tests and check that they pass**

Run: the slide-design command and the react-slides Python command.
Expected: all pass. `test_assembled_fixture_is_valid` reports no errors and no warnings.

- [ ] **Step 6: Commit**

```bash
git add skills/teaching/slide-design skills/teaching/react-slides/scripts/contract.py
git commit -m "feat(slide-design): assemble deck@2 with the unit map and Part ordering problems"
```

---

### Task 5: The validator enforces the unit structure

**Files:**
- Create: `skills/teaching/slide-design/scripts/unit_checks.py`
- Create: `skills/teaching/slide-design/tests/test_unit_checks.py`
- Modify: `skills/teaching/slide-design/scripts/validate_deck.py`, covering:
  - the deck's Units issues
  - the structure issues
  - the moved-unit `from` rule
  - `assemble` code fidelity
  - coverage of `assemble` snippets
- Modify: `skills/teaching/slide-design/scripts/diagram_checks.py` (the epitome exception)
- Modify: `skills/teaching/slide-design/tests/test_validate_deck.py`, `test_diagram_checks.py`

**Interfaces:**
- Consumes: `check_units`, `units_by_id`, `unit_chapters` and `chapter_list` (Task 1). `slide_units` and `Section` (Task 2). `PART_ASSEMBLY` (Task 1).
- Produces in `unit_checks.py`: `check_structure(sections: list[Section], units: dict) -> list[tuple[str, str]]`, giving `(where, message)`.
  - `where` is a slide id, or `"deck"` for a rule that belongs to no one slide. The message does not repeat the id; `validate_deck` prints `"<where>: <message>"`.
  - It assumes `check_units(units, …) == []`.
  - It checks the rules below, written as `where` → `message`. Tests pin the messages.
  - **The opening and placement:**
    - The opening has exactly one `map` slide: `deck` → `"the opening needs exactly one map slide"`.
    - There is no `map` elsewhere, and no `topic` in the opening or the closing: id → `"a <layout> slide does not belong in <section heading>"`.
  - **Sub-topic sections:** every one starts with a `topic` slide: first id → `"a sub-topic section starts with a topic slide"`.
  - **`topic` slides:** they appear once per unit, in map order, each in its chapter's section.
    - A slide out of order: id → `"expected unit <uid> here, in unit-map order"`.
    - A missing unit: `deck` → `"unit <uid> has no topic slide"`.
    - A wrong Title: id → `"topic title must equal the unit title"`.
    - A wrong Body: id → `"topic body must equal the unit goal"`.
  - **Chapter `assemble` slides:**
    - `assembles` equals the chapter of the last `topic`: id → `"assembles <x>, but the current chapter is <c>"`.
    - A `topic` of the same chapter may not follow its assembly: id → `"a chapter's assemble slides come after its last unit"`.
    - A chapter of two or more units without one: `deck` → `"chapter <c> has <n> units and needs an assemble slide"`.
    - A single-unit chapter with one: id → `"chapter <c> has one unit and takes no assemble slide"`.
  - **Labels:**
    - **Coverage:** the labels of a chapter's assemble slides together name every non-moved unit of the chapter: `deck` → `"chapter <c>: assembly does not label <uid>"`.
    - **Scope:** a label names a unit of this chapter or an earlier chapter of the same section: id → `"label names <uid> from a later chapter"`, or `"label names <uid> from another section"`.
    - **Lines:** code labels use `lines` inside the shown `lines`, ascending and non-overlapping across labels: id → `"label lines must lie inside the shown lines"`, or `"label ranges overlap"`.
    - **Elements:** diagram labels use `elements`, all within the visual's `show`: id → `"label elements must be shown"`.
    - **Exclusivity:** an `assemble` slide has either `snippet` with one code block and no visual, or a diagram visual and no `snippet`: id → `"an assemble slide shows code or a diagram, not both"`, or `"an assemble slide shows code or a diagram, and has neither"`.
  - **The closing:**
    - It has at least one `assemble` with `"part"`: `deck` → `"the closing needs an assemble slide for the whole Part"`.
    - Its labels are `{"chapter", "elements"}` on a diagram and name every chapter: id → `"the Part assembly does not label chapter <c>"`.
    - `"part"` is allowed only in the closing: id → `"a Part assembly belongs in the closing"`.
- Produces in `validate_deck.py`:
  - `_meta(slide, source, earlier, moved_from: str | None)` allows a sub-topic ref from `moved_from`.
  - `_code` runs on `assemble` slides that have a `snippet`. It runs the same language, excerpt and Notice checks as `code`, and its `highlight` is optional.
  - `_coverage` counts `assemble` snippets.
  - **Wiring in `validate()`:**
    - When `deck.units` is `None`: `_error("deck", "a deck@2 deck needs its Units section")`.
    - Otherwise: `check_units` issues with `where="units"`. When there are none, also `check_structure` issues.
- Produces in `diagram_checks.check_states`: the epitome exception. A slide in section `"opening"` that is a diagram's first appearance, with `new == []`, a non-empty `show` and `set(dim) == set(show)`, raises no `new` mismatch. Later slides compute `new` against its `show`.

- [ ] **Step 1: Write the failing tests**
  - **`tests/test_unit_checks.py`:** use synthetic drafts built with a `draft(key, rows)` helper like Task 2's, plus a `units_map(...)` builder. Cover each rule above with one test asserting its exact message. Include:

```python
def test_label_scope_in_split_chapters():  # Review Focus 4
    units = units_map({"1.2a": ["u-a", "u-b"], "1.2b": ["u-c", "u-d"]})  # both chapters in section 1.2
    rows = [topic("u-a"), topic("u-b"), assemble("1.2a", ["u-a", "u-b"]),
            topic("u-c"), topic("u-d"), assemble("1.2b", ["u-a", "u-b", "u-c", "u-d"])]
    assert check_structure(deck_sections(rows), units) == []
    rows[2] = assemble("1.2a", ["u-a", "u-b", "u-c"])
    assert ("1-102", "label names u-c from a later chapter") in check_structure(deck_sections(rows), units)

def test_moved_unit_is_exempt_from_coverage(): ...   # a moved unit left out of its chapter's labels → no error
def test_single_unit_chapter_takes_no_assembly(): ... # ("1-101", "chapter 1.2 has one unit and takes no assemble slide")
def test_part_assembly_must_label_every_chapter(): ... # the closing's assembly labels only 1.2a → ("1-201", "the Part assembly does not label chapter 1.2b")
```

  The helpers stay in the test module:
  - **`units_map(chapters: dict[str, list[str]])`:** it builds a valid map with all chapters in section `1.2`. Titles equal the unit ids, and goals are `"g"`.
  - **`topic(uid)` and `assemble(chapter, uids, *, code=True)`:**
    - They return `(layout, meta, fields)` rows. The topic fields match `units_map`.
    - A code assembly uses a fixed 6-line snippet text, labels one line per unit, and is checked structurally only.
  - **`deck_sections(rows)`:**
    - It builds three sections, via `parse_sections` on generated draft text: `## Opening`, holding `1-001 map`; `## 1.2 T`, numbering the rows `1-100`, `1-101`, …; and `## Closing`, holding `1-201`, a diagram `"part"` assembly that labels every chapter in the map.
    - It also writes a one-node diagram in the visual so `elements` checks have something to point at.

  - **`tests/test_validate_deck.py`:** one mutation per wiring point on the deck@2 fixture.

```python
@pytest.mark.parametrize("old,new,message", [
    ('"assembles": "1.2", ', '"assembles": "1.1", ', "1-026: assembles 1.1, but the current chapter is 1.2"),
    ('"lines": [[5, 8]]', '"lines": [[5, 12]]', "1-026: label ranges overlap"),
    ('"lines": [[1, 13]], "labels"', '"lines": [[1, 9]], "labels"', "1-026: code excerpt differs from snippet 1.2-a"),
    ('"title": "ประกาศ tool"', '"title": "ประกาศ tools"', "1-017: topic title must equal the unit title"),
])
def test_unit_mutations_are_caught(course, assembled, old, new, message):
    edit(assembled, old, new, first=True)
    assert any(message in e for e in errors(course)), errors(course)

def test_missing_units_section(course, assembled):
    text = assembled.read_text(encoding="utf-8")
    start, end = text.index("## Units"), text.index("## Diagrams")
    assembled.write_text(text[:start] + text[end:], encoding="utf-8")
    assert any("deck: a deck@2 deck needs its Units section" in e for e in errors(course))

def test_moved_unit_may_use_its_origin_refs(course, assembled):
    edit(assembled, '"needs": []', '"needs": [],\n      "moved_from": "1.2",\n      "reason": "r"', first=True)  # u-init-model
    set_meta(assembled, "1-009", "from", ["1.2/Core knowledge"])
    assert not any("content from 1.2 in section 1.1" in e for e in errors(course))

def test_origin_refs_without_a_move_are_refused(course, assembled):
    set_meta(assembled, "1-009", "from", ["1.2/Core knowledge"])
    assert any("1-009: content from 1.2 in section 1.1" in e for e in errors(course))
```

  - **`tests/test_diagram_checks.py`:**

```python
def test_epitome_in_the_opening_needs_no_new(): ...      # first appearance, all dimmed, new [] → no error
def test_epitome_outside_the_opening_is_refused(): ...   # same state in section "1.1" → the `new` mismatch error
def test_first_appearance_not_all_dimmed_needs_new(): ...  # new [] and dim ⊂ show → error
```

- [ ] **Step 2: Run the slide-design tests and check that they fail**

Run: the slide-design command.
Expected: FAIL. There is no `unit_checks` module, and the mutations are not caught.

- [ ] **Step 3: Implement** `unit_checks.py`, the `validate_deck.py` wiring and the epitome exception, as listed under Interfaces. Update `validate_deck.py`'s module docstring to `deck@2`.

- [ ] **Step 4: Run both skills' tests and check that they pass**

Run: the slide-design command and the react-slides Python command.
Expected: all pass, and the fixture still validates with no errors and no warnings.

- [ ] **Step 5: Commit**

```bash
git add skills/teaching/slide-design
git commit -m "feat(slide-design): enforce units, dividers and assemblies in deck@2"
```

---

### Task 6: Briefs, SKILL.md and acceptance checks

**Files:**
- In `skills/teaching/slide-design/`, modify:
  - `SKILL.md`
  - the references: `references/storyboard.md`, `references/visuals.md`, `references/section-writer.md`, `references/learner-review.md`, `references/deck-template.md` (only the filled example)
  - `evals/acceptance.md`
  - the tests: `tests/test_references.py`, `tests/test_skill_md.py`

**Interfaces:**
- Consumes: the file names, flags and layouts from Tasks 1–5.
- Produces: briefs that carry spec §5.2, §5.3 and §5.7–§5.9. The tests below pin the needles.

- [ ] **Step 1: Write the failing tests.** Extend the `test_briefs_carry_their_rules` parameters:

```python
("storyboard.md", [..., "units.json", "--plan", "moved_from", "two to six units", "Part ordering problems", "`topic`", "`assemble`", "`map`", "needs"]),
("visuals.md", [..., "decorative", "sketchable", "assemble", "one diagram per chapter"]),
("section-writer.md", [..., "within a unit", "never reorder units", "`topic`", "`assemble`", "moved unit"]),
("learner-review.md", [..., "unsure which unit", "assembly that introduces", "decorative", "far from its explanation"]),
```

  In `test_skill_md.py`, add `"--plan"`, `"units.json"`, `"Part ordering problems"` and `"unit map"` to the `test_mentions_every_script_and_flag` needles. Then add:

```python
def test_unit_map_rules_after_the_gate(skill_md):
    assert "inside one chapter" in skill_md and "never after the gate" in skill_md

def test_acceptance_lists_the_unit_checks(skill_dir):
    text = (skill_dir / "evals" / "acceptance.md").read_text(encoding="utf-8")
    assert [n for n in ("unit map", "topic slide", "assemble slide", "Part assembly", "moved unit") if n not in text] == []
```

  `test_deck_template_example_parses` must also see a `topic` slide in the example: assert that `"topic" in {s.layout for s in sections[0].slides}`.

- [ ] **Step 2: Run the slide-design tests and check that they fail**

Run: the slide-design command.
Expected: FAIL, listing the missing needles.

- [ ] **Step 3: Write the briefs**
  - **`storyboard.md`:**
    - Stage 1 writes `units.json` first, using spec §5.2's finding, ordering and moving rules: "two to six units" per chapter, splitting chapters, `needs` pointing backwards, and `moved_from` with a reason.
    - It runs `validate_deck.py … --plan`.
    - The new deck shape (§5.3) replaces the old per-sub-topic default order. Each storyboard table gets a `unit` column.
    - The gate presents the unit map first (§5.8).
    - When a unit moves, the brief says to add the one `skill-problems.md` line (§5.2).
  - **`visuals.md`:** apply §5.7.
    - A visual must show, organise or interpret, and decorative pictures are banned.
    - Illustrations are for concrete things from the Part, and must be sketchable. Remove the "costs the user a step" rationale.
    - One diagram per chapter grows, and the `assemble` slide shows it complete.
    - Text sits beside its picture.
  - **`section-writer.md`:**
    - Writers write each unit's divider and then its slides.
    - They show only that unit's code lines.
    - They may split, add build steps and reorder only within a unit, and never reorder units or drop a `topic` or an `assemble`.
    - The writer of the section a moved unit sits in writes it.
    - It gives the `assemble` label rules.
  - **`learner-review.md`:** add the six pass-1 flags of §5.9, plus a seventh from §5.2: a moved unit that shows code from a sub-topic the learner has not reached.
  - **`deck-template.md`:** add a `topic` slide to the filled example.
  - **`SKILL.md`:**
    - **Stage 1:** add `units.json` and `--plan`.
    - **Stage 2:** present the unit map.
    - **Stages 3–5:** add the after-gate rule (§5.9). Allowed inside one chapter: re-run `--plan`, then `reset-sections` and revision mode, within the two rounds. Never after the gate: moves across sub-topics and splitting or merging chapters, which are reported as unresolved.
    - **Stage 6:** report the Part ordering problems and every unit-map change.
    - **Reporting problems:** when the run moved a unit, append one `skill-problems.md` line for all the moves together (§5.2): `improvement · Part N sub-topic order: <the moves, in short> · course-research outline · storyboard`.
    - **Description:** keep it within 1024 characters and mention the unit map.
  - **`evals/acceptance.md`:** add one check per new validator rule and one learner-pass check for units.

- [ ] **Step 4: Run both skills' tests and check that they pass**

Run: the slide-design command and the react-slides Python command.
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add skills/teaching/slide-design
git commit -m "docs(slide-design): teach the unit map, dividers and assemblies in the briefs"
```
