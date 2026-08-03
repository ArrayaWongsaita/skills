from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = SKILL_ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

from instruction_model import analyze_repository  # noqa: E402


class RepositoryFixture:
    def __init__(self) -> None:
        self._temp = tempfile.TemporaryDirectory()
        self.root = Path(self._temp.name).resolve()

    def close(self) -> None:
        self._temp.cleanup()

    def write(self, relative: str, text: str) -> Path:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return path


class InstructionModelTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = RepositoryFixture()

    def tearDown(self) -> None:
        self.repo.close()

    def report(self, runtime: str, **kwargs: object) -> dict[str, object]:
        return analyze_repository(
            self.repo.root,
            command="measure",
            runtime=runtime,
            **kwargs,
        )

    def loaded_paths(self, report: dict[str, object], runtime: str) -> list[str]:
        result = report["results"][runtime]
        return [
            item["path"]
            for item in result["artifacts"]
            if set(item["load_modes"]) & {"startup", "import", "conditional"}
        ]

    def diagnostic_codes(self, report: dict[str, object], runtime: str) -> set[str]:
        return {
            item["code"]
            for item in report["results"][runtime]["diagnostics"]
        }

    def test_codex_loads_only_root_to_cwd_chain(self) -> None:
        self.repo.write("AGENTS.md", "root\n")
        self.repo.write("packages/web/AGENTS.md", "web\n")
        self.repo.write("packages/api/AGENTS.md", "api\n")

        report = self.report("codex", cwd="packages/web")

        self.assertEqual(
            self.loaded_paths(report, "codex"),
            ["AGENTS.md", "packages/web/AGENTS.md"],
        )
        self.assertEqual(report["results"]["codex"]["totals"]["loaded_bytes"], 9)

    def test_codex_override_shadows_same_directory_agents(self) -> None:
        self.repo.write("AGENTS.md", "shared\n")
        self.repo.write("AGENTS.override.md", "override\n")
        self.repo.write("child/AGENTS.md", "child\n")

        report = self.report("codex", cwd="child")

        self.assertEqual(
            self.loaded_paths(report, "codex"),
            ["AGENTS.override.md", "child/AGENTS.md"],
        )
        agents = next(
            item
            for item in report["results"]["codex"]["artifacts"]
            if item["path"] == "AGENTS.md"
        )
        self.assertEqual(agents["load_modes"], ["shadowed"])

    def test_claude_imports_agents_and_ignores_code_examples(self) -> None:
        self.repo.write(
            "CLAUDE.md",
            "@AGENTS.md\n\n```markdown\n@missing.md\n```\n`@also-missing.md`\n",
        )
        self.repo.write("AGENTS.md", "canonical\n")

        report = self.report("claude")

        self.assertEqual(
            self.loaded_paths(report, "claude"),
            ["AGENTS.md", "CLAUDE.md"],
        )
        self.assertNotIn("broken-reference", self.diagnostic_codes(report, "claude"))

    def test_claude_reports_import_cycle(self) -> None:
        self.repo.write("CLAUDE.md", "@rules/a.md\n")
        self.repo.write("rules/a.md", "@../CLAUDE.md\n")

        report = self.report("claude")

        self.assertIn("import-cycle", self.diagnostic_codes(report, "claude"))

    def test_claude_allows_four_import_hops(self) -> None:
        self.repo.write("CLAUDE.md", "@a.md\n")
        self.repo.write("a.md", "@b.md\n")
        self.repo.write("b.md", "@c.md\n")
        self.repo.write("c.md", "@d.md\n")
        self.repo.write("d.md", "final\n")

        report = self.report("claude")

        self.assertEqual(
            self.loaded_paths(report, "claude"),
            ["CLAUDE.md", "a.md", "b.md", "c.md", "d.md"],
        )
        self.assertNotIn("import-depth-exceeded", self.diagnostic_codes(report, "claude"))

    def test_claude_rejects_fifth_import_hop(self) -> None:
        self.repo.write("CLAUDE.md", "@a.md\n")
        self.repo.write("a.md", "@b.md\n")
        self.repo.write("b.md", "@c.md\n")
        self.repo.write("c.md", "@d.md\n")
        self.repo.write("d.md", "@e.md\n")
        self.repo.write("e.md", "too deep\n")

        report = self.report("claude")

        self.assertNotIn("e.md", self.loaded_paths(report, "claude"))
        self.assertIn("import-depth-exceeded", self.diagnostic_codes(report, "claude"))

    def test_copilot_apply_to_uses_targets(self) -> None:
        self.repo.write("AGENTS.md", "canonical\n")
        self.repo.write(
            ".github/instructions/typescript.instructions.md",
            '---\napplyTo: "**/*.ts,**/*.tsx"\n---\nUse strict TypeScript.\n',
        )

        ts_report = self.report("copilot", targets=("src/app.ts",))
        js_report = self.report("copilot", targets=("src/app.js",))

        self.assertIn(
            ".github/instructions/typescript.instructions.md",
            self.loaded_paths(ts_report, "copilot"),
        )
        self.assertNotIn(
            ".github/instructions/typescript.instructions.md",
            self.loaded_paths(js_report, "copilot"),
        )

    def test_copilot_loads_dot_claude_adapter(self) -> None:
        self.repo.write(".claude/CLAUDE.md", "native adapter\n")

        report = self.report("copilot")

        self.assertIn(".claude/CLAUDE.md", self.loaded_paths(report, "copilot"))

    def test_copilot_modular_locations_exclude_intermediate_cwd_directories(self) -> None:
        instruction = '---\napplyTo: "**/*.ts"\n---\nUse TypeScript.\n'
        self.repo.write(".github/instructions/root.instructions.md", instruction)
        self.repo.write("packages/.github/instructions/intermediate.instructions.md", instruction)
        self.repo.write("packages/web/.github/instructions/cwd.instructions.md", instruction)
        self.repo.write("packages/web/src/.github/instructions/target.instructions.md", instruction)

        report = self.report(
            "copilot",
            cwd="packages/web",
            targets=("packages/web/src/app.ts",),
        )
        loaded = self.loaded_paths(report, "copilot")

        self.assertIn(".github/instructions/root.instructions.md", loaded)
        self.assertIn("packages/web/.github/instructions/cwd.instructions.md", loaded)
        self.assertIn("packages/web/src/.github/instructions/target.instructions.md", loaded)
        self.assertNotIn("packages/.github/instructions/intermediate.instructions.md", loaded)

    def test_opencode_resolves_local_globs_without_fetching_remote(self) -> None:
        self.repo.write("AGENTS.md", "canonical\n")
        self.repo.write("rules/testing.md", "test locally\n")
        self.repo.write(
            "opencode.json",
            json.dumps(
                {
                    "instructions": [
                        "rules/*.md",
                        "https://example.com/remote.md",
                    ]
                }
            ),
        )

        report = self.report("opencode")

        self.assertIn("rules/testing.md", self.loaded_paths(report, "opencode"))
        self.assertIn("remote-unresolved", self.diagnostic_codes(report, "opencode"))
        self.assertEqual(report["results"]["opencode"]["totals"]["unresolved_count"], 1)

    def test_opencode_jsonc_preserves_urls_while_removing_comments(self) -> None:
        self.repo.write("AGENTS.md", "canonical\n")
        self.repo.write(
            "opencode.jsonc",
            """{
  // Keep URLs intact while removing this comment.
  "instructions": ["https://example.com/rules.md",],
}
""",
        )

        report = self.report("opencode")

        self.assertIn("remote-unresolved", self.diagnostic_codes(report, "opencode"))
        self.assertNotIn("invalid-config", self.diagnostic_codes(report, "opencode"))

    def test_opencode_uses_nearest_project_config_and_config_relative_globs(self) -> None:
        self.repo.write("AGENTS.md", "canonical\n")
        self.repo.write("root-rule.md", "root\n")
        self.repo.write("opencode.json", json.dumps({"instructions": ["root-rule.md"]}))
        self.repo.write("packages/web/web-rule.md", "web\n")
        self.repo.write(
            "packages/web/opencode.json",
            json.dumps({"instructions": ["web-rule.md"]}),
        )

        report = self.report("opencode", cwd="packages/web")
        loaded = self.loaded_paths(report, "opencode")

        self.assertIn("packages/web/web-rule.md", loaded)
        self.assertNotIn("root-rule.md", loaded)
        self.assertNotIn("unmatched-glob", self.diagnostic_codes(report, "opencode"))

    def test_all_returns_independent_runtime_results(self) -> None:
        self.repo.write("AGENTS.md", "canonical\n")
        self.repo.write("CLAUDE.md", "@AGENTS.md\n")

        report = self.report("all")

        self.assertEqual(report["schema_version"], 2)
        self.assertEqual(
            list(report["results"]),
            ["codex", "claude", "copilot", "opencode"],
        )
        self.assertEqual(self.loaded_paths(report, "codex"), ["AGENTS.md"])
        self.assertEqual(
            self.loaded_paths(report, "claude"),
            ["AGENTS.md", "CLAUDE.md"],
        )

    def test_validate_reports_missing_local_markdown_link(self) -> None:
        self.repo.write("AGENTS.md", "Read [testing](rules/testing.md).\n")

        report = analyze_repository(
            self.repo.root,
            command="validate",
            runtime="all",
        )

        self.assertIn("broken-reference", self.diagnostic_codes(report, "codex"))

    def test_parent_repository_scan_ignores_bundled_eval_fixtures(self) -> None:
        self.repo.write("AGENTS.md", "canonical\n")
        self.repo.write(
            ".agents/skills/example/evals/fixtures/broken/AGENTS.md",
            "[missing](missing.md)\n",
        )

        report = analyze_repository(
            self.repo.root,
            command="validate",
            runtime="codex",
        )

        paths = [item["path"] for item in report["results"]["codex"]["artifacts"]]
        self.assertEqual(paths, ["AGENTS.md"])
        self.assertNotIn("broken-reference", self.diagnostic_codes(report, "codex"))

    def test_skill_root_scan_ignores_bundled_eval_fixtures(self) -> None:
        self.repo.write("AGENTS.md", "canonical\n")
        self.repo.write(
            "evals/fixtures/broken/AGENTS.md",
            "[missing](missing.md)\n",
        )

        report = analyze_repository(
            self.repo.root,
            command="validate",
            runtime="codex",
        )

        paths = [item["path"] for item in report["results"]["codex"]["artifacts"]]
        self.assertEqual(paths, ["AGENTS.md"])

    def test_discovery_does_not_read_symlink_outside_root(self) -> None:
        with tempfile.TemporaryDirectory() as external:
            secret = Path(external) / "AGENTS.md"
            secret.write_text("outside\n", encoding="utf-8")
            (self.repo.root / "AGENTS.md").symlink_to(secret)

            report = self.report("codex")

        self.assertEqual(report["results"]["codex"]["artifacts"], [])
        self.assertEqual(self.loaded_paths(report, "codex"), [])

    def test_outside_cwd_is_invocation_error(self) -> None:
        with self.assertRaises(ValueError):
            self.report("codex", cwd="../outside")


class WrapperContractTests(unittest.TestCase):
    def test_measure_json_and_exit_code(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "AGENTS.md").write_text("canonical\n", encoding="utf-8")
            command = [
                sys.executable,
                str(SCRIPTS / "measure-context-budget.py"),
                str(root),
                "--runtime",
                "codex",
                "--json",
            ]

            completed = subprocess.run(command, capture_output=True, text=True, check=False)

        self.assertEqual(completed.returncode, 0, completed.stderr)
        payload = json.loads(completed.stdout)
        self.assertEqual(payload["schema_version"], 2)
        self.assertEqual(payload["command"], "measure")

    def test_validate_error_returns_one(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "AGENTS.md").write_text("[missing](missing.md)\n", encoding="utf-8")
            command = [
                sys.executable,
                str(SCRIPTS / "validate-instruction-tree.py"),
                str(root),
                "--runtime",
                "codex",
                "--json",
            ]

            completed = subprocess.run(command, capture_output=True, text=True, check=False)

        self.assertEqual(completed.returncode, 1)
        payload = json.loads(completed.stdout)
        self.assertIn(
            "broken-reference",
            {item["code"] for item in payload["results"]["codex"]["diagnostics"]},
        )

    def test_measure_budget_error_returns_one(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "AGENTS.md").write_text("too large\n", encoding="utf-8")
            command = [
                sys.executable,
                str(SCRIPTS / "measure-context-budget.py"),
                str(root),
                "--runtime",
                "codex",
                "--max-bytes",
                "1",
                "--json",
            ]

            completed = subprocess.run(command, capture_output=True, text=True, check=False)

        self.assertEqual(completed.returncode, 1)
        payload = json.loads(completed.stdout)
        self.assertTrue(payload["results"]["codex"]["budget"]["over"])

    def test_strict_warning_returns_one(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "AGENTS.md").write_text("one\ntwo\n", encoding="utf-8")
            command = [
                sys.executable,
                str(SCRIPTS / "scan-instruction-tree.py"),
                str(root),
                "--runtime",
                "codex",
                "--root-warning-lines",
                "1",
                "--strict",
                "--json",
            ]

            completed = subprocess.run(command, capture_output=True, text=True, check=False)

        self.assertEqual(completed.returncode, 1)
        payload = json.loads(completed.stdout)
        self.assertIn(
            "root-line-warning",
            {item["code"] for item in payload["results"]["codex"]["diagnostics"]},
        )

    def test_invalid_cwd_returns_two(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            command = [
                sys.executable,
                str(SCRIPTS / "scan-instruction-tree.py"),
                temp,
                "--runtime",
                "codex",
                "--cwd",
                "../outside",
                "--json",
            ]

            completed = subprocess.run(command, capture_output=True, text=True, check=False)

        self.assertEqual(completed.returncode, 2)
        payload = json.loads(completed.stdout)
        self.assertEqual(payload["diagnostics"][0]["code"], "invalid-input")


if __name__ == "__main__":
    unittest.main()
