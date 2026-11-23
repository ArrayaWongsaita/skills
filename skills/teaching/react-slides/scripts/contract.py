"""Single source of truth for the slide-design file contracts.

The input contract (course-research's Part and overview templates), the
deck contract (slide-design/deck@1), the vocabulary contract
(slide-design/vocabulary@1), layouts, limits and run stages are defined
here and nowhere else. Renaming a heading, a field label or a JSON key is a
breaking change for the downstream skill that builds slides from a deck:
bump the template id when you do.
"""

import re
from collections import namedtuple

# --- input: course-research ----------------------------------------------

PART_TEMPLATE_ID = "course-research/part@1"
OVERVIEW_TEMPLATE_ID = "course-research/overview@1"
PART_FILE_RE = re.compile(r"^part-(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$")
OVERVIEW_FILE = "00-overview.md"

PART_SECTIONS = (
    "Context",
    "Objectives",
    "Prerequisites and setup",
    "Key terms",
    "Core mental model",
    "Real-world task",
    "Sub-topics",
    "Practice material",
    "Bridge to next part",
    "Further reading",
    "Sources",
)
SUBTOPIC_SLOTS = ("Core knowledge", "Worked example", "Analogy", "Misconceptions", "Common errors and fixes", "Self-check", "Sources")
COVERED_SECTIONS = (
    "Objectives",
    "Prerequisites and setup",
    "Key terms",
    "Core mental model",
    "Real-world task",
    "Practice material",
    "Bridge to next part",
    "Further reading",
    "Sources",
)
COVERED_SLOTS = ("Core knowledge", "Worked example", "Analogy", "Misconceptions", "Common errors and fixes", "Self-check")

EMPTY_SLOT = "_None._"
EXPECTED_OUTPUT_LABEL = "**Expected output:**"
ILLUSTRATIVE_TAG = "illustrative"
UNVERIFIED_PREFIX = "> ⚠️ Unverified:"
SNIPPET_MARKER_RE = re.compile(r"^<!-- snippet (?P<attrs>.+?) -->$")
ATTR_RE = re.compile(r'([a-z_]+)="([^"]*)"')
SNIPPET_STATUSES = ("verified", "unverified", "skipped")

# --- output: files ---------------------------------------------------------

DECK_TEMPLATE_ID = "slide-design/deck@2"
DECK_TEMPLATE_IDS = ("slide-design/deck@1", "slide-design/deck@2")  # every deck template a reader accepts
VOCABULARY_TEMPLATE_ID = "slide-design/vocabulary@1"
SLIDES_DIR = "slides"
VOCABULARY_FILE = "visual-vocabulary.md"
WORK_DIR = "_work"  # the work dir of a Part is slides/_work/part-NN

DECK_FRONTMATTER_KEYS = (
    "template",
    "course",
    "part",
    "title",
    "source_file",
    "source_generated",
    "source_sha256",
    "language",
    "vocabulary",
    "vocabulary_version",
    "slide_count",
    "code_status",
    "generated",
)
VOCABULARY_FRONTMATTER_KEYS = ("template", "course", "version", "updated")

NOTES_HEADING, DIAGRAMS_HEADING, LISTINGS_HEADING = "Deck notes", "Diagrams", "Code listings"
UNITS_HEADING = "Units"  # deck@2: the unit map, as one ```units JSON block
OPENING, CLOSING = "Opening", "Closing"

# --- output: unit map ------------------------------------------------------

# _work/part-NN/units.json splits each sub-topic into chapters of small units.
UNITS_FILE = "units.json"
UNIT_ID_RE = re.compile(r"^u-[a-z0-9]+(?:-[a-z0-9]+)*$")
CHAPTER_ID_RE = re.compile(r"^(?P<section>\d+\.\d+)(?P<letter>[a-z]?)$")  # 1.2, or 1.2a, 1.2b, ... when split
UNIT_TITLE_LIMIT, UNIT_GOAL_LIMIT, CHAPTER_UNITS_MAX = 40, 120, 6
PART_ASSEMBLY = "part"  # the `assembles` value of the closing's assembly of the whole Part
CHAPTER_KEYS = ("id", "section", "title", "units")
UNIT_KEYS = ("id", "title", "goal", "needs", "moved_from", "reason")

# --- output: slides --------------------------------------------------------

SLIDE_ID_RE = re.compile(r"^(?P<part>\d+)-(?P<n>\d{3})$")
DRAFT_ID_RE = re.compile(r"^(?P<part>\d+)-(?P<n>\d{3})(?P<split>[a-z]?)$")
SLIDE_HEADING_RE = re.compile(r"^### (?P<id>\S+) · (?P<layout>[a-z]+)\s*$")
FIELD_RE = re.compile(r"^\*\*(?P<name>[A-Z][a-z]+):\*\*\s?(?P<rest>.*)$")
FIELDS = ("Title", "Body", "Items", "Left", "Right", "Takeaway", "Question", "Answer", "Why", "Symptom", "Cause", "Fix", "Task", "Solution", "Notice")

# visual: required | optional | none.  content: none | code | output | error | setup | panels | assembly.
Layout = namedtuple("Layout", "required optional visual content")
LAYOUTS = {
    "cover": Layout(("Title",), ("Body",), "optional", "none"),
    "focus": Layout(("Title", "Body"), (), "required", "none"),
    "explain": Layout(("Title", "Body"), (), "required", "none"),
    "steps": Layout(("Title", "Items"), (), "required", "none"),
    "compare": Layout(("Title", "Left", "Right", "Takeaway"), (), "none", "panels"),
    "code": Layout(("Title", "Body"), ("Notice",), "none", "code"),
    "output": Layout(("Title", "Body"), ("Notice",), "none", "output"),
    "error": Layout(("Title", "Cause", "Fix"), ("Symptom",), "none", "error"),
    "objectives": Layout(("Title", "Items"), (), "optional", "none"),
    "setup": Layout(("Title", "Items"), (), "optional", "setup"),
    "terms": Layout(("Title", "Items"), (), "optional", "none"),
    "question": Layout(("Question", "Body"), ("Items",), "optional", "none"),
    "answer": Layout(("Answer", "Why"), (), "optional", "none"),
    "practice": Layout(("Title", "Task"), ("Items", "Solution"), "optional", "none"),
    "summary": Layout(("Title", "Items"), (), "optional", "none"),
    "sources": Layout(("Title", "Items"), (), "none", "none"),
    # deck@2: the unit map, a unit's divider, and the assembly of a chapter or of the whole Part
    "map": Layout(("Title",), ("Body",), "none", "none"),
    "topic": Layout(("Title", "Body"), (), "optional", "none"),
    "assemble": Layout(("Title", "Body"), ("Notice",), "optional", "assembly"),
}
UNIT_LAYOUTS = ("map", "topic", "assemble")  # the layouts a deck@1 deck cannot hold
META_KEYS = ("layout", "purpose", "from", "sources")
LAYOUT_META_KEYS = {
    "code": ("snippet", "lines", "highlight"),
    "output": ("snippet",),
    "answer": ("revisit",),
    "topic": ("unit",),
    "assemble": ("assembles", "labels", "snippet", "lines"),
}
ITEM_COUNTS = {"steps": (2, 6), "terms": (1, 5)}

# --- output: visuals -------------------------------------------------------

VISUAL_KINDS = ("diagram", "illustration", "screenshot")
FALLBACK_KINDS = ("diagram", "text")
SHAPES = ("box", "rounded-box", "circle", "cylinder", "document", "person", "cloud")
DEFAULT_ROLES = {
    "primary": "#1A73E8",
    "secondary": "#7B61FF",
    "accent": "#F29900",
    "success": "#188038",
    "warning": "#F9AB00",
    "danger": "#D93025",
    "neutral": "#5F6368",
}
EDGE_STYLES = ("solid", "dashed")
CANVAS_MAX = (24, 14)
ELEMENT_ID_RE = re.compile(r"^[a-z][a-z0-9-]*$")
DIAGRAM_ID_RE = re.compile(r"^d-[a-z0-9]+(?:-[a-z0-9]+)*$")

# --- output: text length limits (visible characters) -----------------------

TITLE_LIMIT, PURPOSE_LIMIT, NOTICE_LIMIT, LABEL_LIMIT, NOTE_LIMIT = 70, 120, 150, 24, 60
FIELD_LIMITS = {  # (layout, field) -> limit; for Items the limit applies to each item
    ("cover", "Body"): 120,
    ("focus", "Body"): 160,
    ("explain", "Body"): 420,
    ("steps", "Items"): 80,
    ("compare", "Left"): 200,
    ("compare", "Right"): 200,
    ("compare", "Takeaway"): 120,
    ("code", "Body"): 300,
    ("output", "Body"): 200,
    ("error", "Symptom"): 150,
    ("error", "Cause"): 150,
    ("error", "Fix"): 150,
    ("objectives", "Items"): 120,
    ("setup", "Items"): 120,
    ("terms", "Items"): 100,
    ("question", "Question"): 200,
    ("question", "Body"): 80,
    ("question", "Items"): 80,
    ("answer", "Answer"): 150,
    ("answer", "Why"): 300,
    ("practice", "Task"): 300,
    ("practice", "Items"): 120,
    ("practice", "Solution"): 300,
    ("summary", "Items"): 100,
    ("sources", "Items"): 200,
    ("map", "Body"): 120,
    ("topic", "Body"): 120,  # the Body is the unit's goal, itself at most UNIT_GOAL_LIMIT
    ("assemble", "Body"): 300,
}

# --- run state -------------------------------------------------------------

STAGES = ("storyboard", "storyboard-approved", "writing", "checking", "reviewing", "done")
SECTION_STATUSES = ("pending", "written", "checked")
