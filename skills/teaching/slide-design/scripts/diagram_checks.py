"""Check diagram definitions and the per-slide build states that use them.

A diagram is drawn on a fixed grid, so a builder in Google Slides or React
places every node the same way. `check_diagram` checks one definition
(geometry, ids, references, concepts, label lengths). `check_states` checks
what each slide shows of a diagram: subsets, closure, the `new` rule
(`new` is exactly what this slide adds over the previous slide on the same
diagram) and numbered steps. Stdlib only.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from contract import CANVAS_MAX, DIAGRAM_ID_RE, EDGE_STYLES, ELEMENT_ID_RE, LABEL_LIMIT, NOTE_LIMIT, TITLE_LIMIT  # noqa: E402
from mdtext import visible_length  # noqa: E402

KINDS = (("nodes", "node"), ("edges", "edge"), ("groups", "group"), ("badges", "badge"), ("notes", "note"))
STATE_KEYS = ("show", "new", "highlight", "dim")
PARTS = ("new", "highlight", "dim")


def _items(diagram: dict, key: str) -> list[dict]:
    value = diagram.get(key, [])
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def element_kinds(diagram: dict) -> dict[str, str]:
    kinds: dict[str, str] = {}
    for key, kind in KINDS:
        for item in _items(diagram, key):
            kinds.setdefault(item.get("id"), kind)
    return kinds


def _pair(value) -> bool:
    return isinstance(value, list) and len(value) == 2 and all(isinstance(v, int) and not isinstance(v, bool) for v in value)


def _geometry(diagram: dict, messages: list[str]) -> None:
    canvas = diagram.get("canvas")
    if not (_pair(canvas) and 1 <= canvas[0] <= CANVAS_MAX[0] and 1 <= canvas[1] <= CANVAS_MAX[1]):
        messages.append(f"canvas must be [cols, rows] with at most {CANVAS_MAX[0]} × {CANVAS_MAX[1]}")
        return
    cols, rows = canvas
    boxes = []
    for node in _items(diagram, "nodes"):
        at, size = node.get("at"), node.get("size")
        if not (_pair(at) and _pair(size) and min(at) >= 0 and min(size) >= 1):
            messages.append(f"node {node.get('id')}: at must be [col, row] ≥ 0 and size [w, h] ≥ 1")
            continue
        if at[0] + size[0] > cols or at[1] + size[1] > rows:
            messages.append(f"node {node.get('id')} is outside the canvas")
        boxes.append((node.get("id"), at[0], at[1], at[0] + size[0], at[1] + size[1]))
    for index, (a, ax1, ay1, ax2, ay2) in enumerate(boxes):
        for b, bx1, by1, bx2, by2 in boxes[index + 1:]:
            if ax1 < bx2 and bx1 < ax2 and ay1 < by2 and by1 < ay2:
                messages.append(f"nodes overlap: {a}, {b}")


def check_diagram(diagram: dict, concepts: set[str]) -> list[str]:
    messages: list[str] = []
    if not DIAGRAM_ID_RE.match(str(diagram.get("id", ""))):
        messages.append(f"diagram id {diagram.get('id')!r} must look like d-<name>")
    if visible_length(str(diagram.get("title", ""))) > TITLE_LIMIT:
        messages.append(f"title too long: limit {TITLE_LIMIT}")
    seen: set[str] = set()
    for key, kind in KINDS:
        if not isinstance(diagram.get(key, []), list):
            messages.append(f"{key} must be a list")
        for item in _items(diagram, key):
            element = item.get("id")
            if not isinstance(element, str) or not ELEMENT_ID_RE.match(element):
                messages.append(f"{kind} id {element!r} must be lowercase letters, digits and hyphens")
            elif element in seen:
                messages.append(f"duplicate element id {element}")
            seen.add(element)
    _geometry(diagram, messages)

    kinds = element_kinds(diagram)
    nodes = {e for e, k in kinds.items() if k == "node"}
    ends = nodes | {e for e, k in kinds.items() if k == "group"}
    anchors = ends | {e for e, k in kinds.items() if k == "edge"}
    for node in _items(diagram, "nodes"):
        if node.get("concept") not in concepts:
            messages.append(f"node {node.get('id')}: unknown concept {node.get('concept')!r}")
    for edge in _items(diagram, "edges"):
        for end in ("from", "to"):
            if edge.get(end) not in ends:
                messages.append(f"edge {edge.get('id')}: unknown node {edge.get(end)!r}")
        if edge.get("from") == edge.get("to"):
            messages.append(f"edge {edge.get('id')} points to itself")
        if edge.get("style") not in EDGE_STYLES:
            messages.append(f"edge {edge.get('id')}: style must be one of {', '.join(EDGE_STYLES)}")
    for group in _items(diagram, "groups"):
        members = group.get("members")
        if not isinstance(members, list) or not members:
            messages.append(f"group {group.get('id')}: needs at least one member")
            members = []
        for member in members:
            if member not in nodes:
                messages.append(f"group {group.get('id')}: unknown node {member!r}")
        if "concept" in group and group["concept"] not in concepts:
            messages.append(f"group {group.get('id')}: unknown concept {group['concept']!r}")
    numbers = []
    for badge in _items(diagram, "badges"):
        n = badge.get("n")
        if not isinstance(n, int) or isinstance(n, bool) or n < 1:
            messages.append(f"badge {badge.get('id')}: n must be a positive whole number")
        numbers.append(n)
    if len(numbers) != len(set(map(str, numbers))):
        messages.append("badge numbers must be unique")
    for key, kind in (("badges", "badge"), ("notes", "note")):
        for item in _items(diagram, key):
            if item.get("near") not in anchors:
                messages.append(f"{kind} {item.get('id')}: unknown element {item.get('near')!r}")
    for key in ("nodes", "edges", "groups"):
        for item in _items(diagram, key):
            if visible_length(str(item.get("label", ""))) > LABEL_LIMIT:
                messages.append(f"label too long: {item.get('id')} (limit {LABEL_LIMIT})")
    for note in _items(diagram, "notes"):
        if visible_length(str(note.get("text", ""))) > NOTE_LIMIT:
            messages.append(f"note too long: {note.get('id')} (limit {NOTE_LIMIT})")
    return messages


def _closure(diagram: dict, shown: set[str]) -> list[str]:
    messages = []
    for edge in _items(diagram, "edges"):
        if edge.get("id") in shown:
            messages += [f"edge {edge['id']} shown without {edge.get(end)}" for end in ("from", "to") if edge.get(end) not in shown]
    for key, kind in (("badges", "badge"), ("notes", "note")):
        for item in _items(diagram, key):
            if item.get("id") in shown and item.get("near") not in shown:
                messages.append(f"{kind} {item['id']} shown without {item.get('near')}")
    for group in _items(diagram, "groups"):
        if group.get("id") in shown:
            members = group.get("members") if isinstance(group.get("members"), list) else []
            messages += [f"group {group['id']} shown without {member}" for member in members if member not in shown]
    return messages


def _state(visual: dict, diagrams: dict[str, dict]) -> tuple[dict | None, dict[str, list], list[str]]:
    """Common checks for one diagram state (a main visual or a fallback)."""
    diagram = diagrams.get(visual.get("diagram"))
    if diagram is None:
        return None, {}, [f"unknown diagram {visual.get('diagram')!r}"]
    messages: list[str] = []
    sets: dict[str, list] = {}
    for key in STATE_KEYS:
        value = visual.get(key, [])
        if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
            messages.append(f"{key} must be a list of element ids")
            value = []
        sets[key] = value
    kinds = element_kinds(diagram)
    for key in STATE_KEYS:
        messages += [f"unknown element {element!r} in {key}" for element in sets[key] if element not in kinds]
    shown = set(sets["show"])
    for key in PARTS:
        if not set(sets[key]) <= shown:
            messages.append(f"{key} is not a subset of show")
    for index, a in enumerate(PARTS):
        for b in PARTS[index + 1:]:
            if set(sets[a]) & set(sets[b]):
                messages.append(f"{a} and {b} overlap")
    messages += _closure(diagram, shown)
    return diagram, sets, messages


def check_states(slides: list, diagrams: dict[str, dict]) -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    previous: dict[str, set[str]] = {}
    for slide in slides:
        visual = slide.visual or {}
        if slide.layout == "steps" and visual.get("kind") != "diagram":
            found.append((slide.id, "a steps slide needs a diagram visual"))
        if visual.get("kind") == "diagram":
            diagram, sets, messages = _state(visual, diagrams)
            found += [(slide.id, m) for m in messages]
            if diagram is not None:
                shown = set(sets["show"])
                expected = shown - previous.get(diagram["id"], set())
                if set(sets["new"]) != expected:
                    found.append((slide.id, f"`new` does not match what this slide adds: expected [{', '.join(sorted(expected))}]"))
                previous[diagram["id"]] = shown
                if slide.layout == "steps":
                    badges = sorted(b.get("n") for b in _items(diagram, "badges") if b.get("id") in shown and isinstance(b.get("n"), int))
                    field = slide.fields.get("Items")
                    count = len(field.items) if field else 0
                    if badges != list(range(1, count + 1)):
                        found.append((slide.id, f"steps items ({count}) do not match visible badges [{', '.join(map(str, badges))}]"))
        fallback = visual.get("fallback")
        if isinstance(fallback, dict) and fallback.get("kind") == "diagram":
            _, _, messages = _state(fallback, diagrams)
            found += [(slide.id, f"fallback: {m}") for m in messages]
            if fallback.get("new"):
                found.append((slide.id, "fallback diagram takes no new"))
    return found
