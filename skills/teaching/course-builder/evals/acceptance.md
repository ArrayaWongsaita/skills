# Acceptance checks

What `course-builder` must do, and where each check is tested. The tests build made-up playgrounds in a temporary folder with real git and stack-free commands (`python3` scripts), so they need neither Node nor a network.

```bash
uv run --no-project --python 3.12 --with pytest pytest skills/teaching/course-builder/tests -q
```

| # | Check | Tested in |
|---|---|---|
| 1 | `course.md` gives the three commands and every outline row; a bad status, slug or missing command names the row or the key | `test_course_md.py` |
| 2 | Changing a chapter's status rewrites only that cell | `test_course_md.py` |
| 3 | A chapter on `main` needs one `แนวทาง:` and one `👉` per numbered exercise; `solutions` has no `👉` left; the README names every built chapter | `test_check_structure.py` |
| 4 | Chapters still at `outline` are not checked; CRLF files read like LF | `test_check_structure.py` |
| 5 | The commands run on both branches, each in a temporary worktree; the user's checkout, branch and uncommitted edits are left alone | `test_check_playground.py` |
| 6 | Each chapter run's output is saved for the slides | `test_check_playground.py` |
| 7 | The first commit is made only after the install and the setup check pass, with `main` and `solutions` at it | `test_init_playground.py` |
| 8 | A worker's chapter is committed on both branches only when both pass; nothing moves when either fails | `test_apply_unit.py` |
| 9 | Applying the same chapter twice commits once; a chapter that changes a file the user is editing is refused before anything moves | `test_apply_unit.py` |
| 10 | `--check` runs every check and commits nothing | `test_apply_unit.py` |
| 11 | Every script and flag the skill shows exists; every reference is linked and says who reads it; the worker brief names `course.md`, `pattern.md`, `units/` and asks for `Skill problem:`; the skill never pushes | `test_skill_md.py` |
| 12 | The outline example in `references/outline.md` parses | `test_skill_md.py` |
| 13 | A whole check skips a `building` chapter not applied yet; the README must name every built chapter by its whole folder name, give the setup check and name `solutions`; `Run all:` runs on both branches | `test_check_structure.py`, `test_check_playground.py` |
| 14 | Every command gets its own free `PLAYGROUND_PORT`; a timed-out command leaves no process behind; saved output never shows the temporary worktree | `test_check_playground.py` |
| 15 | `init_playground.py` refuses to commit what the install made unless `.gitignore` leaves it out; `apply_unit.py` names the user's uncommitted changes and reports a missing branch as a message; `finish` changes no status | `test_init_playground.py`, `test_apply_unit.py` |

Checked by hand, on a real course:

- The pilot's chapter, checked with the real test tool: pending on `main` exits 0, `solutions` passes.
- `part-slides` builds chapter 1's slides from `course.md` without an interview, with code from the playground.
