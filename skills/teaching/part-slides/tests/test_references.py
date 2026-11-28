import re


def _read(skill_dir, rel):
    return (skill_dir / rel).read_text(encoding="utf-8")


def test_slides_md_names_every_layout_and_figure_of_the_template(skill_dir):
    slides = _read(skill_dir, "references/slides.md")
    layouts = re.findall(r"^export function (\w+)\(", _read(skill_dir, "template/src/components/layouts.tsx"), re.M)
    figures = re.findall(r"^export function (\w+)\(", _read(skill_dir, "template/src/components/figures.tsx"), re.M)
    assert len(layouts) >= 20 and len(figures) == 7
    missing = [name for name in [*layouts, *figures] if name != "Field" and f"`{name}`" not in slides]
    assert missing == []


def test_plan_list_md_states_the_budgets_the_check_page_enforces(skill_dir):
    constants = dict(re.findall(r"^export const (\w+) = (\d+);", _read(skill_dir, "template/src/check/budgets.ts"), re.M))
    line = (
        f"<!-- budgets: topic {constants['TOPIC_MAX']} · opening {constants['OPENING_MAX']} · part {constants['PART_MAX']} "
        f"· note {constants['PART_NOTE_FROM']} · prose th {constants['PROSE_MAX_THAI']} · prose other {constants['PROSE_MAX_OTHER']} -->"
    )
    assert line in _read(skill_dir, "references/plan-list.md")


def test_every_reference_starts_with_a_heading_and_says_who_reads_it(skill_dir):
    for path in sorted((skill_dir / "references").glob("*.md")):
        lines = path.read_text(encoding="utf-8").splitlines()
        assert lines[0].startswith("# "), path.name
        assert lines[2].startswith("Read this"), f"{path.name}: line 3 must say when to read it"


def test_the_briefs_name_the_commands_the_scripts_really_have(skill_dir):
    text = _read(skill_dir, "SKILL.md") + _read(skill_dir, "references/check-and-revise.md")
    for flag in ("--part", "--slug", "--part-title", "--sync-count", "--language", "--title"):
        assert flag in text, flag
    # A flag is checked against the script named on its line: sync_listings.py when it is named, else scaffold.py.
    for line in text.splitlines():
        script = next((name for name in ("sync_listings.py", "screenshots.mjs") if name in line), "scaffold.py")
        source = _read(skill_dir, "template/scripts/screenshots.mjs" if script == "screenshots.mjs" else f"scripts/{script}")
        quote = "'" if script == "screenshots.mjs" else '"'
        for flag in re.findall(r"(?<![-\w])(--[a-z][a-zA-Z-]*)", line):
            if flag in {"--dir", "--strictPort", "--port", "--headless", "--screenshot", "--window-size", "--virtual-time-budget", "--dump-dom", "--force-prefers-reduced-motion"}:
                continue
            assert f"{quote}{flag}{quote}" in source, f"{flag} is not a {script} option"


def test_a_part_with_a_playground_takes_its_code_from_sync_listings(skill_dir):
    slides = _read(skill_dir, "references/slides.md")
    for needle in ("sync_listings.py", "part-NN.sources.json", "...playgroundListings", "playgroundOutputs", "never edit that file"):
        assert needle in slides, needle
    assert "sync_listings.py <course_dir> --part <N> --check" in _read(skill_dir, "references/check-and-revise.md")


def test_the_briefs_say_to_number_slides_in_the_order_they_run_and_to_renumber(skill_dir):
    plan = _read(skill_dir, "references/plan-list.md")
    assert "in the order the slides run" in plan and "renumber" in plan
    assert "renumber" in _read(skill_dir, "references/slides.md")
    assert "`id-order`" in _read(skill_dir, "references/check-and-revise.md")
    # An Answer's `revisit` names a slide by id, so a renumber that leaves it alone sends the learner to the wrong slide.
    slides = _read(skill_dir, "references/slides.md")
    assert "update every `revisit` that names a renumbered id" in slides and "update every `revisit` that names a renumbered id" in plan
    assert "renumber the plan rows the same way" in slides


def test_slides_md_says_how_long_an_anatomy_piece_may_be(skill_dir):
    slides = _read(skill_dir, "references/slides.md")
    assert "cut a longer call into more pieces" in slides
    assert "does not count toward the slide's text" in slides


def test_slides_md_says_never_to_put_a_label_on_a_hachure_fill(skill_dir):
    slides = _read(skill_dir, "references/slides.md")
    assert "never put a label on a hachure fill" in slides.lower()
    assert "`fillOpacity`" in slides


def test_the_preview_refuses_a_busy_port(skill_dir):
    check = _read(skill_dir, "references/check-and-revise.md")
    assert "--strictPort" in check and "`course`" in check


def test_the_plan_says_a_two_idea_topic_is_two_topics(skill_dir):
    plan = _read(skill_dir, "references/plan-list.md")
    shape = plan[plan.index("## What a Part looks like"):plan.index("## The budgets")]
    assert "two ideas" in shape and "two topics" in shape


def test_the_plan_says_what_to_do_when_parts_exceed_the_cap(skill_dir):
    plan = _read(skill_dir, "references/plan-list.md")
    parts = next(line for line in plan.splitlines() if "**parts**" in line)
    assert "merge" in parts and "split the topic" in parts


def test_the_budget_lists_what_the_check_page_counts(skill_dir):
    plan = _read(skill_dir, "references/plan-list.md")
    budgets = plan[plan.index("## The budgets"):plan.index("## Rules for the content")]
    for word in ("notice", "symptom", "cause", "fix", "takeaway", "not a code block"):
        assert word in budgets, word


def test_screenshots_have_one_folder_and_wait_for_a_settled_slide(skill_dir):
    check = _read(skill_dir, "references/check-and-revise.md")
    assert "`<work>/screenshots/`" in check and "web/scripts/screenshots.mjs" in check  # no browser tool needed
    script = _read(skill_dir, "template/scripts/screenshots.mjs")
    assert "prefers-reduced-motion" in script and "document.fonts.ready" in script
    assert "clipped-text" in check and "outputLines" in _read(skill_dir, "references/slides.md")


def test_the_text_budget_says_inline_code_counts(skill_dir):
    assert "Inline code in a sentence (`<C>`) counts" in _read(skill_dir, "references/plan-list.md")


def test_slides_warn_that_a_line_number_excerpt_moves(skill_dir):
    assert "pick a line that can move by its text with `has:`" in _read(skill_dir, "references/slides.md")


def test_the_check_reference_explains_split_piece(skill_dir):
    assert "`split-piece`" in _read(skill_dir, "references/check-and-revise.md")
