# Code-check conventions

A self-paced learner who hits broken code has no one to ask, so every code example is run before the course ships. The check runs each snippet against **scripted fake models**. It needs no API keys and costs nothing. It catches what goes wrong most often with fast-moving libraries: imports that moved, signatures that changed, deprecated APIs. It cannot judge the quality of a real LLM's answer.

v1 checks Python. Other languages are marked unverified.

## What a snippet must look like

- **Standalone.** Each snippet runs top to bottom in a fresh interpreter, with its own imports and setup. Repeat setup lines rather than relying on an earlier snippet.
- **Models through the factory.** Get chat models with `init_chat_model("openai:gpt-5")`, or pass a model string: `create_agent(model="openai:gpt-5", tools=[...])`. Provider classes such as `ChatOpenAI` or `ChatAnthropic` fail the check by design. Their packages are not installed in the check environment, and LangChain 1.x documentation leads with `init_chat_model`.
- **Embeddings and stores.** Use `init_embeddings("openai:text-embedding-3-small")`, which returns deterministic 256-dimension fake vectors during the check. Use `InMemoryVectorStore` from `langchain_core.vectorstores` for vector-store examples.
- **API keys.** A snippet may read `os.environ["OPENAI_API_KEY"]` or ask with `getpass.getpass(...)`. During the check both return `"fake-key"`.
- **No real network services.** Web loaders, search tools, databases and hosted services get `skip="<what real service it needs>"` on the marker, for example `<!-- snippet id="2.3-a" skip="needs a Tavily API key and network access" -->`.
- **Current APIs only.** A deprecation warning raised by the snippet, or by LangChain or LangGraph, fails the check.
- **Fast.** Each snippet has 60 seconds by default.

## Scripting the fake model

Without a fixture, every model call returns `This is a scripted reply from the course-research fake model.`. That is enough for a plain `invoke` example.

When the snippet needs specific replies (tool calls, structured output, several turns), the writer saves a fixture at `_work/code-check/fixtures/<snippet-id>.json`:

```json
{"responses": [
  {"tool_calls": [{"name": "get_weather", "args": {"city": "Bangkok"}}]},
  {"content": "It is sunny in Bangkok."}
]}
```

- Each entry is one model call and has `content`, `tool_calls` and/or `structured`.
- Every model in one snippet reads from the same queue, in call order. Script exactly the calls the snippet makes. Running out raises `FixtureExhausted` and fails the snippet.
- A tool call needs `name` and `args`. The `id` is filled in when missing.
- `model.with_structured_output(Schema)` reads the next entry's `structured` object:
  ```json
  {"responses": [{"structured": {"name": "Ann", "age": 3}}]}
  ```
- `create_agent(model=..., response_format=Schema)` is scripted as a **tool call named after the schema class** (confirmed with langchain 1.5.2):
  ```json
  {"responses": [{"tool_calls": [{"name": "Weather", "args": {"city": "Bangkok", "summary": "sunny"}}]}]}
  ```
- `model.stream(...)` yields the scripted content in word-sized chunks.

## Running the check

```bash
python3 <skill>/scripts/code_check/setup_env.py <course_dir>   # once per pin set; prints the env python
python3 <skill>/scripts/code_check/check_code.py <course_dir>  # whole course
python3 <skill>/scripts/code_check/check_code.py <course_dir> --part 2 --part 3
```

`setup_env.py` builds `_work/code-check/.venv` from the exact `==` pins in scope and records the resolved versions in `_work/code-check/env.json`.

`check_code.py` exits with:
- 0 when every snippet is verified
- 2 when some are unverified
- 1 when the harness itself failed

It rewrites each marker with `status`, `reason` and `checked`, adds a visible `> ⚠️ Unverified: <reason>` line under each unverified snippet, and recomputes `code_status` in the frontmatter.

## Reading `results.json`

`_work/code-check/results.json` maps each snippet id to `{"status", "reason", "stdout"}`, merged across runs. `stdout` is what the snippet printed under the fake model. Use it for the exact Expected output of deterministic results. LLM text stays labelled illustrative.

Common reasons and their fixes:

| Reason | Fix |
|---|---|
| `deprecated: …` | Rewrite with the current API named in the warning and the migration guide. |
| `ModuleNotFoundError: No module named 'langchain_openai'` | Use `init_chat_model("openai:…")` or a model string instead of the provider class. |
| `FixtureExhausted: …` | Add responses to the fixture for every model call the snippet makes. |
| `timeout after 60s` | The snippet waits on the network or loops. Add `skip="…"` or fix the loop. |
| `runner crashed: …` | The environment is broken. Rerun `setup_env.py`. |

## Revision loop

1. The coordinator sends each failing snippet, with its reason, to the Part's writer in revision mode.
2. The writer fixes the code against current official docs, and the fixture if needed.
3. The coordinator reruns `check_code.py --part N`.
4. Each snippet gets **at most 2 revision rounds**. After that it stays unverified: the Part shows the reason, and the final report lists it. Never hide a failing example. Remove it only when no objective needs it.
