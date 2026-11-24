import sys
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parents[1]
SCRIPTS = SKILL_DIR / "scripts"
TEMPLATE = SKILL_DIR / "template"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))


@pytest.fixture
def skill_dir() -> Path:
    return SKILL_DIR


@pytest.fixture
def mini_template(tmp_path) -> Path:
    """A tiny made-up template: two sources, a package file, and things scaffold must leave out."""
    root = tmp_path / "template"
    files = {
        "package.json": '{"name": "course-slides", "version": "2.0.0"}\n',
        "src/main.tsx": "export {};\n",
        "src/course.ts": "export const course = { slug: 'course', title: 'Course slides' };\n",
        "src/components/Deck.tsx": "export {};\n",
        "src/components/Deck.test.tsx": "// a test\n",
        "src/__fixtures__/MiniPart.tsx": "export {};\n",
        "node_modules/x/index.js": "x\n",
        "dist/index.html": "x\n",
        ".DS_Store": "x\n",
    }
    for rel, text in files.items():
        path = root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
    return root
