#!/usr/bin/env python3
"""Discover and validate installed engineering-workflow skill dependencies.

This command is read-only. It inspects installed skill files and provenance
metadata, proposes verified install commands, and never installs, updates,
replaces, or removes a dependency.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover - Python 3.10 compatibility
    tomllib = None


MATT_SOURCE = "mattpocock/skills"
NINEARM_SOURCE = "thananon/9arm-skills"
UNKNOWN_SOURCE = "UNKNOWN / requires verification"
BASELINE_COMMITS = {
    "mattpocock-skills": "6654f6b60cd9d5be8b54c6fafe44346dabeb3b76",
    "9arm-skills": "a1fc303b274ed06c32d405ba5a6db00ded6e5663",
}
DEPENDENCIES = {
    # These are package-like dependencies. Their methods remain in the
    # upstream repositories; this registry only records ownership, routing,
    # and verified installation metadata.
    "grill-with-docs": {
        "owner": "Matt Pocock",
        "source": MATT_SOURCE,
        "provider": "mattpocock-skills",
        "role": "requirement discovery, domain clarification, decision capture, glossary/ADR preparation",
        "category": "core",
        "requirement": "normal feature discovery",
        "hard": True,
        "sideEffects": ["write-docs"],
        "upstreamSkillPath": "skills/engineering/grill-with-docs/SKILL.md",
        "upstreamInvocation": "user-invoked",
        "directDependencies": ["grilling", "domain-modeling"],
        "expectedInputs": [
            "request or plan",
            "relevant repository context",
            "existing glossary and ADRs",
        ],
        "expectedOutputs": [
            "shared decisions and open questions",
            "CONTEXT.md glossary updates",
            "ADR references when a decision is hard to reverse",
        ],
        "repositorySetup": "not declared by grill-with-docs itself; mattpocock/skills requires setup-matt-pocock-skills once per repository before the first engineering flow",
        "installerResolvesDependencies": False,
    },
    "grilling": {
        "owner": "Matt Pocock",
        "source": MATT_SOURCE,
        "provider": "mattpocock-skills",
        "role": "relentless requirement and design interview",
        "category": "transitive",
        "requirement": "required by grill-with-docs during DISCOVERY",
        "hard": True,
        "upstreamSkillPath": "skills/productivity/grilling/SKILL.md",
        "upstreamInvocation": "model-invoked",
        "expectedInputs": ["plan, design, or unresolved decision"],
        "expectedOutputs": ["settled design-tree decisions and remaining frontier"],
    },
    "domain-modeling": {
        "owner": "Matt Pocock",
        "source": MATT_SOURCE,
        "provider": "mattpocock-skills",
        "role": "domain terminology, glossary, and ADR discipline",
        "category": "transitive",
        "requirement": "required by grill-with-docs during DISCOVERY",
        "hard": True,
        "sideEffects": ["write-docs"],
        "upstreamSkillPath": "skills/engineering/domain-modeling/SKILL.md",
        "upstreamInvocation": "model-invoked",
        "expectedInputs": ["repository domain language, code, CONTEXT.md, and ADRs"],
        "expectedOutputs": ["sharpened terms, CONTEXT.md updates, and warranted ADRs"],
    },
    "to-spec": {
        "owner": "Matt Pocock",
        "source": MATT_SOURCE,
        "provider": "mattpocock-skills",
        "role": "specification synthesis",
        "category": "core",
        "requirement": "normal feature specification",
        "hard": True,
        "sideEffects": ["publish-spec"],
    },
    "scrutinize": {
        "owner": "thananon",
        "source": NINEARM_SOURCE,
        "provider": "9arm-skills",
        "role": "blocking outsider/end-to-end quality gate",
        "category": "core",
        "requirement": "design gate and high/system-risk final gate",
        "hard": True,
    },
    "to-tickets": {
        "owner": "Matt Pocock",
        "source": MATT_SOURCE,
        "provider": "mattpocock-skills",
        "role": "vertical ticket planning",
        "category": "core",
        "requirement": "normal feature and bounded large-project planning",
        "hard": True,
        "sideEffects": ["publish-tickets"],
    },
    "implement": {
        "owner": "Matt Pocock",
        "source": MATT_SOURCE,
        "provider": "mattpocock-skills",
        "role": "implementation execution",
        "category": "core",
        "requirement": "feature/bug implementation",
        "hard": True,
        "sideEffects": ["commit"],
    },
    "code-review": {
        "owner": "Matt Pocock",
        "source": MATT_SOURCE,
        "provider": "mattpocock-skills",
        "role": "two-axis standards/specification review",
        "category": "core",
        "requirement": "every implemented change",
        "hard": True,
        "subagents": True,
    },
    "setup-matt-pocock-skills": {
        "owner": "Matt Pocock",
        "source": MATT_SOURCE,
        "provider": "mattpocock-skills",
        "role": "repository issue-tracker/domain setup",
        "category": "repository-setup",
        "requirement": "before a Matt skill that reads/writes repository workflow config",
        "hard": False,
        "sideEffects": ["write-repository-config"],
    },
    "tdd": {
        "owner": "Matt Pocock",
        "source": MATT_SOURCE,
        "provider": "mattpocock-skills",
        "role": "test-first implementation discipline",
        "category": "transitive",
        "requirement": "when the implementation contract or bug route requires it",
        "hard": False,
        "upstreamInvocation": "model-invoked",
    },
    "codebase-design": {
        "owner": "Matt Pocock",
        "source": MATT_SOURCE,
        "provider": "mattpocock-skills",
        "role": "deep-module and seam vocabulary",
        "category": "conditional",
        "requirement": "when a seam or interface decision is unclear",
        "hard": False,
        "upstreamInvocation": "model-invoked",
    },
    "prototype": {
        "owner": "Matt Pocock",
        "source": MATT_SOURCE,
        "provider": "mattpocock-skills",
        "role": "disposable empirical/UI/state experiment",
        "category": "conditional",
        "requirement": "only for unresolved empirical interaction/state uncertainty",
        "hard": False,
    },
    "research": {
        "owner": "Matt Pocock",
        "source": MATT_SOURCE,
        "provider": "mattpocock-skills",
        "role": "authoritative external-fact investigation",
        "category": "conditional",
        "requirement": "only for current external/API facts",
        "hard": False,
        "subagents": True,
    },
    "diagnosing-bugs": {
        "owner": "Matt Pocock",
        "source": MATT_SOURCE,
        "provider": "mattpocock-skills",
        "role": "reproduction and root-cause diagnosis",
        "category": "conditional",
        "requirement": "BUG workflows",
        "hard": False,
    },
    "wayfinder": {
        "owner": "Matt Pocock",
        "source": MATT_SOURCE,
        "provider": "mattpocock-skills",
        "role": "large-project decision map",
        "category": "conditional",
        "requirement": "LARGE_PROJECT workflows",
        "hard": False,
        "sideEffects": ["publish-wayfinding"],
        "upstreamSkillPath": "skills/engineering/wayfinder/SKILL.md",
        "upstreamInvocation": "user-invoked",
        "directDependencies": ["grilling", "domain-modeling"],
    },
    "post-mortem": {
        "owner": "thananon",
        "source": NINEARM_SOURCE,
        "provider": "9arm-skills",
        "role": "validated bug-fix engineering record",
        "category": "conditional",
        "requirement": "important validated bug fix/incident only",
        "hard": False,
        "supports_incident": False,
    },
}
CORE_FEATURE_DEPENDENCIES = (
    "grill-with-docs", "to-spec", "scrutinize", "to-tickets", "implement", "code-review"
)
PROVENANCE_STATUSES = {"VERIFIED", "UNVERIFIED", "MISMATCH"}
INSTALLATION_VERIFICATION = {
    "installer": "npx skills",
    "commandTemplate": "npx skills add https://github.com/{source} --skill {skill}",
    "scope": "project-local (default; run from the target repository)",
    "transitiveDependenciesAutoInstalled": False,
    "sources": [
        "https://github.com/vercel-labs/skills#readme",
        "https://github.com/vercel-labs/skills/blob/main/src/add.ts",
        "https://github.com/mattpocock/skills/blob/main/skills/engineering/grill-with-docs/SKILL.md",
        "https://github.com/mattpocock/skills/blob/main/skills/productivity/grilling/SKILL.md",
        "https://github.com/mattpocock/skills/blob/main/skills/engineering/domain-modeling/SKILL.md",
        "https://github.com/mattpocock/skills#readme",
        "https://github.com/thananon/9arm-skills#readme",
    ],
}

for _parent_name, _parent_contract in DEPENDENCIES.items():
    for _child_name in _parent_contract.get("directDependencies", []):
        if _child_name not in DEPENDENCIES:
            raise ValueError(f"unknown transitive dependency: {_parent_name} -> {_child_name}")
        DEPENDENCIES[_child_name].setdefault("requiredBy", []).append(_parent_name)

DEPENDENCY_GRAPH = {
    "engineering-workflow": list(CORE_FEATURE_DEPENDENCIES),
    **{
        _name: list(_contract.get("directDependencies", []))
        for _name, _contract in DEPENDENCIES.items()
    },
}


def _installation_command(source: str, skills: Iterable[str]) -> str:
    source_url = source if "://" in source else f"https://github.com/{source}"
    arguments = " ".join(f"--skill {skill}" for skill in skills)
    return f"npx skills add {source_url} {arguments}".strip()


for _dependency_name, _dependency_contract in DEPENDENCIES.items():
    _dependency_contract["installation"] = (
        _installation_command(_dependency_contract["source"], [_dependency_name])
        if _dependency_contract.get("source") != UNKNOWN_SOURCE
        else None
    )
    _dependency_contract["installScope"] = INSTALLATION_VERIFICATION["scope"]
    _dependency_contract["verifiedCommand"] = _dependency_contract.get("source") != UNKNOWN_SOURCE
    _dependency_contract["verificationSources"] = list(INSTALLATION_VERIFICATION["sources"])
SKIP_DIRECTORIES = {".git", "node_modules", "__pycache__", ".venv", "venv"}


@dataclass(frozen=True)
class Candidate:
    name: str
    path: str
    provider: str
    resolved_identity: str
    source_kind: str
    content_hash: str
    enabled: bool
    model_invocable: bool
    allow_implicit_invocation: bool
    policy_sources: tuple[str, ...]
    provenance_status: str
    provenance_source: str
    provenance_evidence: tuple[str, ...]


def _digest(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def _parse_scalar(value: str) -> Any:
    value = value.strip().strip('"').strip("'")
    lowered = value.lower()
    if lowered in {"true", "yes", "on", "1"}:
        return True
    if lowered in {"false", "no", "off", "0"}:
        return False
    return value


def parse_frontmatter(skill_file: Path) -> dict[str, Any]:
    text = skill_file.read_text(encoding="utf-8")
    match = re.match(r"^---\s*\n(.*?)\n---(?:\s*\n|$)", text, re.DOTALL)
    if not match:
        return {}
    fields: dict[str, Any] = {}
    for line in match.group(1).splitlines():
        if line.startswith((" ", "\t")) or line.lstrip().startswith("#"):
            continue
        item = re.match(r"^([A-Za-z0-9_-]+):\s*(.*?)\s*$", line)
        if item:
            fields[item.group(1)] = _parse_scalar(item.group(2))
    return fields


def parse_openai_policy(skill_file: Path) -> bool:
    metadata = skill_file.parent / "agents" / "openai.yaml"
    if not metadata.is_file():
        return True
    match = re.search(
        r"^\s*allow_implicit_invocation:\s*(true|false)\s*$",
        metadata.read_text(encoding="utf-8"),
        re.MULTILINE | re.IGNORECASE,
    )
    return True if not match else match.group(1).lower() == "true"


def _read_json(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def normalize_source(value: Any) -> str | None:
    """Return a comparable owner/repository identifier when one is present."""
    if not isinstance(value, str):
        return None
    candidate = value.strip().rstrip("/")
    candidate = re.sub(r"^git\+", "", candidate)
    candidate = re.sub(r"\.git$", "", candidate)
    match = re.search(r"github\.com[/:]([^/]+/[^/#?]+)", candidate)
    if match:
        candidate = match.group(1)
    if re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", candidate):
        return candidate
    return None


def _provenance_lock_files(
    skill_file: Path, search_root: Path, settings_roots: Iterable[Path]
) -> list[Path]:
    roots = _configuration_roots([skill_file.parent, search_root, *settings_roots])
    paths: set[Path] = set()
    for root in roots:
        paths.update(
            {
                root / "skills-lock.json",
                root / ".skill-lock.json",
                root / ".agents" / ".skill-lock.json",
                root / ".agents" / "skills-lock.json",
            }
        )
    return sorted(path.resolve() for path in paths if path.is_file())


def _locked_source(
    name: str, skill_file: Path, search_root: Path, settings_roots: Iterable[Path]
) -> tuple[list[str], list[str]]:
    sources: list[str] = []
    evidence: list[str] = []
    for lock_file in _provenance_lock_files(skill_file, search_root, settings_roots):
        payload = _read_json(lock_file)
        entries = payload.get("skills")
        if not isinstance(entries, dict) or not isinstance(entries.get(name), dict):
            continue
        entry = entries[name]
        source = normalize_source(entry.get("source")) or normalize_source(entry.get("sourceUrl"))
        if source:
            sources.append(source)
            evidence.append(f"{lock_file}: skills.{name}.source")
    return sources, evidence


def _provenance(
    name: str,
    skill_file: Path,
    frontmatter: dict[str, Any],
    search_root: Path,
    settings_roots: Iterable[Path],
) -> tuple[str, str, tuple[str, ...]]:
    sources: list[str] = []
    evidence: list[str] = []
    for field in ("source", "repository", "repo", "upstream", "sourceRepository"):
        source = normalize_source(frontmatter.get(field))
        if source:
            sources.append(source)
            evidence.append(f"{skill_file}: frontmatter.{field}")
    locked_sources, locked_evidence = _locked_source(
        name, skill_file, search_root, settings_roots
    )
    sources.extend(locked_sources)
    evidence.extend(locked_evidence)
    unique_sources = list(dict.fromkeys(sources))
    if len(unique_sources) == 1:
        return "VERIFIED", unique_sources[0], tuple(dict.fromkeys(evidence))
    if len(unique_sources) > 1:
        return "MISMATCH", UNKNOWN_SOURCE, tuple(dict.fromkeys(evidence))
    return "UNVERIFIED", UNKNOWN_SOURCE, tuple(dict.fromkeys(evidence))


def _plugin_manifest(skill_file: Path, search_root: Path) -> tuple[str | None, Path | None]:
    current = skill_file.parent
    boundary = search_root.resolve()
    while True:
        for relative in (".claude-plugin/plugin.json", ".codex-plugin/plugin.json"):
            manifest = current / relative
            if manifest.is_file():
                name = _read_json(manifest).get("name")
                if isinstance(name, str) and name:
                    return name, manifest
        if current == boundary or current.parent == current:
            break
        try:
            current.relative_to(boundary)
        except ValueError:
            break
        current = current.parent
    return None, None


def _settings_files(roots: Iterable[Path]) -> list[Path]:
    files: set[Path] = set()
    for root in roots:
        for relative in (
            ".claude/settings.json",
            ".claude/settings.local.json",
            "settings.json",
            ".codex/config.toml",
            "config.toml",
        ):
            candidate = root / relative
            if candidate.is_file():
                files.add(candidate.resolve())
    return sorted(files)


def _configuration_roots(roots: Iterable[Path]) -> list[Path]:
    candidates: set[Path] = set()
    for root in roots:
        current = root.resolve()
        candidates.add(current)
        for _ in range(4):
            if current.parent == current:
                break
            current = current.parent
            candidates.add(current)
    return sorted(candidates)


def _claude_controls(settings_files: Iterable[Path]) -> tuple[dict[str, str], dict[str, bool], list[str]]:
    overrides: dict[str, str] = {}
    plugins: dict[str, bool] = {}
    sources: list[str] = []
    for path in settings_files:
        if path.suffix != ".json":
            continue
        payload = _read_json(path)
        current_overrides = payload.get("skillOverrides", {})
        if isinstance(current_overrides, dict):
            overrides.update({str(key): str(value) for key, value in current_overrides.items()})
            sources.append(str(path))
        enabled_plugins = payload.get("enabledPlugins", {})
        if isinstance(enabled_plugins, dict):
            plugins.update({str(key): bool(value) for key, value in enabled_plugins.items()})
            sources.append(str(path))
    return overrides, plugins, sources


def _codex_disabled_paths(settings_files: Iterable[Path]) -> tuple[set[Path], list[str]]:
    disabled: set[Path] = set()
    sources: list[str] = []
    if tomllib is None:
        return disabled, sources
    for path in settings_files:
        if path.suffix != ".toml":
            continue
        try:
            payload = tomllib.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, tomllib.TOMLDecodeError):
            continue
        configs = payload.get("skills", {}).get("config", [])
        if isinstance(configs, dict):
            configs = [configs]
        for item in configs if isinstance(configs, list) else []:
            if not isinstance(item, dict) or item.get("enabled", True) is not False:
                continue
            raw_path = item.get("path")
            if isinstance(raw_path, str):
                candidate = Path(os.path.expandvars(os.path.expanduser(raw_path)))
                if not candidate.is_absolute():
                    candidate = path.parent / candidate
                disabled.add(candidate.resolve())
                sources.append(str(path))
    return disabled, sources


def _walk_skill_files(root: Path) -> Iterable[Path]:
    if root.is_file() and root.name == "SKILL.md":
        yield root.resolve()
        return
    if not root.is_dir():
        return
    for directory, names, files in os.walk(root):
        names[:] = [name for name in names if name not in SKIP_DIRECTORIES]
        if "SKILL.md" in files:
            yield (Path(directory) / "SKILL.md").resolve()


def default_search_roots(cwd: Path | None = None) -> list[Path]:
    cwd = (cwd or Path.cwd()).resolve()
    user_root = Path.home()
    roots = [
        cwd / ".agents" / "skills",
        cwd / ".claude" / "skills",
        cwd / ".codex" / "skills",
        cwd / ".github" / "skills",
        user_root / ".agents" / "skills",
        user_root / ".claude" / "skills",
        user_root / ".codex" / "skills",
        user_root / ".github" / "skills",
        user_root / ".claude" / "plugins" / "cache",
        user_root / ".codex" / "plugins" / "cache",
    ]
    return [root for root in roots if root.exists()]


def discover_candidates(
    roots: Iterable[Path], runtime: str,
    settings_roots: Iterable[Path] | None = None,
) -> list[Candidate]:
    roots = [root.resolve() for root in roots]
    settings_roots = list(settings_roots if settings_roots is not None else roots)
    settings_files = _settings_files(
        _configuration_roots(settings_roots)
    )
    overrides, enabled_plugins, claude_sources = _claude_controls(settings_files)
    disabled_paths, codex_sources = _codex_disabled_paths(settings_files)
    seen: set[Path] = set()
    candidates: list[Candidate] = []
    for root in roots:
        for skill_file in _walk_skill_files(root):
            if skill_file in seen:
                continue
            seen.add(skill_file)
            frontmatter = parse_frontmatter(skill_file)
            name = frontmatter.get("name") or skill_file.parent.name
            if not isinstance(name, str) or not name:
                continue
            plugin, manifest = _plugin_manifest(skill_file, root)
            provenance_status, provenance_source, provenance_evidence = _provenance(
                name, skill_file, frontmatter, root, settings_roots
            )
            provider = plugin or "standalone"
            source_kind = "plugin" if plugin else "standalone"
            identity = f"{plugin}:{name}" if plugin else str(skill_file)
            enabled = skill_file not in disabled_paths
            model_invocable = frontmatter.get("disable-model-invocation") is not True
            policy_sources: list[str] = [str(skill_file)]
            if manifest:
                policy_sources.append(str(manifest))
            if runtime == "claude":
                for key in (identity, name):
                    override = overrides.get(key)
                    if override == "off":
                        enabled = False
                    elif override == "user-invocable-only":
                        model_invocable = False
                if plugin:
                    matching_flags = [
                        value for key, value in enabled_plugins.items()
                        if key == plugin or key.startswith(plugin + "@")
                    ]
                    if matching_flags and not any(matching_flags):
                        enabled = False
                policy_sources.extend(claude_sources)
            else:
                policy_sources.extend(codex_sources)
            candidates.append(
                Candidate(
                    name=name,
                    path=str(skill_file),
                    provider=provider,
                    resolved_identity=identity,
                    source_kind=source_kind,
                    content_hash=_digest(skill_file.read_bytes()),
                    enabled=enabled,
                    model_invocable=model_invocable,
                    allow_implicit_invocation=parse_openai_policy(skill_file),
                    policy_sources=tuple(dict.fromkeys(policy_sources)),
                    provenance_status=provenance_status,
                    provenance_source=provenance_source,
                    provenance_evidence=provenance_evidence,
                )
            )
    # Preserve search-root precedence: project-local roots are supplied before
    # user/global roots. This lets an equivalent project-local installation win
    # without treating a duplicate copy of the same verified package as an
    # ambiguity.
    return candidates


def _resolve_one(
    name: str, candidates: list[Candidate], runtime: str, has_subagents: bool,
    incident: bool = False,
) -> tuple[Candidate | None, list[dict[str, Any]]]:
    issues: list[dict[str, Any]] = []
    contract = DEPENDENCIES.get(name)
    matches = [candidate for candidate in candidates if candidate.name == name]
    if not matches:
        code = "BUILTIN_CODE_REVIEW_COLLISION" if runtime == "claude" and name == "code-review" else "MISSING_DEPENDENCY"
        issue: dict[str, Any] = {
            "code": code,
            "dependency": name,
            "message": "no compatible installed skill file found",
        }
        if contract and contract.get("requiredBy"):
            issue["requiredBy"] = list(contract["requiredBy"])
        issues.append(issue)
        return None, issues
    enabled = [candidate for candidate in matches if candidate.enabled]
    if not enabled:
        issues.append({"code": "DISABLED_DEPENDENCY", "dependency": name, "message": "all installed candidates are disabled"})
        return None, issues
    if contract and contract.get("subagents") and not has_subagents:
        issues.append({"code": "SUBAGENT_CAPABILITY_REQUIRED", "dependency": name, "message": "runtime cannot satisfy the specialist contract"})
        return None, issues
    if incident and name == "post-mortem" and contract and not contract.get("supports_incident", False):
        issues.append({"code": "CONTRACT_INCOMPATIBLE", "dependency": name, "message": "installed post-mortem contract rejects customer-visible incidents"})
        return None, issues

    # A project-local and user/global copy with the same verified source,
    # content, and invocation policy is one installed dependency, not two
    # competing implementations. Keep the first candidate because discovery
    # preserves the configured project-before-global precedence. Unverified
    # duplicates remain ambiguous and require an explicit choice.
    equivalent: dict[tuple[Any, ...], Candidate] = {}
    collapsed: list[Candidate] = []
    for candidate in enabled:
        key = (
            candidate.content_hash,
            candidate.provenance_source,
            candidate.provider,
            candidate.source_kind,
            candidate.model_invocable,
            candidate.allow_implicit_invocation,
        )
        if candidate.provenance_status == "VERIFIED" and key in equivalent:
            continue
        equivalent[key] = candidate
        collapsed.append(candidate)
    enabled = collapsed

    expected_source = contract.get("source") if contract else None
    source_matches = [
        candidate
        for candidate in enabled
        if candidate.provenance_source == expected_source
    ]
    expected_provider = contract.get("provider") if contract else None
    expected_plugins = [candidate for candidate in enabled if candidate.provider == expected_provider]
    standalone = [candidate for candidate in enabled if candidate.source_kind == "standalone"]
    if source_matches:
        pool = source_matches
    elif expected_plugins:
        pool = expected_plugins
    elif standalone:
        pool = standalone
    else:
        providers = ", ".join(sorted({candidate.provider for candidate in enabled}))
        issues.append({"code": "PROVIDER_MISMATCH", "dependency": name, "message": f"expected {expected_provider}; found {providers}"})
        return None, issues
    if len(pool) != 1:
        issues.append(
            {
                "code": "AMBIGUOUS_DEPENDENCY",
                "dependency": name,
                "message": "multiple candidates require an exact configured identity",
                "candidates": [candidate.resolved_identity for candidate in pool],
            }
        )
        return None, issues
    selected = pool[0]
    if selected.provenance_status == "MISMATCH" or (
        selected.provenance_source != UNKNOWN_SOURCE
        and selected.provenance_source != expected_source
    ):
        issues.append(
            {
                "code": "PROVENANCE_MISMATCH",
                "dependency": name,
                "message": f"expected source {expected_source}; found {selected.provenance_source}",
                "expectedSource": expected_source,
                "detectedSource": selected.provenance_source,
                "evidence": list(selected.provenance_evidence),
            }
        )
        return None, issues
    if runtime == "claude" and name == "code-review" and selected.source_kind == "plugin":
        if selected.resolved_identity != "mattpocock-skills:code-review":
            issues.append({"code": "BUILTIN_CODE_REVIEW_COLLISION", "dependency": name, "message": "Claude code-review must use the Matt-qualified namespace"})
            return None, issues
    return selected, issues


def installation_proposal(missing: Iterable[str]) -> list[dict[str, Any]]:
    """Build verified, permission-gated proposals without executing them."""
    grouped: dict[str, list[str]] = {}
    for name in sorted(set(missing)):
        contract = DEPENDENCIES.get(name)
        if contract and contract.get("source") != UNKNOWN_SOURCE:
            grouped.setdefault(contract["source"], []).append(name)
    proposals = []
    for source, names in sorted(grouped.items()):
        owners = sorted({DEPENDENCIES[name]["owner"] for name in names})
        proposals.append(
            {
                "owner": owners[0] if len(owners) == 1 else owners,
                "source": source,
                "skills": names,
                "method": INSTALLATION_VERIFICATION["installer"],
                "command": _installation_command(source, names),
                "installScope": INSTALLATION_VERIFICATION["scope"],
                "verified": True,
                "verificationSources": list(INSTALLATION_VERIFICATION["sources"]),
                "requiresApproval": True,
            }
        )
    return proposals


def expand_dependency_names(
    required: Iterable[str], requirement_statuses: dict[str, str] | None = None
) -> tuple[list[str], dict[str, str]]:
    """Include verified hard transitive dependencies without creating stages."""
    names = list(dict.fromkeys(required))
    requirements = dict(requirement_statuses or {})
    queue = list(names)
    while queue:
        parent = queue.pop(0)
        contract = DEPENDENCIES.get(parent, {})
        for child in contract.get("directDependencies", []):
            if child not in names:
                names.append(child)
                queue.append(child)
            requirements.setdefault(child, "TRANSITIVE")
    return names, requirements


def route_dependency_plan(
    workflow_type: str,
    risk: str | None = None,
    uncertainty: str | None = None,
    characteristics: Iterable[str] = (),
    incident: bool = False,
    reduced: bool = False,
) -> list[dict[str, str]]:
    """Return only the dependencies the selected route can actually reach."""
    plan: list[dict[str, str]] = []
    seen: set[str] = set()

    def add(name: str, requirement: str) -> None:
        if name in seen:
            return
        if name not in DEPENDENCIES:
            raise ValueError(f"unknown dependency: {name}")
        seen.add(name)
        plan.append({"name": name, "requirement": requirement})

    def add_direct_dependencies(name: str) -> None:
        for dependency in DEPENDENCIES[name].get("directDependencies", []):
            add(dependency, "TRANSITIVE")

    system_sensitive = risk in {"HIGH", "CRITICAL"} or bool(
        {"concurrency", "distributed-retry", "external-side-effect", "migration", "public-contract", "system-review-required"}
        .intersection(characteristics)
    )
    if workflow_type == "FEATURE":
        if reduced:
            add("implement", "REQUIRED_LATER")
            add("code-review", "REQUIRED_LATER")
        else:
            add("grill-with-docs", "REQUIRED_NOW")
            add_direct_dependencies("grill-with-docs")
            add("to-spec", "REQUIRED_LATER")
            add("scrutinize", "REQUIRED_LATER")
            add("to-tickets", "REQUIRED_LATER")
            add("implement", "REQUIRED_LATER")
            add("code-review", "REQUIRED_LATER")
        if not reduced:
            add("setup-matt-pocock-skills", "REPOSITORY_BOOTSTRAP")
    elif workflow_type == "BUG":
        add("diagnosing-bugs", "REQUIRED_NOW")
        add("implement", "REQUIRED_LATER")
        add("code-review", "REQUIRED_LATER")
        if system_sensitive:
            add("scrutinize", "REQUIRED_LATER")
        if incident:
            add("post-mortem", "CONDITIONAL")
        add("setup-matt-pocock-skills", "REPOSITORY_BOOTSTRAP")
    elif workflow_type == "LARGE_PROJECT":
        add("wayfinder", "REQUIRED_NOW")
        add_direct_dependencies("wayfinder")
        add("to-tickets", "REQUIRED_LATER")
        add("setup-matt-pocock-skills", "REPOSITORY_BOOTSTRAP")
        add("research", "CONDITIONAL")
        add("prototype", "CONDITIONAL")
    else:
        raise ValueError(f"unknown workflow type: {workflow_type}")

    add("tdd", "TRANSITIVE")
    add("codebase-design", "CONDITIONAL")
    return plan


def repository_setup_status(repository_root: Path) -> dict[str, Any]:
    """Check setup output without running the setup skill or writing files."""
    root = repository_root.resolve()
    required = [
        "docs/agents/issue-tracker.md",
        "docs/agents/domain.md",
    ]
    missing = [relative for relative in required if not (root / relative).is_file()]
    return {
        "status": "CONFIGURED" if not missing else "MISSING",
        "requiredFiles": required,
        "missingFiles": missing,
        "setupSkill": "setup-matt-pocock-skills",
        "checkedRoot": str(root),
    }


def audit_orchestrator_policy(
    skill_file: Path, runtime: str, settings_roots: Iterable[Path]
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    skill_file = skill_file.resolve()
    frontmatter = parse_frontmatter(skill_file)
    name = frontmatter.get("name") or skill_file.parent.name
    issues: list[dict[str, Any]] = []
    sources = [str(skill_file)]
    if runtime == "codex":
        explicit_only = not parse_openai_policy(skill_file)
        metadata = skill_file.parent / "agents" / "openai.yaml"
        if metadata.is_file():
            sources.append(str(metadata))
    else:
        settings_files = _settings_files(_configuration_roots(settings_roots))
        overrides, _, override_sources = _claude_controls(settings_files)
        override = overrides.get(str(name))
        explicit_only = (
            frontmatter.get("disable-model-invocation") is True
            or override == "user-invocable-only"
        )
        sources.extend(override_sources)
    if not explicit_only:
        issues.append(
            {
                "code": "INVOCATION_POLICY_INCOMPATIBLE",
                "dependency": str(name),
                "message": f"{runtime} installation does not enforce explicit user invocation",
            }
        )
    return {
        "name": name,
        "path": str(skill_file),
        "runtime": runtime,
        "explicitOnly": explicit_only,
        "policySources": list(dict.fromkeys(sources)),
    }, issues


def _resolution(
    name: str, selected: Candidate, runtime: str
) -> dict[str, Any]:
    contract = DEPENDENCIES.get(name, {})
    resolution = asdict(selected)
    resolution.update(
        {
            "owner": contract.get("owner", UNKNOWN_SOURCE),
            "expectedSource": contract.get("source", UNKNOWN_SOURCE),
            "role": contract.get("role", "external dependency"),
            "category": contract.get("category", "unknown"),
            "requirement": contract.get("requirement", "not documented"),
            "requiredBy": list(contract.get("requiredBy", [])),
            "directDependencies": list(contract.get("directDependencies", [])),
        }
    )
    if contract.get("upstreamInvocation"):
        resolution["upstreamInvocation"] = contract["upstreamInvocation"]
    if runtime == "claude":
        if selected.model_invocable:
            resolution["invocationMode"] = "skill_tool"
            resolution["invocationTarget"] = selected.resolved_identity
        else:
            resolution["invocationMode"] = "user_handoff"
            target = selected.resolved_identity if selected.source_kind == "plugin" else selected.name
            resolution["invocationTarget"] = f"/{target}"
    elif not selected.allow_implicit_invocation:
        resolution["invocationMode"] = "user_handoff"
        resolution["invocationTarget"] = f"${selected.name}"
    else:
        resolution["invocationMode"] = "codex_load_path"
        resolution["invocationTarget"] = selected.path
    if contract.get("sideEffects"):
        resolution["declaredSideEffects"] = list(contract["sideEffects"])
    return resolution


def _status_for(
    name: str, selected: Candidate | None, current_issues: list[dict[str, Any]]
) -> str:
    if selected:
        return "INSTALLED"
    codes = {issue.get("code") for issue in current_issues}
    if "MISSING_DEPENDENCY" in codes or "BUILTIN_CODE_REVIEW_COLLISION" in codes:
        return "MISSING"
    if "DISABLED_DEPENDENCY" in codes:
        return "DISABLED"
    if "PROVENANCE_MISMATCH" in codes:
        return "PROVENANCE_MISMATCH"
    if "AMBIGUOUS_DEPENDENCY" in codes:
        return "AMBIGUOUS"
    if codes:
        return "INCOMPATIBLE"
    return "NOT_CHECKED"


def _dependency_status(
    name: str, selected: Candidate | None, current_issues: list[dict[str, Any]], requirement: str
) -> dict[str, Any]:
    contract = DEPENDENCIES.get(name, {})
    result: dict[str, Any] = {
        "name": name,
        "owner": contract.get("owner", UNKNOWN_SOURCE),
        "expectedSource": contract.get("source", UNKNOWN_SOURCE),
        "role": contract.get("role", "external dependency"),
        "category": contract.get("category", "unknown"),
        "requirement": requirement,
        "requiredBy": list(contract.get("requiredBy", [])),
        "directDependencies": list(contract.get("directDependencies", [])),
        "status": _status_for(name, selected, current_issues),
        "installation": contract.get("installation"),
        "installScope": contract.get("installScope"),
        "verifiedCommand": contract.get("verifiedCommand", False),
    }
    if contract.get("upstreamInvocation"):
        result["upstreamInvocation"] = contract["upstreamInvocation"]
    if contract.get("verificationSources"):
        result["verificationSources"] = list(contract["verificationSources"])
    if selected:
        result.update(
            {
                "path": selected.path,
                "resolvedIdentity": selected.resolved_identity,
                "provenanceStatus": selected.provenance_status,
                "detectedSource": selected.provenance_source,
                "provenanceEvidence": list(selected.provenance_evidence),
            }
        )
    elif current_issues:
        result["issues"] = [issue.get("code") for issue in current_issues]
        mismatch = next(
            (issue for issue in current_issues if issue.get("code") == "PROVENANCE_MISMATCH"),
            None,
        )
        if mismatch:
            result.update(
                {
                    "provenanceStatus": "MISMATCH",
                    "detectedSource": mismatch.get("detectedSource", UNKNOWN_SOURCE),
                    "provenanceEvidence": mismatch.get("evidence", []),
                }
            )
    return result


def installation_capability(repository_root: Path) -> dict[str, Any]:
    """Describe local prerequisites without attempting network or installation."""
    root = repository_root.resolve()
    installer_available = shutil.which("npx") is not None
    project_mutation_allowed = os.access(root, os.W_OK)
    return {
        "commandExecution": True,
        "installerAvailable": installer_available,
        "projectMutationAllowed": project_mutation_allowed,
        "networkVerified": False,
        "automaticInstallSupported": False,
        "manualInstallCommandReady": installer_available and project_mutation_allowed,
        "scope": "project-local (default; run from the target repository)",
        "note": "network is not probed, so automatic installation is not claimed; explicit user permission remains mandatory",
    }


def audit_dependencies(
    required: Iterable[str], runtime: str, roots: Iterable[Path], has_subagents: bool,
    orchestrator_skill: Path | None = None,
    settings_roots: Iterable[Path] | None = None,
    incident: bool = False,
    repository_root: Path | None = None,
    require_repository_setup: bool = False,
    requirement_statuses: dict[str, str] | None = None,
    strict_missing: bool = True,
) -> dict[str, Any]:
    roots = list(roots)
    selected_settings_roots = list(settings_roots) if settings_roots is not None else roots
    candidates = discover_candidates(roots, runtime, selected_settings_roots)
    names, requirements = expand_dependency_names(required, requirement_statuses)
    resolutions: dict[str, Any] = {}
    dependency_status: dict[str, Any] = {}
    issues: list[dict[str, Any]] = []
    missing: list[str] = []
    for name in names:
        selected, current_issues = _resolve_one(name, candidates, runtime, has_subagents, incident)
        missing_issue = any(
            issue["code"] in {"MISSING_DEPENDENCY", "BUILTIN_CODE_REVIEW_COLLISION"}
            for issue in current_issues
        )
        if strict_missing or not missing_issue:
            issues.extend(current_issues)
        if missing_issue:
            missing.append(name)
        if selected:
            resolutions[name] = _resolution(name, selected, runtime)
        dependency_status[name] = _dependency_status(
            name, selected, current_issues, requirements.get(name, "REQUIRED_NOW")
        )

    checked_root = (repository_root or Path.cwd()).resolve()
    setup = repository_setup_status(checked_root)
    setup_needed = require_repository_setup and any(
        name in DEPENDENCIES
        and DEPENDENCIES[name]["source"] == MATT_SOURCE
        and name != "setup-matt-pocock-skills"
        for name in names
    )
    if setup_needed and setup["status"] != "CONFIGURED":
        issues.append(
            {
                "code": "REPOSITORY_SETUP_REQUIRED",
                "dependency": "setup-matt-pocock-skills",
                "message": "Matt Pocock repository configuration is missing",
                "missingFiles": setup["missingFiles"],
            }
        )

    orchestrator_policy = None
    if orchestrator_skill is not None:
        orchestrator_policy, policy_issues = audit_orchestrator_policy(
            orchestrator_skill, runtime, selected_settings_roots
        )
        issues.extend(policy_issues)
    return {
        "version": 2,
        "runtime": runtime,
        "ok": not issues,
        "baselineCommits": BASELINE_COMMITS,
        "registry": DEPENDENCIES,
        "dependencyGraph": DEPENDENCY_GRAPH,
        "installationVerification": INSTALLATION_VERIFICATION,
        "resolutions": resolutions,
        "dependencyStatus": dependency_status,
        "repositorySetup": setup,
        "installationCapability": installation_capability(checked_root),
        "orchestratorPolicy": orchestrator_policy,
        "issues": issues,
        "missing": sorted(set(missing)),
        "installProposal": installation_proposal(missing),
        "sideEffectsPerformed": False,
    }


def dependency_inventory(
    runtime: str, roots: Iterable[Path], has_subagents: bool,
    settings_roots: Iterable[Path] | None = None,
    repository_root: Path | None = None,
) -> dict[str, Any]:
    """Report every registry entry without treating optional absence as failure."""
    names = list(DEPENDENCIES)
    result = audit_dependencies(
        names,
        runtime,
        roots,
        has_subagents,
        settings_roots=settings_roots,
        repository_root=repository_root,
        strict_missing=False,
        requirement_statuses={name: DEPENDENCIES[name]["category"].upper() for name in names},
    )
    result["inventory"] = True
    result["installProposal"] = []
    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime", required=True, choices=("codex", "claude"))
    parser.add_argument("--search-root", action="append", type=Path, default=[])
    parser.add_argument("--require", action="append", default=[])
    parser.add_argument("--workflow-type", choices=("FEATURE", "BUG", "LARGE_PROJECT"))
    parser.add_argument("--risk", choices=("LOW", "MEDIUM", "HIGH", "CRITICAL"))
    parser.add_argument("--uncertainty", choices=("LOW", "MEDIUM", "HIGH", "CRITICAL"))
    parser.add_argument("--characteristic", action="append", default=[])
    parser.add_argument("--reduced", action="store_true")
    parser.add_argument("--has-subagents", action="store_true")
    parser.add_argument("--orchestrator-skill", type=Path)
    parser.add_argument("--repository-root", type=Path, default=Path.cwd())
    parser.add_argument("--require-repository-setup", action="store_true")
    parser.add_argument("--inventory", action="store_true", help="report every registry entry without requiring optional skills")
    parser.add_argument("--incident", action="store_true", help="check the post-mortem contract for a customer-visible incident")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    roots = args.search_root or default_search_roots()
    settings_roots = [args.repository_root.resolve(), Path.home(), *roots]
    if args.inventory:
        result = dependency_inventory(
            args.runtime,
            roots,
            args.has_subagents,
            settings_roots=settings_roots,
            repository_root=args.repository_root,
        )
    else:
        requirement_statuses = None
        if args.require:
            required = args.require
        elif args.workflow_type:
            route_plan = route_dependency_plan(
                args.workflow_type,
                risk=args.risk,
                uncertainty=args.uncertainty,
                characteristics=args.characteristic,
                incident=args.incident,
                reduced=args.reduced,
            )
            requirement_statuses = {
                item["name"]: item["requirement"] for item in route_plan
            }
            required = [
                item["name"] for item in route_plan
                if item["requirement"] in {
                    "REQUIRED_NOW", "REQUIRED_LATER", "TRANSITIVE", "REPOSITORY_BOOTSTRAP"
                }
            ]
        else:
            required = list(CORE_FEATURE_DEPENDENCIES)
        result = audit_dependencies(
            required,
            args.runtime,
            roots,
            args.has_subagents,
            args.orchestrator_skill,
            settings_roots=settings_roots,
            incident=args.incident,
            repository_root=args.repository_root,
            require_repository_setup=args.require_repository_setup,
            requirement_statuses=requirement_statuses,
        )
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if result["ok"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
