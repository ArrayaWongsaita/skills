"""The course-wide visual vocabulary (slide-design/vocabulary@1).

Every Part's deck draws the same concept the same way: one shape and one
colour role per concept, and one illustration style for the whole course.
The file is append-only. Later Parts add concepts and never change one an
earlier deck already uses; `add_concepts` enforces that.

CLI:
    python3 vocabulary.py init <course_dir> --course <slug> --style "<sentence>"
    python3 vocabulary.py add  <course_dir> <concepts.json> --part <N>
    python3 vocabulary.py show <course_dir>
"""

import copy
import datetime
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import frontmatter  # noqa: E402
from contract import DEFAULT_ROLES, ELEMENT_ID_RE, SHAPES, SLIDES_DIR, VOCABULARY_FILE, VOCABULARY_TEMPLATE_ID  # noqa: E402
from mdtext import scan  # noqa: E402

CONCEPT_KEYS = ("id", "meaning", "shape", "role", "icon")
COMPARED_KEYS = ("meaning", "shape", "role", "icon")


class VocabularyError(ValueError):
    pass


@dataclass
class Vocabulary:
    course: str
    version: int
    updated: str
    roles: dict[str, str]
    concepts: dict[str, dict] = field(default_factory=dict)
    style: str = ""


def _today() -> str:
    return datetime.date.today().isoformat()


def vocabulary_path(course_dir: Path) -> Path:
    return Path(course_dir) / SLIDES_DIR / VOCABULARY_FILE


def init_vocabulary(course: str, style: str) -> Vocabulary:
    return Vocabulary(course=course, version=0, updated=_today(), roles=dict(DEFAULT_ROLES), concepts={}, style=style)


def load(course_dir: Path) -> Vocabulary:
    path = vocabulary_path(course_dir)
    if not path.exists():
        raise VocabularyError(f"no vocabulary at {path}: run vocabulary.py init")
    try:
        meta, body = frontmatter.parse(path.read_text(encoding="utf-8"))
    except ValueError as error:
        raise VocabularyError(f"{path.name}: {error}") from None
    if meta.get("template") != VOCABULARY_TEMPLATE_ID:
        raise VocabularyError(f"{path.name}: template must be {VOCABULARY_TEMPLATE_ID!r}")
    doc = scan(body)
    blocks = {block.lang: doc.block_text(block) for block in doc.blocks}
    try:
        roles = json.loads(blocks["roles"])
        concepts = json.loads(blocks["concepts"])
        style = json.loads(blocks["style"])
    except (KeyError, json.JSONDecodeError) as error:
        raise VocabularyError(f"{path.name}: roles, concepts and style blocks must hold valid JSON ({error})") from None
    return Vocabulary(
        course=meta.get("course", ""),
        version=meta.get("version", 0),
        updated=meta.get("updated", ""),
        roles=roles,
        concepts={concept["id"]: concept for concept in concepts},
        style=style,
    )


def render(vocab: Vocabulary) -> str:
    data = {"template": VOCABULARY_TEMPLATE_ID, "course": vocab.course, "version": vocab.version, "updated": vocab.updated}
    concepts = ",\n".join(json.dumps(concept, ensure_ascii=False) for concept in vocab.concepts.values())
    concepts_block = f"[\n{concepts}\n]" if concepts else "[]"
    return (
        frontmatter.render(data)
        + "# Visual vocabulary\n\n"
        + "## Colour roles\n\n```roles\n" + json.dumps(vocab.roles, ensure_ascii=False) + "\n```\n\n"
        + "## Concepts\n\n```concepts\n" + concepts_block + "\n```\n\n"
        + "## Illustration style\n\n```style\n" + json.dumps(vocab.style, ensure_ascii=False) + "\n```\n"
    )


def save(course_dir: Path, vocab: Vocabulary) -> None:
    path = vocabulary_path(course_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render(vocab), encoding="utf-8")


def _checked(concept: dict, roles: dict) -> dict:
    missing = [key for key in ("id", "meaning", "shape", "role") if not concept.get(key)]
    if missing:
        raise VocabularyError(f"concept {concept.get('id', '?')!r} is missing {', '.join(missing)}")
    if not ELEMENT_ID_RE.match(concept["id"]):
        raise VocabularyError(f"concept id {concept['id']!r} must be lowercase letters, digits and hyphens")
    if concept["shape"] not in SHAPES:
        raise VocabularyError(f"concept {concept['id']!r}: shape must be one of {', '.join(SHAPES)}")
    if concept["role"] not in roles:
        raise VocabularyError(f"concept {concept['id']!r}: role must be one of {', '.join(roles)}")
    return {key: concept.get(key, "") for key in CONCEPT_KEYS}


def add_concepts(vocab: Vocabulary, new: list[dict], part: int) -> Vocabulary:
    result = copy.deepcopy(vocab)
    added = 0
    for raw in new:
        concept = _checked(raw, result.roles)
        existing = result.concepts.get(concept["id"])
        if existing is not None:
            if any(existing.get(key, "") != concept[key] for key in COMPARED_KEYS):
                raise VocabularyError(f"concept {concept['id']!r} already exists with other values; the vocabulary is append-only")
            continue
        result.concepts[concept["id"]] = {**concept, "added_in": part}
        added += 1
    if added:
        result.version += 1
        result.updated = _today()
    return result


def _option(args: list[str], name: str) -> str:
    if name not in args or args.index(name) + 1 >= len(args):
        raise VocabularyError(f"missing {name} <value>")
    return args[args.index(name) + 1]


def _cli(argv: list[str]) -> int:
    if len(argv) < 2:
        raise VocabularyError("usage: vocabulary.py <init|add|show> <course_dir> [args]")
    command, course_dir, args = argv[0], Path(argv[1]), argv[2:]
    if command == "init":
        if vocabulary_path(course_dir).exists():
            raise VocabularyError(f"{vocabulary_path(course_dir)} exists; use add")
        save(course_dir, init_vocabulary(_option(args, "--course"), _option(args, "--style")))
        return 0
    if command == "add" and args:
        new = json.loads(Path(args[0]).read_text(encoding="utf-8"))
        save(course_dir, add_concepts(load(course_dir), new, int(_option(args, "--part"))))
        return 0
    if command == "show":
        vocab = load(course_dir)
        shown = {"course": vocab.course, "version": vocab.version, "roles": vocab.roles, "concepts": vocab.concepts, "style": vocab.style}
        print(json.dumps(shown, ensure_ascii=False))
        return 0
    raise VocabularyError(f"unknown command or wrong arguments: {command} {' '.join(args)}")


if __name__ == "__main__":
    try:
        sys.exit(_cli(sys.argv[1:]))
    except (VocabularyError, ValueError, OSError) as error:
        print(f"error: {error}", file=sys.stderr)
        sys.exit(1)
