import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { discoverSkills, renderIndex } from "../scripts/generate-skill-index.mjs";

async function fileExists(path) {
  await access(path, constants.R_OK);
}

async function readText(path) {
  return readFile(path, "utf8");
}

function frontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, "SKILL.md starts with YAML frontmatter");
  return match[1];
}

describe("personal AI skills repository contract", () => {
  it("documents the personal skills workspace and installation commands", async () => {
    const readme = await readText("README.md");

    assert.match(readme, /# Personal AI Skills/);
    assert.match(readme, /npx skills add ArrayaWongsaita\/skills --list/);
    assert.match(readme, /npx skills add ArrayaWongsaita\/skills --skill agent-instructions-architect/);
    assert.match(readme, /npx skills add ArrayaWongsaita\/skills --all/);
    assert.match(readme, /docs\/skills\/README\.md/);
    assert.match(readme, /scripts\/validate-skills\.mjs/);
    assert.doesNotMatch(readme, /link-skills\.sh|\.codex-plugin/);
  });

  it("includes setup files for local validation and generated documentation", async () => {
    await fileExists("scripts/validate-skills.mjs");
    await fileExists("scripts/generate-skill-index.mjs");
    await fileExists("docs/skills/README.md");
    await fileExists("docs/glossary.md");
    await fileExists("docs/decisions/0001-skill-library-layout.md");
  });

  it("shows the required skill frontmatter in the README example", async () => {
    const readme = await readText("README.md");
    const example = readme.match(/```markdown\n([\s\S]*?)\n```/);

    assert.ok(example, "README includes a SKILL.md example");
    const metadata = frontmatter(example[1]);
    assert.match(metadata, /^name:\s*my-skill$/m);
    assert.match(metadata, /^description:\s*.+AI agent.+$/m);
  });

  it("keeps the generated skill index in sync", async () => {
    const skills = await discoverSkills();
    const index = await readText("docs/skills/README.md");

    assert.equal(index, renderIndex(skills));
  });

  it("renders repeated skill flags for a multi-skill category", () => {
    const index = renderIndex([
      { category: "demo", name: "first-skill", description: "First skill description" },
      { category: "demo", name: "second-skill", description: "Second skill description" },
    ]);

    assert.match(index, /--skill first-skill \\\n  --skill second-skill/);
  });
});
