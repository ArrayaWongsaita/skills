"""Small Markdown and text helpers shared by the slide-design scripts.

`scan` finds headings and fenced blocks, `visible_length` measures text the
way a reader sees it (Thai combining vowels and tone marks, and emoji
variation selectors, take no width of their own). Stdlib only.
"""

import re
import unicodedata
from dataclasses import dataclass, field

HEADING_RE = re.compile(r"^(#{1,6}) (.+?)\s*$")
INLINE_CODE_RE = re.compile(r"`([^`\n]+)`")
URL_RE = re.compile(r"https?://[^\s<>()\[\]`\"']+")
ZERO_WIDTH_CATEGORIES = frozenset({"Mn", "Me", "Cf"})


@dataclass(frozen=True)
class Heading:
    level: int
    text: str
    line: int  # 0-based


@dataclass(frozen=True)
class Block:
    lang: str
    info: str
    start: int  # 0-based index of the opening fence
    end: int  # 0-based index of the closing fence


@dataclass
class Doc:
    lines: list[str]
    headings: list[Heading] = field(default_factory=list)
    blocks: list[Block] = field(default_factory=list)

    def block_text(self, block: Block) -> str:
        return "\n".join(self.lines[block.start + 1:block.end])

    def block_at(self, line: int) -> Block | None:
        for block in self.blocks:
            if block.start == line:
                return block
        return None

    def end_of(self, heading: Heading) -> int:
        for other in self.headings:
            if other.line > heading.line and other.level <= heading.level:
                return other.line
        return len(self.lines)


def scan(text: str) -> Doc:
    doc = Doc(lines=text.split("\n"))
    fence, info, opened = None, "", 0
    for index, line in enumerate(doc.lines):
        stripped = line.strip()
        if fence:
            if stripped.startswith(fence) and not stripped.lstrip(fence[0]):
                lang = info.split()[0].lower() if info.split() else ""
                doc.blocks.append(Block(lang=lang, info=info, start=opened, end=index))
                fence = None
            continue
        if stripped.startswith(("```", "~~~")):
            char = stripped[0]
            fence = char * (len(stripped) - len(stripped.lstrip(char)))
            info, opened = stripped[len(fence):].strip(), index
            continue
        match = HEADING_RE.match(line)
        if match:
            doc.headings.append(Heading(level=len(match.group(1)), text=match.group(2), line=index))
    return doc


def visible_length(text: str) -> int:
    return sum(1 for char in text if unicodedata.category(char) not in ZERO_WIDTH_CATEGORIES)


def inline_code(text: str) -> list[str]:
    return INLINE_CODE_RE.findall(text)


def urls(text: str) -> list[str]:
    return URL_RE.findall(text)
