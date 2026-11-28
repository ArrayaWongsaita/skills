import json
import re
import subprocess

import pytest

import sync_listings

EXERCISE = 'const label = "it\'s `here`";\n// ข้อ 1: แรก 👉\n'
SOLVED = 'const label = "it\'s `here`";\ntest("ข้อ 1", () => {});\n'


def git(repo, *args):
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True).stdout.strip()


@pytest.fixture
def course(tmp_path):
    """<course_dir> with a playground (one file, different on main and solutions) and an empty web/src/parts/."""
    course_dir = tmp_path / "course"
    repo = course_dir / "playground"
    (repo / "lessons" / "03-click").mkdir(parents=True)
    path = repo / "lessons" / "03-click" / "Click.test.tsx"
    path.write_text(EXERCISE, encoding="utf-8")
    git(repo.parent, "init", "-q", "-b", "main", str(repo))
    git(repo, "config", "user.email", "t@example.com")
    git(repo, "config", "user.name", "T")
    git(repo, "add", "-A")
    git(repo, "commit", "-qm", "main")
    git(repo, "checkout", "-qb", "solutions")
    path.write_text(SOLVED, encoding="utf-8")
    git(repo, "commit", "-qam", "solution")
    git(repo, "checkout", "-q", "main")
    parts = course_dir / "web" / "src" / "parts"
    parts.mkdir(parents=True)
    sources = {
        "exercise": {"branch": "main", "path": "lessons/03-click/Click.test.tsx", "lang": "tsx"},
        "answer": {"branch": "solutions", "path": "lessons/03-click/Click.test.tsx", "lang": "tsx"},
    }
    (parts / "part-03.sources.json").write_text(json.dumps(sources), encoding="utf-8")
    return course_dir


def generated(course_dir):
    return (course_dir / "web" / "src" / "parts" / "part-03.playground.ts").read_text(encoding="utf-8")


def code_of(text, name):
    line = next(l for l in text.splitlines() if l.strip().startswith(json.dumps(name) + ":"))
    return json.loads(re.search(r"code: (\".*\") \}", line).group(1))


def test_it_writes_each_source_from_its_branch(course):
    assert sync_listings.main([str(course), "--part", "3"]) == 0
    text = generated(course)
    assert "export const playgroundListings: Record<string, Listing> = {" in text
    assert "Do not edit" in text
    assert code_of(text, "exercise") == EXERCISE.rstrip("\n")
    assert code_of(text, "answer") == SOLVED.rstrip("\n")
    assert "playground solutions:lessons/03-click/Click.test.tsx" in text


def test_code_with_quotes_backticks_and_thai_round_trips(course):
    sync_listings.main([str(course), "--part", "3"])
    assert code_of(generated(course), "exercise") == 'const label = "it\'s `here`";\n// ข้อ 1: แรก 👉'


def test_check_passes_when_the_generated_file_is_current(course, capsys):
    sync_listings.main([str(course), "--part", "3"])
    assert sync_listings.main([str(course), "--part", "3", "--check"]) == 0


def test_check_names_a_listing_that_drifted(course, capsys):
    sync_listings.main([str(course), "--part", "3"])
    before = generated(course)
    repo = course / "playground"
    git(repo, "checkout", "-q", "solutions")
    (repo / "lessons" / "03-click" / "Click.test.tsx").write_text(SOLVED + "// changed\n", encoding="utf-8")
    git(repo, "commit", "-qam", "change")
    git(repo, "checkout", "-q", "main")
    assert sync_listings.main([str(course), "--part", "3", "--check"]) == 1
    out = capsys.readouterr().out
    assert "answer" in out and "exercise" not in out
    assert generated(course) == before


def test_check_without_a_generated_file_fails(course):
    assert sync_listings.main([str(course), "--part", "3", "--check"]) == 1


def test_a_missing_source_names_the_listing_and_writes_nothing(course, capsys):
    parts = course / "web" / "src" / "parts"
    sources = json.loads((parts / "part-03.sources.json").read_text(encoding="utf-8"))
    sources["gone"] = {"branch": "solutions", "path": "lessons/03-click/Nope.tsx", "lang": "tsx"}
    (parts / "part-03.sources.json").write_text(json.dumps(sources), encoding="utf-8")
    assert sync_listings.main([str(course), "--part", "3"]) == 1
    err = capsys.readouterr().err
    assert "gone" in err and "solutions:lessons/03-click/Nope.tsx" in err
    assert not (parts / "part-03.playground.ts").exists()


def test_an_output_file_becomes_a_playground_output(course):
    (course / "runs").mkdir()
    (course / "runs" / "03-solutions.txt").write_text("✓ ข้อ 1\n1 passed\n", encoding="utf-8")
    parts = course / "web" / "src" / "parts"
    sources = json.loads((parts / "part-03.sources.json").read_text(encoding="utf-8"))
    sources["answer"]["output"] = "runs/03-solutions.txt"
    (parts / "part-03.sources.json").write_text(json.dumps(sources), encoding="utf-8")
    assert sync_listings.main([str(course), "--part", "3"]) == 0
    text = generated(course)
    assert "export const playgroundOutputs: Record<string, Block> = {" in text
    line = next(l for l in text.split("playgroundOutputs")[1].splitlines() if '"answer":' in l)
    assert json.loads(re.search(r"text: (\".*\") \}", line).group(1)) == "✓ ข้อ 1\n1 passed"


def test_the_users_checkout_is_not_switched(course):
    repo = course / "playground"
    sync_listings.main([str(course), "--part", "3"])
    assert git(repo, "rev-parse", "--abbrev-ref", "HEAD") == "main"
    assert git(repo, "status", "--porcelain") == ""


def test_check_names_a_listing_removed_from_the_sources(course, capsys):
    sync_listings.main([str(course), "--part", "3"])
    parts = course / "web" / "src" / "parts"
    sources = json.loads((parts / "part-03.sources.json").read_text(encoding="utf-8"))
    del sources["exercise"]
    (parts / "part-03.sources.json").write_text(json.dumps(sources), encoding="utf-8")
    assert sync_listings.main([str(course), "--part", "3", "--check"]) == 1
    assert "exercise" in capsys.readouterr().out


def test_a_file_that_is_not_utf8_is_named_not_a_crash(course, capsys):
    repo = course / "playground"
    (repo / "lessons" / "03-click" / "Click.test.tsx").write_bytes(b"\xff\xfe bad")
    git(repo, "commit", "-qam", "binary")
    assert sync_listings.main([str(course), "--part", "3"]) == 1
    assert "UTF-8" in capsys.readouterr().err


def _with_output(course, lines):
    (course / "runs").mkdir(exist_ok=True)
    (course / "runs" / "03-solutions.txt").write_text("collecting\nlessons/03 .\n\n  ✓ ข้อ 1\n1 passed in 0.1s\n", encoding="utf-8")
    parts = course / "web" / "src" / "parts"
    sources = json.loads((parts / "part-03.sources.json").read_text(encoding="utf-8"))
    sources["answer"]["output"] = "runs/03-solutions.txt"
    sources["answer"]["outputLines"] = lines
    (parts / "part-03.sources.json").write_text(json.dumps(sources), encoding="utf-8")


def _output_text(course):
    line = next(l for l in generated(course).split("playgroundOutputs")[1].splitlines() if '"answer":' in l)
    return json.loads(re.search(r"text: (\".*\") \}", line).group(1))


@pytest.mark.parametrize("lines, text", [("last:2", "  ✓ ข้อ 1\n1 passed in 0.1s"), ("2-2", "lessons/03 ."), ("2", "lessons/03 ."), ("4-", "  ✓ ข้อ 1\n1 passed in 0.1s")])
def test_output_lines_keep_an_excerpt_of_the_real_run(course, lines, text):
    _with_output(course, lines)
    assert sync_listings.main([str(course), "--part", "3"]) == 0
    assert _output_text(course) == text
    assert sync_listings.main([str(course), "--part", "3", "--check"]) == 0


def test_check_finds_an_excerpt_that_no_longer_matches_the_run(course, capsys):
    _with_output(course, "last:1")
    sync_listings.main([str(course), "--part", "3"])
    (course / "runs" / "03-solutions.txt").write_text("1 failed\n", encoding="utf-8")
    assert sync_listings.main([str(course), "--part", "3", "--check"]) == 1
    assert "output answer" in capsys.readouterr().out


@pytest.mark.parametrize("lines", ["first:2", "5-3", "9-10", "last:0"])
def test_output_lines_that_do_not_fit_the_run_are_named(course, capsys, lines):
    _with_output(course, lines)
    assert sync_listings.main([str(course), "--part", "3"]) == 1
    assert "outputLines" in capsys.readouterr().err


def test_output_lines_may_join_ranges_so_a_table_keeps_its_header(course):
    _with_output(course, "1,4-5")
    assert sync_listings.main([str(course), "--part", "3"]) == 0
    assert _output_text(course) == "collecting\n  ✓ ข้อ 1\n1 passed in 0.1s"


def test_a_worker_syncs_a_chapter_not_applied_yet_from_its_unit(course):
    parts = course / "web" / "src" / "parts"
    sources = {"new": {"branch": "solutions", "path": "lessons/04-type/Type.test.tsx", "lang": "tsx"}}
    (parts / "part-03.sources.json").write_text(json.dumps(sources), encoding="utf-8")
    unit = course / "units" / "04" / "solutions" / "lessons" / "04-type"
    unit.mkdir(parents=True)
    (unit / "Type.test.tsx").write_text("test('typed', () => {});\n", encoding="utf-8")
    assert sync_listings.main([str(course), "--part", "3"]) == 1
    assert sync_listings.main([str(course), "--part", "3", "--unit", "04"]) == 0
    assert code_of(generated(course), "new") == "test('typed', () => {});"
    assert "unit 04" in generated(course)


def test_output_lines_may_pick_lines_by_their_text_when_a_tool_reorders_its_run(course):
    # Vitest prints test files in the order they finish, so line numbers move between runs; the text does not.
    _with_output(course, "has:✓ ข้อ 1")
    assert sync_listings.main([str(course), "--part", "3"]) == 0
    assert _output_text(course) == "  ✓ ข้อ 1"


def test_output_lines_by_text_that_matches_nothing_is_an_error(course):
    _with_output(course, "has:ข้อ 9")
    assert sync_listings.main([str(course), "--part", "3"]) == 1
