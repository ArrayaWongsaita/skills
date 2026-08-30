from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "scripts" / "dependency_audit.py"
SPEC = importlib.util.spec_from_file_location("dependency_audit", MODULE_PATH)
dependency_audit = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = dependency_audit
assert SPEC.loader
SPEC.loader.exec_module(dependency_audit)


class DependencyAuditTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def test_registry_keeps_specialists_external_and_has_one_core_orchestrator_route(self):
        self.assertEqual(
            (
                "grill-with-docs", "to-spec", "scrutinize", "to-tickets",
                "implement", "code-review",
            ),
            dependency_audit.CORE_FEATURE_DEPENDENCIES,
        )
        forbidden_replacements = {
            "requirements-discovery", "spec-synthesis", "ticket-planning",
            "implementation-execution", "technical-experiment", "project-wayfinding",
            "incident-report", "repository-workflow-setup",
        }
        self.assertTrue(forbidden_replacements.isdisjoint(dependency_audit.DEPENDENCIES))

    def test_grill_with_docs_uses_matt_pocock_provenance_and_transitive_contract(self):
        for name in ("grill-with-docs", "grilling", "domain-modeling"):
            self.add_skill(
                name,
                source=dependency_audit.MATT_SOURCE,
                disable_model=name == "grill-with-docs",
                allow_implicit=name != "grill-with-docs",
            )

        result = self.audit(["grill-with-docs"], runtime="claude")

        self.assertTrue(result["ok"])
        contract = dependency_audit.DEPENDENCIES["grill-with-docs"]
        self.assertEqual("Matt Pocock", contract["owner"])
        self.assertEqual("mattpocock/skills", contract["source"])
        self.assertEqual(
            "requirement discovery, domain clarification, and decision capture",
            contract["role"],
        )
        self.assertEqual(["grilling", "domain-modeling"], contract["directDependencies"])
        self.assertEqual(
            "https://github.com/mattpocock/skills", contract["installSource"]
        )
        self.assertEqual(
            ["grill-with-docs", "to-spec", "scrutinize", "to-tickets", "implement", "code-review"],
            result["dependencyGraph"]["engineering-workflow"],
        )
        status = result["dependencyStatus"]["grill-with-docs"]
        self.assertEqual("VERIFIED", status["provenanceStatus"])
        self.assertEqual("mattpocock/skills", status["detectedSource"])
        self.assertEqual("user-invoked", status["upstreamInvocation"])
        self.assertEqual("user_handoff", result["resolutions"]["grill-with-docs"]["invocationMode"])

    def test_provider_policy_keeps_only_declared_9arm_exceptions(self):
        non_matt = {
            name: contract["source"]
            for name, contract in dependency_audit.DEPENDENCIES.items()
            if contract["source"] != dependency_audit.MATT_SOURCE
        }

        self.assertEqual(
            {
                "scrutinize": dependency_audit.NINEARM_SOURCE,
                "post-mortem": dependency_audit.NINEARM_SOURCE,
            },
            non_matt,
        )

    def test_machine_registry_is_the_canonical_dependency_source(self):
        payload = json.loads(dependency_audit.REGISTRY_PATH.read_text(encoding="utf-8"))
        names = {item["skill"] for item in payload["dependencies"]}

        self.assertEqual(names, set(dependency_audit.DEPENDENCIES))
        self.assertEqual(1, payload["version"])
        self.assertNotIn("commandTemplate", json.dumps(payload))
        self.assertNotIn("npx skills add", json.dumps(payload))

    def test_missing_grill_with_docs_reports_matt_install_without_auto_installing(self):
        for name in ("grilling", "domain-modeling"):
            self.add_skill(name, source=dependency_audit.MATT_SOURCE)
        before = sorted(path.relative_to(self.root).as_posix() for path in self.root.rglob("*"))

        result = self.audit(["grill-with-docs"])

        after = sorted(path.relative_to(self.root).as_posix() for path in self.root.rglob("*"))
        self.assertFalse(result["ok"])
        self.assertEqual(["grill-with-docs"], result["missing"])
        status = result["dependencyStatus"]["grill-with-docs"]
        self.assertEqual("Matt Pocock", status["owner"])
        self.assertEqual("mattpocock/skills", status["expectedSource"])
        self.assertEqual("MISSING", status["status"])
        proposal = result["installProposal"][0]
        self.assertEqual("Matt Pocock", proposal["owner"])
        self.assertEqual("mattpocock/skills", proposal["source"])
        self.assertEqual(["grill-with-docs"], proposal["skills"])
        self.assertEqual("https://github.com/mattpocock/skills", proposal["installSource"])
        self.assertIsNone(proposal["command"])
        self.assertFalse(proposal["verified"])
        self.assertEqual("required-on-demand", proposal["commandVerification"])
        self.assertTrue(proposal["requiresApproval"])
        self.assertEqual(before, after)
        self.assertFalse(result["sideEffectsPerformed"])

    def test_installed_grill_with_docs_passes_without_reinstalling(self):
        for name in ("grill-with-docs", "grilling", "domain-modeling"):
            self.add_skill(
                name,
                source=dependency_audit.MATT_SOURCE,
                disable_model=name == "grill-with-docs",
                allow_implicit=name != "grill-with-docs",
            )

        result = self.audit(["grill-with-docs"], runtime="codex")

        self.assertTrue(result["ok"])
        self.assertEqual([], result["missing"])
        self.assertEqual([], result["installProposal"])
        self.assertEqual("INSTALLED", result["dependencyStatus"]["grill-with-docs"]["status"])
        self.assertEqual("user_handoff", result["resolutions"]["grill-with-docs"]["invocationMode"])
        self.assertEqual("$grill-with-docs", result["resolutions"]["grill-with-docs"]["invocationTarget"])

    def test_missing_grill_transitive_dependency_blocks_discovery_and_identifies_parent(self):
        self.add_skill(
            "grill-with-docs",
            source=dependency_audit.MATT_SOURCE,
            disable_model=True,
            allow_implicit=False,
        )
        self.add_skill("grilling", source=dependency_audit.MATT_SOURCE)

        result = self.audit(["grill-with-docs"])

        self.assertFalse(result["ok"])
        self.assertEqual(["domain-modeling"], result["missing"])
        self.assertIn("grill-with-docs", result["resolutions"])
        status = result["dependencyStatus"]["domain-modeling"]
        self.assertEqual("MISSING", status["status"])
        self.assertEqual("Matt Pocock", status["owner"])
        self.assertEqual("mattpocock/skills", status["expectedSource"])
        self.assertEqual(["grill-with-docs", "wayfinder"], status["requiredBy"])
        self.assertEqual(
            ["domain-modeling"], result["installProposal"][0]["skills"]
        )
        self.assertIsNone(result["installProposal"][0]["command"])
        self.assertFalse(result["installProposal"][0]["verified"])
        self.assertTrue(result["installProposal"][0]["requiresApproval"])

    def test_engineering_workflow_has_no_removed_discovery_provider_reference(self):
        skill_root = MODULE_PATH.parents[1]
        contents = "\n".join(
            path.read_text(encoding="utf-8")
            for path in skill_root.rglob("*")
            if path.is_file()
            and "__pycache__" not in path.parts
            and "test_dependency_audit.py" != path.name
        )
        self.assertNotIn("lee" + "jianrong", contents)
        self.assertNotIn("claude" + "-skills", contents)

    def add_skill(
        self,
        name,
        *,
        plugin=None,
        disable_model=False,
        allow_implicit=True,
        source=None,
        location=None,
    ):
        if location:
            directory = self.root / location / name
        elif plugin:
            directory = self.root / plugin / "skills" / name
            manifest = self.root / plugin / ".claude-plugin" / "plugin.json"
            manifest.parent.mkdir(parents=True, exist_ok=True)
            manifest.write_text(json.dumps({"name": plugin}), encoding="utf-8")
        else:
            directory = self.root / "standalone" / name
        directory.mkdir(parents=True, exist_ok=True)
        invocation = "\ndisable-model-invocation: true" if disable_model else ""
        skill = directory / "SKILL.md"
        source_field = f"\nsource: {source}" if source else ""
        skill.write_text(
            f"---\nname: {name}\ndescription: Test dependency {name}{source_field}{invocation}\n---\n\nInstructions.\n",
            encoding="utf-8",
        )
        metadata = directory / "agents" / "openai.yaml"
        metadata.parent.mkdir()
        metadata.write_text(
            f"policy:\n  allow_implicit_invocation: {'true' if allow_implicit else 'false'}\n",
            encoding="utf-8",
        )
        return skill.resolve()

    def audit(self, required, runtime="codex", has_subagents=True, incident=False):
        return dependency_audit.audit_dependencies(
            required, runtime, [self.root], has_subagents, incident=incident
        )

    def test_discovers_codex_standalone_skill_by_exact_path(self):
        skill = self.add_skill("tdd")
        result = self.audit(["tdd"])
        self.assertTrue(result["ok"])
        self.assertEqual(str(skill), result["resolutions"]["tdd"]["resolved_identity"])
        self.assertEqual("standalone", result["resolutions"]["tdd"]["source_kind"])

    def test_discovers_qualified_claude_plugin_identity(self):
        self.add_skill("code-review", plugin="mattpocock-skills")
        result = self.audit(["code-review"], runtime="claude")
        self.assertTrue(result["ok"])
        self.assertEqual(
            "mattpocock-skills:code-review",
            result["resolutions"]["code-review"]["resolved_identity"],
        )

    def test_discovers_9arm_namespace(self):
        self.add_skill("scrutinize", plugin="9arm-skills")
        result = self.audit(["scrutinize"], runtime="claude")
        self.assertTrue(result["ok"])
        self.assertEqual(
            "9arm-skills:scrutinize",
            result["resolutions"]["scrutinize"]["resolved_identity"],
        )

    def test_duplicate_standalone_candidates_are_ambiguous(self):
        self.add_skill("tdd", location="one")
        self.add_skill("tdd", location="two")
        result = self.audit(["tdd"])
        self.assertFalse(result["ok"])
        self.assertEqual("AMBIGUOUS_DEPENDENCY", result["issues"][0]["code"])
        self.assertEqual(2, len(result["issues"][0]["candidates"]))

    def test_claude_user_only_dependency_is_a_real_user_handoff(self):
        self.add_skill("scrutinize", disable_model=True)
        result = self.audit(["scrutinize"], runtime="claude")
        self.assertTrue(result["ok"])
        self.assertEqual("user_handoff", result["resolutions"]["scrutinize"]["invocationMode"])
        self.assertEqual("/scrutinize", result["resolutions"]["scrutinize"]["invocationTarget"])

    def test_claude_override_can_disable_or_make_skill_user_only(self):
        self.add_skill("scrutinize", plugin="9arm-skills")
        settings = self.root / ".claude" / "settings.json"
        settings.parent.mkdir(parents=True)
        settings.write_text(
            json.dumps({"skillOverrides": {"9arm-skills:scrutinize": "user-invocable-only"}}),
            encoding="utf-8",
        )
        result = self.audit(["scrutinize"], runtime="claude")
        self.assertTrue(result["ok"])
        self.assertEqual("user_handoff", result["resolutions"]["scrutinize"]["invocationMode"])

        settings.write_text(
            json.dumps({"skillOverrides": {"9arm-skills:scrutinize": "off"}}),
            encoding="utf-8",
        )
        result = self.audit(["scrutinize"], runtime="claude")
        self.assertEqual("DISABLED_DEPENDENCY", result["issues"][0]["code"])

    def test_disabled_claude_plugin_is_rejected(self):
        self.add_skill("scrutinize", plugin="9arm-skills")
        settings = self.root / ".claude" / "settings.json"
        settings.parent.mkdir(parents=True)
        settings.write_text(
            json.dumps({"enabledPlugins": {"9arm-skills@market": False}}),
            encoding="utf-8",
        )
        result = self.audit(["scrutinize"], runtime="claude")
        self.assertEqual("DISABLED_DEPENDENCY", result["issues"][0]["code"])

    def test_codex_skills_config_disabled_path_is_rejected(self):
        skill = self.add_skill("tdd")
        config = self.root / ".codex" / "config.toml"
        config.parent.mkdir(parents=True)
        config.write_text(
            f'[[skills.config]]\npath = "{skill}"\nenabled = false\n',
            encoding="utf-8",
        )
        result = self.audit(["tdd"])
        self.assertEqual("DISABLED_DEPENDENCY", result["issues"][0]["code"])

    def test_codex_config_is_found_above_a_skills_search_root(self):
        directory = self.root / ".codex" / "skills" / "tdd"
        directory.mkdir(parents=True)
        skill = directory / "SKILL.md"
        skill.write_text(
            "---\nname: tdd\ndescription: Test dependency tdd\n---\n",
            encoding="utf-8",
        )
        config = self.root / ".codex" / "config.toml"
        config.write_text(
            f'[[skills.config]]\npath = "{skill.resolve()}"\nenabled = false\n',
            encoding="utf-8",
        )
        result = dependency_audit.audit_dependencies(
            ["tdd"], "codex", [self.root / ".codex" / "skills"], True
        )
        self.assertEqual("DISABLED_DEPENDENCY", result["issues"][0]["code"])

    def test_openai_implicit_policy_is_recorded_from_metadata(self):
        self.add_skill("tdd", allow_implicit=False)
        result = self.audit(["tdd"])
        self.assertTrue(result["ok"])
        self.assertFalse(result["resolutions"]["tdd"]["allow_implicit_invocation"])

    def test_orchestrator_policy_requires_explicit_invocation_per_runtime(self):
        skill = self.add_skill("engineering-workflow", allow_implicit=False)
        codex = dependency_audit.audit_dependencies(
            [], "codex", [self.root], True, orchestrator_skill=skill
        )
        self.assertTrue(codex["ok"])
        self.assertTrue(codex["orchestratorPolicy"]["explicitOnly"])

        claude = dependency_audit.audit_dependencies(
            [], "claude", [self.root], True, orchestrator_skill=skill
        )
        self.assertFalse(claude["ok"])
        self.assertEqual("INVOCATION_POLICY_INCOMPATIBLE", claude["issues"][0]["code"])

        settings = self.root / ".claude" / "settings.json"
        settings.parent.mkdir(parents=True)
        settings.write_text(
            json.dumps({"skillOverrides": {"engineering-workflow": "user-invocable-only"}}),
            encoding="utf-8",
        )
        claude = dependency_audit.audit_dependencies(
            [], "claude", [self.root], True, orchestrator_skill=skill
        )
        self.assertTrue(claude["ok"])

    def test_claude_builtin_code_review_collision_is_explicit(self):
        result = self.audit(["code-review"], runtime="claude")
        self.assertFalse(result["ok"])
        self.assertEqual("BUILTIN_CODE_REVIEW_COLLISION", result["issues"][0]["code"])
        self.assertIn("code-review", result["missing"])

    def test_research_and_code_review_require_subagents(self):
        self.add_skill("research")
        self.add_skill("code-review")
        result = self.audit(["research", "code-review"], has_subagents=False)
        self.assertFalse(result["ok"])
        self.assertEqual(
            ["SUBAGENT_CAPABILITY_REQUIRED", "SUBAGENT_CAPABILITY_REQUIRED"],
            [issue["code"] for issue in result["issues"]],
        )

    def test_upstream_workflow_is_resolved_without_a_replacement_worker(self):
        self.add_skill("implement", disable_model=True)
        result = self.audit(["implement"], runtime="claude")
        self.assertTrue(result["ok"])
        self.assertEqual("user_handoff", result["resolutions"]["implement"]["invocationMode"])
        self.assertEqual(["commit"], result["resolutions"]["implement"]["declaredSideEffects"])

    def test_external_workflow_predecessors_are_first_class_dependencies(self):
        for name in ("grill-with-docs", "to-spec", "to-tickets", "wayfinder", "grilling", "domain-modeling"):
            self.add_skill(name, disable_model=True)
        result = self.audit(
            ["grill-with-docs", "to-spec", "to-tickets", "wayfinder"],
            runtime="claude",
        )
        self.assertTrue(result["ok"])
        self.assertEqual(
            {"grill-with-docs", "to-spec", "to-tickets", "wayfinder", "grilling", "domain-modeling"},
            set(result["resolutions"]),
        )
        self.assertTrue(
            all(
                resolution["invocationMode"] == "user_handoff"
                for resolution in result["resolutions"].values()
            )
        )

    def test_missing_install_proposal_is_read_only_and_grouped(self):
        before = sorted(path.relative_to(self.root).as_posix() for path in self.root.rglob("*"))
        result = self.audit(["tdd", "scrutinize"])
        after = sorted(path.relative_to(self.root).as_posix() for path in self.root.rglob("*"))
        self.assertEqual(before, after)
        self.assertFalse(result["sideEffectsPerformed"])
        self.assertEqual(2, len(result["installProposal"]))
        self.assertTrue(all(item["requiresApproval"] for item in result["installProposal"]))
        proposed = {skill for item in result["installProposal"] for skill in item["skills"]}
        self.assertEqual({"tdd", "scrutinize"}, proposed)
        self.assertTrue(all(item["command"] is None for item in result["installProposal"]))
        self.assertTrue(all(not item["verified"] for item in result["installProposal"]))

    def test_missing_scrutinize_reports_owner_source_without_inventing_command(self):
        for name in (
            "grill-with-docs", "to-spec", "to-tickets", "implement", "code-review",
            "grilling", "domain-modeling",
        ):
            self.add_skill(name)
        result = self.audit(
            ["grill-with-docs", "to-spec", "scrutinize", "to-tickets", "implement", "code-review"]
        )
        self.assertFalse(result["ok"])
        self.assertEqual(["scrutinize"], result["missing"])
        proposal = result["installProposal"][0]
        self.assertEqual("thananon", proposal["owner"])
        self.assertEqual("thananon/9arm-skills", proposal["source"])
        self.assertEqual(["scrutinize"], proposal["skills"])
        self.assertIsNone(proposal["command"])
        self.assertEqual("unknown until installer verification", proposal["installScope"])
        self.assertFalse(proposal["verified"])
        self.assertEqual("required-on-demand", proposal["commandVerification"])
        self.assertTrue(proposal["requiresApproval"])

    def test_installed_skill_without_source_metadata_is_not_assigned_guessed_provenance(self):
        self.add_skill("scrutinize")
        result = self.audit(["scrutinize"])
        self.assertTrue(result["ok"])
        status = result["dependencyStatus"]["scrutinize"]
        self.assertEqual("INSTALLED", status["status"])
        self.assertEqual("UNVERIFIED", status["provenanceStatus"])
        self.assertEqual(dependency_audit.UNKNOWN_SOURCE, status["detectedSource"])
        self.assertEqual(dependency_audit.NINEARM_SOURCE, status["expectedSource"])
        self.assertEqual([], result["installProposal"])

    def test_provenance_mismatch_blocks_without_replacing_existing_skill(self):
        skill = self.add_skill("scrutinize")
        skill.write_text(
            "---\nname: scrutinize\nsource: other-owner/lookalike\n---\n",
            encoding="utf-8",
        )
        result = self.audit(["scrutinize"])
        self.assertFalse(result["ok"])
        self.assertEqual("PROVENANCE_MISMATCH", result["issues"][0]["code"])
        self.assertEqual("PROVENANCE_MISMATCH", result["dependencyStatus"]["scrutinize"]["status"])
        self.assertEqual("other-owner/lookalike", result["dependencyStatus"]["scrutinize"]["detectedSource"])
        self.assertTrue(skill.is_file())

    def test_inventory_reports_optional_absence_without_blocking_or_proposing_install(self):
        result = dependency_audit.dependency_inventory("codex", [self.root], True)
        self.assertTrue(result["ok"])
        self.assertTrue(result["inventory"])
        self.assertEqual([], result["installProposal"])
        self.assertEqual("MISSING", result["dependencyStatus"]["prototype"]["status"])
        self.assertEqual("MISSING", result["dependencyStatus"]["wayfinder"]["status"])

    def test_route_plan_does_not_require_conditional_prototype_for_low_feature(self):
        plan = dependency_audit.route_dependency_plan(
            "FEATURE", risk="LOW", uncertainty="LOW", reduced=True
        )
        requirements = {item["name"]: item["requirement"] for item in plan}
        self.assertNotIn("prototype", requirements)
        self.assertNotIn("research", requirements)
        self.assertNotIn("scrutinize", requirements)

    def test_route_plan_is_progressive_and_stage_scoped(self):
        discovery = dependency_audit.route_dependency_plan("FEATURE")
        self.assertEqual(
            ["grill-with-docs", "grilling", "domain-modeling"],
            [item["name"] for item in discovery],
        )
        specification = dependency_audit.route_dependency_plan(
            "FEATURE", stage="SPECIFICATION"
        )
        self.assertEqual(["to-spec"], [item["name"] for item in specification])
        self.assertNotIn(
            "tdd", {item["name"] for item in specification}
        )
        inactive_exploration = dependency_audit.route_dependency_plan(
            "FEATURE", stage="EXPLORATION"
        )
        self.assertEqual([], inactive_exploration)
        prototype = dependency_audit.route_dependency_plan(
            "FEATURE", stage="EXPLORATION", stage_mode="PROTOTYPE"
        )
        self.assertEqual(["prototype"], [item["name"] for item in prototype])

    def test_conditional_prototype_can_be_a_later_required_dependency(self):
        result = self.audit(["prototype"])
        self.assertFalse(result["ok"])
        self.assertIn("prototype", result["missing"])
        self.assertEqual("mattpocock/skills", result["installProposal"][0]["source"])
        self.assertIsNone(result["installProposal"][0]["command"])

    def test_repository_setup_is_reported_separately_from_skill_installation(self):
        self.add_skill("to-spec")
        result = dependency_audit.audit_dependencies(
            ["to-spec"],
            "codex",
            [self.root],
            True,
            repository_root=self.root,
            require_repository_setup=True,
        )
        self.assertFalse(result["ok"])
        self.assertEqual("INSTALLED", result["dependencyStatus"]["to-spec"]["status"])
        self.assertEqual("MISSING", result["repositorySetup"]["status"])
        self.assertEqual("REPOSITORY_SETUP_REQUIRED", result["issues"][0]["code"])
        self.assertEqual([], result["installProposal"])

    def test_post_mortem_runtime_contract_is_not_hard_coded_in_registry(self):
        self.add_skill("post-mortem", plugin="9arm-skills")
        result = self.audit(["post-mortem"], runtime="claude", incident=True)
        self.assertTrue(result["ok"])
        self.assertNotIn(
            "supportsIncident",
            dependency_audit.DEPENDENCIES["post-mortem"],
        )
        self.assertEqual(
            "thananon/9arm-skills",
            result["resolutions"]["post-mortem"]["expectedSource"],
        )

    def test_codex_loads_exact_path_even_when_claude_frontmatter_is_user_only(self):
        skill = self.add_skill("implement", disable_model=True)
        result = self.audit(["implement"], runtime="codex")
        self.assertTrue(result["ok"])
        self.assertEqual("codex_load_path", result["resolutions"]["implement"]["invocationMode"])
        self.assertEqual(str(skill), result["resolutions"]["implement"]["invocationTarget"])

    def test_universal_runtime_and_capability_resolution(self):
        self.add_skill("research")
        result_no_subagents = self.audit(["research"], runtime="universal", has_subagents=False)
        self.assertFalse(result_no_subagents["ok"])
        self.assertEqual("SUBAGENT_CAPABILITY_REQUIRED", result_no_subagents["issues"][0]["code"])

        result_with_subagents = self.audit(["research"], runtime="universal", has_subagents=True)
        self.assertTrue(result_with_subagents["ok"])
        self.assertEqual("tool_or_skill", result_with_subagents["resolutions"]["research"]["invocationMode"])

    def test_build_parser_supports_universal_default_and_capability_flags(self):
        parser = dependency_audit.build_parser()
        args = parser.parse_args(["--require", "to-spec", "--capability", "has_subagents"])
        self.assertEqual("universal", args.runtime)
        self.assertIn("has_subagents", args.capability)


if __name__ == "__main__":
    unittest.main()
