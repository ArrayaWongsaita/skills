import manifest


def _write(web, files, m, **kwargs):
    return manifest.write_group(web, files, m, kind=kwargs.pop("kind", "generated"), generator=kwargs.pop("generator", 1), **kwargs)


def test_absent_file_is_written_and_recorded(tmp_path):
    m = manifest.Manifest()
    assert _write(tmp_path, {"src/a.tsx": "1\n"}, m) == {"src/a.tsx": "written"}
    assert (tmp_path / "src/a.tsx").read_text(encoding="utf-8") == "1\n"
    assert m.files["src/a.tsx"] == {"sha256": manifest.sha256_text("1\n"), "kind": "generated", "generator": 1}


def test_unedited_file_is_overwritten(tmp_path):
    m = manifest.Manifest()
    _write(tmp_path, {"a.tsx": "1"}, m)
    assert _write(tmp_path, {"a.tsx": "2"}, m) == {"a.tsx": "written"}
    assert (tmp_path / "a.tsx").read_text(encoding="utf-8") == "2"


def test_same_content_is_unchanged(tmp_path):
    m = manifest.Manifest()
    _write(tmp_path, {"a.tsx": "1"}, m)
    assert _write(tmp_path, {"a.tsx": "1"}, m) == {"a.tsx": "unchanged"}


def test_edited_file_is_skipped(tmp_path):
    m = manifest.Manifest()
    manifest.write_group(tmp_path, {"a.tsx": "1"}, m, kind="generated", generator=1)
    (tmp_path / "a.tsx").write_text("mine", encoding="utf-8")
    assert manifest.status(tmp_path, "a.tsx", m) == "edited"
    assert manifest.write_group(tmp_path, {"a.tsx": "2"}, m, kind="generated", generator=1) == {"a.tsx": "skipped"}
    assert (tmp_path / "a.tsx").read_text(encoding="utf-8") == "mine"


def test_group_is_skipped_together(tmp_path):
    m = manifest.Manifest()
    pair = {"src/parts/part-01.tsx": "t1", "src/parts/part-01.data.ts": "d1"}
    _write(tmp_path, pair, m)
    (tmp_path / "src/parts/part-01.tsx").write_text("mine", encoding="utf-8")
    new = {"src/parts/part-01.tsx": "t2", "src/parts/part-01.data.ts": "d2"}
    assert _write(tmp_path, new, m) == {"src/parts/part-01.tsx": "skipped", "src/parts/part-01.data.ts": "skipped"}
    assert (tmp_path / "src/parts/part-01.data.ts").read_text(encoding="utf-8") == "d1"


def test_force_overwrites(tmp_path):
    m = manifest.Manifest()
    _write(tmp_path, {"a.tsx": "1"}, m)
    (tmp_path / "a.tsx").write_text("mine", encoding="utf-8")
    assert _write(tmp_path, {"a.tsx": "2"}, m, force=frozenset({"a.tsx"})) == {"a.tsx": "forced"}
    assert (tmp_path / "a.tsx").read_text(encoding="utf-8") == "2"
    assert manifest.status(tmp_path, "a.tsx", m) == "unedited"


def test_forcing_one_member_forces_the_group(tmp_path):
    m = manifest.Manifest()
    _write(tmp_path, {"src/parts/part-01.tsx": "t1", "src/parts/part-01.data.ts": "d1"}, m)
    (tmp_path / "src/parts/part-01.data.ts").write_text("mine", encoding="utf-8")
    new = {"src/parts/part-01.tsx": "t2", "src/parts/part-01.data.ts": "d2"}
    assert _write(tmp_path, new, m, force=frozenset({"src/parts/part-01.tsx"})) == {
        "src/parts/part-01.tsx": "written", "src/parts/part-01.data.ts": "forced"}
    assert (tmp_path / "src/parts/part-01.data.ts").read_text(encoding="utf-8") == "d2"


def test_untracked_existing_file_counts_as_edited(tmp_path):
    m = manifest.Manifest()
    (tmp_path / "a.tsx").write_text("user file", encoding="utf-8")
    assert manifest.status(tmp_path, "a.tsx", m) == "edited"
    assert _write(tmp_path, {"a.tsx": "2"}, m) == {"a.tsx": "skipped"}


def test_deleted_file_is_absent_and_rewritten(tmp_path):
    m = manifest.Manifest()
    _write(tmp_path, {"a.tsx": "1"}, m)
    (tmp_path / "a.tsx").unlink()
    assert manifest.status(tmp_path, "a.tsx", m) == "absent"
    assert _write(tmp_path, {"a.tsx": "1"}, m) == {"a.tsx": "written"}


def test_write_once_never_overwrites(tmp_path):
    assert manifest.write_once(tmp_path, "src/course.ts", "one") is True
    assert manifest.write_once(tmp_path, "src/course.ts", "two") is False
    assert (tmp_path / "src/course.ts").read_text(encoding="utf-8") == "one"


def test_manifest_round_trips(tmp_path):
    m = manifest.Manifest(template_version="1.0.0")
    _write(tmp_path, {"a.tsx": "1"}, m, generator=3)
    _write(tmp_path, {"b.css": "x"}, m, kind="template", generator=None)
    manifest.save(tmp_path, m)
    assert (tmp_path / manifest.MANIFEST_FILE).exists()
    assert manifest.load(tmp_path) == m
    assert manifest.load(tmp_path / "nowhere") == manifest.Manifest()


def test_lines_end_with_newline_only(tmp_path):
    m = manifest.Manifest()
    _write(tmp_path, {"a.tsx": "x\ny\n"}, m)
    assert (tmp_path / "a.tsx").read_bytes() == b"x\ny\n"
