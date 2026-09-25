import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

// The eval files are behavioral documentation in skill-creator's benchmark
// format, not a CI gate — nothing here runs the prompts. This contract covers
// what scripts/validate-skills.mjs cannot: one case per
// decision branch, and drift between the skill prose and the eval claims.

async function fileExists(filePath) {
  await access(filePath, constants.R_OK);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

const canonicalDir = "skills/agents/agy-implement/evals";

const evalsJson = () => readJson(path.resolve(canonicalDir, "evals.json"));
const triggerJson = () => readJson(path.resolve(canonicalDir, "trigger-evals.json"));

describe("agy-implement eval suite contract", () => {
  it("ships trigger-evals.json and evals.json", async () => {
    await fileExists(path.resolve(canonicalDir, "trigger-evals.json"));
    await fileExists(path.resolve(canonicalDir, "evals.json"));
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

    it("covers the parallel-wave and integration branches (ticket 04)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));
      assert.ok(hay(/parallel wave dispatches|concurrent workers/i), "parallel wave dispatched together");
      assert.ok(hay(/round-robin over dispatch order|dispatch order/i), "model round-robin by dispatch order");
      assert.ok(hay(/no list|agy's default/i), "no list -> agy default");
      assert.ok(hay(/design-encoding merge conflict|encodes which module/i), "design-encoding conflict surfaces");
    });

    it("covers the failure, partial delivery, and resume branches (ticket 05)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));
      assert.ok(hay(/halts only its branch|blocked ticket halts/i), "blocked ticket halts only its branch");
      assert.ok(hay(/rewinds the integration branch|last still-good commit/i), "resume rewinds to last still-good commit");
      assert.ok(hay(/discarded commit/i), "resume lists the discarded commits");
    });

    it("contains all 20 spec Testing-Decisions branches plus ticket rejections (ticket 06)", async () => {
      const { evals } = await evalsJson();
      assert.ok(evals.length >= 20, `expected >= 20 eval cases, got ${evals.length}`);
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));
      const branches = {
        "pure linear chain": /linear chain/i,
        "one parallel wave": /parallel wave/i,
        "overlap hint": /overlap hint|likely-overlapping/i,
        "cross-cutting file": /cross-cutting|router/i,
        "model at dispatch not planning": /at dispatch, not planning|no model column/i,
        "no source mutation before approval": /no source mutation|before Plan approval/i,
        "orchestrator never implements": /never (hand-code|implement)/i,
        "design-encoding merge conflict": /design-encoding merge conflict|encodes/i,
        "verification failure x3 -> BLOCKED": /three times then BLOCKED|TICKET_VERIFICATION_FAILED/i,
        "provider failover separate budget": /failover does not consume/i,
        "vacuous-test rejection": /vacuous/i,
        "fabricated / not-actually-red": /fabricated|red reproduction/i,
        "missing test->criterion coverage": /criterion with no test|no test/i,
        "blocked ticket halts only its branch": /halts only its branch/i,
        "resume after crash rewind": /rewinds the integration branch|last still-good commit/i,
        "dirty tree at preflight": /dirty target tree|dirty-demo|uncommitted changes/i,
        "no list -> agy default; list -> round-robin": /round-robin over dispatch order|no model list/i,
        "wide-refactor serial steps": /wide-refactor|expand-contract/i,
        "worker package install -> replanned": /new dependency|package install/i,
        "completion handoff": /completion handoff|hand over the review commands|review commands and never pushes/i,
        "cyclic ticket set rejected": /cycl|TICKET_SET_CYCLIC/i,
        "missing blocker rejected": /non-existent blocker|TICKET_SET_MISSING_BLOCKER/i,
        "untestable ticket -> replan": /untestable|no isolated test can exercise/i,
      };
      for (const [label, re] of Object.entries(branches)) {
        assert.ok(hay(re), `no eval case covers: ${label}`);
      }
    });

    it("covers the ticket Seam rule — verbatim when present, today's rule otherwise", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));
      assert.ok(
        hay(/[Ss]eam[\s\S]{0,200}verbatim|verbatim[\s\S]{0,100}[Ss]eam/),
        "a ticket's Seam is used verbatim as its test seam",
      );
      assert.ok(
        hay(/without[^\n]{0,30}[Ss]eam|predates the new fields/i),
        "a ticket without Seam, Context, or Budget runs as today",
      );
    });

    it("covers the ticket Context rule — its spec refs drive the read list and an untracked read-only file comes from the main checkout", async () => {
      const { evals } = await evalsJson();
      const contextCase = evals.find(
        (e) =>
          /\*\*Context:\*\*/.test(e.prompt) &&
          /read[- ]only[- ]sections|read only these sections|read list/i.test(e.expected_output) &&
          /untracked/i.test(e.expected_output) &&
          /main checkout/i.test(e.expected_output),
      );
      assert.ok(
        contextCase,
        "an eval case has Context drive the worker's read list and passes an untracked read-only file from the main checkout",
      );
      assert.match(
        contextCase.expected_output,
        /read[\s\S]{0,80}change[\s\S]{0,80}create/i,
        "the case groups Context files as read, change, and create",
      );
    });

    it("keeps every (from NN) and (edit from NN) Context item on a lower-numbered blocker, consistent across the prompt, the expected output, and the expectations", async () => {
      const { evals } = await evalsJson();
      const fromToken = /\((?:edit )?from (\d+)\)/g;
      let checked = 0;
      for (const item of evals) {
        const contextStart = item.prompt.indexOf("**Context:**");
        if (contextStart === -1) continue;
        const promptTokens = [...item.prompt.slice(contextStart).matchAll(fromToken)];
        if (promptTokens.length === 0) continue;
        checked += 1;
        const carrier = item.prompt.match(/\bTicket (\d+)\b[^*]*?carries \*\*Context:\*\*/);
        assert.ok(carrier, `case ${item.id} names the ticket that carries the Context`);
        for (const [token, blocker] of promptTokens) {
          assert.ok(
            Number(blocker) >= 1 && Number(blocker) < Number(carrier[1]),
            `case ${item.id}: ${token} must name a ticket numbered from 01 and lower than ticket ${carrier[1]}`,
          );
        }
        const promptItems = new Set(promptTokens.map(([token]) => token));
        for (const [token] of item.expected_output.matchAll(fromToken)) {
          assert.ok(
            promptItems.has(token),
            `case ${item.id}: expected_output names ${token}, which no Context item in the prompt carries`,
          );
        }
        assert.ok(
          item.expectations.some((line) => /\b(edit|new|from)\b[\s\S]*relative to the worktree/i.test(line)),
          `case ${item.id}: an expectation says edit, new, and from paths are written relative to the worktree`,
        );
      }
      assert.ok(checked >= 1, "an eval case carries a Context line with a (from NN) or (edit from NN) item");
    });

    it("names the input the grill-to-tickets ticket format, with no to-tickets left", async () => {
      const raw = await readFile(path.resolve(canonicalDir, "evals.json"), "utf8");
      assert.doesNotMatch(raw, /(?<!-)to-tickets/);
    });

    it("covers per-ticket budget_estimate and usage_total, including a BLOCKED ticket", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));
      assert.ok(hay(/budget_estimate/), "records budget_estimate");
      assert.ok(hay(/usage_total/), "records usage_total");
      assert.ok(hay(/input_tokens \+ output_tokens \+ thinking_tokens/), "derives usage_total from input + output + thinking tokens");
      assert.ok(hay(/failover/i), "the delivering path includes every failover model");
      assert.ok(hay(/unknown/), "usage_total is unknown when unreported");
      const blocked = evals.find(
        (e) => /BLOCKED/.test(e.expected_output) && /usage_total/.test(e.expected_output),
      );
      assert.ok(blocked, "a BLOCKED ticket records usage_total on the path whose budget it exhausted");
      assert.match(blocked.expected_output, /path whose budget|final path|exhausted/i);
    });
  });
});
