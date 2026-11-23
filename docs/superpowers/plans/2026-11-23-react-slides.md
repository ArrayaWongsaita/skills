# react-slides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `react-slides` skill. It turns a `slide-design` deck into the slides of one Part in a per-course React web app at `courses/<slug>/web/`.

**Architecture:** The pieces, in the order the tasks build them:
1. **Python scripts** (stdlib) parse and check the deck, then emit one generated `part-NN.tsx` plus `part-NN.data.ts` per Part, against a fixed, typed component library. A manifest of SHA-256 hashes protects hand edits and lets template upgrades reach unedited files.
2. **The React template** (Vite + TypeScript) holds:
   - the components
   - a hash router
   - the home page
   - hand-drawn rough.js diagrams with build-step animation
   - the code blocks with their copy buttons
   - the check page the agent reads through a browser
3. **`SKILL.md`:** the coordinator's procedure. It drives the scripts, an illustrator subagent, screenshots and the visual check.

**Plan decisions beyond the spec:**
- **No generated `parts/index.ts`:** the spec lists one, but `src/parts.ts` (a template file) discovers the Parts with `import.meta.glob` instead. The effect is the same, and a run never has to rewrite a shared index.
- **A new `inline.py` module** holds the Markdown subset and the visible-text rule from spec §5.3.

**Tech Stack:**
- **Python:** 3.11+ stdlib for the scripts, pytest for their tests.
- **Runtime packages** (exact versions): React 19.3.1, roughjs 4.6.6, highlight.js 11.12.0, lucide-react 1.77.0, @fontsource/mali 5.3.0, @fontsource/jetbrains-mono 5.3.0.
- **Dev packages** (exact versions): Vite 8.3.8 with @vitejs/plugin-react 6.3.0, TypeScript 7.0.2, vitest 5.1.1 with @testing-library/react 16.3.3, @testing-library/jest-dom 8.0.0 and jsdom 31.0.1.

**Spec:** `docs/superpowers/specs/2026-11-23-react-slides-design.md`

## Global Constraints

- **Skill location:** `skills/teaching/react-slides/`. `SKILL.md` frontmatter `name: react-slides`.
- **Scripts:** Python 3.11+, stdlib only. Each script puts its own folder on `sys.path`. `tests/conftest.py` puts `scripts/` on `sys.path`.
- **Input contracts:** `slide-design/deck@1` and `slide-design/vocabulary@1`. Refuse any other `template`, and name what was found.
- **Inputs read:**
  - `courses/<slug>/slides/part-NN-<slug>.md`
  - `courses/<slug>/slides/visual-vocabulary.md`
  - the `title` from the frontmatter of `courses/<slug>/00-overview.md`
  - the Part file, hashed only, never parsed
- **App and work paths:**
  - The app is `courses/<slug>/web/`.
  - The manifest is `web/.react-slides.json`.
  - The work folder is `web/_work/part-NN/`. It is git-ignored and never bundled.
- **Part slug:** `part-NN`, where NN is `f"{part:02d}"`, so Part 10 is `part-10`.
- **Hash routes:** `#/`, `#/part-NN`, `#/part-NN/<slide id>`, `#/check/part-NN`. Vite `base: './'`.
- **Visual key:** the first 8 hex digits of SHA-256, over UTF-8:
  - an illustration: its `description`
  - a screenshot: `url + "\n" + capture`
- **Asset paths:**
  - illustrations: `src/illustrations/part-NN/<key>.tsx`
  - images: `src/assets/images/part-NN/<key>.(png|jpg|webp)`
  - An image takes precedence over the drawn illustration.
- **Fonts:** Mali for all text, JetBrains Mono for code, both from `@fontsource`. Opening the built site makes no request to a third-party server.
- **Look:**
  - white background, ink `#2b2b2b`
  - role palette: `primary #4a86c5`, `secondary #8a6fc9`, `accent #e08a2e`, `success #4f9a63`, `warning #c9971c`, `danger #d9607a`, `neutral #6b6b6b`
  - A role missing from the palette uses the vocabulary's hex.
- **Animation:**
  - New diagram elements draw in over 700 ms, and their labels fade in after them.
  - `dim` is opacity 0.35.
  - A slide change is a fade of 200 ms or less.
  - No animation going back, and none under `prefers-reduced-motion`.
- **Layout:**
  - The desktop stage is 16:9. Auto-fit shrinks prose to 85 % at most.
  - The phone breakpoint is 720 px: a slide becomes a vertically scrolling page.
  - Check frames are 1280 × 720 and 390 × 844.
- **Interface strings:** Thai and English, from `src/strings.ts`. Other languages fall back to English.
- **Text:** never change slide text, code or output. Visible text equals the deck's field text with the supported markup removed (Task 3).
- **Generated files:** each starts with a comment naming the deck file, its SHA-256 and `GENERATOR_VERSION`.
- **Commits:** Conventional Commits with scope `react-slides`, one commit per task.
- **Test commands:**
  - Python: `uv run --no-project --python 3.12 --with pytest pytest skills/teaching/react-slides/tests -q`
  - Template: `npm --prefix skills/teaching/react-slides/template test`, then `npm --prefix skills/teaching/react-slides/template run build`

### The component contract (shared by Tasks 4 and 7–13)

`template/src/components/types.ts` exports exactly these names. `tsx_writer.py` emits code against them.

```ts
export type Rich = React.ReactNode;
export type Range = [number, number];
export type DiagramState = { kind: 'diagram'; diagram: string; show: string[]; new?: string[]; highlight: string[]; dim: string[] };
export type Fallback = DiagramState | { kind: 'text'; text: string };
export type Visual =
  | DiagramState
  | { kind: 'illustration'; key: string; description: string; prompt: string; alt: string; fallback: Fallback }
  | { kind: 'screenshot'; key: string; url: string; capture: string; fallback: Fallback };
export type Block = { lang: string; info: string; text: string };
export type Listing = { lang: string; status: 'verified' | 'unverified' | 'skipped'; reason: string; code: string };
export type DiagramDef = { id: string; title: string; canvas: [number, number];
  nodes: { id: string; label: string; concept: string; at: [number, number]; size: [number, number] }[];
  edges: { id: string; from: string; to: string; label?: string; style: 'solid' | 'dashed' }[];
  groups: { id: string; label: string; concept?: string; members: string[] }[];
  badges: { id: string; n: number; near: string }[];
  notes: { id: string; text: string; near: string }[] };
export type PartMeta = { course: string; part: number; slug: string; title: string; language: string; slideCount: number };
export type Base = { id: string; section: string; purpose: string; from: string[]; sources: string[] };
```

**Layout components,** exported from `components/index.ts` together with the text components `C, A, B, I, P, Ol, Ul, Li` and `Deck`. Every prop listed is required unless marked `?`, and every component also takes `Base`:

| Component | Props |
|---|---|
| `Cover` | `title`, `body?`, `visual?` |
| `Focus` / `Explain` | `title`, `body`, `visual` |
| `Steps` | `title`, `items: Rich[]`, `visual` |
| `Compare` | `title`, `left`, `right`, `takeaway`, `leftBlocks?: Block[]`, `rightBlocks?: Block[]` |
| `Code` | `title`, `body`, `notice?`, `snippet: string`, `lines: Range[]`, `highlight: Range[]` |
| `Output` | `title`, `body`, `notice?`, `snippet: string` |
| `Error` | `title`, `cause`, `fix`, `symptom?`, `blocks?: Block[]` |
| `Objectives` / `Terms` / `Summary` | `title`, `items: Rich[]`, `visual?` |
| `Setup` | `title`, `items: Rich[]`, `visual?`, `blocks?: Block[]` |
| `Question` | `question`, `body`, `items?: Rich[]`, `visual?` |
| `Answer` | `answer`, `why`, `revisit: string`, `visual?` |
| `Practice` | `title`, `task`, `items?: Rich[]`, `solution?`, `visual?` |
| `Sources` | `title`, `items: Rich[]` |

Text props are `Rich`. Both a `Code` slide and an `Output` slide take their text from `Deck`'s data, keyed by `snippet`.

**`Deck` props:** `meta: PartMeta`, `diagrams: Record<string, DiagramDef>`, `listings: Record<string, Listing>`, `outputs: Record<string, Block>`, `children`.

**A generated `part-NN.data.ts`** exports `meta`, `diagrams`, `listings` and `outputs`, typed as above.

## Review Focus

1. **JSX-significant characters nested inside a link or bold text,** such as `[a{b}](https://x)` and `**<tag>**`, still render verbatim. Test: Task 3, `test_escaping_inside_nested_nodes`.
2. **Part numbers of 10 or more** produce `part-10` files and routes, and a slide id such as `10-001` round-trips through the router. Tests: Task 4 `test_part_slug_pads_to_two_digits`, Task 7 `router.test.ts › part 10`.
3. **An edge that connects to a group** ends on the group's frame, not on a member node. Test: Task 11 `geometry.test.ts › edge to a group`.
4. **A URL or a saved progress entry naming a slide id that no longer exists,** after a renumbering upstream, opens the Part's first slide without crashing. Test: Task 8 `Deck.test.tsx › unknown slide id`.
5. **`--force` with a path that was not skipped,** or a path written with a leading `web/`, is normalised, or refused with the list of skipped paths. Test: Task 6 `test_force_path_is_normalised_or_refused`.

---

### Task 1: Skill skeleton, shared parser copies and the fixture course

**Files:**
- Create: `skills/teaching/react-slides/scripts/{frontmatter,mdtext,contract,deck}.py`. Copy each byte for byte from `skills/teaching/slide-design/scripts/`.
- Create: `skills/teaching/react-slides/tests/conftest.py`
- Create: `skills/teaching/react-slides/tests/fixtures/courses/langchain-agents/`, holding `00-overview.md`, `part-01-first-agent.md`, `part-02-graphs.md`, `slides/visual-vocabulary.md`, `slides/part-01-first-agent.md` and `slides/part-02-graphs.md`
- Test: `skills/teaching/react-slides/tests/test_fixture.py`

**Interfaces:**
- **Produces, in `conftest.py`:**
  - `SCRIPTS`
  - `FIXTURE` (the fixture course dir)
  - `SLIDE_DESIGN_SCRIPTS`
  - the fixture `course(tmp_path) -> Path`, which copies `FIXTURE` to `tmp_path/"courses"/"langchain-agents"`
- **Produces, from the copied modules:** `deck.parse_deck(text) -> deck.Deck`, `contract.LAYOUTS`, `contract.FIELD_LIMITS` and `mdtext.visible_length`.

**What the fixture holds:**
- **`00-overview.md`:** the frontmatter `template: "course-research/overview@1"`, `course: "langchain-agents"`, `title: "สร้าง AI agent ด้วย LangChain + LangGraph"`, `research_date` and `versions`, plus a short body.
- **The Part files:** any Markdown. They are only hashed.
- **The vocabulary:**
  - the default roles
  - concepts with the shapes `person`, `rounded-box`, `cylinder` and `cloud`
  - one concept with a known lucide icon name (`bot`) and one with an unknown name (`no-such-icon`)
  - a style sentence
- **The deck of Part 1** follows `slide-design/references/deck-template.md`:
  - **Sections:** `Opening`, `1.1 …`, `1.2 …` and `Closing`.
  - **Layouts:** all 16, within the contract's length limits.
  - **Two diagrams:**
    - `d-agent-loop`: nodes, a group, solid and dashed edges, an edge whose `to` is the group, numbered badges and a note, shown across three consecutive build-step slides with `new`, `highlight` and `dim`
    - one more diagram used as an illustration fallback
  - **Visuals:**
    - one illustration with a diagram fallback
    - one screenshot with a text fallback
    - a second illustration whose `description` equals the first one's
  - **Code:**
    - a `code` slide with `lines: [[1, 2], [5, 6]]` and `highlight: [[5, 5]]`
    - an `output` slide whose block is ` ```text illustrative `
    - a listing with status `unverified`, and its `code` slide with a `**Notice:**`
  - **Blocks:** a `setup` slide with a `bash` block, an `error` slide with a symptom and an error block, and a `compare` slide with a block in each panel.
  - **An `answer` slide** whose `revisit` names the earlier `code` slide.
  - **Text cases somewhere in the fields:**
    - Thai with tone marks, and an emoji
    - `{ } < > &`, inline code and double quotes
    - a `[text](https://…)` link, `**bold**` and `*italic*`
    - a Body with a line break
    - a list inside `**Solution:**`
    - the unsupported `~~old~~`
    - `sources` items written as links
- **The deck of Part 2:** a `cover`, an `explain` with a text-only illustration fallback, and a `summary`. Its `source_sha256` is 64 zeros, so it is stale.
- **Deck frontmatter** follows `DECK_FRONTMATTER_KEYS`. Part 1's `source_sha256` is the real SHA-256 of `part-01-first-agent.md`, and `slide_count` is the true count.

- [ ] **Step 1: Write the failing tests**

```python
def test_shared_modules_match_slide_design():
    for name in ("frontmatter.py", "mdtext.py", "contract.py", "deck.py"):
        assert (SCRIPTS / name).read_bytes() == (SLIDE_DESIGN_SCRIPTS / name).read_bytes(), name

def test_fixture_decks_parse_cleanly():
    for path in sorted((FIXTURE / "slides").glob("part-*.md")):
        assert deck.parse_deck(path.read_text(encoding="utf-8")).errors == [], path.name

def test_part_one_uses_every_layout_and_visual_kind():
    slides = _deck(1).slides()
    assert {s.layout for s in slides} == set(contract.LAYOUTS)
    assert {s.visual["kind"] for s in slides if s.visual} == {"diagram", "illustration", "screenshot"}

def test_part_one_covers_the_text_cases():
    text = (FIXTURE / "slides" / "part-01-first-agent.md").read_text(encoding="utf-8")
    for needle in ("{", "}", "<", ">", "&", "**", "](https://", "~~", "่", "```text illustrative", '"unverified"'):
        assert needle in text, needle

def test_fixture_respects_contract_limits():
    for slide in _deck(1).slides():
        for name, field in slide.fields.items():
            limit = contract.FIELD_LIMITS.get((slide.layout, name)) or (contract.TITLE_LIMIT if name == "Title" else None)
            for text in (field.items if name == "Items" else [field.text]):
                assert limit is None or mdtext.visible_length(text) <= limit, (slide.id, name)

def test_part_one_sha_matches_and_part_two_is_stale():
    assert _meta(1)["source_sha256"] == hashlib.sha256((FIXTURE / "part-01-first-agent.md").read_bytes()).hexdigest()
    assert _meta(2)["source_sha256"] == "0" * 64
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `uv run --no-project --python 3.12 --with pytest pytest skills/teaching/react-slides/tests -q`
Expected: FAIL on import errors and missing fixture files.

- [ ] **Step 3: Copy the four modules and write `conftest.py` and the fixture course** as described above.

- [ ] **Step 4: Run the tests and see them pass**

Run: the same command.
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add skills/teaching/react-slides
git commit -m "feat(react-slides): add the shared deck parser and a fixture course using every layout"
```

---

### Task 2: `deck_reader.py`: load and check a deck for rendering

**Files:**
- Create: `skills/teaching/react-slides/scripts/deck_reader.py`
- Test: `skills/teaching/react-slides/tests/test_deck_reader.py`

**Interfaces:**
- **Consumes:** `deck.parse_deck`, `contract.*`, `frontmatter.parse`
- **Produces:**
  - `class DeckError(Exception)`, with `.errors: list[str]`. `str()` joins them with newlines.
  - `@dataclass(frozen=True) class Vocabulary`: `course: str`, `version: int`, `roles: dict[str, str]`, `concepts: list[dict]`, `style: str`
  - `@dataclass(frozen=True) class Loaded`: `path: Path`, `sha256: str` (of the deck file), `deck: deck.Deck`, `vocabulary: Vocabulary`, `stale: bool | None` (`None` when the Part file is missing)
  - `find_deck(course_dir: Path, part: int) -> Path`
  - `deck_parts(course_dir: Path) -> list[int]`
  - `read_vocabulary(course_dir: Path) -> Vocabulary`
  - `read_course_title(course_dir: Path) -> str`
  - `excerpt(code: str, lines: list[list[int]]) -> str`
  - `render_errors(d: deck.Deck, part: int) -> list[str]`
  - `load(course_dir: Path, part: int) -> Loaded`

- [ ] **Step 1: Write the failing tests**

```python
def test_load_fixture_part_one(course):
    loaded = deck_reader.load(course, 1)
    assert loaded.stale is False and loaded.vocabulary.style and len(loaded.deck.slides()) == loaded.deck.meta["slide_count"]

def test_stale_and_missing_part_file(course):
    assert deck_reader.load(course, 2).stale is True
    (course / "part-01-first-agent.md").unlink()
    assert deck_reader.load(course, 1).stale is None

def test_wrong_templates_are_refused(course):
    _replace(course / "slides" / "part-01-first-agent.md", '"slide-design/deck@1"', '"slide-design/deck@2"')
    with pytest.raises(deck_reader.DeckError, match="slide-design/deck@2"):
        deck_reader.load(course, 1)

def test_vocabulary_template_is_checked(course):
    _replace(course / "slides" / "visual-vocabulary.md", "vocabulary@1", "vocabulary@9")
    with pytest.raises(deck_reader.DeckError, match="vocabulary@9"):
        deck_reader.read_vocabulary(course)

@pytest.mark.parametrize("old,new,message", [
    ("· explain", "· fancy", "unknown layout fancy"),
    ('"revisit": "1-0', '"revisit": "9-9', "revisit"),
    ('"diagram": "d-agent-loop"', '"diagram": "d-missing"', "d-missing"),
    ('"snippet": "1.2-a"', '"snippet": "nope"', "nope"),
])
def test_render_errors_name_the_problem(course, old, new, message):
    _replace(course / "slides" / "part-01-first-agent.md", old, new, count=1)
    with pytest.raises(deck_reader.DeckError) as info:
        deck_reader.load(course, 1)
    assert message in str(info.value)

def test_excerpt_differing_from_snippet_is_refused(course): ...   # change one character inside the code slide's block; message contains "excerpt"
def test_missing_required_field_is_refused(course): ...           # delete an explain slide's **Body:** line; message contains "Body"
def test_every_error_is_reported(course): ...                     # two corruptions at once give two errors

def test_excerpt_joins_the_listed_lines():
    assert deck_reader.excerpt("a\nb\nc\nd\ne\nf", [[1, 2], [5, 6]]) == "a\nb\ne\nf"

def test_course_title_and_parts(course):
    assert deck_reader.read_course_title(course) == "สร้าง AI agent ด้วย LangChain + LangGraph"
    assert deck_reader.deck_parts(course) == [1, 2]
    (course / "00-overview.md").unlink()
    assert deck_reader.read_course_title(course) == "langchain-agents"
```

Use the fixture's real snippet and revisit ids in the parametrised strings.

- [ ] **Step 2: Run the tests and see them fail.** Run the Python test command, `-k deck_reader`. Expected: FAIL (no module `deck_reader`).

- [ ] **Step 3: Implement `deck_reader.py`**

**`render_errors` checks, each error prefixed `line N: <slide id>: `:**
- every `deck.errors` entry
- the deck's frontmatter `template` and `part`
- the layout is known, and the slide block's `layout` matches the heading
- the required fields are present, and no field outside the layout's required and optional ones appears
- `Items` layouts have at least one item
- the visual follows the layout's rule:
  - a required visual is present, and `none` means absent
  - the kind is known
  - a diagram state names a known diagram and known element ids
  - an illustration has `description`, `prompt`, `alt` and `fallback`
  - a screenshot has `url`, `capture` and `fallback`
  - a fallback is of kind `diagram` or `text`
- a `code` slide's `snippet` exists, its `lines` are ascending and non-overlapping 1-based ranges inside the snippet, it has exactly one block, and that block equals `excerpt(listing code, lines)`
- an `output` slide's `snippet` exists, and the slide has exactly one block
- an `answer` slide's `revisit` is a slide id in the deck
- every listing has a code block and a known status
- every diagram edge's `from` and `to`, and every badge's and note's `near`, name an element of that diagram

**Other functions:**
- `read_vocabulary` parses the ` ```roles `, ` ```concepts ` and ` ```style ` blocks with `mdtext.scan`.
- `read_course_title` falls back to the course folder name.
- `find_deck` matches `slides/part-NN-*.md`.

- [ ] **Step 4: Run the tests and see them pass.** Expected: all `test_deck_reader.py` tests pass, and `test_fixture.py` stays green.

- [ ] **Step 5: Commit:** `feat(react-slides): load a deck and refuse what cannot be rendered`

---

### Task 3: `inline.py`: the supported Markdown subset and the verbatim rule

**Files:**
- Create: `skills/teaching/react-slides/scripts/inline.py`
- Test: `skills/teaching/react-slides/tests/test_inline.py`

**Interfaces:**
- **Produces frozen dataclasses:**
  - inline nodes: `Text(text)`, `Code(text)`, `Link(href, children: tuple)`, `Bold(children)`, `Italic(children)`, `Break()`
  - blocks: `Para(nodes: tuple)` and `ListBlock(ordered: bool, items: tuple[tuple, ...])`
- **Produces functions:**
  - `parse_inline(text: str) -> list[Node]`
  - `parse_field(text: str) -> list[Para | ListBlock]`
  - `visible_text(text: str) -> str`
  - `unsupported(text: str) -> list[str]`

**The rules:**
- **Inline, parsed in this order:**
  1. `` `code` ``, whose content is literal
  2. `[text](http…)`
  3. `**bold**`
  4. `*italic*`, where the content neither starts nor ends with a space. There is no `_italic_`, because `snake_case` words would break.
  5. bare URLs matching `mdtext.URL_RE`
- **Blocks:**
  - A blank line splits paragraphs.
  - Inside a paragraph, consecutive lines matching `^\s*(\d+\.|-)\s+` form a list. A list is ordered when its first marker is a number.
  - Other lines are joined with `Break`.
- **`visible_text`:**
  - Concatenate the text of every node: a link gives its text, and code gives its content.
  - Emit `"\n"` for each `Break` and at each paragraph and list-item boundary.
  - Collapse runs of `"\n"`, and strip.
  - List markers are not visible.
- **`unsupported`** returns one message per occurrence of `~~`, `![`, an HTML tag `<[a-zA-Z/]`, a line starting `> `, or a line starting `#`.

- [ ] **Step 1: Write the failing tests**

```python
def test_inline_nodes():
    assert inline.parse_inline("ใช้ `a{b}` กับ [doc](https://x.y) และ **ตัวหนา** *เอียง*") == [
        Text("ใช้ "), Code("a{b}"), Text(" กับ "), Link("https://x.y", (Text("doc"),)), Text(" และ "),
        Bold((Text("ตัวหนา"),)), Text(" "), Italic((Text("เอียง"),))]

def test_snake_case_is_not_italic():
    assert inline.parse_inline("create_agent_x") == [Text("create_agent_x")]

def test_bare_url_becomes_a_link():
    assert inline.parse_inline("ดู https://a.b/c") == [Text("ดู "), Link("https://a.b/c", (Text("https://a.b/c"),))]

def test_field_blocks():
    blocks = inline.parse_field("บรรทัดหนึ่ง\nบรรทัดสอง\n\n1. ก\n2. ข")
    assert blocks == [Para((Text("บรรทัดหนึ่ง"), Break(), Text("บรรทัดสอง"))), ListBlock(True, ((Text("ก"),), (Text("ข"),)))]

def test_visible_text():
    assert inline.visible_text("ใช้ `x` [doc](https://a)\nต่อ\n\n- ก\n- ข") == "ใช้ x doc\nต่อ\nก\nข"

def test_escaping_inside_nested_nodes():   # Review Focus 1
    assert inline.visible_text("[a{b}](https://x) **<tag>**") == "a{b} <tag>"

def test_unsupported_is_literal_and_reported():
    assert inline.visible_text("~~old~~") == "~~old~~"
    assert inline.unsupported("~~old~~ ![i](x)") != []
```

- [ ] **Step 2: Run the tests and see them fail** (no module `inline`).
- [ ] **Step 3: Implement `inline.py`** with the rules above.
- [ ] **Step 4: Run the tests and see them pass.**
- [ ] **Step 5: Commit:** `feat(react-slides): parse the supported inline Markdown and define visible text`

---

### Task 4: `tsx_writer.py`: generate the TSX and the data files

**Files:**
- Create: `skills/teaching/react-slides/scripts/tsx_writer.py`
- Test: `skills/teaching/react-slides/tests/test_tsx_writer.py`

**Interfaces:**
- **Consumes:**
  - `deck_reader.Loaded` and `deck_reader.excerpt`
  - `inline.parse_field` and `inline.parse_inline`
  - the component contract (Global Constraints)
- **Produces:**
  - `GENERATOR_VERSION = 1`
  - `COMPONENTS: dict[str, str]`, mapping each layout to its component name (`"explain" -> "Explain"`, …)
  - `part_slug(part: int) -> str`
  - `jsx_text(s: str) -> str`
  - `rich(text: str) -> str`
  - `rich_items(items: list[str]) -> str`
  - `visual_key(visual: dict) -> str`
  - `part_tsx(loaded, part: int) -> str`
  - `part_data_ts(loaded, part: int) -> str`
  - `vocabulary_ts(v: Vocabulary) -> str`
  - `course_ts(slug: str, title: str) -> str`

**The emission rules:**
- **`jsx_text`:**
  - Plain JSX text when the string matches `^[^{}<>&\s](?:[^{}<>&\n]*[^{}<>&\s])?$` and holds no double space.
  - Otherwise `{` + `json.dumps(s, ensure_ascii=False)` + `}`.
- **`rich`:**
  - It wraps the field in `<>…</>`.
  - `Code` becomes `<C>{"…"}</C>`, always as a string expression.
  - `Link` becomes `<A href={"…"}>…</A>`, `Bold` becomes `<B>…</B>`, `Italic` becomes `<I>…</I>`, and `Break` becomes `<br />`.
  - A field of more than one block becomes `<P>…</P>` paragraphs and `<Ol>`/`<Ul>` with `<Li>`. A single paragraph is emitted bare.
- **`rich_items`** gives `[<>…</>, …]`, one entry per `Field.items` entry.
- **Props:**
  - Prop names are the lowercase field names, plus `leftBlocks`, `rightBlocks` and `blocks` for content blocks, written as JSON object literals `{ lang, info, text }`.
  - Every slide gets the `Base` props: `section` is its `##` heading, and `from` and `sources` come from the slide block.
  - Layout keys are passed as JSON.
  - `visual` is passed as JSON. An illustration or screenshot gets `key: visual_key(...)` added.
- **`part_data_ts`** exports:
  - `meta`
  - `diagrams`
  - `listings`: snippet to `{ lang, status, reason, code }`
  - `outputs`: snippet to `{ lang, info, text }`, from each `output` slide's block

  All are emitted with `json.dumps(…, ensure_ascii=False, indent=2)`, and imports are type-only from `../components/types`.
- **`course_ts`** gives `export const course = { slug: "…", title: "…" };`.

- [ ] **Step 1: Write the failing tests**

```python
def test_jsx_text_quotes_only_when_needed():
    assert tsx_writer.jsx_text("ต่อ tool เข้ากับ model") == "ต่อ tool เข้ากับ model"
    assert tsx_writer.jsx_text("a {b}") == '{"a {b}"}'
    assert tsx_writer.jsx_text(" lead") == '{" lead"}' and tsx_writer.jsx_text("a  b") == '{"a  b"}'

def test_rich_field():
    assert tsx_writer.rich("ใช้ `x<y>` [d](https://a)") == '<>ใช้ <C>{"x<y>"}</C> <A href={"https://a"}>d</A></>'

def test_part_slug_pads_to_two_digits():   # Review Focus 2
    assert tsx_writer.part_slug(1) == "part-01" and tsx_writer.part_slug(10) == "part-10"

def test_visual_key():
    assert tsx_writer.visual_key({"kind": "illustration", "description": "ก"}) == hashlib.sha256("ก".encode()).hexdigest()[:8]
    assert tsx_writer.visual_key({"kind": "screenshot", "url": "u", "capture": "c"}) == hashlib.sha256(b"u\nc").hexdigest()[:8]

def test_part_tsx_for_fixture(course):
    out = tsx_writer.part_tsx(deck_reader.load(course, 1), 1)
    assert out.startswith("// Generated by react-slides") and f"GENERATOR_VERSION {tsx_writer.GENERATOR_VERSION}" in out
    assert "import { meta, diagrams, listings, outputs } from './part-01.data';" in out
    for layout, name in tsx_writer.COMPONENTS.items():
        assert f"<{name}\n" in out or f"<{name} " in out, layout
    assert out.count(' id="1-') == deck_reader.load(course, 1).deck.meta["slide_count"]

def test_code_slide_passes_ranges_not_code(course):
    out = tsx_writer.part_tsx(deck_reader.load(course, 1), 1)
    assert "lines={[[1, 2], [5, 6]]}" in out and "highlight={[[5, 5]]}" in out

def test_data_ts_holds_listings_and_outputs(course):
    data = tsx_writer.part_data_ts(deck_reader.load(course, 1), 1)
    assert '"status": "unverified"' in data and '"info": "text illustrative"' in data and "export const meta" in data
```

- [ ] **Step 2: Run the tests and see them fail.**
- [ ] **Step 3: Implement `tsx_writer.py`** with the rules above. Whether the TSX compiles is proven in Task 14.
- [ ] **Step 4: Run the tests and see them pass.**
- [ ] **Step 5: Commit:** `feat(react-slides): emit a Part as typed TSX and data files`

---

### Task 5: `manifest.py`: protect hand edits

**Files:**
- Create: `skills/teaching/react-slides/scripts/manifest.py`
- Test: `skills/teaching/react-slides/tests/test_manifest.py`

**Interfaces:**
- **Produces:**
  - `MANIFEST_FILE = ".react-slides.json"`
  - `@dataclass class Manifest`: `template_version: str = ""`, `files: dict[str, dict]` (`rel -> {"sha256", "kind": "template" | "generated", "generator": int | None}`)
  - `load(web: Path) -> Manifest`
  - `save(web: Path, m: Manifest) -> None`
  - `sha256_text(text: str) -> str`
  - `status(web, rel, m) -> "absent" | "unedited" | "edited"`
  - `write_group(web, files: dict[str, str], m, *, kind: str, generator: int | None = None, force: frozenset[str] = frozenset()) -> dict[str, str]`
  - `write_once(web, rel, text) -> bool`

**The rules:**
- **`status`:** a file present but absent from the manifest is `edited`, because it was user-created.
- **`write_group` outcomes:**
  - `"written"`, `"unchanged"` (same content), `"skipped"` or `"forced"`
  - When any file of the group is `edited` and not in `force`, every file of the group is `"skipped"`.
  - Every non-skipped file updates its manifest entry.
- **Writing:** UTF-8, with `\n` line endings. Parent directories are created.

- [ ] **Step 1: Write the failing tests**

```python
def test_absent_file_is_written_and_recorded(tmp_path): ...    # outcome "written"; entry sha matches; kind recorded
def test_unedited_file_is_overwritten(tmp_path): ...           # second write with new text -> "written"
def test_same_content_is_unchanged(tmp_path): ...
def test_edited_file_is_skipped(tmp_path):
    m = manifest.Manifest(); manifest.write_group(tmp_path, {"a.tsx": "1"}, m, kind="generated", generator=1)
    (tmp_path / "a.tsx").write_text("mine", encoding="utf-8")
    assert manifest.write_group(tmp_path, {"a.tsx": "2"}, m, kind="generated", generator=1) == {"a.tsx": "skipped"}
    assert (tmp_path / "a.tsx").read_text(encoding="utf-8") == "mine"
def test_group_is_skipped_together(tmp_path): ...              # edit part-01.tsx only -> both tsx and data.ts "skipped"
def test_force_overwrites(tmp_path): ...                       # force={"a.tsx"} -> "forced"
def test_untracked_existing_file_counts_as_edited(tmp_path): ...
def test_write_once_never_overwrites(tmp_path): ...            # True, then False, and the content is kept
def test_manifest_round_trips(tmp_path): ...                   # save -> load equal, including generator numbers
```

- [ ] **Step 2: Run the tests and see them fail.** **Step 3: Implement.** **Step 4: Run the tests and see them pass.**
- [ ] **Step 5: Commit:** `feat(react-slides): keep hand-edited files out of regeneration`

---

### Task 6: `build_part.py`: the CLI that scaffolds, upgrades and converts

**Files:**
- Create: `skills/teaching/react-slides/scripts/build_part.py`
- Test: `skills/teaching/react-slides/tests/test_build_part.py`. Its own `fake_template` fixture builds a tiny template in `tmp_path`, holding `package.json` with `"version": "1.0.0"`, `src/components/x.ts`, `src/course.ts`, `src/vocabulary.ts`, `src/a.test.ts` and `node_modules/junk`.

**Interfaces:**
- **Consumes:** `deck_reader.*`, `tsx_writer.*`, `manifest.*`, `inline.unsupported`
- **Produces:**
  - `TEMPLATE_DIR`
  - `template_files(template_dir: Path) -> dict[str, str]`. It excludes `node_modules/`, `dist/`, `src/__fixtures__/`, `*.test.ts`, `*.test.tsx`, `src/course.ts` and `src/vocabulary.ts`.
  - `run(course_dir: Path, parts: list[int] | None, *, template_dir: Path = TEMPLATE_DIR, force: frozenset[str] = frozenset(), skip_install: bool = False) -> dict`. `parts=None` means every Part that has a deck.
  - `main(argv: list[str]) -> int`

**CLI:**
- `python3 build_part.py <course_dir> (<N> | --all) [--force <path>]... [--skip-install]`
- It prints the report as JSON on stdout, exit 0.
- Deck errors print `error: …` lines on stderr, exit 1. With `--all`, the other Parts still convert.

**What `run` does, in order:**
1. **Sync the template files** with `write_group(kind="template")`, each file as its own group.
2. **`course.ts`:** `write_once("src/course.ts", course_ts(slug, read_course_title()))`.
3. **Each Part:**
   - `load` it, and warn when it is stale or its Part file is missing.
   - `write_group({"src/parts/part-NN.tsx", "src/parts/part-NN.data.ts"}, kind="generated", generator=GENERATOR_VERSION)`
   - `write_group({"src/vocabulary.ts"})`
   - Write `_work/part-NN/visuals.json`.
4. **Template version:** record it in the manifest. A major version that differs from the recorded one makes `parts` every deck Part.
5. **`npm install`:** run it in `web/` when `node_modules/` is missing or `package.json` was written or forced, unless `--skip-install`. When `npm` is not on `PATH`, fail with `error: node and npm are needed to build the app: install Node.js 20 or later from https://nodejs.org`.

**The report keys:**
- `web`, `parts`, `written`, `unchanged`, `skipped`, `forced`, `warnings`
- `stale`: the Parts
- `visuals`: one entry per illustration or screenshot, `{slide, kind, key, path, exists, description | url, prompt | capture, alt}`
- `unused`: asset files of a converted Part whose stem is not a current key
- `older_parts`: Parts whose generated files have a generator below `GENERATOR_VERSION`
- `template_version`
- `install`: `"ran"`, `"skipped"` or `"not-needed"`

**Normalising `--force`:**
- A leading `web/` is stripped, and `\` becomes `/`.
- A path that is not among the files the run would skip fails with `error: --force <path> was not skipped; skipped files: …`.

- [ ] **Step 1: Write the failing tests**

```python
def test_first_run_scaffolds_and_converts(course, fake_template):
    report = build_part.run(course, [1], template_dir=fake_template, skip_install=True)
    web = course / "web"
    assert (web / "src/parts/part-01.tsx").exists() and (web / "src/vocabulary.ts").exists()
    assert "สร้าง AI agent" in (web / "src/course.ts").read_text(encoding="utf-8")
    assert not (web / "node_modules").exists() and not (web / "src/a.test.ts").exists()
    assert report["install"] == "skipped" and report["stale"] == []

def test_visuals_use_content_keys(course, fake_template):
    report = build_part.run(course, [1], template_dir=fake_template, skip_install=True)
    keys = [v["key"] for v in report["visuals"]]
    assert len(keys) == 3 and len(set(keys)) == 2   # the two identical descriptions share a key
    assert json.loads((course / "web/_work/part-01/visuals.json").read_text(encoding="utf-8")) == report["visuals"]

def test_renumbered_deck_keeps_keys(course, fake_template): ...        # renumber the slides in the deck file -> same keys, files found
def test_unused_assets_are_reported_not_deleted(course, fake_template): ...
def test_converting_part_two_leaves_part_one_untouched(course, fake_template): ...   # also: stale == [2]
def test_edited_part_is_skipped_and_reported(course, fake_template): ...
def test_force_path_is_normalised_or_refused(course, fake_template):   # Review Focus 5
    ...  # "web/src/parts/part-01.tsx" is accepted after an edit; "src/nope.ts" -> SystemExit / error naming the skipped files
def test_all_converts_every_deck_and_reports_bad_ones(course, fake_template): ...
def test_template_upgrade_replaces_only_unedited_files(course, fake_template): ...   # bump the version, change x.ts; an edited x.ts is skipped
def test_major_upgrade_regenerates_every_part(course, fake_template): ...
def test_older_parts_are_reported(course, fake_template): ...           # monkeypatch GENERATOR_VERSION up
def test_cli_exit_codes(course, fake_template, capsys): ...             # bad deck -> 1 with "error:"; good -> 0 and JSON on stdout
def test_missing_npm_is_a_clear_error(course, fake_template, monkeypatch): ...   # PATH without npm, skip_install False
```

- [ ] **Step 2: Run the tests and see them fail.** **Step 3: Implement.** **Step 4: Run the tests and see them pass,** along with the whole Python suite.
- [ ] **Step 5: Commit:** `feat(react-slides): add the build_part CLI that scaffolds, upgrades and converts a Part`

---

### Task 7: The template base: app shell, router, progress, home page, sketch primitives

**Files (all under `skills/teaching/react-slides/template/`):**
- Create:
  - `package.json`: `name "course-slides"`, `version "1.0.0"`, `private`, `type "module"`, the exact versions from the Tech Stack, and the scripts `dev: "vite"`, `build: "tsc --noEmit && vite build"`, `preview: "vite preview"`, `test: "vitest run"`
  - `package-lock.json`, from `npm install`
  - `vite.config.ts`: `base: './'`, the react plugin, and `test: { environment: 'jsdom', setupFiles: ['src/test-setup.ts'], passWithNoTests: true }`. The setup file lives outside `__fixtures__` because the scaffolded app copies it too.
  - `tsconfig.json`: strict, `jsx: react-jsx`, `moduleResolution: bundler`, `resolveJsonModule: true`, `types: ["vite/client"]`
  - `index.html`
  - `.gitignore`: `node_modules`, `dist`, `_work`
  - under `src/`: `main.tsx`, `App.tsx`, `router.ts`, `progress.ts`, `parts.ts`, `strings.ts`, `hooks.ts`, `course.ts` (a placeholder), `vocabulary.ts` (a placeholder with the default roles and no concepts), `theme/roles.ts`, `theme/base.css`, `components/types.ts`, `components/seed.ts`, `components/sketch.tsx`, `components/Home.tsx`, `test-setup.ts` (imports `@testing-library/jest-dom/vitest`)
- Tests: `src/router.test.ts`, `src/progress.test.ts`, `src/components/sketch.test.tsx`, `src/components/Home.test.tsx`

**Interfaces:**
- **Produces, routing:**
  - `type Route = { name: 'home' } | { name: 'part'; part: number; slide?: string } | { name: 'check'; part: number }`
  - `parseHash(hash: string): Route`
  - `formatRoute(r: Route): string`
  - `useRoute(): Route`
  - `navigate(r: Route): void`
- **Produces, progress:**
  - `type Progress = { last?: string; furthest?: string }`
  - `loadProgress(course: string, part: number): Progress`
  - `saveProgress(course, part, p): void`. The key is `react-slides:<course>:part-NN`, and both functions are wrapped in `try/catch`.
- **Produces, Parts:** `listParts(): PartEntry[]`, where `PartEntry = { meta: PartMeta; load: () => Promise<{ default: React.ComponentType }> }`. It discovers the Parts with `import.meta.glob('./parts/part-*.data.ts', { eager: true })` and `import.meta.glob('./parts/part-*.tsx')`, sorted by part.
- **Produces, strings:** `t(language: string, key: StringKey, vars?: Record<string, string | number>): string`, with Thai and English for `copyLines`, `copyAll`, `copy`, `copied`, `copyFailed`, `prev`, `next`, `home`, `revisit`, `slides`, `readTo`, `notStarted`, `homeSubtitle`, `illustrative`, `scrollHint`. The labels come from the spec: `คัดลอกส่วนนี้` / `Copy these lines`, `คัดลอกโปรแกรมเต็ม` / `Copy the full program`, `คัดลอกแล้ว ✓` / `Copied ✓`.
- **Produces, hooks:** `useReducedMotion(): boolean`. It is guarded when `matchMedia` is missing.
- **Produces, colour:** `roleColour(role: string): string`. It takes the palette from the Global Constraints, then the vocabulary hex, then neutral.
- **Produces, sketch:**
  - `seedOf(key: string): number`: FNV-1a 32-bit, returning a value from 1 to 2^31−1
  - `SketchRect`, `SketchEllipse`, `SketchLine`, `SketchPath` and `SketchArrow`, each with `seedKey: string`, geometry, `stroke`, an optional `fill`/`fillStyle`, and `draw?: boolean`
  - They render `<path>` elements from `rough.generator().toPaths(...)` with `pathLength={1}`. When `draw` is set, they get the class `rs-draw`.
- **Produces, home:** `Home({ course, parts, progress }): JSX.Element`, a pure component. `App` feeds it `listParts()` and `loadProgress`.
- **`base.css`:**
  - imports `@fontsource/mali/400.css`, `600.css` and `@fontsource/jetbrains-mono/400.css`
  - CSS variables for ink and paper
  - `.rs-draw` keyframes animating `stroke-dashoffset` from 1 to 0 over 700 ms, with `stroke-dasharray: 1`
  - `.rs-fade`
  - a `@media (prefers-reduced-motion: reduce)` block that disables both
  - `word-break: normal`, and `overflow-wrap: anywhere` only on `code` and links
  - a visible `:focus-visible` outline
  - ink and muted text colours that meet WCAG AA contrast on white

- [ ] **Step 1: Install and write the failing tests**

Run `npm --prefix skills/teaching/react-slides/template install` once the `package.json` exists. If `npm` reports a peer conflict between the pinned versions, pick the newest mutually compatible versions and ledger a Ruling.

```ts
// router.test.ts
test('routes', () => {
  expect(parseHash('')).toEqual({ name: 'home' });
  expect(parseHash('#/part-01')).toEqual({ name: 'part', part: 1 });
  expect(parseHash('#/part-01/1-015')).toEqual({ name: 'part', part: 1, slide: '1-015' });
  expect(parseHash('#/check/part-02')).toEqual({ name: 'check', part: 2 });
  expect(parseHash('#/nonsense')).toEqual({ name: 'home' });
});
test('part 10', () => {   // Review Focus 2
  expect(parseHash('#/part-10/10-001')).toEqual({ name: 'part', part: 10, slide: '10-001' });
  expect(formatRoute({ name: 'part', part: 10, slide: '10-001' })).toBe('#/part-10/10-001');
});
// progress.test.ts
test('round trip', () => { saveProgress('c', 1, { last: '1-003', furthest: '1-007' }); expect(loadProgress('c', 1)).toEqual({ last: '1-003', furthest: '1-007' }); });
test('blocked storage breaks nothing', () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
  expect(() => saveProgress('c', 1, { last: '1-001' })).not.toThrow();
  expect(loadProgress('c', 1)).toEqual({});
});
// sketch.test.tsx
test('same seed key gives the same path', () => {
  const a = render(<svg><SketchEllipse seedKey="d/n-model" cx={50} cy={50} w={80} h={40} stroke="#000" /></svg>);
  const b = render(<svg><SketchEllipse seedKey="d/n-model" cx={50} cy={50} w={80} h={40} stroke="#000" /></svg>);
  expect(a.container.querySelector('path')!.getAttribute('d')).toBe(b.container.querySelector('path')!.getAttribute('d'));
});
test('draw adds the class', () => { /* draw → every path has class rs-draw and pathLength="1" */ });
// Home.test.tsx
test('cards link to parts and show progress', () => {
  /* two PartMeta entries; progress for part 1 { furthest: '1-025' }:
     links have href '#/part-01' and '#/part-02'; part 1 reads "อ่านถึงหน้า 25"; part 2 reads "ยังไม่เริ่ม" */
});
```

- [ ] **Step 2: Run the tests and see them fail.** Run: `npm --prefix skills/teaching/react-slides/template test`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement the files listed.**
  - `App` switches on `useRoute()`: home, a Part (lazily loaded through `listParts()`), and check (Task 13 fills it; until then it renders the Part).
  - `document.documentElement.lang` follows the Part's language.
  - A home card is a link with a `SketchRect` frame. Its progress line shows only once the Part has been started.
- [ ] **Step 4: Run the tests and see them pass.** Also run `npm --prefix skills/teaching/react-slides/template run build`. Expected: exit 0.
- [ ] **Step 5: Commit** the template, including `package-lock.json` but not `node_modules`: `feat(react-slides): add the template shell with routing, progress, home page and sketch primitives`

---

### Task 8: `Deck`, slide frame and navigation

**Files:**
- Create:
  - `template/src/components/Deck.tsx`: `Deck`, `DeckContext`, `useDeck()`, `DeckModeContext` (`'read' | 'check'`)
  - `template/src/components/SlideFrame.tsx`
  - `template/src/components/Nav.tsx`
- Modify: `template/src/hooks.ts`, adding `useSwipe` and `useAutoFit`
- Test: `template/src/components/Deck.test.tsx`

**Interfaces:**
- **Consumes:** `useRoute`, `navigate`, `formatRoute`, `loadProgress`, `saveProgress`, `useReducedMotion`, `t`, and the types
- **Produces:**
  - `DeckContext` value: `{ meta, diagrams, listings, outputs, current: string, direction: 'forward' | 'back' | 'none', reducedMotion: boolean }`
  - `SlideFrame({ slide: Base, title?: Rich, children, visual?: React.ReactNode, wide?: boolean })`
  - `useAutoFit(ref, enabled)`: on desktop only, it shrinks `--fit` from 1 in steps of 0.05, down to 0.85, while `scrollHeight > clientHeight`, and sets `data-fit` to the value used
  - `useSwipe(ref, { onLeft, onRight })`: it fires only when `|dx| > 50` and `|dx| > |dy|`

**Behaviour:**
- **Which slide shows:**
  - `Deck` reads its children's `id` props in order.
  - With a route slide id, it shows that slide. An unknown id redirects to the first slide.
  - Without one, it shows `loadProgress().furthest`, or the first slide.
- **Navigating:**
  - ← and →, Space, PageUp/PageDown, swipes and the ‹ › buttons call `navigate`.
  - `direction` is `forward` when the new index is the old one plus 1, `back` when it is lower, and `none` otherwise.
- **Progress:** every slide change saves `last`, and raises `furthest` when the new slide is beyond it.
- **The frame:** the top line shows `Part N · <section>`, and the bottom shows `‹ n / total ›`.
- **Fades:** slides fade in (`rs-fade-slide`, under 200 ms) unless reduced motion is on.
- **Screen sizes:**
  - **Desktop:** `SlideFrame` is a 16:9 stage, with auto-fit on.
  - **At 720 px wide or less:** it is a vertically scrolling page with the content stacked, auto-fit off, and the ‹ › bar fixed at the bottom.
- **Check mode:** in `check` mode, `Deck` renders every child in order inside the frames that the check page gives it (Task 13), with no navigation.

- [ ] **Step 1: Write the failing tests**

```ts
test('shows the routed slide and its counter', () => { /* route #/part-01/1-002 with three fixture slides → text of slide 2 and "2 / 3" */ });
test('ArrowRight navigates forward', () => { /* fireEvent.keyDown(window, { key: 'ArrowRight' }) → navigate called with part 1, slide '1-003' */ });
test('first slide disables previous', () => { /* the previous button is disabled at slide 1 */ });
test('unknown slide id', () => { /* Review Focus 4: route slide '1-099' → the first slide renders, navigate called with slide '1-001' */ });
test('resumes the furthest slide', () => { /* progress { furthest: '1-003' } and route without a slide → slide 3 */ });
test('vertical swipe does not navigate', () => { /* touchstart (0,0) → touchend (10,200) → navigate not called */ });
test('direction', () => { /* moving 1→2 gives forward, 2→1 gives back, 1→3 via the URL gives none */ });
```

Use a small fixture Part in `src/__fixtures__/MiniPart.tsx` built from `SlideFrame` directly, because the layouts arrive in Task 9. Mock `router` with `vi.mock`.

- [ ] **Step 2: Run the tests and see them fail.** **Step 3: Implement.** **Step 4: Run the tests and see them pass,** along with `npm run build`.
- [ ] **Step 5: Commit:** `feat(react-slides): add the deck with navigation, swipe, progress and auto-fit`

---

### Task 9: The text components and the layout components

**Files:**
- Create:
  - `template/src/components/text.tsx`: `C`, `A` (`target="_blank" rel="noopener noreferrer"`), `B`, `I`, `P`, `Ol`, `Ul`, `Li`
  - `template/src/components/layouts.tsx`: the 16 components from the contract table
  - `template/src/components/index.ts`
  - `template/src/__fixtures__/typecheck.tsx`
- Test: `template/src/components/layouts.test.tsx`

**Interfaces:**
- **Consumes:** `SlideFrame`, `useDeck`, the types, `t`
- **Produces:** the contract table, and a placeholder `Visual` slot. Layouts render `visual` through `<VisualSlot visual={…} />`, a stub that Task 12 replaces. Code-bearing layouts use stubs that Task 10 replaces.

**Layout rules:**
- `Steps` renders `items` as a numbered list beside the visual.
- `Compare` renders two panels and the takeaway.
- `Question` renders its choices as a lettered list.
- `Answer` renders a link `t(lang, 'revisit', { n: <revisit slide number> })` to `formatRoute({ name: 'part', part, slide: revisit })`.
- `Sources` renders its items as a list. When `sources` is empty, it renders no source links.
- Every layout puts the slide's `sources` as small links in its footer, unless the layout is `Sources`.
- Every field's container carries `data-field="<prop name>"`, and every item of an `items` list carries `data-item`. Task 14's verbatim test reads them.

**`typecheck.tsx`:** one `// @ts-expect-error` line per layout that leaves out a required prop, for example `<Explain id="x" section="s" purpose="p" from={[]} sources={[]} title={<>t</>} visual={…} />` without `body`. `npm run build` type-checks it.

- [ ] **Step 1: Write the failing tests**

```ts
test.each(LAYOUT_CASES)('%s renders its fields', (name, element, texts) => {
  render(<DeckFixture>{element}</DeckFixture>);
  for (const text of texts) expect(screen.getByText(text, { exact: false })).toBeInTheDocument();
});
test('answer links back to its revisit slide', () => { /* href '#/part-01/1-017' */ });
test('links open in a new tab', () => { /* A → target _blank, rel contains noopener */ });
test('empty sources render no source links', () => { /* sources=[] → no footer links */ });
test('inline code renders as code', () => { /* <C>{"a{b}"}</C> → a code element with text a{b} */ });
```

`LAYOUT_CASES` holds one entry per layout component, 16 in total.

- [ ] **Step 2: Run the tests and see them fail.** **Step 3: Implement.** **Step 4: Run the tests and see them pass.** `npm run build` must type-check `typecheck.tsx`. Expected: exit 0, since every `@ts-expect-error` is consumed.
- [ ] **Step 5: Commit:** `feat(react-slides): add the 16 layout components and the text components`

---

### Task 10: Code, output and blocks with copy buttons

**Files:**
- Create: `template/src/components/code.tsx`, holding `CodeBlock`, `OutputBlock`, `BlockList`, `excerptRows`, `copyText` and `highlightLang`
- Modify: `template/src/components/layouts.tsx`, so that `Code`, `Output`, `Setup`, `Error` and `Compare` use the code components
- Test: `template/src/components/code.test.tsx`

**Interfaces:**
- **Produces:**
  - `excerptRows(code: string, lines: Range[]): Array<{ n: number; text: string } | 'gap'>`, with `'gap'` between non-adjacent ranges
  - `excerptText(code, lines): string`: the shown lines joined with `\n`, followed by a final `\n`
  - `copyText(text): Promise<'ok' | 'unavailable'>`
  - `highlightLang(lang): string | null`. It registers `python`, `bash` (with the alias `shell`), `json`, `javascript`, `typescript`, `yaml`, `toml` and `plaintext` from `highlight.js/lib/core`, and an unknown language gives `null`, which renders plain.

**Behaviour:**
- **`CodeBlock`:**
  - Rows show the real line numbers. Highlighted rows get the class `rs-hl`, and `⋯` stands for a gap.
  - Two buttons: `copyLines` copies `excerptText`, and `copyAll` copies the full listing code plus `\n`.
  - The button label becomes `copied` for 1.6 s, or `copyFailed` when the clipboard is unavailable.
  - The `notice` is shown when the listing's status is not `verified`.
  - The block scrolls horizontally. On desktop, a block taller than its space scrolls vertically, with a fade cue and the `data-scrolls` attribute.
- **`OutputBlock`:** a terminal-like box. It shows the `illustrative` label when the info contains `illustrative`, and has no copy button.
- **`BlockList`:** one block per entry, each with a single `copy` button.

- [ ] **Step 1: Write the failing tests**

```ts
test('excerpt rows and gap', () => {
  expect(excerptRows('a\nb\nc\nd\ne\nf', [[1, 2], [5, 6]])).toEqual([{ n: 1, text: 'a' }, { n: 2, text: 'b' }, 'gap', { n: 5, text: 'e' }, { n: 6, text: 'f' }]);
});
test('copy these lines gives exactly the shown lines', async () => { /* clipboard.writeText called with 'a\nb\ne\nf\n' */ });
test('copy the full program gives the listing', async () => { /* called with the listing code + '\n' */ });
test('clipboard unavailable', async () => { /* navigator.clipboard undefined → button reads copyFailed */ });
test('highlighted rows are marked', () => { /* row 5 has class rs-hl */ });
test('unknown language renders plain', () => { /* lang 'cobol' → no hljs- spans, text intact */ });
test('unverified listing shows the notice', () => { /* status 'unverified' + notice → notice text visible */ });
test('illustrative output is labelled and has no copy button', () => { /* … */ });
```

- [ ] **Step 2: Run the tests and see them fail.** **Step 3: Implement.** **Step 4: Run the tests and see them pass,** along with `npm run build`.
- [ ] **Step 5: Commit:** `feat(react-slides): render code, output and blocks with copy buttons`

---

### Task 11: Hand-drawn diagrams with build-step animation

**Files:**
- Create:
  - `template/src/components/diagram/geometry.ts`
  - `template/src/components/diagram/shapes.tsx`
  - `template/src/components/diagram/Diagram.tsx`
  - `template/src/components/icons.ts`
- Tests: `template/src/components/diagram/geometry.test.ts` and `template/src/components/diagram/Diagram.test.tsx`

**Interfaces:**
- **Consumes:** `Sketch*`, `seedOf`, `roleColour`, `vocabulary`, `useDeck` (for `direction` and `reducedMotion`)
- **Produces, geometry:**
  - `CELL = 48`
  - `nodeBox(node): Box`, in pixels
  - `groupBox(def, group): Box`: the union of the members' boxes plus 12 px
  - `elementBox(def, id): Box`, for a node or a group
  - `edgePoints(def, edge): { from: Point; to: Point }`: where the centre-to-centre line crosses each box border, inset by 4 px
- **Produces, shapes and icons:**
  - `Shape({ shape, box, seedKey, stroke, draw })` covers `box`, `rounded-box`, `circle`, `cylinder`, `document`, `person` and `cloud`. Any other shape draws as `box`.
  - `iconFor(name: string): LucideIcon | null`
- **Produces, the diagram:** `Diagram({ state: DiagramState, def: DiagramDef, animate: boolean })`
  - It renders only the elements in `show`.
  - Each element is a `<g data-el={id}>`. `new` elements get `class="rs-new"` and pass `draw` to their sketches when `animate` is set. `highlight` elements get `rs-hl` and a 1.5× stroke. `dim` elements get `rs-dim`, at opacity 0.35.
  - `seedKey` is `${def.id}/${element id}`.
  - The colour comes from the concept's role: a node's concept, else its group's, else `neutral`.
  - It carries `role="img"` and an `aria-label` made of the diagram title and the labels shown.
  - **Groups** are a dashed rounded `SketchRect` around `groupBox`, with the label at the top left.
  - **Badges** are sketch circles numbered `n`, at the top-left corner of their `near` element's box.
  - **Notes** are handwritten text centred below their `near` element's box.
  - **Edges** have an arrowhead at `to`, `stroke-dasharray` when the style is `dashed`, and the label above the midpoint.
  - **Node labels** are centred in the node, with the icon, when there is one, before the label.
- **When to animate:** `animate = direction === 'forward' && !reducedMotion`.

- [ ] **Step 1: Write the failing tests**

```ts
test('edge to a group', () => {   // Review Focus 3
  const { to } = edgePoints(DEF, { id: 'e-g', from: 'n-user', to: 'g-agent', style: 'solid' });
  expect(onBorder(to, groupBox(DEF, DEF.groups[0]))).toBe(true);
});
test('edge endpoints sit on node borders', () => { /* … */ });
test('hidden elements are not rendered', () => { /* show without n-tool → no [data-el="n-tool"] */ });
test('new, highlight and dim are marked', () => { /* classes rs-new / rs-hl / rs-dim on the right groups */ });
test('new elements draw only when animating', () => { /* animate false → no .rs-draw paths */ });
test('an element looks the same on every slide', () => {
  /* render state 1 and state 3; the path d of [data-el="n-model"] is identical */
});
test('unknown icon draws nothing', () => { /* concept icon 'no-such-icon' → no svg icon inside the node */ });
```

- [ ] **Step 2: Run the tests and see them fail.** **Step 3: Implement.** **Step 4: Run the tests and see them pass,** along with `npm run build`.
- [ ] **Step 5: Commit:** `feat(react-slides): draw hand-drawn diagrams that build up step by step`

---

### Task 12: The visual slot: diagrams, illustrations, screenshots and fallbacks

**Files:**
- Create:
  - `template/src/components/Visual.tsx`, which replaces the Task 9 stub
  - `template/src/assets.ts`
  - `template/src/illustrations/.gitkeep`
  - `template/src/assets/images/.gitkeep`
- Test: `template/src/components/Visual.test.tsx`

**Interfaces:**
- **Consumes:** `Diagram`, `useDeck`, the `Sketch*` components (re-exported for illustrations from `components/index.ts`)
- **Produces:**
  - `makeAssetLookup(illustrations: Record<string, () => Promise<{ default: React.ComponentType }>>, images: Record<string, string>)`, which returns `{ illustration(part, key), image(part, key) }`
  - `assets`: the default lookup, built from `import.meta.glob('./illustrations/part-*/*.tsx')` and `import.meta.glob('./assets/images/part-*/*.{png,jpg,webp}', { eager: true, query: '?url', import: 'default' })`
  - `VisualSlot({ visual, lookup = assets })`

**The order for an illustration or a screenshot:**
1. an image, rendered as `<img alt={alt}>` (a screenshot uses its `capture` as the alt text)
2. the drawn illustration component, lazily loaded inside `<figure role="img" aria-label={alt}>`, drawn in on first view unless reduced motion is on
3. the fallback:
   - a diagram fallback renders with no `new`, so nothing animates
   - a text fallback renders as text, with line breaks kept

- [ ] **Step 1: Write the failing tests**

```ts
test('image takes precedence over the drawn illustration', () => { /* lookup with both → img rendered, illustration loader not called */ });
test('missing illustration falls back to its diagram state without animation', () => { /* no rs-new, no rs-draw */ });
test('missing screenshot falls back to text', () => { /* "1. … 2. …" text visible */ });
test('two slides with the same key use the same file', () => { /* both resolve the same loader */ });
test('diagram visual renders the diagram', () => { /* [data-el] present */ });
```

- [ ] **Step 2: Run the tests and see them fail.** **Step 3: Implement.** **Step 4: Run the tests and see them pass,** along with `npm run build`.
- [ ] **Step 5: Commit:** `feat(react-slides): resolve illustrations, screenshots and fallbacks`

---

### Task 13: The check page

**Files:**
- Create: `template/src/check/findings.ts`, `template/src/check/CheckPage.tsx`
- Modify: `template/src/App.tsx`, to route `check` to `CheckPage`
- Test: `template/src/check/findings.test.ts`

**Interfaces:**
- **Produces types:**
  - `type Measurement = { slide: string; frame: 'desktop' | 'phone'; prose: { scrollW: number; clientW: number; scrollH: number; clientH: number; fit: number }[]; scrollingBlocks: number; outOfCanvas: string[]; fallback: boolean }`
  - `type Finding = { slide: string; frame: string; kind: 'prose-overflow' | 'out-of-canvas' | 'fallback' | 'font-missing' | 'console-error' | 'scrolling-block'; level: 'problem' | 'note'; detail: string }`
- **Produces functions and globals:**
  - `findings(ms: Measurement[], fontsOk: { mali: boolean; mono: boolean }, consoleErrors: string[]): Finding[]`
  - `CheckPage({ part })`:
    - It renders the Part in `DeckModeContext = 'check'`, so each slide sits in a 1280 × 720 frame and a 390 × 844 frame.
    - After `document.fonts.ready`, it measures each frame and sets `window.__reactSlidesCheck = { part, findings, done: true }`.
    - It renders a findings table.

**The finding rules:**
- **Desktop:** prose with `scrollH > clientH` or `scrollW > clientW` once `fit` has reached 0.85 is a `prose-overflow` problem.
- **Phone:** only `scrollW > clientW` is a problem. Height is fine, because phone slides scroll.
- **Notes:** scrolling blocks are a `scrolling-block` note.
- **Other problems:**
  - an element outside the canvas
  - a fallback in use
  - `document.fonts.check('16px Mali')` or `('16px "JetBrains Mono"')` returning false
  - each console error captured since the page loaded

- [ ] **Step 1: Write the failing tests**

```ts
test('desktop prose overflow at minimum fit is a problem', () => { /* fit 0.85, scrollH 800 > clientH 600 → problem */ });
test('desktop overflow above minimum fit is not reported', () => { /* fit 0.9 → none (auto-fit still had room; measured after settling) */ });
test('phone height is fine but width is not', () => { /* phone scrollH > clientH → none; scrollW > clientW → problem */ });
test('scrolling blocks are notes', () => { /* scrollingBlocks 1 → level note */ });
test('fallback, fonts and console errors are problems', () => { /* … */ });
```

- [ ] **Step 2: Run the tests and see them fail.** **Step 3: Implement.** **Step 4: Run the tests and see them pass,** along with `npm run build`.
- [ ] **Step 5: Commit:** `feat(react-slides): add the check page that reports overflow, fallbacks and fonts`

---

### Task 14: End-to-end: the generated fixture course compiles, renders verbatim and builds

**Files:**
- Create: `skills/teaching/react-slides/tests/app/verbatim.test.tsx`, which is copied into the generated app by the test
- Create: `skills/teaching/react-slides/tests/test_app_build.py`

**Interfaces:**
- **Consumes:** `build_part.run`, `inline.visible_text`, `deck_reader.load` and the whole template

**What the test does:**
1. Skip with the message `run npm ci in skills/teaching/react-slides/template first` when `template/node_modules` is missing or `npm` is not on `PATH`.
2. Run `build_part.run(course, None, skip_install=True)` on the fixture course.
3. Symlink `web/node_modules` to the template's `node_modules`.
4. Write `web/src/expected.json`: for every slide of Part 1, `{ id, fields: { <prop name>: visible_text(field) or [visible_text(item), …] } }`.
5. Copy `verbatim.test.tsx` to `web/src/`.
6. Run `npx vitest run src/verbatim.test.tsx` in `web/`.
7. Run `npm run build` in `web/`.

**What `verbatim.test.tsx` does:**
- It renders each slide alone, through `DeckModeContext = 'check'`.
- It extracts the text of each field container (`[data-field="<prop>"]`) with `domText`. That function walks the DOM: text nodes give their data, `br` gives `"\n"`, and `p`, `li`, `ol`, `ul` and `div` give `"\n"` before and after. Runs of `"\n"` are collapsed and the result is stripped.
- It compares the result with `expected.json`.
- It relies on the `data-field` and `data-item` attributes from Task 9.

- [ ] **Step 1: Write the failing test**

```python
@needs_node
def test_fixture_course_compiles_renders_verbatim_and_builds(course):
    build_part.run(course, None, skip_install=True)
    web = course / "web"
    (web / "node_modules").symlink_to(TEMPLATE / "node_modules", target_is_directory=True)
    _write_expected(course, web)
    shutil.copy(HERE / "app" / "verbatim.test.tsx", web / "src" / "verbatim.test.tsx")
    _ok(["npx", "vitest", "run", "src/verbatim.test.tsx"], web)
    _ok(["npm", "run", "build"], web)
    html = (web / "dist" / "index.html").read_text(encoding="utf-8")
    assert 'src="/' not in html and 'href="/' not in html   # relative assets: works from a sub-path
```

- [ ] **Step 2: Run the test and see it fail.** Run: the Python command with `-k app_build`. Expected: FAIL. Typical first failures are a TS error in the generated TSX, or a field text mismatch.
- [ ] **Step 3: Fix the generator or the components** until the test passes. Never change the expected text to fit. Each mismatch is a bug in `inline.py`, `tsx_writer.py` or a layout.
- [ ] **Step 4: Run the full Python suite and both template commands.** Expected: all green.
- [ ] **Step 5: Commit:** `test(react-slides): build the fixture course end to end and check every field verbatim`

---

### Task 15: `SKILL.md`, references, acceptance checks and repo docs

**Files:**
- Create:
  - `skills/teaching/react-slides/SKILL.md`
  - `skills/teaching/react-slides/references/components.md`
  - `skills/teaching/react-slides/references/illustrator.md`
  - `skills/teaching/react-slides/references/visual-check.md`
  - `skills/teaching/react-slides/evals/acceptance.md`
- Modify: `AGENTS.md`, adding the react-slides test commands under `## Tests`
- Tests: `skills/teaching/react-slides/tests/test_skill_md.py` and `tests/test_references.py`

**What the files contain:**
- **`SKILL.md`:**
  - **Frontmatter:** `name: react-slides`. The description says to use it after `slide-design` to build a Part's deck as slides in the course's React web app for learners, and not to use it to deploy, write slide content, or make Google Slides.
  - **Body:** the procedure of spec §5.2, steps 0–6, with the exact commands:
    - `python3 <skill>/scripts/build_part.py <course_dir> <N>`, and `--all` / `--force` / `--skip-install`
    - `npm --prefix <course_dir>/web run build`
    - `npm --prefix <course_dir>/web run preview`
    - opening `http://localhost:4173/#/check/part-NN`, and reading `window.__reactSlidesCheck` once `done`
  - **The illustrator dispatch,** one per Part, with `subagent_type="general-purpose"` and no model:

    ```
    Draw the illustrations for Part <N> of the course in <course_dir>.

    Inputs: <course_dir>/web/_work/part-NN/visuals.json, <course_dir>/web/src/vocabulary.ts
    Output: one file per illustration key at <course_dir>/web/src/illustrations/part-NN/<key>.tsx

    As a first step, read <skill>/references/illustrator.md and follow it.
    ```

  - **The screenshot rules:** public pages only, never sign in, never type credentials.
  - **The report contents,** from spec step 6.
  - **"Without a subagent tool":** every role is done inline.
  - **"Without a browser tool":** skip screenshots and the check page, and say so.
  - **The reporting hook,** with the work folder `<course_dir>/web/_work/part-NN`, using the canonical text from `AGENTS.md`.
- **`components.md`:**
  - the component table from the Global Constraints
  - the text components
  - the `Sketch*` primitives
  - how to hand-edit a slide, for example by wrapping it in your own animated component
  - the warning that an edited file is skipped from then on
- **`illustrator.md`:**
  - **What to draw:** the `description`, with the `prompt` for detail.
  - **How:** only the `Sketch*` primitives, in a viewBox of `0 0 480 270`, with the role colours from `roleColour`, fixed `seedKey`s of the form `<key>/<part name>`, and labels of 24 characters at most in the deck language.
  - **When to skip:** a scene relying on faces, emotion or fine detail. Write no file, and reply with that key under `Skipped:`.
  - **The reply format:** `Drawn: <keys>`, `Skipped: <key> — <reason>`, and the `Skill problem:` line.
- **`visual-check.md`:**
  - how to run preview and read the check result
  - each finding kind and what may be fixed: the illustrations, or a template file only through a skill problem, never the slide text
  - one redo round
- **`evals/acceptance.md`:** a table mapping spec §7 checks 1–9 to the tests, and manual checks 10–11.
- **`AGENTS.md`:** add the `# react-slides` lines: the pytest command, plus `npm --prefix skills/teaching/react-slides/template ci && npm --prefix skills/teaching/react-slides/template test`.

- [ ] **Step 1: Write the failing tests**

```python
def test_frontmatter_name_and_description(): ...          # name == "react-slides"; description mentions slide-design and "Do not use"
def test_skill_md_names_every_command(): ...              # build_part.py, --all, --force, "run build", "run preview", "#/check/part-", "__reactSlidesCheck"
def test_skill_md_has_reporting_hook(): ...               # "## Reporting problems with this skill" and "web/_work/part-NN/skill-problems.md"
def test_screenshot_rules(): ...                          # "never sign in" and "credentials" in SKILL.md
def test_components_md_lists_every_component():
    text = (SKILL / "references" / "components.md").read_text(encoding="utf-8")
    for name in tsx_writer.COMPONENTS.values(): assert f"`{name}`" in text
def test_illustrator_brief(): ...                         # "Sketch", "roleColour", "Skipped:", "Skill problem:"
def test_agents_md_lists_react_slides_tests(): ...
```

- [ ] **Step 2: Run the tests and see them fail.** **Step 3: Write the files.** **Step 4: Run the full Python suite, the report-skill-issue suite (its `test_repo_hooks.py` now covers this skill), and both template commands.** Expected: all green.
- [ ] **Step 5: Commit:** `feat(react-slides): add SKILL.md, the illustrator and visual-check briefs, and acceptance checks`
