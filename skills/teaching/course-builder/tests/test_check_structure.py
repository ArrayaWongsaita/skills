from pathlib import Path

import check_playground as cp
import course_md

EXERCISE = """// ================================================
// บทที่ 01: เรื่องแรก
// ฝึก: something
// ตัวอย่าง:
//   example();
// ================================================

// ข้อ 1: แรก
// แนวทาง: ลองแบบนี้
test.todo("one");
// 👉 เขียน test ของข้อ 1 ตรงนี้

// ข้อ 2: สอง
// แนวทาง: ลองแบบนั้น
test.todo("two");
// 👉 เขียน test ของข้อ 2 ตรงนี้

// ข้อ 3: สาม
// แนวทาง: ลองอีกแบบ
test.todo("three");
// 👉 เขียน test ของข้อ 3 ตรงนี้
"""
SOLVED = EXERCISE.replace('test.todo("one");\n// 👉 เขียน test ของข้อ 1 ตรงนี้', 'test("one", () => {});').replace(
    'test.todo("two");\n// 👉 เขียน test ของข้อ 2 ตรงนี้', 'test("two", () => {});').replace(
    'test.todo("three");\n// 👉 เขียน test ของข้อ 3 ตรงนี้', 'test("three", () => {});')


def course(*rows: tuple[str, str, str]) -> course_md.Course:
    chapters = [course_md.Chapter(nn, slug, "t", "p", "–", "x", status) for nn, slug, status in rows]
    return course_md.Course(chapters_dir="lessons", commands={"install": "true", "setup": "true", "chapter": "true"}, chapters=chapters)


def make_tree(root: Path, chapters: dict[str, str], readme: str) -> Path:
    for folder, text in chapters.items():
        (root / "lessons" / folder).mkdir(parents=True)
        (root / "lessons" / folder / "thing.test.ts").write_text(text, encoding="utf-8", newline="")
        (root / "lessons" / folder / "thing.ts").write_text("export const x = 1;\n", encoding="utf-8")
    (root / "README.md").write_text(readme, encoding="utf-8")
    return root


def test_a_well_formed_main_tree_has_no_findings(tmp_path):
    root = make_tree(tmp_path, {"01-first": EXERCISE}, "| 01 | `01-first` |")
    assert cp.check_tree(root, course(("01", "first", "pilot")), "main") == []


def test_a_well_formed_solutions_tree_has_no_findings(tmp_path):
    root = make_tree(tmp_path, {"01-first": SOLVED}, "| 01 | `01-first` |")
    assert cp.check_tree(root, course(("01", "first", "pilot")), "solutions") == []


def test_a_missing_marker_is_an_exercise_shape_finding(tmp_path):
    broken = EXERCISE.replace("// 👉 เขียน test ของข้อ 3 ตรงนี้\n", "")
    root = make_tree(tmp_path, {"01-first": broken}, "01-first")
    [finding] = cp.check_tree(root, course(("01", "first", "pilot")), "main")
    assert (finding.kind, finding.chapter, finding.branch) == ("exercise-shape", "01", "main")
    assert "3 exercises, 3 hints, 2 markers" in finding.detail


def test_a_marker_left_on_solutions_is_named(tmp_path):
    root = make_tree(tmp_path, {"01-first": EXERCISE}, "01-first")
    [finding] = cp.check_tree(root, course(("01", "first", "pilot")), "solutions")
    assert (finding.kind, finding.chapter, finding.branch) == ("leftover-marker", "01", "solutions")


def test_unbuilt_chapters_are_not_checked(tmp_path):
    root = make_tree(tmp_path, {"01-first": EXERCISE}, "01-first")
    assert cp.check_tree(root, course(("01", "first", "pilot"), ("02", "second", "outline")), "main") == []


def test_a_missing_folder_and_a_missing_exercise_are_named(tmp_path):
    root = make_tree(tmp_path, {"01-first": "no exercises here\n"}, "01-first 02-second")
    kinds = sorted((f.kind, f.chapter) for f in cp.check_tree(root, course(("01", "first", "pilot"), ("02", "second", "review")), "main"))
    assert kinds == [("missing-folder", "02"), ("no-exercise", "01")]


def test_the_readme_must_name_every_built_chapter(tmp_path):
    root = make_tree(tmp_path, {"01-first": EXERCISE, "02-second": EXERCISE}, "only 01-first here")
    [finding] = cp.check_tree(root, course(("01", "first", "done"), ("02", "second", "review")), "main")
    assert finding.kind == "readme" and "02-second" in finding.detail


def test_crlf_exercise_file_is_read_like_lf(tmp_path):
    root = make_tree(tmp_path, {"01-first": EXERCISE.replace("\n", "\r\n")}, "01-first")
    assert cp.check_tree(root, course(("01", "first", "pilot")), "main") == []
    assert cp.exercise_shape(EXERCISE.replace("\n", "\r\n")) == (3, 3, 3)


def test_only_checks_one_chapter(tmp_path):
    root = make_tree(tmp_path, {"01-first": "broken\n", "02-second": EXERCISE}, "01-first 02-second")
    assert cp.check_tree(root, course(("01", "first", "done"), ("02", "second", "building")), "main", only="02") == []


def test_a_finding_prints_as_one_line():
    assert cp.Finding("run-failed", "01", "main", "exit 1").line() == "run-failed 01 main: exit 1"
    assert cp.Finding("readme", None, "main", "x").line() == "readme - main: x"


def test_solutions_copies_in_a_dot_folder_are_not_the_exercise_file(tmp_path):
    root = make_tree(tmp_path, {"01-first": EXERCISE}, "01-first")
    (root / "lessons" / "01-first" / ".solutions").mkdir()
    (root / "lessons" / "01-first" / ".solutions" / "a.test.ts").write_text(SOLVED, encoding="utf-8")
    assert cp.check_tree(root, course(("01", "first", "pilot")), "main") == []


def test_a_building_chapter_not_applied_yet_is_not_a_missing_folder(tmp_path):
    root = make_tree(tmp_path, {"01-first": EXERCISE}, "01-first 02-second")
    assert cp.check_tree(root, course(("01", "first", "done"), ("02", "second", "building")), "main") == []
    [finding] = cp.check_tree(root, course(("01", "first", "done"), ("02", "second", "review")), "main")
    assert finding.kind == "missing-folder"


def test_the_readme_check_matches_whole_folder_names(tmp_path):
    root = make_tree(tmp_path, {"01-intro": EXERCISE}, "| 101-intro |")
    [finding] = cp.check_tree(root, course(("01", "intro", "pilot")), "main")
    assert finding.kind == "readme" and "01-intro" in finding.detail


def test_one_chapter_check_still_needs_every_built_chapter_in_the_readme(tmp_path):
    root = make_tree(tmp_path, {"01-first": EXERCISE, "02-second": EXERCISE}, "only 02-second")
    [finding] = cp.check_tree(root, course(("01", "first", "done"), ("02", "second", "building")), "main", only="02")
    assert finding.kind == "readme" and "01-first" in finding.detail


def test_the_readme_must_name_the_setup_check_and_the_solutions_branch(tmp_path):
    c = course(("01", "first", "pilot"))
    c.commands["setup"] = "pnpm test setup-check"
    root = make_tree(tmp_path, {"01-first": EXERCISE}, "01-first")
    kinds = [f.detail for f in cp.check_tree(root, c, "main", readme_sections=True)]
    assert any("pnpm test setup-check" in d for d in kinds) and any("solutions" in d for d in kinds)


def _readme_details(tmp_path, readme):
    c = course(("01", "first", "pilot"))
    root = make_tree(tmp_path, {"01-first": EXERCISE}, f"`true` first. 01-first\n{readme}\n")
    return [f.detail for f in cp.check_tree(root, c, "main", readme_sections=True)]


def test_the_readme_may_not_switch_to_solutions_without_a_stash(tmp_path):
    [detail] = _readme_details(tmp_path, "Answers: `git switch solutions`")
    assert "git switch solutions" in detail and "stash" in detail


def test_the_readme_may_not_read_a_local_solutions_branch_a_clone_does_not_have(tmp_path):
    details = _readme_details(tmp_path, "`git show solutions:lessons/01-first/thing.test.ts`\n`git diff main solutions -- lessons/01-first`")
    assert len(details) == 2 and all("origin/solutions" in d for d in details)


def test_the_readme_forms_that_work_in_a_learners_clone_pass(tmp_path):
    readme = ("`git show origin/solutions:lessons/01-first/thing.test.ts`\n"
              "`git diff main origin/solutions -- lessons/01-first`\n"
              "`git stash` then `git switch solutions`, and `git switch main` then `git stash pop`")
    assert _readme_details(tmp_path, readme) == []
