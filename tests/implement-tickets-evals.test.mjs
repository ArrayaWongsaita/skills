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
      assert.ok(Array.isArray(payload.evals) && payload.evals.length >= 16);
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

    it("covers planning, serial runs, verification, recovery, resume, and handoff", async () => {
      const { evals } = await readJson("evals.json");
      const hay = (pattern) => evals.some((item) => pattern.test(`${item.name}\n${item.expected_output}\n${item.expectations.join("\n")}`));
      assert.ok(hay(/Plan[\s\S]{0,300}no approval pause/i), "the Plan starts without a pause");
      assert.ok(hay(/one ticket at a time[\s\S]{0,200}ascending number/i), "tickets run serially");
      assert.ok(hay(/Seam[\s\S]{0,120}verbatim[\s\S]{0,260}Context/i), "Seam and Context reach the worker");
      assert.ok(hay(/first (?:worker )?command[\s\S]{0,240}integration SHA[\s\S]{0,200}failed_infra/i), "worker sync is the first command");
      assert.ok(hay(/no Risk: high, no risk signal, and complete evidence/i), "verification is risk-based");
      assert.ok(hay(/fresh native Explore verifier[\s\S]{0,240}raw evidence[\s\S]{0,120}no verdict/i), "the verifier returns raw evidence");
      assert.ok(hay(/failed_infra[\s\S]{0,200}without counting an attempt/i), "infra failures count no attempt");
      assert.ok(hay(/rejects an extra[\s\S]{0,200}one attempt/i), "unexplained extras are rejected");
      assert.ok(hay(/squash-merges[\s\S]{0,200}full typecheck[\s\S]{0,120}full test suite/i), "the gate runs the full checks");
      assert.ok(hay(/git checkout -B[\s\S]{0,300}one attempt/i), "a failing gate rewinds and retries");
      assert.ok(hay(/BLOCKED[\s\S]{0,300}(?:dependants|dependents)[\s\S]{0,300}independent/i), "blocked tickets hold dependants");
      assert.ok(hay(/continue[\s\S]{0,300}reconciles[\s\S]{0,200}Git/i), "continue reconciles Git");
      assert.ok(hay(/handoff[\s\S]{0,300}stops before review[\s\S]{0,200}(?:push|pull request)/i), "handoff stops before review");
    });

    it("covers per-attempt Worker branches and the recorded Worktree column", async () => {
      const { evals } = await readJson("evals.json");
      const hay = (pattern) => evals.some((item) => pattern.test(`${item.name}\n${item.expected_output}\n${item.expectations.join("\n")}`));
      assert.ok(hay(/NN-a1[\s\S]{0,300}NN-a2[\s\S]{0,300}different branch name/i), "each attempt takes its own branch name");
      assert.ok(hay(/NN-a1-i1[\s\S]{0,300}NN-a1-i2/), "infrastructure retries take -i1 and -i2");
      assert.ok(hay(/a1: <path>[\s\S]{0,200}a1-i1: <path>[\s\S]{0,200}\(harness: <branch>\)[\s\S]{0,200}`\?`/), "the Worktree cell grammar");
      assert.ok(hay(/worktree list[\s\S]{0,200}matching the attempt's branch name[\s\S]{0,300}unknown path/i), "a crashed worker's worktree is found by branch name");
      assert.ok(hay(/Worktree cell[\s\S]{0,200}local branches[\s\S]{0,200}worktree list[\s\S]{0,200}never from the Attempts column/i), "K and J come from the cell, branches, and worktree list");
      assert.ok(hay(/verifier[\s\S]{0,200}recorded worktree path/i), "the verifier gets the recorded worktree path");
    });

    it("keeps removed options out of the cases", async () => {
      const text = JSON.stringify((await readJson("evals.json")).evals);
      assert.doesNotMatch(text, /--parallel|--concurrency|--serial|--strict|--with|adapter|envelope/i);
    });
  });
});
