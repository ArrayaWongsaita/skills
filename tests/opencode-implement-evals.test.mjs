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
      const branches = {
        "pure linear chain": /linear chain/i,
        "independent tickets still serial": /still[\s\S]{0,20}serial|run serially/i,
        "cyclic ticket set": /cycl|TICKET_SET_CYCLIC/i,
        "missing blocker": /missing blocker|TICKET_SET_MISSING_BLOCKER|non-existent blocker/i,
        "numbering inconsistent": /numbering|TICKET_SET_NUMBERING/i,
        "one-criterion -> one-sub-step": /one-criterion|one-sub-step/i,
        "multi-criterion -> multi-sub-step": /four-sub-step|four-criterion/i,
        "criterion over budget -> split finer": /over[\s\S]{0,10}budget|split[\s\S]{0,10}finer/i,
        "no source mutation before approval": /no source|before Plan approval|mutat/i,
        "no-arg -> most recent issues dir": /most recent(ly modified)?[\s\S]{0,30}issues/i,
        "opencode failure within budget retried locally": /retried locally|opencode failure[\s\S]{0,40}not escalat/i,
        "no first event -> killed": /first event|FIRST_EVENT_TIMEOUT/i,
        "hung smoke test -> run does not start": /smoke test/i,
        "worker prompt self-contained test-first": /self-contained|progress note[\s\S]{0,40}criterion/i,
        "one-criterion end to end + one commit": /end to end|one commit/i,
        "chain carries state by progress note not -s": /progress note[\s\S]{0,40}never[\s\S]{0,10}-s|never opencode -s/i,
        "runtime re-split recorded not failed": /re-split/i,
        "fabricated / not-actually-red": /fabricated|not-actually-red|passes without the implementation/i,
        "vacuous test / missing coverage": /vacuous/i,
        "design-encoding merge conflict": /design[\s\S]{0,10}encoding|INTEGRATION_DESIGN_CONFLICT/i,
        "3 local verify fails -> auto escalate no pause": /three[\s\S]{0,20}verification failures|no approval pause|no pause/i,
        "TICKET_TOO_LARGE + fallback -> subagent directly": /TICKET_TOO_LARGE_FOR_CONTEXT[\s\S]{0,60}(escalat|subagent|not[\s\S]{0,10}BLOCK)/i,
        "--no-fallback -> BLOCK": /--no-fallback|--strict-local/i,
        "opencode failures past budget -> escalate": /MAX_OPENCODE_RETRIES[\s\S]{0,40}(escalat|fallback)/i,
        "fallback also fails -> BLOCKED (TICKET_VERIFICATION_FAILED)": /TICKET_VERIFICATION_FAILED/i,
        "escalation disclosed in status.md + handoff": /status\.md[\s\S]{0,60}handoff|handoff[\s\S]{0,60}status\.md|left the machine/i,
        "BLOCKED halts only its branch": /halts? only (its|the)[\s\S]{0,20}dependency branch/i,
        "status.md fields + integration ref": /status\.md[\s\S]{0,60}(path|sub_step|integration branch ref)/i,
        "continue discards half-built, re-dispatch clean": /discards? [\s\S]{0,40}worker branch and worktree|half-built/i,
        "continue rewind on drift + discarded commits": /discarded commits|last still-verifying commit/i,
        "dirty tree at preflight": /dirty[\s\S]{0,10}tree|uncommitted changes/i,
        "worker needs new dependency -> replan": /new[\s\S]{0,10}dependency|package install|lockfile/i,
        "completion handoff names branch + review commands, no push": /\/code-review[\s\S]{0,40}\/scrutinize|handoff[\s\S]{0,80}push/i,
      };
      for (const [label, re] of Object.entries(branches)) {
        assert.ok(hay(re), `no eval case covers: ${label}`);
      }
    });
  });
});
