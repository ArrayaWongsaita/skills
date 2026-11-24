import json
import subprocess
from pathlib import Path

import pytest

import scaffold
from conftest import TEMPLATE


def run(course: Path, template: Path, **kwargs) -> dict:
    options = dict(title=None, language=None, part=None, slug=None, part_title=None, skip_install=True, template_dir=template)
    options.update(kwargs)
    return scaffold.run(course, **options)


def test_creates_the_app_without_node_modules_dist_fixtures_or_tests(tmp_path, mini_template):
    course = tmp_path / "courses" / "ml-basics"
    report = run(course, mini_template)
    web = course / "web"
    assert (web / "package.json").is_file() and (web / "src/main.tsx").is_file() and (web / "src/components/Deck.tsx").is_file()
    for left_out in ("node_modules", "dist", "src/__fixtures__", "src/components/Deck.test.tsx", ".DS_Store"):
        assert not (web / left_out).exists(), left_out
    assert "web/src/main.tsx" in report["created"] and report["skipped"] == []
    assert report["install"] == "skipped"


def test_writes_course_ts_with_the_slug_and_title(tmp_path, mini_template):
    course = tmp_path / "courses" / "ml-basics"
    run(course, mini_template, title="Machine Learning: the basics")
    assert (course / "web/src/course.ts").read_text(encoding="utf-8") == (
        '// Written once by part-slides. It is yours: the skill never overwrites it.\n'
        'export const course = { slug: "ml-basics", title: "Machine Learning: the basics" };\n'
    )


def test_title_defaults_to_the_folder_name(tmp_path, mini_template):
    course = tmp_path / "courses" / "ml-basics"
    run(course, mini_template)
    assert '"title": ' not in (course / "web/src/course.ts").read_text(encoding="utf-8")
    assert 'title: "ml-basics"' in (course / "web/src/course.ts").read_text(encoding="utf-8")


def test_a_second_run_creates_nothing_and_keeps_an_edited_file(tmp_path, mini_template):
    course = tmp_path / "courses" / "ml-basics"
    run(course, mini_template)
    edited = course / "web/src/components/Deck.tsx"
    edited.write_text("// my edit\n", encoding="utf-8")
    second = run(course, mini_template)
    assert second["created"] == []
    assert "web/src/components/Deck.tsx" in second["skipped"]
    assert edited.read_text(encoding="utf-8") == "// my edit\n"


def test_part_creates_the_work_folder_and_the_skeleton_files(tmp_path, mini_template):
    course = tmp_path / "courses" / "ml-basics"
    report = run(course, mini_template, part=1, slug="what-is-ml", part_title='What is "ML"? <b>', language="th")
    assert (course / "parts/01-what-is-ml").is_dir()
    tsx = (course / "web/src/parts/part-01.tsx").read_text(encoding="utf-8")
    data = (course / "web/src/parts/part-01.data.ts").read_text(encoding="utf-8")
    assert "export default function Part01()" in tsx and "<Deck " in tsx and 'section="Opening"' in tsx
    assert '{"What is \\"ML\\"? <b>"}' in tsx  # the title is a JSON string literal, safe in JSX
    assert 'export const meta: PartMeta = {' in data and '"language": "th"' in data and '"part": 1' in data and '"slideCount": 1' in data
    assert '"slug": "what-is-ml"' in data and '"course": "ml-basics"' in data
    assert "web/src/parts/part-01.tsx" in report["created"] and "parts/01-what-is-ml" in report["created"]


def test_part_numbers_are_padded_below_ten_only(tmp_path, mini_template):
    course = tmp_path / "courses" / "c"
    run(course, mini_template, part=3, slug="a-b", part_title="t")
    run(course, mini_template, part=10, slug="c-d", part_title="t")
    assert (course / "web/src/parts/part-03.tsx").is_file() and (course / "web/src/parts/part-10.tsx").is_file()
    assert (course / "parts/03-a-b").is_dir() and (course / "parts/10-c-d").is_dir()


def test_an_existing_part_file_is_skipped(tmp_path, mini_template):
    course = tmp_path / "courses" / "c"
    run(course, mini_template, part=1, slug="a", part_title="t")
    (course / "web/src/parts/part-01.tsx").write_text("// mine\n", encoding="utf-8")
    report = run(course, mini_template, part=1, slug="a", part_title="t")
    assert "web/src/parts/part-01.tsx" in report["skipped"]
    assert (course / "web/src/parts/part-01.tsx").read_text(encoding="utf-8") == "// mine\n"


@pytest.mark.parametrize("kwargs", [dict(part=0, slug="a", part_title="t"), dict(part=1, slug="Bad Slug", part_title="t"), dict(part=1, slug="a"), dict(part=1, part_title="t")])
def test_a_bad_part_request_is_refused_before_anything_is_written(tmp_path, mini_template, kwargs):
    course = tmp_path / "courses" / "c"
    with pytest.raises(scaffold.ScaffoldError):
        run(course, mini_template, **kwargs)
    assert not course.exists()


def test_install_runs_only_when_node_modules_is_missing(tmp_path, mini_template, monkeypatch):
    calls = []
    monkeypatch.setattr(scaffold, "_run", lambda cmd, cwd: calls.append((cmd, cwd)) or subprocess.CompletedProcess(cmd, 0, "", ""))
    monkeypatch.setattr(scaffold.shutil, "which", lambda name: "/usr/bin/npm")
    course = tmp_path / "courses" / "c"
    assert run(course, mini_template, skip_install=False)["install"] == "ran"
    assert calls == [(["npm", "install"], course / "web")]
    (course / "web/node_modules").mkdir()
    assert run(course, mini_template, skip_install=False)["install"] == "not-needed"
    assert len(calls) == 1


def test_a_failed_install_is_reported_and_npm_missing_is_an_error(tmp_path, mini_template, monkeypatch):
    monkeypatch.setattr(scaffold, "_run", lambda cmd, cwd: subprocess.CompletedProcess(cmd, 1, "boom\nnetwork down", ""))
    monkeypatch.setattr(scaffold.shutil, "which", lambda name: "/usr/bin/npm")
    report = run(tmp_path / "courses" / "c", mini_template, skip_install=False)
    assert report["install"] == "failed" and "network down" in report["install_error"]
    monkeypatch.setattr(scaffold.shutil, "which", lambda name: None)
    with pytest.raises(scaffold.ScaffoldError, match="Node.js"):
        run(tmp_path / "courses" / "d", mini_template, skip_install=False)


def test_sync_count_sets_slide_count_from_the_slide_ids(tmp_path, mini_template):
    course = tmp_path / "courses" / "c"
    run(course, mini_template, part=2, slug="a", part_title="t")
    tsx = course / "web/src/parts/part-02.tsx"
    tsx.write_text('<Cover id="2-001" />\n<Explain id="2-002" visual={<svg id="not-a-slide" />} />\n<Topic id="2-003" />\n<Topic id="2-003" />\n<A id="1-009" />\n', encoding="utf-8")
    assert scaffold.sync_count(course, 2) == 3  # 2-001, 2-002, 2-003; a repeated id and another Part's id do not count
    assert '"slideCount": 3' in (course / "web/src/parts/part-02.data.ts").read_text(encoding="utf-8")
    assert scaffold.sync_count(course, 2) == 3
    with pytest.raises(scaffold.ScaffoldError):
        scaffold.sync_count(course, 9)


def test_main_prints_the_report_as_json_and_returns_one_on_an_error(tmp_path, mini_template, capsys, monkeypatch):
    monkeypatch.setattr(scaffold, "TEMPLATE_DIR", mini_template)
    assert scaffold.main([str(tmp_path / "courses" / "c"), "--skip-install", "--part", "1", "--slug", "a", "--part-title", "t"]) == 0
    assert "web/src/parts/part-01.tsx" in json.loads(capsys.readouterr().out)["created"]
    assert scaffold.main([str(tmp_path / "courses" / "d"), "--skip-install", "--part", "0", "--slug", "a", "--part-title", "t"]) == 1
    captured = capsys.readouterr()
    assert captured.out == "" and captured.err.startswith("error:")


def test_the_real_template_scaffolds_without_tests_or_fixtures(tmp_path):
    report = scaffold.run(tmp_path / "courses" / "c", title=None, language=None, part=None, slug=None, part_title=None, skip_install=True, template_dir=TEMPLATE)
    names = report["created"]
    assert "web/src/components/layouts.tsx" in names and "web/package.json" in names and "web/src/check/CheckPage.tsx" in names
    assert [n for n in names if n.endswith((".test.ts", ".test.tsx")) or "__fixtures__" in n or "node_modules" in n] == []
