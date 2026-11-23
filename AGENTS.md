# Working in this repo

This repo holds Agent Skills. Agents run them in other projects, and problems found in those runs come back as issues in the private repo `ArrayaWongsaita/skills-issues`.

## Layout

Each skill lives in `skills/<category>/<name>/`:
- `SKILL.md`: the skill. Its frontmatter `name` matches the folder name.
- `references/`: the briefs and contracts that `SKILL.md` links to.
- `scripts/`: stdlib Python, 3.11 or later. Each script puts its own folder on `sys.path`.
- `tests/`: pytest. `conftest.py` puts `scripts/` on `sys.path`.
- `template/` (react-slides only): the React app the skill copies into a course, with its own vitest tests.
- `evals/acceptance.md`: the acceptance checks.

Designs and implementation plans are in `docs/superpowers/specs/` and `docs/superpowers/plans/`.

Skills are installed as symlinks from `~/.claude/skills/<name>` into a checkout of this repo. Point them at a checkout that stays on `main`. A checkout that switches branches changes which code the installed skill runs.

## Tests

Run the tests of every skill you change, from the repo root:

```bash
# course-research
uv run --no-project --python 3.12 --with pytest --with langchain==1.5.2 --with langgraph==1.2.24 --with langchain-openai==1.8.5 --with python-dotenv==1.2.4 pytest skills/teaching/course-research/tests -q
# slide-design
uv run --no-project --python 3.12 --with pytest pytest skills/teaching/slide-design/tests -q
# report-skill-issue
uv run --no-project --python 3.12 --with pytest pytest skills/meta/report-skill-issue/tests -q
# react-slides: run the npm lines first; its end-to-end pytest needs the template's node_modules
npm --prefix skills/teaching/react-slides/template ci && npm --prefix skills/teaching/react-slides/template test && npm --prefix skills/teaching/react-slides/template run build
uv run --no-project --python 3.12 --with pytest pytest skills/teaching/react-slides/tests -q
```

Tests never call GitHub or a model provider.

## Conventions

- **Language:** code, comments, docs, commit messages and issues are in English.
- **Commits:** use Conventional Commits with the skill as the scope, such as `fix(slide-design): …` or `feat(report-skill-issue): …`. Make one commit per change.

## A new skill

Every skill has a `## Reporting problems with this skill` section, so the problems found in real runs reach `skills-issues`. Use the text below. Put the skill's own work folder in place of `<work folder>`. A skill without a work folder keeps the list in the conversation instead.

```markdown
## Reporting problems with this skill

When something in this skill goes wrong or does not fit (a script error, a validator error that was wrong, a brief that misled a subagent, a limit or rule that did not fit real content), append one line to `<work folder>/skill-problems.md` as soon as you see it:

`- <bug|improvement|docs> · <what happened> · <where: the script, brief or rule> · <stage>`

A subagent's `Skill problem:` line goes in too. On resume, read the file first. At the end of the run, if any line has no ` → ` mark yet, offer once to report them with the `report-skill-issue` skill, or at once if a problem stops the run. Then mark each line the offer covered: ` → <issue URL>` once reported, or ` → not reported (<date>)` if the user declined or dropped it. A marked line is never offered again. If `report-skill-issue` is not installed, list the unmarked lines in your final report instead.
```

Each subagent brief asks for a `Skill problem: <what got in the way, and where>` line in its reply, when something in the brief, a script or a template got in the subagent's way.

`skills/meta/report-skill-issue/tests/test_repo_hooks.py` checks that every `SKILL.md` has the section.

## Fixing an issue from `skills-issues`

The `report-skill-issue` skill files these issues. Each one names the skill, the commit that ran, the steps to reproduce and the evidence.

1. **Read the issue:**

   ```bash
   gh issue view <n> -R ArrayaWongsaita/skills-issues --comments
   ```

2. **Work against `main`,** wherever the reported commit is. The issue's `Skill` line says whether the report came from a branch or from a commit that is not on `main`.

3. **Reproduce the problem as a failing test** in the skill's `tests/`, with a minimal, made-up input. If it cannot be reproduced on `main`, ask for what is missing and stop:
   1. On first use only, create the label:

      ```bash
      gh label create needs-info -R ArrayaWongsaita/skills-issues --color d4c5f9 --description "Needs more information to reproduce"
      ```

   2. Label the issue:

      ```bash
      gh issue edit <n> -R ArrayaWongsaita/skills-issues --add-label needs-info
      ```

   3. Comment on the issue with what is missing.

4. **Fix it** on a branch named `fix/<skill>-<slug>`, with a slug in your own words, and run the skill's test command.

5. **Open a PR to `main`** whose description says `Closes ArrayaWongsaita/skills-issues#<n>`.

6. **Link the PR from the issue:**

   ```bash
   gh issue comment <n> -R ArrayaWongsaita/skills-issues --body "Fix: <PR URL>"
   ```

7. **After the merge, if the issue is still open,** close it:

   ```bash
   gh issue close <n> -R ArrayaWongsaita/skills-issues --comment "Fixed in <PR URL>"
   ```

**Privacy:** This repo is public: never copy an issue's paths, logs, course content or project code into a branch name, a commit, a PR or a test fixture.
- Write a minimal, made-up reproduction instead.
- Describe the problem in your own words.
- Refer to the issue only by its number.
