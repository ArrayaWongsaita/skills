# Acceptance run: LangChain + LangGraph

The first end-to-end run of `course-research`, from spec §8 (`docs/superpowers/specs/2026-11-22-course-research-skill-design.md`). It needs a human: the user answers the scope interview and approves the outline.

## Recipe

1. Make the skill loadable in Claude Code (with the user's OK): `ln -s "$PWD/skills/teaching/course-research" ~/.claude/skills/course-research`, or install it with `npx skills add`.
2. In a throwaway working directory, ask for a course on **LangChain + LangGraph** for **self-paced** learners, in **Thai**, size **small** (1–3 Parts), to keep the cost down.
3. Once Stage 4 has started, interrupt the run, then invoke the skill again on the same topic.
4. Let it finish, then run the checks below from the repo root (`<course_dir>` is `<run dir>/courses/<slug>`):

```bash
python3 skills/teaching/course-research/scripts/validate_course.py <course_dir>             # expect exit 0
python3 skills/teaching/course-research/scripts/code_check/check_code.py <course_dir>       # expect exit 0 or 2
grep -n "create_react_agent\|LLMChain\|initialize_agent" <course_dir>/part-*.md            # inspect every hit
```

## Checks

| # | Check | How to verify | Result | Evidence |
|---|---|---|---|---|
| 1 | Scope questions come first, and the stage ends with numbered, observable outcomes | Transcript; `_work/scope.md` outcomes use `O1..On` with action verbs | | |
| 2 | It stops at the outline and does not start deep research without approval | Transcript; `_work/research/parts/` is empty until approval | | |
| 3 | Every Part file has the frontmatter and fixed headings, and stands alone | `validate_course.py` exit 0; read one Part with no other Part open | | |
| 4 | No deprecated API appears as current practice; where one appears, it sits under Misconceptions as outdated code to recognise | Every `grep` hit is under `#### Misconceptions` | | |
| 5 | Code examples run on the pinned versions; failures are marked, not hidden | `check_code.py` exit 0 or 2; every unverified snippet has a reason and a `> ⚠️ Unverified:` line | | |
| 6 | Every factual claim carries a source; the overview records versions and the research date | Consistency review reply; `00-overview.md` frontmatter and `## Freshness` | | |
| 7 | An interrupted run continues from `state.md` | After step 3, `course_state.py show` matches where the run stopped, and the skill continues from there | | |

## Notes from the run

<What surprised you, what the user changed at the gates, the cost (tokens or time), and the follow-ups.>
