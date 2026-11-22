import json
import subprocess
import sys
from pathlib import Path

import pytest

from vocabulary import VocabularyError, add_concepts, init_vocabulary, load, save, vocabulary_path

SCRIPT = str(Path(__file__).resolve().parents[1] / "scripts" / "vocabulary.py")
CONCEPT = {"id": "graph", "meaning": "กราฟของ node", "shape": "box", "role": "secondary", "icon": ""}


def run_cli(*args, check=True):
    result = subprocess.run([sys.executable, SCRIPT, *map(str, args)], capture_output=True, text=True)
    if check:
        assert result.returncode == 0, result.stderr
    return result


def test_fixture_loads(course):
    vocab = load(course)
    assert vocab.version == 1 and set(vocab.concepts) == {"user", "model", "tool", "agent", "function", "value"}
    assert vocab.style.endswith("no text.")
    assert vocab.roles["primary"] == "#1A73E8"


def test_add_appends_and_bumps_version(course):
    vocab = add_concepts(load(course), [CONCEPT], part=2)
    assert vocab.version == 2 and vocab.concepts["graph"]["added_in"] == 2
    save(course, vocab)
    assert load(course).concepts["graph"]["meaning"] == "กราฟของ node"


def test_identical_concept_is_skipped_without_bump(course):
    same = {k: v for k, v in load(course).concepts["model"].items() if k != "added_in"}
    assert add_concepts(load(course), [same], part=2).version == 1


def test_changing_a_concept_is_refused(course):
    changed = {**load(course).concepts["model"], "role": "accent"}
    with pytest.raises(VocabularyError, match="append-only"):
        add_concepts(load(course), [changed], part=2)


@pytest.mark.parametrize("bad", [{**CONCEPT, "shape": "hexagon"}, {**CONCEPT, "role": "pink"}, {**CONCEPT, "id": "Graph"}, {"id": "graph"}])
def test_invalid_concepts_are_refused(course, bad):
    with pytest.raises(VocabularyError):
        add_concepts(load(course), [bad], part=2)


def test_init_starts_empty(tmp_path):
    vocab = init_vocabulary("demo", "Flat style.")
    save(tmp_path, vocab)
    loaded = load(tmp_path)
    assert (loaded.version, loaded.concepts, loaded.style, loaded.course) == (0, {}, "Flat style.", "demo")


def test_missing_vocabulary(tmp_path):
    with pytest.raises(VocabularyError, match="no vocabulary"):
        load(tmp_path)


def test_cli_init_refuses_existing_file(course):
    result = run_cli("init", course, "--course", "x", "--style", "s", check=False)
    assert result.returncode == 1 and "exists" in result.stderr


def test_cli_add_and_show(course, tmp_path):
    concepts = tmp_path / "new.json"
    concepts.write_text(json.dumps([CONCEPT], ensure_ascii=False), encoding="utf-8")
    run_cli("add", course, concepts, "--part", "2")
    shown = json.loads(run_cli("show", course).stdout)
    assert shown["version"] == 2 and "graph" in shown["concepts"]
    assert vocabulary_path(course) == course / "slides" / "visual-vocabulary.md"
