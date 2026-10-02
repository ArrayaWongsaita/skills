import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const evalDirectory = "skills/agents/implement-tickets/evals";
async function readJson(file) {
  try {
    return JSON.parse(await readFile(path.resolve(evalDirectory, file), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") assert.fail(`${file} is required for implement-tickets eval coverage`);
    throw error;
  }
}

async function fileExists(file) {
  await access(path.resolve(evalDirectory, file), constants.R_OK);
}

describe("implement-tickets eval suite contract", () => {
  it("ships trigger-evals.json and evals.json", async () => {
    await fileExists("trigger-evals.json");
    await fileExists("evals.json");
  });

  describe("trigger-evals.json", () => {
    it("confirms both slash-command and Codex invocations trigger", async () => {
      const triggers = await readJson("trigger-evals.json");
      const positives = triggers.filter((item) => item.should_trigger);
      assert.ok(positives.some((item) => item.query.includes("/implement-tickets")));
      assert.ok(positives.some((item) => item.query.includes("$implement-tickets")));
    });

    it("keeps bare requests and sibling implementers as negative cases", async () => {
      const negatives = (await readJson("trigger-evals.json")).filter((item) => !item.should_trigger);
      assert.ok(negatives.length >= 3, "at least three negative cases are present");
      for (const item of negatives) {
        assert.doesNotMatch(item.query, /[/$]implement-tickets/);
      }
      assert.ok(negatives.some((item) => /implement this|implement the tickets/i.test(item.query)));
      assert.ok(negatives.some((item) => /agy-implement|opencode-implement|\/implement\b/i.test(item.query)));
    });
  });

  describe("evals.json", () => {
    it("declares implement-tickets and unique, well-formed behavior cases", async () => {
      const payload = await readJson("evals.json");
      assert.equal(payload.skill_name, "implement-tickets");
      assert.ok(Array.isArray(payload.evals) && payload.evals.length >= 15);
      const ids = new Set();
      const names = new Set();
      for (const item of payload.evals) {
        assert.ok(Number.isInteger(item.id) && !ids.has(item.id), `unique id ${item.id}`);
        ids.add(item.id);
        assert.ok(typeof item.name === "string" && !names.has(item.name), "unique eval name");
        names.add(item.name);
        assert.ok(Array.isArray(item.files), `case ${item.id} has a files array`);
        assert.ok(Array.isArray(item.expectations) && item.expectations.length > 0);
        assert.ok(typeof item.prompt === "string" && item.prompt.length > 0);
        assert.ok(typeof item.expected_output === "string" && item.expected_output.length > 0);
      }
    });

    it("starts every behavior case with an explicit implement-tickets invocation", async () => {
      for (const item of (await readJson("evals.json")).evals) {
        assert.match(item.prompt, /[/$]implement-tickets/, `case ${item.id} invokes the skill explicitly`);
      }
    });

    it("carries forward applicable planning, test-first, verifier, status, and handoff cases", async () => {
      const { evals } = await readJson("evals.json");
      const hay = (pattern) => evals.some((item) => pattern.test(`${item.name}\n${item.expected_output}\n${item.expectations.join("\n")}`));
      const retainedCases = {
        "approval before source mutation": /pauses? for explicit approval[\s\S]{0,180}no file outside[\s\S]{0,80}changes/i,
        "ticket seam and Context read-list behavior": /Seam[\s\S]{0,120}verbatim[\s\S]{0,260}Context[\s\S]{0,200}read list/i,
        "independent verifier reproduces red and checks coverage": /verifier[\s\S]{0,300}(?:reproduces|reproducing) red[\s\S]{0,300}(?:acceptance criteria|coverage)/i,
        "blocked dependency branch preserves independent work": /BLOCKED[\s\S]{0,300}(?:dependants|dependents)[\s\S]{0,300}independent/i,
        "read-only status and list": /status and list[\s\S]{0,200}read-only/i,
        "handoff stops before review and publication": /handoff[\s\S]{0,300}(?:stop|stops) before review[\s\S]{0,200}(?:push|pull request)/i,
      };
      for (const [label, pattern] of Object.entries(retainedCases)) {
        assert.ok(hay(pattern), `no applicable migrated eval covers ${label}`);
      }
    });

    it("covers deterministic waves and the serial and concurrency choices", async () => {
      const { evals } = await readJson("evals.json");
      const hay = (pattern) => evals.some((item) => pattern.test(`${item.name}\n${item.expected_output}\n${item.expectations.join("\n")}`));
      assert.ok(hay(/--parallel[\s\S]{0,240}independent tickets[\s\S]{0,240}same wave/i));
      assert.ok(hay(/--parallel[\s\S]{0,240}overlapping touch sets[\s\S]{0,240}successive waves/i));
      assert.ok(hay(/--serial[\s\S]{0,240}one ticket per wave/i));
      assert.ok(hay(/without a mode flag[\s\S]{0,240}one ticket per wave/i));
      assert.ok(hay(/--concurrency[\s\S]{0,120}implies[\s\S]{0,40}parallel/i));
      assert.ok(hay(/concurrency cap[\s\S]{0,240}(?:worker|verifier)[\s\S]{0,240}(?:combined|together)/i));
    });

    it("covers native worker synchronization, infra retries, and immediate verification", async () => {
      const { evals } = await readJson("evals.json");
      const hay = (pattern) => evals.some((item) => pattern.test(`${item.name}\n${item.expected_output}\n${item.expectations.join("\n")}`));
      assert.ok(hay(/first command[\s\S]{0,240}integration SHA[\s\S]{0,200}failed_infra/i));
      assert.ok(hay(/fresh native Explore verifier[\s\S]{0,240}raw evidence[\s\S]{0,120}no verdict/i));
      assert.ok(hay(/timeout|crash|lost subagent/i) && hay(/infra retries[\s\S]{0,200}without counting an attempt/i));
    });

    it("covers adapter preflight, envelope outcomes, and source-derived install guidance", async () => {
      const { evals } = await readJson("evals.json");
      const hay = (pattern) => evals.some((item) => pattern.test(`${item.name}\n${item.expected_output}\n${item.expectations.join("\n")}`));
      assert.ok(hay(/--with[\s\S]{0,200}adapter[\s\S]{0,300}(?:lock source|install line)/i));
      assert.ok(hay(/failed_infra[\s\S]{0,240}failed_other[\s\S]{0,240}completed/i));
      assert.ok(hay(/missing adapter[\s\S]{0,240}before planning/i));
    });

    it("covers the per-wave integration gate and culprit recovery", async () => {
      const { evals } = await readJson("evals.json");
      const hay = (pattern) => evals.some((item) => pattern.test(`${item.name}\n${item.expected_output}\n${item.expectations.join("\n")}`));
      assert.ok(hay(/integration gate[\s\S]{0,300}ticket order[\s\S]{0,240}(?:typecheck|full suite)/i));
      assert.ok(hay(/first failing merge[\s\S]{0,300}last good commit[\s\S]{0,300}serial attempt/i));
    });
  });
});
