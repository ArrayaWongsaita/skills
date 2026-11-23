"""End to end: the fixture course is generated, compiled, rendered verbatim and built.

Needs the template's node_modules (`npm ci` in the template); skipped otherwise.
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

import build_part
import deck_reader
import inline
from conftest import TEMPLATE

HERE = Path(__file__).resolve().parent
needs_node = pytest.mark.skipif(
    not (TEMPLATE / "node_modules").is_dir() or shutil.which("npm") is None,
    reason="run npm ci in skills/teaching/react-slides/template first",
)


def _ok(cmd: list[str], cwd: Path) -> str:
    result = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=600)
    assert result.returncode == 0, f"{' '.join(cmd)} failed:\n" + "\n".join(result.stdout.splitlines()[-80:])
    return result.stdout


def _write_expected(course: Path, web: Path) -> int:
    slides = []
    for slide in deck_reader.load(course, 1).deck.slides():
        fields = {}
        for name, field in slide.fields.items():
            fields[name.lower()] = [inline.visible_text(item) for item in field.items] if name == "Items" else inline.visible_text(field.text)
        slides.append({"id": slide.id, "fields": fields})
    (web / "src" / "expected.json").write_text(json.dumps(slides, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return len(slides)


@needs_node
def test_fixture_course_compiles_renders_verbatim_and_builds(course):
    report = build_part.run(course, None, skip_install=True)
    assert report["errors"] == [] and report["parts"] == [1, 2]
    web = course / "web"
    (web / "node_modules").symlink_to(TEMPLATE / "node_modules", target_is_directory=True)
    count = _write_expected(course, web)
    shutil.copy(HERE / "app" / "verbatim.test.tsx", web / "src" / "verbatim.test.tsx")
    output = _ok(["npx", "vitest", "run", "src/verbatim.test.tsx"], web)
    assert f"{count} passed" in output, output[-2000:]  # the template passes with no tests, so count them
    _ok(["npm", "run", "build"], web)
    html = (web / "dist" / "index.html").read_text(encoding="utf-8")
    assert 'src="/' not in html and 'href="/' not in html  # relative assets: works from a sub-path
