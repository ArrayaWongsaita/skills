"""Run one course snippet against fake models and record the outcome.

Runs inside the per-course venv:

    python run_snippet.py <snippet.py> --result <result.json> [--fixture <fixture.json>]

Always writes the result JSON and exits 0; a missing result file means the
runner itself crashed or was killed (for example by a timeout).

Result: {"status": "verified" | "failed", "reason": str | null, "deprecations": [str]}
A snippet fails on any exception, or on a deprecation warning raised by the
snippet itself or by LangChain / LangGraph.
"""

import argparse
import importlib.util
import json
import os
import runpy
import sys
import warnings
from pathlib import Path

DEPRECATION_CATEGORIES = (DeprecationWarning, PendingDeprecationWarning)
FLAGGED_PACKAGES = ("langchain", "langgraph")


def _is_flagged(record: warnings.WarningMessage, snippet: Path) -> bool:
    if not issubclass(record.category, DEPRECATION_CATEGORIES):
        return False
    from_snippet = os.path.realpath(record.filename) == os.path.realpath(snippet)
    from_framework = record.category.__module__.startswith(FLAGGED_PACKAGES)
    return from_snippet or from_framework


def run(snippet: Path, fixture: Path | None) -> dict:
    sys.path.insert(0, str(snippet.parent))
    with warnings.catch_warnings(record=True) as records:
        warnings.simplefilter("always")
        try:
            if importlib.util.find_spec("langchain_core") is not None:
                import fake_models

                fake_models.install_fakes(fake_models.load_fixture(fixture))
            runpy.run_path(str(snippet), run_name="__main__")
        except SystemExit as stop:
            if stop.code not in (None, 0):
                return {"status": "failed", "reason": f"SystemExit: {stop.code}", "deprecations": []}
        except BaseException as error:  # noqa: BLE001 - the snippet's failure is the result
            return {"status": "failed", "reason": f"{type(error).__name__}: {error}", "deprecations": []}
    deprecations = [str(record.message) for record in records if _is_flagged(record, snippet)]
    if deprecations:
        return {"status": "failed", "reason": f"deprecated: {deprecations[0]}", "deprecations": deprecations}
    return {"status": "verified", "reason": None, "deprecations": []}


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Run one course snippet against fake models.")
    parser.add_argument("snippet", type=Path)
    parser.add_argument("--result", type=Path, required=True)
    parser.add_argument("--fixture", type=Path)
    args = parser.parse_args(argv)
    result = run(args.snippet.resolve(), args.fixture)
    sys.stdout.flush()
    args.result.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
