import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { flatMarkdownSection } from "./helpers/markdown-contract.mjs";

// Pins only what breaks the skill when it goes missing. Behavior in a live
// session is not unit-testable, so nothing here pins sentences.

const skillDir = "skills/agents/implement-tickets";
const read = (rel) => readFile(path.join(skillDir, rel), "utf8");

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(file) : [file];
  }));
  return nested.flat();
}

describe("implement-tickets contract", () => {
  it("follows implement-spec, with the code review after the tickets", async () => {
    const flow = flatMarkdownSection(await read("SKILL.md"), "Flow");
    const positions = ["implement-spec", "tdd", "code-review"].map((name) => flow.indexOf(`\`${name}\``));
    assert.ok(positions.every((at) => at !== -1), "the flow names every followed skill");
    assert.deepEqual([...positions].sort((a, b) => a - b), positions, "the skills are named in the agreed order");
  });

  it("lists the upstream skills in Preflight", async () => {
    const preflight = flatMarkdownSection(await read("SKILL.md"), "Preflight");
    for (const name of ["implement-spec", "tdd", "code-review"]) {
      assert.ok(preflight.includes(`\`${name}\``), `Preflight lists ${name}`);
    }
    assert.match(preflight, /docs\/agents\/issue-tracker\.md/);
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

  it("names the five Run status columns in order and the four states", async () => {
    const status = flatMarkdownSection(await read("SKILL.md"), "Run status");
    assert.ok(status.includes("| Ticket | Title | Blocked by | Status | Commit |"), "the table header is the five columns in order");
    for (const state of ["waiting", "in progress", "done", "stuck"]) {
      assert.ok(status.includes(`\`${state}\``), `the Run status names ${state}`);
    }
  });

  it("states the trailer rule, the stopping rule, and the refusal of a file that is not a Run status", async () => {
    const skill = await read("SKILL.md");
    assert.match(flatMarkdownSection(skill, "Trailer"), /trailer/i);
    assert.match(flatMarkdownSection(skill, "Stopping rule"), /before `code-review`/);
    assert.match(flatMarkdownSection(skill, "Run status"), /not a Run status[\s\S]*stop/i);
  });
});
