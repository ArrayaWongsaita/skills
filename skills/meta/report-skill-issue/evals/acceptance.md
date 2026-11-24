# Acceptance run: report-skill-issue

These are the acceptance checks for the first build of `report-skill-issue`, from spec §7 (`docs/superpowers/specs/2026-11-23-report-skill-issue-design.md`). Checks 1–6 are automated: they run with a fake gh on `PATH` and temporary git repos, and never touch the network. Check 7 needs the real `skills-issues` repository and a human who approves the report.

## Automated checks

Run from the repo root:

```bash
uv run --no-project --python 3.12 --with pytest pytest skills/meta/report-skill-issue/tests -q
```

| # | Check | Tests | Pass condition |
|---|---|---|---|
| 1a | `info` reads a symlinked skill in a checkout of this repo | `test_info.py::test_info_for_a_symlinked_skill`, `test_dirty_only_for_changes_inside_the_skill`, `test_a_branch_commit_is_not_on_main`, `test_on_main_unknown_without_the_ref`, `test_detached_head` | it gives the name, path, commit, dirty state, branch and `on_main` |
| 1b | `info` accepts only this repo | `test_origin_forms_accepted`, `test_origin_look_alikes_refused`, `test_other_repo_refused`, `test_copied_install_needs_confirmation` | another repo's checkout is refused, naming its remote; a copy needs `--allow-copy` |
| 2a | `draft` renders the issue | `test_draft.py::test_render_title_labels_and_sections`, `test_kind_labels_optional_fix_and_model`, `test_evidence_fence_longer_than_its_content` | the title, labels and sections are in the spec's order |
| 2b | `draft` refuses an incomplete entry | `test_entry_is_validated` | the error names the missing fields |
| 2c | `draft` redacts secrets | `test_secrets_scan.py`, `test_draft_is_scrubbed_and_hashed` | each secret kind, the reporter's own secret values and the home path are gone |
| 3a | `post` sends exactly the draft | `test_gh.py::test_post_files_exactly_the_draft`, `test_existing_labels_are_not_recreated` | the fake gh gets the draft's title, labels and body; a missing `skill:` label is created |
| 3b | `post` refuses a changed or leaky draft | `test_changed_draft_is_refused`, `test_remaining_secret_is_refused` | no issue is created |
| 3c | `post` keeps the draft when gh fails | `test_cli_keeps_the_draft_when_gh_fails`, `test_gh_missing`, `test_not_logged_in` | exit 1, a clear reason, and the draft is still on disk |
| 3d | `post` can comment instead | `test_comment_mode` | `gh issue comment N` gets the body |
| 4 | `similar` searches the skill's issues | `test_similar_lists_open_first` | it passes the skill's label and the words; closed matches come after open ones |
| 5 | Every skill has the reporting hook | `test_repo_hooks.py::test_every_skill_has_the_reporting_hook` | each `skills/*/*/SKILL.md` has `## Reporting problems with this skill` |
| 6 | A skill that hands work to subagents asks each for a `Skill problem:` line | none now: `part-slides` writes everything itself and has no subagent briefs | a skill that adds briefs adds this check to its own tests |

## Manual check

7. **A real report, then a real fix:**
   1. Check that the private repository exists: `gh repo view ArrayaWongsaita/skills-issues --json visibility` prints `PRIVATE`.
   2. Install `report-skill-issue` next to the skill you will run, as a symlink into a checkout of this repo that stays on `main`.
   3. Run `part-slides` on a real course. Note a problem it meets, or provoke one. At the end, the agent offers the report once.
   4. Approve the report. Check the issue in `skills-issues`:
      - the title is `[<skill>] …`
      - it has the kind label and `skill:<name>`
      - its Skill line names the commit that ran
      - it has no secret
   5. Check that the run's `skill-problems.md` line now ends with ` → <issue URL>`.
   6. Report the same problem again. The agent finds the open issue with `similar` and proposes a comment instead.
   7. In this repo, ask an agent to fix the issue by following `AGENTS.md`. Its PR description says `Closes ArrayaWongsaita/skills-issues#<n>`. After the merge, check two things:
      - **The issue is closed.** If it is still open, close it with `gh issue close`, and keep the `AGENTS.md` step that does so.
      - **Nothing private leaked.** The PR, its commits and its test fixtures carry no path, log or content from the issue.
