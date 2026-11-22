import pytest

import frontmatter
from frontmatter import FrontmatterError


def test_parse_json_values():
    text = '---\ncourse: "lc"\npart: 2\noutcomes: ["O1", "O3"]\nversions: {"langchain": "1.5.2"}\n---\n# Body\n'
    assert frontmatter.parse(text) == (
        {"course": "lc", "part": 2, "outcomes": ["O1", "O3"], "versions": {"langchain": "1.5.2"}},
        "# Body\n",
    )


def test_parse_bare_string_fallback():
    data, _ = frontmatter.parse("---\ntitle: LangChain ภาษาไทย\n---\n")
    assert data == {"title": "LangChain ภาษาไทย"}


@pytest.mark.parametrize(
    "text",
    [
        "course: \"lc\"\n---\nbody\n",
        "---\ncourse: \"lc\"\nbody\n",
        "---\noops\n---\nbody\n",
    ],
    ids=["no-leading-fence", "no-closing-fence", "line-without-colon"],
)
def test_parse_errors(text):
    with pytest.raises(FrontmatterError):
        frontmatter.parse(text)


def test_render_roundtrip():
    data = {
        "title": "ภาษาไทย 🚀",
        "outcomes": ["O1", "O2"],
        "versions": {"langchain": "1.5.2", "nested": {"a": 1}},
        "technical": True,
    }
    rendered = frontmatter.render(data)
    assert "ภาษาไทย" in rendered
    assert frontmatter.parse(rendered + "body")[0] == data


def test_replace_keeps_body():
    body = "# Part 1: หัวข้อ\n\nเนื้อหา ✅\n"
    text = frontmatter.render({"a": 1}) + body
    replaced = frontmatter.replace(text, {"b": [2]})
    assert replaced == frontmatter.render({"b": [2]}) + body
