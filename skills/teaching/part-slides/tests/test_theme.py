"""Rules of the template's stylesheet that vitest cannot see: it loads every CSS file as an empty string."""

import re

from conftest import TEMPLATE


def rule(selector: str) -> str:
    css = (TEMPLATE / "src" / "theme" / "base.css").read_text(encoding="utf-8")
    found = re.search(rf"^{re.escape(selector)} \{{([^}}]*)\}}", css, re.M)
    assert found, f"no {selector} rule in base.css"
    return found.group(1)


def test_an_anatomy_piece_wider_than_the_strip_wraps_inside_its_own_box():
    piece = rule(".rs-piece")
    assert "white-space: pre-wrap;" in piece
    assert "overflow-wrap: anywhere;" in piece
    assert "min-width: 0;" in piece
    assert "white-space: pre;" not in piece
