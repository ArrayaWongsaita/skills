#!/usr/bin/env python3
"""Durable state operations for the engineering-workflow skill.

The module intentionally uses only the Python standard library so it can run in
an arbitrary target repository before project dependencies are installed.
"""

from __future__ import annotations

import argparse
import copy
import fcntl
import hashlib
import json
import os
import re
import subprocess
import tempfile
import unicodedata
from datetime import datetime, timezone
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterable


WORKFLOW_VERSION = 2
LEGACY_WORKFLOW_VERSION = 1
MAX_HISTORY = 50
MAX_SCRUTINIZE_CYCLES = 6
STAGES = (
    "IDLE",
    "CLASSIFYING",
    "DISCOVERY",
    "EXPLORATION",
    "WAYFINDING",
    "SPECIFICATION",
    "DESIGN_REVIEW",
    "PLANNING",
    "DIAGNOSIS",
    "IMPLEMENTATION",
    "CODE_REVIEW",
    "SYSTEM_REVIEW",
    "POST_MORTEM",
    "COMPLETE",
    "BLOCKED",
)
STAGE_MODES = {
    "REGRESSION_TEST",
    "FIX",
    "REVIEW_FIX",
    "EMERGENCY_MITIGATION",
    "BOUND_FEATURES",
    "RESEARCH",
    "PROTOTYPE",
}
MODE_STAGES = {
    "REGRESSION_TEST": "IMPLEMENTATION",
    "FIX": "IMPLEMENTATION",
    "REVIEW_FIX": "IMPLEMENTATION",
    "EMERGENCY_MITIGATION": "IMPLEMENTATION",
    "BOUND_FEATURES": "PLANNING",
    "RESEARCH": "EXPLORATION",
    "PROTOTYPE": "EXPLORATION",
}
SYSTEM_REVIEW_CHARACTERISTICS = {
    "concurrency",
    "distributed-retry",
    "external-side-effect",
    "migration",
    "public-contract",
    "system-review-required",
}
TRANSITIONS = {
    "IDLE": {"CLASSIFYING", "BLOCKED"},
    "CLASSIFYING": {"DISCOVERY", "DIAGNOSIS", "WAYFINDING", "BLOCKED"},
    "DISCOVERY": {"EXPLORATION", "WAYFINDING", "SPECIFICATION", "IMPLEMENTATION", "BLOCKED"},
    "EXPLORATION": {"EXPLORATION", "DISCOVERY", "SPECIFICATION", "PLANNING", "BLOCKED"},
    "WAYFINDING": {"WAYFINDING", "DISCOVERY", "EXPLORATION", "PLANNING", "COMPLETE", "BLOCKED"},
    "SPECIFICATION": {"DISCOVERY", "EXPLORATION", "DESIGN_REVIEW", "IMPLEMENTATION", "BLOCKED"},
    "DESIGN_REVIEW": {"DISCOVERY", "EXPLORATION", "SPECIFICATION", "PLANNING", "DESIGN_REVIEW", "BLOCKED"},
    "PLANNING": {"WAYFINDING", "SPECIFICATION", "IMPLEMENTATION", "COMPLETE", "BLOCKED"},
    "DIAGNOSIS": {"IMPLEMENTATION", "BLOCKED"},
    "IMPLEMENTATION": {"SPECIFICATION", "DIAGNOSIS", "IMPLEMENTATION", "CODE_REVIEW", "BLOCKED"},
    "CODE_REVIEW": {"IMPLEMENTATION", "SYSTEM_REVIEW", "POST_MORTEM", "COMPLETE", "BLOCKED"},
    "SYSTEM_REVIEW": {"IMPLEMENTATION", "DIAGNOSIS", "POST_MORTEM", "COMPLETE", "SYSTEM_REVIEW", "BLOCKED"},
    "POST_MORTEM": {"DIAGNOSIS", "COMPLETE", "BLOCKED"},
    "COMPLETE": set(),
    "BLOCKED": set(),
}
TYPE_ENTRY = {"FEATURE": "DISCOVERY", "BUG": "DIAGNOSIS", "LARGE_PROJECT": "WAYFINDING"}
GATES = ("design", "code", "system")
REVIEW_KINDS = {"design-review", "code-review", "system-review"}
SCRUTINIZE_GATES = {"design", "system"}
SCRUTINIZE_VERDICTS = {"SHIP", "FIX_THEN_SHIP", "REWORK", "REJECT"}
SCRUTINIZE_GATE_STAGES = {"design": "DESIGN_REVIEW", "system": "SYSTEM_REVIEW"}
DEFAULT_GATE_BUDGETS = {"design": MAX_SCRUTINIZE_CYCLES, "code": 3, "system": MAX_SCRUTINIZE_CYCLES}
SCRUTINIZE_HISTORY_FIELDS = {
    "cycleNumber",
    "verdict",
    "blockingFindings",
    "newFindings",
    "resolvedFindings",
    "repeatedFindings",
    "changedArtifacts",
    "reasonForRetry",
    "reviewRef",
}
REQUIRED_FIELDS = {
    "workflowVersion",
    "id",
    "parentWorkflowId",
    "requestFingerprint",
    "workflowType",
    "incidentSubtype",
    "scope",
    "risk",
    "uncertainty",
    "changeCharacteristics",
    "stage",
    "stageMode",
    "status",
    "currentWorkItem",
    "artifactRefs",
    "completedStages",
    "baseGitRef",
    "lastVerifiedGitRef",
    "worktreeFingerprint",
    "verificationCommands",
    "gateCycles",
    "gateBudgets",
    "gateBlockers",
    "designScrutinizeCycles",
    "systemScrutinizeCycles",
    "scrutinizeHistory",
    "dependencies",
    "dependencyStatus",
    "blockedDependency",
    "pendingInstallationPermission",
    "childWorkflowIds",
    "mitigationOutstanding",
    "transitionHistory",
    "blocker",
    "updatedAt",
    "revision",
}


class WorkflowStateError(RuntimeError):
    """Base error for invalid or conflicting workflow state."""


class InvalidState(WorkflowStateError):
    pass


class ConcurrentUpdate(WorkflowStateError):
    pass


class InvalidTransition(WorkflowStateError):
    pass


class MultipleActiveWorkflows(WorkflowStateError):
    def __init__(self, workflow_ids: Iterable[str]):
        self.workflow_ids = sorted(workflow_ids)
        super().__init__("multiple active workflows: " + ", ".join(self.workflow_ids))


def migrate_state(state: Any) -> Any:
    """Upgrade the previous state shape without losing resumable evidence."""
    if not isinstance(state, dict) or state.get("workflowVersion") != LEGACY_WORKFLOW_VERSION:
        return state
    upgraded = copy.deepcopy(state)
    old_cycles = upgraded.get("gateCycles", {})
    upgraded["workflowVersion"] = WORKFLOW_VERSION
    upgraded["gateBudgets"] = copy.deepcopy(DEFAULT_GATE_BUDGETS)
    upgraded["designScrutinizeCycles"] = old_cycles.get("design", 0)
    upgraded["systemScrutinizeCycles"] = old_cycles.get("system", 0)
    upgraded["scrutinizeHistory"] = {"design": [], "system": []}
    upgraded["dependencyStatus"] = {}
    upgraded["blockedDependency"] = None
    upgraded["pendingInstallationPermission"] = None
    return upgraded


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def digest_bytes(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def digest_text(value: str) -> str:
    return digest_bytes(value.encode("utf-8"))


def file_fingerprint(path: Path) -> str:
    return digest_bytes(path.read_bytes())


def request_fingerprint(request: str) -> str:
    normalized = " ".join(request.strip().split())
    return digest_text(normalized)


def slugify(request: str) -> str:
    normalized = unicodedata.normalize("NFKD", request).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")[:64].strip("-")
    if not slug:
        slug = "workflow"
    return f"{slug}-{request_fingerprint(request)[7:15]}"


def workflow_directory(root: Path) -> Path:
    return root / ".agents" / "workflows"


def workflow_path(root: Path, workflow_id: str) -> Path:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,79}", workflow_id):
        raise InvalidState(f"invalid workflow id: {workflow_id}")
    return workflow_directory(root) / f"{workflow_id}.json"


def _git_output(root: Path, *args: str) -> str | None:
    result = subprocess.run(
        ["git", *args], cwd=root, text=True, capture_output=True, check=False
    )
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def git_ref(root: Path) -> str | None:
    return _git_output(root, "rev-parse", "HEAD")


def worktree_fingerprint(root: Path) -> str | None:
    status = _git_output(root, "status", "--porcelain=v1", "--untracked-files=all")
    if status is None:
        return None
    relevant_lines = []
    for line in status.splitlines():
        changed_path = line[3:] if len(line) > 3 else line
        if changed_path.startswith(".agents/workflows/"):
            continue
        relevant_lines.append(line)
    return digest_text("\n".join(relevant_lines))


def new_state(
    request: str,
    workflow_id: str | None = None,
    workflow_type: str | None = None,
    parent_workflow_id: str | None = None,
    root: Path | None = None,
) -> dict[str, Any]:
    if workflow_type not in {None, *TYPE_ENTRY}:
        raise InvalidState(f"invalid workflow type: {workflow_type}")
    root = (root or Path.cwd()).resolve()
    return {
        "workflowVersion": WORKFLOW_VERSION,
        "id": workflow_id or slugify(request),
        "parentWorkflowId": parent_workflow_id,
        "requestFingerprint": request_fingerprint(request),
        "workflowType": workflow_type,
        "incidentSubtype": None,
        "scope": None,
        "risk": None,
        "uncertainty": None,
        "changeCharacteristics": [],
        "stage": "IDLE",
        "stageMode": None,
        "status": "IN_PROGRESS",
        "currentWorkItem": None,
        "artifactRefs": [],
        "completedStages": [],
        "baseGitRef": git_ref(root),
        "lastVerifiedGitRef": None,
        "worktreeFingerprint": worktree_fingerprint(root),
        "verificationCommands": [],
        "gateCycles": {gate: 0 for gate in GATES},
        "gateBudgets": copy.deepcopy(DEFAULT_GATE_BUDGETS),
        "gateBlockers": {gate: [] for gate in GATES},
        "designScrutinizeCycles": 0,
        "systemScrutinizeCycles": 0,
        "scrutinizeHistory": {gate: [] for gate in ("design", "system")},
        "dependencies": {},
        "dependencyStatus": {},
        "blockedDependency": None,
        "pendingInstallationPermission": None,
        "childWorkflowIds": [],
        "mitigationOutstanding": False,
        "transitionHistory": [],
        "blocker": None,
        "updatedAt": utc_now(),
        "revision": 0,
    }


def validate_state(state: Any) -> dict[str, Any]:
    if not isinstance(state, dict):
        raise InvalidState("workflow state must be a JSON object")
    missing = REQUIRED_FIELDS - state.keys()
    extra = state.keys() - REQUIRED_FIELDS
    if missing:
        raise InvalidState("missing fields: " + ", ".join(sorted(missing)))
    if extra:
        raise InvalidState("unexpected fields: " + ", ".join(sorted(extra)))
    if state["workflowVersion"] != WORKFLOW_VERSION:
        raise InvalidState(f"unsupported workflowVersion: {state['workflowVersion']}")
    if not isinstance(state["id"], str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,79}", state["id"]):
        raise InvalidState("id must be a lowercase workflow slug")
    if state["parentWorkflowId"] is not None and not isinstance(state["parentWorkflowId"], str):
        raise InvalidState("parentWorkflowId must be a string or null")
    if not isinstance(state["requestFingerprint"], str) or not re.fullmatch(
        r"sha256:[0-9a-f]{64}", state["requestFingerprint"]
    ):
        raise InvalidState("requestFingerprint must be sha256")
    if state["stage"] not in STAGES:
        raise InvalidState(f"invalid stage: {state['stage']}")
    if state["stageMode"] is not None and state["stageMode"] not in STAGE_MODES:
        raise InvalidState(f"invalid stageMode: {state['stageMode']}")
    if state["stageMode"] is not None and MODE_STAGES[state["stageMode"]] != state["stage"]:
        raise InvalidState(f"stageMode {state['stageMode']} is invalid for {state['stage']}")
    if state["workflowType"] not in {None, *TYPE_ENTRY}:
        raise InvalidState(f"invalid workflowType: {state['workflowType']}")
    if state["incidentSubtype"] not in {None, "INCIDENT"}:
        raise InvalidState("incidentSubtype must be INCIDENT or null")
    if state["incidentSubtype"] == "INCIDENT" and state["workflowType"] != "BUG":
        raise InvalidState("INCIDENT is a BUG subtype")
    if state["scope"] is not None and not isinstance(state["scope"], str):
        raise InvalidState("scope must be a string or null")
    if state["risk"] not in {None, "LOW", "MEDIUM", "HIGH", "CRITICAL"}:
        raise InvalidState("invalid risk")
    if state["uncertainty"] not in {None, "LOW", "MEDIUM", "HIGH", "CRITICAL"}:
        raise InvalidState("invalid uncertainty")
    if not isinstance(state["changeCharacteristics"], list) or not all(
        isinstance(item, str) for item in state["changeCharacteristics"]
    ):
        raise InvalidState("changeCharacteristics must be a string array")
    if state["status"] not in {"IN_PROGRESS", "BLOCKED", "COMPLETE"}:
        raise InvalidState(f"invalid status: {state['status']}")
    if state["stage"] == "BLOCKED" and state["status"] != "BLOCKED":
        raise InvalidState("BLOCKED stage requires BLOCKED status")
    if state["stage"] == "COMPLETE" and state["status"] != "COMPLETE":
        raise InvalidState("COMPLETE stage requires COMPLETE status")
    if state["status"] == "BLOCKED" and state["stage"] != "BLOCKED":
        raise InvalidState("BLOCKED status requires BLOCKED stage")
    if state["status"] == "COMPLETE" and state["stage"] != "COMPLETE":
        raise InvalidState("COMPLETE status requires COMPLETE stage")
    if not isinstance(state["revision"], int) or state["revision"] < 0:
        raise InvalidState("revision must be a non-negative integer")
    if not isinstance(state["mitigationOutstanding"], bool):
        raise InvalidState("mitigationOutstanding must be boolean")
    if state["currentWorkItem"] is not None and not isinstance(state["currentWorkItem"], str):
        raise InvalidState("currentWorkItem must be a string or null")
    for field in ("baseGitRef", "lastVerifiedGitRef", "worktreeFingerprint"):
        if state[field] is not None and not isinstance(state[field], str):
            raise InvalidState(f"{field} must be a string or null")
    if not isinstance(state["artifactRefs"], list):
        raise InvalidState("artifactRefs must be an array")
    artifact_paths = set()
    for reference in state["artifactRefs"]:
        if not isinstance(reference, dict) or set(reference) != {
            "kind", "path", "fingerprint", "producerStage", "gitRef"
        }:
            raise InvalidState("artifact reference has an invalid shape")
        if not isinstance(reference["kind"], str) or not reference["kind"]:
            raise InvalidState("artifact kind is required")
        if not isinstance(reference["path"], str) or not reference["path"] or Path(reference["path"]).is_absolute():
            raise InvalidState("artifact path must be non-empty and repository-relative")
        if reference["path"] in artifact_paths:
            raise InvalidState(f"duplicate artifact path: {reference['path']}")
        artifact_paths.add(reference["path"])
        if not isinstance(reference["fingerprint"], str) or not re.fullmatch(
            r"sha256:[0-9a-f]{64}", reference["fingerprint"]
        ):
            raise InvalidState("artifact fingerprint must be sha256")
        if reference["producerStage"] not in STAGES:
            raise InvalidState("artifact producerStage is invalid")
        if reference["gitRef"] is not None and not isinstance(reference["gitRef"], str):
            raise InvalidState("artifact gitRef must be a string or null")
    if not isinstance(state["completedStages"], list) or not all(
        stage in STAGES for stage in state["completedStages"]
    ):
        raise InvalidState("completedStages must contain valid stages")
    if not isinstance(state["verificationCommands"], list) or not all(
        isinstance(command, list)
        and command
        and all(isinstance(argument, str) for argument in command)
        for command in state["verificationCommands"]
    ):
        raise InvalidState("verificationCommands must contain non-empty string arrays")
    if not isinstance(state["transitionHistory"], list) or len(state["transitionHistory"]) > MAX_HISTORY:
        raise InvalidState(f"transitionHistory must have at most {MAX_HISTORY} items")
    if not isinstance(state["gateCycles"], dict) or not isinstance(state["gateBudgets"], dict):
        raise InvalidState("gate cycles and budgets must be objects")
    if set(state["gateCycles"]) != set(GATES) or set(state["gateBudgets"]) != set(GATES):
        raise InvalidState("gate cycle and budget keys must be design, code, and system")
    if not isinstance(state["gateBlockers"], dict) or set(state["gateBlockers"]) != set(GATES):
        raise InvalidState("gate blocker keys must be design, code, and system")
    for gate in GATES:
        count = state["gateCycles"][gate]
        budget = state["gateBudgets"][gate]
        if not isinstance(count, int) or not 0 <= count <= budget:
            raise InvalidState(f"invalid {gate} gate cycle")
        if budget != DEFAULT_GATE_BUDGETS[gate]:
            raise InvalidState(f"{gate} gate budget must be {DEFAULT_GATE_BUDGETS[gate]}")
        if not isinstance(state["gateBlockers"][gate], list) or not all(
            isinstance(item, str) for item in state["gateBlockers"][gate]
        ):
            raise InvalidState(f"invalid {gate} gate blockers")
    if not isinstance(state["designScrutinizeCycles"], int) or not 0 <= state["designScrutinizeCycles"] <= MAX_SCRUTINIZE_CYCLES:
        raise InvalidState("designScrutinizeCycles must be between 0 and 6")
    if not isinstance(state["systemScrutinizeCycles"], int) or not 0 <= state["systemScrutinizeCycles"] <= MAX_SCRUTINIZE_CYCLES:
        raise InvalidState("systemScrutinizeCycles must be between 0 and 6")
    if state["designScrutinizeCycles"] != state["gateCycles"]["design"]:
        raise InvalidState("designScrutinizeCycles must match gateCycles.design")
    if state["systemScrutinizeCycles"] != state["gateCycles"]["system"]:
        raise InvalidState("systemScrutinizeCycles must match gateCycles.system")
    if not isinstance(state["scrutinizeHistory"], dict) or set(state["scrutinizeHistory"]) != {"design", "system"}:
        raise InvalidState("scrutinizeHistory must contain design and system histories")
    for gate in ("design", "system"):
        history = state["scrutinizeHistory"][gate]
        if not isinstance(history, list) or len(history) > MAX_SCRUTINIZE_CYCLES:
            raise InvalidState(f"{gate} scrutinize history must contain at most 6 cycles")
        for item in history:
            if not isinstance(item, dict) or set(item) != SCRUTINIZE_HISTORY_FIELDS:
                raise InvalidState(f"invalid {gate} scrutinize history item")
            if not isinstance(item["cycleNumber"], int) or not 1 <= item["cycleNumber"] <= MAX_SCRUTINIZE_CYCLES:
                raise InvalidState(f"invalid {gate} scrutinize cycle number")
            if item["verdict"] not in SCRUTINIZE_VERDICTS:
                raise InvalidState(f"invalid {gate} scrutinize verdict")
            for field in (
                "blockingFindings", "newFindings", "resolvedFindings",
                "repeatedFindings", "changedArtifacts",
            ):
                if not isinstance(item[field], list) or not all(
                    isinstance(value, str) for value in item[field]
                ):
                    raise InvalidState(f"invalid {gate} scrutinize {field}")
            if not isinstance(item["reasonForRetry"], str):
                raise InvalidState(f"invalid {gate} scrutinize retry reason")
            if item["reviewRef"] is not None and not isinstance(item["reviewRef"], str):
                raise InvalidState(f"invalid {gate} scrutinize review reference")
    if not isinstance(state["dependencies"], dict):
        raise InvalidState("dependencies must be an object")
    if not isinstance(state["dependencyStatus"], dict):
        raise InvalidState("dependencyStatus must be an object")
    for field in ("blockedDependency", "pendingInstallationPermission"):
        value = state[field]
        if value is not None and not isinstance(value, dict):
            raise InvalidState(f"{field} must be an object or null")
    if state["stage"] != "BLOCKED" and (
        state["blockedDependency"] is not None
        or state["pendingInstallationPermission"] is not None
    ):
        raise InvalidState("dependency pause details require BLOCKED stage")
    blocked_dependency = state["blockedDependency"]
    if blocked_dependency is not None:
        if set(blocked_dependency) != {"skills", "neededAt", "reason", "decision"}:
            raise InvalidState("blockedDependency has an invalid shape")
        if blocked_dependency["decision"] not in {"PENDING", "APPROVED", "DECLINED", "VERIFIED"}:
            raise InvalidState("blockedDependency has an invalid decision")
        if blocked_dependency["neededAt"] not in STAGES or blocked_dependency["neededAt"] in {"BLOCKED", "COMPLETE"}:
            raise InvalidState("blockedDependency neededAt is invalid")
        if not isinstance(blocked_dependency["reason"], str) or not blocked_dependency["reason"].strip():
            raise InvalidState("blockedDependency reason is required")
        if not isinstance(blocked_dependency["skills"], list) or not blocked_dependency["skills"]:
            raise InvalidState("blockedDependency skills are required")
        for item in blocked_dependency["skills"]:
            if not isinstance(item, dict) or not isinstance(item.get("name"), str) or not item["name"]:
                raise InvalidState("blockedDependency skill items require names")
    pending_installation = state["pendingInstallationPermission"]
    if pending_installation is not None:
        if set(pending_installation) != {"skills", "proposals", "requestedAt", "decision"}:
            raise InvalidState("pendingInstallationPermission has an invalid shape")
        if pending_installation["decision"] not in {"PENDING", "APPROVED", "DECLINED"}:
            raise InvalidState("pendingInstallationPermission has an invalid decision")
        if not isinstance(pending_installation["skills"], list) or not all(
            isinstance(item, str) and item for item in pending_installation["skills"]
        ):
            raise InvalidState("pending installation skills must be a string array")
        if not isinstance(pending_installation["proposals"], list) or not all(
            isinstance(item, dict) for item in pending_installation["proposals"]
        ):
            raise InvalidState("pending installation proposals must be objects")
        if not isinstance(pending_installation["requestedAt"], str) or not pending_installation["requestedAt"]:
            raise InvalidState("pending installation requestedAt is required")
        if blocked_dependency is None:
            raise InvalidState("pending installation permission requires blockedDependency")
        blocked_names = {
            item["name"] for item in blocked_dependency["skills"]
            if isinstance(item, dict) and isinstance(item.get("name"), str)
        }
        if set(pending_installation["skills"]) != blocked_names:
            raise InvalidState("pending installation skills must match blockedDependency")
    if not isinstance(state["childWorkflowIds"], list) or not all(
        isinstance(item, str) for item in state["childWorkflowIds"]
    ):
        raise InvalidState("childWorkflowIds must be a string array")
    if len(set(state["childWorkflowIds"])) != len(state["childWorkflowIds"]):
        raise InvalidState("childWorkflowIds must be unique")
    blocker = state["blocker"]
    if blocker is not None:
        expected_blocker_fields = {
            "code", "message", "returnStage", "returnStageMode", "owner", "evidenceRefs"
        }
        if not isinstance(blocker, dict) or set(blocker) != expected_blocker_fields:
            raise InvalidState("blocker has an invalid shape")
        if blocker["returnStage"] not in STAGES or blocker["returnStage"] in {"BLOCKED", "COMPLETE"}:
            raise InvalidState("blocker returnStage is invalid")
        return_mode = blocker["returnStageMode"]
        if return_mode is not None and (
            return_mode not in STAGE_MODES or MODE_STAGES[return_mode] != blocker["returnStage"]
        ):
            raise InvalidState("blocker returnStageMode is invalid")
        if not all(isinstance(blocker[field], str) for field in ("code", "message", "owner")):
            raise InvalidState("blocker code, message, and owner must be strings")
        if not isinstance(blocker["evidenceRefs"], list) or not all(
            isinstance(item, str) for item in blocker["evidenceRefs"]
        ):
            raise InvalidState("blocker evidenceRefs must be a string array")
    if state["stage"] == "BLOCKED" and blocker is None:
        raise InvalidState("BLOCKED stage requires blocker details")
    if state["stage"] != "BLOCKED" and blocker is not None:
        raise InvalidState("blocker details require BLOCKED stage")
    for history in state["transitionHistory"]:
        if not isinstance(history, dict) or not {"from", "to", "reason", "at"}.issubset(history):
            raise InvalidState("transition history item has an invalid shape")
        if history["from"] not in STAGES or history["to"] not in STAGES:
            raise InvalidState("transition history stage is invalid")
        if not isinstance(history["reason"], str) or not isinstance(history["at"], str):
            raise InvalidState("transition history reason and timestamp must be strings")
    if not isinstance(state["updatedAt"], str) or not state["updatedAt"]:
        raise InvalidState("updatedAt must be a timestamp string")
    return state


def read_state(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise InvalidState(f"state does not exist: {path}") from error
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise InvalidState(f"invalid or partial state file {path}: {error}") from error
    return validate_state(migrate_state(payload))


def _fsync_directory(directory: Path) -> None:
    descriptor = os.open(directory, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


@contextmanager
def _exclusive_state_lock(path: Path):
    """Serialize compare-and-swap readers and writers for one state file."""
    lock_path = path.with_name(path.name + ".lock")
    descriptor = os.open(lock_path, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        fcntl.flock(descriptor, fcntl.LOCK_EX)
        yield
    finally:
        fcntl.flock(descriptor, fcntl.LOCK_UN)
        os.close(descriptor)


def atomic_write_state(
    path: Path,
    state: dict[str, Any],
    expected_revision: int | None,
) -> dict[str, Any]:
    path = path.resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    with _exclusive_state_lock(path):
        candidate = copy.deepcopy(state)
        if path.exists():
            current = read_state(path)
            if expected_revision is None or current["revision"] != expected_revision:
                raise ConcurrentUpdate(
                    f"expected revision {expected_revision}, found {current['revision']}"
                )
            candidate["revision"] = expected_revision + 1
        else:
            if expected_revision not in {None, -1}:
                raise ConcurrentUpdate(f"cannot update missing state at revision {expected_revision}")
            candidate["revision"] = 0
        candidate["updatedAt"] = utc_now()
        validate_state(candidate)

        descriptor, temporary_name = tempfile.mkstemp(
            dir=path.parent, prefix=f".{path.name}.", suffix=".tmp"
        )
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                json.dump(candidate, handle, ensure_ascii=False, indent=2, sort_keys=True)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary_name, path)
            _fsync_directory(path.parent)
        except Exception:
            try:
                os.unlink(temporary_name)
            except FileNotFoundError:
                pass
            raise
        return candidate


def list_states(root: Path, include_complete: bool = False) -> list[dict[str, Any]]:
    directory = workflow_directory(root)
    if not directory.exists():
        return []
    states = [read_state(path) for path in sorted(directory.glob("*.json"))]
    if not include_complete:
        states = [state for state in states if state["status"] != "COMPLETE"]
    return sorted(states, key=lambda state: (state["updatedAt"], state["id"]), reverse=True)


def select_active(root: Path, workflow_id: str | None = None) -> dict[str, Any]:
    if workflow_id:
        return read_state(workflow_path(root, workflow_id))
    states = list_states(root)
    if not states:
        raise InvalidState("no active workflow")
    if len(states) > 1:
        raise MultipleActiveWorkflows(state["id"] for state in states)
    return states[0]


def init_workflow(
    root: Path,
    request: str,
    workflow_type: str | None = None,
    parent_workflow_id: str | None = None,
) -> tuple[dict[str, Any], Path, bool]:
    fingerprint = request_fingerprint(request)
    # Completed state is retained for audit and idempotency: repeating the
    # same request returns that terminal record instead of trying to overwrite
    # its JSON file with a fresh workflow.
    for existing in list_states(root, include_complete=True):
        if existing["requestFingerprint"] == fingerprint:
            return existing, workflow_path(root, existing["id"]), False
    state = new_state(request, workflow_type=workflow_type, parent_workflow_id=parent_workflow_id, root=root)
    path = workflow_path(root, state["id"])
    try:
        return atomic_write_state(path, state, None), path, True
    except ConcurrentUpdate:
        existing = read_state(path)
        if existing["requestFingerprint"] == fingerprint and existing["status"] != "COMPLETE":
            return existing, path, False
        raise


def _append_history(state: dict[str, Any], source: str, target: str, reason: str) -> None:
    state["transitionHistory"].append(
        {"from": source, "to": target, "reason": reason, "at": utc_now()}
    )
    state["transitionHistory"] = state["transitionHistory"][-MAX_HISTORY:]


def classify_state(
    state: dict[str, Any], workflow_type: str, risk: str, uncertainty: str,
    scope: str, characteristics: Iterable[str] = (), incident: bool = False,
) -> dict[str, Any]:
    validate_state(state)
    if state["stage"] != "CLASSIFYING":
        raise InvalidTransition("classification can be recorded only in CLASSIFYING")
    if workflow_type not in TYPE_ENTRY:
        raise InvalidState(f"invalid workflow type: {workflow_type}")
    if risk not in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
        raise InvalidState(f"invalid risk: {risk}")
    if uncertainty not in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
        raise InvalidState(f"invalid uncertainty: {uncertainty}")
    if incident and workflow_type != "BUG":
        raise InvalidState("INCIDENT is a BUG subtype")
    if incident and risk not in {"HIGH", "CRITICAL"}:
        raise InvalidState("INCIDENT requires HIGH or CRITICAL risk")
    if not isinstance(scope, str) or not scope.strip():
        raise InvalidState("scope is required")
    updated = copy.deepcopy(state)
    updated["workflowType"] = workflow_type
    updated["incidentSubtype"] = "INCIDENT" if incident else None
    updated["risk"] = risk
    updated["uncertainty"] = uncertainty
    updated["scope"] = scope.strip()
    updated["changeCharacteristics"] = sorted(
        {item.strip() for item in characteristics if item.strip()}
    )
    return validate_state(updated)


def set_current_work_item(state: dict[str, Any], reference: str | None) -> dict[str, Any]:
    validate_state(state)
    updated = copy.deepcopy(state)
    updated["currentWorkItem"] = reference
    return validate_state(updated)


def set_mitigation_outstanding(
    state: dict[str, Any], outstanding: bool, reason: str
) -> dict[str, Any]:
    validate_state(state)
    updated = copy.deepcopy(state)
    updated["mitigationOutstanding"] = outstanding
    _append_history(updated, state["stage"], state["stage"], f"mitigation status: {reason}")
    return validate_state(updated)


DEPENDENCY_RESOLUTION_FIELDS = {
    "name", "path", "provider", "resolved_identity", "source_kind", "content_hash",
    "enabled", "model_invocable", "allow_implicit_invocation", "policy_sources",
    "provenance_status", "provenance_source", "provenance_evidence", "owner",
    "expectedSource", "role", "category", "requirement", "invocationMode",
    "invocationTarget", "declaredSideEffects",
}
DEPENDENCY_STATUS_FIELDS = {
    "name", "owner", "expectedSource", "role", "category", "requirement", "status",
    "path", "resolvedIdentity", "provenanceStatus", "detectedSource", "provenanceEvidence",
    "issues", "installation", "installScope", "verifiedCommand", "verificationSources",
}
REPOSITORY_SETUP_FIELDS = {"status", "requiredFiles", "missingFiles", "setupSkill", "checkedRoot"}


def _compact_dependency_record(record: Any, allowed: set[str]) -> dict[str, Any]:
    if not isinstance(record, dict):
        raise InvalidState("dependency audit records must be objects")
    return {
        key: copy.deepcopy(value)
        for key, value in record.items()
        if key in allowed
    }


def record_dependency_audit(state: dict[str, Any], audit: dict[str, Any]) -> dict[str, Any]:
    validate_state(state)
    if audit.get("version") not in {1, 2} or not isinstance(audit.get("resolutions"), dict):
        raise InvalidState("dependency audit must be a version 1 or 2 result")
    updated = copy.deepcopy(state)
    updated["dependencies"] = {
        name: _compact_dependency_record(record, DEPENDENCY_RESOLUTION_FIELDS)
        for name, record in audit["resolutions"].items()
    }
    if not all(isinstance(name, str) for name in updated["dependencies"]):
        raise InvalidState("dependency audit resolution names must be strings")
    status = audit.get("dependencyStatus", {})
    if not isinstance(status, dict):
        raise InvalidState("dependencyStatus in audit must be an object")
    if not all(isinstance(name, str) and isinstance(record, dict) for name, record in status.items()):
        raise InvalidState("dependency audit status names and records must be strings and objects")
    updated["dependencyStatus"] = {
        name: _compact_dependency_record(record, DEPENDENCY_STATUS_FIELDS)
        for name, record in status.items()
        if isinstance(name, str)
    }
    if audit.get("repositorySetup"):
        updated["dependencyStatus"]["__repository_setup__"] = _compact_dependency_record(
            audit["repositorySetup"], REPOSITORY_SETUP_FIELDS
        )
    if updated["stage"] == "BLOCKED" and updated["blockedDependency"]:
        names = [
            item.get("name")
            for item in updated["blockedDependency"].get("skills", [])
            if isinstance(item, dict) and isinstance(item.get("name"), str)
        ]
        resolved = all(
            isinstance(updated["dependencyStatus"].get(name), dict)
            and updated["dependencyStatus"][name].get("status") == "INSTALLED"
            and updated["dependencyStatus"][name].get("provenanceStatus") == "VERIFIED"
            for name in names
        )
        if names and resolved:
            updated["blockedDependency"] = None
            updated["pendingInstallationPermission"] = None
            if updated["blocker"] and updated["blocker"]["code"] == "DEPENDENCY_RELOAD_REQUIRED":
                updated["blocker"]["code"] = "DEPENDENCY_VERIFIED"
                updated["blocker"]["message"] = (
                    "Dependency installation was verified; the workflow may resume from its paused stage"
                )
    return validate_state(updated)


def _dependency_request_item(item: Any) -> dict[str, Any]:
    if isinstance(item, str):
        return {"name": item}
    if not isinstance(item, dict) or not isinstance(item.get("name"), str) or not item["name"]:
        raise InvalidState("dependency request item requires a skill name")
    allowed = {
        "name", "owner", "repository", "purpose", "neededAt", "reason",
        "installCommand", "installScope", "verifiedCommand",
    }
    compact = {key: copy.deepcopy(value) for key, value in item.items() if key in allowed}
    for field in {
        "name", "owner", "repository", "purpose", "neededAt", "reason",
        "installCommand", "installScope",
    }:
        if field in compact and not isinstance(compact[field], str):
            raise InvalidState(f"dependency request {field} must be a string")
    if "verifiedCommand" in compact and not isinstance(compact["verifiedCommand"], bool):
        raise InvalidState("dependency request verifiedCommand must be boolean")
    return compact


def request_installation_permission(
    state: dict[str, Any],
    dependencies: Iterable[Any],
    needed_at: str,
    reason: str,
    proposals: Iterable[dict[str, Any]],
) -> dict[str, Any]:
    """Persist a grouped permission request; this function never installs."""
    validate_state(state)
    if state["stage"] in {"BLOCKED", "COMPLETE"}:
        raise InvalidTransition("installation permission must pause an active stage")
    if needed_at not in STAGES or needed_at in {"BLOCKED", "COMPLETE"}:
        raise InvalidState("invalid dependency neededAt stage")
    if not isinstance(reason, str) or not reason.strip():
        raise InvalidState("dependency installation reason is required")
    items = [_dependency_request_item(item) for item in dependencies]
    if not items:
        raise InvalidState("at least one missing dependency is required")
    compact_proposals = []
    for proposal in proposals:
        if not isinstance(proposal, dict):
            raise InvalidState("installation proposal must be an object")
        allowed = {
            "owner", "source", "skills", "method", "command", "installScope",
            "verified", "verificationSources", "requiresApproval",
        }
        compact_proposals.append(
            {key: copy.deepcopy(value) for key, value in proposal.items() if key in allowed}
        )
    updated = block_state(
        state,
        "BLOCKED_DEPENDENCY",
        reason.strip(),
        owner="user",
        evidence_refs=[item["name"] for item in items],
    )
    updated["blockedDependency"] = {
        "skills": items,
        "neededAt": needed_at,
        "reason": reason.strip(),
        "decision": "PENDING",
    }
    updated["pendingInstallationPermission"] = {
        "skills": [item["name"] for item in items],
        "proposals": compact_proposals,
        "requestedAt": utc_now(),
        "decision": "PENDING",
    }
    return validate_state(updated)


def record_installation_decision(
    state: dict[str, Any], approved: bool, reason: str
) -> dict[str, Any]:
    """Record explicit approval/decline; the caller still performs/re-audits install."""
    validate_state(state)
    pending = state["pendingInstallationPermission"]
    if state["stage"] != "BLOCKED" or not isinstance(pending, dict):
        raise InvalidTransition("no pending installation permission exists")
    if not isinstance(reason, str) or not reason.strip():
        raise InvalidState("installation decision reason is required")
    updated = copy.deepcopy(state)
    decision = "APPROVED" if approved else "DECLINED"
    updated["pendingInstallationPermission"]["decision"] = decision
    updated["blockedDependency"]["decision"] = decision
    if approved:
        updated["blocker"]["code"] = "DEPENDENCY_RELOAD_REQUIRED"
        updated["blocker"]["message"] = (
            "Installation approved; run the verified command, re-audit, and resume only after verification"
        )
    else:
        updated["blocker"]["code"] = "BLOCKED_DEPENDENCY"
        updated["blocker"]["message"] = (
            "Installation declined; install the listed dependency manually before resuming"
        )
    _append_history(updated, "BLOCKED", "BLOCKED", f"installation permission {decision.lower()}: {reason}")
    return validate_state(updated)


def add_child_workflow(state: dict[str, Any], root: Path, child_id: str) -> dict[str, Any]:
    validate_state(state)
    if state["workflowType"] != "LARGE_PROJECT":
        raise InvalidTransition("only LARGE_PROJECT can own child workflows")
    child = read_state(workflow_path(root, child_id))
    if child["parentWorkflowId"] != state["id"]:
        raise InvalidState(f"child {child_id} does not reference parent {state['id']}")
    updated = copy.deepcopy(state)
    if child_id not in updated["childWorkflowIds"]:
        updated["childWorkflowIds"].append(child_id)
    return validate_state(updated)


def run_verification(
    state: dict[str, Any], root: Path, commands: list[list[str]] | None = None
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    validate_state(state)
    selected = commands if commands is not None else state["verificationCommands"]
    if not selected or any(not command for command in selected):
        raise InvalidState("at least one verification command is required")
    results = []
    for command in selected:
        result = subprocess.run(command, cwd=root, text=True, capture_output=True, check=False)
        results.append(
            {
                "command": command,
                "returncode": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
            }
        )
        if result.returncode != 0:
            raise WorkflowStateError(
                f"verification failed ({' '.join(command)}): {result.returncode}"
            )
    updated = copy.deepcopy(state)
    updated["verificationCommands"] = copy.deepcopy(selected)
    updated["lastVerifiedGitRef"] = git_ref(root)
    updated["worktreeFingerprint"] = worktree_fingerprint(root)
    return validate_state(updated), results


def _validate_completion(state: dict[str, Any], root: Path | None) -> None:
    if state["mitigationOutstanding"] or state["stageMode"] == "EMERGENCY_MITIGATION":
        raise InvalidTransition("emergency mitigation cannot complete a workflow")
    if state["workflowType"] == "LARGE_PROJECT":
        if not state["childWorkflowIds"]:
            raise InvalidTransition("large project requires bounded child workflows before completion")
        if root is None:
            raise InvalidTransition("large-project completion requires repository state reconciliation")
        for child_id in state["childWorkflowIds"]:
            child = read_state(workflow_path(root, child_id))
            if child["parentWorkflowId"] != state["id"] or child["status"] != "COMPLETE":
                raise InvalidTransition(f"child workflow is not complete for this parent: {child_id}")
        reconciled, reasons = reconcile_state(state, root, run_checks=True)
        if reasons or reconciled["stage"] != state["stage"]:
            raise InvalidTransition("parent completion reconciliation failed: " + "; ".join(reasons))
        return

    if state["stage"] not in {"CODE_REVIEW", "SYSTEM_REVIEW", "POST_MORTEM"}:
        raise InvalidTransition("feature and bug workflows complete only after a review stage")
    artifact_kinds = {reference["kind"] for reference in state["artifactRefs"]}
    if not {"implementation", "code-review"}.issubset(artifact_kinds):
        raise InvalidTransition("completion requires implementation and code-review evidence")
    if not state["verificationCommands"]:
        raise InvalidTransition("completion requires reproducible verification commands")
    if state["gateCycles"]["code"] < 1 or state["gateBlockers"]["code"]:
        raise InvalidTransition("completion requires a passing code gate")
    if "DESIGN_REVIEW" in state["completedStages"]:
        if state["gateCycles"]["design"] < 1 or state["gateBlockers"]["design"]:
            raise InvalidTransition("completion requires a passing design gate")
    system_required = (
        state["risk"] in {"HIGH", "CRITICAL"}
        or bool(SYSTEM_REVIEW_CHARACTERISTICS.intersection(state["changeCharacteristics"]))
        or state["stage"] == "SYSTEM_REVIEW"
        or "SYSTEM_REVIEW" in state["completedStages"]
    )
    if system_required:
        if state["gateCycles"]["system"] < 1 or state["gateBlockers"]["system"]:
            raise InvalidTransition("completion requires a passing system gate")
    if state["incidentSubtype"] == "INCIDENT" and state["stage"] != "POST_MORTEM":
        raise InvalidTransition("an incident requires its report stage before completion")
    if state["incidentSubtype"] == "INCIDENT" and "post-mortem" not in artifact_kinds:
        raise InvalidTransition("an incident requires a validated post-mortem artifact")
    if root is not None:
        reconciled, reasons = reconcile_state(state, root, run_checks=True)
        if reasons or reconciled["stage"] != state["stage"]:
            raise InvalidTransition("completion reconciliation failed: " + "; ".join(reasons))


def _validate_reduced_path(state: dict[str, Any]) -> None:
    if state["workflowType"] != "FEATURE" or state["risk"] != "LOW" or state["uncertainty"] != "LOW":
        raise InvalidTransition("reduced feature path requires FEATURE with LOW risk and LOW uncertainty")
    forbidden = {
        "architecture-change", "abstraction-change", "assumption-change",
        *SYSTEM_REVIEW_CHARACTERISTICS,
    }
    if forbidden.intersection(state["changeCharacteristics"]):
        raise InvalidTransition(
            "reduced feature path cannot change architecture, abstraction, assumptions, or system behavior"
        )
    artifact_kinds = {reference["kind"] for reference in state["artifactRefs"]}
    if not artifact_kinds.intersection({"acceptance", "spec"}):
        raise InvalidTransition("reduced feature path requires an acceptance or spec artifact")


def transition(
    state: dict[str, Any], target: str, reason: str, stage_mode: str | None = None,
    root: Path | None = None,
) -> dict[str, Any]:
    validate_state(state)
    source = state["stage"]
    if target not in TRANSITIONS[source]:
        raise InvalidTransition(f"transition {source} -> {target} is not allowed")
    if stage_mode is not None and stage_mode not in STAGE_MODES:
        raise InvalidTransition(f"invalid stage mode: {stage_mode}")
    if stage_mode is not None and MODE_STAGES[stage_mode] != target:
        raise InvalidTransition(f"stage mode {stage_mode} cannot be used with {target}")
    if source == "CLASSIFYING" and state["workflowType"]:
        required = TYPE_ENTRY[state["workflowType"]]
        if target not in {required, "BLOCKED"}:
            raise InvalidTransition(
                f"{state['workflowType']} must enter {required}, not {target}"
            )
    if source == "DISCOVERY" and state["workflowType"] == "LARGE_PROJECT" and target != "WAYFINDING":
        raise InvalidTransition("a LARGE_PROJECT must return to WAYFINDING from discovery")
    if source == "DISCOVERY" and target == "WAYFINDING" and state["workflowType"] != "LARGE_PROJECT":
        raise InvalidTransition("only a LARGE_PROJECT returns from discovery to wayfinding")
    if source == "WAYFINDING" and state["workflowType"] != "LARGE_PROJECT" and target != "BLOCKED":
        raise InvalidTransition("only a LARGE_PROJECT can use the wayfinding stage")
    if source == "EXPLORATION" and state["workflowType"] == "LARGE_PROJECT" and target == "SPECIFICATION":
        raise InvalidTransition("a LARGE_PROJECT resolves its frontier in planning, not feature specification")
    if source == "EXPLORATION" and state["workflowType"] != "LARGE_PROJECT" and target == "PLANNING":
        raise InvalidTransition("only a LARGE_PROJECT can enter planning from exploration")
    if source == "PLANNING" and target == "WAYFINDING" and state["workflowType"] != "LARGE_PROJECT":
        raise InvalidTransition("only a LARGE_PROJECT can return from planning to wayfinding")
    if source == "PLANNING" and state["workflowType"] == "LARGE_PROJECT" and target not in {"WAYFINDING", "COMPLETE", "BLOCKED"}:
        raise InvalidTransition("a LARGE_PROJECT planning stage creates child workflows, not implementation")
    if source == "DESIGN_REVIEW" and target == "PLANNING":
        design_history = state["scrutinizeHistory"]["design"]
        if (
            not design_history
            or design_history[-1]["verdict"] != "SHIP"
            or state["gateBlockers"]["design"]
        ):
            raise InvalidTransition("design review requires a passing scrutinize SHIP before planning")
    if source == "CODE_REVIEW" and target in {"SYSTEM_REVIEW", "POST_MORTEM", "COMPLETE"}:
        if state["gateCycles"]["code"] < 1 or state["gateBlockers"]["code"]:
            raise InvalidTransition("code review requires a passing code gate before advancing")
    if source == "SYSTEM_REVIEW" and target in {"POST_MORTEM", "COMPLETE"}:
        system_history = state["scrutinizeHistory"]["system"]
        if (
            not system_history
            or system_history[-1]["verdict"] != "SHIP"
            or state["gateBlockers"]["system"]
        ):
            raise InvalidTransition("system review requires a passing scrutinize SHIP before advancing")
    if target == "IMPLEMENTATION" and stage_mode == "FIX" and state["workflowType"] == "BUG":
        has_regression_evidence = any(
            reference["kind"] == "regression" for reference in state["artifactRefs"]
        )
        if not has_regression_evidence and not (
            source == "IMPLEMENTATION" and state["stageMode"] == "REGRESSION_TEST"
        ):
            raise InvalidTransition(
                "BUG FIX requires a preceding REGRESSION_TEST mode or regression artifact"
            )
    if source in {"DISCOVERY", "SPECIFICATION"} and target == "IMPLEMENTATION":
        _validate_reduced_path(state)
    system_required = (
        state["risk"] in {"HIGH", "CRITICAL"}
        or bool(SYSTEM_REVIEW_CHARACTERISTICS.intersection(state["changeCharacteristics"]))
    )
    if source == "CODE_REVIEW" and target in {"POST_MORTEM", "COMPLETE"} and system_required:
        raise InvalidTransition("system-sensitive work must pass SYSTEM_REVIEW before advancing")
    if target == "POST_MORTEM" and state["workflowType"] != "BUG":
        raise InvalidTransition("POST_MORTEM is only available to BUG workflows")
    if target == "POST_MORTEM" and state["incidentSubtype"] != "INCIDENT":
        raise InvalidTransition("POST_MORTEM is only available to incident workflows")
    if target == "COMPLETE":
        _validate_completion(state, root)

    updated = copy.deepcopy(state)
    if source != target and source not in {"BLOCKED", "COMPLETE"} and source not in updated["completedStages"]:
        updated["completedStages"].append(source)
    updated["stage"] = target
    updated["stageMode"] = stage_mode
    if target == "IMPLEMENTATION" and stage_mode == "EMERGENCY_MITIGATION":
        updated["mitigationOutstanding"] = True
    updated["status"] = "COMPLETE" if target == "COMPLETE" else "IN_PROGRESS"
    updated["blocker"] = None
    _append_history(updated, source, target, reason)
    return validate_state(updated)


def block_state(
    state: dict[str, Any], code: str, message: str, owner: str = "user",
    evidence_refs: Iterable[str] = (), return_stage: str | None = None,
) -> dict[str, Any]:
    validate_state(state)
    updated = copy.deepcopy(state)
    source = state["stage"]
    updated["stage"] = "BLOCKED"
    updated["stageMode"] = None
    updated["status"] = "BLOCKED"
    updated["blocker"] = {
        "code": code,
        "message": message,
        "returnStage": return_stage or source,
        "returnStageMode": state["stageMode"],
        "owner": owner,
        "evidenceRefs": list(evidence_refs),
    }
    _append_history(updated, source, "BLOCKED", f"{code}: {message}")
    return validate_state(updated)


def unblock_state(state: dict[str, Any], reason: str) -> dict[str, Any]:
    validate_state(state)
    if state["stage"] != "BLOCKED" or not state["blocker"]:
        raise InvalidTransition("workflow is not blocked")
    if state["blocker"]["code"] == "DEPENDENCY_RELOAD_REQUIRED":
        raise InvalidTransition("dependency installation must be re-audited before resume")
    if state["blockedDependency"] is not None:
        raise InvalidTransition("dependency blocker must be cleared by a successful re-audit")
    if (
        state["blocker"]["code"] in {"GATE_BUDGET_EXHAUSTED", "SCRUTINIZE_NO_PROGRESS"}
        and state["blocker"]["returnStage"] in SCRUTINIZE_GATE_STAGES.values()
    ):
        raise InvalidTransition(
            "a scrutinize gate blocker requires an explicitly authorized new review series"
        )
    target = state["blocker"]["returnStage"]
    if target not in STAGES or target in {"BLOCKED", "COMPLETE"}:
        raise InvalidState(f"invalid blocker returnStage: {target}")
    updated = copy.deepcopy(state)
    updated["stage"] = target
    updated["stageMode"] = state["blocker"]["returnStageMode"]
    updated["status"] = "IN_PROGRESS"
    updated["blocker"] = None
    _append_history(updated, "BLOCKED", target, reason)
    return validate_state(updated)


def normalize_scrutinize_verdict(verdict: str) -> str:
    """Map common upstream review wording to the workflow's four outcomes."""
    if not isinstance(verdict, str):
        raise InvalidState("scrutinize verdict must be a string")
    normalized = re.sub(r"[^A-Z]+", "_", verdict.strip().upper()).strip("_")
    aliases = {
        "SHIP": "SHIP",
        "PASS": "SHIP",
        "PASSED": "SHIP",
        "ACCEPT": "SHIP",
        "ACCEPTED": "SHIP",
        "FIX_THEN_SHIP": "FIX_THEN_SHIP",
        "PASS_WITH_FIXES": "FIX_THEN_SHIP",
        "CONDITIONAL_PASS": "FIX_THEN_SHIP",
        "REWORK": "REWORK",
        "REVISE": "REWORK",
        "REJECT": "REJECT",
        "REJECTED": "REJECT",
    }
    try:
        return aliases[normalized]
    except KeyError as error:
        raise InvalidState(
            f"unsupported scrutinize verdict {verdict!r}; expected SHIP, FIX_THEN_SHIP, REWORK, or REJECT"
        ) from error


def _normalized_finding_list(values: Iterable[str], field: str) -> list[str]:
    if isinstance(values, str):
        raise InvalidState(f"{field} must be a string array")
    normalized: set[str] = set()
    for value in values:
        if not isinstance(value, str):
            raise InvalidState(f"{field} must contain only strings")
        value = value.strip()
        if value:
            if len(value) > 512:
                raise InvalidState(f"{field} entries must be concise references, not full reports")
            normalized.add(value)
    return sorted(normalized)


def record_scrutinize(
    state: dict[str, Any],
    gate: str,
    verdict: str,
    blocking_findings: Iterable[str] = (),
    new_findings: Iterable[str] = (),
    resolved_findings: Iterable[str] = (),
    repeated_findings: Iterable[str] = (),
    changed_artifacts: Iterable[str] = (),
    reason_for_retry: str = "",
    review_ref: str | None = None,
    no_progress: bool = False,
) -> dict[str, Any]:
    """Record one completed design/system scrutinize review.

    A review result is the unit of budget accounting. Fixes and edits between
    calls do not increment a counter. This function records only concise
    progress metadata; the full upstream review belongs in ``review_ref``.
    """
    validate_state(state)
    if gate not in SCRUTINIZE_GATES:
        raise InvalidState("scrutinize gates are design and system")
    expected_stage = SCRUTINIZE_GATE_STAGES[gate]
    if state["stage"] != expected_stage:
        raise InvalidTransition(f"{gate} scrutinize requires {expected_stage}")
    normalized_verdict = normalize_scrutinize_verdict(verdict)
    blockers = _normalized_finding_list(blocking_findings, "blockingFindings")
    supplied_new = _normalized_finding_list(new_findings, "newFindings")
    supplied_resolved = _normalized_finding_list(resolved_findings, "resolvedFindings")
    supplied_repeated = _normalized_finding_list(repeated_findings, "repeatedFindings")
    artifacts = _normalized_finding_list(changed_artifacts, "changedArtifacts")
    reason = reason_for_retry.strip() if isinstance(reason_for_retry, str) else ""
    if not isinstance(reason_for_retry, str):
        raise InvalidState("reasonForRetry must be a string")
    if len(reason) > 512:
        raise InvalidState("reasonForRetry must be a concise retry reason")
    if review_ref is not None and (not isinstance(review_ref, str) or not review_ref.strip()):
        raise InvalidState("reviewRef must be a non-empty string or null")
    if isinstance(review_ref, str) and len(review_ref.strip()) > 512:
        raise InvalidState("reviewRef must be a concise artifact reference")
    if normalized_verdict == "SHIP" and blockers:
        raise InvalidState("SHIP cannot contain blocking findings")
    if normalized_verdict != "SHIP" and not blockers:
        raise InvalidState(f"{normalized_verdict} requires at least one blocking finding")
    if normalized_verdict != "SHIP" and not reason:
        raise InvalidState("non-SHIP scrutinize results require reasonForRetry")

    previous_history = state["scrutinizeHistory"][gate]
    previous = previous_history[-1] if previous_history else None
    previous_blockers = set(previous["blockingFindings"]) if previous else set()
    current_blockers = set(blockers)
    new = sorted(current_blockers - previous_blockers | set(supplied_new))
    resolved = sorted(previous_blockers - current_blockers | set(supplied_resolved))
    repeated = sorted(current_blockers & previous_blockers | set(supplied_repeated))

    next_cycle = state["gateCycles"][gate] + 1
    if next_cycle > MAX_SCRUTINIZE_CYCLES:
        raise InvalidTransition(
            f"{gate} scrutinize maximum of {MAX_SCRUTINIZE_CYCLES} cycles is already exhausted"
        )
    updated = copy.deepcopy(state)
    updated["gateCycles"][gate] = next_cycle
    updated["gateBlockers"][gate] = blockers
    updated[f"{gate}ScrutinizeCycles"] = next_cycle
    updated["scrutinizeHistory"][gate].append(
        {
            "cycleNumber": next_cycle,
            "verdict": normalized_verdict,
            "blockingFindings": blockers,
            "newFindings": new,
            "resolvedFindings": resolved,
            "repeatedFindings": repeated,
            "changedArtifacts": artifacts,
            "reasonForRetry": reason,
            "reviewRef": review_ref.strip() if isinstance(review_ref, str) else None,
        }
    )

    repeated_without_progress = bool(
        previous
        and normalized_verdict != "SHIP"
        and current_blockers == previous_blockers
        and not new
        and not resolved
    )
    if no_progress or repeated_without_progress:
        return block_state(
            updated,
            "SCRUTINIZE_NO_PROGRESS",
            f"{gate} scrutinize repeated the same blocking findings without useful progress on cycle {next_cycle}",
            owner="engineering",
            evidence_refs=blockers,
            return_stage=expected_stage,
        )
    if normalized_verdict != "SHIP" and next_cycle == MAX_SCRUTINIZE_CYCLES:
        return block_state(
            updated,
            "GATE_BUDGET_EXHAUSTED",
            f"{gate} scrutinize still has blockers after cycle {next_cycle}/{MAX_SCRUTINIZE_CYCLES}: "
            + ", ".join(blockers),
            owner="engineering",
            evidence_refs=blockers,
            return_stage=expected_stage,
        )
    return validate_state(updated)


def restart_scrutinize_series(
    state: dict[str, Any],
    gate: str,
    reason: str,
    human_authorized: bool = False,
    materially_new_solution: bool = False,
) -> dict[str, Any]:
    """Start a fresh gate budget only after an explicit human decision."""
    validate_state(state)
    if gate not in SCRUTINIZE_GATES:
        raise InvalidState("scrutinize gates are design and system")
    if state["stage"] != "BLOCKED" or not state["blocker"]:
        raise InvalidTransition("a new scrutinize series requires a blocked workflow")
    if state["blockedDependency"] is not None:
        raise InvalidTransition("resolve the dependency blocker before restarting scrutinize")
    if state["blocker"]["code"] not in {"GATE_BUDGET_EXHAUSTED", "SCRUTINIZE_NO_PROGRESS"}:
        raise InvalidTransition("only an exhausted or no-progress scrutinize gate can start a new series")
    if not human_authorized or not materially_new_solution:
        raise InvalidTransition(
            "restarting scrutinize requires explicit human authorization and a materially new solution"
        )
    target = SCRUTINIZE_GATE_STAGES[gate]
    if state["blocker"]["returnStage"] != target:
        raise InvalidTransition(f"blocked workflow does not belong to the {gate} scrutinize gate")
    updated = copy.deepcopy(state)
    updated["stage"] = target
    updated["stageMode"] = None
    updated["status"] = "IN_PROGRESS"
    updated["blocker"] = None
    updated["gateCycles"][gate] = 0
    updated["gateBlockers"][gate] = []
    updated[f"{gate}ScrutinizeCycles"] = 0
    updated["scrutinizeHistory"][gate] = []
    _append_history(updated, "BLOCKED", target, f"new scrutinize series: {reason}")
    return validate_state(updated)


def record_gate(
    state: dict[str, Any], gate: str, blockers: Iterable[str]
) -> dict[str, Any]:
    validate_state(state)
    if gate not in GATES:
        raise InvalidState(f"unknown gate: {gate}")
    if gate in SCRUTINIZE_GATES:
        normalized = _normalized_finding_list(blockers, "blockingFindings")
        return record_scrutinize(
            state,
            gate,
            "SHIP" if not normalized else "FIX_THEN_SHIP",
            normalized,
            reason_for_retry="blocking findings require another review" if normalized else "",
        )
    updated = copy.deepcopy(state)
    next_cycle = updated["gateCycles"][gate] + 1
    if next_cycle > updated["gateBudgets"][gate]:
        raise InvalidTransition(f"{gate} gate budget is already exhausted")
    normalized = sorted({item.strip() for item in blockers if item.strip()})
    updated["gateCycles"][gate] = next_cycle
    updated["gateBlockers"][gate] = normalized
    if normalized and next_cycle >= updated["gateBudgets"][gate]:
        return block_state(
            updated,
            "GATE_BUDGET_EXHAUSTED",
            f"{gate} gate still has blockers after cycle {next_cycle}: " + ", ".join(normalized),
            owner="engineering",
            evidence_refs=normalized,
            return_stage=state["stage"],
        )
    return validate_state(updated)


def _safe_repository_path(root: Path, relative_path: str) -> Path:
    if Path(relative_path).is_absolute():
        raise InvalidState("artifact path must be repository-relative")
    resolved = (root / relative_path).resolve()
    try:
        resolved.relative_to(root.resolve())
    except ValueError as error:
        raise InvalidState("artifact path leaves repository root") from error
    return resolved


def register_artifact(
    state: dict[str, Any], root: Path, kind: str, relative_path: str,
    producer_stage: str, artifact_git_ref: str | None = None,
) -> dict[str, Any]:
    validate_state(state)
    if producer_stage not in STAGES:
        raise InvalidState(f"invalid producer stage: {producer_stage}")
    path = _safe_repository_path(root, relative_path)
    if not path.is_file():
        raise InvalidState(f"artifact does not exist: {relative_path}")
    reference = {
        "kind": kind,
        "path": Path(relative_path).as_posix(),
        "fingerprint": file_fingerprint(path),
        "producerStage": producer_stage,
        "gitRef": artifact_git_ref,
    }
    updated = copy.deepcopy(state)
    match_index = None
    for index, existing in enumerate(updated["artifactRefs"]):
        same_stable_review = kind in REVIEW_KINDS and existing["kind"] == kind
        if same_stable_review and existing["path"] != reference["path"]:
            raise InvalidState(
                f"stable {kind} artifact already registered at {existing['path']}"
            )
        if existing["path"] == reference["path"] or same_stable_review:
            match_index = index
            break
    if match_index is not None:
        if updated["artifactRefs"][match_index] == reference:
            return state
        updated["artifactRefs"][match_index] = reference
    else:
        updated["artifactRefs"].append(reference)
    return validate_state(updated)


def default_artifact_path(workflow_id: str, kind: str, slug: str | None = None) -> str:
    root = f".scratch/{workflow_id}"
    mapping = {
        "discovery": f"{root}/discovery.md",
        "acceptance": f"{root}/acceptance.md",
        "spec": f"{root}/spec.md",
        "wayfinding": f"{root}/wayfinding.md",
        "diagnosis": f"{root}/evidence/diagnosis.md",
        "regression": f"{root}/evidence/regression.md",
        "design-review": f"{root}/reviews/design.md",
        "code-review": f"{root}/reviews/code.md",
        "system-review": f"{root}/reviews/system.md",
        "implementation": f"{root}/evidence/implementation.md",
        "post-mortem": f"{root}/post-mortem.md",
        "research": f"{root}/evidence/research.md",
        "prototype": f"{root}/evidence/prototype.md",
    }
    if kind == "ticket":
        if not slug:
            raise InvalidState("ticket artifact requires a slug including its numeric prefix")
        return f"{root}/issues/{slug}.md"
    if kind not in mapping:
        raise InvalidState(f"unknown default artifact kind: {kind}")
    return mapping[kind]


def _stage_index(stage: str) -> int:
    return STAGES.index(stage)


def _rewind(state: dict[str, Any], target: str, reasons: list[str]) -> dict[str, Any]:
    updated = copy.deepcopy(state)
    source = updated["stage"]
    updated["stage"] = target
    updated["stageMode"] = None
    updated["status"] = "IN_PROGRESS"
    updated["blocker"] = None
    cutoff = _stage_index(target)
    updated["completedStages"] = [
        stage for stage in updated["completedStages"]
        if stage in STAGES and _stage_index(stage) < cutoff
    ]
    _append_history(updated, source, target, "reconcile: " + "; ".join(reasons))
    return validate_state(updated)


def reconcile_state(
    state: dict[str, Any], root: Path, run_checks: bool = False
) -> tuple[dict[str, Any], list[str]]:
    validate_state(state)
    reasons_by_stage: list[tuple[str, str]] = []
    for reference in state["artifactRefs"]:
        path = _safe_repository_path(root, reference["path"])
        if not path.is_file():
            reasons_by_stage.append((reference["producerStage"], f"missing artifact {reference['path']}"))
        elif file_fingerprint(path) != reference["fingerprint"]:
            reasons_by_stage.append((reference["producerStage"], f"changed artifact {reference['path']}"))

    current_git_ref = git_ref(root)
    if state["lastVerifiedGitRef"] and current_git_ref != state["lastVerifiedGitRef"]:
        reasons_by_stage.append(
            ("IMPLEMENTATION", f"Git ref changed from {state['lastVerifiedGitRef']} to {current_git_ref}")
        )
    current_worktree = worktree_fingerprint(root)
    if state["worktreeFingerprint"] and current_worktree != state["worktreeFingerprint"]:
        reasons_by_stage.append(("IMPLEMENTATION", "worktree fingerprint changed"))

    if run_checks and state["verificationCommands"]:
        for command in state["verificationCommands"]:
            result = subprocess.run(command, cwd=root, text=True, capture_output=True, check=False)
            if result.returncode != 0:
                reasons_by_stage.append(
                    ("IMPLEMENTATION", f"verification failed ({' '.join(command)}): {result.returncode}")
                )

    if not reasons_by_stage:
        return state, []
    earliest_stage = min(reasons_by_stage, key=lambda item: _stage_index(item[0]))[0]
    reasons = [reason for _, reason in reasons_by_stage]
    return _rewind(state, earliest_stage, reasons), reasons


def reconstruct_from_artifacts(
    root: Path, request: str, workflow_id: str, workflow_type: str = "FEATURE"
) -> dict[str, Any]:
    state = new_state(request, workflow_id=workflow_id, workflow_type=workflow_type, root=root)
    candidates = (
        ("spec", default_artifact_path(workflow_id, "spec"), "SPECIFICATION"),
        ("design-review", default_artifact_path(workflow_id, "design-review"), "DESIGN_REVIEW"),
        ("implementation", default_artifact_path(workflow_id, "implementation"), "IMPLEMENTATION"),
        ("code-review", default_artifact_path(workflow_id, "code-review"), "CODE_REVIEW"),
        ("system-review", default_artifact_path(workflow_id, "system-review"), "SYSTEM_REVIEW"),
        ("post-mortem", default_artifact_path(workflow_id, "post-mortem"), "POST_MORTEM"),
    )
    found: list[str] = []
    for kind, relative_path, producer in candidates:
        if (root / relative_path).is_file():
            state = register_artifact(state, root, kind, relative_path, producer)
            found.append(producer)
    if not found:
        raise InvalidState(f"cannot reconstruct {workflow_id}: no unambiguous default artifacts")
    latest = max(found, key=_stage_index)
    state["stage"] = latest
    state["completedStages"] = sorted(
        {stage for stage in found if _stage_index(stage) < _stage_index(latest)},
        key=_stage_index,
    )
    _append_history(state, "IDLE", latest, "reconstructed from existing artifact fingerprints")
    return validate_state(state)


def _save_selected(root: Path, state: dict[str, Any], expected_revision: int) -> dict[str, Any]:
    return atomic_write_state(workflow_path(root, state["id"]), state, expected_revision)


def _compact(state: dict[str, Any]) -> dict[str, Any]:
    scrutinize = {}
    for gate in sorted(SCRUTINIZE_GATES):
        history = state["scrutinizeHistory"][gate]
        scrutinize[gate] = {
            "cycles": state[f"{gate}ScrutinizeCycles"],
            "maximum": MAX_SCRUTINIZE_CYCLES,
            "lastVerdict": history[-1]["verdict"] if history else None,
        }
    return {
        "id": state["id"],
        "workflowType": state["workflowType"],
        "stage": state["stage"],
        "stageMode": state["stageMode"],
        "status": state["status"],
        "currentWorkItem": state["currentWorkItem"],
        "gateCycles": state["gateCycles"],
        "scrutinize": scrutinize,
        "dependencyStatus": {
            name: value.get("status", "NOT_CHECKED")
            for name, value in state["dependencyStatus"].items()
            if isinstance(value, dict)
        },
        "blockedDependency": state["blockedDependency"],
        "pendingInstallationPermission": state["pendingInstallationPermission"],
        "blocker": state["blocker"],
        "revision": state["revision"],
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    commands = parser.add_subparsers(dest="command", required=True)
    init = commands.add_parser("init")
    init.add_argument("request")
    init.add_argument("--type", choices=TYPE_ENTRY)
    init.add_argument("--parent")
    reconstruct = commands.add_parser("reconstruct")
    reconstruct.add_argument("workflow_id")
    reconstruct.add_argument("request")
    reconstruct.add_argument("--type", choices=TYPE_ENTRY, default="FEATURE")
    commands.add_parser("list").add_argument("--include-complete", action="store_true")
    status = commands.add_parser("status")
    status.add_argument("workflow_id", nargs="?")
    move = commands.add_parser("transition")
    move.add_argument("workflow_id")
    move.add_argument("target", choices=STAGES)
    move.add_argument("--mode", choices=sorted(STAGE_MODES))
    move.add_argument("--reason", required=True)
    classify = commands.add_parser("classify")
    classify.add_argument("workflow_id")
    classify.add_argument("workflow_type", choices=TYPE_ENTRY)
    classify.add_argument("risk", choices=("LOW", "MEDIUM", "HIGH", "CRITICAL"))
    classify.add_argument("uncertainty", choices=("LOW", "MEDIUM", "HIGH", "CRITICAL"))
    classify.add_argument("--scope", required=True)
    classify.add_argument("--characteristic", action="append", default=[])
    classify.add_argument("--incident", action="store_true")
    block = commands.add_parser("block")
    block.add_argument("workflow_id")
    block.add_argument("code")
    block.add_argument("message")
    block.add_argument("--owner", default="user")
    unblock = commands.add_parser("unblock")
    unblock.add_argument("workflow_id")
    unblock.add_argument("--reason", required=True)
    artifact = commands.add_parser("register-artifact")
    artifact.add_argument("workflow_id")
    artifact.add_argument("kind")
    artifact.add_argument("path")
    artifact.add_argument("producer_stage", choices=STAGES)
    work_item = commands.add_parser("set-work-item")
    work_item.add_argument("workflow_id")
    work_item.add_argument("reference")
    mitigation = commands.add_parser("set-mitigation")
    mitigation.add_argument("workflow_id")
    mitigation.add_argument("status", choices=("outstanding", "resolved"))
    mitigation.add_argument("--reason", required=True)
    dependency = commands.add_parser("record-dependencies")
    dependency.add_argument("workflow_id")
    dependency.add_argument("audit_json", type=Path)
    child = commands.add_parser("add-child")
    child.add_argument("workflow_id")
    child.add_argument("child_id")
    verify = commands.add_parser("verify")
    verify.add_argument("workflow_id")
    verify.add_argument("--command-json", action="append", default=[])
    gate = commands.add_parser("gate")
    gate.add_argument("workflow_id")
    gate.add_argument("gate", choices=GATES)
    gate.add_argument("--blocker", action="append", default=[])
    scrutinize = commands.add_parser("scrutinize")
    scrutinize.add_argument("workflow_id")
    scrutinize.add_argument("gate", choices=sorted(SCRUTINIZE_GATES))
    scrutinize.add_argument("verdict")
    scrutinize.add_argument("--blocking-finding", action="append", default=[])
    scrutinize.add_argument("--new-finding", action="append", default=[])
    scrutinize.add_argument("--resolved-finding", action="append", default=[])
    scrutinize.add_argument("--repeated-finding", action="append", default=[])
    scrutinize.add_argument("--changed-artifact", action="append", default=[])
    scrutinize.add_argument("--reason-for-retry", default="")
    scrutinize.add_argument("--review-ref")
    scrutinize.add_argument("--no-progress", action="store_true")
    installation = commands.add_parser("request-installation")
    installation.add_argument("workflow_id")
    installation.add_argument("dependencies_json", type=Path)
    installation.add_argument("proposals_json", type=Path)
    installation.add_argument("--needed-at", required=True, choices=[stage for stage in STAGES if stage not in {"BLOCKED", "COMPLETE"}])
    installation.add_argument("--reason", required=True)
    decision = commands.add_parser("installation-decision")
    decision.add_argument("workflow_id")
    decision.add_argument("decision", choices=("approved", "declined"))
    decision.add_argument("--reason", required=True)
    reconcile = commands.add_parser("reconcile")
    reconcile.add_argument("workflow_id", nargs="?")
    reconcile.add_argument("--run-checks", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    root = args.root.resolve()
    if args.command == "init":
        state, path, created = init_workflow(root, args.request, args.type, args.parent)
        output: Any = {"created": created, "path": str(path), "state": _compact(state)}
    elif args.command == "reconstruct":
        state = reconstruct_from_artifacts(root, args.request, args.workflow_id, args.type)
        path = workflow_path(root, args.workflow_id)
        saved = atomic_write_state(path, state, None)
        output = {"created": True, "path": str(path), "state": _compact(saved)}
    elif args.command == "list":
        output = [_compact(state) for state in list_states(root, args.include_complete)]
    elif args.command == "status":
        output = _compact(select_active(root, args.workflow_id))
    else:
        state = select_active(root, getattr(args, "workflow_id", None))
        revision = state["revision"]
        if args.command == "transition":
            state = transition(state, args.target, args.reason, args.mode, root=root)
        elif args.command == "classify":
            state = classify_state(
                state, args.workflow_type, args.risk, args.uncertainty,
                args.scope, args.characteristic, args.incident,
            )
        elif args.command == "block":
            state = block_state(state, args.code, args.message, args.owner)
        elif args.command == "unblock":
            state = unblock_state(state, args.reason)
        elif args.command == "register-artifact":
            state = register_artifact(state, root, args.kind, args.path, args.producer_stage)
        elif args.command == "set-work-item":
            state = set_current_work_item(state, args.reference)
        elif args.command == "set-mitigation":
            state = set_mitigation_outstanding(
                state, args.status == "outstanding", args.reason
            )
        elif args.command == "record-dependencies":
            try:
                audit = json.loads(args.audit_json.read_text(encoding="utf-8"))
            except (OSError, UnicodeError, json.JSONDecodeError) as error:
                raise InvalidState(f"invalid dependency audit JSON: {error}") from error
            state = record_dependency_audit(state, audit)
        elif args.command == "add-child":
            state = add_child_workflow(state, root, args.child_id)
        elif args.command == "verify":
            commands_to_run = None
            if args.command_json:
                commands_to_run = []
                for raw_command in args.command_json:
                    try:
                        command = json.loads(raw_command)
                    except json.JSONDecodeError as error:
                        raise InvalidState(f"invalid command JSON: {error}") from error
                    if not isinstance(command, list) or not command or not all(isinstance(item, str) for item in command):
                        raise InvalidState("each verification command must be a non-empty JSON string array")
                    commands_to_run.append(command)
            state, verification_results = run_verification(state, root, commands_to_run)
        elif args.command == "gate":
            state = record_gate(state, args.gate, args.blocker)
        elif args.command == "scrutinize":
            state = record_scrutinize(
                state,
                args.gate,
                args.verdict,
                args.blocking_finding,
                args.new_finding,
                args.resolved_finding,
                args.repeated_finding,
                args.changed_artifact,
                args.reason_for_retry,
                args.review_ref,
                args.no_progress,
            )
        elif args.command == "request-installation":
            try:
                dependencies = json.loads(args.dependencies_json.read_text(encoding="utf-8"))
                proposals = json.loads(args.proposals_json.read_text(encoding="utf-8"))
            except (OSError, UnicodeError, json.JSONDecodeError) as error:
                raise InvalidState(f"invalid installation request JSON: {error}") from error
            if not isinstance(dependencies, list) or not isinstance(proposals, list):
                raise InvalidState("installation dependencies and proposals must be JSON arrays")
            state = request_installation_permission(
                state, dependencies, args.needed_at, args.reason, proposals
            )
        elif args.command == "installation-decision":
            state = record_installation_decision(
                state, args.decision == "approved", args.reason
            )
        elif args.command == "reconcile":
            state, reasons = reconcile_state(state, root, args.run_checks)
            if not reasons:
                output = {"changed": False, "state": _compact(state), "reasons": []}
                print(json.dumps(output, ensure_ascii=False, indent=2))
                return 0
        else:
            raise AssertionError(args.command)
        saved = _save_selected(root, state, revision)
        output = {"changed": True, "state": _compact(saved)}
        if args.command == "verify":
            output["verificationResults"] = verification_results
        if args.command == "reconcile":
            output["reasons"] = reasons
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except WorkflowStateError as error:
        print(json.dumps({"error": type(error).__name__, "message": str(error)}))
        raise SystemExit(2)
