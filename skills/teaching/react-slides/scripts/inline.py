"""The Markdown subset react-slides renders, and the visible-text rule.

Inline: `code`, [text](https://…), **bold**, *italic* and bare URLs.
Structure: a blank line splits paragraphs, a line break stays a line
break, and runs of `1. ` or `- ` lines are lists. Anything else is shown
exactly as written; `unsupported` names it so the run can warn.

`visible_text` is the text a reader sees once the markup is gone: the
verbatim rule compares it with what the browser renders. Stdlib only.
"""

import re
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from mdtext import URL_RE  # noqa: E402


@dataclass(frozen=True)
class Text:
    text: str


@dataclass(frozen=True)
class Code:
    text: str


@dataclass(frozen=True)
class Link:
    href: str
    children: tuple


@dataclass(frozen=True)
class Bold:
    children: tuple


@dataclass(frozen=True)
class Italic:
    children: tuple


@dataclass(frozen=True)
class Break:
    pass


@dataclass(frozen=True)
class Para:
    nodes: tuple


@dataclass(frozen=True)
class ListBlock:
    ordered: bool
    items: tuple  # one tuple of inline nodes per item


Node = Text | Code | Link | Bold | Italic | Break

LINK_RE = re.compile(r"\[([^\]\n]+)\]\((https?://[^\s()]+)\)")
ITALIC_RE = re.compile(r"\*(?!\s)([^*\n]+?)(?<!\s)\*")
ITEM_RE = re.compile(r"^\s*(\d+\.|-)\s+(.*)$")
TRAILING = ".,;:!?"
UNSUPPORTED = (
    (re.compile(r"~~(?:[^~\n]+~~)?"), "~~ (strikethrough)"),
    (re.compile(r"!\["), "![…] (an image)"),
    (re.compile(r"<[a-zA-Z/]"), "an HTML tag"),
    (re.compile(r"^\s*> ", re.M), "a > quote"),
    (re.compile(r"^\s*#", re.M), "a # heading"),
)


def _merge(nodes: list) -> list:
    merged: list = []
    for node in nodes:
        if isinstance(node, Text) and merged and isinstance(merged[-1], Text):
            merged[-1] = Text(merged[-1].text + node.text)
        elif not (isinstance(node, Text) and not node.text):
            merged.append(node)
    return merged


def _mark(text: str, at: int):
    """The marked node starting at `at` and the index after it, or None."""
    char = text[at]
    if char == "`":
        end = text.find("`", at + 1)
        if end > at + 1 and "\n" not in text[at + 1:end]:
            return Code(text[at + 1:end]), end + 1
    elif char == "[":
        match = LINK_RE.match(text, at)
        if match:
            return Link(match.group(2), tuple(parse_inline(match.group(1)))), match.end()
    elif text.startswith("**", at):
        end = text.find("**", at + 2)
        if end > at + 2:
            return Bold(tuple(parse_inline(text[at + 2:end]))), end + 2
    elif char == "*":
        match = ITALIC_RE.match(text, at)
        if match:
            return Italic(tuple(parse_inline(match.group(1)))), match.end()
    elif char == "h":
        match = URL_RE.match(text, at)
        if match and (at == 0 or not text[at - 1].isalnum()):
            url = match.group(0).rstrip(TRAILING)
            return Link(url, (Text(url),)), at + len(url)
    elif char == "\n":
        return Break(), at + 1
    return None


def parse_inline(text: str) -> list:
    nodes, buffer, at = [], [], 0
    while at < len(text):
        found = _mark(text, at)
        if found is None:
            buffer.append(text[at])
            at += 1
            continue
        nodes += [Text("".join(buffer)), found[0]]
        buffer, at = [], found[1]
    nodes.append(Text("".join(buffer)))
    return _merge(nodes)


def _paragraph(lines: list[str]) -> list:
    blocks, run, items, ordered = [], [], [], False

    def flush_run():
        if run:
            blocks.append(Para(tuple(parse_inline("\n".join(run)))))
            run.clear()

    def flush_items():
        if items:
            blocks.append(ListBlock(ordered, tuple(tuple(parse_inline(item)) for item in items)))
            items.clear()

    for line in lines:
        match = ITEM_RE.match(line)
        if match:
            flush_run()
            if not items:
                ordered = match.group(1) != "-"
            items.append(match.group(2).strip())
        else:
            flush_items()
            run.append(line)
    flush_run()
    flush_items()
    return blocks


def parse_field(text: str) -> list:
    blocks, lines = [], []
    for line in text.split("\n") + [""]:
        if line.strip():
            lines.append(line.strip())
        elif lines:
            blocks += _paragraph(lines)
            lines = []
    return blocks


def parse_items(text: str) -> tuple[list[str], list[str]]:
    """An Items field as its list items, and the lines that belong to no item.

    A line right after an item, with no blank line between, continues that item
    (Markdown's lazy continuation) and joins it with a space. Any other line that is
    not an item, such as an intro before the list, is stray: no layout can show it.
    """
    items, stray, previous_blank = [], [], True
    for line in text.split("\n"):
        if not line.strip():
            previous_blank = True
            continue
        match = ITEM_RE.match(line.strip())
        if match:
            items.append(match.group(2).strip())
        elif items and not previous_blank:
            items[-1] = f"{items[-1]} {line.strip()}"
        else:
            stray.append(line.strip())
        previous_blank = False
    return items, stray


def _text(nodes) -> str:
    parts = []
    for node in nodes:
        if isinstance(node, (Text, Code)):
            parts.append(node.text)
        elif isinstance(node, Break):
            parts.append("\n")
        else:
            parts.append(_text(node.children))
    return "".join(parts)


def visible_text(text: str) -> str:
    parts = []
    for block in parse_field(text):
        if isinstance(block, Para):
            parts.append(_text(block.nodes))
        else:
            parts += [_text(item) for item in block.items]
    return re.sub(r"\n+", "\n", "\n".join(parts)).strip()


def unsupported(text: str) -> list[str]:
    plain = re.sub(r"`[^`\n]+`", "", text)
    return [f"{name} is not supported and shows as written" for pattern, name in UNSUPPORTED for _ in pattern.finditer(plain)]
