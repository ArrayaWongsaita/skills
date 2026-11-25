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
    assert second["created"] == [] and second["updated"] == []
    assert "web/src/components/Deck.tsx" in second["kept"]
    assert "web/src/main.tsx" in second["skipped"]
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
    monkeypatch.setattr(scaffold.shutil, "which", lambda name: f"/usr/bin/{name}")
    course = tmp_path / "courses" / "c"
    assert run(course, mini_template, skip_install=False)["install"] == "ran"
    assert calls == [(["pnpm", "install"], course / "web")]
    (course / "web/node_modules").mkdir()
    assert run(course, mini_template, skip_install=False)["install"] == "not-needed"
    assert len(calls) == 1


def test_a_failed_install_is_reported_and_pnpm_missing_is_an_error(tmp_path, mini_template, monkeypatch):
    monkeypatch.setattr(scaffold, "_run", lambda cmd, cwd: subprocess.CompletedProcess(cmd, 1, "boom\nnetwork down", ""))
    monkeypatch.setattr(scaffold.shutil, "which", lambda name: f"/usr/bin/{name}")
    report = run(tmp_path / "courses" / "c", mini_template, skip_install=False)
    assert report["install"] == "failed" and "network down" in report["install_error"]
    monkeypatch.setattr(scaffold.shutil, "which", lambda name: None)
    with pytest.raises(scaffold.ScaffoldError, match="pnpm"):
        run(tmp_path / "courses" / "d", mini_template, skip_install=False)


def test_the_real_template_is_locked_with_pnpm_and_a_course_gets_the_lockfile():
    assert (TEMPLATE / "pnpm-lock.yaml").is_file()
    assert not (TEMPLATE / "package-lock.json").exists()
    assert "pnpm-lock.yaml" in scaffold.template_files(TEMPLATE)


def test_a_course_gets_the_default_icon_the_user_can_replace():
    files = scaffold.template_files(TEMPLATE)
    assert "src/assets/icon.svg" in files
    assert files["src/assets/icon.svg"].lstrip().startswith("<svg")


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


def test_sync_count_says_it_takes_the_part_number_when_given_a_number_with_no_part(tmp_path, mini_template):
    course = tmp_path / "courses" / "c"
    run(course, mini_template, part=1, slug="a", part_title="t")
    with pytest.raises(scaffold.ScaffoldError, match="Part number"):
        scaffold.sync_count(course, 32)  # an agent once passed the slide count, 32, here


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


@pytest.mark.parametrize("written", ["slideCount: 7", "'slideCount': 7", '"slideCount":7'])
def test_sync_count_also_reads_a_data_file_written_by_hand(tmp_path, mini_template, written):
    course = tmp_path / "courses" / "c"
    run(course, mini_template, part=1, slug="a", part_title="t")
    (course / "web/src/parts/part-01.tsx").write_text('<Cover id="1-001" /><Topic id="1-002" />', encoding="utf-8")
    data = course / "web/src/parts/part-01.data.ts"
    data.write_text(f"export const meta = {{ part: 1, {written} }};\n", encoding="utf-8")
    assert scaffold.sync_count(course, 1) == 2
    assert data.read_text(encoding="utf-8").count("2") == 1 and "7" not in data.read_text(encoding="utf-8")


def change_template(template: Path, files: dict[str, str | None]) -> None:
    """A newer template: write or delete files, and record every version that shipped, as record_template_versions.py does."""
    versions_file = template.parent / scaffold.VERSIONS_FILE
    versions = json.loads(versions_file.read_text(encoding="utf-8")) if versions_file.is_file() else {}
    for rel, text in scaffold.template_files(template).items():
        versions.setdefault(rel, []).append(scaffold.text_hash(text))
    for rel, text in files.items():
        path = template / rel
        if text is None:
            path.unlink()
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
    for rel, text in scaffold.template_files(template).items():
        versions.setdefault(rel, []).append(scaffold.text_hash(text))
    versions_file.write_text(json.dumps(versions), encoding="utf-8")


def test_a_course_from_an_older_template_gets_its_unchanged_files_updated_and_new_files_created(tmp_path, mini_template):
    """A new file that needs a newer version of an old one must not arrive without it, or the course stops building."""
    course = tmp_path / "courses" / "c"
    run(course, mini_template)
    change_template(mini_template, {"src/components/Deck.tsx": "export const kind = 'new';\n", "src/components/uses.ts": "import { kind } from './Deck';\n"})
    report = run(course, mini_template, part=2, slug="two", part_title="Two")
    assert report["updated"] == ["web/src/components/Deck.tsx"]
    assert "web/src/components/uses.ts" in report["created"]
    assert (course / "web/src/components/Deck.tsx").read_text(encoding="utf-8") == "export const kind = 'new';\n"
    assert report["kept"] == [] and report["removed"] == []


def test_a_template_file_the_course_changed_is_kept_and_listed(tmp_path, mini_template):
    course = tmp_path / "courses" / "c"
    run(course, mini_template)
    (course / "web/src/components/Deck.tsx").write_text("// my edit\n", encoding="utf-8")
    change_template(mini_template, {"src/components/Deck.tsx": "export const kind = 'new';\n"})
    report = run(course, mini_template)
    assert report["kept"] == ["web/src/components/Deck.tsx"] and report["updated"] == []
    assert (course / "web/src/components/Deck.tsx").read_text(encoding="utf-8") == "// my edit\n"


def test_an_unchanged_copy_of_a_file_the_template_dropped_is_removed_and_a_changed_one_kept(tmp_path, mini_template):
    (mini_template / "src/old.ts").write_text("export const old = 1;\n", encoding="utf-8")
    (mini_template / "src/also-old.ts").write_text("export const alsoOld = 1;\n", encoding="utf-8")
    course = tmp_path / "courses" / "c"
    run(course, mini_template)
    (course / "web/src/also-old.ts").write_text("// my edit\n", encoding="utf-8")
    change_template(mini_template, {"src/old.ts": None, "src/also-old.ts": None})
    report = run(course, mini_template)
    assert report["removed"] == ["web/src/old.ts"] and not (course / "web/src/old.ts").exists()
    assert report["kept"] == ["web/src/also-old.ts"] and (course / "web/src/also-old.ts").exists()


def test_a_course_file_that_is_not_utf8_is_kept(tmp_path, mini_template):
    course = tmp_path / "courses" / "c"
    run(course, mini_template)
    (course / "web/src/main.tsx").write_bytes(b"\xff\xfe")
    change_template(mini_template, {"src/main.tsx": "export const v = 2;\n"})
    assert run(course, mini_template)["kept"] == ["web/src/main.tsx"]


def test_an_updated_package_file_runs_install_again(tmp_path, mini_template, monkeypatch):
    calls = []
    monkeypatch.setattr(scaffold, "_run", lambda cmd, cwd: calls.append(cmd) or subprocess.CompletedProcess(cmd, 0, "", ""))
    monkeypatch.setattr(scaffold.shutil, "which", lambda name: f"/usr/bin/{name}")
    course = tmp_path / "courses" / "c"
    run(course, mini_template)
    (course / "web/node_modules").mkdir()
    change_template(mini_template, {"package.json": '{"name": "course-slides", "version": "2.1.0"}\n'})
    assert run(course, mini_template, skip_install=False)["install"] == "ran"
    assert calls == [["pnpm", "install"]]


def test_every_version_of_the_real_template_is_recorded():
    """scaffold.py updates a course's copy only when it is a recorded version, so a template change must be recorded."""
    versions = scaffold.load_versions(TEMPLATE)
    missing = [rel for rel, text in scaffold.template_files(TEMPLATE).items() if scaffold.text_hash(text) not in versions.get(rel, [])]
    assert missing == [], "run python3 skills/teaching/part-slides/scripts/record_template_versions.py, then commit template-versions.json"


def test_the_recorder_adds_the_current_versions_once_and_keeps_the_old_ones(tmp_path, mini_template):
    import record_template_versions

    versions_file = mini_template.parent / scaffold.VERSIONS_FILE
    versions_file.write_text(json.dumps({"src/main.tsx": ["0" * 64], "package-lock.json": ["1" * 64]}), encoding="utf-8")
    assert "src/main.tsx" in record_template_versions.record(mini_template)
    assert record_template_versions.record(mini_template) == []
    versions = json.loads(versions_file.read_text(encoding="utf-8"))
    assert versions["src/main.tsx"] == ["0" * 64, scaffold.text_hash("export {};\n")]
    assert versions["package-lock.json"] == ["1" * 64]
    assert list(versions) == sorted(versions)


def test_a_new_package_file_runs_install_again(tmp_path, mini_template, monkeypatch):
    calls = []
    monkeypatch.setattr(scaffold, "_run", lambda cmd, cwd: calls.append(cmd) or subprocess.CompletedProcess(cmd, 0, "", ""))
    monkeypatch.setattr(scaffold.shutil, "which", lambda name: f"/usr/bin/{name}")
    course = tmp_path / "courses" / "c"
    run(course, mini_template)
    (course / "web/node_modules").mkdir()
    change_template(mini_template, {"pnpm-lock.yaml": "lockfileVersion: '9.0'\n"})
    assert run(course, mini_template, skip_install=False)["install"] == "ran"
