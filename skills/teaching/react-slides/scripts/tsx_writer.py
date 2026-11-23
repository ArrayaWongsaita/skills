"""Emit a Part as a typed TSX file and a data file, plus the shared modules.

`part_tsx` writes one component element per slide against the fixed
component library in the template (`src/components`). Text becomes JSX:
inline markup maps to the text components, and any character JSX would
read becomes a string expression, so the page shows exactly the deck's
text. Code, output, diagrams, listings and the unit map go to
`part_data_ts` as JSON; each slide names its unit by id. Stdlib only.
"""

import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import contract  # noqa: E402
import deck as deckmod  # noqa: E402
from inline import Bold, Break, Code, Italic, Link, ListBlock, Para, Text, parse_field, parse_inline, parse_items  # noqa: E402

GENERATOR_VERSION = 2
# `map` would shadow JavaScript's Map, so its component is MapSlide.
COMPONENTS = {layout: "".join(word.capitalize() for word in layout.split("-")) for layout in contract.LAYOUTS} | {"map": "MapSlide"}
LABEL_KEYS = ("unit", "chapter", "lines", "elements")
TEXT_COMPONENTS = ("C", "A", "B", "I", "P", "Ol", "Ul", "Li")
PLAIN_JSX_RE = re.compile(r"^[^{}<>&\s](?:[^{}<>&\n]*[^{}<>&\s])?$")
INLINE_JSX_RE = re.compile(r"^[^{}<>&\n]*$")
SAFE_ATTR_RE = re.compile(r'^[^"&{}<>\\\n]*$')
EDITABLE = "// You may edit this file. Once it differs from what the skill wrote, the skill will not overwrite it."


def _js(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def part_slug(part: int) -> str:
    return f"part-{part:02d}"


def jsx_text(s: str) -> str:
    """JSX text for a string that may stand on its own line: plain when safe, else a string expression."""
    return s if PLAIN_JSX_RE.match(s) and "  " not in s else "{" + _js(s) + "}"


class _Emitter:
    """Turns inline nodes into JSX and records which text components it used."""

    def __init__(self):
        self.used: set[str] = set()

    def _tag(self, name: str, inner: str, attrs: str = "") -> str:
        self.used.add(name)
        return f"<{name}{attrs}>{inner}</{name}>"

    def nodes(self, nodes) -> str:
        return "".join(self.node(node) for node in nodes)

    def node(self, node) -> str:
        if isinstance(node, Text):
            # Inside a one-line fragment JSX keeps every space, so only JSX characters need quoting.
            return node.text if INLINE_JSX_RE.match(node.text) else "{" + _js(node.text) + "}"
        if isinstance(node, Code):
            return self._tag("C", "{" + _js(node.text) + "}")
        if isinstance(node, Link):
            return self._tag("A", self.nodes(node.children), " href={" + _js(node.href) + "}")
        if isinstance(node, Bold):
            return self._tag("B", self.nodes(node.children))
        if isinstance(node, Italic):
            return self._tag("I", self.nodes(node.children))
        if isinstance(node, Break):
            return "<br />"
        raise TypeError(f"unknown inline node {node!r}")

    def block(self, block) -> str:
        if isinstance(block, Para):
            return self._tag("P", self.nodes(block.nodes))
        items = "".join(self._tag("Li", self.nodes(item)) for item in block.items)
        return self._tag("Ol" if block.ordered else "Ul", items)

    def rich(self, text: str) -> str:
        blocks = parse_field(text)
        if len(blocks) == 1 and isinstance(blocks[0], Para):
            return "<>" + self.nodes(blocks[0].nodes) + "</>"
        return "<>" + "".join(self.block(block) for block in blocks) + "</>"

    def rich_items(self, items: list[str]) -> str:
        return "[" + ", ".join("<>" + self.nodes(parse_inline(item)) + "</>" for item in items) + "]"


def rich(text: str) -> str:
    return _Emitter().rich(text)


def rich_items(items: list[str]) -> str:
    return _Emitter().rich_items(items)


def visual_key(visual: dict) -> str:
    source = visual["description"] if visual["kind"] == "illustration" else visual["url"] + "\n" + visual["capture"]
    return hashlib.sha256(source.encode("utf-8")).hexdigest()[:8]


def _diagram_state(value: dict, with_new: bool) -> dict:
    state = {"kind": "diagram", "diagram": value["diagram"], "show": list(value.get("show", []))}
    if with_new and "new" in value:
        state["new"] = list(value["new"])
    state["highlight"] = list(value.get("highlight", []))
    state["dim"] = list(value.get("dim", []))
    return state


def _fallback(value: dict) -> dict:
    return {"kind": "text", "text": value["text"]} if value["kind"] == "text" else _diagram_state(value, with_new=False)


def _visual(visual: dict) -> dict:
    kind = visual["kind"]
    if kind == "diagram":
        return _diagram_state(visual, with_new=True)
    if kind == "illustration":
        return {"kind": kind, "key": visual_key(visual), "description": visual["description"], "prompt": visual["prompt"],
                "alt": visual["alt"], "fallback": _fallback(visual["fallback"])}
    return {"kind": kind, "key": visual_key(visual), "url": visual["url"], "capture": visual["capture"], "fallback": _fallback(visual["fallback"])}


def _block(block) -> dict:
    return {"lang": block.lang, "info": block.info, "text": block.text}


def _attr(name: str, value: str) -> str:
    return f'{name}="{value}"' if SAFE_ATTR_RE.match(value) else f"{name}={{{_js(value)}}}"


def _sections(d) -> dict[str, str]:
    return {slide.id: section.heading for section in d.sections for slide in section.slides}


def _slide(slide, heading: str, unit: str | None, emit: _Emitter) -> str:
    props = [
        _attr("id", slide.id),
        _attr("section", heading),
        _attr("purpose", str(slide.meta.get("purpose", ""))),
        "from={" + _js(list(slide.meta.get("from", []))) + "}",
        "sources={" + _js(list(slide.meta.get("sources", []))) + "}",
    ]
    if unit is not None:
        props.append(_attr("unit", unit))
    for name, field in slide.fields.items():
        value = emit.rich_items(parse_items(field.text)[0]) if name == "Items" else emit.rich(field.text)
        props.append(f"{name.lower()}={{{value}}}")
    if slide.layout == "code":
        props += [_attr("snippet", slide.meta["snippet"]), "lines={" + _js(slide.meta["lines"]) + "}",
                  "highlight={" + _js(slide.meta.get("highlight", [])) + "}"]
    elif slide.layout == "output":
        props.append(_attr("snippet", slide.meta["snippet"]))
    elif slide.layout == "answer":
        props.append(_attr("revisit", slide.meta["revisit"]))
    elif slide.layout == "assemble":
        labels = [{key: label[key] for key in LABEL_KEYS if key in label} for label in slide.meta["labels"]]
        props += [_attr("assembles", slide.meta["assembles"]), "labels={" + _js(labels) + "}"]
        if "snippet" in slide.meta:
            props += [_attr("snippet", slide.meta["snippet"]), "lines={" + _js(slide.meta["lines"]) + "}"]
    if slide.layout == "compare":
        for name in ("Left", "Right"):
            if slide.fields[name].blocks:
                props.append(f"{name.lower()}Blocks={{" + _js([_block(b) for b in slide.fields[name].blocks]) + "}")
    elif slide.layout in ("setup", "error") and slide.blocks:
        props.append("blocks={" + _js([_block(b) for b in slide.blocks]) + "}")
    if slide.visual is not None:
        props.append("visual={" + _js(_visual(slide.visual)) + "}")
    inner = "".join(f"\n        {prop}" for prop in props)
    return f"      <{COMPONENTS[slide.layout]}{inner}\n      />"


def _header(loaded, source: str) -> str:
    return f"// Generated by react-slides from {source} (deck sha256 {loaded.sha256}, GENERATOR_VERSION {GENERATOR_VERSION}).\n{EDITABLE}\n"


def part_tsx(loaded, part: int) -> str:
    d, slug, emit = loaded.deck, part_slug(part), _Emitter()
    headings, units = _sections(d), deckmod.slide_units(d.sections)
    slides = "\n".join(_slide(slide, headings[slide.id], units[slide.id], emit) for slide in d.slides())
    layouts = list(dict.fromkeys(COMPONENTS[slide.layout] for slide in d.slides()))
    names = ["Deck"] + layouts + [name for name in TEXT_COMPONENTS if name in emit.used]
    return (
        _header(loaded, f"{contract.SLIDES_DIR}/{loaded.path.name}")
        + f"import {{ {', '.join(names)} }} from '../components';\n"
        + f"import {{ meta, diagrams, listings, outputs, units }} from './{slug}.data';\n\n"
        + f"export default function Part{part:02d}() {{\n"
        + "  return (\n"
        + "    <Deck meta={meta} diagrams={diagrams} listings={listings} outputs={outputs} units={units}>\n"
        + slides + "\n"
        + "    </Deck>\n"
        + "  );\n"
        + "}\n"
    )


def _diagram(value: dict) -> dict:
    def pick(item: dict, keys: tuple, optional: tuple = ()) -> dict:
        out = {key: item.get(key) for key in keys}
        out.update({key: item[key] for key in optional if key in item})
        return out

    return {
        "id": value["id"],
        "title": value.get("title", ""),
        "canvas": value.get("canvas", [1, 1]),
        "nodes": [pick(n, ("id", "label", "concept", "at", "size")) for n in value.get("nodes", [])],
        "edges": [{**pick(e, ("id", "from", "to"), ("label",)), "style": e.get("style", "solid")} for e in value.get("edges", [])],
        "groups": [pick(g, ("id", "label"), ("concept",)) | {"members": list(g.get("members", []))} for g in value.get("groups", [])],
        "badges": [pick(b, ("id", "n", "near")) for b in value.get("badges", [])],
        "notes": [pick(n, ("id", "text", "near")) for n in value.get("notes", [])],
    }


def _units(units: dict | None) -> dict:
    """The unit map as the components read it; a deck@1 deck has none."""
    chapters = (units or {}).get("chapters", [])
    return {"chapters": [{"id": c.get("id"), "section": c.get("section"), "title": c.get("title", ""),
                          "units": [{"id": u.get("id"), "title": u.get("title", ""), "goal": u.get("goal", ""), "needs": list(u.get("needs", []))}
                                    for u in c.get("units", [])]}
                         for c in chapters]}


def part_data_ts(loaded, part: int) -> str:
    d = loaded.deck
    meta = {"course": d.meta.get("course", ""), "part": part, "slug": part_slug(part), "title": d.meta.get("title", ""),
            "language": d.meta.get("language", "en"), "slideCount": len(d.slides())}
    diagrams = {name: _diagram(value) for name, value in d.diagrams.items()}
    listings = {name: {"lang": listing.code.lang, "status": listing.meta.get("status"), "reason": listing.meta.get("reason", ""),
                       "code": listing.code.text} for name, listing in d.listings.items()}
    outputs = {slide.meta["snippet"]: _block(slide.blocks[0]) for slide in d.slides() if slide.layout == "output"}

    def const(name: str, kind: str, value) -> str:
        return f"export const {name}: {kind} = {json.dumps(value, ensure_ascii=False, indent=2)};\n"

    return (
        _header(loaded, f"{contract.SLIDES_DIR}/{loaded.path.name}")
        + "import type { Block, DiagramDef, Listing, PartMeta, Units } from '../components/types';\n\n"
        + const("meta", "PartMeta", meta) + "\n"
        + const("diagrams", "Record<string, DiagramDef>", diagrams) + "\n"
        + const("listings", "Record<string, Listing>", listings) + "\n"
        + const("outputs", "Record<string, Block>", outputs) + "\n"
        + const("units", "Units", _units(d.units))
    )


def vocabulary_ts(v) -> str:
    concepts = [{key: str(c.get(key, "")) for key in ("id", "meaning", "shape", "role", "icon")} for c in v.concepts]
    value = {"version": v.version, "roles": v.roles, "concepts": concepts, "style": v.style}
    return (
        f"// Generated by react-slides from {contract.SLIDES_DIR}/{contract.VOCABULARY_FILE} "
        f"(version {v.version}, GENERATOR_VERSION {GENERATOR_VERSION}).\n{EDITABLE}\n"
        + "import type { Vocabulary } from './components/types';\n\n"
        + f"export const vocabulary: Vocabulary = {json.dumps(value, ensure_ascii=False, indent=2)};\n"
    )


def course_ts(slug: str, title: str) -> str:
    return (
        "// Written once by react-slides. It is yours: the skill never overwrites it.\n"
        + f"export const course = {{ slug: {_js(slug)}, title: {_js(title)} }};\n"
    )
