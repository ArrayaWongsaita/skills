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

const canonicalDir = "skills/agents/subagent-implement/evals";

const evalsJson = () => readJson(path.resolve(canonicalDir, "evals.json"));
const triggerJson = () => readJson(path.resolve(canonicalDir, "trigger-evals.json"));

describe("subagent-implement eval suite contract", () => {
  it("ships trigger-evals.json and evals.json", async () => {
    await fileExists(path.resolve(canonicalDir, "trigger-evals.json"));
    await fileExists(path.resolve(canonicalDir, "evals.json"));
  });

  describe("trigger-evals.json", () => {
    it("confirms both /subagent-implement and $subagent-implement trigger", async () => {
      const positives = (await triggerJson()).filter((t) => t.should_trigger);
      assert.ok(positives.some((t) => t.query.includes("/subagent-implement")));
      assert.ok(positives.some((t) => t.query.includes("$subagent-implement")));
    });

    it("includes negative cases, none using an explicit subagent-implement invocation", async () => {
      const negatives = (await triggerJson()).filter((t) => !t.should_trigger);
      assert.ok(negatives.length >= 3, "at least three negative cases are required");
      for (const item of negatives) {
        assert.doesNotMatch(
          item.query,
          /[/$]subagent-implement/,
          "negative cases must not use an explicit subagent-implement invocation",
        );
      }
    });

    it("has a negative case for a bare 'implement this' and for a sibling skill", async () => {
      const negatives = (await triggerJson()).filter((t) => !t.should_trigger);
      assert.ok(negatives.some((t) => /implement this|implement the tickets/i.test(t.query)));
      assert.ok(negatives.some((t) => /engineering-workflow|agy-implement|\/implement\b/i.test(t.query)));
    });
  });

  describe("evals.json", () => {
    it("declares skill_name subagent-implement and unique ids and names", async () => {
      const payload = await evalsJson();
      assert.equal(payload.skill_name, "subagent-implement");
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

    it("drives every case through an explicit subagent-implement invocation", async () => {
      for (const item of (await evalsJson()).evals) {
        assert.match(
          item.prompt,
          /[/$]subagent-implement/,
          `case ${item.id} must invoke subagent-implement explicitly (disable-model-invocation)`,
        );
      }
    });

    it("covers every decision branch of the skill", async () => {
      const { evals } = await evalsJson();
      assert.ok(evals.length >= 24, `expected >= 24 eval cases, got ${evals.length}`);
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));
      const branches = {
        "pure linear chain": /linear chain|dependency order/i,
        "independent tickets still serial": /independent tickets still|run one after another/i,
        "cyclic ticket set rejected": /cycl|TICKET_SET_CYCLIC/i,
        "missing blocker rejected": /missing blocker|TICKET_SET_MISSING_BLOCKER/i,
        "numbering rejected": /numbering|TICKET_SET_NUMBERING/i,
        "no source mutation before approval": /no source mutation|before Plan approval|before any source/i,
        "implementation-shaped agent matched": /implementation-shaped|feature-dev|wording match/i,
        "general-purpose fallback": /falls back to general-purpose/i,
        "--agent pin overrides": /--agent .*pin|pin overrides/i,
        "--model pass-through and inherit default": /inherit .*model|--model .*pass-through|raw pass-through/i,
        "isolation worktree, never fork": /isolation: worktree|isolated worktree/i,
        "orchestrator never implements": /never (hand-code|implement)|writes no implementation/i,
        "verification failure x3 -> BLOCKED": /three times then BLOCKED|TICKET_VERIFICATION_FAILED/i,
        "worker crash counts as one attempt": /crash counts as one|one of the three ticket attempts/i,
        "vacuous-test rejection": /vacuous/i,
        "fabricated red state rejection": /fabricated|reproduces it|passes without the implementation/i,
        "missing test->criterion coverage": /coverage|criterion with no|no new test/i,
        "fresh Explore verifier": /fresh Explore|separate Explore subagent/i,
        "verifier error fallback": /verifier error|verifier .*errors|fallback/i,
        "squash-merge one commit per ticket": /squash-merge|one commit/i,
        "design-encoding merge conflict surfaced": /design-encoding|encodes a design|which module owns/i,
        "mechanical merge conflict resolved": /mechanical .*conflict/i,
        "no separate integration gate in v1": /no separate integration gate|no separate full/i,
        "worktree removed after commit": /worktree .*(removed|remove) after/i,
        "blocked ticket halts only its branch": /halts only its dependency branch|halts .* its dependency/i,
        "resume rewinds to last still-good commit": /rewind|last still-good commit/i,
        "dirty tree at preflight": /dirty .*tree|uncommitted changes/i,
        "worker package install -> replanned": /new dependency|package install/i,
        "untestable ticket -> replan": /untestable|no isolated test/i,
        "completion handoff": /completion handoff|review commands and never pushes|hands over the/i,
        "status and list read-only": /status .*list are read-only|read-only/i,
        "context discipline text-only": /text-only|context .*never held|delegates implementation/i,
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

    it("covers per-ticket budget_estimate and usage_total, including a BLOCKED ticket", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));
      assert.ok(hay(/budget_estimate/), "records budget_estimate");
      assert.ok(hay(/usage_total/), "records usage_total");
      assert.ok(hay(/verifier_usage_total/), "records verifier_usage_total separately");
      assert.ok(hay(/unknown/), "usage_total is unknown when unreported");
      const blocked = evals.find(
        (e) => /BLOCKED/.test(e.expected_output) && /usage_total/.test(e.expected_output),
      );
      assert.ok(blocked, "a BLOCKED ticket records usage_total on the path whose budget it exhausted");
      assert.match(blocked.expected_output, /path whose budget|final path|exhausted/i);
    });
  });
});
