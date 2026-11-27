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
    scaffold = _read(skill_dir, "scripts/scaffold.py")
    for flag in re.findall(r"(?<![-\w])(--[a-z][a-z-]*)", text):
        if flag in {"--dir", "--headless", "--screenshot", "--window-size", "--virtual-time-budget", "--dump-dom"}:
            continue
        assert flag in scaffold, f"{flag} is not a scaffold.py option"


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


def test_the_budget_lists_what_the_check_page_counts(skill_dir):
    plan = _read(skill_dir, "references/plan-list.md")
    budgets = plan[plan.index("## The budgets"):plan.index("## Rules for the content")]
    for word in ("notice", "symptom", "cause", "fix", "takeaway", "not code"):
        assert word in budgets, word
