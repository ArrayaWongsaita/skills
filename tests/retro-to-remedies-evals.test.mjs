import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

async function fileExists(filePath) {
  await access(filePath, constants.R_OK);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

const evalDirs = [
  "skills/agents/retro-to-remedies/evals",
  ".agents/skills/retro-to-remedies/evals",
];
const canonicalDir = evalDirs[0];

const evalsJson = () => readJson(path.resolve(canonicalDir, "evals.json"));
const triggerJson = () => readJson(path.resolve(canonicalDir, "trigger-evals.json"));

describe("retro-to-remedies eval suite contract", () => {
  it("ships trigger-evals.json and evals.json in canonical and mirror copies", async () => {
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
    it("confirms positive cases for /retro-to-remedies with/without slug, with --transcript, with --fresh, and $retro-to-remedies", async () => {
      const triggers = await triggerJson();
      const positives = triggers.filter((t) => t.should_trigger);

      assert.ok(positives.some((t) => t.query.trim() === "/retro-to-remedies"), "bare /retro-to-remedies");
      assert.ok(positives.some((t) => /\/retro-to-remedies\s+[a-z0-9_-]+/i.test(t.query) && !t.query.includes("--")), "/retro-to-remedies with slug");
      assert.ok(positives.some((t) => t.query.includes("/retro-to-remedies") && t.query.includes("--transcript")), "/retro-to-remedies with --transcript");
      assert.ok(positives.some((t) => t.query.includes("/retro-to-remedies") && t.query.includes("--fresh")), "/retro-to-remedies with --fresh");
      assert.ok(positives.some((t) => t.query.includes("$retro-to-remedies")), "$retro-to-remedies");
    });

    it("includes at least three negative cases, none using explicit invocation", async () => {
      const triggers = await triggerJson();
      const negatives = triggers.filter((t) => !t.should_trigger);
      assert.ok(negatives.length >= 3, "at least three negative cases are required");
      for (const item of negatives) {
        assert.doesNotMatch(
          item.query,
          /[/$]retro-to-remedies/,
          "negative cases must not use an explicit retro-to-remedies invocation",
        );
      }
    });
  });

  describe("evals.json", () => {
    it("declares skill_name retro-to-remedies and unique ids and names", async () => {
      const payload = await evalsJson();
      assert.equal(payload.skill_name, "retro-to-remedies");
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

    it("drives every case through an explicit retro-to-remedies invocation", async () => {
      for (const item of (await evalsJson()).evals) {
        assert.match(
          item.prompt,
          /[/$]retro-to-remedies/,
          `case ${item.id} must invoke retro-to-remedies explicitly`,
        );
      }
    });

    it("covers the branches listed in ticket 01 (explicit-only start, slug resolution, protected-branch refusal)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));

      assert.ok(
        hay(/explicit-only|explicit invocation only|does not start itself/i),
        "case for explicit-only start",
      );
      assert.ok(
        hay(/argument|slug from argument/i),
        "case for slug from argument",
      );
      assert.ok(
        hay(/integration branch|branch stem/i),
        "case for slug from integration branch stem",
      );
      assert.ok(
        hay(/most recent(ly modified)? .*\.scratch|confirm/i),
        "case for slug from most recent .scratch confirmed",
      );
      assert.ok(
        hay(/protected branch|refuses? on main|main, master, or dev/i),
        "case for protected-branch refusal",
      );
    });

    it("covers the branches listed in ticket 02 (fixture 8 misses, missing status.md, no .scratch asks before transcript)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));

      // fixture Run yields eight Misses of Further Notes table with locations
      assert.ok(
        hay(/fixture.*eight misses|fixture.*8 misses|eight misses.*fixture|fixture.*further notes/i),
        "case for fixture Run yielding eight Misses with locations",
      );

      // Run with no status.md proceeds and names it missing
      assert.ok(
        hay(/missing status\.md|no status\.md.*proceeds|no status\.md.*names it missing/i),
        "case for Run with no status.md proceeding and naming it missing",
      );

      // no .scratch/<feature-slug>/ asks before reading transcript
      assert.ok(
        hay(/no \.scratch.*asks before reading.*transcript|no \.scratch.*asks.*transcript/i),
        "case for no .scratch/<feature-slug>/ asking before reading transcript",
      );
    });
  });
});
