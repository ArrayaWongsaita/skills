import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { flatMarkdownSection } from "./helpers/markdown-contract.mjs";

// Pins only what breaks the skill when it goes missing. Behavior in a live
// session is not unit-testable, so nothing here pins sentences.

const skillDir = "skills/agents/grill-to-tickets";
const read = (rel) => readFile(path.join(skillDir, rel), "utf8");

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(file) : [file];
  }));
  return nested.flat();
}

describe("grill-to-tickets contract", () => {
  it("follows the upstream stages in order", async () => {
    const flow = flatMarkdownSection(await read("SKILL.md"), "Flow");
    const positions = ["grill-with-docs", "to-spec", "scrutinize", "to-tickets"].map((name) => flow.indexOf(`\`${name}\``));
    assert.ok(positions.every((at) => at !== -1), "the flow names every upstream stage");
    assert.deepEqual([...positions].sort((a, b) => a - b), positions, "the stages are in the agreed order");
  });

  it("lists the upstream skills in Preflight", async () => {
    const preflight = flatMarkdownSection(await read("SKILL.md"), "Preflight");
    for (const name of ["grill-with-docs", "grilling", "domain-modeling", "to-spec", "scrutinize", "to-tickets"]) {
      assert.ok(preflight.includes(`\`${name}\``), `Preflight lists ${name}`);
    }
  });

  it("ships exactly its expected files", async () => {
    const files = (await filesUnder(skillDir)).map((file) => path.relative(skillDir, file).split(path.sep).join("/")).sort();
    assert.deepEqual(files, ["SKILL.md", "agents/openai.yaml", "evals/evals.json", "evals/trigger-evals.json"]);
  });

  it("is invoked only by the person, in both harnesses", async () => {
    const frontmatter = (await read("SKILL.md")).match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
    assert.match(frontmatter, /^disable-model-invocation:\s*true$/m);
    assert.match(await read("agents/openai.yaml"), /^\s*allow_implicit_invocation:\s*false$/m);
  });

  it("reviews in a fresh subagent and lets the person choose the fixes", async () => {
    const review = flatMarkdownSection(await read("SKILL.md"), "Review");
    assert.match(review, /fresh subagent/i);
    assert.match(review, /person chooses/i);
  });
});
