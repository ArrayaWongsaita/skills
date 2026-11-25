#!/usr/bin/env python3
"""Record the template's current files in template-versions.json.

    record_template_versions.py

Run it after you change a file in template/, and commit the JSON with the change: scaffold.py brings a course's copy
of a template file up to date only when the copy is a recorded version, so an unrecorded version stays in courses for
good. Old versions are kept; it prints the files it recorded a new version of.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import scaffold  # noqa: E402


def record(template_dir: Path = scaffold.TEMPLATE_DIR) -> list[str]:
    versions = scaffold.load_versions(template_dir)
    added = []
    for rel, text in scaffold.template_files(template_dir).items():
        shipped = versions.setdefault(rel, [])
        if scaffold.text_hash(text) not in shipped:
            shipped.append(scaffold.text_hash(text))
            added.append(rel)
    path = template_dir.parent / scaffold.VERSIONS_FILE
    path.write_text(json.dumps(dict(sorted(versions.items())), indent=1) + "\n", encoding="utf-8")
    return added


def main() -> int:
    for rel in record():
        print(rel)
    return 0


if __name__ == "__main__":
    sys.exit(main())
