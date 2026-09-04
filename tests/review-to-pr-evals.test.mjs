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
  });
});
