#!/usr/bin/env python3
"""Shared repository-local instruction discovery and runtime resolution."""

from __future__ import annotations

import argparse
import fnmatch
import json
import re
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Iterable
from urllib.parse import unquote, urlparse


RUNTIMES = ("codex", "claude", "copilot", "opencode")
IGNORED_DIRS = {
    ".git",
    ".next",
    ".turbo",
    ".venv",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "venv",
}
EXACT_NAMES = {
    "AGENTS.md",
    "AGENTS.override.md",
    "CLAUDE.md",
    "CLAUDE.local.md",
    "GEMINI.md",
}
SUPPORTING_DIRS = (
    ".agents/rules/",
    ".agents/workflows/",
    ".agents/references/",
    ".agents/templates/",
    ".agents/agents/",
    ".agents/commands/",
)
LOAD_MODE_ORDER = {
    "startup": 0,
    "import": 1,
    "conditional": 2,
    "shadowed": 3,
    "unresolved": 4,
    "inventory-only": 5,
}
MARKDOWN_LINK = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
AT_REFERENCE = re.compile(r"(?<![\w@])@([^\s`]+)")
FENCED_CODE = re.compile(r"(^|\n)(```|~~~).*?\n\2", re.DOTALL)
INLINE_CODE = re.compile(r"`[^`\n]*`")
REMOTE_SCHEMES = {"http", "https"}


@dataclass
class Artifact:
    path: str
    kind: str
    bytes: int
    lines: int
    load_modes: set[str] = field(default_factory=set)
    sources: set[str] = field(default_factory=set)

    def payload(self) -> dict[str, object]:
        modes = self.load_modes or {"inventory-only"}
        return {
            "path": self.path,
            "kind": self.kind,
            "bytes": self.bytes,
            "lines": self.lines,
            "load_modes": sorted(modes, key=LOAD_MODE_ORDER.get),
            "sources": sorted(self.sources),
        }


def diagnostic(
    code: str,
    severity: str,
    message: str,
    *,
    path: str | None = None,
    line: int | None = None,
    reference: str | None = None,
) -> dict[str, object]:
    item: dict[str, object] = {
        "code": code,
        "severity": severity,
        "message": message,
        "path": path,
    }
    if line is not None:
        item["line"] = line
    if reference is not None:
        item["reference"] = reference
    return item


def _relative(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def _inside(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root)
        return True
    except (OSError, ValueError):
        return False


def _resolve_inside(raw: str | Path, root: Path, base: Path) -> Path:
    candidate = Path(raw).expanduser()
    if not candidate.is_absolute():
        candidate = base / candidate
    resolved = candidate.resolve()
    if not _inside(resolved, root):
        raise ValueError(f"Path is outside repository root: {raw}")
    return resolved


def _mask_code(text: str) -> str:
    def blank(match: re.Match[str]) -> str:
        return "".join("\n" if char == "\n" else " " for char in match.group(0))

    return INLINE_CODE.sub(blank, FENCED_CODE.sub(blank, text))


def _strip_jsonc(text: str) -> str:
    """Remove JSONC comments and trailing commas without changing string values."""
    uncommented: list[str] = []
    index = 0
    in_string = False
    escaped = False
    while index < len(text):
        char = text[index]
        following = text[index + 1] if index + 1 < len(text) else ""
        if in_string:
            uncommented.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            index += 1
            continue
        if char == '"':
            in_string = True
            uncommented.append(char)
            index += 1
            continue
        if char == "/" and following == "/":
            uncommented.extend((" ", " "))
            index += 2
            while index < len(text) and text[index] not in "\r\n":
                uncommented.append(" ")
                index += 1
            continue
        if char == "/" and following == "*":
            uncommented.extend((" ", " "))
            index += 2
            while index < len(text):
                if text[index : index + 2] == "*/":
                    uncommented.extend((" ", " "))
                    index += 2
                    break
                uncommented.append("\n" if text[index] == "\n" else " ")
                index += 1
            continue
        uncommented.append(char)
        index += 1

    cleaned = "".join(uncommented)
    without_trailing: list[str] = []
    index = 0
    in_string = False
    escaped = False
    while index < len(cleaned):
        char = cleaned[index]
        if in_string:
            without_trailing.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            index += 1
            continue
        if char == '"':
            in_string = True
            without_trailing.append(char)
            index += 1
            continue
        if char == ",":
            lookahead = index + 1
            while lookahead < len(cleaned) and cleaned[lookahead].isspace():
                lookahead += 1
            if lookahead < len(cleaned) and cleaned[lookahead] in "}]":
                without_trailing.append(" ")
                index += 1
                continue
        without_trailing.append(char)
        index += 1
    return "".join(without_trailing)


def _frontmatter_values(text: str, key: str) -> list[str] | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---", 4)
    if end < 0:
        return None
    lines = text[4:end].splitlines()
    for index, line in enumerate(lines):
        match = re.match(rf"^{re.escape(key)}\s*:\s*(.*)$", line)
        if not match:
            continue
        value = match.group(1).strip()
        if value:
            value = value.strip("[]").strip()
            return [part.strip().strip("'\"") for part in value.split(",") if part.strip()]
        values: list[str] = []
        for nested in lines[index + 1 :]:
            nested_match = re.match(r"^\s*-\s*(.+?)\s*$", nested)
            if not nested_match:
                break
            values.append(nested_match.group(1).strip("'\""))
        return values
    return None


def _matches(pattern: str, target: str) -> bool:
    normalized = target.lstrip("./")
    return fnmatch.fnmatch(normalized, pattern) or PurePosixPath(normalized).match(pattern)


def _nonempty(path: Path) -> bool:
    return path.is_file() and path.stat().st_size > 0


def _directories(root: Path, destination: Path) -> list[Path]:
    current = destination if destination.is_dir() else destination.parent
    current = current.resolve()
    if not _inside(current, root):
        raise ValueError(f"Path is outside repository root: {destination}")
    relative = current.relative_to(root)
    directories = [root]
    cursor = root
    for part in relative.parts:
        cursor = cursor / part
        directories.append(cursor)
    return directories


def _classify(path: Path, root: Path) -> str:
    relative = _relative(path, root)
    if path.name in {"AGENTS.md", "AGENTS.override.md"}:
        return "agents-md"
    if path.name in {"CLAUDE.md", "CLAUDE.local.md", "GEMINI.md"}:
        return "runtime-adapter"
    if relative.endswith(".github/copilot-instructions.md"):
        return "copilot-repository-instructions"
    if "/.github/instructions/" in f"/{relative}":
        return "copilot-path-instructions"
    if relative.startswith(".claude/rules/"):
        return "claude-rule"
    if relative.startswith(".cursor/rules/"):
        return "runtime-rule-candidate"
    if relative.startswith(SUPPORTING_DIRS):
        return "supporting-instruction"
    if path.name in {"opencode.json", "opencode.jsonc"}:
        return "runtime-config"
    return "instruction-candidate"


def discover(root: Path) -> dict[str, Artifact]:
    artifacts: dict[str, Artifact] = {}
    for path in root.rglob("*"):
        try:
            relative_path = path.relative_to(root)
        except ValueError:
            continue
        if any(part in IGNORED_DIRS for part in relative_path.parts):
            continue
        relative = relative_path.as_posix()
        if any(
            relative_path.parts[index : index + 2] == ("evals", "fixtures")
            for index in range(len(relative_path.parts) - 1)
        ):
            continue
        if path.is_dir():
            continue
        if not _inside(path, root):
            continue
        included = (
            path.name in EXACT_NAMES
            or path.name in {"opencode.json", "opencode.jsonc"}
            or relative.endswith(".github/copilot-instructions.md")
            or (
                "/.github/instructions/" in f"/{relative}"
                and path.name.endswith(".instructions.md")
            )
            or (
                relative.startswith(SUPPORTING_DIRS)
                and path.suffix.lower() in {".md", ".yaml", ".yml"}
            )
            or (
                relative.startswith(".claude/rules/")
                and path.suffix.lower() == ".md"
            )
            or (
                relative.startswith(".cursor/rules/")
                and path.suffix.lower() in {".md", ".mdc"}
            )
        )
        if not included:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        artifacts[relative] = Artifact(
            path=relative,
            kind=_classify(path, root),
            bytes=path.stat().st_size,
            lines=text.count("\n") + (1 if text else 0),
        )
    return artifacts


class RuntimeResolver:
    def __init__(
        self,
        root: Path,
        runtime: str,
        cwd: Path,
        targets: tuple[Path, ...],
        fallback_names: tuple[str, ...],
        max_bytes: int | None,
        root_warning_lines: int,
        command: str,
    ) -> None:
        self.root = root
        self.runtime = runtime
        self.cwd = cwd
        self.targets = targets
        self.fallback_names = fallback_names
        self.max_bytes = max_bytes
        self.root_warning_lines = root_warning_lines
        self.command = command
        self.artifacts = discover(root)
        self.edges: list[dict[str, object]] = []
        self.diagnostics: list[dict[str, object]] = []
        self.assumptions: list[str] = [
            "Only repository-local files were inspected; user and global runtime state is unresolved."
        ]

    def path(self, relative: str) -> Path:
        return self.root / relative

    def is_local_file(self, path: Path) -> bool:
        return _nonempty(path) and _inside(path, self.root)

    def ensure_artifact(self, path: Path, kind: str = "imported-reference") -> Artifact:
        relative = _relative(path, self.root)
        if relative not in self.artifacts:
            text = path.read_text(encoding="utf-8", errors="replace")
            self.artifacts[relative] = Artifact(
                path=relative,
                kind=kind,
                bytes=path.stat().st_size,
                lines=text.count("\n") + (1 if text else 0),
            )
        return self.artifacts[relative]

    def load(self, path: Path, mode: str, reason: str, source: Path | None = None) -> None:
        artifact = self.ensure_artifact(path)
        artifact.load_modes.discard("shadowed")
        artifact.load_modes.add(mode)
        artifact.sources.add(reason)
        edge = {
            "from": _relative(source, self.root) if source else None,
            "to": artifact.path,
            "mode": mode,
            "reason": reason,
        }
        if edge not in self.edges:
            self.edges.append(edge)

    def add_diagnostic(self, item: dict[str, object]) -> None:
        key = (item.get("code"), item.get("path"), item.get("line"), item.get("reference"))
        existing = {
            (entry.get("code"), entry.get("path"), entry.get("line"), entry.get("reference"))
            for entry in self.diagnostics
        }
        if key not in existing:
            self.diagnostics.append(item)

    def resolve(self) -> dict[str, object]:
        getattr(self, f"resolve_{self.runtime}")()
        if self.command == "validate":
            self.validate_markdown_links()
        self.detect_exact_duplicates()
        return self.payload()

    def resolve_codex(self) -> None:
        for directory in _directories(self.root, self.cwd):
            candidates = [
                directory / "AGENTS.override.md",
                directory / "AGENTS.md",
                *(directory / name for name in self.fallback_names),
            ]
            selected = next((path for path in candidates if self.is_local_file(path)), None)
            if selected:
                self.load(selected, "startup", "codex-root-to-cwd")
                for candidate in candidates:
                    if candidate != selected and self.is_local_file(candidate):
                        artifact = self.ensure_artifact(candidate)
                        artifact.load_modes.add("shadowed")
                        artifact.sources.add(f"shadowed-by:{_relative(selected, self.root)}")
        if self.targets:
            self.assumptions.append(
                "Codex startup discovery is based on cwd; target paths do not activate descendant AGENTS.md files."
            )

    def _native_claude_files(self, directory: Path) -> list[Path]:
        return [
            directory / "CLAUDE.md",
            directory / ".claude" / "CLAUDE.md",
            directory / "CLAUDE.local.md",
        ]

    def resolve_claude(self) -> None:
        active: list[Path] = []
        for directory in _directories(self.root, self.cwd):
            for path in self._native_claude_files(directory):
                if self.is_local_file(path):
                    self.load(path, "startup", "claude-memory-chain")
                    active.append(path)

        for target in self.targets:
            for directory in _directories(self.root, target):
                for path in self._native_claude_files(directory):
                    if self.is_local_file(path) and path not in active:
                        self.load(path, "conditional", f"claude-target:{_relative(target, self.root)}")
                        active.append(path)

        rules_root = self.root / ".claude" / "rules"
        if rules_root.is_dir():
            for path in sorted(rules_root.rglob("*.md")):
                if not self.is_local_file(path):
                    continue
                text = path.read_text(encoding="utf-8", errors="replace")
                patterns = _frontmatter_values(text, "paths")
                if patterns is None:
                    self.load(path, "startup", "claude-unscoped-rule")
                    active.append(path)
                elif any(
                    _matches(pattern, _relative(target, self.root))
                    for pattern in patterns
                    for target in self.targets
                ):
                    self.load(path, "conditional", "claude-path-rule")
                    active.append(path)

        for path in list(dict.fromkeys(active)):
            self.resolve_imports(path, runtime="claude", max_depth=4)

    def resolve_copilot(self) -> None:
        active: list[Path] = []
        cwd_directories = _directories(self.root, self.cwd)
        directories = list(cwd_directories)
        for target in self.targets:
            directories.extend(_directories(self.root, target))
        for directory in dict.fromkeys(directories):
            for path in (
                directory / "AGENTS.md",
                directory / "CLAUDE.md",
                directory / ".claude" / "CLAUDE.md",
                directory / "GEMINI.md",
                directory / ".github" / "copilot-instructions.md",
            ):
                if self.is_local_file(path):
                    mode = "startup" if directory in cwd_directories else "conditional"
                    self.load(path, mode, "copilot-standard-location")
                    active.append(path)

        modular_directories = [self.root, self.cwd if self.cwd.is_dir() else self.cwd.parent]
        cwd_directory = self.cwd if self.cwd.is_dir() else self.cwd.parent
        for target in self.targets:
            target_directory = target if target.is_dir() else target.parent
            if _inside(target_directory, cwd_directory):
                modular_directories.extend(_directories(cwd_directory, target_directory))
        for directory in dict.fromkeys(modular_directories):
            instructions = directory / ".github" / "instructions"
            if not instructions.is_dir() or not _inside(instructions, self.root):
                continue
            for path in sorted(instructions.rglob("*.instructions.md")):
                if not self.is_local_file(path):
                    continue
                text = path.read_text(encoding="utf-8", errors="replace")
                patterns = _frontmatter_values(text, "applyTo")
                if not patterns:
                    self.add_diagnostic(
                        diagnostic(
                            "invalid-frontmatter",
                            "error",
                            "Copilot path instruction requires a non-empty applyTo field.",
                            path=_relative(path, self.root),
                        )
                    )
                    continue
                if any(
                    _matches(pattern, _relative(target, self.root))
                    for pattern in patterns
                    for target in self.targets
                ):
                    self.load(path, "conditional", "copilot-applyTo")

        for path in list(dict.fromkeys(active)):
            if path.name in {"AGENTS.md", "CLAUDE.md", "copilot-instructions.md"}:
                self.resolve_imports(path, runtime="copilot", max_depth=20)
        self.assumptions.append(
            "Copilot CLI combines applicable instructions; no universal precedence was assumed. "
            "User instructions, custom instruction directories, and active-session disablement were not read."
        )

    def resolve_opencode(self) -> None:
        directories = list(reversed(_directories(self.root, self.cwd)))
        for directory in directories:
            agents = directory / "AGENTS.md"
            claude = directory / "CLAUDE.md"
            selected = (
                agents
                if self.is_local_file(agents)
                else claude
                if self.is_local_file(claude)
                else None
            )
            if selected:
                self.load(selected, "startup", "opencode-nearest-project-rule")
                break

        config: Path | None = None
        for directory in directories:
            json_path = directory / "opencode.json"
            jsonc_path = directory / "opencode.jsonc"
            json_exists = json_path.is_file() and _inside(json_path, self.root)
            jsonc_exists = jsonc_path.is_file() and _inside(jsonc_path, self.root)
            if json_exists and jsonc_exists:
                self.add_diagnostic(
                    diagnostic(
                        "invalid-config",
                        "error",
                        "Both opencode.json and opencode.jsonc exist in the same scope.",
                        path=_relative(directory, self.root) or ".",
                    )
                )
                return
            if json_exists or jsonc_exists:
                config = json_path if json_exists else jsonc_path
                break
        if config:
            self.resolve_opencode_config(config)
        self.assumptions.append(
            "The nearest repository-local project config was modeled. Remote, global, custom, inline, "
            "managed, environment, and home configuration layers were not read."
        )

    def resolve_opencode_config(self, config: Path) -> None:
        raw = config.read_text(encoding="utf-8", errors="replace")
        if config.suffix == ".jsonc":
            raw = _strip_jsonc(raw)
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as error:
            self.add_diagnostic(
                diagnostic(
                    "invalid-config",
                    "error",
                    f"Invalid OpenCode config: {error.msg}.",
                    path=_relative(config, self.root),
                    line=error.lineno,
                )
            )
            return
        entries = payload.get("instructions", []) if isinstance(payload, dict) else []
        if isinstance(entries, str):
            entries = [entries]
        if not isinstance(entries, list) or not all(isinstance(item, str) for item in entries):
            self.add_diagnostic(
                diagnostic(
                    "invalid-config",
                    "error",
                    "OpenCode instructions must be a string or a list of strings.",
                    path=_relative(config, self.root),
                )
            )
            return
        for entry in entries:
            parsed = urlparse(entry)
            if parsed.scheme in REMOTE_SCHEMES:
                self.add_diagnostic(
                    diagnostic(
                        "remote-unresolved",
                        "warning",
                        "Remote OpenCode instruction was not fetched.",
                        path=_relative(config, self.root),
                        reference=entry,
                    )
                )
                continue
            if Path(entry).is_absolute() or entry.startswith("~"):
                self.add_diagnostic(
                    diagnostic(
                        "outside-root",
                        "error",
                        "OpenCode instruction path leaves the repository root.",
                        path=_relative(config, self.root),
                        reference=entry,
                    )
                )
                continue
            matches = sorted(config.parent.glob(entry))
            files = [path.resolve() for path in matches if path.is_file() and _inside(path, self.root)]
            if not files:
                self.add_diagnostic(
                    diagnostic(
                        "unmatched-glob",
                        "warning",
                        "OpenCode instruction path matched no local files.",
                        path=_relative(config, self.root),
                        reference=entry,
                    )
                )
                continue
            for path in files:
                self.load(path, "import", "opencode-config", config)

    def resolve_imports(
        self,
        start: Path,
        *,
        runtime: str,
        max_depth: int,
        stack: tuple[Path, ...] = (),
        depth: int = 0,
    ) -> None:
        if start in stack:
            chain = " -> ".join(_relative(path, self.root) for path in (*stack, start))
            self.add_diagnostic(
                diagnostic(
                    "import-cycle",
                    "error",
                    f"Instruction import cycle: {chain}.",
                    path=_relative(start, self.root),
                )
            )
            return
        text = start.read_text(encoding="utf-8", errors="replace")
        masked = _mask_code(text)
        for match in AT_REFERENCE.finditer(masked):
            raw = match.group(1).rstrip(".,;:)]}")
            parsed = urlparse(raw)
            line = text.count("\n", 0, match.start()) + 1
            if parsed.scheme in REMOTE_SCHEMES or raw.startswith("~") or Path(raw).is_absolute():
                self.add_diagnostic(
                    diagnostic(
                        "outside-root",
                        "error",
                        "Instruction import is outside the repository root.",
                        path=_relative(start, self.root),
                        line=line,
                        reference=raw,
                    )
                )
                continue
            candidate = (start.parent / unquote(raw)).resolve()
            if not _inside(candidate, self.root):
                self.add_diagnostic(
                    diagnostic(
                        "outside-root",
                        "error",
                        "Instruction import leaves the repository root.",
                        path=_relative(start, self.root),
                        line=line,
                        reference=raw,
                    )
                )
                continue
            if not candidate.is_file():
                self.add_diagnostic(
                    diagnostic(
                        "broken-reference",
                        "error",
                        "Instruction import target does not exist.",
                        path=_relative(start, self.root),
                        line=line,
                        reference=raw,
                    )
                )
                continue
            if depth >= max_depth:
                self.add_diagnostic(
                    diagnostic(
                        "import-depth-exceeded",
                        "error",
                        f"{runtime} import depth exceeds {max_depth} hops.",
                        path=_relative(start, self.root),
                        line=line,
                        reference=raw,
                    )
                )
                continue
            self.load(candidate, "import", f"{runtime}-import", start)
            self.resolve_imports(
                candidate,
                runtime=runtime,
                max_depth=max_depth,
                stack=(*stack, start),
                depth=depth + 1,
            )

    def validate_markdown_links(self) -> None:
        for artifact in list(self.artifacts.values()):
            path = self.path(artifact.path)
            if path.suffix.lower() not in {".md", ".mdc"} or not path.is_file():
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
            masked = _mask_code(text)
            for match in MARKDOWN_LINK.finditer(masked):
                raw = match.group(1).strip().split()[0].strip("<>")
                parsed = urlparse(raw)
                if parsed.scheme or parsed.netloc or raw.startswith("#"):
                    continue
                target = unquote(raw.split("#", 1)[0])
                if not target:
                    continue
                resolved = (path.parent / target).resolve()
                line = text.count("\n", 0, match.start()) + 1
                if not _inside(resolved, self.root):
                    self.add_diagnostic(
                        diagnostic(
                            "outside-root",
                            "error",
                            "Markdown reference leaves the repository root.",
                            path=artifact.path,
                            line=line,
                            reference=raw,
                        )
                    )
                elif not resolved.exists():
                    self.add_diagnostic(
                        diagnostic(
                            "broken-reference",
                            "error",
                            "Markdown reference target does not exist.",
                            path=artifact.path,
                            line=line,
                            reference=raw,
                        )
                    )

    def detect_exact_duplicates(self) -> None:
        paragraphs: dict[str, tuple[str, int]] = {}
        for artifact in sorted(self.artifacts.values(), key=lambda item: item.path):
            if not artifact.load_modes.intersection({"startup", "import", "conditional"}):
                continue
            path = self.path(artifact.path)
            if path.suffix.lower() not in {".md", ".mdc"}:
                continue
            text = path.read_text(encoding="utf-8", errors="replace")
            for paragraph in re.split(r"\n\s*\n", _mask_code(text)):
                normalized = " ".join(paragraph.split())
                if len(normalized) < 80:
                    continue
                line = text.find(paragraph)
                line_number = text.count("\n", 0, max(line, 0)) + 1
                if normalized in paragraphs:
                    first_path, _ = paragraphs[normalized]
                    self.add_diagnostic(
                        diagnostic(
                            "duplicate-content",
                            "warning",
                            f"Exact loaded paragraph also appears in {first_path}.",
                            path=artifact.path,
                            line=line_number,
                        )
                    )
                else:
                    paragraphs[normalized] = (artifact.path, line_number)

    def payload(self) -> dict[str, object]:
        artifacts = [artifact.payload() for artifact in sorted(self.artifacts.values(), key=lambda item: item.path)]
        loaded = [
            artifact
            for artifact in self.artifacts.values()
            if artifact.load_modes.intersection({"startup", "import", "conditional"})
        ]
        conditional = [artifact for artifact in self.artifacts.values() if "conditional" in artifact.load_modes]
        max_bytes = self.max_bytes if self.max_bytes is not None else 32768 if self.runtime == "codex" else None
        loaded_bytes = sum(artifact.bytes for artifact in loaded)
        canonical = self.artifacts.get("AGENTS.md")
        root_lines = canonical.lines if canonical else 0
        budget = {
            "max_bytes": max_bytes,
            "over": max_bytes is not None and loaded_bytes > max_bytes,
            "root_lines": root_lines,
            "root_warning_lines": self.root_warning_lines,
            "root_warning": root_lines > self.root_warning_lines,
        }
        if budget["over"]:
            self.add_diagnostic(
                diagnostic(
                    "budget-exceeded",
                    "error",
                    f"Resolved context is {loaded_bytes} bytes; budget is {max_bytes} bytes.",
                )
            )
        if budget["root_warning"]:
            self.add_diagnostic(
                diagnostic(
                    "root-line-warning",
                    "warning",
                    f"Root AGENTS.md has {root_lines} lines; heuristic warning is {self.root_warning_lines}.",
                    path="AGENTS.md",
                )
            )
        self.diagnostics.sort(
            key=lambda item: (
                str(item.get("path") or ""),
                int(item.get("line") or 0),
                str(item.get("code") or ""),
            )
        )
        unresolved_count = sum(
            1 for item in self.diagnostics if item["code"] in {"remote-unresolved", "dynamic-load-unresolved"}
        )
        return {
            "artifacts": artifacts,
            "load_edges": sorted(
                self.edges,
                key=lambda item: (str(item["to"]), str(item["mode"]), str(item["from"])),
            ),
            "totals": {
                "inventory_bytes": sum(artifact.bytes for artifact in self.artifacts.values()),
                "loaded_bytes": loaded_bytes,
                "conditional_bytes": sum(artifact.bytes for artifact in conditional),
                "unresolved_count": unresolved_count,
            },
            "budget": budget,
            "diagnostics": self.diagnostics,
            "assumptions": self.assumptions,
            "valid": not any(item["severity"] == "error" for item in self.diagnostics),
        }


def analyze_repository(
    root: str | Path = ".",
    *,
    command: str,
    runtime: str = "all",
    cwd: str | Path = ".",
    targets: Iterable[str | Path] = (),
    fallback_names: Iterable[str] = (),
    max_bytes: int | None = None,
    root_warning_lines: int = 200,
) -> dict[str, object]:
    root_path = Path(root).expanduser().resolve()
    if not root_path.is_dir():
        raise ValueError(f"Repository root is not a directory: {root}")
    cwd_path = _resolve_inside(cwd, root_path, root_path)
    target_paths = tuple(_resolve_inside(target, root_path, root_path) for target in targets)
    selected = RUNTIMES if runtime == "all" else (runtime,)
    if any(item not in RUNTIMES for item in selected):
        raise ValueError(f"Unsupported runtime: {runtime}")
    results = {
        selected_runtime: RuntimeResolver(
            root_path,
            selected_runtime,
            cwd_path,
            target_paths,
            tuple(fallback_names),
            max_bytes,
            root_warning_lines,
            command,
        ).resolve()
        for selected_runtime in selected
    }
    return {
        "schema_version": 2,
        "command": command,
        "root": str(root_path),
        "cwd": _relative(cwd_path, root_path) or ".",
        "targets": [_relative(path, root_path) for path in target_paths],
        "runtime": runtime,
        "results": results,
        "diagnostics": [],
    }


def _text_report(payload: dict[str, object]) -> str:
    lines: list[str] = []
    for runtime, result in payload["results"].items():
        lines.append(f"[{runtime}]")
        for artifact in result["artifacts"]:
            modes = ",".join(artifact["load_modes"])
            lines.append(f"{artifact['path']}\t{artifact['bytes']} bytes\t{modes}")
        totals = result["totals"]
        lines.append(
            f"Loaded: {totals['loaded_bytes']} bytes; inventory: {totals['inventory_bytes']} bytes"
        )
        for item in result["diagnostics"]:
            location = item.get("path") or "repository"
            if item.get("line"):
                location = f"{location}:{item['line']}"
            lines.append(f"{item['severity'].upper()} {item['code']} {location}: {item['message']}")
        lines.append("")
    return "\n".join(lines).rstrip()


def build_parser(command: str) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=f"{command.title()} repository instruction files.")
    parser.add_argument("root", nargs="?", default=".", help="Repository root")
    parser.add_argument("--runtime", choices=(*RUNTIMES, "all"), default="all")
    parser.add_argument("--cwd", default=".", help="Working directory relative to root")
    parser.add_argument("--target", action="append", default=[], help="Target path; repeatable")
    parser.add_argument(
        "--fallback-name",
        action="append",
        default=[],
        help="Additional Codex fallback filename; repeatable",
    )
    parser.add_argument("--max-bytes", type=int, default=None, help="Optional runtime budget")
    parser.add_argument("--root-warning-lines", type=int, default=200)
    parser.add_argument("--strict", action="store_true", help="Treat warnings as failures")
    parser.add_argument("--json", action="store_true", help="Emit JSON schema v2")
    return parser


def run_cli(command: str) -> int:
    parser = build_parser(command)
    args = parser.parse_args()
    try:
        payload = analyze_repository(
            args.root,
            command=command,
            runtime=args.runtime,
            cwd=args.cwd,
            targets=args.target,
            fallback_names=args.fallback_name,
            max_bytes=args.max_bytes,
            root_warning_lines=args.root_warning_lines,
        )
    except (OSError, ValueError) as error:
        if args.json:
            print(
                json.dumps(
                    {
                        "schema_version": 2,
                        "command": command,
                        "root": str(Path(args.root).expanduser().resolve()),
                        "cwd": str(args.cwd),
                        "targets": list(args.target),
                        "runtime": args.runtime,
                        "results": {},
                        "diagnostics": [
                            diagnostic("invalid-input", "error", str(error))
                        ],
                    },
                    indent=2,
                )
            )
        else:
            print(f"ERROR invalid-input: {error}")
        return 2

    print(json.dumps(payload, indent=2) if args.json else _text_report(payload))
    diagnostics = [
        item
        for result in payload["results"].values()
        for item in result["diagnostics"]
    ]
    if any(item["severity"] == "error" for item in diagnostics):
        return 1
    if args.strict and any(item["severity"] == "warning" for item in diagnostics):
        return 1
    return 0
