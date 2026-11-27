#!/usr/bin/env python3
"""Fill a Part's code listings from the course's playground repo, so a slide never shows code the repo does not have.

    sync_listings.py <course_dir> --part N [--check]

It reads <course_dir>/web/src/parts/part-NN.sources.json:

    {"<name>": {"branch": "solutions", "path": "lessons/03-click/Click.test.tsx", "lang": "tsx",
                "output": "runs/03-solutions.txt"}}

and writes part-NN.playground.ts next to it, with `playgroundListings` (each file read with
`git show <branch>:<path>` in <course_dir>/playground, so the user's checkout is never switched) and
`playgroundOutputs` (for a source with `output`: that file, relative to <course_dir>, as saved by course-builder's
`check_playground.py --save-output`). The Part's data file spreads them into its own:

    export const listings = { ...playgroundListings, … };
    export const outputs = { ...playgroundOutputs, … };

With --check it writes nothing, and exits 1 naming each listing whose code or output differs from the playground.
"""

from __future__ import annotations

import argparse
import json
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


def _show(repo: Path, branch: str, path: str) -> str | None:
    result = subprocess.run(["git", "-C", str(repo), "show", f"{branch}:{path}"], capture_output=True)
    return result.stdout.decode("utf-8") if result.returncode == 0 else None


def _one_newline_off(text: str) -> str:
    text = text.replace("\r\n", "\n")
    return text[:-1] if text.endswith("\n") else text


def entries(course_dir: Path, srcs: dict[str, dict[str, str]]) -> tuple[dict[str, str], dict[str, str]]:
    """name -> the listing's line, name -> the output's line; raises SyncError naming every source it cannot read."""
    course_dir = Path(course_dir)
    repo = course_dir / "playground"
    listings, outputs, problems = {}, {}, []
    for name, source in srcs.items():
        where = f"{source['branch']}:{source['path']}"
        code = _show(repo, source["branch"], source["path"])
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
            text = _one_newline_off(output.read_text(encoding="utf-8"))
            outputs[name] = f"  {json.dumps(name, ensure_ascii=False)}: {{ lang: 'text', info: 'text', text: {json.dumps(text, ensure_ascii=False)} }},"
    if problems:
        raise SyncError("nothing was written:\n" + "\n".join(problems))
    return listings, outputs


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
    args = parser.parse_args(argv)
    target = _parts(args.course_dir) / f"part-{args.part:02d}.playground.ts"
    try:
        listings, outputs = entries(args.course_dir, sources(args.course_dir, args.part))
    except SyncError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    if args.check:
        if not target.is_file():
            print(f"{target.name} does not exist: run sync_listings.py without --check")
            return 1
        have = set(target.read_text(encoding="utf-8").splitlines())
        drifted = [f"listing {name}" for name, line in listings.items() if line not in have]
        drifted += [f"output {name}" for name, line in outputs.items() if line not in have]
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
