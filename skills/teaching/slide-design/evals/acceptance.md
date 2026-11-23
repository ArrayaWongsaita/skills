# Acceptance run: slide-design

The acceptance checks for the first build of `slide-design`, from spec §8 (`docs/superpowers/specs/2026-11-22-slide-design-skill-design.md`). Checks 1–3 run on fixtures and are automated. Check 4 needs a human: the user approves the storyboard and judges the deck.

## Automated checks

Run from the repo root:

```bash
uv run --no-project --python 3.12 --with pytest pytest skills/teaching/slide-design/tests -q
```

| # | Check | How to run | Pass condition |
|---|---|---|---|
| 1a | The storyboard's slides cover every filled slot and snippet | `tests/test_validate_deck.py::test_assembled_fixture_is_valid` | the fixture deck has no `not covered` error |
| 1b | The gate stops the run | `tests/test_deck_state.py::test_gate_cannot_be_skipped` | moving from `storyboard` to `writing` is refused |
| 1c | The fixture deck validates | `validate_deck.py <course> 1` on the assembled fixture (`test_cli_exit_codes`) | exit 0 |
| 2a | A changed code line fails | `test_mutations_are_caught[...gpt-4...]` | `code excerpt differs from snippet 1.1-a` |
| 2b | An overlapping node fails | `test_mutations_are_caught[..."at"...]` | `nodes overlap: n-model, n-tool` |
| 2c | An unknown concept fails | `test_mutations_are_caught[...robot...]` | `unknown concept 'robot'` |
| 2d | A missing slot fails | `test_missing_slot` | `not covered: 1.1/Misconceptions` |
| 2e | A diagram slide whose `new` does not match what it adds fails | `test_new_mismatch` | `` `new` does not match what this slide adds `` |
| 2f | Text over its limit fails, and Thai marks do not count | `test_text_over_limit`, `test_thai_marks_do_not_count` | `too long: Body has 421 characters, limit 420`; no error at 140 visible characters |
| 3 | A second Part run reuses the vocabulary and only appends to it | `tests/test_vocabulary.py` | a new concept bumps the version; changing an existing one is refused as `append-only` |

## Manual run on a real Part

Check 4: on a real Part from the first `course-research` run (LangChain + LangGraph, Thai).

### Recipe

1. Make the skill loadable in Claude Code, **only after the user agrees**: `ln -s "$PWD/skills/teaching/slide-design" ~/.claude/skills/slide-design`.
2. In the course-research run directory, ask for the slides of Part 1.
3. At the gate, note every change the user asks for, then approve.
4. Let the run finish, then run from the repo root:

```bash
python3 skills/teaching/slide-design/scripts/validate_deck.py <course_dir> 1     # expect exit 0
python3 skills/teaching/slide-design/scripts/deck_state.py show <course_dir> 1   # expect stage done
```

5. Run Part 2 the same way, and check that `visual-vocabulary.md` only gained concepts.

### Checks

| # | Check | How to verify | Result | Evidence |
|---|---|---|---|---|
| 4a | The user approves the storyboard with few changes | The changes noted at step 3 | | |
| 4b | The reviewer's learner pass ends with no Blocking issue | `_work/part-01/review.md` after the last round | | |
| 4c | The deck validates | `validate_deck.py` exit 0 | | |
| 4d | The user judges the deck buildable for Google Slides or React | Ask the user after reading the deck and its diagrams | | |
| 4e | The Part 2 run reuses the vocabulary | `git diff` of `visual-vocabulary.md`: only new concept rows and a version bump | | |

## Notes from the run

<What the user changed at the gate, which limits were too tight or too loose, the cost (tokens or time), and the follow-ups.>
