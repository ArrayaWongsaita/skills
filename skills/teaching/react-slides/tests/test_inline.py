import inline
from inline import Bold, Break, Code, Italic, Link, ListBlock, Para, Text


def test_inline_nodes():
    assert inline.parse_inline("ใช้ `a{b}` กับ [doc](https://x.y) และ **ตัวหนา** *เอียง*") == [
        Text("ใช้ "), Code("a{b}"), Text(" กับ "), Link("https://x.y", (Text("doc"),)), Text(" และ "),
        Bold((Text("ตัวหนา"),)), Text(" "), Italic((Text("เอียง"),))]


def test_code_content_is_literal():
    assert inline.parse_inline("`**x** [a](https://b)`") == [Code("**x** [a](https://b)")]


def test_nested_marks():
    assert inline.parse_inline("**ดู `x`** และ [**หนา**](https://a)") == [
        Bold((Text("ดู "), Code("x"))), Text(" และ "), Link("https://a", (Bold((Text("หนา"),)),))]


def test_snake_case_is_not_italic():
    assert inline.parse_inline("create_agent_x") == [Text("create_agent_x")]


def test_spaced_stars_are_not_italic():
    assert inline.parse_inline("a * b * c") == [Text("a * b * c")]


def test_unclosed_marks_stay_literal():
    assert inline.parse_inline("**ไม่ปิด และ `ไม่ปิด") == [Text("**ไม่ปิด และ `ไม่ปิด")]


def test_only_web_links_become_links():
    assert inline.parse_inline("[x](javascript:alert(1))") == [Text("[x](javascript:alert(1))")]


def test_bare_url_becomes_a_link():
    assert inline.parse_inline("ดู https://a.b/c") == [Text("ดู "), Link("https://a.b/c", (Text("https://a.b/c"),))]


def test_bare_url_leaves_trailing_punctuation():
    assert inline.parse_inline("ดู https://a.b/c.") == [Text("ดู "), Link("https://a.b/c", (Text("https://a.b/c"),)), Text(".")]


def test_field_blocks():
    blocks = inline.parse_field("บรรทัดหนึ่ง\nบรรทัดสอง\n\n1. ก\n2. ข")
    assert blocks == [Para((Text("บรรทัดหนึ่ง"), Break(), Text("บรรทัดสอง"))), ListBlock(True, ((Text("ก"),), (Text("ข"),)))]


def test_list_right_after_a_line():
    assert inline.parse_field("ทำตามนี้:\n- ก\n- **ข**") == [
        Para((Text("ทำตามนี้:"),)), ListBlock(False, ((Text("ก"),), (Bold((Text("ข"),)),)))]


def test_visible_text():
    assert inline.visible_text("ใช้ `x` [doc](https://a)\nต่อ\n\n- ก\n- ข") == "ใช้ x doc\nต่อ\nก\nข"


def test_escaping_inside_nested_nodes():  # Review Focus 1
    assert inline.visible_text("[a{b}](https://x) **<tag>**") == "a{b} <tag>"


def test_unsupported_is_literal_and_reported():
    assert inline.visible_text("~~old~~") == "~~old~~"
    assert len(inline.unsupported("~~old~~ ![i](x)")) == 2
    assert inline.unsupported("<b>x</b>\n> quote\n# head") != []


def test_markup_inside_code_is_not_reported():
    assert inline.unsupported("ใช้ `<div>` และ `~~`") == []
