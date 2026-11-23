# Acceptance run: slide-design

The acceptance checks for the first build of `slide-design`, from spec §8 (`docs/superpowers/specs/2026-11-22-slide-design-skill-design.md`), and for the learning units of `deck@2` (checks 5, from `docs/superpowers/specs/2026-11-23-slide-design-learning-units-design.md`). Checks 1–3 and 5 run on fixtures and are automated. Check 4 needs a human: the user approves the unit map and the storyboard, and judges the deck.

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
| 5a | `--plan` checks the unit map before the gate: ids, limits, `needs` pointing backwards, a chapter per sub-topic, split-chapter letters, moves | `tests/test_units.py`, `test_plan_reports_unit_errors` | each bad map gives its message; Thai marks do not count toward the 40-character title |
| 5b | A run from before the unit map names the missing file | `test_plan_without_units_file`, `test_missing_units_file_is_named` | `write it at Stage 1, or redo the storyboard`, no traceback |
| 5c | The deck carries the unit map | `test_deck_is_deck_at_2_with_its_units`, `test_missing_units_section` | `## Units` equals `units.json`; without it, `a deck@2 deck needs its Units section` |
| 5d | Every unit opens with one topic slide, in map order, Title and Body from the map | `test_topics_follow_the_unit_map`, `test_unit_without_a_topic`, `test_unit_mutations_are_caught[...ประกาศ tools...]` | `expected unit … here`; `unit … has no topic slide`; `topic title must equal the unit title` |
| 5e | Every sub-topic section starts with a topic slide, and the opening holds one map slide | `test_sub_topic_section_starts_with_a_topic`, `test_opening_needs_exactly_one_map` | `a sub-topic section starts with a topic slide`; `the opening needs exactly one map slide` |
| 5f | A chapter of two or more units has an assemble slide after its last unit that labels all of them; a one-unit chapter has none | `test_chapter_of_two_units_needs_an_assembly`, `test_assembly_labels_every_unit`, `test_topic_after_its_chapters_assembly`, `test_single_unit_chapter_takes_no_assembly` | the matching message for each |
| 5g | An assemble slide's code equals its snippet, its labels sit inside the shown lines without overlapping, and it shows code or a diagram, not both | `test_unit_mutations_are_caught`, `test_label_lines_lie_inside_the_shown_lines`, `test_label_ranges_do_not_overlap`, `test_assembly_shows_code_or_a_diagram` | `code excerpt differs from snippet 1.2-a`; `label ranges overlap` |
| 5h | A split chapter's assembly may label the earlier chapter's units, never a later one's | `test_label_scope_in_split_chapters` | `label names u-c from a later chapter` |
| 5i | The closing's Part assembly labels every chapter | `test_closing_needs_a_part_assembly`, `test_part_assembly_must_label_every_chapter` | `the Part assembly does not label chapter 1.2b` |
| 5j | A moved unit may use its origin refs, is exempt from its chapter's labels, and is listed under Part ordering problems | `test_moved_unit_may_use_its_origin_refs`, `test_origin_refs_without_a_move_are_refused`, `test_moved_unit_is_exempt_from_coverage`, `test_part_ordering_problems_list_moved_units` | no `content from` error for the moved unit's slide; the move listed with its reason |
| 5k | The opening's epitome (the core diagram whole and dimmed) needs no `new` | `test_epitome_in_the_opening_needs_no_new`, `test_epitome_outside_the_opening_is_refused` | no error in the opening; the `new` error elsewhere |

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
| 4a | The user approves the unit map and the storyboard with few changes | The changes noted at step 3 | | |
| 4b | The reviewer's learner pass ends with no Blocking issue | `_work/part-01/review.md` after the last round | | |
| 4f | The learner pass finds no unit problem: no slide that leaves the learner unsure which unit they are in, no unit relying on a later one, no assembly that introduces something new, no moved unit showing code from a sub-topic not reached | the unit flags in `_work/part-01/review.md` after the last round | | |
| 4c | The deck validates | `validate_deck.py` exit 0 | | |
| 4d | The user judges the deck buildable for Google Slides or React | Ask the user after reading the deck and its diagrams | | |
| 4e | The Part 2 run reuses the vocabulary | `git diff` of `visual-vocabulary.md`: only new concept rows and a version bump | | |

## Notes from the run

<What the user changed at the gate, in the unit map and in the storyboard; which limits were too tight or too loose; the cost (tokens or time); and the follow-ups.>
