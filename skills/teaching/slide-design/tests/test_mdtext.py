import pytest

from contract import FIELD_LIMITS, FIELDS, LAYOUTS
from mdtext import inline_code, scan, urls, visible_length


def test_scan_ignores_headings_inside_fences():
    doc = scan("# A\n```python\n# not a heading\n```\n## B\n")
    assert [(h.level, h.text) for h in doc.headings] == [(1, "A"), (2, "B")]


def test_block_info_and_text():
    doc = scan("x\n```text illustrative\nline 1\nline 2\n```\n")
    block = doc.blocks[0]
    assert (block.lang, block.info, doc.block_text(block)) == ("text", "text illustrative", "line 1\nline 2")


def test_block_at_and_end_of():
    doc = scan("# A\n\n## B\ntext\n### C\n## D\n")
    assert doc.block_at(0) is None
    b = doc.headings[1]
    assert doc.end_of(b) == 5


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
