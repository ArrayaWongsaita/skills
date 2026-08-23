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

    def skill_paths(self, report: dict[str, object], runtime: str) -> list[str]:
        return [
            item["path"]
            for item in report["results"][runtime]["skill_catalog"]
        ]

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
            ".agents/skills/example/SKILL.md",
            "---\nname: example\ndescription: Use for example tasks.\n---\n",
        )
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

    def test_codex_discovers_root_to_cwd_skill_catalog(self) -> None:
        self.repo.write(
            ".agents/skills/testing/SKILL.md",
            "---\nname: testing\ndescription: Use when testing behavior.\n---\n",
        )
        self.repo.write(
            "packages/web/.agents/skills/frontend/SKILL.md",
            "---\nname: frontend\ndescription: Use when changing web UI.\n---\n",
        )
        self.repo.write(
            "packages/api/.agents/skills/backend/SKILL.md",
            "---\nname: backend\ndescription: Use when changing API code.\n---\n",
        )

        report = self.report("codex", cwd="packages/web")

        self.assertEqual(
            self.skill_paths(report, "codex"),
            [
                ".agents/skills/testing/SKILL.md",
                "packages/web/.agents/skills/frontend/SKILL.md",
            ],
        )
        self.assertTrue(
            all(
                item["load_mode"] == "catalog-metadata"
                for item in report["results"]["codex"]["skill_catalog"]
            )
        )

    def test_skill_metadata_is_separate_from_instruction_bytes(self) -> None:
        self.repo.write("AGENTS.md", "canonical\n")
        skill = self.repo.write(
            ".agents/skills/testing/SKILL.md",
            "---\nname: testing\ndescription: Use when testing behavior.\n---\n# Testing\n",
        )

        report = self.report("codex")
        result = report["results"]["codex"]

        self.assertEqual(result["totals"]["inventory_bytes"], len("canonical\n"))
        self.assertEqual(result["totals"]["loaded_bytes"], len("canonical\n"))
        self.assertEqual(result["skill_totals"]["count"], 1)
        self.assertGreater(result["skill_totals"]["metadata_chars"], 0)
        self.assertGreater(skill.stat().st_size, 0)

    def test_codex_warns_when_skill_catalog_metadata_exceeds_fallback(self) -> None:
        self.repo.write(
            ".agents/skills/large/SKILL.md",
            (
                "---\nname: large\ndescription: "
                + ("x" * 8100)
                + "\n---\n"
            ),
        )

        report = self.report("codex")

        self.assertIn("skill-catalog-warning", self.diagnostic_codes(report, "codex"))

    def test_runtime_skill_locations_are_capability_accurate(self) -> None:
        self.repo.write(
            ".agents/skills/shared/SKILL.md",
            "---\nname: shared\ndescription: Use for shared procedures.\n---\n",
        )
        self.repo.write(
            ".claude/skills/claude-only/SKILL.md",
            "---\nname: claude-only\ndescription: Use for Claude procedures.\n---\n",
        )
        self.repo.write(
            ".github/skills/copilot-only/SKILL.md",
            "---\nname: copilot-only\ndescription: Use for Copilot procedures.\n---\n",
        )
        self.repo.write(
            ".opencode/skills/opencode-only/SKILL.md",
            "---\nname: opencode-only\ndescription: Use for OpenCode procedures.\n---\n",
        )

        claude = self.report("claude")["results"]["claude"]["skill_catalog"]
        copilot = self.report("copilot")["results"]["copilot"]["skill_catalog"]
        opencode = self.report("opencode")["results"]["opencode"]["skill_catalog"]

        self.assertEqual(
            {item["name"]: item["load_mode"] for item in claude},
            {"shared": "adapter-required", "claude-only": "catalog-metadata"},
        )
        self.assertEqual(
            {item["name"] for item in copilot},
            {"shared", "claude-only", "copilot-only"},
        )
        self.assertTrue(
            all(item["load_mode"] == "catalog-metadata" for item in copilot)
        )
        self.assertEqual(
            {item["name"] for item in opencode},
            {"shared", "claude-only", "opencode-only"},
        )

    def test_claude_discovers_nested_target_skills_conditionally(self) -> None:
        self.repo.write(
            "packages/web/.claude/skills/ui/SKILL.md",
            "---\nname: ui\ndescription: Use for web UI procedures.\n---\n",
        )

        report = self.report(
            "claude",
            targets=("packages/web/src/App.tsx",),
        )
        skill = report["results"]["claude"]["skill_catalog"][0]

        self.assertEqual(skill["name"], "ui")
        self.assertEqual(skill["load_mode"], "conditional-catalog")

    def test_runtime_skill_symlink_adapter_is_not_double_counted(self) -> None:
        target = self.repo.write(
            ".agents/skills/shared/SKILL.md",
            "---\nname: shared\ndescription: Use for shared procedures.\n---\n",
        ).parent
        adapter = self.repo.root / ".claude/skills/shared"
        adapter.parent.mkdir(parents=True)
        adapter.symlink_to(target, target_is_directory=True)

        result = self.report("copilot")["results"]["copilot"]

        self.assertEqual(
            {item["path"]: item["load_mode"] for item in result["skill_catalog"]},
            {
                ".agents/skills/shared/SKILL.md": "catalog-metadata",
                ".claude/skills/shared/SKILL.md": "catalog-alias",
            },
        )
        self.assertEqual(result["skill_totals"]["active_count"], 1)

    def test_skill_supports_folded_description_frontmatter(self) -> None:
        self.repo.write(
            ".agents/skills/testing/SKILL.md",
            "---\nname: testing\ndescription: >\n  Use when creating tests\n  or changing behavior.\n---\n",
        )

        report = self.report("codex")
        skill = report["results"]["codex"]["skill_catalog"][0]

        self.assertEqual(
            skill["description"],
            "Use when creating tests or changing behavior.",
        )
        self.assertNotIn("missing-skill-description", self.diagnostic_codes(report, "codex"))

    def test_skill_reports_invalid_frontmatter_and_name_mismatch(self) -> None:
        self.repo.write(".agents/skills/malformed/SKILL.md", "# Missing metadata\n")
        self.repo.write(
            ".agents/skills/backend/SKILL.md",
            "---\nname: server\ndescription: Use when changing the backend.\n---\n",
        )

        report = self.report("codex")
        codes = self.diagnostic_codes(report, "codex")

        self.assertIn("invalid-skill-frontmatter", codes)
        self.assertIn("invalid-skill-name", codes)
        self.assertIn("missing-skill-description", codes)
        self.assertIn("skill-name-mismatch", codes)

    def test_skill_reports_duplicate_declared_name(self) -> None:
        self.repo.write(
            ".agents/skills/one/SKILL.md",
            "---\nname: shared\ndescription: Use for the first procedure.\n---\n",
        )
        self.repo.write(
            ".agents/skills/two/SKILL.md",
            "---\nname: shared\ndescription: Use for the second procedure.\n---\n",
        )

        report = self.report("codex")

        self.assertIn("duplicate-skill-name", self.diagnostic_codes(report, "codex"))

    def test_skill_allows_in_repository_directory_symlink(self) -> None:
        target = self.repo.write(
            "shared/linked/SKILL.md",
            "---\nname: linked\ndescription: Use for linked procedures.\n---\n",
        ).parent
        link = self.repo.root / ".agents/skills/linked"
        link.parent.mkdir(parents=True)
        link.symlink_to(target, target_is_directory=True)

        report = self.report("codex")

        self.assertEqual(
            self.skill_paths(report, "codex"),
            [".agents/skills/linked/SKILL.md"],
        )
        self.assertTrue(report["results"]["codex"]["skill_catalog"][0]["symlink"])

    def test_skill_rejects_out_of_repository_directory_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as external:
            target = Path(external) / "outside"
            target.mkdir()
            (target / "SKILL.md").write_text(
                "---\nname: outside\ndescription: Use outside.\n---\n",
                encoding="utf-8",
            )
            link = self.repo.root / ".agents/skills/outside"
            link.parent.mkdir(parents=True)
            link.symlink_to(target, target_is_directory=True)

            report = self.report("codex")

        self.assertEqual(self.skill_paths(report, "codex"), [])
        self.assertIn(
            "outside-root-skill-symlink",
            self.diagnostic_codes(report, "codex"),
        )

    def test_skill_reports_broken_directory_symlink(self) -> None:
        link = self.repo.root / ".agents/skills/broken"
        link.parent.mkdir(parents=True)
        link.symlink_to(self.repo.root / "missing", target_is_directory=True)

        report = self.report("codex")

        self.assertIn("broken-skill-symlink", self.diagnostic_codes(report, "codex"))

    def test_validate_checks_skill_markdown_links(self) -> None:
        self.repo.write(
            ".agents/skills/testing/SKILL.md",
            (
                "---\nname: testing\ndescription: Use when testing.\n---\n"
                "Read [missing](references/missing.md).\n"
            ),
        )

        report = analyze_repository(
            self.repo.root,
            command="validate",
            runtime="codex",
        )

        self.assertIn("broken-reference", self.diagnostic_codes(report, "codex"))


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
