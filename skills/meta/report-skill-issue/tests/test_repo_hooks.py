import re
import subprocess
from pathlib import Path

import pytest

HOOK = "## Reporting problems with this skill"
BAD_PLAIN_SCALAR = re.compile(r": |:$| #")
QUOTED_OR_BLOCK = ('"', "'", "|", ">", "[", "{")


def plain_scalar_problems(text: str) -> list[str]:
    """Frontmatter lines whose unquoted value a YAML parser rejects: a `: ` or ` #` inside a plain scalar.

    The installer parses frontmatter with a real YAML parser and skips a skill that fails, while
    frontmatter.py splits on the first `: ` and accepts anything. This stdlib check covers that gap.
    """
    lines = text.split("\n")
    end = lines.index("---", 1)
    problems = []
    for number, line in enumerate(lines[1:end], start=2):
        key, sep, value = line.partition(": ")
        value = value.strip()
        if sep and value[:1] not in QUOTED_OR_BLOCK and BAD_PLAIN_SCALAR.search(value):
            problems.append(f"line {number}: {key}")
    return problems


def test_every_skill_frontmatter_is_valid_yaml(skill_dir):
    skills_root = skill_dir.parents[1]
    found = sorted(skills_root.glob("*/*/SKILL.md"))
    assert len(found) >= 2
    problems = {str(p.relative_to(skills_root)): plain_scalar_problems(p.read_text(encoding="utf-8")) for p in found}
    assert {path: lines for path, lines in problems.items() if lines} == {}


def test_plain_scalar_check_catches_a_colon_inside_a_value():
    assert plain_scalar_problems("---\nname: demo\ndescription: Use when a, b: c\n---\n") == ["line 3: description"]
    assert plain_scalar_problems("---\nname: demo\ndescription: Use when a # b\n---\n") == ["line 3: description"]
    assert plain_scalar_problems('---\nname: demo\ndescription: "Use when a, b: c"\n---\n') == []
    assert plain_scalar_problems("---\nname: demo\ndescription: Use when a, b; c\n---\n") == []


def test_every_skill_has_the_reporting_hook(skill_dir):
    skills_root = skill_dir.parents[1]
    found = sorted(skills_root.glob("*/*/SKILL.md"))
    assert len(found) >= 2
    assert [str(p.relative_to(skills_root)) for p in found if HOOK not in p.read_text(encoding="utf-8")] == []


def test_no_tracked_file_names_the_local_home(skill_dir):
    """This repo is public: the developer's own home path (and so their login name) must not be committed."""
    home = Path.home()
    if home.parent == Path(home.anchor):
        pytest.skip("home is a top-level folder; too short to search for")
    root = skill_dir.parents[2]
    files = subprocess.run(["git", "-C", str(root), "ls-files"], capture_output=True, text=True, check=True).stdout.split("\n")
    needles = (f"{home}/", f"{home}\"", str(home).replace("/", "-") + "-")
    hits = [name for name in files if name and (root / name).is_file()
            and any(n in (root / name).read_text(encoding="utf-8", errors="ignore") for n in needles)]
    assert hits == []
