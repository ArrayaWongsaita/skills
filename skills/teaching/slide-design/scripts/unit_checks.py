"""Check a deck@2 deck's unit structure against its unit map.

The opening holds the one `map` slide. Every sub-topic section opens with a
`topic` slide, and the topics follow the unit map: one per unit, in map
order, each in its chapter's section, its Title and Body the unit's title and
goal. A chapter of two or more units is put back together by `assemble`
slides after its last unit; their labels name every unit the chapter teaches.
The closing holds the assembly of the whole Part, which labels every chapter.

check_structure assumes the unit map itself is valid (units.check_units).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from contract import PART_ASSEMBLY  # noqa: E402
from deck import Section, Slide  # noqa: E402
from units import chapter_list, chapter_units, unit_chapters, units_by_id  # noqa: E402

OPENING_KEY, CLOSING_KEY = "opening", "closing"

Problem = tuple[str, str]  # (slide id or "deck", message)


def _field(slide: Slide, name: str) -> str:
    field = slide.fields.get(name)
    return field.text.strip() if field else ""


def _ranges(value) -> list[tuple[int, int]] | None:
    """[[first, last], …] with 1 <= first <= last, ascending and not overlapping; else None."""
    if not isinstance(value, list) or not value:
        return None
    ranges, previous = [], 0
    for item in value:
        if not (isinstance(item, list) and len(item) == 2 and all(isinstance(n, int) and not isinstance(n, bool) for n in item)):
            return None
        first, last = item
        if not previous < first <= last:
            return None
        ranges.append((first, last))
        previous = last
    return ranges


def _labels(slide: Slide) -> list[dict] | None:
    labels = slide.meta.get("labels")
    if not isinstance(labels, list) or not labels or not all(isinstance(label, dict) for label in labels):
        return None
    return labels


def _shows_diagram(slide: Slide) -> bool:
    return isinstance(slide.visual, dict) and slide.visual.get("kind") == "diagram"


def _shape(slide: Slide) -> list[str]:
    """An assemble slide shows code (a snippet and its one block) or a diagram, never both."""
    code = "snippet" in slide.meta
    if code and (slide.visual is not None):
        return ["an assemble slide shows code or a diagram, not both"]
    if not code and slide.blocks:
        return ["an assemble slide shows code or a diagram, not both"]
    if not code and not _shows_diagram(slide):
        return ["an assemble slide shows code or a diagram, and has neither"]
    return []


def _code_labels(slide: Slide, labels: list[dict]) -> list[str]:
    shown = _ranges(slide.meta.get("lines")) or []
    messages, taken = [], []
    for label in labels:
        ranges = _ranges(label.get("lines"))
        if ranges is None or any(not any(a <= first and last <= b for a, b in shown) for first, last in ranges):
            messages.append("label lines must lie inside the shown lines")
            continue
        taken += ranges
    taken.sort()
    if any(later[0] <= earlier[1] for earlier, later in zip(taken, taken[1:])):
        messages.append("label ranges overlap")
    return list(dict.fromkeys(messages))


def _diagram_labels(slide: Slide, labels: list[dict]) -> list[str]:
    shown = set(slide.visual.get("show") or []) if _shows_diagram(slide) else set()
    for label in labels:
        elements = label.get("elements")
        if not isinstance(elements, list) or not elements or not all(isinstance(e, str) and e in shown for e in elements):
            return ["label elements must be shown"]
    return []


class _Checker:
    def __init__(self, sections: list[Section], units: dict):
        self.sections = sections
        self.chapters = chapter_list(units)
        self.by_id = units_by_id(units)
        self.chapter_of = unit_chapters(units)
        self.section_of = {chapter.get("id"): chapter.get("section") for chapter in self.chapters}
        self.position = {chapter.get("id"): index for index, chapter in enumerate(self.chapters)}
        self.found: list[Problem] = []
        self.labelled: dict[str, set[str]] = {}  # chapter id -> unit ids its assemblies label
        self.assemblies: dict[str, list[str]] = {}  # chapter id -> its assemble slide ids
        self.topics: set[str] = set()

    def add(self, where: str, messages: list[str]) -> None:
        self.found += [(where, message) for message in messages]

    def run(self) -> list[Problem]:
        for section in self.sections:
            if section.key == OPENING_KEY:
                self._opening(section)
            elif section.key == CLOSING_KEY:
                self._closing(section)
            else:
                self._subtopic(section)
        self._chapters()
        return self.found

    # --- sections ------------------------------------------------------------

    def _placement(self, section: Section, layout: str) -> None:
        for slide in section.slides:
            if slide.layout == layout:
                self.add(slide.id, [f"a {layout} slide does not belong in {section.heading}"])

    def _opening(self, section: Section) -> None:
        if sum(slide.layout == "map" for slide in section.slides) != 1:
            self.add("deck", ["the opening needs exactly one map slide"])
        self._placement(section, "topic")
        self._part_assemblies_misplaced(section)
        self._chapter_assemblies_misplaced(section)

    def _closing(self, section: Section) -> None:
        self._placement(section, "map")
        self._placement(section, "topic")
        self._chapter_assemblies_misplaced(section)
        parts = [slide for slide in section.slides if slide.layout == "assemble" and slide.meta.get("assembles") == PART_ASSEMBLY]
        if not parts:
            self.add("deck", ["the closing needs an assemble slide for the whole Part"])
            return
        named: set[str] = set()
        for slide in parts:
            messages = [] if _shows_diagram(slide) and "snippet" not in slide.meta else ["the Part assembly shows a diagram"]
            labels = _labels(slide)
            if labels is None:
                messages.append("labels must be a non-empty list of objects")
            else:
                if any(label.get("chapter") not in self.position for label in labels):
                    messages.append("a Part assembly label names a chapter of the unit map")
                named |= {label.get("chapter") for label in labels}
                messages += _diagram_labels(slide, labels)
            self.add(slide.id, messages)
        self.add(parts[-1].id, [f"the Part assembly does not label chapter {chapter.get('id')}" for chapter in self.chapters if chapter.get("id") not in named])

    def _part_assemblies_misplaced(self, section: Section) -> None:
        for slide in section.slides:
            if slide.layout == "assemble" and slide.meta.get("assembles") == PART_ASSEMBLY:
                self.add(slide.id, ["a Part assembly belongs in the closing"])

    def _chapter_assemblies_misplaced(self, section: Section) -> None:
        for slide in section.slides:
            if slide.layout == "assemble" and slide.meta.get("assembles") != PART_ASSEMBLY:
                self.add(slide.id, [f"assembles {slide.meta.get('assembles')}, but the current chapter is none"])

    def _subtopic(self, section: Section) -> None:
        self._placement(section, "map")
        self._part_assemblies_misplaced(section)
        if section.slides and section.slides[0].layout != "topic":
            self.add(section.slides[0].id, ["a sub-topic section starts with a topic slide"])
        expected = [unit.get("id") for chapter in self.chapters if chapter.get("section") == section.key for unit in chapter_units(chapter)]
        count, current, closed = 0, None, set()
        for slide in section.slides:
            if slide.layout == "topic":
                self._topic(slide, expected, count, closed)
                count += 1
                current = self.chapter_of.get(slide.meta.get("unit"))
            elif slide.layout == "assemble" and slide.meta.get("assembles") != PART_ASSEMBLY:
                self._assembly(slide, current)
                closed.add(slide.meta.get("assembles"))

    def _topic(self, slide: Slide, expected: list[str], count: int, closed: set) -> None:
        uid = slide.meta.get("unit")
        if isinstance(uid, str):
            self.topics.add(uid)
        if count >= len(expected):
            self.add(slide.id, [f"this section has {len(expected)} units in the unit map; this topic slide is one too many"])
        elif uid != expected[count]:
            self.add(slide.id, [f"expected unit {expected[count]} here, in unit-map order"])
        unit = self.by_id.get(uid)
        if unit is None:
            return
        messages = []
        if self.chapter_of.get(uid) in closed:
            messages.append("a chapter's assemble slides come after its last unit")
        if _field(slide, "Title") != str(unit.get("title", "")).strip():
            messages.append("topic title must equal the unit title")
        if _field(slide, "Body") != str(unit.get("goal", "")).strip():
            messages.append("topic body must equal the unit goal")
        self.add(slide.id, messages)

    def _assembly(self, slide: Slide, current: str | None) -> None:
        chapter = slide.meta.get("assembles")
        messages = []
        if chapter != current:
            messages.append(f"assembles {chapter}, but the current chapter is {current or 'none'}")
        self.assemblies.setdefault(chapter, []).append(slide.id)
        messages += _shape(slide)
        labels = _labels(slide)
        if labels is None:
            self.add(slide.id, messages + ["labels must be a non-empty list of objects"])
            return
        for label in labels:
            uid = label.get("unit")
            if uid not in self.by_id:
                messages.append(f"a chapter assembly label names a unit of the unit map, not {uid!r}")
                continue
            home = self.chapter_of[uid]
            if self.section_of.get(home) != self.section_of.get(chapter):
                messages.append(f"label names {uid} from another section")
            elif chapter in self.position and self.position[home] > self.position[chapter]:
                messages.append(f"label names {uid} from a later chapter")
            self.labelled.setdefault(chapter, set()).add(uid)
        messages += _code_labels(slide, labels) if "snippet" in slide.meta else _diagram_labels(slide, labels)
        self.add(slide.id, messages)

    # --- the whole map -------------------------------------------------------

    def _chapters(self) -> None:
        for uid in self.by_id:
            if uid not in self.topics:
                self.add("deck", [f"unit {uid} has no topic slide"])
        for chapter in self.chapters:
            cid, units = chapter.get("id"), chapter_units(chapter)
            slides = self.assemblies.get(cid, [])
            if len(units) == 1:
                for slide_id in slides:
                    self.add(slide_id, [f"chapter {cid} has one unit and takes no assemble slide"])
            elif not slides:
                self.add("deck", [f"chapter {cid} has {len(units)} units and needs an assemble slide"])
            else:
                labelled = self.labelled.get(cid, set())
                self.add("deck", [f"chapter {cid}: assembly does not label {unit.get('id')}" for unit in units
                                  if not unit.get("moved_from") and unit.get("id") not in labelled])


def check_structure(sections: list[Section], units: dict) -> list[Problem]:
    """Every unit-structure problem of a deck@2 deck, as (slide id or "deck", message)."""
    return _Checker(sections, units).run()
