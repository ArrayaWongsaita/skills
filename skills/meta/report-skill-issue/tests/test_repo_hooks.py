import subprocess
from pathlib import Path

import pytest

HOOK = "## Reporting problems with this skill"


def test_every_skill_has_the_reporting_hook(skill_dir):
    skills_root = skill_dir.parents[1]
    found = sorted(skills_root.glob("*/*/SKILL.md"))
    assert len(found) >= 3
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
