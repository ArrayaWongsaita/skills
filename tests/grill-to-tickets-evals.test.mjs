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
// covers what scripts/validate-skills.mjs cannot: the
// one-case-per-routing-branch requirement, one case per planning safeguard and
// per output-quality dimension, and drift between the skill prose's
// user-bounded review gate and the evals. Benchmark the suite with skill-creator against a snapshot of
// the previous skill version as the old_skill baseline.

async function fileExists(filePath) {
  await access(filePath, constants.R_OK);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

const canonicalDir = "skills/agents/grill-to-tickets/evals";
const skillDir = path.resolve(canonicalDir, "..");

const evalsJson = () => readJson(path.resolve(canonicalDir, "evals.json"));
const triggerJson = () => readJson(path.resolve(canonicalDir, "trigger-evals.json"));


describe("grill-to-tickets eval suite contract", () => {
  it("ships trigger-evals.json and evals.json", async () => {
    await fileExists(path.resolve(canonicalDir, "trigger-evals.json"));
    await fileExists(path.resolve(canonicalDir, "evals.json"));
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
      { label: "budget exhaustion", match: /budget exhaustion|add rounds/i },
    ];

    it("declares skill_name grill-to-tickets and at least one case per routing branch", async () => {
      const payload = await evalsJson();
      assert.equal(payload.skill_name, "grill-to-tickets");
      assert.ok(
        payload.evals.length >= routingBranches.length,
        "at least one case per Design Review Gate routing branch",
      );
    });

    it("describes the handoff eval as two subagent dispatches, Stage 2 and Stage 3.5", async () => {
      const { evals } = await evalsJson();
      const lines = evals.flatMap((item) => item.expectations ?? []).filter((line) => /^Prints the handoff/.test(line));
      assert.ok(lines.length > 0, "an eval expectation covers the handoff");
      for (const line of lines) {
        assert.match(line, /Stage 2[\s\S]*Stage 3\.5/, "the handoff expectation names both dispatches");
        assert.doesNotMatch(line, /only for the Stage 2 review/, "the handoff expectation is not limited to Stage 2");
      }
    });

    it("covers every planning safeguard: decision log, resume, blind spots, fresh reviewer, sweep, ticket check", async () => {
      const { evals } = await evalsJson();
      const ticketReview = evals.find((item) => item.name === "ticket review shows each ASK before the user decides");
      assert.ok(ticketReview, "a ticket-review eval exercises Stage 3.5");
      assert.match(ticketReview.prompt, /result: PASS[\s\S]*no --ticket-review flag[\s\S]*Run Stage 3\.5/i);
      assert.match(ticketReview.expected_output, /one fresh, read-only ticket reviewer[\s\S]*READY or ASK[\s\S]*Seam, Context, and Budget/i);
      const safeguards = [
        { label: "decision log", match: /decision log records/i },
        { label: "resume", match: /^continue .*decision log/i },
        { label: "blind-spot pass", match: /blind-spot pass/i },
        { label: "fresh reviewer", match: /fresh subagent/i },
        { label: "reviewer id carry-over", match: /previous findings' ids/i },
        { label: "FIX_THEN_SHIP sweep", match: /sweeps every restatement/i },
        { label: "ticket checker", match: /ticket checker/i },
        { label: "preflight: missing stage skill", match: /preflight stops/i },
        { label: "preflight: global install", match: /preflight uses a globally installed/i },
        { label: "preflight: lock by location", match: /preflight records the lock by location/i },
        { label: "local tracker", match: /local files replace/i },
        { label: "git-ignored scratch", match: /local exclude/i },
        { label: "budget-line mismatch", match: /budget-line mismatch/i },
        { label: "(from NN) without its blocker", match: /\(from NN\) without its blocker/i },
        { label: "untestable-criteria warning acknowledged", match: /untestable-criteria warning/i },
        { label: "same-file warning adds an edge", match: /same-file warning adds an edge/i },
        { label: "above 15 tickets proposes a split", match: /above 15 tickets proposes a split/i },
        { label: "handoff recommends from the DAG", match: /handoff recommends an implementer from the DAG/i },
        { label: "ticket review", match: /ticket review/i },
      ];
      for (const safeguard of safeguards) {
        assert.ok(
          evals.some((e) => safeguard.match.test(e.name)),
          `no eval case covers the ${safeguard.label} safeguard`,
        );
      }
    });

    it("measures output quality, not only routing: interview, spec, and tickets", async () => {
      const { evals } = await evalsJson();
      const quality = evals.filter((e) => /^quality: /.test(e.name));
      for (const dimension of [/decisions and looks facts up/, /spec carries every logged decision/, /vertical slices/]) {
        assert.ok(
          quality.some((e) => dimension.test(e.name)),
          `no quality case matches ${dimension}`,
        );
      }
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

    it("covers the review entry question, the --review flag, and resume with rounds kept spent", async () => {
      const { evals } = await evalsJson();
      const cases = [
        { label: "entry question", match: /entry asks once|review round count/i },
        { label: "--review flag", match: /--review/ },
        { label: "resume keeps rounds spent", match: /rounds spent kept spent/i },
      ];
      for (const c of cases) {
        assert.ok(evals.some((e) => c.match.test(e.name)), `no eval case covers ${c.label}`);
      }
    });

    it("keeps the exhaustion case in line with the user-bounded gate", async () => {
      const budgetCase = (await evalsJson()).evals.find((e) => /budget exhaustion/i.test(e.name));
      assert.ok(budgetCase, "a budget-exhaustion eval case is required");
      const haystack = `${budgetCase.expected_output} ${budgetCase.expectations.join(" ")}`;
      assert.match(haystack, /add rounds/i);
      assert.match(haystack, /go on/i);
      assert.match(haystack, /Known unresolved review findings/);
      assert.doesNotMatch(haystack, /\bsix\b|human authoriz|fresh (six-cycle )?budget/i);
    });
  });
});
