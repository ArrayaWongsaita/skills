"""Create the per-course Python environment that code checks run in.

    python3 setup_env.py <course_dir>

Reads `python` and `packages` from <course_dir>/_work/scope.md, refuses any
package not pinned with `==`, and builds <course_dir>/_work/code-check/.venv
(with uv when available, otherwise venv + pip). A stamp file records what was
installed and the resolved versions, so a second call with the same pins is
a no-op. Prints the environment's python path. Stdlib only.
"""

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import frontmatter  # noqa: E402

ENV_DIR = Path("_work/code-check/.venv")
STAMP = Path("_work/code-check/env.json")
SCOPE = Path("_work/scope.md")
DEFAULT_PYTHON = "3.12"
RESOLVE = "import importlib.metadata as m, json, sys; print(json.dumps({n: m.version(n) for n in sys.argv[1:]}))"


class SetupError(RuntimeError):
    pass


def build_commands(env_dir: Path, python_version: str, packages: list[str], have_uv: bool) -> list[list[str]]:
    env_python = str(env_dir / "bin" / "python")
    if have_uv:
        return [["uv", "venv", "--python", python_version, str(env_dir)], ["uv", "pip", "install", "--python", env_python, *packages]]
    return [[sys.executable, "-m", "venv", str(env_dir)], [env_python, "-m", "pip", "install", *packages]]


def package_name(pin: str) -> str:
    return re.split(r"[\[=<>!~ ]", pin, maxsplit=1)[0]


def setup(course_dir: Path) -> Path:
    scope, _ = frontmatter.parse((course_dir / SCOPE).read_text(encoding="utf-8"))
    python_version = scope.get("python") or DEFAULT_PYTHON
    packages = list(scope.get("packages") or [])
    unpinned = [p for p in packages if "==" not in p]
    if unpinned:
        raise SetupError(f"packages must be pinned with '==': {', '.join(unpinned)}")
    env_dir, stamp = course_dir / ENV_DIR, course_dir / STAMP
    env_python = env_dir / "bin" / "python"
    if stamp.exists() and env_python.exists():
        recorded = json.loads(stamp.read_text(encoding="utf-8"))
        if recorded.get("python") == python_version and recorded.get("packages") == packages:
            return env_python
    if env_dir.exists():
        shutil.rmtree(env_dir)
    env_dir.parent.mkdir(parents=True, exist_ok=True)
    for command in build_commands(env_dir, python_version, packages, have_uv=shutil.which("uv") is not None):
        done = subprocess.run(command, capture_output=True, text=True)
        if done.returncode != 0:
            raise SetupError(f"{' '.join(command)} failed:\n{done.stderr.strip()}")
    names = [package_name(p) for p in packages]
    resolved = subprocess.run([str(env_python), "-c", RESOLVE, *names], capture_output=True, text=True, check=True)
    stamp.write_text(json.dumps({"python": python_version, "packages": packages, "resolved": json.loads(resolved.stdout)}, indent=2), encoding="utf-8")
    return env_python


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("usage: setup_env.py <course_dir>", file=sys.stderr)
        return 1
    try:
        print(setup(Path(argv[0])))
    except (SetupError, OSError, subprocess.CalledProcessError, frontmatter.FrontmatterError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
