"""Single source of truth for the course-research file contract.

The Part and overview templates, scope fields, run stages and snippet
markers are defined here and nowhere else. Changing a heading or a
frontmatter key is a breaking change for the downstream skill that reads
Part files, so bump the template id when you do.
"""

import re

PART_TEMPLATE_ID = "course-research/part@1"
OVERVIEW_TEMPLATE_ID = "course-research/overview@1"
PART_FILE_RE = re.compile(r"^part-(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$")
OVERVIEW_FILE = "00-overview.md"

SCOPE_KEYS = ("course", "title", "language", "delivery_mode", "technical", "runtime", "python", "packages", "size", "outcomes")
DELIVERY_MODES = ("self-paced", "instructor-led")
SIZES = {"small": (1, 3), "medium": (4, 8), "large": (9, None)}

PART_FRONTMATTER_KEYS = ("template", "course", "part", "title", "outcomes", "prerequisite_parts", "versions", "code_status", "generated")
OVERVIEW_FRONTMATTER_KEYS = ("template", "course", "title", "research_date", "versions")
CODE_STATUSES = ("verified", "partial", "unverified", "none")

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
ALWAYS_REQUIRED_SLOTS = ("Core knowledge", "Worked example", "Sources")
SELF_PACED_REQUIRED_SLOTS = ("Common errors and fixes", "Self-check")
SELF_PACED_REQUIRED_SECTIONS = ("Prerequisites and setup",)

OVERVIEW_SECTIONS = ("Scope", "Learning outcomes", "Part map", "Prerequisite map", "Glossary", "Freshness", "Out of scope and further reading")
TECHNICAL_ONLY_OVERVIEW_SECTIONS = ("Freshness",)

STAGES = ("scope", "scope-confirmed", "broad-research", "outline-draft", "outline-approved", "deep-research", "writing", "verifying", "done")
PART_STATUSES = ("pending", "researched", "written", "checked")

CODE_LANGS = frozenset({"python", "py", "javascript", "js", "typescript", "ts"})
PYTHON_LANGS = frozenset({"python", "py"})
SNIPPET_MARKER_RE = re.compile(r"^<!-- snippet (?P<attrs>.+?) -->$")
SNIPPET_ID_RE = re.compile(r"^(?P<part>\d+)\.(?P<sub>\d+)-[a-z0-9]+$")

EMPTY_SLOT = "_None._"
EXPECTED_OUTPUT_LABEL = "**Expected output:**"
UNVERIFIED_PREFIX = "> ⚠️ Unverified:"
