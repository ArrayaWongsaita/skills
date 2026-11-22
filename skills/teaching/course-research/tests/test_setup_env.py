import json
import subprocess
import sys
from pathlib import Path

import frontmatter
from setup_env import ENV_DIR, STAMP, build_commands


def write_scope(course: Path, packages, python="3.12") -> None:
    (course / "_work").mkdir(parents=True, exist_ok=True)
    data = {"course": "c", "technical": True, "runtime": "python", "python": python, "packages": packages}
    (course / "_work" / "scope.md").write_text(frontmatter.render(data), encoding="utf-8")


def run_setup(skill_dir, course):
    script = skill_dir / "scripts" / "code_check" / "setup_env.py"
    return subprocess.run([sys.executable, str(script), str(course)], capture_output=True, text=True, timeout=120)


def test_build_commands_uv():
    env = Path("/c/_work/code-check/.venv")
    assert build_commands(env, "3.12", ["langchain==1.5.2", "langgraph==1.2.24"], have_uv=True) == [
        ["uv", "venv", "--python", "3.12", str(env)],
        ["uv", "pip", "install", "--python", str(env / "bin" / "python"), "langchain==1.5.2", "langgraph==1.2.24"],
    ]


def test_build_commands_venv():
    env = Path("/c/_work/code-check/.venv")
    assert build_commands(env, "3.12", ["langchain==1.5.2"], have_uv=False) == [
        [sys.executable, "-m", "venv", str(env)],
        [str(env / "bin" / "python"), "-m", "pip", "install", "langchain==1.5.2"],
    ]


def test_setup_refuses_unpinned(skill_dir, tmp_path):
    write_scope(tmp_path, ["langchain"])
    result = run_setup(skill_dir, tmp_path)
    assert result.returncode == 1
    assert "==" in result.stderr
    assert not (tmp_path / ENV_DIR).exists()


def test_setup_skips_when_stamp_matches(skill_dir, tmp_path):
    packages = ["langchain==1.5.2"]
    write_scope(tmp_path, packages)
    python = tmp_path / ENV_DIR / "bin" / "python"
    python.parent.mkdir(parents=True)
    python.write_text("#!/bin/sh\n# stub\n", encoding="utf-8")
    python.chmod(0o755)
    (tmp_path / STAMP).write_text(json.dumps({"python": "3.12", "packages": packages, "resolved": {"langchain": "1.5.2"}}), encoding="utf-8")
    result = run_setup(skill_dir, tmp_path)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == str(python)
    assert python.read_text(encoding="utf-8") == "#!/bin/sh\n# stub\n"
