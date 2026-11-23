"""Find and redact secrets in issue text before it leaves the machine.

Known token shapes, `name = value` assignments, the exact values of the reporter's own secret
environment variables, and the home path (which becomes `~`).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Mapping

sys.path.insert(0, str(Path(__file__).resolve().parent))

SECRET_NAME_WORDS = ("KEY", "TOKEN", "SECRET", "PASSWORD", "CREDENTIAL")
MIN_SECRET_LENGTH = 8

_START = r"(?<![A-Za-z0-9])"
_SECRET_NAME = r"(?:api[_-]?key|access[_-]?key|private[_-]?key|secret|token|password|passwd|credential)"

# Whole-match kinds: the match is replaced. Order matters: anthropic-key before openai-key.
TOKEN_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("anthropic-key", re.compile(_START + r"sk-ant-[A-Za-z0-9_-]{20,}")),
    ("openai-key", re.compile(_START + r"sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}")),
    ("github-token", re.compile(_START + r"(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})")),
    ("aws-access-key-id", re.compile(_START + r"(?:AKIA|ASIA)[0-9A-Z]{16}(?![0-9A-Z])")),
    ("google-api-key", re.compile(_START + r"AIza[0-9A-Za-z_-]{35}")),
    ("slack-token", re.compile(_START + r"xox[abprs]-[A-Za-z0-9-]{10,}")),
    ("private-key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----", re.S)),
    ("jwt", re.compile(r"(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}")),
)

# Value kinds: group 1 (the name) is kept and only group 2 (the value) is replaced.
VALUE_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("bearer-token", re.compile(r"(?i)(\bbearer\s+)([A-Za-z0-9._~+/-]{16,}=*)")),
    ("assignment", re.compile(r"(?i)(\b[A-Za-z0-9_-]*?" + _SECRET_NAME + r"[A-Za-z0-9_-]*[\"']?\s*[:=]\s*[\"']?)"
                              r"(?!\[REDACTED:)([^\s\"',;]{8,})")),
)


def _secret_values(environ: Mapping[str, str]) -> list[tuple[str, str]]:
    """The reporter's own secret values, longest first, so a value inside another is not cut in half."""
    found = [(name, value) for name, value in environ.items()
             if any(word in name.upper() for word in SECRET_NAME_WORDS) and len(value) >= MIN_SECRET_LENGTH]
    return sorted(found, key=lambda item: -len(item[1]))


def scan(text: str, environ: Mapping[str, str]) -> list[str]:
    """The kinds of secret still in the text, each once, in order of first appearance."""
    first: dict[str, int] = {}
    for kind, pattern in (*TOKEN_PATTERNS, *VALUE_PATTERNS):
        match = pattern.search(text)
        if match:
            first.setdefault(kind, match.start())
    for name, value in _secret_values(environ):
        index = text.find(value)
        if index >= 0:
            first.setdefault(f"env:{name}", index)
    return sorted(first, key=first.__getitem__)


def scrub(text: str, environ: Mapping[str, str]) -> tuple[str, list[str]]:
    """Replace each secret with `[REDACTED:<kind>]` and the home path with `~`. Returns the text and the kinds."""
    kinds: list[str] = []
    for kind, pattern in TOKEN_PATTERNS:
        text, count = pattern.subn(lambda _m, kind=kind: f"[REDACTED:{kind}]", text)
        if count:
            kinds.append(kind)
    for kind, pattern in VALUE_PATTERNS:
        text, count = pattern.subn(lambda m, kind=kind: f"{m.group(1)}[REDACTED:{kind}]", text)
        if count:
            kinds.append(kind)
    for name, value in _secret_values(environ):
        if value in text:
            text = text.replace(value, f"[REDACTED:env:{name}]")
            kinds.append(f"env:{name}")
    home = environ.get("HOME", "").rstrip("/")
    if home:
        text = re.sub(re.escape(home) + r"(?![\w-])", "~", text)
    return text, kinds
