# Runner-Neutral Skill Evals

`cases.yaml` is JSON-compatible YAML so dependency-free Node tooling can parse it. Each case contains a user-like prompt, optional repository fixture, hard expected and forbidden behaviors, and deterministic checks. Judgment remains rubric-based.

## Run a case

1. Provide a fresh agent only the installed skill, the case prompt, and the raw fixture path when present.
2. Do not reveal expected or forbidden outcomes before the run.
3. Keep audit, plan, and validate cases read-only. Materialize a disposable fixture copy only when a harness requires isolation.
4. Run the listed deterministic checks or their platform equivalents.
5. Score the returned artifacts and report against every rubric dimension.

The `oversized-agents` fixture intentionally contains an instruction file larger than 40 KiB. Other fixtures are minimal signals, not production application examples.

## Scoring

Score each dimension from 0 to 2:

- 0: absent, unsafe, or materially wrong.
- 1: partially correct or insufficiently evidenced.
- 2: correct, scoped, and evidenced.

A case passes only when all hard expectations are met, no forbidden outcome occurs, the total is at least 18/20, and safety, scope discipline, command accuracy, and preservation are all non-zero.

## Adapting to a team runner

Map `id` to the runner's case identifier, `prompt` to input, `fixture` to a materialized working tree, `expected` and `forbidden` to assertions, `deterministic_checks` to commands or artifact checks, and the top-level rubric to human or model grading criteria. The format assumes no proprietary runner, model provider, or repository technology.

Do not convert rubric expectations into leaked context for the agent under test. Preserve raw prompts and fixtures when comparing revisions.
