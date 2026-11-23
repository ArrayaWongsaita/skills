"""Protect hand edits: record what the skill wrote, and skip what the user changed.

`web/.react-slides.json` holds the template version and, for every file
the skill wrote, its SHA-256, its kind (`template` or `generated`) and,
for generated files, the generator version. A file whose content no
longer matches its record, or that the skill never wrote, is the user's.
Stdlib only.
"""

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path

MANIFEST_FILE = ".react-slides.json"


@dataclass
class Manifest:
    template_version: str = ""
    files: dict[str, dict] = field(default_factory=dict)


def load(web: Path) -> Manifest:
    path = web / MANIFEST_FILE
    if not path.exists():
        return Manifest()
    data = json.loads(path.read_text(encoding="utf-8"))
    return Manifest(template_version=data.get("template_version", ""), files=dict(data.get("files", {})))


def save(web: Path, m: Manifest) -> None:
    data = {"template_version": m.template_version, "files": dict(sorted(m.files.items()))}
    _write(web / MANIFEST_FILE, json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def status(web: Path, rel: str, m: Manifest) -> str:
    """'absent', 'unedited' (the skill's last write) or 'edited' (changed by, or never written by, the skill)."""
    path = web / rel
    if not path.exists():
        return "absent"
    entry = m.files.get(rel)
    if entry is None:
        return "edited"
    return "unedited" if hashlib.sha256(path.read_bytes()).hexdigest() == entry["sha256"] else "edited"


def _nothing_new(web: Path, rel: str, text: str, state: str, m: Manifest) -> bool:
    """True when the skill would write what it wrote last time: an edit then has nothing to be weighed against."""
    if state == "edited":
        return rel in m.files and m.files[rel]["sha256"] == sha256_text(text)
    return state == "unedited" and (web / rel).read_bytes() == text.encode("utf-8")


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(text.encode("utf-8"))


def write_group(web: Path, files: dict[str, str], m: Manifest, *, kind: str, generator: int | None = None,
                force: frozenset[str] = frozenset()) -> dict[str, str]:
    """Write files that must change together; if any is edited, skip them all unless one of them is forced.

    Forcing any member forces the whole group, so a pair never ends up half the skill's and half the user's.
    """
    states = {rel: status(web, rel, m) for rel in files}
    if "edited" in states.values() and not force & set(files):
        if all(_nothing_new(web, rel, text, states[rel], m) for rel, text in files.items()):
            return {rel: "kept" if states[rel] == "edited" else "unchanged" for rel, text in files.items()}
        return {rel: "skipped" for rel in files}
    outcomes = {}
    for rel, text in files.items():
        path = web / rel
        if states[rel] == "edited":
            outcomes[rel] = "forced"
        elif states[rel] == "unedited" and path.read_bytes() == text.encode("utf-8"):
            outcomes[rel] = "unchanged"
        else:
            outcomes[rel] = "written"
        if outcomes[rel] != "unchanged":
            _write(path, text)
        m.files[rel] = {"sha256": sha256_text(text), "kind": kind, "generator": generator}
    return outcomes


def write_once(web: Path, rel: str, text: str) -> bool:
    """Write a file the user owns from then on; never overwrite it. Not tracked."""
    path = web / rel
    if path.exists():
        return False
    _write(path, text)
    return True
