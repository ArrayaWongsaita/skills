# course-research Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `course-research` skill. It interviews the user for scope, researches a topic deeply, orders it into Parts and sub-topics, and writes one self-contained research file per Part, with code examples verified against fake LLM models.

**Architecture:** A coordinator `SKILL.md` drives six stages and dispatches researcher, writer and reviewer subagents. Their briefs live in `references/*.md`. Deterministic work runs as stdlib Python scripts that the coordinator calls: run state, structural validation, and the code-check harness. A single `contract.py` is the source of truth for the Part/overview template, which the downstream skill will read.

**Tech Stack:** Markdown (Agent Skills `SKILL.md`), Python ≥3.11 stdlib scripts, pytest run through `uv`, langchain-core fake chat models inside a per-course venv.

**Spec:** `docs/superpowers/specs/2026-11-22-course-research-skill-design.md` (read it first; this plan argues from it).

## Global Constraints

- Skill directory `skills/teaching/course-research/`. Frontmatter `name: course-research` must equal the directory name.
- Scripts the coordinator runs (`contract.py`, `frontmatter.py`, `course_state.py`, `validate_course.py`, `code_check/setup_env.py`, `code_check/check_code.py`) use the stdlib only and run on the system `python3` (≥3.11).
- `code_check/fake_models.py` and `code_check/run_snippet.py` run inside the per-course venv and may import `langchain_core` / `langchain`.
- Test command (every task): `uv run --no-project --python 3.12 --with pytest --with 'langchain==1.5.2' --with 'langgraph==1.2.24' pytest skills/teaching/course-research/tests -q`. These were the latest versions resolved on 2026-11-22. They pin the tests only. Course pins come from scope at runtime.
- Course package pins must be exact `==` pins. langchain and langgraph are always pinned together.
- Code verification never calls a real LLM and never needs an API key.
- Frontmatter in every generated file uses a JSON-compatible YAML subset: one `key: value` per line, and each value is a JSON literal (strings in double quotes, lists `[...]`, maps `{...}`). This is the parse rule for `frontmatter.py`.
- Part and overview headings are fixed English keys (values in `contract.py`). Body content is in the scope's output language, with established English technical terms kept.
- Repo documents and commit messages are in English. Commit after each task (conventional commits).
- Subagents are dispatched with `subagent_type="general-purpose"` and no `model` override.
- Plan decisions that refine the spec's illustrative template (§6.8):
  - The last Part section is the fixed key `## Bridge to next part`, not `## Bridge to Part N+1`.
  - Sub-topic slots are `####` headings.
  - Frontmatter lists are quoted JSON (`["O1", "O3"]`).
  - The overview also gets frontmatter (`OVERVIEW_FRONTMATTER_KEYS`).
  - Code examples are tagged with `<!-- snippet id="N.k-x" … -->` markers.

## Review Focus

1. A snippet that asks for an API key with `getpass.getpass()` or `input()` must not hang the check. It runs with a fake key (test in Task 5).
2. A snippet that waits forever (network, sleep) must end as unverified with reason `timeout after <n>s`, not stall the run (test in Task 6).
3. Running the code check twice must not duplicate status lines or markers (test in Task 6).
4. Thai text, emoji and every line outside the markers must survive `apply_results` byte-for-byte (test in Task 6).
5. Streaming examples (`model.stream(...)`, `agent.stream(...)`) must work under the fake model (test in Task 4).

---

### Task 1: Contract, frontmatter parser and test scaffold

**Files:**
- Create: `.gitignore` (`node_modules/`, `__pycache__/`, `*.py[cod]`, `.pytest_cache/`, `.DS_Store`)
- Create: `skills/teaching/course-research/scripts/contract.py`
- Create: `skills/teaching/course-research/scripts/frontmatter.py`
- Create: `skills/teaching/course-research/tests/conftest.py` (inserts `scripts/` and `scripts/code_check/` into `sys.path`; exposes fixture `skill_dir -> Path`)
- Test: `skills/teaching/course-research/tests/test_frontmatter.py`

**Interfaces:**
- Produces, in `contract.py` (constants only, exact values):
  ```python
  PART_TEMPLATE_ID = "course-research/part@1"
  OVERVIEW_TEMPLATE_ID = "course-research/overview@1"
  PART_FILE_RE = re.compile(r"^part-(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$")
  OVERVIEW_FILE = "00-overview.md"
  SCOPE_KEYS = ("course","title","language","delivery_mode","technical","runtime","python","packages","size","outcomes")
  DELIVERY_MODES = ("self-paced","instructor-led")
  SIZES = {"small": (1, 3), "medium": (4, 8), "large": (9, None)}
  PART_FRONTMATTER_KEYS = ("template","course","part","title","outcomes","prerequisite_parts","versions","code_status","generated")
  OVERVIEW_FRONTMATTER_KEYS = ("template","course","title","research_date","versions")
  CODE_STATUSES = ("verified","partial","unverified","none")
  PART_SECTIONS = ("Context","Objectives","Prerequisites and setup","Key terms","Core mental model","Real-world task","Sub-topics","Practice material","Bridge to next part","Further reading","Sources")
  SUBTOPIC_SLOTS = ("Core knowledge","Worked example","Analogy","Misconceptions","Common errors and fixes","Self-check","Sources")
  ALWAYS_REQUIRED_SLOTS = ("Core knowledge","Worked example","Sources")
  SELF_PACED_REQUIRED_SLOTS = ("Common errors and fixes","Self-check")
  SELF_PACED_REQUIRED_SECTIONS = ("Prerequisites and setup",)
  OVERVIEW_SECTIONS = ("Scope","Learning outcomes","Part map","Prerequisite map","Glossary","Freshness","Out of scope and further reading")
  TECHNICAL_ONLY_OVERVIEW_SECTIONS = ("Freshness",)
  STAGES = ("scope","scope-confirmed","broad-research","outline-draft","outline-approved","deep-research","writing","verifying","done")
  PART_STATUSES = ("pending","researched","written","checked")
  CODE_LANGS = frozenset({"python","py","javascript","js","typescript","ts"})
  PYTHON_LANGS = frozenset({"python","py"})
  SNIPPET_MARKER_RE = re.compile(r"^<!-- snippet (?P<attrs>.+?) -->$")
  SNIPPET_ID_RE = re.compile(r"^(?P<part>\d+)\.(?P<sub>\d+)-[a-z0-9]+$")
  EMPTY_SLOT = "_None._"
  EXPECTED_OUTPUT_LABEL = "**Expected output:**"
  UNVERIFIED_PREFIX = "> ⚠️ Unverified:"
  ```
- Produces, in `frontmatter.py`:
  - `class FrontmatterError(ValueError)`
  - `parse(text: str) -> tuple[dict, str]`: returns (data, body). `text` must start with `---\n`, and the block ends at the next line that is exactly `---`. Each line is `key: value`. `value` is `json.loads`-ed, and if that fails it is kept as the stripped raw string. A missing block, an unterminated block, or a line without `: ` raises `FrontmatterError`.
  - `render(data: dict) -> str`: `---\n` + `f"{k}: {json.dumps(v, ensure_ascii=False)}\n"` per key in insertion order + `---\n`.
  - `replace(text: str, data: dict) -> str`: the same body with a new frontmatter.

- [ ] **Step 1: Write the failing tests** in `test_frontmatter.py`
  - `test_parse_json_values`: `parse('---\ncourse: "lc"\npart: 2\noutcomes: ["O1", "O3"]\nversions: {"langchain": "1.5.2"}\n---\n# Body\n')` returns `({"course": "lc", "part": 2, "outcomes": ["O1","O3"], "versions": {"langchain": "1.5.2"}}, "# Body\n")`
  - `test_parse_bare_string_fallback`: `title: LangChain ภาษาไทย` parses to the string `"LangChain ภาษาไทย"`
  - `test_parse_errors`: no leading `---` / no closing `---` / the line `oops` → `FrontmatterError`
  - `test_render_roundtrip`: `parse(render(d) + "body")[0] == d` for a dict holding Thai strings, a list, a nested map and a bool; `render` keeps Thai unescaped
  - `test_replace_keeps_body`: the body after `replace` is byte-identical
- [ ] **Step 2: Run the test command.** Expected: FAIL (`ModuleNotFoundError: frontmatter`)
- [ ] **Step 3: Implement** `contract.py` (values above) and `frontmatter.py` (signatures above), plus `conftest.py` and `.gitignore`
- [ ] **Step 4: Run the test command.** Expected: PASS
- [ ] **Step 5: Commit**: `git add .gitignore skills/teaching/course-research && git commit -m "feat(course-research): add template contract and frontmatter parser"`

---

### Task 2: Run state (`course_state.py`)

**Files:**
- Create: `skills/teaching/course-research/scripts/course_state.py`
- Test: `skills/teaching/course-research/tests/test_course_state.py`

**Interfaces:**
- Consumes: `contract.STAGES`, `contract.PART_STATUSES`, `frontmatter.parse/render`.
- Produces:
  - `class StateError(ValueError)`
  - `STATE_PATH = Path("_work/state.md")` (relative to the course dir)
  - `new_state() -> dict` → `{"stage": "scope", "parts": {}, "updated": <today ISO>}`
  - `load_state(course_dir: Path) -> dict`, which raises `StateError("no state: run init")` when the file is missing; `save_state(course_dir: Path, state: dict) -> None`, which writes frontmatter keys `stage`, `parts`, `updated` plus a body table `| Part | Status |` regenerated on every save
  - `transition(state: dict, new_stage: str) -> dict`, with these rules:
    - Same stage → no-op.
    - Forward exactly one step along `STAGES`.
    - Backward only to `"scope"` or `"outline-draft"`, or to `"deep-research"` from `writing`/`verifying`/`done` when at least one part is `pending`. The last case is redoing Parts without re-approving the outline.
    - `deep-research → writing` requires every part `researched` or later. `writing → verifying` requires every part `written` or later. `verifying → done` requires every part `checked`.
    - `outline-approved → deep-research` requires at least one part.
    - Anything else raises `StateError`.
  - `set_parts(state, n: int) -> dict`: only at stage `outline-approved`. Sets parts `"1".."n"` to `"pending"` and keeps the existing status of parts that remain.
  - `set_part(state, part: int, status: str) -> dict`: only at stages `deep-research`/`writing`/`verifying`. Moves forward exactly one status.
  - `reset_parts(state, parts: list[int]) -> dict`: sets the parts to `"pending"`, allowed at any stage.
  - `next_action(state) -> str`: `"scope"` → `"interview the user and write _work/scope.md"`; `"deep-research"` with pending parts 2 and 3 → `"research parts 2, 3"`; `"writing"` with researched parts → `"write parts <list>"`; `"verifying"` with written parts → `"check parts <list>"`; `"done"` → `"nothing left; report to the user"`. Other stages name the stage's work in one phrase.
  - CLI: `python3 course_state.py {init|show|set-stage|set-parts|set-part|reset-parts} <course_dir> [args]`. `show` prints JSON `{"stage", "parts", "next_action"}`. Errors print `error: <msg>` to stderr and exit 1.

- [ ] **Step 1: Write the failing tests**
  - `test_init_and_show`: CLI `init` then `show` → stage `"scope"`, parts `{}`, next_action `"interview the user and write _work/scope.md"`
  - `test_forward_one_step_only`: `transition(scope→broad-research)` raises; `scope→scope-confirmed` works
  - `test_outline_gate`: `transition(outline-draft→deep-research)` raises; a state at `outline-approved` with `set_parts(…, 3)` goes to `deep-research`
  - `test_backward_to_outline_draft_keeps_part_statuses`
  - `test_writing_requires_all_researched`: parts `{"1":"researched","2":"pending"}` → `deep-research→writing` raises
  - `test_set_part_forward_one_status`: `pending→written` raises; `pending→researched` works
  - `test_reset_parts`
  - `test_redo_part_from_done`: stage `done`, all parts `checked` → `reset_parts([2])` then `transition(→deep-research)` works; with no pending part the same transition raises
  - `test_next_action_deep_research`: parts `{"1":"researched","2":"pending","3":"pending"}` → `"research parts 2, 3"`
  - `test_state_file_roundtrip_has_table`: `save_state` then `load_state` returns equal; the body contains `| 1 | pending |`
  - `test_show_without_state_exits_1`
- [ ] **Step 2: Run the test command.** Expected: FAIL (module missing)
- [ ] **Step 3: Implement** `course_state.py` to the interfaces above
- [ ] **Step 4: Run the test command.** Expected: PASS
- [ ] **Step 5: Commit**: `feat(course-research): add resumable run state`

---

### Task 3: Structural validator (`validate_course.py`)

**Files:**
- Create: `skills/teaching/course-research/scripts/validate_course.py`
- Create: `skills/teaching/course-research/tests/fixtures/valid-course/` containing `_work/scope.md`, `00-overview.md`, `part-01-first-agent.md`, `part-02-graphs.md`. It is a self-paced, technical Thai course with outcomes O1–O3. Part 2 has prerequisite `[1]`. Every slot is filled, every sub-topic has a URL in Sources, and every python block has a marker with `status="verified"` and an Expected output block. Both parts have `code_status: "verified"`.
- Test: `skills/teaching/course-research/tests/test_validate_course.py`

**Interfaces:**
- Consumes: `contract.*`, `frontmatter.parse`.
- Produces:
  - `@dataclass(frozen=True) class Issue: level: str  # "error" | "warning"; file: str; where: str; message: str`
  - `parse_marker(line: str) -> dict[str, str] | None`: parses `key="value"` attrs from a line matching `SNIPPET_MARKER_RE`. `&quot;` inside a value decodes to `"`. Shared with Task 6.
  - `computed_code_status(markers: list[dict]) -> str`: no markers → `"none"`; all `status == "verified"` → `"verified"`; none verified → `"unverified"`; otherwise `"partial"`. A missing `status` counts as unverified. Shared with Task 6.
  - `validate_part(path: Path, scope: dict) -> list[Issue]`, which checks:
    1. The frontmatter keys equal `PART_FRONTMATTER_KEYS`, `template == PART_TEMPLATE_ID`, `part` equals the filename number, `course == scope["course"]`, `code_status in CODE_STATUSES` and `== computed_code_status(markers)`. `versions` is a non-empty map when `scope["technical"]`, otherwise `{}`.
    2. The H1 is `# Part {N}: {title}` and matches the frontmatter title.
    3. The H2 headings equal `PART_SECTIONS` exactly, in order. Missing, extra and out-of-order headings are errors.
    4. Under `## Sub-topics` there is at least one `### {N}.{k} <title>`, with k running 1..m with no gaps. Each sub-topic has `#### <slot>` for every `SUBTOPIC_SLOTS` entry, in order.
    5. Slot content (the non-blank lines before the next heading):
       - Must be non-empty everywhere; `EMPTY_SLOT` counts as content.
       - Must not be just `EMPTY_SLOT` in `ALWAYS_REQUIRED_SLOTS`.
       - When `delivery_mode == "self-paced"`, also must not be just `EMPTY_SLOT` in `SELF_PACED_REQUIRED_SLOTS` and `SELF_PACED_REQUIRED_SECTIONS`.
    6. Every sub-topic `Sources` slot and the part-level `## Sources` hold at least one `http://` or `https://` URL.
    7. When technical:
       - Every fenced block whose info string is in `CODE_LANGS` is preceded (blank lines skipped) by a snippet marker.
       - Each marker `id` matches `SNIPPET_ID_RE` with `part == N`.
       - A marker before a non-Python block must carry `skip`.
       - When self-paced, each marked block is followed (blank lines and one `UNVERIFIED_PREFIX` line skipped) by a line exactly `EXPECTED_OUTPUT_LABEL` and then a fenced block.
  - `validate_course(course_dir: Path) -> list[Issue]`, which checks:
    - `_work/scope.md` frontmatter has `SCOPE_KEYS` with valid enums. `packages` entries all contain `==` when `technical`.
    - `00-overview.md` has `OVERVIEW_FRONTMATTER_KEYS`, `template == OVERVIEW_TEMPLATE_ID` and the H2 sequence `OVERVIEW_SECTIONS`. `TECHNICAL_ONLY_OVERVIEW_SECTIONS` may be absent when not technical.
    - Every scope outcome id appears in the `Learning outcomes` section. Every part title appears in `Part map`.
    - Top-level `.md` files other than the overview all match `PART_FILE_RE`, numbered 01..n with no gaps.
    - `validate_part` passes for each part.
    - Each part's `outcomes` is non-empty and a subset of scope outcomes, and their union covers all scope outcomes.
    - `prerequisite_parts` entries are < N and exist.
    - Snippet ids are unique across the course.
  - CLI: `python3 validate_course.py <course_dir> [--json]` prints `ERROR <file>:<where>: <message>` (or JSON). Exit 1 if any error, else 0.

- [ ] **Step 1: Build the `valid-course` fixture and write the failing tests.** Each negative test copies the fixture to `tmp_path` and applies one edit:
  - `test_valid_course_has_no_issues`: `validate_course(fixture) == []`
  - `test_missing_section`: delete `## Core mental model` from part 1 → an error with `where` naming that section
  - `test_sections_out_of_order`: swap `## Key terms` and `## Context` → error
  - `test_subtopic_numbering_gap`: rename `### 1.2` to `### 1.3` → error
  - `test_self_paced_requires_self_check`: set part 1's `#### Self-check` content to `_None._` → error; the same edit with scope `delivery_mode: "instructor-led"` → no error
  - `test_subtopic_sources_need_url` → error
  - `test_python_block_without_marker` → error
  - `test_expected_output_required_when_self_paced` → error
  - `test_code_status_must_match_markers`: set one marker `status="unverified"` while frontmatter says `"verified"` → error naming `"partial"`
  - `test_outcome_not_covered`: add `"O4"` to scope only → error
  - `test_forward_prerequisite`: part 1 `prerequisite_parts: [2]` → error
  - `test_part_numbering_gap`: rename `part-02-…` to `part-03-…` → error
  - `test_unpinned_package`: scope `packages: ["langchain"]` → error
  - `test_duplicate_snippet_id` → error
  - `test_cli_exit_codes`: 0 on the fixture, 1 after one breaking edit
- [ ] **Step 2: Run the test command.** Expected: FAIL (module missing)
- [ ] **Step 3: Implement** `validate_course.py` to the interfaces above
- [ ] **Step 4: Run the test command.** Expected: PASS
- [ ] **Step 5: Commit**: `feat(course-research): add structural course validator`

---

### Task 4: Fake models (`code_check/fake_models.py`)

**Files:**
- Create: `skills/teaching/course-research/scripts/code_check/fake_models.py`
- Test: `skills/teaching/course-research/tests/test_fake_models.py`

**Interfaces:**
- Produces:
  - `DEFAULT_RESPONSE = "This is a scripted reply from the course-research fake model."`
  - `class FixtureError(ValueError)` and `class FixtureExhausted(RuntimeError)`, whose message is `"fixture ran out of scripted responses after {n} calls"`
  - `load_fixture(path: Path | None) -> list[dict] | None`: `None` or a missing file → `None`. The file is a JSON object `{"responses": [entry, ...]}`. Each entry has at least one of `content: str`, `tool_calls: [{"name": str, "args": dict, "id"?: str}]` and `structured: dict`. A missing tool-call `id` is filled as `call_{i}`. Anything else raises `FixtureError`.
  - `class ScriptedChatModel(GenericFakeChatModel)` (from `langchain_core.language_models.fake_chat_models`):
    - `bind_tools(self, tools, **kwargs) -> "ScriptedChatModel"` returns `self`.
    - `with_structured_output(self, schema, **kwargs) -> Runnable` returns a `RunnableLambda` that takes the next scripted message and `json.loads` its content. It returns `schema.model_validate(data)` when `schema` is a pydantic `BaseModel` subclass, else `data`.
  - `build_model(entries: list[dict] | None, queue: Iterator[AIMessage] | None = None) -> ScriptedChatModel`: `entries=None` → an endless cycle of `AIMessage(DEFAULT_RESPONSE)`. Otherwise it yields one `AIMessage` per entry (`structured` entries become `content=json.dumps(structured)`) and raises `FixtureExhausted` when they run out. Every model created during one snippet run shares one queue, in call order.
  - `install_fakes(entries: list[dict] | None) -> int`:
    - Imports `langchain.chat_models`, `langchain.agents` and `langchain.embeddings` (each skipped on `ImportError`).
    - Replaces every attribute in `sys.modules` that `is` the original `init_chat_model` with a fake returning `build_model(entries, shared_queue)`, and every attribute that `is` the original `init_embeddings` with a fake returning `DeterministicFakeEmbedding(size=256)`.
    - Sets `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY` and `TAVILY_API_KEY` to `"fake-key"` when unset.
    - Patches `getpass.getpass` to return `"fake-key"` and `builtins.input` to return `""`.
    - Returns the number of replaced references.
    - The sys.modules sweep was confirmed during planning against langchain 1.5.2: 8 references, and `create_agent(model="openai:gpt-5")` routed to the fake.

- [ ] **Step 1: Write the failing tests** (each calls `install_fakes` inside a subprocess or restores the patched modules afterwards, so the tests stay isolated)
  - `test_default_model_cycles_default_response`: `build_model(None)` invoked 3× → each `.content == DEFAULT_RESPONSE`
  - `test_fixture_exhausted`: 1 entry, invoke 2× → `FixtureExhausted` with `"after 1 calls"`
  - `test_create_agent_with_tool_call`: entries `[{"tool_calls":[{"name":"get_weather","args":{"city":"Bangkok"}}]},{"content":"Sunny in Bangkok"}]`, `install_fakes`, then a real `@tool get_weather` and `create_agent(model="openai:gpt-5", tools=[get_weather]).invoke(...)` → the last message content is `"Sunny in Bangkok"` and a `ToolMessage` exists
  - `test_init_chat_model_returns_fake`: after `install_fakes(None)`, `from langchain.chat_models import init_chat_model; init_chat_model("anthropic:x")` is a `ScriptedChatModel`
  - `test_structured_output_pydantic`: entry `{"structured":{"name":"Ann","age":3}}` → `with_structured_output(Person).invoke("x") == Person(name="Ann", age=3)`
  - `test_stream_yields_scripted_content` (Review Focus 5): entry `{"content":"hello world"}` → `"".join(c.content for c in model.stream("x")) == "hello world"`
  - `test_init_embeddings_fake`: `init_embeddings("openai:text-embedding-3-small").embed_query("x")` has length 256
  - `test_bad_fixture_raises`: `{"responses":[{}]}` → `FixtureError`
- [ ] **Step 2: Run the test command.** Expected: FAIL (module missing)
- [ ] **Step 3: Implement** `fake_models.py` to the interfaces above
- [ ] **Step 4: Run the test command.** Expected: PASS
- [ ] **Step 5: Commit**: `feat(course-research): add scripted fake models for code checks`

---

### Task 5: Snippet runner (`code_check/run_snippet.py`)

**Files:**
- Create: `skills/teaching/course-research/scripts/code_check/run_snippet.py`
- Test: `skills/teaching/course-research/tests/test_run_snippet.py`

**Interfaces:**
- Consumes: `fake_models.load_fixture`, `fake_models.install_fakes`. `fake_models` is imported only when `importlib.util.find_spec("langchain_core")` is not None, so plain-Python courses run their snippets as they are.
- Produces the CLI `python run_snippet.py <snippet.py> --result <result.json> [--fixture <fixture.json>]`. It always writes the result JSON and exits 0, so a crash is detected by a missing result file.
  - The result is `{"status": "verified"|"failed", "reason": str|null, "deprecations": [str]}`.
  - The snippet runs through `runpy.run_path(path, run_name="__main__")` inside `warnings.catch_warnings(record=True)` with `simplefilter("always")`.
  - A deprecation is any recorded warning whose category subclasses `DeprecationWarning` or `PendingDeprecationWarning`, and whose `filename` is the snippet path or whose category `__module__` starts with `langchain` or `langgraph`.
  - The status is `failed` on an exception (`reason = f"{type(e).__name__}: {e}"`), or else on deprecations (`reason = "deprecated: " + first message`).

- [ ] **Step 1: Write the failing tests** (they run the CLI with `sys.executable` in a subprocess against snippet files in `tmp_path`)
  - `test_ok_snippet_verified`: `print(1)` → `verified`, `reason` null
  - `test_exception_failed`: `raise ValueError("boom")` → `failed`, `reason == "ValueError: boom"`
  - `test_langgraph_deprecation_failed`: `from langgraph.prebuilt import create_react_agent` + `create_react_agent(init_chat_model("openai:x"), tools=[])` → `failed`, with `reason` starting `"deprecated: "`. Planning confirmed this emits `LangGraphDeprecatedSinceV10`, a `DeprecationWarning`.
  - `test_unrelated_third_party_warning_ignored`: a snippet that imports a helper module from `tmp_path`, and that helper issues `warnings.warn("x", DeprecationWarning)` → `verified`
  - `test_getpass_prompt_does_not_hang` (Review Focus 1): `import getpass, os; os.environ["OPENAI_API_KEY"] = getpass.getpass("key: ")`, run with `stdin=DEVNULL` and a 20s timeout → `verified`
  - `test_fixture_flag_used`: fixture `{"responses":[{"content":"from fixture"}]}` + a snippet printing `init_chat_model("openai:x").invoke("q").content` → stdout contains `from fixture`
- [ ] **Step 2: Run the test command.** Expected: FAIL (file missing)
- [ ] **Step 3: Implement** `run_snippet.py`
- [ ] **Step 4: Run the test command.** Expected: PASS
- [ ] **Step 5: Commit**: `feat(course-research): add sandboxed snippet runner`

---

### Task 6: Environment setup and code-check orchestration

**Files:**
- Create: `skills/teaching/course-research/scripts/code_check/setup_env.py`
- Create: `skills/teaching/course-research/scripts/code_check/check_code.py` (it inserts `scripts/` into `sys.path` to import `contract`, `frontmatter` and `validate_course.parse_marker` / `computed_code_status`)
- Test: `skills/teaching/course-research/tests/test_setup_env.py`, `skills/teaching/course-research/tests/test_check_code.py`

**Interfaces:**
- Consumes: Task 3 `parse_marker`, `computed_code_status`; Task 5 runner CLI; `frontmatter.parse/replace`.
- Produces, in `setup_env.py`:
  - `ENV_DIR = Path("_work/code-check/.venv")` and `STAMP = Path("_work/code-check/env.json")`
  - `build_commands(env_dir: Path, python_version: str, packages: list[str], have_uv: bool) -> list[list[str]]`:
    - uv → `[["uv","venv","--python",python_version,str(env_dir)], ["uv","pip","install","--python",str(env_dir/"bin"/"python"),*packages]]`
    - no uv → `[[sys.executable,"-m","venv",str(env_dir)], [str(env_dir/"bin"/"python"),"-m","pip","install",*packages]]`
  - CLI `python3 setup_env.py <course_dir>`:
    - Reads `python`/`packages` from scope and refuses any package without `==` (exit 1).
    - Skips the install when the stamp matches `{python, packages}`.
    - Otherwise recreates the env and writes the stamp `{"python", "packages", "resolved": {name: version}}`, read through `importlib.metadata` inside the env.
    - Prints the env python path.
- Produces, in `check_code.py`:
  - `@dataclass(frozen=True) class Snippet: id: str; part: int; lang: str; code: str; skip: str | None; marker_line: int; fence_end_line: int`
  - `@dataclass(frozen=True) class Result: id: str; status: str  # "verified" | "unverified"; reason: str | None; stdout: str`
  - `extract_snippets(part_path: Path) -> list[Snippet]`: each marker plus the fenced block that follows it
  - `run_one(snippet: Snippet, python: Path, work_dir: Path, timeout: int = 60) -> Result`:
    - Skips with a reason → unverified with that reason, not run.
    - Non-Python without a skip → unverified, `"non-Python snippet; v1 checks Python only"`.
    - Otherwise writes `work_dir/snippets/<id>.py` and runs the runner with `cwd=work_dir/snippets`, `stdin=DEVNULL` and `--fixture work_dir/fixtures/<id>.json` when that file exists.
    - A timeout → unverified, `f"timeout after {timeout}s"`. A missing result file → unverified, `"runner crashed: " + last stderr line`. Runner `failed` → unverified with its reason.
  - `apply_results(part_path: Path, results: dict[str, Result], checked_on: str) -> None`:
    - Rewrites each marker as `<!-- snippet id="…" [skip="…"] status="verified|unverified" [reason="…"] checked="YYYY-MM-DD" -->`, with `"` escaped as `&quot;`.
    - Removes any `UNVERIFIED_PREFIX` line directly after the closing fence, then inserts `f"{UNVERIFIED_PREFIX} {reason}"` there for unverified results.
    - Sets frontmatter `code_status` through `computed_code_status`. Nothing else in the file changes.
  - CLI `python3 check_code.py <course_dir> [--python PATH] [--part N ...] [--timeout 60]`:
    - The default python is `<course_dir>/_work/code-check/.venv/bin/python`.
    - Writes `_work/code-check/results.json` as `{id: {status, reason, stdout}}`, merged with earlier runs.
    - Prints one line per unverified snippet.
    - Exit codes: 0 when all are verified, 2 when some are unverified, 1 on a harness error.

- [ ] **Step 1: Write the failing tests.** `test_check_code.py` uses a part file in `tmp_path` holding Thai prose, an emoji and three markers:
  - `1.1-a`, good: `create_agent` with a fixture tool call
  - `1.1-b`: `from langgraph.prebuilt import create_react_agent` used
  - `1.2-a`: `skip="needs a real Postgres server"`

  The CLI runs with `--python sys.executable`.
  - `test_build_commands_uv` / `test_build_commands_venv`: the exact lists above
  - `test_setup_refuses_unpinned`: scope `packages: ["langchain"]` → exit 1, with no env created
  - `test_extract_snippets`: 3 snippets with correct ids, langs and skip
  - `test_check_code_results`: `1.1-a` verified, `1.1-b` unverified with reason starting `"deprecated: "`, `1.2-a` unverified with reason `"needs a real Postgres server"`; exit code 2; `code_status` becomes `"partial"`
  - `test_unverified_line_inserted_after_fence`: the line after `1.1-b`'s closing fence starts with `UNVERIFIED_PREFIX`
  - `test_apply_results_idempotent` (Review Focus 3): running the CLI twice → the file is identical after the second run, with exactly one `UNVERIFIED_PREFIX` line per unverified snippet
  - `test_apply_results_preserves_other_content` (Review Focus 4): strip the marker lines, the `UNVERIFIED_PREFIX` lines and the frontmatter from both the original and the rewritten file; the remainders are byte-identical, Thai and emoji included
  - `test_timeout_marks_unverified` (Review Focus 2): snippet `import time; time.sleep(5)` with `--timeout 1` → reason `"timeout after 1s"`
  - `test_results_json_merged`: a run with `--part 1` keeps earlier entries for other parts
- [ ] **Step 2: Run the test command.** Expected: FAIL (modules missing)
- [ ] **Step 3: Implement** `setup_env.py` and `check_code.py` to the interfaces above
- [ ] **Step 4: Run the test command.** Expected: PASS
- [ ] **Step 5: Commit**: `feat(course-research): add code-check environment and orchestration`

---

### Task 7: Template and code-check references

**Files:**
- Create: `skills/teaching/course-research/references/part-template.md`
- Create: `skills/teaching/course-research/references/code-check.md`
- Test: `skills/teaching/course-research/tests/test_references.py`

**Interfaces:**
- Consumes: `contract.*`, the Task 6 CLI and marker syntax, the Task 4 fixture format.
- Produces:
  - **`part-template.md`** is the writer-facing contract, which the downstream skill also reads. It contains:
    - The frontmatter rules (JSON-compatible values), with a complete example frontmatter.
    - A Part skeleton between `<!-- skeleton:part -->` and `<!-- /skeleton:part -->`, an overview skeleton between `<!-- skeleton:overview -->` and `<!-- /skeleton:overview -->`, and one line of guidance per section and slot (from spec §6.8).
    - The required-slot rules per delivery mode, with `_None._` for an intentionally empty optional slot.
    - The citation rule: facts, numbers, API behaviour and claims about practice carry inline `[Source](URL)`. Analogies are marked authored.
    - Outdated patterns go under `Misconceptions` with "how to recognise it".
    - The snippet marker syntax, the `**Expected output:**` rule, and labelling fake-model output as illustrative ("a real LLM's wording will differ").
    - The template version note (`part@1`, a breaking change if headings or keys change).
  - **`code-check.md`** gives the snippet conventions:
    - Each snippet is standalone and runnable top to bottom.
    - Models come only from `init_chat_model("provider:model")` or model strings such as `create_agent(model="provider:model")`. Provider classes like `ChatOpenAI` fail the check, by design.
    - Embeddings come from `init_embeddings`. Vector stores use `InMemoryVectorStore`.
    - Network and external services → `skip="<reason>"`.
    - It documents the fixture format, with tool-call and structured examples. Structured agents (`create_agent(response_format=…)`) are scripted as a tool call named after the schema.
    - It explains how to read `results.json`, and the revision loop: at most 2 rounds per failing snippet, then leave it unverified.

- [ ] **Step 1: Write the failing tests**
  - `test_part_skeleton_matches_contract`: the H2 sequence inside the part skeleton `== PART_SECTIONS`; the `####` sequence under its first `###` `== SUBTOPIC_SLOTS`; the frontmatter keys in the skeleton `== PART_FRONTMATTER_KEYS`
  - `test_overview_skeleton_matches_contract`: H2 `== OVERVIEW_SECTIONS`; frontmatter keys `== OVERVIEW_FRONTMATTER_KEYS`
  - `test_code_check_doc_names_conventions`: `code-check.md` contains `init_chat_model`, `skip="`, `"responses"`, `results.json` and `check_code.py`
- [ ] **Step 2: Run the test command.** Expected: FAIL (files missing)
- [ ] **Step 3: Write both reference files**
- [ ] **Step 4: Run the test command.** Expected: PASS
- [ ] **Step 5: Commit**: `docs(course-research): add part template and code-check references`

---

### Task 8: Role references (interview, research, outline, writing, review)

**Files:**
- Create: `skills/teaching/course-research/references/scope-interview.md`
- Create: `skills/teaching/course-research/references/researcher.md`
- Create: `skills/teaching/course-research/references/outline.md`
- Create: `skills/teaching/course-research/references/part-writer.md`
- Create: `skills/teaching/course-research/references/consistency-review.md`
- Modify: `skills/teaching/course-research/tests/test_references.py`

**Interfaces:**
- Consumes: spec §6.2–§6.6, `contract.SCOPE_KEYS`, `references/part-template.md`, `references/code-check.md`.
- Produces what each file must decide (the writer authors the prose):
  - **`scope-interview.md`** (coordinator-facing):
    - Ask one question at a time, in the user's language, and skip anything already answered.
    - Each `SCOPE_KEYS` field gets a question. Outcomes must be observable verbs, numbered `O1..On`, never "understand".
    - Defaults: `language` = the user's language; `python: "3.12"`; `packages` filled after broad research; `size: "medium"`.
    - Gives the exact `_work/scope.md` layout: frontmatter in `SCOPE_KEYS` order, then a prose body with boundaries, must-include/avoid and constraints.
    - Ends with a playback for the user to confirm.
  - **`researcher.md`** (subagent-facing): one brief that serves both modes.
    - Broad mode gets one perspective: Beginner / Practitioner / Teacher / Existing curricula / Current state. The table is in spec §6.3. Existing curricula records each curriculum's date and version.
    - Deep mode gets one Part's objectives, its sub-topics, and the slots to fill.
    - Research loop: gaps → search (short queries) → fetch full pages → reflect.
    - Budget: broad about 12 tool calls with a hard cap of 15; deep about 15 with a hard cap of 20.
    - Source rules from spec §6.3: primary over aggregator, official docs/changelog/migration guides first for technical topics, version + date on version-specific facts, pre-current-major tutorials used only for "how outdated code looks".
    - Note format: per question `Takeaway / Cited findings / Inferences / Gaps`, inline `[Source](URL)` on every finding, never fabricate.
    - Writes to the absolute path it is given.
  - **`outline.md`** (coordinator-facing): spec §6.4 steps 1–6.
    - The evidence tags `Strong`, `Supporting` and `Inferred`, with their exact definitions.
    - The outcome→Part coverage rule and the size range from `contract.SIZES`.
    - Glossary format: a table `| Term | Meaning | English term |`.
    - The `_work/outline.md` layout.
    - How to present it at the gate: Parts, sub-topics, outcomes, evidence tags, with Inferred edges flagged.
    - Setting exact `==` pins in scope from the Current-state notes before the gate, and showing them at the gate.
  - **`part-writer.md`** (subagent-facing):
    - Inputs: scope, approved outline + glossary, the Part's notes, and the relevant broad notes.
    - Must follow `part-template.md` and `code-check.md`. Writes the file and any fixtures to `_work/code-check/fixtures/<id>.json`.
    - Sets `code_status: "unverified"` until the check runs (`"none"` when the Part has no code).
    - Sets `versions` from `_work/code-check/env.json` `resolved` when technical, else `{}`. Sets `generated` to today.
    - Revision mode gets a list of issues (validator, code check, or reviewer) and fixes only those.
    - Never invents a source.
  - **`consistency-review.md`** (subagent-facing, read-only):
    - Checks that each Part's `Bridge to next part` matches the next Part's `Prerequisites and setup`/`Context`.
    - Checks that glossary terms are used consistently.
    - Checks that every factual claim is cited.
    - Checks that no deprecated API appears outside `Misconceptions`.
    - Checks that each Part can be understood without the others.
    - Reports issues as `part-NN | heading | problem | suggested fix`. It does not edit.

- [ ] **Step 1: Add failing tests to `test_references.py`**
  - `test_scope_interview_covers_scope_keys`: every `SCOPE_KEYS` entry appears in `scope-interview.md`
  - `test_researcher_perspectives_and_format`: contains `Beginner`, `Practitioner`, `Teacher`, `Existing curricula`, `Current state`, `Takeaway`, `Cited findings`, `Inferences`, `Gaps`
  - `test_outline_evidence_tags`: contains `Strong`, `Supporting`, `Inferred`
  - `test_writer_links_contracts`: `part-writer.md` contains `part-template.md` and `code-check.md`
  - `test_review_output_format`: `consistency-review.md` contains `part-NN | heading | problem | suggested fix`
- [ ] **Step 2: Run the test command.** Expected: FAIL
- [ ] **Step 3: Write the five reference files**
- [ ] **Step 4: Run the test command.** Expected: PASS
- [ ] **Step 5: Commit**: `docs(course-research): add interview, research, outline, writer and review briefs`

---

### Task 9: Coordinator `SKILL.md`

**Files:**
- Create: `skills/teaching/course-research/SKILL.md`
- Test: `skills/teaching/course-research/tests/test_skill_md.py`

**Interfaces:**
- Consumes: every script CLI (Tasks 2, 3, 6) and every reference (Tasks 7, 8).
- Produces a `SKILL.md` that decides the following (the writer authors the prose; keep it under about 300 lines and push detail into the references):
  - **Frontmatter:** `name: course-research`. The description (≤1024 chars) says when to use it: deep research on a topic to build teaching or learning material, organised into Parts and sub-topics, with per-Part research files that a later media-design step consumes. It also says when not to: one-off questions (use `deep-research`), or making slides directly.
  - **Role:** the coordinator. It talks with the user in the user's language.
  - **Script paths** are relative to this skill's base directory.
  - **Stage 0:**
    - The course dir is `<cwd>/courses/<course-slug>/`, with a lowercase-kebab ASCII slug.
    - When the dir exists, run `course_state.py show` and offer continue / redo Part(s) (`reset-parts`) / change outline (`set-stage outline-draft`) / restart (`set-stage scope`). Otherwise `init`.
  - **Stage 1:** interview per `references/scope-interview.md`, write `_work/scope.md`, play it back. On confirmation, `set-stage scope-confirmed`.
  - **Before Stage 2:**
    - Tell the user how many researchers will run: 4 broad, or 5 when technical, plus one per Part later.
    - Then `set-stage broad-research` and dispatch all broad researchers in one turn.
    - The prompt template has these fields: perspective, topic, scope summary, key questions, constraints, the absolute output path `_work/research/broad/<perspective>.md`, and "first read `<skill>/references/researcher.md`".
  - **Stage 3:**
    - `set-stage outline-draft`. The coordinator itself builds the outline per `references/outline.md`, sets the pins in scope, and presents it at the gate. It loops until the user approves.
    - Then `set-stage outline-approved` → `set-parts <n>` → `set-stage deep-research`.
    - Never dispatch deep research before approval.
  - **Stage 4:** one researcher per Part, at most 5 in parallel per turn. Output goes to `_work/research/parts/part-NN.md`, then `set-part N researched`. Then `set-stage writing`.
  - **Stage 5:**
    - Technical topics run `setup_env.py` first.
    - Writers go one per Part, at most 5 per turn, followed by `set-part N written`.
    - The coordinator writes `00-overview.md` from `part-template.md`'s overview skeleton, with `research_date` = today and `versions` from `env.json` `resolved`.
    - Then `set-stage verifying` and `check_code.py`. Unverified snippets go back to their writer in revision mode, for up to 2 rounds.
    - Then `validate_course.py`. Errors go back to the writers until it exits 0.
    - Then one `consistency-review` subagent. Its issues go back to the writers, then validate again.
    - Then `set-part N checked` for each Part, and `set-stage done`.
  - **Stage 6:** report the course dir path, the Part list, unverified snippets with reasons, and research gaps. Do not paste the documents.
  - **Effort scaling** follows the size in `contract.SIZES`. When the approved outline exceeds the size range, the gate must say so.
  - **No Agent tool:**
    - Run the roles inline in sequence, writing the same files.
    - Broad research becomes 3 notes: beginner+teacher, practitioner+curricula, current state.
    - The budget is about 8 tool calls per note.
  - **Subagent dispatch** uses `subagent_type="general-purpose"` with no `model`.

- [ ] **Step 1: Write the failing tests**
  - `test_frontmatter_name_matches_dir`: `name == "course-research"`; the description is non-empty and ≤1024 chars
  - `test_links_every_reference`: every file in `references/` is mentioned by relative path
  - `test_mentions_every_script_cli`: contains `course_state.py`, `validate_course.py`, `setup_env.py`, `check_code.py`
  - `test_mentions_both_gates`: contains `scope-confirmed` and `outline-approved`, and every `STAGES` value appears
- [ ] **Step 2: Run the test command.** Expected: FAIL (file missing)
- [ ] **Step 3: Write `SKILL.md`**
- [ ] **Step 4: Run the test command.** Expected: PASS (the whole suite)
- [ ] **Step 5: Commit**: `feat(course-research): add coordinator SKILL.md`

---

### Task 10: Acceptance run (LangChain + LangGraph), interactive with the human partner

**Files:**
- Create: `skills/teaching/course-research/evals/acceptance.md`, holding spec §8's 7 checks as a checklist, the run recipe and a results table
- The run output goes to `<scratchpad or a test cwd>/courses/langchain-langgraph/`. It is not committed.

**Interfaces:**
- Consumes: the installed skill, all scripts.
- This task runs in the main session, because the human partner answers the scope questions and approves the outline. The inputs are: topic LangChain + LangGraph, self-paced, Thai output, `size: "small"` (1–3 Parts) to bound cost.

- [ ] **Step 1: Write `evals/acceptance.md`** and commit it: `test(course-research): add acceptance checklist`
- [ ] **Step 2: Make the skill loadable (ask the human partner first; this touches `~/.claude/skills`):** `ln -s "$PWD/skills/teaching/course-research" ~/.claude/skills/course-research` (remove the link afterwards if the human partner prefers `npx skills add`)
- [ ] **Step 3: Run the skill end to end.** Interrupt once after Stage 4 starts and invoke it again. Expected: it resumes from `course_state.py show` (check 7)
- [ ] **Step 4: Verify.** `python3 scripts/validate_course.py <course_dir>` → exit 0. `python3 scripts/code_check/check_code.py <course_dir>` → exit 0 or 2, with every unverified snippet carrying a reason. `grep -rn "create_react_agent\|LLMChain" <course_dir>/part-*.md` → hits only under `#### Misconceptions` (check 4). Then tick checks 1–7 in `acceptance.md`, with evidence.
- [ ] **Step 5: Commit** the filled-in results table: `test(course-research): record first acceptance run`
