import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

// Schema-level checks (non-empty arrays, field presence/types, unique ids) are
// enforced by scripts/validate-skills.mjs on the canonical copy. This contract
// covers what that validator cannot: the .agents/ mirror, and the spec's
// requirement of one eval case per Design Review Gate routing branch.

async function fileExists(filePath) {
  await access(filePath, constants.R_OK);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

const evalDirs = [
  "skills/agents/grill-to-tickets/evals",
  ".agents/skills/grill-to-tickets/evals",
];
const canonicalDir = evalDirs[0];

const evalsJson = () => readJson(path.resolve(canonicalDir, "evals.json"));
const triggerJson = () => readJson(path.resolve(canonicalDir, "trigger-evals.json"));
const caseText = (item) => `${item.expected_output} ${item.expectations.join(" ")}`;

describe("grill-to-tickets eval suite contract", () => {
  it("ships trigger-evals.json and evals.json in the canonical and installed copies", async () => {
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
    it("confirms both /grill-to-tickets and $grill-to-tickets trigger", async () => {
      const positives = (await triggerJson()).filter((t) => t.should_trigger);
      assert.ok(
        positives.some((t) => t.query.includes("/grill-to-tickets")),
        "a /grill-to-tickets positive case is required",
      );
      assert.ok(
        positives.some((t) => t.query.includes("$grill-to-tickets")),
        "a $grill-to-tickets positive case is required",
      );
    });

    it("includes negative cases, none using an explicit grill-to-tickets invocation", async () => {
      const negatives = (await triggerJson()).filter((t) => !t.should_trigger);
      assert.ok(negatives.length >= 2, "at least two negative cases are required");
      for (const item of negatives) {
        assert.doesNotMatch(
          item.query,
          /[/$]grill-to-tickets/,
          "negative cases must not use an explicit grill-to-tickets invocation",
        );
      }
    });
  });

  describe("evals.json", () => {
    const routingBranches = [
      { label: "first-pass SHIP", match: /\bSHIP\b/ },
      { label: "FIX_THEN_SHIP", match: /\bFIX_THEN_SHIP\b/ },
      { label: "spec-level REWORK", match: /spec-level/i },
      { label: "decision-level REWORK", match: /decision-level/i },
      { label: "REJECT", match: /\bREJECT\b/ },
      { label: "stall", match: /stall/i },
      { label: "budget exhaustion", match: /budget exhaustion|fresh .*budget|human authoriz/i },
    ];

    it("declares skill_name grill-to-tickets and exactly 7 eval cases", async () => {
      const payload = await evalsJson();
      assert.equal(payload.skill_name, "grill-to-tickets");
      assert.equal(payload.evals.length, 7, "one case per Design Review Gate routing branch");
    });

    it("drives every case through an explicit grill-to-tickets invocation", async () => {
      for (const item of (await evalsJson()).evals) {
        assert.match(
          item.prompt,
          /[/$]grill-to-tickets/,
          `case ${item.id} must invoke grill-to-tickets explicitly (disable-model-invocation)`,
        );
        assert.ok(Array.isArray(item.files), `case ${item.id} must carry a files array`);
      }
    });

    it("covers every Design Review Gate routing branch", async () => {
      const { evals } = await evalsJson();
      for (const branch of routingBranches) {
        const hits = evals.filter(
          (e) => branch.match.test(e.name) || branch.match.test(e.expected_output),
        );
        assert.ok(hits.length >= 1, `no eval case covers ${branch.label}`);
      }
    });

    it("asserts the SHIP path never invokes implement and prints the handoff", async () => {
      const ship = (await evalsJson()).evals.find((e) => /first-pass SHIP/i.test(e.name));
      assert.ok(ship, "a first-pass SHIP case is required");
      assert.match(caseText(ship), /implement/i);
      assert.match(caseText(ship), /\/clear|handoff/i);
    });

    it("asserts the decision-level rework case carries the cycle counter over", async () => {
      const decision = (await evalsJson()).evals.find((e) => /decision-level/i.test(e.name));
      assert.ok(decision, "a decision-level REWORK case is required");
      assert.match(caseText(decision), /carr(y|ies|ied)|not reset|never reset/i);
      assert.match(caseText(decision), /Stage 0/);
    });

    it("asserts the budget case requires human authorization and forbids cycle 7", async () => {
      const budget = (await evalsJson()).evals.find((e) => /budget exhaustion/i.test(e.name));
      assert.ok(budget, "a budget-exhaustion case is required");
      assert.match(caseText(budget), /human authoriz/i);
      assert.match(caseText(budget), /cycle 7|seventh cycle/i);
    });
  });
});
