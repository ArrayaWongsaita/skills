import re

from conftest import SKILL_DIR


def _texts():
    return {p.relative_to(SKILL_DIR).as_posix(): p.read_text(encoding="utf-8") for p in [SKILL_DIR / "SKILL.md", *sorted((SKILL_DIR / "references").glob("*.md"))]}


def test_frontmatter_names_the_folder():
    head = (SKILL_DIR / "SKILL.md").read_text(encoding="utf-8").split("---")[1]
    assert re.search(r"^name: course-builder$", head, re.M)
    assert re.search(r"^description: Use when ", head, re.M)


def test_every_script_the_skill_names_exists():
    named = {name for text in _texts().values() for name in re.findall(r"<skill>/scripts/([\w-]+\.py)", text)}
    assert {"course_md.py", "check_playground.py", "init_playground.py", "apply_unit.py"} <= named
    assert [n for n in sorted(named) if not (SKILL_DIR / "scripts" / n).is_file()] == []


def test_every_flag_shown_is_one_the_script_takes():
    for rel, text in _texts().items():
        for line in text.splitlines():
            for script in re.findall(r"<skill>/scripts/([\w-]+\.py)", line):
                source = (SKILL_DIR / "scripts" / script).read_text(encoding="utf-8")
                for flag in re.findall(r"(?<![-\w])(--[a-z][a-z-]*)", line):
                    assert f'"{flag}"' in source, f"{rel}: {flag} is not an option of {script}"


def test_every_reference_starts_with_a_heading_and_says_who_reads_it():
    for path in sorted((SKILL_DIR / "references").glob("*.md")):
        lines = path.read_text(encoding="utf-8").splitlines()
        assert lines[0].startswith("# "), path.name
        assert lines[2].startswith("Read this"), f"{path.name}: line 3 must say when to read it"


def test_skill_md_points_at_every_reference():
    skill = (SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")
    assert [p.name for p in sorted((SKILL_DIR / "references").glob("*.md")) if f"references/{p.name}" not in skill] == []


def test_the_skill_never_pushes():
    texts = _texts()
    assert "never push" in texts["SKILL.md"].lower()
    assert [rel for rel, text in texts.items() if "git push" in text] == []


def test_the_worker_brief_names_the_course_files_and_asks_for_skill_problems():
    waves = (SKILL_DIR / "references" / "waves.md").read_text(encoding="utf-8")
    brief = waves.split("```")[1]
    for needle in ("course.md", "pattern.md", "units/", "--check", "Skill problem:"):
        assert needle in brief, needle


def test_the_outline_reference_shows_the_format_the_parser_reads(tmp_path):
    import course_md

    outline = (SKILL_DIR / "references" / "outline.md").read_text(encoding="utf-8")
    example = re.search(r"```markdown\n(.*?)```", outline, re.S).group(1)
    course = course_md.parse(example)
    assert course.chapters and set(course.commands) == {"install", "setup", "chapter", "all"}


def test_the_worker_brief_keeps_the_worker_away_from_sync_and_the_finish_has_its_own_unit():
    waves = (SKILL_DIR / "references" / "waves.md").read_text(encoding="utf-8")
    brief = waves.split("```")[1]
    assert "--unit <NN>" in brief and "runs/<NN>-solutions.txt" in brief and "check-dist" in brief and "--port <port>" in brief
    assert "exec tsc --noEmit" in brief  # vite build alone does not type-check the slides
    skill = (SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")
    assert "apply_unit.py <course_dir> finish" in skill and "units/finish/" in skill
    assert "PLAYGROUND_PORT" in (SKILL_DIR / "references" / "playground.md").read_text(encoding="utf-8")


def test_the_worker_brief_approves_the_plan_by_pattern_and_saves_real_runs():
    brief = (SKILL_DIR / "references" / "waves.md").read_text(encoding="utf-8").split("```")[1]
    assert "Status: approved (pattern.md)" in brief
    assert "--check --save-output <course_dir>/runs" in brief


def test_the_playground_brief_names_both_kinds_of_exercise_and_readable_failures():
    playground = (SKILL_DIR / "references" / "playground.md").read_text(encoding="utf-8")
    for needle in ("The learner writes the test.", "The learner writes the code, and the checks are given.",
                   "A wrong answer's output must be readable", "never the code to write", "origin/solutions"):
        assert needle in playground, needle
    pilot = (SKILL_DIR / "references" / "pilot-and-pattern.md").read_text(encoding="utf-8")
    assert "No slide shows an exercise's answer" in pilot and 'section: "Closing"' in pilot


def test_the_outline_says_a_chapter_has_one_exercise_file_before_the_user_approves():
    outline = (SKILL_DIR / "references" / "outline.md").read_text(encoding="utf-8")
    proposing = outline.split("## Proposing the outline")[1]
    assert "one exercise file" in proposing and "a file per exercise" in proposing


def test_a_stand_in_names_what_the_folder_is_not_always_the_playground():
    text = (SKILL_DIR / "references" / "playground.md").read_text(encoding="utf-8")
    assert "Never show a folder that is not the playground as `~/playground`" in text


def test_commands_typed_into_a_script_are_the_code_kind_of_exercise():
    text = (SKILL_DIR / "references" / "playground.md").read_text(encoding="utf-8")
    assert "the commands of a command-line tool" in text


def test_a_wave_worker_stops_only_its_own_listening_server():
    brief = (SKILL_DIR / "references" / "waves.md").read_text(encoding="utf-8").split("```")[1]
    assert "lsof -ti tcp:<port> -sTCP:LISTEN" in brief
