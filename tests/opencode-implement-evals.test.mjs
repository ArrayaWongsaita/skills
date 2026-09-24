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

const canonicalDir = "skills/agents/opencode-implement/evals";

const evalsJson = () => readJson(path.resolve(canonicalDir, "evals.json"));
const triggerJson = () => readJson(path.resolve(canonicalDir, "trigger-evals.json"));

describe("opencode-implement eval suite contract", () => {
  it("ships trigger-evals.json and evals.json", async () => {
    await fileExists(path.resolve(canonicalDir, "trigger-evals.json"));
    await fileExists(path.resolve(canonicalDir, "evals.json"));
  });

  describe("trigger-evals.json", () => {
    it("confirms both /opencode-implement and $opencode-implement trigger", async () => {
      const positives = (await triggerJson()).filter((t) => t.should_trigger);
      assert.ok(positives.some((t) => t.query.includes("/opencode-implement")));
      assert.ok(positives.some((t) => t.query.includes("$opencode-implement")));
    });

    it("includes negative cases, none using an explicit opencode-implement invocation", async () => {
      const negatives = (await triggerJson()).filter((t) => !t.should_trigger);
      assert.ok(negatives.length >= 3, "at least three negative cases are required");
      for (const item of negatives) {
        assert.doesNotMatch(
          item.query,
          /[/$]opencode-implement/,
          "negative cases must not use an explicit opencode-implement invocation",
        );
      }
    });

    it("has a negative case for a bare 'implement this', for a sibling skill, and for a bare mention of a hosted model — no Ollama-specific case remains", async () => {
      const negatives = (await triggerJson()).filter((t) => !t.should_trigger);
      assert.ok(negatives.some((t) => /implement this|implement the tickets/i.test(t.query)));
      assert.ok(negatives.some((t) => /agy-implement|subagent-implement|\/implement\b/i.test(t.query)));
      assert.ok(
        negatives.some((t) => /hosted model/i.test(t.query)),
        "has a negative case mentioning a hosted model",
      );
      assert.ok(
        !negatives.some((t) => /ollama/i.test(t.query)),
        "no Ollama-specific non-trigger case remains — replaced with a generic hosted-model mention",
      );
    });
  });

  describe("evals.json", () => {
    it("declares skill_name opencode-implement and unique ids and names", async () => {
      const payload = await evalsJson();
      assert.equal(payload.skill_name, "opencode-implement");
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
        assert.ok(typeof item.prompt === "string" && item.prompt.length > 0);
        assert.ok(typeof item.expected_output === "string" && item.expected_output.length > 0);
      }
    });

    it("drives every case through an explicit opencode-implement invocation", async () => {
      for (const item of (await evalsJson()).evals) {
        assert.match(
          item.prompt,
          /[/$]opencode-implement/,
          `case ${item.id} must invoke opencode-implement explicitly (disable-model-invocation)`,
        );
      }
    });

    it("covers every decision branch from the spec's Testing Decisions", async () => {
      const { evals } = await evalsJson();
      assert.ok(evals.length >= 30, `expected >= 30 eval cases, got ${evals.length}`);
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));
      // Each pattern asserts the branch's CLAIM (an outcome, a token, a
      // boundary), not just its topic word.
      const branches = {
        "pure linear chain": /Wave 0 = \{01\}[\s\S]{0,400}a wave table and no model column/i,
        "cyclic ticket set": /BLOCKED \(TICKET_SET_CYCLIC\)/,
        "missing blocker": /BLOCKED \(TICKET_SET_MISSING_BLOCKER\)/,
        "numbering inconsistent": /BLOCKED \(TICKET_SET_NUMBERING\)/,
        "wave assignment across independent branches": /Wave 0 = \{01, 02\}[\s\S]{0,400}Wave 1 = \{03, 04\}/,
        "same-wave overlapping touch-set flagged": /likely-overlapping — consider serializing[\s\S]{0,200}intersect/i,
        "a flagged pair the user chose to serialize is actually serialized": /chose to serialize[\s\S]{0,300}(?:one worktree slot at a time|one at a time)|(?:one worktree slot at a time|one at a time)[\s\S]{0,300}chose to serialize/i,
        "no source mutation before approval": /no file outside[\s\S]{0,60}(created or modified|is created)/i,
        "no-arg -> most recent issues dir": /names it back to the user[\s\S]{0,40}waits for confirmation/i,
        "opencode failure within budget retried, not escalated": /opencode failure[\s\S]{0,120}(re-dispatches|retried)[\s\S]{0,120}does not escalate/i,
        "no first event -> killed": /kills the worker PID, records it as an opencode failure/i,
        "fabricated / not-actually-red": /(passes without the implementation|not-actually-red)[\s\S]{0,120}verification failure/i,
        "vacuous test / missing coverage": /vacuous[\s\S]{0,160}(no covering test|left the second criterion with no test|uncovered)/i,
        "design-encoding merge conflict": /BLOCKED \(INTEGRATION_DESIGN_CONFLICT\)[\s\S]{0,120}(surfaces|does not pick)/i,
        "3 verify fails -> auto escalate no pause": /After the third failure[\s\S]{0,240}with no approval pause/i,
        "--opencode-only suppresses fallback the same way --no-fallback did": /--opencode-only[\s\S]{0,300}(?:same way|as .*--no-fallback|--no-fallback did)/i,
        "--strict-local still works as a deprecated alias": /--strict-local[\s\S]{0,200}deprecated/i,
        "opencode failures past budget -> escalate": /MAX_OPENCODE_RETRIES = 3 is exhausted[\s\S]{0,80}(escalates|fallback)/i,
        "fallback also fails -> BLOCKED (TICKET_VERIFICATION_FAILED)": /fallback subagent[\s\S]{0,160}BLOCKED \(TICKET_VERIFICATION_FAILED\)/i,
        "escalation disclosed in status.md + handoff, alongside tokens.main": /status\.md records[\s\S]{0,200}handoff[\s\S]{0,160}(Claude tokens spent|left the machine)/i,
        "BLOCKED halts only its branch": /stay integrated[\s\S]{0,200}(transitively blocked|not started)[\s\S]{0,200}next frontier/i,
        "status.md fields + integration ref": /status[\s\S]{0,10}report[\s\S]{0,240}integration branch ref|status\.md[\s\S]{0,160}integration branch ref/i,
        "continue discards half-built, re-dispatch clean": /discards? [\s\S]{0,60}worker branch and worktree[\s\S]{0,120}(re-dispatches|from clean)/i,
        "continue rewind on drift + discarded commits": /resets? the integration branch[\s\S]{0,120}(last still-verifying commit)[\s\S]{0,200}discarded commits/i,
        "dirty tree at preflight": /uncommitted changes[\s\S]{0,120}does not stash[\s\S]{0,120}dispatches no worker/i,
        "worker needs new dependency -> replan": /(new[\s\S]{0,12}dependency|package install)[\s\S]{0,200}(replans?|Stage 0)[\s\S]{0,120}lockfile/i,
        "completion handoff names branch + review commands, no push": /\/code-review[\s\S]{0,60}\/scrutinize[\s\S]{0,200}(no[\s\S]{0,8}push|opens no PR|does not push)/i,
        // New branches required by ticket 05 (state, resume, cost/model disclosure)
        "tokens.main accumulates across main-path tickets and is shown alongside tokens.fallback": /tokens\.main[\s\S]{0,300}tokens\.fallback|tokens\.fallback[\s\S]{0,300}tokens\.main/i,
        "the pinned resolved model is recorded in status.md and shown in the Plan": /resolved model[\s\S]{0,200}status\.md[\s\S]{0,200}Plan|status\.md[\s\S]{0,200}resolved model[\s\S]{0,200}Plan/i,
        "a BLOCKED ticket's independent later wave is reported as an available partial path, not started automatically": /independent[\s\S]{0,80}wave[\s\S]{0,200}(?:available partial path|not started automatically)|(?:available partial path|not started automatically)[\s\S]{0,200}independent[\s\S]{0,80}wave/i,
        "list reports one line per run: slug, integration branch, tickets done/total, running/blocked/complete": /slug[\s\S]{0,200}integration branch[\s\S]{0,200}(?:done\s*\/\s*total|done\/total)[\s\S]{0,200}(?:running|blocked|complete)/i,
        // New branches required by ticket 02
        "model resolved once and pinned — later worker gets explicit --model": /explicit\s*--model[\s\S]{0,300}(?:second|later|concurrent)[\s\S]{0,200}worker|(?:second|later|concurrent)[\s\S]{0,200}worker[\s\S]{0,300}explicit\s*--model/i,
        "verification-failure retry resumes same session": /opencode run -s[\s\S]{0,200}verif|verif[\s\S]{0,400}opencode run -s[\s\S]{0,200}(?:same session|resume)/i,
        "opencode-process failure retries as fresh dispatch, never resume": /(?:opencode.{0,20}(?:process\s+)?failure|fresh\s+dispatch)[\s\S]{0,200}(?:fresh\s+dispatch|never\s+(?:a\s+)?(?:session\s+)?resume)/i,
        // New branches required by ticket 03
        "parallel dispatch respects the concurrency cap and queues the remainder": /concurrency cap[\s\S]{0,300}queue[\s\S]{0,200}|queue[\s\S]{0,300}concurrency cap[\s\S]{0,200}/i,
        "possibly-stalled worker flagged without blocking wave-mates": /possibly stalled[\s\S]{0,300}without (?:blocking|pausing|stopping)[\s\S]{0,120}wave-mates|without (?:blocking|pausing|stopping)[\s\S]{0,200}wave-mates[\s\S]{0,200}possibly stalled/i,
        "fallback escalation integrates on its own without blocking already-passed wave-mates": /(?:escalat\w+ to (?:the )?fallback|fallback tier)[\s\S]{0,300}(?:integrates? on its own|does not (?:wait|block))[\s\S]{0,300}wave-mates|wave-mates[\s\S]{0,300}(?:integrates? on its own|does not (?:wait|block))[\s\S]{0,300}fallback/i,
        "next wave waits until every ticket in the current wave reaches a terminal state": /next wave[\s\S]{0,200}(?:does not start|waits?)[\s\S]{0,200}terminal state/i,
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
  });
});
