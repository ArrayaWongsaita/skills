import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

// The eval files are behavioral documentation in skill-creator's benchmark
// format, not a CI behaviour gate — nothing here runs the prompts. This
// contract covers what scripts/validate-skills.mjs cannot: the schema of both
// files, one trigger case per routing decision including the keep-local
// refusals, and one output case per delegation flow the skill ships.

async function fileExists(filePath) {
  await access(filePath, constants.R_OK);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

const canonicalDir = "skills/agents/tokenme-agent/evals";

const evalsJson = () => readJson(path.resolve(canonicalDir, "evals.json"));
const triggerJson = () => readJson(path.resolve(canonicalDir, "trigger-evals.json"));

// One output case per flow, located by name, so a flow's claims are
// asserted on the case that owns them.
async function findCase(namePattern) {
  const { evals } = await evalsJson();
  const matches = evals.filter((item) => namePattern.test(item.name));
  assert.equal(
    matches.length,
    1,
    `exactly one eval case is named for ${namePattern}`,
  );
  return matches[0];
}

// The claims a case makes: its expected output plus its expectations.
function claims(item) {
  return `${item.expected_output} ${item.expectations.join(" ")}`;
}

describe("tokenme-agent eval suite contract", () => {
  it("ships trigger-evals.json and evals.json", async () => {
    await fileExists(path.resolve(canonicalDir, "trigger-evals.json"));
    await fileExists(path.resolve(canonicalDir, "evals.json"));
  });

  describe("trigger-evals.json", () => {
    it("is a table of query and should_trigger pairs with both directions present", async () => {
      const triggers = await triggerJson();
      assert.ok(
        Array.isArray(triggers) && triggers.length > 0,
        "the trigger table is a non-empty list",
      );
      for (const item of triggers) {
        assert.ok(
          typeof item.query === "string" && item.query.length > 0,
          "every entry carries a query",
        );
        assert.equal(
          typeof item.should_trigger,
          "boolean",
          "every entry carries a boolean should_trigger",
        );
      }
      assert.ok(
        triggers.some((t) => t.should_trigger),
        "at least one should-trigger case is present",
      );
      assert.ok(
        triggers.some((t) => !t.should_trigger),
        "at least one should-not-trigger case is present",
      );
    });

    it("confirms both /tokenme-agent and $tokenme-agent trigger", async () => {
      const positives = (await triggerJson()).filter((t) => t.should_trigger);
      assert.ok(
        positives.some((t) => t.query.includes("/tokenme-agent")),
        "a /tokenme-agent positive case is required",
      );
      assert.ok(
        positives.some((t) => t.query.includes("$tokenme-agent")),
        "a $tokenme-agent positive case is required",
      );
    });

    it("has should-trigger cases for the four mechanical routing decisions", async () => {
      const positives = (await triggerJson()).filter((t) => t.should_trigger);
      assert.ok(
        positives.some((t) => /rename/i.test(t.query)),
        "a bulk rename triggers",
      );
      assert.ok(
        positives.some((t) => /boilerplate/i.test(t.query)),
        "boilerplate generation triggers",
      );
      assert.ok(
        positives.some((t) => /log/i.test(t.query) && /summaris/i.test(t.query)),
        "summarising a log triggers",
      );
      assert.ok(
        positives.some((t) => /lint/i.test(t.query)),
        "run lint and report triggers",
      );
    });

    it("has should-not-trigger cases for the four keep-local and exclusion decisions", async () => {
      const negatives = (await triggerJson()).filter((t) => !t.should_trigger);
      assert.ok(negatives.length >= 4, "at least four negative cases are required");
      assert.ok(
        negatives.some((t) => /credentials|secrets/i.test(t.query)),
        "editing a credentials file stays on the host",
      );
      assert.ok(
        negatives.some((t) => /architect/i.test(t.query)),
        "choosing an architecture stays on the host",
      );
      assert.ok(
        negatives.some((t) => /risk:\s*high/i.test(t.query)),
        "a Risk: high ticket stays on the host",
      );
      assert.ok(
        negatives.some((t) => /earlier in this chat|we discussed/i.test(t.query)),
        "a task that needs this chat's earlier context stays on the host",
      );
      for (const item of negatives) {
        assert.doesNotMatch(
          item.query,
          /[/$]tokenme-agent/,
          "negative cases must not use an explicit tokenme-agent invocation",
        );
      }
    });

    it("marks the secrets-file query should-not-trigger", async () => {
      const secretsQueries = (await triggerJson()).filter((t) =>
        /secrets|credentials|\.env/i.test(t.query),
      );
      assert.ok(secretsQueries.length >= 1, "a secrets-file query is present");
      for (const item of secretsQueries) {
        assert.equal(
          item.should_trigger,
          false,
          `"${item.query}" is marked should-not-trigger`,
        );
      }
    });
  });

  describe("evals.json", () => {
    it("declares skill_name tokenme-agent and unique ids and names", async () => {
      const payload = await evalsJson();
      assert.equal(payload.skill_name, "tokenme-agent");
      assert.ok(Array.isArray(payload.evals) && payload.evals.length > 0);
      const ids = new Set();
      const names = new Set();
      for (const item of payload.evals) {
        assert.ok(
          Number.isInteger(item.id) && !ids.has(item.id),
          `unique id ${item.id}`,
        );
        ids.add(item.id);
        assert.ok(
          typeof item.name === "string" && !names.has(item.name),
          "unique name",
        );
        names.add(item.name);
        assert.ok(
          typeof item.prompt === "string" && item.prompt.length > 0,
          `case ${item.id} carries a prompt`,
        );
        assert.ok(
          typeof item.expected_output === "string" &&
            item.expected_output.length > 0,
          `case ${item.id} carries an expected output`,
        );
        assert.ok(
          Array.isArray(item.files),
          `case ${item.id} carries a files array`,
        );
        assert.ok(
          Array.isArray(item.expectations) && item.expectations.length > 0,
          `case ${item.id} carries expectations`,
        );
      }
    });

    it("covers the five delegation flows, one case each", async () => {
      const { evals } = await evalsJson();
      assert.ok(evals.length >= 5, `expected >= 5 eval cases, got ${evals.length}`);
      const flows = {
        "a bare dispatch": /bare[ -]dispatch/i,
        "a read-only task": /read[ -]only/i,
        "an oversized job that is split": /oversized/i,
        "a failed run that falls back to the host":
          /falls[ -]back[ -]to[ -]the[ -]host/i,
        "a refused sensitive task": /refused|stays[ -]on[ -]the[ -]host/i,
      };
      for (const [label, re] of Object.entries(flows)) {
        assert.ok(evals.some((e) => re.test(e.name)), `no eval case covers: ${label}`);
      }
    });

    it("dispatches the bare case with the default flags, the prompt file, and the two output files", async () => {
      const bare = await findCase(/bare[ -]dispatch/i);
      const text = claims(bare);
      assert.match(text, /--bare/, "the run is dispatched bare");
      assert.match(text, /--output-format json/, "the run is dispatched with JSON output");
      assert.match(text, /--no-session-persistence/, "the run persists no session");
      assert.match(text, /--disable-slash-commands/, "the run keeps slash commands off");
      assert.match(
        text,
        /\$\(cat \/tmp\/tokenme-prompts\/<task-id>\.md\)/,
        "the prompt is passed by reading the prompt file",
      );
      assert.match(
        text,
        /--allowed-tools/,
        "the run carries the tool set for its task kind",
      );
      assert.match(text, /--disallowed-tools/, "the run carries the deny list");
      assert.match(
        text,
        /\/tmp\/tokenme-runs\/<task-id>\.json/,
        "stdout goes to the result file",
      );
      assert.match(
        text,
        /\/tmp\/tokenme-runs\/<task-id>\.err/,
        "stderr goes to its own error file",
      );
      assert.match(
        text,
        /is_error|terminal_reason/,
        "the gate reads the envelope after the run",
      );
    });

    it("scopes the read-only case to the three read tools", async () => {
      const readOnly = await findCase(/read[ -]only/i);
      const text = claims(readOnly);
      assert.match(
        text,
        /--allowed-tools "Read Glob Grep"/,
        "the run is restricted to read, glob and grep",
      );
      assert.match(text, /--bare/, "the read-only run stays bare by default");
    });

    it("splits the oversized case into independent chunks that run as separate delegate runs", async () => {
      const oversized = await findCase(/oversized/i);
      const text = claims(oversized);
      assert.match(
        text,
        /60k planning budget/,
        "the task is sized against the 60k planning budget",
      );
      assert.match(
        text,
        /split[\s\S]*before dispatch|before dispatch[\s\S]*split/i,
        "the split happens before dispatch",
      );
      assert.match(
        text,
        /per-file or per-directory chunks/,
        "the split is into per-file or per-directory chunks",
      );
      assert.match(
        text,
        /its own delegate run|separate delegate run/,
        "each chunk runs as its own delegate run",
      );
      assert.match(
        text,
        /none depending on another's output/,
        "the chunks stay independent",
      );
    });

    it("retries the failed case once with a narrower chunk and then does the task itself", async () => {
      const failed = await findCase(/falls[ -]back[ -]to[ -]the[ -]host/i);
      const text = claims(failed);
      assert.match(text, /reports stderr/, "a failed run's stderr is reported");
      assert.match(text, /retries once/, "the failed run is retried once");
      assert.match(text, /narrower chunk/, "the retry takes a narrower chunk");
      assert.match(
        text,
        /the host does the task itself/,
        "the host does the task itself after the retry fails",
      );
      assert.match(
        text,
        /gateway or authentication failure/,
        "a gateway or authentication failure is the named stop",
      );
      assert.match(text, /without a retry/, "the gateway stop takes no retry");
    });

    it("keeps the refused case on the host and dispatches nothing", async () => {
      const refused = await findCase(/refused|stays[ -]on[ -]the[ -]host/i);
      const text = claims(refused);
      assert.match(
        text,
        /before dispatch/,
        "the keep-local rules are checked before dispatch",
      );
      assert.match(
        text,
        /dispatches nothing/,
        "the host dispatches nothing for the refused task",
      );
      assert.match(
        text,
        /reach no gateway/,
        "the task's secrets reach no gateway",
      );
      assert.match(text, /`\.env`/, "the refused task touches a `.env` file");
    });
  });
});
