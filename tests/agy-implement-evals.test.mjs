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
  "skills/agents/agy-implement/evals",
  ".agents/skills/agy-implement/evals",
];
const canonicalDir = evalDirs[0];

const evalsJson = () => readJson(path.resolve(canonicalDir, "evals.json"));
const triggerJson = () => readJson(path.resolve(canonicalDir, "trigger-evals.json"));

describe("agy-implement eval suite contract", () => {
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
    it("confirms both /agy-implement and $agy-implement trigger", async () => {
      const positives = (await triggerJson()).filter((t) => t.should_trigger);
      assert.ok(positives.some((t) => t.query.includes("/agy-implement")));
      assert.ok(positives.some((t) => t.query.includes("$agy-implement")));
    });

    it("includes negative cases, none using an explicit agy-implement invocation", async () => {
      const negatives = (await triggerJson()).filter((t) => !t.should_trigger);
      assert.ok(negatives.length >= 3, "at least three negative cases are required");
      for (const item of negatives) {
        assert.doesNotMatch(
          item.query,
          /[/$]agy-implement/,
          "negative cases must not use an explicit agy-implement invocation",
        );
      }
    });

    it("has a negative case for a bare 'implement this' and for a sibling skill", async () => {
      const negatives = (await triggerJson()).filter((t) => !t.should_trigger);
      assert.ok(negatives.some((t) => /implement this|implement the tickets|implement this ticket/i.test(t.query)));
      assert.ok(negatives.some((t) => /engineering-workflow|\/implement\b/i.test(t.query)));
    });
  });

  describe("evals.json", () => {
    it("declares skill_name agy-implement and unique ids and names", async () => {
      const payload = await evalsJson();
      assert.equal(payload.skill_name, "agy-implement");
      assert.ok(Array.isArray(payload.evals) && payload.evals.length > 0);
      const ids = new Set();
      const names = new Set();
      for (const item of payload.evals) {
        assert.ok(Number.isInteger(item.id) && !ids.has(item.id), `unique id ${item.id}`);
        ids.add(item.id);
        assert.ok(typeof item.name === "string" && !names.has(item.name), `unique name`);
        names.add(item.name);
        assert.ok(Array.isArray(item.files), `case ${item.id} carries a files array`);
        assert.ok(Array.isArray(item.expectations) && item.expectations.length > 0);
      }
    });

    it("drives every case through an explicit agy-implement invocation", async () => {
      for (const item of (await evalsJson()).evals) {
        assert.match(
          item.prompt,
          /[/$]agy-implement/,
          `case ${item.id} must invoke agy-implement explicitly (disable-model-invocation)`,
        );
      }
    });

    it("covers the Stage 0 planning branches (ticket 02)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));
      assert.ok(hay(/linear chain|one ticket per wave/i), "pure linear chain");
      assert.ok(hay(/parallel wave/i), "one parallel wave");
      assert.ok(hay(/overlap|likely-overlapping/i), "overlap hint");
      assert.ok(hay(/cross-cutting|router/i), "cross-cutting file flag");
      assert.ok(hay(/cycl|TICKET_SET_CYCLIC/i), "cyclic-graph rejection");
      assert.ok(hay(/no source mutation|before Plan approval|before approval/i), "no mutation before approval");
    });

    it("covers the single-ticket execution branches (ticket 03)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));
      assert.ok(hay(/never (hand-code|implement)|orchestrator.*(BLOCKED|does not write)/i), "orchestrator never implements");
      assert.ok(hay(/three times then BLOCKED|MAX_TICKET_ATTEMPTS|TICKET_VERIFICATION_FAILED/i), "verification failure x3 -> BLOCKED");
      assert.ok(hay(/vacuous/i), "vacuous-test rejection");
      assert.ok(hay(/fabricated|not real|red reproduction/i), "fabricated / not-actually-red rejection");
      assert.ok(hay(/no test|uncovered criterion|criterion with no test/i), "missing test -> criterion coverage");
      assert.ok(hay(/failover does not consume|Failover.*budget/i), "failover does not consume verification budget");
      assert.ok(hay(/new dependency|package install|lockfile/i), "worker package install -> replanned");
    });
  });
});
