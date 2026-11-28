"""End to end: a scaffolded app with a small made-up Part compiles, passes its own check page and builds.

Needs the template's node_modules (`pnpm install --frozen-lockfile` in the template); skipped otherwise.
"""

import os
import shutil
import socket
import struct
import subprocess
import time
import urllib.request
from pathlib import Path

import pytest

import scaffold
from conftest import TEMPLATE

HERE = Path(__file__).resolve().parent
needs_node = pytest.mark.skipif(
    not (TEMPLATE / "node_modules").is_dir() or shutil.which("pnpm") is None,
    reason="run pnpm install --frozen-lockfile in skills/teaching/part-slides/template first",
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
    output = _ok(["pnpm", "exec", "vitest", "run", "src/check.test.tsx"], web)
    assert "1 passed" in output, output[-2000:]
    _ok(["pnpm", "run", "build"], web)
    html = (web / "dist" / "index.html").read_text(encoding="utf-8")
    assert 'src="/' not in html and 'href="/' not in html  # relative assets: works from a sub-path


def _chrome() -> str | None:
    for path in (os.environ.get("CHROME"), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"):
        if path and Path(path).is_file():
            return path
    return next((found for name in ("google-chrome", "chromium", "chromium-browser") if (found := shutil.which(name))), None)


def _png_size(path: Path) -> tuple[int, int]:
    return struct.unpack(">II", path.read_bytes()[16:24])


@needs_node
@pytest.mark.skipif(_chrome() is None, reason="needs Chrome or Chromium (or CHROME=<path>)")
def test_the_screenshot_script_takes_a_parts_slides_on_a_phone_and_a_desktop(tmp_path):
    course = tmp_path / "courses" / "fixture-course"
    scaffold.run(course, title="Fixture", language="en", part=1, slug="sorting-a-list", part_title="Sorting a list", skip_install=True)
    web = course / "web"
    (web / "node_modules").symlink_to(TEMPLATE / "node_modules", target_is_directory=True)
    parts = web / "src" / "parts"
    shutil.copy(HERE / "fixtures" / "part-01.tsx", parts / "part-01.tsx")
    shutil.copy(HERE / "fixtures" / "part-01.data.ts", parts / "part-01.data.ts")
    (web / "src" / "visuals").mkdir()
    shutil.copy(HERE / "fixtures" / "visuals-part-01.tsx", web / "src" / "visuals" / "part-01.tsx")
    scaffold.sync_count(course, 1)
    _ok(["pnpm", "exec", "vite", "build"], web)
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    server = subprocess.Popen(["pnpm", "exec", "vite", "preview", "--port", str(port), "--strictPort"], cwd=web,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(f"http://localhost:{port}/", timeout=1)
                break
            except OSError:
                time.sleep(0.2)
        out = tmp_path / "shots"
        env = {**os.environ, "CHROME": _chrome()}
        result = subprocess.run(["node", "scripts/screenshots.mjs", "--url", f"http://localhost:{port}", "--part", "1", "--out", str(out)],
                                cwd=web, env=env, capture_output=True, text=True, timeout=300)
        assert result.returncode == 0, result.stdout + result.stderr
        phone, desktop = sorted(out.glob("*-phone.png")), sorted(out.glob("*-desktop.png"))
        assert len(phone) == len(desktop) == 10  # every slide the check page lists, in both frames
        assert _png_size(out / "1-001-phone.png") == (780, 1688)
        assert _png_size(out / "1-001-desktop.png") == (1280, 720)
        only = subprocess.run(["node", "scripts/screenshots.mjs", "--url", f"http://localhost:{port}", "--part", "1", "--out", str(tmp_path / "one"),
                               "--frame", "phone", "1-002"], cwd=web, env=env, capture_output=True, text=True, timeout=300)
        assert only.returncode == 0, only.stdout + only.stderr
        assert [p.name for p in (tmp_path / "one").iterdir()] == ["1-002-phone.png"]
    finally:
        os.killpg(server.pid, 15)
