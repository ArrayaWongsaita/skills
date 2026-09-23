import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const SKILL_REFERENCES = [
  "agy-contract.md",
  "model-routing.md",
  "multi-turn-workflow.md",
  "prompt-scaffold.md",
];

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

const canonicalDir = "skills/agents/agy-agent";
const skillDirs = [canonicalDir];
const skillFiles = skillDirs.map((dir) => path.resolve(dir, "SKILL.md"));

describe("agy-agent skill contract", () => {
  it("has valid frontmatter", async () => {
    for (const file of skillFiles) {
      await fileExists(file);
      const meta = parseFrontmatter(await readFile(file, "utf8"));
      assert.equal(meta.name, "agy-agent");
      assert.ok(
        meta.description && meta.description.length >= 80,
        "description must be at least 80 characters",
      );
      assert.equal(
        meta["disable-model-invocation"],
        "true",
        "frontmatter must set disable-model-invocation: true (explicit invocation only)",
      );
    }
  });

  it("documents explicit-only invocation in the body and the Codex policy", async () => {
    for (const file of skillFiles) {
      const body = (await readFile(file, "utf8")).replace(/^---\n[\s\S]*?\n---\n/, "");
      assert.match(body, /^##+\s+Invocation\s*$/m, "SKILL.md must have an Invocation section");
    }
    const openai = await readFile(
      path.resolve(canonicalDir, "agents/openai.yaml"),
      "utf8",
    );
    assert.match(
      openai,
      /allow_implicit_invocation:\s*false/,
      "openai.yaml must disallow implicit invocation",
    );
  });

  it("steers positively without 'Never' or 'Do not' in instruction body", async () => {
    for (const file of skillFiles) {
      const body = (await readFile(file, "utf8")).replace(/^---\n[\s\S]*?\n---\n/, "");
      assert.doesNotMatch(body, /\bNever\b/i, "prompt the positive instead of 'Never'");
      assert.doesNotMatch(body, /\bDo not\b/i, "prompt the positive instead of 'Do not'");
    }
  });

  it("defines the five operational phases and file-based I/O protocol", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /Phase 1[^\n]*Assess/i);
      assert.match(content, /Phase 2[^\n]*Scaffold/i);
      assert.match(content, /Phase 3[^\n]*Dispatch/i);
      assert.match(content, /Phase 4[^\n]*Verify/i);
      assert.match(content, /Phase 5[^\n]*Resume/i);
      assert.match(content, /\$\(cat\s+/i, "must specify file-based prompt substitution");
    }
  });

  it("specifies task-aware model selection across the Flash, Pro, and cross-family tiers", async () => {
    // Version-agnostic: assert on the family/tier shape, not a pinned model version.
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /gemini-[\d.]+-flash/i, "must reference a Gemini Flash model");
      assert.match(content, /gemini-[\d.]+-pro/i, "must reference a Gemini Pro model");
      assert.match(content, /claude-[a-z]+-[\d-]+/i, "must reference a cross-family Claude model");
      assert.match(content, /agy models/i, "must point at `agy models` to confirm current slugs");
    }
  });

  it("resolves all reference links and ships the exact reference set", async () => {
    for (const dir of skillDirs) {
      const skillDir = path.resolve(dir);
      const content = await readFile(path.join(skillDir, "SKILL.md"), "utf8");
      const links = localSkillLinks(content);
      assert.ok(links.length >= SKILL_REFERENCES.length, "must link to all references");
      for (const expected of SKILL_REFERENCES) {
        assert.ok(
          links.some((l) => l.includes(expected)),
          `SKILL.md must link to ${expected}`,
        );
        await fileExists(path.resolve(skillDir, "references", expected));
      }
    }
  });

  it("publishes a bilingual human guide with installation and model selection", async () => {
    const guide = await readFile(path.resolve("docs/skills/agents/agy-agent.md"), "utf8");
    assert.match(guide, /^## ภาษาไทย \/ Thai\s*$/m);
    assert.match(guide, /^## English \/ ภาษาอังกฤษ\s*$/m);
    assert.match(guide, /npx skills add ArrayaWongsaita\/skills --skill agy-agent/);
    assert.match(guide, /gemini-[\d.]+-flash/);
    assert.match(guide, /gemini-[\d.]+-pro/);
  });

  it("keeps the dispatch examples parseable — split stdout from stderr, no 2>&1", async () => {
    const files = [
      path.resolve(canonicalDir, "SKILL.md"),
      path.resolve(canonicalDir, "references/agy-contract.md"),
      path.resolve(canonicalDir, "references/multi-turn-workflow.md"),
    ];
    for (const file of files) {
      const content = await readFile(file, "utf8");
      assert.doesNotMatch(content, /2>&1/, `${path.basename(file)} must not merge stderr into the envelope`);
    }
  });
});
