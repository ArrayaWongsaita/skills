from __future__ import annotations

import importlib.util
import json
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest import mock


MODULE_PATH = Path(__file__).parents[1] / "scripts" / "workflow_state.py"
SPEC = importlib.util.spec_from_file_location("workflow_state", MODULE_PATH)
workflow_state = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(workflow_state)


class WorkflowStateTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def state(self, workflow_type="FEATURE"):
        return workflow_state.new_state(
            "add a useful behavior", workflow_type=workflow_type, root=self.root
        )

    def classify(self, state, workflow_type, risk="MEDIUM", uncertainty="MEDIUM"):
        state["workflowType"] = workflow_type
        state["risk"] = risk
        state["uncertainty"] = uncertainty
        return workflow_state.transition(state, "CLASSIFYING", "request received")

    def test_type_specific_forward_transitions_and_forbidden_jump(self):
        feature = self.classify(self.state(), "FEATURE")
        feature = workflow_state.transition(feature, "DISCOVERY", "feature route")
        feature = workflow_state.transition(feature, "SPECIFICATION", "intent settled")
        self.assertEqual("SPECIFICATION", feature["stage"])
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(feature, "CODE_REVIEW", "skip implementation")

        bug = self.classify(self.state("BUG"), "BUG")
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(bug, "DISCOVERY", "wrong bug route")
        self.assertEqual(
            "DIAGNOSIS",
            workflow_state.transition(bug, "DIAGNOSIS", "bug route")["stage"],
        )

    def test_stage_modes_support_bug_slices_and_exploration_investigations(self):
        bug = self.state("BUG")
        bug["stage"] = "DIAGNOSIS"
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(bug, "IMPLEMENTATION", "fix without regression", "FIX")
        bug = workflow_state.transition(
            bug, "IMPLEMENTATION", "write red test", "REGRESSION_TEST"
        )
        bug = workflow_state.transition(bug, "IMPLEMENTATION", "apply fix", "FIX")
        self.assertEqual("FIX", bug["stageMode"])
        self.assertNotIn("IMPLEMENTATION", bug["completedStages"])

        project = self.state("LARGE_PROJECT")
        project["stage"] = "WAYFINDING"
        project = workflow_state.transition(
            project, "EXPLORATION", "research unknown", "RESEARCH"
        )
        self.assertEqual("RESEARCH", project["stageMode"])
        project = workflow_state.transition(
            project, "PLANNING", "frontier bounded", "BOUND_FEATURES"
        )
        self.assertEqual("PLANNING", project["stage"])

    def test_large_project_returns_from_discovery_to_wayfinding(self):
        project = self.state("LARGE_PROJECT")
        project["stage"] = "DISCOVERY"
        returned = workflow_state.transition(
            project, "WAYFINDING", "domain frontier settled"
        )
        self.assertEqual("WAYFINDING", returned["stage"])
        feature = self.state("FEATURE")
        feature["stage"] = "DISCOVERY"
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(feature, "WAYFINDING", "wrong parent route")

    def test_design_review_backward_routes_are_explicit(self):
        state = self.classify(self.state(), "FEATURE")
        for target in ("DISCOVERY", "SPECIFICATION", "DESIGN_REVIEW"):
            state = workflow_state.transition(state, target, f"to {target}")
        for target in ("DISCOVERY", "EXPLORATION", "SPECIFICATION"):
            candidate = workflow_state.transition(state, target, "normalized design verdict")
            self.assertEqual(target, candidate["stage"])
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(state, "IMPLEMENTATION", "bypass planning")

    def test_reduced_feature_path_requires_low_stable_change(self):
        state = self.classify(self.state(), "FEATURE", "LOW", "LOW")
        state = workflow_state.transition(state, "DISCOVERY", "feature route")
        acceptance = self.root / ".scratch" / state["id"] / "acceptance.md"
        acceptance.parent.mkdir(parents=True)
        acceptance.write_text("subtitle preference is local", encoding="utf-8")
        state = workflow_state.register_artifact(
            state, self.root, "acceptance", acceptance.relative_to(self.root).as_posix(), "DISCOVERY"
        )
        self.assertEqual(
            "IMPLEMENTATION",
            workflow_state.transition(state, "IMPLEMENTATION", "small feature")["stage"],
        )
        state["changeCharacteristics"] = ["architecture-change"]
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(state, "IMPLEMENTATION", "not actually small")

    def test_classification_records_incident_as_bug_subtype(self):
        state = workflow_state.transition(self.state(None), "CLASSIFYING", "request")
        state = workflow_state.classify_state(
            state,
            "BUG",
            "CRITICAL",
            "HIGH",
            "duplicate production charges",
            ["money-movement", "concurrency"],
            incident=True,
        )
        self.assertEqual("BUG", state["workflowType"])
        self.assertEqual("INCIDENT", state["incidentSubtype"])
        with self.assertRaises(workflow_state.InvalidState):
            workflow_state.classify_state(
                state, "FEATURE", "LOW", "LOW", "not an incident", incident=True
            )
        low_risk = workflow_state.transition(self.state(None), "CLASSIFYING", "request")
        with self.assertRaises(workflow_state.InvalidState):
            workflow_state.classify_state(
                low_risk, "BUG", "MEDIUM", "HIGH", "small production incident", incident=True
            )

    def test_large_project_cannot_skip_wayfinding_or_create_parent_implementation(self):
        project = self.state("LARGE_PROJECT")
        project["stage"] = "DISCOVERY"
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(project, "SPECIFICATION", "skip wayfinding")
        project["stage"] = "PLANNING"
        project["stageMode"] = "BOUND_FEATURES"
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(project, "IMPLEMENTATION", "parent implementation")

    def test_revision_compare_and_swap_rejects_stale_writer(self):
        state = self.state()
        path = workflow_state.workflow_path(self.root, state["id"])
        written = workflow_state.atomic_write_state(path, state, None)
        first = workflow_state.transition(written, "CLASSIFYING", "first writer")
        first = workflow_state.atomic_write_state(path, first, 0)
        self.assertEqual(1, first["revision"])
        stale = workflow_state.transition(written, "CLASSIFYING", "stale writer")
        with self.assertRaises(workflow_state.ConcurrentUpdate):
            workflow_state.atomic_write_state(path, stale, 0)
        self.assertEqual(1, workflow_state.read_state(path)["revision"])

    def test_concurrent_compare_and_swap_allows_exactly_one_writer(self):
        state = self.state()
        path = workflow_state.workflow_path(self.root, state["id"])
        written = workflow_state.atomic_write_state(path, state, None)
        candidate = workflow_state.transition(written, "CLASSIFYING", "concurrent writer")
        barrier = threading.Barrier(2)

        def attempt():
            barrier.wait()
            try:
                workflow_state.atomic_write_state(path, candidate, 0)
                return "saved"
            except workflow_state.ConcurrentUpdate:
                return "conflict"

        with ThreadPoolExecutor(max_workers=2) as executor:
            outcomes = sorted(executor.map(lambda _: attempt(), range(2)))
        self.assertEqual(["conflict", "saved"], outcomes)
        self.assertEqual(1, workflow_state.read_state(path)["revision"])

    def test_atomic_replace_failure_preserves_valid_target(self):
        state = self.state()
        path = workflow_state.workflow_path(self.root, state["id"])
        written = workflow_state.atomic_write_state(path, state, None)
        changed = workflow_state.transition(written, "CLASSIFYING", "update")
        with mock.patch.object(workflow_state.os, "replace", side_effect=OSError("simulated crash")):
            with self.assertRaises(OSError):
                workflow_state.atomic_write_state(path, changed, 0)
        self.assertEqual("IDLE", workflow_state.read_state(path)["stage"])
        self.assertEqual([], list(path.parent.glob("*.tmp")))

    def test_invalid_and_partial_json_are_rejected(self):
        path = self.root / "partial.json"
        path.write_text('{"workflowVersion": 1', encoding="utf-8")
        with self.assertRaises(workflow_state.InvalidState):
            workflow_state.read_state(path)
        path.write_text(json.dumps({"workflowVersion": 1}), encoding="utf-8")
        with self.assertRaises(workflow_state.InvalidState):
            workflow_state.read_state(path)
        malformed = self.state()
        malformed["artifactRefs"] = [{"path": "spec.md"}]
        path.write_text(json.dumps(malformed), encoding="utf-8")
        with self.assertRaises(workflow_state.InvalidState):
            workflow_state.read_state(path)

    def test_init_and_artifact_registration_are_idempotent(self):
        first, path, created = workflow_state.init_workflow(
            self.root, "same request", "FEATURE"
        )
        again, second_path, second_created = workflow_state.init_workflow(
            self.root, "same   request", "FEATURE"
        )
        self.assertTrue(created)
        self.assertFalse(second_created)
        self.assertEqual(path, second_path)
        self.assertEqual(first["id"], again["id"])

        artifact = self.root / ".scratch" / first["id"] / "spec.md"
        artifact.parent.mkdir(parents=True)
        artifact.write_text("specification", encoding="utf-8")
        relative = artifact.relative_to(self.root).as_posix()
        registered = workflow_state.register_artifact(
            first, self.root, "spec", relative, "SPECIFICATION"
        )
        duplicate = workflow_state.register_artifact(
            registered, self.root, "spec", relative, "SPECIFICATION"
        )
        self.assertIs(registered, duplicate)
        self.assertEqual(1, len(duplicate["artifactRefs"]))

    def test_review_registration_reuses_stable_kind(self):
        state = self.state()
        first = self.root / ".scratch" / state["id"] / "reviews" / "code.md"
        first.parent.mkdir(parents=True)
        first.write_text("cycle 1", encoding="utf-8")
        state = workflow_state.register_artifact(
            state, self.root, "code-review", first.relative_to(self.root).as_posix(), "CODE_REVIEW"
        )
        second = first.parent / "accidental-duplicate.md"
        second.write_text("cycle 2", encoding="utf-8")
        with self.assertRaises(workflow_state.InvalidState):
            workflow_state.register_artifact(
                state,
                self.root,
                "code-review",
                second.relative_to(self.root).as_posix(),
                "CODE_REVIEW",
            )
        self.assertEqual(1, len(state["artifactRefs"]))
        self.assertTrue(state["artifactRefs"][0]["path"].endswith("code.md"))

    def test_artifact_fingerprint_reconciliation_rewinds_earliest_producer(self):
        state = self.state()
        spec = self.root / ".scratch" / state["id"] / "spec.md"
        review = spec.parent / "reviews" / "code.md"
        review.parent.mkdir(parents=True)
        spec.write_text("v1", encoding="utf-8")
        review.write_text("pass", encoding="utf-8")
        state = workflow_state.register_artifact(
            state, self.root, "spec", spec.relative_to(self.root).as_posix(), "SPECIFICATION"
        )
        state = workflow_state.register_artifact(
            state, self.root, "code-review", review.relative_to(self.root).as_posix(), "CODE_REVIEW"
        )
        state["stage"] = "SYSTEM_REVIEW"
        state["completedStages"] = ["SPECIFICATION", "IMPLEMENTATION", "CODE_REVIEW"]
        spec.write_text("v2", encoding="utf-8")
        reconciled, reasons = workflow_state.reconcile_state(state, self.root)
        self.assertEqual("SPECIFICATION", reconciled["stage"])
        self.assertTrue(any("changed artifact" in reason for reason in reasons))
        self.assertNotIn("CODE_REVIEW", reconciled["completedStages"])

    def test_git_ref_and_verification_reconciliation_rewinds_implementation(self):
        state = self.state()
        state["stage"] = "COMPLETE"
        state["status"] = "COMPLETE"
        state["lastVerifiedGitRef"] = "nonexistent-ref"
        state["verificationCommands"] = [["python3", "-c", "raise SystemExit(3)"]]
        reconciled, reasons = workflow_state.reconcile_state(state, self.root, run_checks=True)
        self.assertEqual("IMPLEMENTATION", reconciled["stage"])
        self.assertEqual("IN_PROGRESS", reconciled["status"])
        self.assertTrue(any("verification failed" in reason for reason in reasons))

    def test_multiple_active_workflows_require_one_selection(self):
        first, _, _ = workflow_state.init_workflow(self.root, "first feature", "FEATURE")
        second, _, _ = workflow_state.init_workflow(self.root, "second feature", "FEATURE")
        with self.assertRaises(workflow_state.MultipleActiveWorkflows) as captured:
            workflow_state.select_active(self.root)
        self.assertEqual(sorted([first["id"], second["id"]]), captured.exception.workflow_ids)
        self.assertEqual(first["id"], workflow_state.select_active(self.root, first["id"])["id"])

    def test_complete_state_is_retained_but_hidden_from_default_list(self):
        state = self.state()
        path = workflow_state.workflow_path(self.root, state["id"])
        state["stage"] = "COMPLETE"
        state["status"] = "COMPLETE"
        workflow_state.atomic_write_state(path, state, None)
        self.assertTrue(path.exists())
        self.assertEqual([], workflow_state.list_states(self.root))
        self.assertEqual(1, len(workflow_state.list_states(self.root, include_complete=True)))
        reused, reused_path, created = workflow_state.init_workflow(
            self.root, "add a useful behavior", "FEATURE"
        )
        self.assertFalse(created)
        self.assertEqual(path, reused_path)
        self.assertEqual("COMPLETE", reused["status"])

    def test_gate_cycles_one_to_three_then_block(self):
        state = self.state()
        state["stage"] = "CODE_REVIEW"
        for expected in (1, 2):
            state = workflow_state.record_gate(state, "code", ["behavior-mismatch"])
            self.assertEqual(expected, state["gateCycles"]["code"])
            self.assertEqual("IN_PROGRESS", state["status"])
        state = workflow_state.record_gate(state, "code", ["behavior-mismatch"])
        self.assertEqual(3, state["gateCycles"]["code"])
        self.assertEqual("BLOCKED", state["stage"])
        self.assertEqual("GATE_BUDGET_EXHAUSTED", state["blocker"]["code"])
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.record_gate(state, "code", ["behavior-mismatch"])

    def test_block_and_resume_restore_stage_mode(self):
        state = self.state()
        state["stage"] = "IMPLEMENTATION"
        state["stageMode"] = "REVIEW_FIX"
        state = workflow_state.block_state(
            state, "MISSING_AUTHORITY", "approval required", return_stage="IMPLEMENTATION"
        )
        self.assertEqual("REVIEW_FIX", state["blocker"]["returnStageMode"])
        resumed = workflow_state.unblock_state(state, "approval verified")
        self.assertEqual("IMPLEMENTATION", resumed["stage"])
        self.assertEqual("REVIEW_FIX", resumed["stageMode"])

    def test_emergency_mitigation_never_completes(self):
        state = self.state("BUG")
        state["stage"] = "DIAGNOSIS"
        state = workflow_state.transition(
            state,
            "IMPLEMENTATION",
            "human approved mitigation",
            "EMERGENCY_MITIGATION",
        )
        self.assertTrue(state["mitigationOutstanding"])
        state["stage"] = "SYSTEM_REVIEW"
        state["stageMode"] = None
        state["mitigationOutstanding"] = True
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(state, "COMPLETE", "mitigation reviewed")
        self.assertEqual(
            "DIAGNOSIS",
            workflow_state.transition(state, "DIAGNOSIS", "resume root-cause work")["stage"],
        )

    def test_completion_requires_evidence_gate_and_reproducible_checks(self):
        state = self.state()
        state["stage"] = "CODE_REVIEW"
        state["risk"] = "LOW"
        implementation = self.root / ".scratch" / state["id"] / "evidence" / "implementation.md"
        review = self.root / ".scratch" / state["id"] / "reviews" / "code.md"
        implementation.parent.mkdir(parents=True)
        review.parent.mkdir(parents=True)
        implementation.write_text("verified", encoding="utf-8")
        review.write_text("pass", encoding="utf-8")
        state = workflow_state.register_artifact(
            state,
            self.root,
            "implementation",
            implementation.relative_to(self.root).as_posix(),
            "IMPLEMENTATION",
        )
        state = workflow_state.register_artifact(
            state,
            self.root,
            "code-review",
            review.relative_to(self.root).as_posix(),
            "CODE_REVIEW",
        )
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(state, "COMPLETE", "premature", root=self.root)
        state = workflow_state.record_gate(state, "code", [])
        state, results = workflow_state.run_verification(
            state, self.root, [["python3", "-c", "print('verified')"]]
        )
        self.assertEqual(0, results[0]["returncode"])
        completed = workflow_state.transition(
            state, "COMPLETE", "all evidence valid", root=self.root
        )
        self.assertEqual("COMPLETE", completed["status"])

    def test_system_sensitive_code_cannot_skip_system_review(self):
        state = self.state("BUG")
        state["stage"] = "CODE_REVIEW"
        state["risk"] = "HIGH"
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(state, "POST_MORTEM", "skip system gate")
        feature = self.state("FEATURE")
        feature["stage"] = "CODE_REVIEW"
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(feature, "POST_MORTEM", "wrong workflow type")

    def test_large_project_completion_validates_each_child_state(self):
        parent = self.state("LARGE_PROJECT")
        parent["stage"] = "WAYFINDING"
        child = workflow_state.new_state(
            "bounded child",
            workflow_type="FEATURE",
            parent_workflow_id=parent["id"],
            root=self.root,
        )
        child_path = workflow_state.workflow_path(self.root, child["id"])
        workflow_state.atomic_write_state(child_path, child, None)
        parent = workflow_state.add_child_workflow(parent, self.root, child["id"])
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(parent, "COMPLETE", "child not done", root=self.root)
        child["stage"] = "COMPLETE"
        child["status"] = "COMPLETE"
        workflow_state.atomic_write_state(child_path, child, 0)
        completed = workflow_state.transition(
            parent, "COMPLETE", "destination satisfied", root=self.root
        )
        self.assertEqual("COMPLETE", completed["stage"])

    def test_design_scrutinize_passes_on_cycle_five_without_running_cycle_six(self):
        state = self.state()
        state["stage"] = "DESIGN_REVIEW"
        for cycle in range(1, 5):
            state = workflow_state.record_scrutinize(
                state,
                "design",
                "FIX_THEN_SHIP",
                [f"finding-{cycle}"],
                reason_for_retry=f"repair finding {cycle}",
                changed_artifacts=[".scratch/spec.md"],
            )
            self.assertEqual(cycle, state["designScrutinizeCycles"])
            self.assertEqual("IN_PROGRESS", state["status"])
        state = workflow_state.record_scrutinize(
            state, "design", "PASS", review_ref="reviews/design.md"
        )
        self.assertEqual(5, state["designScrutinizeCycles"])
        self.assertEqual(5, state["gateCycles"]["design"])
        self.assertEqual("SHIP", state["scrutinizeHistory"]["design"][-1]["verdict"])
        self.assertEqual("IN_PROGRESS", state["status"])
        self.assertEqual("PLANNING", workflow_state.transition(
            state, "PLANNING", "design gate passed"
        )["stage"])

    def test_design_review_cannot_advance_to_planning_without_scrutinize_ship(self):
        state = self.state()
        state["stage"] = "DESIGN_REVIEW"
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.transition(state, "PLANNING", "skip blocking gate")

    def test_design_scrutinize_blocks_on_cycle_six_and_rejects_cycle_seven(self):
        state = self.state()
        state["stage"] = "DESIGN_REVIEW"
        for cycle in range(1, workflow_state.MAX_SCRUTINIZE_CYCLES + 1):
            state = workflow_state.record_scrutinize(
                state,
                "design",
                "REWORK" if cycle == 3 else "FIX_THEN_SHIP",
                [f"unresolved-{cycle}"],
                reason_for_retry=f"cycle {cycle} still needs a decision",
            )
        self.assertEqual(6, state["designScrutinizeCycles"])
        self.assertEqual(6, len(state["scrutinizeHistory"]["design"]))
        self.assertEqual("BLOCKED", state["stage"])
        self.assertEqual("GATE_BUDGET_EXHAUSTED", state["blocker"]["code"])
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.record_scrutinize(
                state,
                "design",
                "FIX_THEN_SHIP",
                ["cycle-seven"],
                reason_for_retry="must not run",
            )

    def test_design_and_system_scrutinize_counters_are_independent(self):
        state = self.state()
        state["stage"] = "DESIGN_REVIEW"
        state = workflow_state.record_scrutinize(state, "design", "SHIP")
        state["stage"] = "SYSTEM_REVIEW"
        state = workflow_state.record_scrutinize(state, "system", "SHIP")
        self.assertEqual(1, state["designScrutinizeCycles"])
        self.assertEqual(1, state["systemScrutinizeCycles"])
        self.assertEqual(1, state["gateCycles"]["design"])
        self.assertEqual(1, state["gateCycles"]["system"])
        self.assertEqual(6, state["gateBudgets"]["design"])
        self.assertEqual(6, state["gateBudgets"]["system"])

    def test_system_scrutinize_also_stops_at_cycle_six(self):
        state = self.state()
        state["stage"] = "SYSTEM_REVIEW"
        for cycle in range(1, workflow_state.MAX_SCRUTINIZE_CYCLES + 1):
            state = workflow_state.record_scrutinize(
                state,
                "system",
                "FIX_THEN_SHIP",
                [f"system-finding-{cycle}"],
                reason_for_retry=f"system cycle {cycle}",
            )
        self.assertEqual(6, state["systemScrutinizeCycles"])
        self.assertEqual("BLOCKED", state["stage"])
        self.assertEqual("GATE_BUDGET_EXHAUSTED", state["blocker"]["code"])
        self.assertEqual(0, state["designScrutinizeCycles"])

    def test_design_rework_and_reject_route_backward_without_resetting_counter(self):
        state = self.state()
        state["stage"] = "DESIGN_REVIEW"
        state = workflow_state.record_scrutinize(
            state, "design", "REWORK", ["unsafe seam"], reason_for_retry="seam is unsound"
        )
        state = workflow_state.transition(state, "SPECIFICATION", "revise design")
        state = workflow_state.transition(state, "DESIGN_REVIEW", "revised specification")
        state = workflow_state.record_scrutinize(state, "design", "SHIP")
        self.assertEqual(2, state["designScrutinizeCycles"])

        rejected = self.state()
        rejected["stage"] = "DESIGN_REVIEW"
        rejected = workflow_state.record_scrutinize(
            rejected, "design", "REJECT", ["requirement is not viable"],
            reason_for_retry="product decision required",
        )
        rejected = workflow_state.transition(rejected, "DISCOVERY", "reconsider scope")
        self.assertEqual("DISCOVERY", rejected["stage"])
        self.assertEqual(1, rejected["designScrutinizeCycles"])

    def test_no_progress_stops_before_the_hard_maximum(self):
        state = self.state()
        state["stage"] = "DESIGN_REVIEW"
        state = workflow_state.record_scrutinize(
            state, "design", "FIX_THEN_SHIP", ["same invariant"],
            reason_for_retry="first attempted fix", changed_artifacts=["spec.md"],
        )
        state = workflow_state.record_scrutinize(
            state, "design", "FIX_THEN_SHIP", ["same invariant"],
            reason_for_retry="second attempted fix", changed_artifacts=["spec.md"],
        )
        self.assertEqual(2, state["designScrutinizeCycles"])
        self.assertEqual("BLOCKED", state["stage"])
        self.assertEqual("SCRUTINIZE_NO_PROGRESS", state["blocker"]["code"])
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.restart_scrutinize_series(
                state, "design", "missing explicit human authorization"
            )
        restarted = workflow_state.restart_scrutinize_series(
            state,
            "design",
            "architecture owner approved a materially new approach",
            human_authorized=True,
            materially_new_solution=True,
        )
        self.assertEqual("DESIGN_REVIEW", restarted["stage"])
        self.assertEqual(0, restarted["designScrutinizeCycles"])
        self.assertEqual([], restarted["scrutinizeHistory"]["design"])

    def test_final_scrutinize_fix_returns_through_code_review(self):
        state = self.state()
        state["stage"] = "SYSTEM_REVIEW"
        state = workflow_state.record_scrutinize(
            state, "system", "FIX_THEN_SHIP", ["retry path is unsafe"],
            reason_for_retry="implementation fix required",
        )
        state = workflow_state.transition(
            state, "IMPLEMENTATION", "apply system-review fix", "REVIEW_FIX"
        )
        state = workflow_state.transition(state, "CODE_REVIEW", "review changed implementation")
        state = workflow_state.record_gate(state, "code", [])
        state = workflow_state.transition(state, "SYSTEM_REVIEW", "code review passed")
        self.assertEqual("SYSTEM_REVIEW", state["stage"])
        self.assertEqual(1, state["gateCycles"]["code"])
        self.assertEqual(1, state["systemScrutinizeCycles"])
        state = workflow_state.record_scrutinize(state, "system", "SHIP")
        self.assertEqual(2, state["systemScrutinizeCycles"])

    def test_dependency_permission_is_explicit_and_approved_install_requires_reaudit(self):
        state = self.state()
        state["stage"] = "DESIGN_REVIEW"
        state = workflow_state.request_installation_permission(
            state,
            [{
                "name": "scrutinize",
                "owner": "thananon",
                "repository": "thananon/9arm-skills",
                "purpose": "blocking design quality gate",
                "neededAt": "DESIGN_REVIEW",
                "installCommand": "npx skills@latest add thananon/9arm-skills --skill=scrutinize",
                "installScope": "project-local",
                "verifiedCommand": True,
            }],
            "DESIGN_REVIEW",
            "required before design review",
            [{
                "owner": "thananon",
                "source": "thananon/9arm-skills",
                "skills": ["scrutinize"],
                "command": "npx skills@latest add thananon/9arm-skills --skill=scrutinize",
                "installScope": "project-local",
                "verified": True,
                "requiresApproval": True,
            }],
        )
        self.assertEqual("BLOCKED_DEPENDENCY", state["blocker"]["code"])
        self.assertEqual("PENDING", state["pendingInstallationPermission"]["decision"])
        state = workflow_state.record_installation_decision(
            state, True, "user approved the exact project-local command"
        )
        self.assertEqual("DEPENDENCY_RELOAD_REQUIRED", state["blocker"]["code"])
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.unblock_state(state, "before re-audit")
        state = workflow_state.record_dependency_audit(
            state,
            {
                "version": 2,
                "resolutions": {},
                "dependencyStatus": {
                    "scrutinize": {
                        "status": "INSTALLED",
                        "provenanceStatus": "VERIFIED",
                    }
                },
            },
        )
        self.assertIsNone(state["blockedDependency"])
        self.assertIsNone(state["pendingInstallationPermission"])
        self.assertEqual("DESIGN_REVIEW", workflow_state.unblock_state(
            state, "re-audit verified the dependency"
        )["stage"])

    def test_dependency_audit_state_discards_arbitrary_shell_output(self):
        state = self.state()
        state = workflow_state.record_dependency_audit(
            state,
            {
                "version": 2,
                "resolutions": {
                    "scrutinize": {
                        "path": ".agents/skills/scrutinize/SKILL.md",
                        "stdout": "secret command output",
                        "content_hash": "sha256:abc",
                    }
                },
                "dependencyStatus": {
                    "scrutinize": {
                        "status": "INSTALLED",
                        "stdout": "another secret",
                        "provenanceStatus": "VERIFIED",
                    }
                },
            },
        )
        serialized = json.dumps(state)
        self.assertNotIn("secret command output", serialized)
        self.assertNotIn("another secret", serialized)

    def test_declining_dependency_installation_keeps_workflow_blocked(self):
        state = self.state()
        state["stage"] = "DESIGN_REVIEW"
        state = workflow_state.request_installation_permission(
            state, ["scrutinize"], "DESIGN_REVIEW", "design gate cannot run", []
        )
        state = workflow_state.record_installation_decision(state, False, "not trusted")
        self.assertEqual("BLOCKED", state["status"])
        self.assertEqual("BLOCKED_DEPENDENCY", state["blocker"]["code"])
        self.assertEqual("DECLINED", state["blockedDependency"]["decision"])
        self.assertEqual("DECLINED", state["pendingInstallationPermission"]["decision"])
        with self.assertRaises(workflow_state.InvalidTransition):
            workflow_state.unblock_state(state, "decline is not resolution")

    def test_legacy_state_migrates_to_six_cycle_schema_without_losing_gate_counts(self):
        legacy = self.state()
        legacy["workflowVersion"] = 1
        legacy["gateCycles"]["design"] = 2
        legacy["gateBudgets"] = {gate: 3 for gate in workflow_state.GATES}
        for field in (
            "designScrutinizeCycles", "systemScrutinizeCycles", "scrutinizeHistory",
            "dependencyStatus", "blockedDependency", "pendingInstallationPermission",
        ):
            del legacy[field]
        migrated = workflow_state.migrate_state(legacy)
        workflow_state.validate_state(migrated)
        self.assertEqual(2, migrated["designScrutinizeCycles"])
        self.assertEqual(6, migrated["gateBudgets"]["design"])
        self.assertEqual(6, migrated["gateBudgets"]["system"])

    def test_reconstructs_existing_default_artifacts_without_writing_them(self):
        workflow_id = "recover-existing"
        spec = self.root / workflow_state.default_artifact_path(workflow_id, "spec")
        evidence = self.root / workflow_state.default_artifact_path(workflow_id, "implementation")
        spec.parent.mkdir(parents=True)
        evidence.parent.mkdir(parents=True)
        spec.write_text("approved", encoding="utf-8")
        evidence.write_text("tests pass", encoding="utf-8")
        before = (spec.read_text(), evidence.read_text())
        state = workflow_state.reconstruct_from_artifacts(
            self.root, "recover work", workflow_id
        )
        self.assertEqual("IMPLEMENTATION", state["stage"])
        self.assertEqual(2, len(state["artifactRefs"]))
        self.assertEqual(before, (spec.read_text(), evidence.read_text()))

    def test_schema_required_fields_match_runtime_state_contract(self):
        schema_path = Path(__file__).parents[1] / "references" / "workflow-state.schema.json"
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        self.assertEqual(workflow_state.REQUIRED_FIELDS, set(schema["required"]))
        self.assertEqual(
            set(workflow_state.STAGES), set(schema["properties"]["stage"]["enum"])
        )
        machine_path = Path(__file__).parents[1] / "references" / "state-machine.json"
        machine = json.loads(machine_path.read_text(encoding="utf-8"))
        self.assertEqual(
            workflow_state.TRANSITIONS,
            {stage: set(targets) for stage, targets in machine["transitions"].items()},
        )
        self.assertEqual(6, machine["scrutinizePolicy"]["maxCyclesPerGate"])
        self.assertTrue(machine["scrutinizePolicy"]["noProgressEarlyStop"])
        self.assertFalse(machine["scrutinizePolicy"]["automaticCycleSeven"])


if __name__ == "__main__":
    unittest.main()
