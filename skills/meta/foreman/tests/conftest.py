import sys
import time
from pathlib import Path

import pytest

SKILL_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL_DIR / "scripts"))
# The foreman starts workers with opencode-delegate's script, so one test runs the two together.
sys.path.insert(0, str(SKILL_DIR.parent / "opencode-delegate" / "scripts"))


def wait_until(predicate, seconds: float = 15) -> None:
    """Poll until `predicate()` is true; fail the test if it is not true within `seconds`."""
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.05)
    pytest.fail(f"condition not met within {seconds} s")
