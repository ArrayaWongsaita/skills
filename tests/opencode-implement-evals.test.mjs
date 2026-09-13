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
  "skills/agents/opencode-implement/evals",
  ".agents/skills/opencode-implement/evals",
];
const canonicalDir = evalDirs[0];

const evalsJson = () => readJson(path.resolve(canonicalDir, "evals.json"));
const triggerJson = () => readJson(path.resolve(canonicalDir, "trigger-evals.json"));

describe("opencode-implement eval suite contract", () => {
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

    it("has a negative case for a bare 'implement this', for a sibling skill, and for a bare opencode/Ollama mention", async () => {
      const negatives = (await triggerJson()).filter((t) => !t.should_trigger);
      assert.ok(negatives.some((t) => /implement this|implement the tickets/i.test(t.query)));
      assert.ok(negatives.some((t) => /agy-implement|subagent-implement|\/implement\b/i.test(t.query)));
      assert.ok(negatives.some((t) => /opencode|ollama/i.test(t.query)));
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
        "independent tickets still serial": /no edge between them[\s\S]{0,80}(one after another|serial)/i,
        "cyclic ticket set": /BLOCKED \(TICKET_SET_CYCLIC\)/,
        "missing blocker": /BLOCKED \(TICKET_SET_MISSING_BLOCKER\)/,
        "numbering inconsistent": /BLOCKED \(TICKET_SET_NUMBERING\)/,
        "wave assignment across independent branches": /Wave 0 = \{01, 02\}[\s\S]{0,400}Wave 1 = \{03, 04\}/,
        "same-wave overlapping touch-set flagged": /likely-overlapping — consider serializing[\s\S]{0,200}intersect/i,
        "no source mutation before approval": /no file outside[\s\S]{0,60}(created or modified|is created)/i,
        "no-arg -> most recent issues dir": /names it back to the user[\s\S]{0,40}waits for confirmation/i,
        "opencode failure within budget retried locally": /opencode failure[\s\S]{0,120}(re-dispatches|retried)[\s\S]{0,120}does not escalate/i,
        "no first event -> killed": /kills the worker PID, records it as an opencode failure/i,
        "hung smoke test -> run does not start": /smoke test[\s\S]{0,160}(does not begin|does not start|stops the (whole )?run)/i,
        "worker prompt self-contained test-first": /this sub-step's one acceptance criterion verbatim[\s\S]{0,300}red-green-refactor protocol inline/i,
        "one-criterion end to end + one commit": /(end to end|checkpoint check)[\s\S]{0,240}squash-merge[\s\S]{0,120}one commit/i,
        "chain carries state by progress note not -s": /progress note[\s\S]{0,120}(not opencode run -s|never[\s\S]{0,6}-s|never opencode -s)/i,
        "runtime re-split recorded not failed": /re-split[\s\S]{0,120}(records? the re-split in status\.md|not counted against MAX_TICKET_ATTEMPTS)/i,
        "fabricated / not-actually-red": /(passes without the implementation|not-actually-red)[\s\S]{0,120}verification failure/i,
        "vacuous test / missing coverage": /vacuous[\s\S]{0,160}(no covering test|left the second criterion with no test|uncovered)/i,
        "design-encoding merge conflict": /BLOCKED \(INTEGRATION_DESIGN_CONFLICT\)[\s\S]{0,120}(surfaces|does not pick)/i,
        "3 local verify fails -> auto escalate no pause": /After the third failure[\s\S]{0,240}with no approval pause/i,
        "TICKET_TOO_LARGE + fallback -> subagent directly": /does not BLOCK[\s\S]{0,120}(escalates|subagent)|TICKET_TOO_LARGE_FOR_CONTEXT[\s\S]{0,80}subagent (fallback )?directly/i,
        "--no-fallback -> BLOCK": /--no-fallback[\s\S]{0,140}BLOCKED \(TICKET_TOO_LARGE_FOR_CONTEXT\)/,
        "opencode failures past budget -> escalate": /MAX_OPENCODE_RETRIES = 3 is exhausted[\s\S]{0,80}(escalates|fallback)/i,
        "fallback also fails -> BLOCKED (TICKET_VERIFICATION_FAILED)": /fallback subagent[\s\S]{0,160}BLOCKED \(TICKET_VERIFICATION_FAILED\)/i,
        "escalation disclosed in status.md + handoff": /status\.md records[\s\S]{0,200}handoff[\s\S]{0,160}(Claude tokens spent|left the machine)/i,
        "BLOCKED halts only its branch": /stay integrated[\s\S]{0,200}(transitively blocked|not started)[\s\S]{0,200}next frontier/i,
        "status.md fields + integration ref": /status[\s\S]{0,10}report[\s\S]{0,240}integration branch ref|status\.md[\s\S]{0,160}integration branch ref/i,
        "continue discards half-built, re-dispatch clean": /discards? [\s\S]{0,60}worker branch and worktree[\s\S]{0,120}(re-dispatches|from clean)/i,
        "continue rewind on drift + discarded commits": /resets? the integration branch[\s\S]{0,120}(last still-verifying commit)[\s\S]{0,200}discarded commits/i,
        "dirty tree at preflight": /uncommitted changes[\s\S]{0,120}does not stash[\s\S]{0,120}dispatches no worker/i,
        "worker needs new dependency -> replan": /(new[\s\S]{0,12}dependency|package install)[\s\S]{0,200}(replans?|Stage 0)[\s\S]{0,120}lockfile/i,
        "completion handoff names branch + review commands, no push": /\/code-review[\s\S]{0,60}\/scrutinize[\s\S]{0,200}(no[\s\S]{0,8}push|opens no PR|does not push)/i,
      };
      for (const [label, re] of Object.entries(branches)) {
        assert.ok(hay(re), `no eval case covers: ${label}`);
      }
    });
  });
});
