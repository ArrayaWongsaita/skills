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

function localSkillLinks(markdown) {
  return [...markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
    .map((m) => m[1].trim().split(/\s+/)[0])
    .filter((target) => target && !target.startsWith("#") && !/^[a-z][a-z0-9+.-]*:/i.test(target));
}

const canonicalDir = "skills/agents/agy-implement";
const mirrorDir = ".agents/skills/agy-implement";
const skillDirs = [canonicalDir, mirrorDir];
const skillFiles = skillDirs.map((dir) => path.resolve(dir, "SKILL.md"));

async function bothSkillBodies() {
  return Promise.all(
    skillFiles.map(async (file) => (await readFile(file, "utf8")).replace(/^---\n[\s\S]*?\n---\n/, "")),
  );
}

describe("agy-implement skill contract", () => {
  describe("ticket 01 — scaffold and trigger policy", () => {
    it("exists in the canonical and mirror locations with valid frontmatter", async () => {
      for (const file of skillFiles) {
        await fileExists(file);
        const meta = parseFrontmatter(await readFile(file, "utf8"));
        assert.equal(meta.name, "agy-implement");
        assert.ok(
          meta.description && meta.description.length >= 80,
          "description must be at least 80 characters",
        );
        assert.equal(meta["disable-model-invocation"], "true");
      }
    });

    it("names the full span in its description", async () => {
      const meta = parseFrontmatter(await readFile(skillFiles[0], "utf8"));
      for (const beat of [/ticket/i, /plan|wave/i, /agy/i, /verif/i, /integrat/i, /review/i]) {
        assert.match(meta.description, beat);
      }
    });

    it("keeps the canonical and mirror SKILL.md byte-identical", async () => {
      const [canonical, mirror] = await Promise.all(
        skillFiles.map((file) => readFile(file, "utf8")),
      );
      assert.equal(canonical, mirror);
    });

    it("documents the invocation surface and the sub-commands", async () => {
      for (const file of skillFiles) {
        const content = await readFile(file, "utf8");
        assert.match(content, /\/agy-implement <dir\|slug>|\/agy-implement <dir>/);
        assert.match(content, /\$agy-implement/);
        assert.match(content, /\bcontinue\b/);
        assert.match(content, /\bstatus\b/);
        assert.match(content, /\blist\b/);
        assert.match(content, /explicit/i);
      }
    });

    it("steers positively — no 'Never' or 'Do not' in the instruction body", async () => {
      for (const body of await bothSkillBodies()) {
        assert.doesNotMatch(body, /\bNever\b/i, "prompt the positive instead of 'Never'");
        assert.doesNotMatch(body, /\bDo not\b/i, "prompt the positive instead of 'Do not'");
      }
    });

    it("ships Codex metadata that blocks implicit invocation in both copies", async () => {
      for (const dir of skillDirs) {
        const yaml = await readFile(path.resolve(dir, "agents/openai.yaml"), "utf8");
        assert.match(yaml, /display_name:/);
        assert.match(yaml, /short_description:/);
        assert.match(yaml, /\$agy-implement/);
        assert.match(yaml, /allow_implicit_invocation:\s*false/);
      }
    });

    it("resolves every local link in SKILL.md inside the skill directory", async () => {
      for (const dir of skillDirs) {
        const skillDir = path.resolve(dir);
        const content = await readFile(path.join(skillDir, "SKILL.md"), "utf8");
        for (const link of localSkillLinks(content)) {
          await fileExists(path.resolve(skillDir, link.split("#")[0]));
        }
      }
    });

    it("publishes a bilingual human guide with the install command", async () => {
      const guide = await readFile(path.resolve("docs/skills/agents/agy-implement.md"), "utf8");
      assert.match(guide, /^## ภาษาไทย \/ Thai\s*$/m);
      assert.match(guide, /^## English \/ ภาษาอังกฤษ\s*$/m);
      assert.match(guide, /npx skills add ArrayaWongsaita\/skills --skill agy-implement/);
    });
  });
});
