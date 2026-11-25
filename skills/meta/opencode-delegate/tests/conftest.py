import os
import stat
import sys
import textwrap
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))


@pytest.fixture
def fake_opencode(tmp_path):
    """Write a stand-in for the `opencode` binary: a Python script whose body the test supplies."""

    def make(body: str) -> Path:
        path = tmp_path / "fake-opencode"
        path.write_text(f"#!{sys.executable}\nimport os, subprocess, sys, time\n" + textwrap.dedent(body), encoding="utf-8")
        path.chmod(path.stat().st_mode | stat.S_IXUSR)
        return path

    return make


@pytest.fixture
def project(tmp_path):
    folder = tmp_path / "project"
    folder.mkdir()
    return folder


def alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    return True


def wait_until(predicate, seconds: float = 15) -> None:
    """Poll until `predicate()` is true; fail the test if it is not true within `seconds`."""
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.05)
    pytest.fail(f"condition not met within {seconds} s")
