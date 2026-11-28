#!/usr/bin/env python3
"""Fill a Part's code listings from the course's playground repo, so a slide never shows code the repo does not have.

    sync_listings.py <course_dir> --part N [--check]

It reads <course_dir>/web/src/parts/part-NN.sources.json:

    {"<name>": {"branch": "solutions", "path": "lessons/03-click/Click.test.tsx", "lang": "tsx",
                "output": "runs/03-solutions.txt"}}

and writes part-NN.playground.ts next to it, with `playgroundListings` (each file read with
`git show <branch>:<path>` in <course_dir>/playground, so the user's checkout is never switched) and
`playgroundOutputs` (for a source with `output`: that file, relative to <course_dir>, as saved by course-builder's
`check_playground.py --save-output`). An optional `outputLines` keeps an excerpt of the real file: "last:3" (its last
3 lines), "5" (line 5, counted from 1), "5-8" (lines 5 to 8), "5-" (line 5 to the end), or several joined with
commas ("1-2,15-18": a table's header and four of its rows), or "has:<text>": every line holding that text, for a
tool that prints its results in a different order on each run (Vitest prints test files as they finish); --check compares the excerpt. The Part's data file spreads them into its own:

    export const listings = { ...playgroundListings, … };
    export const outputs = { ...playgroundOutputs, … };

With --unit NN, a file the course's units/NN/<branch>/ holds is read from there instead: a course-builder worker
syncs its chapter before the foreman applies it, to check its Part; the foreman syncs again without it after the apply.
With --check it writes nothing, and exits 1 naming each listing whose code or output differs from the playground;
a duration in an output (`0.05s`, `512ms`) may differ, since every run prints a new one.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

HEADER = (
    "// Written by sync_listings.py from the course's playground. Do not edit: change the playground and run it again.\n"
    "import type { Block, Listing } from '../components/types';\n"
)
REQUIRED = ("branch", "path", "lang")


class SyncError(Exception):
    pass


def _parts(course_dir: Path) -> Path:
    return Path(course_dir) / "web" / "src" / "parts"


def sources(course_dir: Path, part: int) -> dict[str, dict[str, str]]:
    path = _parts(course_dir) / f"part-{part:02d}.sources.json"
    if not path.is_file():
        raise SyncError(f"{path} does not exist: declare the Part's playground listings there")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise SyncError(f"{path.name} is not valid JSON: {error}") from error
    if not isinstance(data, dict):
        raise SyncError(f"{path.name} must be an object of name -> source")
    for name, source in data.items():
        missing = [key for key in REQUIRED if not isinstance(source, dict) or not source.get(key)]
        if missing:
            raise SyncError(f"{path.name}, listing {name}: {', '.join(missing)} missing")
    return data


class NotText(Exception):
    pass


def _show(repo: Path, branch: str, path: str) -> str | None:
    result = subprocess.run(["git", "-C", str(repo), "show", f"{branch}:{path}"], capture_output=True)
    if result.returncode != 0:
        return None
    try:
        return result.stdout.decode("utf-8")
    except UnicodeDecodeError as error:
        raise NotText(str(error)) from error


def _one_newline_off(text: str) -> str:
    text = text.replace("\r\n", "\n")
    return text[:-1] if text.endswith("\n") else text


LINES_RE = re.compile(r"^(?:last:(\d+)|(\d+)(-(\d*))?)$")


SELECTOR_SPLIT = re.compile(r",(?=has:|last:|\d)")


def excerpt(text: str, spec: str) -> str:
    """The lines of a run that `outputLines` names (selectors may be joined with commas); raises ValueError when the
    spec does not fit the run. A comma starts a new selector only when `has:`, `last:` or a line number follows it, so
    a comma inside a `has:` text stays in the text."""
    parts = SELECTOR_SPLIT.split(spec)
    if len(parts) > 1:
        return "\n".join(excerpt(text, part) for part in parts)
    if spec.startswith("has:"):
        found = [line for line in text.split("\n") if spec[4:] in line]
        if not found:
            raise ValueError(f'"{spec}": no line of the run has that text')
        return "\n".join(found)
    lines = text.split("\n")
    match = LINES_RE.match(spec.strip())
    if not match:
        raise ValueError(f'"{spec}" is not "last:N", "A", "A-B", "A-" or "has:<text>"')
    if match.group(1):
        count = int(match.group(1))
        if not 1 <= count <= len(lines):
            raise ValueError(f'"{spec}": the run has {len(lines)} line(s)')
        return "\n".join(lines[-count:])
    first = int(match.group(2))
    last = first if match.group(3) is None else int(match.group(4) or len(lines))
    if not 1 <= first <= last <= len(lines):
        raise ValueError(f'"{spec}": the run has {len(lines)} line(s)')
    return "\n".join(lines[first - 1:last])


def entries(course_dir: Path, srcs: dict[str, dict[str, str]], unit: str | None = None) -> tuple[dict[str, str], dict[str, str]]:
    """name -> the listing's line, name -> the output's line; raises SyncError naming every source it cannot read."""
    course_dir = Path(course_dir)
    repo = course_dir / "playground"
    listings, outputs, problems = {}, {}, []
    for name, source in srcs.items():
        where = f"{source['branch']}:{source['path']}"
        staged = course_dir / "units" / unit / source["branch"] / source["path"] if unit else None
        try:
            if staged is not None and staged.is_file():
                where = f"unit {unit} {where}"
                try:
                    code = staged.read_text(encoding="utf-8")
                except UnicodeDecodeError as error:
                    raise NotText(str(error)) from error
            else:
                code = _show(repo, source["branch"], source["path"])
        except NotText:
            problems.append(f"listing {name}: {where} is not UTF-8 text")
            continue
        if code is None:
            problems.append(f"listing {name}: {where} is not in the playground")
            continue
        listings[name] = (
            f"  {json.dumps(name, ensure_ascii=False)}: {{ lang: {json.dumps(source['lang'])}, status: 'verified', "
            f"reason: {json.dumps('playground ' + where, ensure_ascii=False)}, code: {json.dumps(_one_newline_off(code), ensure_ascii=False)} }},"
        )
        if source.get("output"):
            output = course_dir / source["output"]
            if not output.is_file():
                problems.append(f"listing {name}: output {source['output']} does not exist (run check_playground.py --save-output)")
                continue
            text = _one_newline_off(output.read_text(encoding="utf-8").replace("\r\n", "\n"))
            if source.get("outputLines"):
                try:
                    text = excerpt(text, str(source["outputLines"]))
                except ValueError as error:
                    problems.append(f"listing {name}: outputLines {error}")
                    continue
            outputs[name] = f"  {json.dumps(name, ensure_ascii=False)}: {{ lang: 'text', info: 'text', text: {json.dumps(text, ensure_ascii=False)} }},"
    if problems:
        raise SyncError("nothing was written:\n" + "\n".join(problems))
    return listings, outputs


DURATION = re.compile(r"(?<![\d.])\d+(?:\.\d+)?\s?(?:ms|s)\b")


def _timeless(line: str) -> str:
    """The line with each duration (`0.05s`, `512ms`) blanked: a run prints a new time on every run."""
    return DURATION.sub("<time>", line)


def render(listings: dict[str, str], outputs: dict[str, str]) -> str:
    return (
        HEADER
        + "\nexport const playgroundListings: Record<string, Listing> = {\n" + "".join(line + "\n" for line in listings.values()) + "};\n"
        + "\nexport const playgroundOutputs: Record<string, Block> = {\n" + "".join(line + "\n" for line in outputs.values()) + "};\n"
    )


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Fill a Part's code listings from the course's playground repo.")
    parser.add_argument("course_dir", type=Path)
    parser.add_argument("--part", type=int, required=True)
    parser.add_argument("--check", action="store_true", help="write nothing; exit 1 if a listing differs from the playground")
    parser.add_argument("--unit", help="read files from <course_dir>/units/NN/<branch>/ first: a chapter not applied yet")
    args = parser.parse_args(argv)
    target = _parts(args.course_dir) / f"part-{args.part:02d}.playground.ts"
    try:
        listings, outputs = entries(args.course_dir, sources(args.course_dir, args.part), args.unit)
    except SyncError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    if args.check:
        if not target.is_file():
            print(f"{target.name} does not exist: run sync_listings.py without --check")
            return 1
        text = target.read_text(encoding="utf-8")
        have = set(text.splitlines())
        drifted = [f"listing {name}" for name, line in listings.items() if line not in have]
        timeless = {_timeless(line) for line in have}
        drifted += [f"output {name}" for name, line in outputs.items() if _timeless(line) not in timeless]
        # A name the generated file still has but the sources no longer declare.
        written = {json.loads(m) for m in re.findall(r'^  ("(?:[^"\\]|\\.)*"): \{', text, re.M)}
        drifted += [f"listing {name}" for name in sorted(written - set(listings) - set(outputs))]
        for item in drifted:
            print(f"drift {item}: differs from the playground; run sync_listings.py --part {args.part}")
        if not drifted:
            print("ok")
        return 1 if drifted else 0
    target.write_text(render(listings, outputs), encoding="utf-8")
    print(f"wrote {target.name}: {len(listings)} listing(s), {len(outputs)} output(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
