"""Scaffold or upgrade a course's React app and convert Parts into it.

    python3 build_part.py <course_dir> (<N> | --all) [--force <path>]... [--skip-install]

The app lives in `<course_dir>/web/`. Every run syncs the template files,
writes `src/course.ts` once, and converts the named Parts (or, with
`--all`, every Part that has a deck) into `src/parts/part-NN.tsx` and
`part-NN.data.ts`, under the manifest rules: a file the user edited is
skipped and listed, and `--force <path>` overwrites it. It writes
`_work/part-NN/visuals.json` and prints a JSON report on stdout. Deck
errors go to stderr as `error: …` lines, with exit status 1. Stdlib only.
"""

import argparse
import difflib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import deck_reader  # noqa: E402
import inline  # noqa: E402
import manifest  # noqa: E402
import tsx_writer  # noqa: E402

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "template"
WEB_DIR = "web"
WORK_DIR = "_work"
SKIP_DIRS = ("node_modules", "dist", "__fixtures__")
SKIP_FILES = ("src/course.ts", "src/vocabulary.ts")
SKIP_NAMES = (".DS_Store",)
IMAGE_EXTENSIONS = (".png", ".jpg", ".webp")
GENERATED_TSX_RE = re.compile(r"^src/parts/part-(\d{2,})\.tsx$")
NPM_MISSING = "node and npm are needed to build the app: install Node.js 20 or later from https://nodejs.org"
DIFF_LINES = 60


class BuildError(Exception):
    pass


def template_files(template_dir: Path) -> dict[str, str]:
    files = {}
    for root, dirs, names in os.walk(template_dir):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
        for name in sorted(names):
            rel = (Path(root) / name).relative_to(template_dir).as_posix()
            if name in SKIP_NAMES or rel in SKIP_FILES or name.endswith((".test.ts", ".test.tsx")):
                continue
            files[rel] = (Path(root) / name).read_text(encoding="utf-8")
    return files


def _template_version(template_dir: Path) -> str:
    return str(json.loads((template_dir / "package.json").read_text(encoding="utf-8")).get("version", ""))


def _major(version: str) -> str:
    return version.split(".", 1)[0]


def _normalise(path: str) -> str:
    path = path.replace("\\", "/")
    while path.startswith(("./", f"{WEB_DIR}/")):
        path = path.split("/", 1)[1]
    return path


def _load(course_dir: Path, parts: list[int], loaded: dict, errors: list) -> None:
    for part in parts:
        if part in loaded or any(entry["part"] == part for entry in errors):
            continue
        try:
            loaded[part] = deck_reader.load(course_dir, part)
        except deck_reader.DeckError as error:
            try:
                name = f"slides/{deck_reader.find_deck(course_dir, part).name}"
            except deck_reader.DeckError:
                name = f"Part {part}"
            errors.append({"part": part, "deck": name, "errors": error.errors})


def _assets(web: Path, slug: str, key: str) -> list[Path]:
    found = [web / "src/assets/images" / slug / f"{key}{ext}" for ext in IMAGE_EXTENSIONS]
    return [path for path in found if path.exists()]


def _visuals(web: Path, loaded, part: int) -> list[dict]:
    slug, entries = tsx_writer.part_slug(part), []
    for slide in loaded.deck.slides():
        visual = slide.visual
        if not visual or visual.get("kind") not in ("illustration", "screenshot"):
            continue
        key = tsx_writer.visual_key(visual)
        entry = {"part": part, "slide": slide.id, "kind": visual["kind"], "key": key}
        if visual["kind"] == "illustration":
            path = f"src/illustrations/{slug}/{key}.tsx"
            exists = (web / path).exists() or bool(_assets(web, slug, key))
            entry |= {"path": path, "exists": exists, "description": visual["description"], "prompt": visual["prompt"], "alt": visual["alt"]}
        else:
            path = f"src/assets/images/{slug}/{key}.png"
            entry |= {"path": path, "exists": bool(_assets(web, slug, key)), "url": visual["url"], "capture": visual["capture"],
                      "alt": visual["capture"]}
        entries.append(entry)
    return entries


def _unused(web: Path, part: int, keys: set[str]) -> list[str]:
    slug, unused = tsx_writer.part_slug(part), []
    for folder in (web / "src/illustrations" / slug, web / "src/assets/images" / slug):
        if folder.is_dir():
            unused += [path.relative_to(web).as_posix() for path in sorted(folder.iterdir())
                       if path.is_file() and not path.name.startswith(".") and path.stem not in keys]
    return unused


def _warnings(loaded, part: int, course_dir: Path) -> list[str]:
    meta, warnings = loaded.deck.meta, []
    if loaded.stale:
        warnings.append(f"Part {part}: the deck is stale: its source_sha256 no longer matches {meta.get('source_file')}. "
                        "Redo it with slide-design to pick up the Part's changes.")
    elif loaded.stale is None:
        warnings.append(f"Part {part}: the Part file {meta.get('source_file')} is missing, so staleness was not checked.")
    for slide in loaded.deck.slides():
        for name, field in slide.fields.items():
            for message in inline.unsupported(field.text):
                warnings.append(f"Part {part}: {slide.id} {name}: {message}")
    return warnings


def _diff(web: Path, rel: str, text: str) -> str:
    current = (web / rel).read_text(encoding="utf-8").splitlines()
    lines = list(difflib.unified_diff(current, text.splitlines(), f"{rel} (yours)", f"{rel} (new)", lineterm="", n=1))
    return "\n".join(lines[:DIFF_LINES] + (["…"] if len(lines) > DIFF_LINES else []))


def _install(web: Path, needed: bool, skip: bool) -> str:
    if not needed:
        return "not-needed"
    if skip:
        return "skipped"
    result = subprocess.run(["npm", "install"], cwd=web, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if result.returncode != 0:
        raise BuildError("npm install failed:\n" + "\n".join(result.stdout.splitlines()[-30:]))
    return "ran"


def _remove_dropped(web: Path, m: manifest.Manifest, template: set[str], report: dict) -> None:
    """Delete template files the template no longer has; one the user edited stays and is listed as dropped."""
    for rel in sorted(rel for rel, entry in m.files.items() if entry.get("kind") == "template" and rel not in template):
        state = manifest.status(web, rel, m)
        if state == "edited":
            report["dropped"].append(rel)
            continue
        if state == "unedited":
            (web / rel).unlink()
            report["removed"].append(rel)
        del m.files[rel]


def run(course_dir: Path, parts: list[int] | None, *, template_dir: Path = TEMPLATE_DIR, force: frozenset[str] = frozenset(),
        skip_install: bool = False) -> dict:
    course_dir = Path(course_dir)
    if not course_dir.is_dir():
        raise BuildError(f"no course folder at {course_dir}")
    if not skip_install and shutil.which("npm") is None:
        raise BuildError(NPM_MISSING)
    web, m = course_dir / WEB_DIR, manifest.load(course_dir / WEB_DIR)
    version = _template_version(template_dir)
    loaded, errors = {}, []
    _load(course_dir, deck_reader.deck_parts(course_dir) if parts is None else parts, loaded, errors)
    if parts is not None and errors:
        loaded = {}
    elif m.template_version and _major(m.template_version) != _major(version):
        _load(course_dir, deck_reader.deck_parts(course_dir), loaded, errors)
    report = {"web": str(web), "parts": sorted(loaded), "written": [], "unchanged": [], "kept": [], "skipped": [], "forced": [], "removed": [], "dropped": [],
              "diffs": {}, "warnings": [], "stale": [], "visuals": [], "unused": [], "older_parts": [],
              "template_version": version, "install": "not-needed", "errors": errors}
    if not loaded:
        return report

    generator = tsx_writer.GENERATOR_VERSION
    template = template_files(template_dir)
    groups = [({rel: text}, "template", None) for rel, text in template.items()]
    groups.append(({"src/vocabulary.ts": tsx_writer.vocabulary_ts(next(iter(loaded.values())).vocabulary)}, "generated", generator))
    for part, item in sorted(loaded.items()):
        slug = tsx_writer.part_slug(part)
        groups.append(({f"src/parts/{slug}.tsx": tsx_writer.part_tsx(item, part),
                        f"src/parts/{slug}.data.ts": tsx_writer.part_data_ts(item, part)}, "generated", generator))

    force = frozenset(_normalise(path) for path in force)
    blocked = sorted(rel for files, _, _ in groups if any(manifest.status(web, r, m) == "edited" for r in files) for rel in files)
    for path in sorted(force - set(blocked)):
        raise BuildError(f"--force {path} is not a file you edited; edited files: {', '.join(blocked) or 'none'}")

    for files, kind, gen in groups:
        for rel, outcome in manifest.write_group(web, files, m, kind=kind, generator=gen, force=force).items():
            report[outcome].append(rel)
            if outcome == "skipped":
                report["diffs"][rel] = _diff(web, rel, files[rel])
    _remove_dropped(web, m, set(template), report)
    if manifest.write_once(web, "src/course.ts", tsx_writer.course_ts(course_dir.name, deck_reader.read_course_title(course_dir))):
        report["written"].append("src/course.ts")
    m.template_version = version
    manifest.save(web, m)

    for part, item in sorted(loaded.items()):
        visuals = _visuals(web, item, part)
        work = web / WORK_DIR / tsx_writer.part_slug(part)
        work.mkdir(parents=True, exist_ok=True)
        (work / "visuals.json").write_text(json.dumps(visuals, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        report["visuals"] += visuals
        report["unused"] += _unused(web, part, {v["key"] for v in visuals})
        report["warnings"] += _warnings(item, part, course_dir)
        if item.stale:
            report["stale"].append(part)
    for rel, entry in m.files.items():
        match = GENERATED_TSX_RE.match(rel)
        if match and int(match.group(1)) not in loaded and (entry.get("generator") or 0) < generator:
            report["older_parts"].append(int(match.group(1)))
    report["older_parts"].sort()

    changed = {"package.json", "package-lock.json"} & set(report["written"] + report["forced"])
    try:
        report["install"] = _install(web, bool(changed) or not (web / "node_modules").exists(), skip_install)
    except BuildError as error:  # the files are written: the report must still reach the coordinator
        report["install"], report["install_error"] = "failed", str(error)
    return report


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="build_part.py", description=__doc__.split("\n\n")[0])
    parser.add_argument("course_dir", type=Path)
    parser.add_argument("part", nargs="?", type=int)
    parser.add_argument("--all", action="store_true", help="convert every Part that has a deck")
    parser.add_argument("--force", action="append", default=[], metavar="PATH", help="overwrite this skipped file")
    parser.add_argument("--skip-install", action="store_true", help="do not run npm install")
    args = parser.parse_args(argv)
    if (args.part is None) == (not args.all):
        parser.error("name one Part number, or pass --all")
    try:
        report = run(args.course_dir, None if args.all else [args.part], template_dir=TEMPLATE_DIR,
                     force=frozenset(args.force), skip_install=args.skip_install)
    except BuildError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(json.dumps(report, ensure_ascii=False, indent=2))
    for entry in report["errors"]:
        for message in entry["errors"]:
            print(f"error: {entry['deck']}: {message}", file=sys.stderr)
    if report["errors"]:
        print("error: fix the deck with slide-design (its validate_deck.py names the same problems), then run again", file=sys.stderr)
    if report["install"] == "failed":
        print(f"error: {report['install_error']}", file=sys.stderr)
    return 1 if report["errors"] or report["install"] == "failed" else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
