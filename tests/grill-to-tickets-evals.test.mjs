import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

// The eval files are behavioral documentation in skill-creator's benchmark
// format, not a CI gate — nothing here runs the prompts. `evals.json` cases are
// exercised by a human through skill-creator's benchmark mode; `trigger-evals.json`
// only guards that the description does not read as model-invocable (the skill is
// `disable-model-invocation`, so real trigger tuning is moot). This contract
// covers what scripts/validate-skills.mjs cannot: the `.agents/` mirror, the
// one-case-per-routing-branch requirement, and cycle-budget drift between the
// skill prose and the evals.

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
const skillDir = path.resolve(canonicalDir, "..");

const evalsJson = () => readJson(path.resolve(canonicalDir, "evals.json"));
const triggerJson = () => readJson(path.resolve(canonicalDir, "trigger-evals.json"));

const NUMBER_WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const spell = (n) => Object.keys(NUMBER_WORDS).find((w) => NUMBER_WORDS[w] === n);

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
        const hit = evals.some(
          (e) => branch.match.test(e.name) || branch.match.test(e.expected_output),
        );
        assert.ok(hit, `no eval case covers ${branch.label}`);
      }
    });

    it("keeps the gate cycle budget in sync across the reference, SKILL.md, and the budget case", async () => {
      const gate = await readFile(path.join(skillDir, "references/design-review-gate.md"), "utf8");
      const m = gate.match(/gate budget:?\s*(\d+|two|three|four|five|six|seven|eight|nine)\s*cycles/i);
      assert.ok(m, "design-review-gate.md must state 'Gate budget: N cycles'");
      const budget = Number(m[1]) || NUMBER_WORDS[m[1].toLowerCase()];
      assert.ok(budget >= 1, `parsed a cycle budget (${budget})`);
      const both = new RegExp(`\\b(${budget}|${spell(budget)})\\b`, "i");

      const skill = await readFile(path.join(skillDir, "SKILL.md"), "utf8");
      assert.match(
        skill,
        new RegExp(`\\b(${budget}|${spell(budget)})\\b[\\s-]*cycle`, "i"),
        `SKILL.md must reference the ${budget}-cycle gate budget`,
      );

      const budgetCase = (await evalsJson()).evals.find((e) => /budget exhaustion/i.test(e.name));
      assert.ok(budgetCase, "a budget-exhaustion eval case is required");
      const haystack = `${budgetCase.name} ${budgetCase.expected_output} ${budgetCase.expectations.join(" ")}`;
      assert.ok(
        both.test(haystack),
        `the budget eval case must assert the same ${budget}-cycle budget`,
      );
    });
  });
});
