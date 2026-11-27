import pytest

import course_md

COURSE = """# Testing basics

Learner: writes React, never tested
Goal: tests a small component alone
Stack: TypeScript, pnpm, a test runner

## Playground

Chapters folder: lessons
Install: pnpm install
Setup check: pnpm test setup-check
Run chapter: pnpm test {folder}

## Outline

| NN | slug | title | practises | builds on | under test | status |
|---|---|---|---|---|---|---|
| 01 | first-render | First render | render, getByText | – | Hello.tsx | pilot |
| 02 | by-role | Find by role | getByRole | 01 | Greeting.tsx | outline |
"""


def test_parse_reads_the_commands_and_every_row():
    course = course_md.parse(COURSE)
    assert course.chapters_dir == "lessons"
    assert course.commands == {"install": "pnpm install", "setup": "pnpm test setup-check", "chapter": "pnpm test {folder}"}
    assert [c.nn for c in course.chapters] == ["01", "02"]
    assert course.chapters[0].status == "pilot" and course.chapters[1].builds_on == "01"


def test_chapter_command_fills_the_placeholders():
    course = course_md.parse(COURSE.replace("pnpm test {folder}", "run {folder} {nn} {slug}"))
    assert course_md.chapter_command(course, course.chapters[0]) == "run lessons/01-first-render 01 first-render"


def test_an_unknown_status_names_the_row():
    with pytest.raises(course_md.CourseError, match=r"02.*done-ish|done-ish.*02"):
        course_md.parse(COURSE.replace("| Greeting.tsx | outline |", "| Greeting.tsx | done-ish |"))


def test_a_missing_command_is_named():
    with pytest.raises(course_md.CourseError, match="Run chapter"):
        course_md.parse(COURSE.replace("Run chapter: pnpm test {folder}\n", ""))


def test_a_slug_that_is_not_lowercase_hyphens_is_refused():
    with pytest.raises(course_md.CourseError, match="By Role"):
        course_md.parse(COURSE.replace("| by-role |", "| By Role |"))


def test_set_status_changes_only_that_cell(tmp_path):
    (tmp_path / "course.md").write_text(COURSE, encoding="utf-8")
    course_md.set_status(tmp_path, "02", "building")
    after = (tmp_path / "course.md").read_text(encoding="utf-8")
    changed = [(a, b) for a, b in zip(COURSE.splitlines(), after.splitlines()) if a != b]
    assert changed == [("| 02 | by-role | Find by role | getByRole | 01 | Greeting.tsx | outline |", "| 02 | by-role | Find by role | getByRole | 01 | Greeting.tsx | building |")]
    assert course_md.read(tmp_path).chapters[1].status == "building"


def test_set_status_refuses_an_unknown_chapter_or_status(tmp_path):
    (tmp_path / "course.md").write_text(COURSE, encoding="utf-8")
    with pytest.raises(course_md.CourseError, match="09"):
        course_md.set_status(tmp_path, "09", "done")
    with pytest.raises(course_md.CourseError, match="finished"):
        course_md.set_status(tmp_path, "01", "finished")


def test_chapter_command_leaves_shell_variables_alone():
    course = course_md.parse(COURSE.replace("pnpm test {folder}", "PORT=${PLAYGROUND_PORT} run {folder} {nn}"))
    assert course_md.chapter_command(course, course.chapters[0]) == "PORT=${PLAYGROUND_PORT} run lessons/01-first-render 01"


def test_run_all_is_optional():
    assert "all" not in course_md.parse(COURSE).commands
    course = course_md.parse(COURSE.replace("Run chapter:", "Run all: pnpm test\nRun chapter:"))
    assert course.commands["all"] == "pnpm test"
