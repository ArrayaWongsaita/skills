import json
import subprocess
import sys
import textwrap

import pytest
from pydantic import BaseModel

import fake_models
from fake_models import DEFAULT_RESPONSE, FixtureError, FixtureExhausted, build_model, load_fixture


def run_isolated(skill_dir, body: str) -> dict:
    """Run code that calls install_fakes in a fresh interpreter; return its last JSON line."""
    code = f"import sys\nsys.path.insert(0, {str(skill_dir / 'scripts' / 'code_check')!r})\n" + textwrap.dedent(body)
    result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, timeout=120)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout.strip().splitlines()[-1])


class Person(BaseModel):
    name: str
    age: int


def test_default_model_cycles_default_response():
    model = build_model(None)
    assert [model.invoke("x").content for _ in range(3)] == [DEFAULT_RESPONSE] * 3


def test_fixture_exhausted():
    model = build_model([{"content": "only one"}])
    assert model.invoke("x").content == "only one"
    with pytest.raises(FixtureExhausted, match="after 1 calls"):
        model.invoke("x")


def test_models_share_one_queue():
    queue = fake_models.make_queue([{"content": "first"}, {"content": "second"}])
    one, two = build_model(None, queue), build_model(None, queue)
    assert [one.invoke("x").content, two.invoke("x").content] == ["first", "second"]


def test_bind_tools_returns_same_model():
    model = build_model(None)
    assert model.bind_tools([]) is model


def test_structured_output_pydantic():
    model = build_model([{"structured": {"name": "Ann", "age": 3}}])
    assert model.with_structured_output(Person).invoke("x") == Person(name="Ann", age=3)


def test_structured_output_dict_schema():
    model = build_model([{"structured": {"answer": 42}}])
    assert model.with_structured_output({"title": "Answer", "type": "object"}).invoke("x") == {"answer": 42}


def test_stream_yields_scripted_content():
    model = build_model([{"content": "hello world"}])
    assert "".join(chunk.content for chunk in model.stream("x")) == "hello world"


def test_load_fixture_fills_tool_call_ids(tmp_path):
    path = tmp_path / "f.json"
    path.write_text(json.dumps({"responses": [{"tool_calls": [{"name": "t", "args": {}}]}, {"content": "done"}]}))
    entries = load_fixture(path)
    assert entries[0]["tool_calls"][0]["id"] == "call_1"
    assert load_fixture(None) is None
    assert load_fixture(tmp_path / "missing.json") is None


@pytest.mark.parametrize(
    "payload",
    [{"responses": [{}]}, {"responses": []}, {"nope": []}, {"responses": [{"tool_calls": [{"args": {}}]}]}, {"responses": [{"content": 3}]}],
    ids=["empty-entry", "no-responses", "wrong-key", "tool-call-without-name", "non-string-content"],
)
def test_bad_fixture_raises(tmp_path, payload):
    path = tmp_path / "f.json"
    path.write_text(json.dumps(payload))
    with pytest.raises(FixtureError):
        load_fixture(path)


def test_create_agent_with_tool_call(skill_dir):
    out = run_isolated(
        skill_dir,
        """
        import json
        import fake_models
        fake_models.install_fakes([
            {"tool_calls": [{"name": "get_weather", "args": {"city": "Bangkok"}}]},
            {"content": "Sunny in Bangkok"},
        ])
        from langchain.agents import create_agent
        from langchain.tools import tool
        from langchain_core.messages import ToolMessage

        @tool
        def get_weather(city: str) -> str:
            \"\"\"Get the weather for a city.\"\"\"
            return f"sunny in {city}"

        agent = create_agent(model="openai:gpt-5", tools=[get_weather])
        messages = agent.invoke({"messages": [{"role": "user", "content": "weather?"}]})["messages"]
        print(json.dumps({"last": messages[-1].content, "tool": any(isinstance(m, ToolMessage) for m in messages)}))
        """,
    )
    assert out == {"last": "Sunny in Bangkok", "tool": True}


def test_init_chat_model_returns_fake(skill_dir):
    out = run_isolated(
        skill_dir,
        """
        import json
        import fake_models
        patched = fake_models.install_fakes(None)
        from langchain.chat_models import init_chat_model
        print(json.dumps({"type": type(init_chat_model("anthropic:x")).__name__, "patched": patched}))
        """,
    )
    assert out["type"] == "ScriptedChatModel"
    assert out["patched"] >= 2


def test_init_embeddings_fake(skill_dir):
    out = run_isolated(
        skill_dir,
        """
        import json
        import fake_models
        fake_models.install_fakes(None)
        from langchain.embeddings import init_embeddings
        print(json.dumps({"size": len(init_embeddings("openai:text-embedding-3-small").embed_query("x"))}))
        """,
    )
    assert out == {"size": 256}


def test_install_fakes_answers_key_prompts(skill_dir):
    out = run_isolated(
        skill_dir,
        """
        import getpass, json, os
        os.environ.pop("OPENAI_API_KEY", None)
        import fake_models
        fake_models.install_fakes(None)
        print(json.dumps({"getpass": getpass.getpass("key: "), "input": input("name: "), "env": os.environ["OPENAI_API_KEY"]}))
        """,
    )
    assert out == {"getpass": "fake-key", "input": "", "env": "fake-key"}
