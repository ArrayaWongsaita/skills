"""End to end: a scaffolded app with a small made-up Part compiles, passes its own check page and builds.

Needs the template's node_modules (`npm ci` in the template); skipped otherwise.
"""

import shutil
import subprocess
from pathlib import Path

import pytest

import scaffold
from conftest import TEMPLATE

HERE = Path(__file__).resolve().parent
needs_node = pytest.mark.skipif(
    not (TEMPLATE / "node_modules").is_dir() or shutil.which("npm") is None,
    reason="run npm ci in skills/teaching/part-slides/template first",
)


def _ok(cmd: list[str], cwd: Path) -> str:
    result = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600)
    assert result.returncode == 0, f"{' '.join(cmd)} failed:\n" + "\n".join(result.stdout.splitlines()[-80:])
    return result.stdout


@needs_node
def test_a_scaffolded_app_with_a_fixture_part_builds_and_passes_its_own_check(tmp_path):
    course = tmp_path / "courses" / "fixture-course"
    scaffold.run(course, title="Fixture", language="en", part=1, slug="sorting-a-list", part_title="Sorting a list", skip_install=True)
    web = course / "web"
    (web / "node_modules").symlink_to(TEMPLATE / "node_modules", target_is_directory=True)
    parts = web / "src" / "parts"
    shutil.copy(HERE / "fixtures" / "part-01.tsx", parts / "part-01.tsx")
    shutil.copy(HERE / "fixtures" / "part-01.data.ts", parts / "part-01.data.ts")
    (web / "src" / "visuals").mkdir()
    shutil.copy(HERE / "fixtures" / "visuals-part-01.tsx", web / "src" / "visuals" / "part-01.tsx")
    assert scaffold.sync_count(course, 1) == 10
    shutil.copy(HERE / "app" / "check.test.tsx", web / "src" / "check.test.tsx")
    output = _ok(["npx", "vitest", "run", "src/check.test.tsx"], web)
    assert "1 passed" in output, output[-2000:]
    _ok(["npm", "run", "build"], web)
    html = (web / "dist" / "index.html").read_text(encoding="utf-8")
    assert 'src="/' not in html and 'href="/' not in html  # relative assets: works from a sub-path
