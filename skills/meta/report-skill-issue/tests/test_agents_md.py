import pytest

PRIVACY = "This repo is public: never copy an issue's paths, logs, course content or project code into a commit, a PR or a test fixture."


@pytest.fixture
def root(skill_dir):
    return skill_dir.parents[2]


@pytest.fixture
def agents_md(root):
    return (root / "AGENTS.md").read_text(encoding="utf-8")


def test_claude_md_imports_agents_md(root):
    assert (root / "CLAUDE.md").read_text(encoding="utf-8") == "@AGENTS.md\n"


@pytest.mark.parametrize("needle", ["gh issue view <n> -R ArrayaWongsaita/skills-issues", "Closes ArrayaWongsaita/skills-issues#<n>",
                                    "fix/<skill>-<slug>", "needs-info", "gh issue close <n> -R ArrayaWongsaita/skills-issues",
                                    "## Reporting problems with this skill", "skill-problems.md", PRIVACY])
def test_agents_md_covers_the_fixing_workflow(agents_md, needle):
    assert needle in agents_md


def test_agents_md_lists_every_skill_test_command(root, agents_md):
    suites = [p.parent.relative_to(root).as_posix() for p in root.glob("skills/*/*/tests")]
    assert suites and [s for s in suites if f"pytest {s}/tests" not in agents_md] == []
