import sys
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parents[1]
for sub in ("scripts", "scripts/code_check"):
    path = str(SKILL_DIR / sub)
    if path not in sys.path:
        sys.path.insert(0, path)


@pytest.fixture
def skill_dir() -> Path:
    return SKILL_DIR
