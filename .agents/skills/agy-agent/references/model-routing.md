# Model Routing Heuristics

Google Antigravity (`agy`) routes to several model families. Matching the model
and reasoning tier to the delegated task aligns cost, latency, context capacity,
and reasoning depth with what the task actually needs.

## Model slug vs. `--effort` — two knobs, use one

- **`--model <slug>`** picks the model *and* its reasoning tier. The tier is part
  of the slug: `gemini-3.8-flash-high`, `gemini-3.8-flash-medium`,
  `gemini-3.8-flash-low`, `gemini-3.1-pro-high`, `gemini-3.1-pro-low`.
- **`--effort <low|medium|high>`** overrides the tier. Use it only when the slug
  you want does not name the tier you want (e.g. a mid effort on a model that
  ships only `-high` / `-low`), or when the auth mode exposes effort separately.
- Do **not** pass a `-high` slug together with `--effort high` — it is redundant
  and reads as a contradiction when the two disagree. Pick the slug, or pick a
  base slug plus `--effort`.
- Omitting `--model` entirely uses the environment's configured default, which is
  the right call for standard tasks.

## Available Models

> Run `agy models` to confirm — the list below is current as of **2026-09-03**
> and the Flash line in particular moves fast. Route by the **tier**, not the
> exact version string.

| Slug (as of 2026-09-03) | Family | Context | Strengths | Route here for |
|---|---|---|---|---|
| `gemini-3.8-flash-high` | Gemini Flash | 1M+ | Fast, vast context, high throughput | Whole-codebase surveys, massive logs, multi-package mapping |
| `gemini-3.8-flash-medium` | Gemini Flash | 1M+ | Lower latency, balanced | Bulk scaffolding, repetitive mechanical edits, type generation |
| `gemini-3.8-flash-low` | Gemini Flash | 1M+ | Minimal latency, direct | Quick greps, simple formatting, one-pass lint fixes |
| `gemini-3.1-pro-high` | Gemini Pro | 1M+ | Deep multi-step reasoning | Hard bug diagnosis, subtle races, complex architectural refactors |
| `claude-sonnet-4-6` | Claude Sonnet | ~200k | Strong SWE discipline | Cross-family second opinion when the host is **not** Claude |
| `claude-opus-4-6-thinking` | Claude Opus | ~200k | Deep architectural evaluation | High-stakes architectural critique from a non-Claude host |
| `gpt-oss-120b-medium` | Open weights | ~128k | Independent open-model view | Isolated open-model validation |

## Selection Decision Tree

### 1. Context volume
Tasks that scan hundreds of files, read 50MB+ logs, or ingest whole doc sets:
route to a **Flash** tier — the 1M+ window absorbs the input without truncation.
Prefer `-high` when the reading also needs synthesis, `-medium` for a plain sweep.

### 2. Reasoning complexity
- **Deep reasoning** (unknown root cause, logic across async boundaries, proving
  invariants): the **Pro** tier (`gemini-3.1-pro-high`).
- **Mechanical transformation** (well-specified renames, boilerplate, docstrings,
  schema types): a fast **Flash** tier (`gemini-3.8-flash-medium`, or `-low` for
  the most trivial passes).

### 3. Independent second opinion
When the host agent wants an authentic second opinion and not its own reasoning
back, route to **a family different from the host**:
- Host is Claude Code → `gemini-3.1-pro-high` (or `gpt-oss-120b-medium`).
- Host is a Gemini / Codex agent → `claude-sonnet-4-6` or
  `claude-opus-4-6-thinking`.

Routing a second opinion to the host's own family defeats the purpose.

## Default Heuristic

Standard task, no special constraint → pass **no `--model` flag**; let `agy` use
its configured default. Name a model only when the task clearly matches one of
the archetypes above.
