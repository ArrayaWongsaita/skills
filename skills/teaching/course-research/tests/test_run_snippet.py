import json
import subprocess
import sys
import textwrap
from pathlib import Path

import pytest


@pytest.fixture
def run(skill_dir, tmp_path):
    runner = skill_dir / "scripts" / "code_check" / "run_snippet.py"

    def _run(code: str, fixture: dict | None = None, timeout: int = 60):
        snippet = tmp_path / "snippet.py"
        snippet.write_text(textwrap.dedent(code), encoding="utf-8")
        result_path = tmp_path / "result.json"
        args = [sys.executable, str(runner), str(snippet), "--result", str(result_path)]
        if fixture is not None:
            fixture_path = tmp_path / "fixture.json"
            fixture_path.write_text(json.dumps(fixture), encoding="utf-8")
            args += ["--fixture", str(fixture_path)]
        process = subprocess.run(args, cwd=tmp_path, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=timeout)
        assert process.returncode == 0, process.stderr
        return json.loads(result_path.read_text(encoding="utf-8")), process.stdout

    return _run


def test_ok_snippet_verified(run):
    result, stdout = run("print(1)")
    assert result == {"status": "verified", "reason": None, "deprecations": []}
    assert stdout.strip() == "1"


def test_exception_failed(run):
    result, _ = run('raise ValueError("boom")')
    assert result["status"] == "failed"
    assert result["reason"] == "ValueError: boom (line 1)"


def test_sys_exit_zero_is_fine(run):
    result, _ = run("import sys\nsys.exit(0)")
    assert result["status"] == "verified"


def test_langgraph_deprecation_failed(run):
    result, _ = run(
        """
        from langchain.chat_models import init_chat_model
        from langgraph.prebuilt import create_react_agent

        create_react_agent(init_chat_model("openai:x"), tools=[])
        """
    )
    assert result["status"] == "failed"
    assert result["reason"].startswith("deprecated: ")
    assert result["deprecations"]


def test_unrelated_third_party_warning_ignored(run, tmp_path):
    (tmp_path / "helper.py").write_text('import warnings\nwarnings.warn("old helper", DeprecationWarning)\n', encoding="utf-8")
    result, _ = run("import helper\nprint('ok')")
    assert result["status"] == "verified"


def test_deprecation_raised_in_snippet_fails(run):
    result, _ = run('import warnings\nwarnings.warn("my old api", DeprecationWarning)')
    assert result["status"] == "failed"
    assert result["reason"] == "deprecated: my old api"


def test_getpass_prompt_does_not_hang(run):
    result, _ = run(
        """
        import getpass, os
        os.environ["OPENAI_API_KEY"] = getpass.getpass("key: ")
        print(os.environ["OPENAI_API_KEY"])
        """,
        timeout=20,
    )
    assert result["status"] == "verified"


def test_fixture_flag_used(run):
    result, stdout = run(
        """
        from langchain.chat_models import init_chat_model

        print(init_chat_model("openai:x").invoke("q").content)
        """,
        fixture={"responses": [{"content": "from fixture"}]},
    )
    assert result["status"] == "verified"
    assert "from fixture" in stdout


def test_bad_fixture_reported_as_failure(run):
    result, _ = run("print(1)", fixture={"responses": [{}]})
    assert result["status"] == "failed"
    assert result["reason"].startswith("FixtureError: ")


def test_beta_warning_is_not_a_deprecation(run):
    result, _ = run(
        """
        import warnings
        from langchain_core._api.beta_decorator import LangChainBetaWarning
        warnings.warn("x is in beta", LangChainBetaWarning)
        """
    )
    assert result["status"] == "verified", result


def test_failure_reason_names_the_snippet_line(run):
    result, _ = run("x = 1\n\nraise ValueError('boom')\n")
    assert result["reason"] == "ValueError: boom (line 3)"
