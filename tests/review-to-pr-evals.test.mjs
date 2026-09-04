import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

// The eval files are behavioral documentation in skill-creator's benchmark
// format, not a CI gate — nothing here runs the prompts. This contract covers
// what scripts/validate-skills.mjs cannot: the .agents/ mirror, one case per
// decision branch, and drift between the skill prose and the eval claims.

async function fileExists(filePath) {
  await access(filePath, constants.R_OK);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

const evalDirs = [
  "skills/agents/review-to-pr/evals",
  ".agents/skills/review-to-pr/evals",
];
const canonicalDir = evalDirs[0];

const evalsJson = () => readJson(path.resolve(canonicalDir, "evals.json"));
const triggerJson = () => readJson(path.resolve(canonicalDir, "trigger-evals.json"));

describe("review-to-pr eval suite contract", () => {
  it("ships trigger-evals.json and evals.json in the canonical and mirror copies", async () => {
    for (const dir of evalDirs) {
      await fileExists(path.resolve(dir, "trigger-evals.json"));
      await fileExists(path.resolve(dir, "evals.json"));
    }
  });

  it("keeps every eval file byte-identical across the skill copies", async () => {
    for (const name of ["trigger-evals.json", "evals.json"]) {
      const contents = await Promise.all(
        evalDirs.map((dir) => readFile(path.resolve(dir, name), "utf8")),
      );
      for (const other of contents.slice(1)) {
        assert.equal(other, contents[0], `${name} copies must match ${canonicalDir}`);
      }
    }
  });

  describe("trigger-evals.json", () => {
    it("confirms both /review-to-pr and $review-to-pr trigger", async () => {
      const positives = (await triggerJson()).filter((t) => t.should_trigger);
      assert.ok(positives.some((t) => t.query.includes("/review-to-pr")));
      assert.ok(positives.some((t) => t.query.includes("$review-to-pr")));
    });

    it("includes negative cases, none using an explicit review-to-pr invocation", async () => {
      const negatives = (await triggerJson()).filter((t) => !t.should_trigger);
      assert.ok(negatives.length >= 3, "at least three negative cases are required");
      for (const item of negatives) {
        assert.doesNotMatch(
          item.query,
          /[/$]review-to-pr/,
          "negative cases must not use an explicit review-to-pr invocation",
        );
      }
    });

    it("has a negative case for a bare 'review this branch' and for a sibling skill", async () => {
      const negatives = (await triggerJson()).filter((t) => !t.should_trigger);
      assert.ok(negatives.some((t) => /review (this|the) .*branch/i.test(t.query)));
      assert.ok(negatives.some((t) => /subagent-implement|agy-implement|engineering-workflow|\/code-review\b/i.test(t.query)));
    });
  });

  describe("evals.json", () => {
    it("declares skill_name review-to-pr and unique ids and names", async () => {
      const payload = await evalsJson();
      assert.equal(payload.skill_name, "review-to-pr");
      assert.ok(Array.isArray(payload.evals) && payload.evals.length > 0);
      const ids = new Set();
      const names = new Set();
      for (const item of payload.evals) {
        assert.ok(Number.isInteger(item.id) && !ids.has(item.id), `unique id ${item.id}`);
        ids.add(item.id);
        assert.ok(typeof item.name === "string" && !names.has(item.name), "unique name");
        names.add(item.name);
        assert.ok(Array.isArray(item.files), `case ${item.id} carries a files array`);
        assert.ok(Array.isArray(item.expectations) && item.expectations.length > 0);
      }
    });

    it("drives every case through an explicit review-to-pr invocation", async () => {
      for (const item of (await evalsJson()).evals) {
        assert.match(
          item.prompt,
          /[/$]review-to-pr/,
          `case ${item.id} must invoke review-to-pr explicitly (disable-model-invocation)`,
        );
      }
    });

    it("covers the trigger-policy and handoff branches (ticket 01)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));
      assert.ok(hay(/explicit invocation|does not start itself/i), "explicit-invocation-only");
      assert.ok(hay(/merge-base with main|git merge-base main HEAD/i), "default review point");
      assert.ok(hay(/no PR step|opens no pull request|no git push/i), "handoff performs no PR step");
    });

    it("covers the Stage 0 review-point branches (ticket 02)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));
      assert.ok(hay(/explicit ref .*overrides|overrides the review point/i), "explicit ref override");
      assert.ok(hay(/branch-name stem/i), "branch-stem slug");
      assert.ok(hay(/most recent(ly modified)? .*\.scratch|names? it back/i), "most-recent .scratch named back");
      assert.ok(hay(/degraded|commit-messages|commit messages alone/i), "degraded Spec axis");
      assert.ok(hay(/unresolvable|resolves as neither/i), "unresolvable ref halts");
      assert.ok(hay(/empty diff|diff .*is empty/i), "empty diff halts");
      assert.ok(hay(/dirty .*tree|git stash/i), "dirty tree stops and asks");
      assert.ok(hay(/both a ref and a slug/i), "argument that is both a ref and a slug");
    });

    it("covers the Stage 1 code-review loop branches (ticket 03)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));
      assert.ok(hay(/routes to Stage 2|blocker .*Stage 2/i), "blocker found -> Stage 2");
      assert.ok(hay(/clean two-axis review|straight to Stage 3|routes to Stage 3/i), "clean review -> Stage 3");
      assert.ok(hay(/non-blocking smell|carried[\s\S]*?not fixed/i), "non-blocking smell carried not fixed");
      assert.ok(hay(/third .*review is the ceiling|three-cycle ceiling/i), "third cycle is the ceiling");
      assert.ok(hay(/no-progress cycle/i), "no-progress cycle ends the loop early");
      assert.ok(hay(/Standards-axis-only blocker|Standards axis only/i), "single-axis blocker still routes to Stage 2");
    });

    it("covers the Stage 2 fix-dispatch branches (ticket 04)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));
      assert.ok(hay(/multi-file cluster is dispatched|spans more than one file/i), "multi-file cluster dispatched");
      assert.ok(hay(/one-file no-test-change cluster is hand-applied inline|hand-applies it inline/i), "one-file no-test cluster inline");
      assert.ok(hay(/missing-test blocker is dispatched test-first|needs a new test/i), "missing-test blocker dispatched test-first");
      assert.ok(hay(/three failed attempts leave the cluster unfixable/i), "three failed attempts -> unfixable + named in handoff");
      assert.ok(hay(/worker crash counts as one attempt/i), "worker crash counts as one attempt");
      assert.ok(hay(/exactly one appended fix\(review\): commit|one fix\(review\): commit per cluster/i), "one fix(review): commit per cluster");
      assert.ok(hay(/orchestrator does not hand-code a dispatched cluster/i), "orchestrator does not hand-code a dispatched cluster");
    });

    it("covers the Stage 3 system-scrutinize branches (ticket 05)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));
      assert.ok(hay(/self-contained change skips the system gate/i), "self-contained -> gate skipped, noted in handoff");
      assert.ok(hay(/cross-cutting change runs the system gate/i), "cross-cutting -> gate runs");
      assert.ok(hay(/ship verdict closes the gate/i), "ship -> Stage 4");
      assert.ok(hay(/fix-then-ship verdict drives the sub-loop/i), "fix-then-ship -> sub-loop with code-review re-run");
      assert.ok(hay(/reject verdict stops the run/i), "reject -> stop");
      assert.ok(hay(/rework verdict drives the same sub-loop/i), "rework -> sub-loop, distinct from reject");
      assert.ok(hay(/two consecutive cycles end the sub-loop early/i), "two-consecutive-stall ends the sub-loop early");
      assert.ok(hay(/scrutinize budget is independent of the code budget/i), "scrutinize budget independent of the code budget");
    });

    it("covers the Stage 4-5 state and resume branches (ticket 06)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));
      assert.ok(hay(/red full suite is a new blocker/i), "red suite -> new blocker -> Stage 2");
      assert.ok(hay(/red suite with the code ceiling spent/i), "red suite with ceiling spent -> stop unresolved");
      assert.ok(hay(/continue reconciles against reality/i), "continue -> Reality reconciliation");
      assert.ok(hay(/status is read-only/i), "status -> read-only");
    });

    it("carries at least one case per decision branch across every stage", async () => {
      const { evals } = await evalsJson();
      assert.ok(evals.length >= 32, `expected >= 32 eval cases, got ${evals.length}`);
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));
      const branches = {
        "explicit invocation only": /explicit invocation|does not start itself/i,
        "default merge-base review point": /merge-base with main|git merge-base main HEAD/i,
        "explicit ref override": /explicit ref .*overrides|overrides the review point/i,
        "branch-stem slug": /branch-name stem/i,
        "most-recent .scratch named back": /most recent(ly modified)? .*\.scratch|names? it back/i,
        "degraded Spec axis": /degraded|commit-messages|commit messages alone/i,
        "unresolvable ref halts": /unresolvable|resolves as neither/i,
        "empty diff halts": /empty diff|diff .*is empty/i,
        "dirty tree stops and asks": /dirty .*tree|git stash/i,
        "argument is both ref and slug": /both a ref and a slug/i,
        "blocker -> Stage 2": /routes to Stage 2|blocker .*Stage 2/i,
        "clean review -> Stage 3": /clean two-axis review|straight to Stage 3/i,
        "non-blocking smell carried not fixed": /non-blocking smell|carried[\s\S]*?not fixed/i,
        "third cycle is the ceiling": /third .*review is the ceiling|three-cycle ceiling/i,
        "no-progress cycle ends the loop": /no-progress cycle/i,
        "single-axis blocker routes to Stage 2": /Standards-axis-only blocker/i,
        "multi-file cluster dispatched": /multi-file cluster is dispatched/i,
        "one-file no-test cluster inline": /one-file no-test-change cluster is hand-applied inline/i,
        "missing-test blocker dispatched test-first": /missing-test blocker is dispatched test-first/i,
        "three failed attempts -> unfixable": /three failed attempts leave the cluster unfixable/i,
        "worker crash counts as one attempt": /worker crash counts as one attempt/i,
        "one fix(review): commit per cluster": /exactly one appended fix\(review\): commit/i,
        "orchestrator does not hand-code dispatched cluster": /orchestrator does not hand-code a dispatched cluster/i,
        "self-contained -> gate skipped": /self-contained change skips the system gate/i,
        "cross-cutting -> gate runs": /cross-cutting change runs the system gate/i,
        "ship -> Stage 4": /ship verdict closes the gate/i,
        "fix-then-ship -> sub-loop": /fix-then-ship verdict drives the sub-loop/i,
        "reject -> stop": /reject verdict stops the run/i,
        "rework -> sub-loop": /rework verdict drives the same sub-loop/i,
        "two-consecutive-stall ends sub-loop": /two consecutive cycles end the sub-loop early/i,
        "scrutinize budget independent of code budget": /scrutinize budget is independent of the code budget/i,
        "red suite -> new blocker": /red full suite is a new blocker/i,
        "red suite + ceiling spent -> stop": /red suite with the code ceiling spent/i,
        "continue -> Reality reconciliation": /continue reconciles against reality/i,
        "status -> read-only": /status is read-only/i,
        "handoff -> /pr-to-dev, no PR step": /stops before the PR|no PR step|opens no pull request/i,
        "--agent pin and --model pass-through": /--agent pins the fix worker|--model is a raw pass-through/i,
      };
      for (const [label, re] of Object.entries(branches)) {
        assert.ok(hay(re), `no eval case covers: ${label}`);
      }
    });
  });
});
