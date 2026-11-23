"""Read and write the JSON-compatible YAML frontmatter subset.

Every generated file starts with a block like:

    ---
    course: "langchain-langgraph"
    outcomes: ["O1", "O3"]
    ---

One `key: value` per line; each value is a JSON literal. A value that is
not valid JSON is kept as the raw string, so a hand-typed bare title still
parses. Stdlib only.
"""

import json

FENCE = "---"


class FrontmatterError(ValueError):
    pass


def parse(text: str) -> tuple[dict, str]:
    lines = text.split("\n")
    if not lines or lines[0] != FENCE:
        raise FrontmatterError("file does not start with a '---' frontmatter block")
    try:
        end = lines.index(FENCE, 1)
    except ValueError:
        raise FrontmatterError("frontmatter block is not closed with '---'") from None
    data: dict = {}
    for number, line in enumerate(lines[1:end], start=2):
        if not line.strip():
            continue
        key, sep, raw = line.partition(": ")
        if not sep or not key.strip():
            raise FrontmatterError(f"line {number}: expected 'key: value', got {line!r}")
        raw = raw.strip()
        try:
            data[key.strip()] = json.loads(raw)
        except json.JSONDecodeError:
            data[key.strip()] = raw
    return data, "\n".join(lines[end + 1:])


def render(data: dict) -> str:
    body = "".join(f"{key}: {json.dumps(value, ensure_ascii=False)}\n" for key, value in data.items())
    return f"{FENCE}\n{body}{FENCE}\n"


def replace(text: str, data: dict) -> str:
    _, body = parse(text)
    return render(data) + body
