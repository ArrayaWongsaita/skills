"""Scripted fake LLMs for checking course code without API keys.

Runs inside the per-course venv (needs langchain-core). `install_fakes`
swaps LangChain's model factories for fakes before a snippet runs, so the
code learners see (`init_chat_model("openai:...")`, `create_agent(model=
"openai:...")`) is exactly the code that gets checked.

Fixture file (_work/code-check/fixtures/<snippet-id>.json):

    {"responses": [
        {"tool_calls": [{"name": "get_weather", "args": {"city": "Bangkok"}}]},
        {"content": "Sunny in Bangkok"},
        {"structured": {"name": "Ann", "age": 3}}
    ]}

Every model created during one snippet run reads from one shared queue,
in call order.
"""

import builtins
import getpass
import hashlib
import importlib
import json
import math
import os
import sys
from pathlib import Path
from typing import Iterator

from langchain_core.embeddings import Embeddings
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage
from langchain_core.runnables import Runnable, RunnableLambda
from pydantic import BaseModel

DEFAULT_RESPONSE = "This is a scripted reply from the course-research fake model."
FAKE_KEY = "fake-key"
KEY_VARIABLES = ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY", "GROQ_API_KEY", "MISTRAL_API_KEY", "TAVILY_API_KEY")
ENTRY_KEYS = {"content", "tool_calls", "structured"}
EMBEDDING_SIZE = 256


class FixtureError(ValueError):
    pass


class FixtureExhausted(RuntimeError):
    pass


def load_fixture(path: Path | None) -> list[dict] | None:
    if path is None or not Path(path).exists():
        return None
    try:
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
    except json.JSONDecodeError as problem:
        raise FixtureError(f"{path}: not valid JSON ({problem})") from None
    responses = payload.get("responses") if isinstance(payload, dict) else None
    if not isinstance(responses, list) or not responses:
        raise FixtureError(f"{path}: expected {{\"responses\": [...]}} with at least one entry")
    entries, call_number = [], 0
    for index, entry in enumerate(responses):
        where = f"{path}: responses[{index}]"
        if not isinstance(entry, dict) or not entry or set(entry) - ENTRY_KEYS:
            raise FixtureError(f"{where}: an entry needs content, tool_calls or structured, and nothing else")
        if "content" in entry and not isinstance(entry["content"], str):
            raise FixtureError(f"{where}: content must be a string")
        if "structured" in entry and not isinstance(entry["structured"], dict):
            raise FixtureError(f"{where}: structured must be an object")
        calls = []
        for call in entry.get("tool_calls", []):
            if not (isinstance(call, dict) and isinstance(call.get("name"), str) and isinstance(call.get("args"), dict)):
                raise FixtureError(f"{where}: each tool call needs a string name and an args object")
            call_number += 1
            calls.append({"name": call["name"], "args": call["args"], "id": call.get("id") or f"call_{call_number}"})
        normalized = dict(entry)
        if calls:
            normalized["tool_calls"] = calls
        entries.append(normalized)
    return entries


def _to_messages(entries: list[dict]) -> list[AIMessage]:
    messages, call_number = [], 0
    for entry in entries:
        if "structured" in entry:
            content = json.dumps(entry["structured"], ensure_ascii=False)
        else:
            content = entry.get("content", "")
        calls = []
        for call in entry.get("tool_calls", []):
            call_number += 1
            calls.append({"name": call["name"], "args": call["args"], "id": call.get("id") or f"call_{call_number}", "type": "tool_call"})
        messages.append(AIMessage(content=content, tool_calls=calls))
    return messages


class _ScriptQueue:
    """Hands out one fresh copy of each scripted message, then fails loudly."""

    def __init__(self, entries: list[dict]):
        self._messages = _to_messages(entries)
        self._served = 0

    def __iter__(self):
        return self

    def __next__(self) -> AIMessage:
        if self._served >= len(self._messages):
            raise FixtureExhausted(f"fixture ran out of scripted responses after {self._served} calls")
        message = self._messages[self._served].model_copy(deep=True)
        self._served += 1
        return message


class _DefaultQueue:
    def __iter__(self):
        return self

    def __next__(self) -> AIMessage:
        return AIMessage(content=DEFAULT_RESPONSE)


class HashEmbeddings(Embeddings):
    """Deterministic stand-in for real embeddings, stdlib only.

    langchain-core's DeterministicFakeEmbedding needs numpy, which a course
    venv does not always have. Same text gives the same unit vector.
    """

    def __init__(self, size: int = EMBEDDING_SIZE):
        self.size = size

    def embed_query(self, text: str) -> list[float]:
        values, counter = [], 0
        while len(values) < self.size:
            digest = hashlib.sha256(f"{counter}:{text}".encode("utf-8")).digest()
            values.extend(byte / 255.0 - 0.5 for byte in digest)
            counter += 1
        vector = values[: self.size]
        norm = math.sqrt(sum(v * v for v in vector)) or 1.0
        return [v / norm for v in vector]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self.embed_query(text) for text in texts]


def make_queue(entries: list[dict] | None) -> Iterator[AIMessage]:
    return _DefaultQueue() if entries is None else _ScriptQueue(entries)


class ScriptedChatModel(GenericFakeChatModel):
    """GenericFakeChatModel that also accepts tools and structured output."""

    def bind_tools(self, tools, **kwargs) -> "ScriptedChatModel":
        return self

    def with_structured_output(self, schema, **kwargs) -> Runnable:
        include_raw = kwargs.get("include_raw", False)

        def answer(_input):
            message = next(self.messages)
            data = json.loads(message.content if isinstance(message, AIMessage) else message)
            parsed = schema.model_validate(data) if isinstance(schema, type) and issubclass(schema, BaseModel) else data
            return {"raw": message, "parsed": parsed, "parsing_error": None} if include_raw else parsed

        return RunnableLambda(answer)


def build_model(entries: list[dict] | None, queue: Iterator[AIMessage] | None = None) -> ScriptedChatModel:
    return ScriptedChatModel(messages=queue if queue is not None else make_queue(entries))


def _swap(original, replacement) -> int:
    replaced = 0
    for module in list(sys.modules.values()):
        try:
            namespace = vars(module)
        except TypeError:
            continue
        for name, value in list(namespace.items()):
            if value is original:
                setattr(module, name, replacement)
                replaced += 1
    return replaced


def install_fakes(entries: list[dict] | None) -> int:
    for name in ("langchain.chat_models", "langchain.agents", "langchain.embeddings"):
        try:
            importlib.import_module(name)
        except ImportError:
            pass
    queue = make_queue(entries)

    def fake_init_chat_model(*args, **kwargs) -> ScriptedChatModel:
        return build_model(None, queue)

    def fake_init_embeddings(*args, **kwargs) -> HashEmbeddings:
        return HashEmbeddings(size=EMBEDDING_SIZE)

    replaced = 0
    chat_models = sys.modules.get("langchain.chat_models")
    if chat_models is not None and hasattr(chat_models, "init_chat_model"):
        replaced += _swap(chat_models.init_chat_model, fake_init_chat_model)
    embeddings = sys.modules.get("langchain.embeddings")
    if embeddings is not None and hasattr(embeddings, "init_embeddings"):
        replaced += _swap(embeddings.init_embeddings, fake_init_embeddings)

    for variable in KEY_VARIABLES:
        os.environ.setdefault(variable, FAKE_KEY)
    getpass.getpass = lambda *args, **kwargs: FAKE_KEY
    builtins.input = lambda *args, **kwargs: ""
    return replaced
