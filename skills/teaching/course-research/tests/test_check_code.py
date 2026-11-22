import json
import re
import subprocess
import sys
from pathlib import Path

import pytest

import frontmatter
from check_code import extract_snippets
from contract import UNVERIFIED_PREFIX

PART1_BODY = '''# Part 1: ทดสอบ 🚀

ข้อความภาษาไทยก่อนโค้ด ✅

<!-- snippet id="1.1-a" -->
```python
from langchain.agents import create_agent
from langchain.tools import tool


@tool
def get_weather(city: str) -> str:
    """Get the weather for a city."""
    return f"sunny in {city}"


agent = create_agent(model="openai:gpt-5", tools=[get_weather])
print(agent.invoke({"messages": [{"role": "user", "content": "อากาศ?"}]})["messages"][-1].content)
```

**Expected output:**
```text
แดดออก
```

<!-- snippet id="1.1-b" -->
```python
from langchain.chat_models import init_chat_model
from langgraph.prebuilt import create_react_agent

create_react_agent(init_chat_model("openai:x"), tools=[])
```

**Expected output:**
```text
(ไม่มีผลลัพธ์)
```

<!-- snippet id="1.2-a" skip="needs a real Postgres server" -->
```python
import psycopg
```

จบ part 🎉
'''

PART2_BODY = '''# Part 2: สอง

<!-- snippet id="2.1-a" -->
```python
print("part two")
```
'''


def write_part(course: Path, name: str, number: int, body: str) -> Path:
    data = {"template": "course-research/part@1", "course": "c", "part": number, "title": "t", "outcomes": ["O1"],
            "prerequisite_parts": [], "versions": {"langchain": "1.5.2"}, "code_status": "unverified", "generated": "2026-11-22"}
    path = course / name
    path.write_text(frontmatter.render(data) + body, encoding="utf-8")
    return path


@pytest.fixture
def course(tmp_path) -> Path:
    fixtures = tmp_path / "_work" / "code-check" / "fixtures"
    fixtures.mkdir(parents=True)
    (fixtures / "1.1-a.json").write_text(json.dumps({"responses": [
        {"tool_calls": [{"name": "get_weather", "args": {"city": "Bangkok"}}]},
        {"content": "แดดออกที่ Bangkok"},
    ]}), encoding="utf-8")
    write_part(tmp_path, "part-01-test.md", 1, PART1_BODY)
    write_part(tmp_path, "part-02-two.md", 2, PART2_BODY)
    return tmp_path


def check(skill_dir, course, *extra):
    script = skill_dir / "scripts" / "code_check" / "check_code.py"
    return subprocess.run([sys.executable, str(script), str(course), "--python", sys.executable, *extra],
                          capture_output=True, text=True, timeout=300)


def results(course):
    return json.loads((course / "_work" / "code-check" / "results.json").read_text(encoding="utf-8"))


def strip_generated(text: str) -> str:
    _, body = frontmatter.parse(text)
    keep = [line for line in body.split("\n") if not line.startswith("<!-- snippet ") and not line.startswith(UNVERIFIED_PREFIX)]
    return "\n".join(keep)


def test_extract_snippets(course):
    snippets = extract_snippets(course / "part-01-test.md")
    assert [(s.id, s.lang, s.skip, s.part) for s in snippets] == [
        ("1.1-a", "python", None, 1),
        ("1.1-b", "python", None, 1),
        ("1.2-a", "python", "needs a real Postgres server", 1),
    ]
    assert snippets[2].code == "import psycopg"


def test_check_code_results(skill_dir, course):
    run = check(skill_dir, course)
    assert run.returncode == 2, run.stdout + run.stderr
    found = results(course)
    assert found["1.1-a"]["status"] == "verified", found["1.1-a"]
    assert "แดดออกที่ Bangkok" in found["1.1-a"]["stdout"]
    assert found["1.1-b"]["status"] == "unverified"
    assert found["1.1-b"]["reason"].startswith("deprecated: ")
    assert found["1.2-a"] == {"status": "unverified", "reason": "needs a real Postgres server", "stdout": ""}
    data, _ = frontmatter.parse((course / "part-01-test.md").read_text(encoding="utf-8"))
    assert data["code_status"] == "partial"
    assert "UNVERIFIED 1.1-b" in run.stdout


def test_markers_rewritten_with_status(skill_dir, course):
    check(skill_dir, course)
    text = (course / "part-01-test.md").read_text(encoding="utf-8")
    assert re.search(r'^<!-- snippet id="1.1-a" status="verified" checked="\d{4}-\d{2}-\d{2}" -->$', text, re.M)
    assert re.search(r'^<!-- snippet id="1.2-a" skip="needs a real Postgres server" status="unverified" reason="needs a real Postgres server" checked="[^"]+" -->$', text, re.M)


def test_unverified_line_inserted_after_fence(skill_dir, course):
    check(skill_dir, course)
    lines = (course / "part-01-test.md").read_text(encoding="utf-8").split("\n")
    fence = lines.index("create_react_agent(init_chat_model(\"openai:x\"), tools=[])") + 1
    assert lines[fence] == "```"
    assert lines[fence + 1].startswith(f"{UNVERIFIED_PREFIX} deprecated: ")


def test_apply_results_idempotent(skill_dir, course):
    check(skill_dir, course)
    first = (course / "part-01-test.md").read_text(encoding="utf-8")
    check(skill_dir, course)
    second = (course / "part-01-test.md").read_text(encoding="utf-8")
    assert second == first
    assert second.count(UNVERIFIED_PREFIX) == 2


def test_apply_results_preserves_other_content(skill_dir, course):
    before = (course / "part-01-test.md").read_text(encoding="utf-8")
    check(skill_dir, course)
    after = (course / "part-01-test.md").read_text(encoding="utf-8")
    assert strip_generated(after) == strip_generated(before)
    assert "ข้อความภาษาไทยก่อนโค้ด ✅" in after and "จบ part 🎉" in after


def test_timeout_marks_unverified(skill_dir, tmp_path):
    write_part(tmp_path, "part-01-slow.md", 1, '<!-- snippet id="1.1-a" -->\n```python\nimport time\ntime.sleep(5)\n```\n')
    run = check(skill_dir, tmp_path, "--timeout", "1")
    assert run.returncode == 2
    assert results(tmp_path)["1.1-a"]["reason"] == "timeout after 1s"


def test_results_json_merged(skill_dir, course):
    check(skill_dir, course)
    check(skill_dir, course, "--part", "1")
    found = results(course)
    assert found["2.1-a"]["status"] == "verified"
    assert set(found) == {"1.1-a", "1.1-b", "1.2-a", "2.1-a"}


def test_all_verified_exits_zero(skill_dir, tmp_path):
    write_part(tmp_path, "part-01-ok.md", 1, '<!-- snippet id="1.1-a" -->\n```python\nprint("ok")\n```\n')
    run = check(skill_dir, tmp_path)
    assert run.returncode == 0, run.stdout + run.stderr
    data, _ = frontmatter.parse((tmp_path / "part-01-ok.md").read_text(encoding="utf-8"))
    assert data["code_status"] == "verified"


def test_missing_python_is_harness_error(skill_dir, tmp_path):
    write_part(tmp_path, "part-01-ok.md", 1, '<!-- snippet id="1.1-a" -->\n```python\nprint("ok")\n```\n')
    script = skill_dir / "scripts" / "code_check" / "check_code.py"
    run = subprocess.run([sys.executable, str(script), str(tmp_path)], capture_output=True, text=True)
    assert run.returncode == 1
    assert "setup_env.py" in run.stderr
