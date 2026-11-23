# Acceptance checks

The checks from the design (`docs/superpowers/specs/2026-11-23-react-slides-design.md` §7), and where each one is tested. Python tests are in `tests/`; template tests are in `template/src/` and run with `npm test` in the template.

Run them:

```bash
uv run --no-project --python 3.12 --with pytest pytest skills/teaching/react-slides/tests -q
npm --prefix skills/teaching/react-slides/template ci
npm --prefix skills/teaching/react-slides/template test
npm --prefix skills/teaching/react-slides/template run build
```

`tests/test_app_build.py` needs the template's `node_modules` and is skipped without them.

## Automated

| # | Check | Tests |
|---|---|---|
| 1 | Every layout converts: a fixture deck with every layout, every visual kind, a split code excerpt, an illustrative output and an unverified snippet converts to TSX that type-checks. | `test_fixture.py::test_part_one_uses_every_layout_and_visual_kind`, `test_tsx_writer.py`, `test_app_build.py` (the generated app passes `tsc --noEmit`), `template/src/__fixtures__/typecheck.tsx` (a missing required prop fails the build) |
| 2 | Text is verbatim: every field of every slide renders exactly the deck's text, including Thai with tone marks, emoji, `{ } < > &`, backticks, quotes, links, bold, a line break, a list in a field and unsupported markup shown as written. | `test_fixture.py::test_part_one_covers_the_text_cases`, `test_inline.py`, `test_tsx_writer.py::test_rich_quotes_jsx_characters_in_text`, `tests/app/verbatim.test.tsx` run by `test_app_build.py` |
| 3 | Bad decks are refused, with every error named: a wrong template, an unknown layout, a missing required field, a dangling diagram, element or snippet id, an excerpt that differs from its snippet. | `test_deck_reader.py` (`test_wrong_templates_are_refused`, `test_missing_required_field_is_refused`, `test_excerpt_differing_from_snippet_is_refused`, `test_every_error_is_reported`), `test_build_part.py::test_a_bad_deck_writes_nothing`, `test_build_part.py::test_cli_exit_codes` |
| 4 | The manifest holds: an edited file is skipped and reported, an unedited one is overwritten, `--force` overwrites, `course.ts` is never touched, a template upgrade replaces only unedited files. | `test_manifest.py`, `test_build_part.py` (`test_edited_part_is_skipped_and_reported`, `test_force_path_is_normalised_or_refused`, `test_course_ts_is_never_overwritten`, `test_template_upgrade_replaces_only_unedited_files`) |
| 5 | Parts are independent: converting Part 2 leaves Part 1 unchanged and adds its card; `--all` regenerates only unedited files. | `test_build_part.py` (`test_converting_part_two_leaves_part_one_untouched`, `test_all_converts_every_deck_and_reports_bad_ones`, `test_older_parts_are_reported`), `Home.test.tsx` |
| 5a | Visual keys: after renumbering, every illustration and image stays with its content; a changed description asks for a new drawing and the old file is reported as unused, not deleted. | `test_build_part.py` (`test_visuals_use_content_keys`, `test_renumbered_deck_keeps_keys`, `test_unused_assets_are_reported_not_deleted`, `test_image_counts_as_present_for_an_illustration`), `Visual.test.tsx` |
| 6 | Diagram states: hidden elements are not rendered, `new` draws in, `highlight` and `dim` are styled, nothing animates going back or under reduced motion, and an element's path is the same on every slide. | `Diagram.test.tsx`, `geometry.test.ts`, `sketch.test.tsx`, `Visual.test.tsx` (diagram visual animates only going forward) |
| 7 | Copying: "copy these lines" gives exactly the shown lines; "copy the full program" gives the listing. | `code.test.tsx` |
| 8 | Routes and progress: hash routes open the right slide, progress survives a reload, blocked storage breaks nothing. | `router.test.ts`, `progress.test.ts`, `Deck.test.tsx` |
| 9 | The build is portable: `npm run build` passes on the fixture course, and `dist/` uses relative asset URLs, so it works from a sub-path. | `test_app_build.py` |

The check page itself is tested by `check/findings.test.ts` and `check/CheckPage.test.tsx`.

## Manual

| # | Check | How |
|---|---|---|
| 10 | A real run. | Run the skill on a real `slide-design` deck. Read the Part on a laptop and on a phone. Judge whether the look matches the mockups and whether the diagrams build up clearly. The check page reports no prose overflow. |
| 11 | A real deployment. | Deploy `dist/` to a static host, under a sub-path, and open the link on a phone. |
