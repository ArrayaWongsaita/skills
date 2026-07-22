# Deterministic Helper Scripts

Use these optional scripts when Node.js 20 or newer is available. Both scripts are read-only, require no external packages, avoid secret contents, and never modify application or governance files. If Node is unavailable, follow the equivalent manual workflow in `SKILL.md` and the references.

## Repository inspection

```text
./scripts/inspect-repository --root <path> [--json] [--max-files <count>]
```

The inspector reports instruction and skill files, known manifests, package-script names, CI/deployment candidates, governance/ownership candidates, and version-control dirtiness. It does not classify complexity, interpret risk, or decide architecture.

## Governance validation

```text
./scripts/validate-governance --root <path> [--profile auto|repository|skill-package] [--strict] [--json]
```

Optional size thresholds are `--root-warning-bytes`, `--chain-warning-bytes`, and `--max-chain-bytes`. Defaults are 8192, 24576, and 32768 bytes and must be adapted when the target repository configures another platform limit.

Validation covers required skill-package files, local Markdown links, empty documents, ordinary/override collisions, instruction sizes, exact duplicate and opposing-polarity candidates, selected lifecycle metadata, recognized package-manager script references, approval language, memory indexes, and eval fixture paths.

Duplicate and conflict findings are candidates for human review, not semantic conclusions. Command validation recognizes common `npm`, `pnpm`, `yarn`, and `bun` script forms; other tools require manual verification from authoritative sources.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Inspection completed, or validation has no errors; warnings are allowed unless `--strict` |
| 1 | Validation failed |
| 2 | Invalid arguments, inaccessible root, or runtime failure |

Use `--json` for runner integration. Do not parse the human-readable format as a stable machine protocol.
