#!/usr/bin/env python3
"""Create a course's React app from the skill's template, add a Part skeleton, keep a Part's slide count right.

    scaffold.py <course_dir> [--title T] [--language L] [--part N --slug S --part-title T] [--skip-install]
    scaffold.py <course_dir> --sync-count PART

It creates what is missing and brings the course's copy of the template up to date: a template file the course has
not changed (one that matches a version in template-versions.json) is replaced by the current version, or removed when
the template dropped it. A file the course changed is never overwritten: the report lists it under `kept`. The report
is JSON on stdout.
"""

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "template"
WEB_DIR = "web"
SKIP_DIRS = ("node_modules", "dist", "__fixtures__")
SKIP_NAMES = (".DS_Store",)
WRITTEN_HERE = ("src/course.ts",)  # written by scaffold, with the course's own title
VERSIONS_FILE = "template-versions.json"  # beside the template: every version of each template file a course may hold
PACKAGE_FILES = ("package.json", "pnpm-lock.yaml")  # a new or updated one needs an install
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
PNPM_MISSING = "node and pnpm are needed to build the app: install Node.js 20 or later from https://nodejs.org and pnpm from https://pnpm.io/installation"
SLIDE_COUNT_RE = re.compile(r"""(?P<key>["']?slideCount["']?):\s*\d+""")  # as the skeleton writes it, or as a hand-edited data file may


class ScaffoldError(Exception):
    pass


def _run(cmd: list[str], cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)


def template_files(template_dir: Path) -> dict[str, str]:
    """The template's source files, relative to its root: no node_modules, build output, fixtures or tests."""
    files = {}
    for root, dirs, names in os.walk(template_dir):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
        for name in sorted(names):
            rel = (Path(root) / name).relative_to(template_dir).as_posix()
            if name in SKIP_NAMES or rel in WRITTEN_HERE or name.endswith((".test.ts", ".test.tsx")):
                continue
            files[rel] = (Path(root) / name).read_text(encoding="utf-8")
    return files


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_versions(template_dir: Path) -> dict[str, list[str]]:
    """Each template file, relative to the template's root, with the hash of every version of it that shipped."""
    path = template_dir.parent / VERSIONS_FILE
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}


def _course_text(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return None


def _sync(path: Path, text: str, shipped: list[str], root: Path, report: dict) -> None:
    """Create a missing template file, or replace a copy the course has not changed; keep one it changed."""
    rel = path.relative_to(root).as_posix()
    if not path.exists():
        _write_missing(path, text, root, report)
        return
    current = _course_text(path)
    if current == text:
        report["skipped"].append(rel)
    elif current is not None and text_hash(current) in shipped:
        path.write_text(text, encoding="utf-8")
        report["updated"].append(rel)
    else:
        report["kept"].append(rel)


def _drop(path: Path, shipped: list[str], root: Path, report: dict) -> None:
    """Remove a course's unchanged copy of a file the template no longer has; keep one it changed."""
    if not path.is_file():
        return
    current = _course_text(path)
    rel = path.relative_to(root).as_posix()
    if current is not None and text_hash(current) in shipped:
        path.unlink()
        report["removed"].append(rel)
    else:
        report["kept"].append(rel)


def _write_missing(path: Path, text: str, root: Path, report: dict) -> None:
    rel = path.relative_to(root).as_posix()
    if path.exists():
        report["skipped"].append(rel)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    report["created"].append(rel)


def _part_files(course: str, part: int, slug: str, title: str, language: str) -> dict[str, str]:
    nn = f"{part:02d}"
    meta = {"course": course, "part": part, "slug": slug, "title": title, "language": language, "slideCount": 1}
    data = (
        "import type { Block, Listing, PartMeta } from '../components/types';\n\n"
        f"export const meta: PartMeta = {json.dumps(meta, ensure_ascii=False, indent=2)};\n\n"
        "// Code the slides show, with its real output: name -> listing, name -> output.\n"
        "export const listings: Record<string, Listing> = {};\n"
        "export const outputs: Record<string, Block> = {};\n"
    )
    tsx = (
        "import { Cover, Deck } from '../components';\n"
        f"import {{ listings, meta, outputs }} from './part-{nn}.data';\n\n"
        f"export default function Part{nn}() {{\n"
        "  return (\n"
        "    <Deck meta={meta} diagrams={{}} listings={listings} outputs={outputs}>\n"
        f"      <Cover id=\"{part}-001\" section=\"Opening\" title={{<>{{{json.dumps(title, ensure_ascii=False)}}}</>}} />\n"
        "    </Deck>\n"
        "  );\n"
        "}\n"
    )
    return {f"src/parts/part-{nn}.data.ts": data, f"src/parts/part-{nn}.tsx": tsx}


def run(course_dir: Path, *, title: str | None, language: str | None, part: int | None, slug: str | None, part_title: str | None,
        skip_install: bool, template_dir: Path = TEMPLATE_DIR) -> dict:
    if part is not None:
        if part < 1:
            raise ScaffoldError("--part must be 1 or more")
        if not slug or not SLUG_RE.match(slug):
            raise ScaffoldError("--slug must be lowercase letters, digits and hyphens, such as what-is-ml")
        if not part_title:
            raise ScaffoldError("--part-title is needed with --part")
    if not template_dir.is_dir():
        raise ScaffoldError(f"the template is missing: {template_dir}")
    if not skip_install and shutil.which("pnpm") is None:
        raise ScaffoldError(PNPM_MISSING)

    report: dict = {"created": [], "updated": [], "removed": [], "kept": [], "skipped": [], "install": "skipped"}
    web = course_dir / WEB_DIR
    course = course_dir.name
    course_title = title or course
    files = template_files(template_dir)
    versions = load_versions(template_dir)
    for rel, text in files.items():
        _sync(web / rel, text, versions.get(rel, []), course_dir, report)
    for rel in sorted(set(versions) - set(files)):
        _drop(web / rel, versions[rel], course_dir, report)
    course_ts = f"// Written once by part-slides. It is yours: the skill never overwrites it.\nexport const course = {{ slug: {json.dumps(course)}, title: {json.dumps(course_title, ensure_ascii=False)} }};\n"
    _write_missing(web / "src/course.ts", course_ts, course_dir, report)

    if part is not None:
        work = course_dir / "parts" / f"{part:02d}-{slug}"
        if not work.exists():
            work.mkdir(parents=True)
            report["created"].append(work.relative_to(course_dir).as_posix())
        for rel, text in _part_files(course, part, slug, part_title, language or "en").items():
            _write_missing(web / rel, text, course_dir, report)

    package_changed = any(f"{WEB_DIR}/{name}" in report["updated"] + report["created"] for name in PACKAGE_FILES)
    if (web / "node_modules").is_dir() and not package_changed:
        report["install"] = "not-needed"
    elif not skip_install:
        result = _run(["pnpm", "install"], web)
        if result.returncode == 0:
            report["install"] = "ran"
        else:
            report["install"] = "failed"
            report["install_error"] = "\n".join((result.stdout or "").splitlines()[-30:])
    return report


def sync_count(course_dir: Path, part: int) -> int:
    """Set the Part's `slideCount` to the number of distinct slide ids (`<part>-<nnn>`) in its TSX file; the check page waits for that many."""
    nn = f"{part:02d}"
    tsx = course_dir / WEB_DIR / "src" / "parts" / f"part-{nn}.tsx"
    data = course_dir / WEB_DIR / "src" / "parts" / f"part-{nn}.data.ts"
    if not tsx.is_file() or not data.is_file():
        raise ScaffoldError(f"Part {part} has no files in {tsx.parent}: --sync-count takes the Part number, not the number of slides")
    ids = set(re.findall(rf"(?<![\w-])id=[\"']({part}-\d{{3}})[\"']", tsx.read_text(encoding="utf-8")))
    text = data.read_text(encoding="utf-8")
    if not SLIDE_COUNT_RE.search(text):
        raise ScaffoldError(f"no slideCount in {data.name}")
    data.write_text(SLIDE_COUNT_RE.sub(lambda m: f"{m.group('key')}: {len(ids)}", text, count=1), encoding="utf-8")
    return len(ids)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("course_dir", type=Path)
    parser.add_argument("--title")
    parser.add_argument("--language")
    parser.add_argument("--part", type=int)
    parser.add_argument("--slug")
    parser.add_argument("--part-title")
    parser.add_argument("--skip-install", action="store_true")
    parser.add_argument("--sync-count", type=int, metavar="PART")
    args = parser.parse_args(argv)
    try:
        if args.sync_count is not None:
            print(json.dumps({"part": args.sync_count, "slideCount": sync_count(args.course_dir, args.sync_count)}))
            return 0
        report = run(args.course_dir, title=args.title, language=args.language, part=args.part, slug=args.slug, part_title=args.part_title, skip_install=args.skip_install)
    except ScaffoldError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if report["install"] == "failed" else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
