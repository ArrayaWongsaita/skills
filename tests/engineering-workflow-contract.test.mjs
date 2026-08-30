import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

async function fileExists(filePath) {
  await access(filePath, constants.R_OK);
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, "SKILL.md must start with YAML frontmatter");
  const fields = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([a-z][a-z0-9_-]*):\s*(.*)$/i);
    if (field) {
      fields[field[1]] = field[2].trim();
    }
  }
  return fields;
}

describe("Engineering Workflow Control Plane Contract", () => {
  const skillPath = path.resolve("skills/agents/engineering-workflow/SKILL.md");
  const localSkillPath = path.resolve(".agents/skills/engineering-workflow/SKILL.md");

  it("exists and defines valid YAML frontmatter in both locations", async () => {
    for (const file of [skillPath, localSkillPath]) {
      await fileExists(file);
      const content = await readFile(file, "utf8");
      const meta = parseFrontmatter(content);

      assert.equal(meta.name, "engineering-workflow");
      assert.ok(meta.description && meta.description.length >= 80, "Description must be at least 80 chars");
      assert.equal(meta["disable-model-invocation"], "true");
    }
  });

  it("incorporates all core leading words in both locations", async () => {
    for (const file of [skillPath, localSkillPath]) {
      const content = await readFile(file, "utf8");

      assert.match(content, /Smart Zone/i, "Must incorporate Smart Zone");
      assert.match(content, /Gate budget/i, "Must incorporate Gate budget");
      assert.match(content, /Atomic CAS/i, "Must incorporate Atomic CAS");
      assert.match(content, /Reality reconciliation/i, "Must incorporate Reality reconciliation");
    }
  });

  it("eliminates negative steering (Do not / Never) from the skill instruction body in both locations", async () => {
    for (const file of [skillPath, localSkillPath]) {
      const content = await readFile(file, "utf8");
      const body = content.replace(/^---\n[\s\S]*?\n---\n/, "");

      assert.doesNotMatch(body, /\bDo not\b/i, "Should not contain negative steering 'Do not'");
      assert.doesNotMatch(body, /\bNever\b/i, "Should not contain negative steering 'Never'");
    }
  });

  it("links to progressive disclosure reference files in both locations", async () => {
    for (const file of [skillPath, localSkillPath]) {
      const content = await readFile(file, "utf8");

      assert.match(content, /references\/routing\.md/);
      assert.match(content, /references\/dependencies\.md/);
      assert.match(content, /references\/states\.md/);
      assert.match(content, /references\/gates\.md/);
      assert.match(content, /references\/artifacts\.md/);
      assert.match(content, /references\/architecture\.md/);
    }
  });
});
