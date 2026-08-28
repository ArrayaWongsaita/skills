from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).parents[1]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    assert spec.loader
    spec.loader.exec_module(module)
    return module


workflow_state = load_module(
    "workflow_transition_state", SKILL_ROOT / "scripts" / "workflow_state.py"
)
dependency_audit = load_module(
    "workflow_transition_dependencies",
    SKILL_ROOT / "scripts" / "dependency_audit.py",
)


class WorkflowTransitionIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def start(
        self,
        workflow_type: str,
        *,
        risk: str = "LOW",
        uncertainty: str = "LOW",
        incident: bool = False,
    ):
        state = workflow_state.new_state(
            f"integration {workflow_type.lower()}",
            workflow_type=workflow_type,
            root=self.root,
        )
        state = workflow_state.transition(state, "CLASSIFYING", "request received")
        state = workflow_state.classify_state(
            state,
            workflow_type,
            risk,
            uncertainty,
            f"bounded {workflow_type.lower()} scope",
            ["system-review-required"] if risk in {"HIGH", "CRITICAL"} else [],
            incident=incident,
        )
        return workflow_state.transition(
            state, workflow_state.TYPE_ENTRY[workflow_type], "classified route"
        )

    def artifact(self, state, kind: str, producer: str, text: str | None = None):
        relative = workflow_state.default_artifact_path(state["id"], kind)
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text or f"{kind} evidence", encoding="utf-8")
        return workflow_state.register_artifact(
            state, self.root, kind, relative, producer
        )

    def verify(self, state):
        state, results = workflow_state.run_verification(
            state, self.root, [["python3", "-c", "pass"]]
        )
        self.assertEqual(0, results[0]["returncode"])
        return state

    def reach_design_review(self):
        state = self.start("FEATURE", risk="MEDIUM", uncertainty="MEDIUM")
        self.assertEqual("DISCOVERY", state["stage"])
        state = workflow_state.transition(state, "SPECIFICATION", "intent settled")
        state = self.artifact(state, "spec", "SPECIFICATION")
        return workflow_state.transition(state, "DESIGN_REVIEW", "spec published")

    def reach_code_review(self, *, risk="LOW"):
        state = self.reach_design_review()
        state["risk"] = risk
        if risk in {"HIGH", "CRITICAL"}:
            state["changeCharacteristics"] = ["system-review-required"]
        state = workflow_state.record_scrutinize(state, "design", "SHIP")
        state = workflow_state.transition(state, "PLANNING", "design SHIP")
        state = workflow_state.transition(state, "IMPLEMENTATION", "ticket selected")
        state = self.artifact(state, "implementation", "IMPLEMENTATION")
        state = self.verify(state)
        state = workflow_state.transition(state, "CODE_REVIEW", "implementation verified")
        state = self.artifact(state, "code-review", "CODE_REVIEW")
        return state

    def test_normal_feature_routes_end_to_end(self):
        state = self.reach_code_review()
        state = workflow_state.record_gate(state, "code", [])
        state = workflow_state.transition(
            state, "COMPLETE", "code review passed", root=self.root
        )

        self.assertEqual("COMPLETE", state["stage"])
        self.assertEqual(
            [
                "IDLE",
                "CLASSIFYING",
                "DISCOVERY",
                "SPECIFICATION",
                "DESIGN_REVIEW",
                "PLANNING",
                "IMPLEMENTATION",
                "CODE_REVIEW",
            ],
            state["completedStages"],
        )

    def test_design_scrutinize_retry_then_ship_routes_to_planning(self):
        state = self.reach_design_review()
        state = workflow_state.record_scrutinize(
            state,
            "design",
            "FIX_THEN_SHIP",
            ["failure contract is ambiguous"],
            changed_artifacts=[".scratch/spec.md"],
            reason_for_retry="clarify the failure contract",
        )
        state = workflow_state.record_scrutinize(state, "design", "SHIP")
        state = workflow_state.transition(state, "PLANNING", "cycle two SHIP")

        self.assertEqual("PLANNING", state["stage"])
        self.assertEqual(2, state["designScrutinizeCycles"])

    def test_design_scrutinize_cycle_six_blocks_and_cycle_seven_is_impossible(self):
        state = self.reach_design_review()
        for cycle in range(1, 7):
            state = workflow_state.record_scrutinize(
                state,
                "design",
                "FIX_THEN_SHIP",
                [f"unresolved-{cycle}"],
                reason_for_retry=f"cycle {cycle} remains unresolved",
            )

        self.assertEqual("BLOCKED", state["stage"])
        self.assertEqual(6, state["designScrutinizeCycles"])
        self.assertEqual("GATE_BUDGET_EXHAUSTED", state["blocker"]["code"])
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.record_scrutinize(
                state,
                "design",
                "FIX_THEN_SHIP",
                ["automatic-cycle-seven"],
                reason_for_retry="forbidden",
            )

    def test_repeated_blocker_stops_for_no_progress_before_cycle_six(self):
        state = self.reach_design_review()
        state = workflow_state.record_scrutinize(
            state,
            "design",
            "FIX_THEN_SHIP",
            ["same product-owned decision"],
            reason_for_retry="first attempt",
        )
        state = workflow_state.record_scrutinize(
            state,
            "design",
            "FIX_THEN_SHIP",
            ["same product-owned decision"],
            reason_for_retry="no automatic decision is available",
        )

        self.assertEqual("BLOCKED", state["stage"])
        self.assertLess(state["designScrutinizeCycles"], 6)
        self.assertEqual("SCRUTINIZE_NO_PROGRESS", state["blocker"]["code"])

    def test_blocking_code_review_and_design_reject_cannot_advance(self):
        code = self.reach_code_review()
        code = workflow_state.record_gate(code, "code", ["acceptance mismatch"])
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(
                code, "COMPLETE", "ignore blocking review", root=self.root
            )

        design = self.reach_design_review()
        design = workflow_state.record_scrutinize(
            design,
            "design",
            "REJECT",
            ["product outcome is not viable"],
            reason_for_retry="human product decision required",
        )
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(design, "IMPLEMENTATION", "ignore rejection")
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(design, "PLANNING", "treat rejection as ship")

    def test_final_system_fix_must_pass_validation_and_code_review_before_retry(self):
        state = self.reach_code_review(risk="HIGH")
        state = workflow_state.record_gate(state, "code", [])
        state = workflow_state.transition(state, "SYSTEM_REVIEW", "code review passed")
        state = workflow_state.record_scrutinize(
            state,
            "system",
            "FIX_THEN_SHIP",
            ["retry path can duplicate a side effect"],
            reason_for_retry="implementation fix required",
        )

        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.record_scrutinize(state, "system", "SHIP")
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(
                state, "COMPLETE", "failed final review", root=self.root
            )

        state = workflow_state.transition(
            state, "IMPLEMENTATION", "fix final finding", "REVIEW_FIX"
        )
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(state, "CODE_REVIEW", "skip fresh checks")
        state = self.artifact(
            state, "implementation", "IMPLEMENTATION", "fixed retry path"
        )
        state = self.verify(state)
        state = workflow_state.transition(state, "CODE_REVIEW", "fresh checks passed")
        state = self.artifact(
            state, "code-review", "CODE_REVIEW", "reviewed final-system fix"
        )
        state = workflow_state.record_gate(state, "code", [])
        state = workflow_state.transition(state, "SYSTEM_REVIEW", "fix reviewed")
        state = workflow_state.record_scrutinize(state, "system", "SHIP")

        self.assertEqual(2, state["systemScrutinizeCycles"])
        self.assertEqual(2, state["gateCycles"]["code"])
        self.assertEqual("SYSTEM_REVIEW", state["stage"])

    def test_bug_routes_through_diagnosis_regression_fix_and_review(self):
        state = self.start("BUG")
        state = self.artifact(state, "diagnosis", "DIAGNOSIS", "confirmed root cause")
        state = self.artifact(state, "regression", "DIAGNOSIS", "red regression evidence")
        state = workflow_state.transition(
            state, "IMPLEMENTATION", "write regression", "REGRESSION_TEST"
        )
        state = workflow_state.transition(state, "IMPLEMENTATION", "apply fix", "FIX")
        state = self.artifact(state, "implementation", "IMPLEMENTATION")
        state = self.verify(state)
        state = workflow_state.transition(state, "CODE_REVIEW", "fix verified")
        state = self.artifact(state, "code-review", "CODE_REVIEW")
        state = workflow_state.record_gate(state, "code", [])
        state = workflow_state.transition(
            state, "COMPLETE", "bug fix reviewed", root=self.root
        )

        self.assertEqual("COMPLETE", state["stage"])
        self.assertIn("DIAGNOSIS", state["completedStages"])

    def test_incident_requires_root_cause_system_review_and_post_mortem(self):
        state = self.start("BUG", risk="HIGH", uncertainty="HIGH", incident=True)
        state = self.artifact(state, "diagnosis", "DIAGNOSIS", "validated root cause")
        state = self.artifact(state, "regression", "DIAGNOSIS", "incident regression")
        state = workflow_state.transition(
            state, "IMPLEMENTATION", "red incident regression", "REGRESSION_TEST"
        )
        state = workflow_state.transition(state, "IMPLEMENTATION", "validated fix", "FIX")
        state = self.artifact(state, "implementation", "IMPLEMENTATION")
        state = self.verify(state)
        state = workflow_state.transition(state, "CODE_REVIEW", "fix verified")
        state = self.artifact(state, "code-review", "CODE_REVIEW")
        state = workflow_state.record_gate(state, "code", [])
        state = workflow_state.transition(state, "SYSTEM_REVIEW", "high-risk fix")
        state = workflow_state.record_scrutinize(state, "system", "SHIP")

        missing_root_cause = dict(state)
        missing_root_cause["artifactRefs"] = [
            item for item in state["artifactRefs"] if item["kind"] != "diagnosis"
        ]
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(
                missing_root_cause, "POST_MORTEM", "missing root cause"
            )

        state = workflow_state.transition(state, "POST_MORTEM", "system gate passed")
        state = self.artifact(state, "post-mortem", "POST_MORTEM")
        state = workflow_state.transition(
            state, "COMPLETE", "incident record complete", root=self.root
        )
        self.assertEqual("COMPLETE", state["stage"])

    def test_large_project_wayfinding_creates_bounded_features_not_parent_implementation(self):
        state = self.start("LARGE_PROJECT", uncertainty="HIGH")
        state = workflow_state.transition(
            state, "PLANNING", "bounded feature frontier", "BOUND_FEATURES"
        )

        self.assertEqual("PLANNING", state["stage"])
        self.assertEqual("BOUND_FEATURES", state["stageMode"])
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(
                state, "IMPLEMENTATION", "giant speculative parent implementation"
            )

    def test_resume_keeps_valid_implementation_state(self):
        state = self.start("FEATURE")
        state = self.artifact(state, "acceptance", "DISCOVERY")
        state = workflow_state.transition(state, "IMPLEMENTATION", "reduced local feature")
        path = workflow_state.workflow_path(self.root, state["id"])
        saved = workflow_state.atomic_write_state(path, state, None)

        selected = workflow_state.select_active(self.root, state["id"])
        reconciled, reasons = workflow_state.reconcile_state(selected, self.root)

        self.assertEqual([], reasons)
        self.assertEqual("IMPLEMENTATION", reconciled["stage"])
        self.assertEqual(saved["revision"], reconciled["revision"])
        self.assertNotIn("DISCOVERY", [item["to"] for item in reconciled["transitionHistory"][-1:]])

    def test_missing_dependency_blocks_before_stage_and_requires_verified_permission(self):
        audit = dependency_audit.audit_dependencies(
            ["scrutinize"], "codex", [self.root], has_subagents=True
        )
        self.assertFalse(audit["ok"])
        self.assertEqual(["scrutinize"], audit["missing"])
        self.assertFalse(audit["installProposal"][0]["verified"])

        state = self.start("FEATURE", risk="MEDIUM", uncertainty="MEDIUM")
        state = workflow_state.transition(state, "SPECIFICATION", "intent settled")
        with self.assertRaises(workflow_state.InvalidState):
            workflow_state.request_installation_permission(
                state,
                ["scrutinize"],
                "DESIGN_REVIEW",
                "blocking gate dependency is missing",
                audit["installProposal"],
            )

        verified = [{
            **audit["installProposal"][0],
            "method": "runtime-skill-installer",
            "command": "runtime-skill-installer add thananon/9arm-skills scrutinize",
            "installScope": "project-local",
            "verified": True,
        }]
        state = workflow_state.request_installation_permission(
            state,
            [{
                "name": "scrutinize",
                "owner": "thananon",
                "repository": "thananon/9arm-skills",
                "neededAt": "DESIGN_REVIEW",
            }],
            "DESIGN_REVIEW",
            "blocking gate dependency is missing",
            verified,
        )

        self.assertEqual("BLOCKED", state["stage"])
        self.assertEqual("BLOCKED_DEPENDENCY", state["blocker"]["code"])
        self.assertEqual("PENDING", state["pendingInstallationPermission"]["decision"])
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(state, "DESIGN_REVIEW", "skip dependency")


if __name__ == "__main__":
    unittest.main()
