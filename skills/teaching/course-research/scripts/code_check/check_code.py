"""Check every code example in a course against fake models.

    python3 check_code.py <course_dir> [--python PATH] [--part N ...] [--timeout 60]

For each `<!-- snippet id="…" -->` marker in part-NN-*.md, runs the code
block that follows in the course venv (via run_snippet.py), then writes the
outcome back into the Part file:

- the marker gains status / reason / checked attributes,
- an unverified snippet gets a visible "> ⚠️ Unverified: <reason>" line
  directly after its closing fence,
- frontmatter code_status is recomputed.

Results (with captured stdout) are merged into _work/code-check/results.json.
Exit 0 when every snippet is verified, 2 when some are unverified, 1 on a
harness error. Stdlib only.
"""

import argparse
import datetime
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import frontmatter  # noqa: E402
from contract import PART_FILE_RE, PYTHON_LANGS, SNIPPET_ID_RE, UNVERIFIED_PREFIX  # noqa: E402
from validate_course import computed_code_status, scan, snippet_markers  # noqa: E402

RUNNER = Path(__file__).resolve().parent / "run_snippet.py"
WORK_DIR = Path("_work/code-check")
DEFAULT_PYTHON = WORK_DIR / ".venv" / "bin" / "python"
MAX_STDOUT = 4000
MAX_REASON = 300


class HarnessError(RuntimeError):
    pass


@dataclass(frozen=True)
class Snippet:
    id: str
    part: int
    lang: str
    code: str
    skip: str | None
    marker_line: int
    fence_end_line: int


@dataclass(frozen=True)
class Result:
    id: str
    status: str  # "verified" | "unverified"
    reason: str | None
    stdout: str


def _part_number(part_path: Path, snippet_id: str) -> int:
    match = PART_FILE_RE.match(part_path.name)
    if match:
        return int(match.group(1))
    id_match = SNIPPET_ID_RE.match(snippet_id)
    return int(id_match.group("part")) if id_match else 0


def _attached(doc) -> list[tuple[int, dict, object]]:
    return [(index, attrs, block) for index, attrs, block in snippet_markers(doc) if block is not None]


def extract_snippets(part_path: Path) -> list[Snippet]:
    _, body = frontmatter.parse(part_path.read_text(encoding="utf-8"))
    doc = scan(body)
    snippets = []
    for index, attrs, block in _attached(doc):
        snippet_id = attrs.get("id", "")
        snippets.append(
            Snippet(
                id=snippet_id,
                part=_part_number(part_path, snippet_id),
                lang=block.lang,
                code="\n".join(doc.lines[block.start + 1:block.end]),
                skip=attrs.get("skip"),
                marker_line=index,
                fence_end_line=block.end,
            )
        )
    return snippets


def _one_line(text: str) -> str:
    flat = " ".join(text.split()).replace("-->", "—>")
    return flat if len(flat) <= MAX_REASON else flat[: MAX_REASON - 1] + "…"


def run_one(snippet: Snippet, python: Path, work_dir: Path, timeout: int = 60) -> Result:
    if snippet.skip:
        return Result(snippet.id, "unverified", _one_line(snippet.skip), "")
    if snippet.lang not in PYTHON_LANGS:
        return Result(snippet.id, "unverified", "non-Python snippet; v1 checks Python only", "")
    snippets_dir = work_dir / "snippets"
    snippets_dir.mkdir(parents=True, exist_ok=True)
    source = snippets_dir / f"{snippet.id}.py"
    source.write_text(snippet.code + "\n", encoding="utf-8")
    result_file = snippets_dir / f"{snippet.id}.result.json"
    result_file.unlink(missing_ok=True)
    command = [str(python), str(RUNNER), str(source), "--result", str(result_file)]
    fixture = work_dir / "fixtures" / f"{snippet.id}.json"
    if fixture.exists():
        command += ["--fixture", str(fixture)]
    try:
        done = subprocess.run(command, cwd=snippets_dir, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as expired:
        output = expired.stdout.decode("utf-8", "replace") if isinstance(expired.stdout, bytes) else (expired.stdout or "")
        return Result(snippet.id, "unverified", f"timeout after {timeout}s", output[-MAX_STDOUT:])
    stdout = done.stdout[-MAX_STDOUT:]
    if not result_file.exists():
        last = (done.stderr.strip().splitlines() or ["no output"])[-1]
        return Result(snippet.id, "unverified", _one_line(f"runner crashed: {last}"), stdout)
    outcome = json.loads(result_file.read_text(encoding="utf-8"))
    if outcome["status"] == "verified":
        return Result(snippet.id, "verified", None, stdout)
    return Result(snippet.id, "unverified", _one_line(outcome.get("reason") or "failed"), stdout)


def _marker(attrs: dict, result: Result, checked_on: str) -> str:
    def quote(value: str) -> str:
        return value.replace('"', "&quot;")

    parts = [f'id="{quote(result.id)}"']
    if attrs.get("skip"):
        parts.append(f'skip="{quote(attrs["skip"])}"')
    parts.append(f'status="{result.status}"')
    if result.status != "verified" and result.reason:
        parts.append(f'reason="{quote(result.reason)}"')
    parts.append(f'checked="{checked_on}"')
    return f"<!-- snippet {' '.join(parts)} -->"


def apply_results(part_path: Path, results: dict[str, Result], checked_on: str) -> None:
    text = part_path.read_text(encoding="utf-8")
    data, body = frontmatter.parse(text)
    doc = scan(body)
    lines = list(doc.lines)
    # Bottom-up, so inserting or removing a line never shifts a marker still to visit.
    for index, attrs, block in reversed(_attached(doc)):
        result = results.get(attrs.get("id", ""))
        if result is None:
            continue
        after = block.end + 1
        if after < len(lines) and lines[after].startswith(UNVERIFIED_PREFIX):
            del lines[after]
        if result.status != "verified":
            lines.insert(after, f"{UNVERIFIED_PREFIX} {result.reason}")
        lines[index] = _marker(attrs, result, checked_on)
    new_body = "\n".join(lines)
    markers = [attrs for _, attrs, _ in _attached(scan(new_body))]
    data["code_status"] = computed_code_status(markers)
    part_path.write_text(frontmatter.render(data) + new_body, encoding="utf-8")


def check_course(course_dir: Path, python: Path, parts: list[int] | None, timeout: int) -> dict[str, Result]:
    if not python.exists():
        raise HarnessError(f"no python at {python}; run setup_env.py first or pass --python")
    work_dir = course_dir / WORK_DIR
    checked_on = datetime.date.today().isoformat()
    all_results: dict[str, Result] = {}
    for part_path in sorted(course_dir.glob("part-*.md")):
        match = PART_FILE_RE.match(part_path.name)
        if not match or (parts and int(match.group(1)) not in parts):
            continue
        part_results = {s.id: run_one(s, python, work_dir, timeout) for s in extract_snippets(part_path)}
        apply_results(part_path, part_results, checked_on)
        all_results.update(part_results)
    results_file = work_dir / "results.json"
    merged = json.loads(results_file.read_text(encoding="utf-8")) if results_file.exists() else {}
    merged.update({r.id: {"status": r.status, "reason": r.reason, "stdout": r.stdout} for r in all_results.values()})
    results_file.parent.mkdir(parents=True, exist_ok=True)
    results_file.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    return all_results


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Check course code examples against fake models.")
    parser.add_argument("course_dir", type=Path)
    parser.add_argument("--python", type=Path, help="python of the course venv (default: _work/code-check/.venv/bin/python)")
    parser.add_argument("--part", type=int, action="append", help="check only this part number (repeatable)")
    parser.add_argument("--timeout", type=int, default=60, help="seconds per snippet")
    args = parser.parse_args(argv)
    python = args.python or args.course_dir / DEFAULT_PYTHON
    try:
        found = check_course(args.course_dir, python, args.part, args.timeout)
    except (HarnessError, OSError, frontmatter.FrontmatterError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    unverified = [r for r in found.values() if r.status != "verified"]
    for result in unverified:
        print(f"UNVERIFIED {result.id}: {result.reason}")
    print(f"checked {len(found)} snippets: {len(found) - len(unverified)} verified, {len(unverified)} unverified")
    return 2 if unverified else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
