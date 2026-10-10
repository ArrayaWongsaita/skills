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
      assert.ok(negatives.some((item) => /\/implement\b/i.test(item.query)));
    });
  });

  describe("evals.json", () => {
    it("declares implement-tickets and unique, well-formed behavior cases", async () => {
      const payload = await readJson("evals.json");
      assert.equal(payload.skill_name, "implement-tickets");
      assert.ok(Array.isArray(payload.evals) && payload.evals.length === 33);
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

    // The single eval entry with this id, as one searchable string. Each assertion names the case
    // that must hold the rule, so a sentence in another case cannot satisfy it.
    const caseText = (evals, id) => {
      const item = evals.find((entry) => entry.id === id);
      assert.ok(item, `eval ${id} exists`);
      return `${item.name}\n${item.expected_output}\n${item.expectations.join("\n")}`;
    };
    const assertCase = (evals, id, patterns) => {
      const text = caseText(evals, id);
      for (const pattern of patterns) assert.match(text, pattern, `eval ${id}: ${pattern}`);
    };

    it("covers per-attempt Worker branches and the recorded Worktree column", async () => {
      const { evals } = await readJson("evals.json");
      assertCase(evals, 14, [/03-a1/, /03-a2/, /different branch name/, /implement-tickets-work\/<slug>\/NN-aK/, /worker prompt/]);
      assertCase(evals, 15, [/NN-a1-i1/, /NN-a1-i2/, /Counts no attempt/i]);
      assertCase(evals, 16, [/a1: <path>/, /a1-i1: <path>/, /\(harness: <branch>\)/, /`\?`/, /when the worker returns/]);
      assertCase(evals, 17, [/matching the attempt's branch name/, /worktree list/, /unknown path/]);
      assertCase(evals, 18, [/Worktree cell/, /local branches/, /worktree list/, /never from the Attempts column/, /03-a4/]);
      assertCase(evals, 19, [/recorded worktree path/, /not the branch/, /scratch checkout/]);
    });

    it("covers Cleanup after a green gate", async () => {
      const { evals } = await readJson("evals.json");
      assertCase(evals, 20, [/then the Worker branch/, /before starting ticket 03/, /git worktree remove <path>/, /no force flag/, /git branch -D/, /squash-merge leaves it unmerged/]);
      assertCase(evals, 21, [/attempts 1 and 2 as well as attempt 3/, /infrastructure-retry attempt/]);
      assertCase(evals, 22, [/harness branch worktree-x after the worktree is removed/, /Worker branch too/]);
      assertCase(evals, 23, [/Branch and Commit columns of ticket 02 are not edited/]);
      assertCase(evals, 24, [/recorded path is `\?`/, /by its branch name in the worktree list/, /Step `cleanup`/, /nothing is removed for that attempt/]);
      assertCase(evals, 25, [/removal fails/, /Step `cleanup`/, /still attempts the branch deletion/i, /starts ticket 03/, /force flag/]);
      assertCase(evals, 26, [/already gone/i, /no report entry/i]);
    });

    it("covers kept worktrees for failed attempts, BLOCKED tickets, and the handoff listing", async () => {
      const { evals } = await readJson("evals.json");
      assertCase(evals, 8, [/rejects an unexplained extra, keeps the attempt's worktree/i, /new branch name/]);
      assertCase(evals, 27, [/Worker worktree of attempt 1 is not removed/, /new branch name/]);
      assertCase(evals, 28, [/verifier rejects/, /keeps the attempt's worktree/, /new branch name/]);
      assertCase(evals, 29, [/non-mechanical merge conflict/, /keeps the old worktree/, /new branch name/]);
      assertCase(evals, 30, [/keeps all its attempts' worktrees/, /removes none/i]);
      assertCase(evals, 31, [/every worktree left behind by path/, /BLOCKED ticket 04/, /failed removal/, /unknown path/]);
      for (const id of [8, 27, 28, 29]) assert.doesNotMatch(caseText(evals, id), /discards the branch/i, `eval ${id} keeps the branch`);
    });

    it("covers continue after Worker branches are gone", async () => {
      const { evals } = await readJson("evals.json");
      assertCase(evals, 32, [/only against its squash commit on the integration branch/, /removed Worker branch is not drift/, /does not rewind/]);
      assertCase(evals, 33, [/because ticket 02 is not integrated/, /fresh worker/, /NN-aK-iJ/, /counting no attempt/]);
    });

    it("keeps removed options out of the cases", async () => {
      const text = JSON.stringify((await readJson("evals.json")).evals);
      assert.doesNotMatch(text, /--parallel|--concurrency|--serial|--strict|--with|adapter|envelope/i);
    });
  });
});
