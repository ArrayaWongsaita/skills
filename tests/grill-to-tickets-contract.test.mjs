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

describe("grill-to-tickets composite skill contract", () => {
  const canonicalDir = "skills/agents/grill-to-tickets";
  const mirrorDir = ".agents/skills/grill-to-tickets";
  const skillDirs = [canonicalDir, mirrorDir];
  const skillFiles = skillDirs.map((dir) => path.resolve(dir, "SKILL.md"));

  it("exists in the canonical and installed locations with valid frontmatter", async () => {
    for (const file of skillFiles) {
      await fileExists(file);
      const meta = parseFrontmatter(await readFile(file, "utf8"));
      assert.equal(meta.name, "grill-to-tickets");
      assert.ok(
        meta.description && meta.description.length >= 80,
        "description must be at least 80 characters",
      );
      assert.equal(meta["disable-model-invocation"], "true");
    }
  });

  it("keeps the canonical and installed copies byte-identical", async () => {
    const [canonical, mirror] = await Promise.all(
      skillFiles.map((file) => readFile(file, "utf8")),
    );
    assert.equal(canonical, mirror);
  });

  it("inline-executes the five child skills and never invokes implement", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /inline/i, "must instruct inline execution");
      for (const child of ["grilling", "domain-modeling", "to-spec", "scrutinize", "to-tickets"]) {
        assert.match(content, new RegExp(child), `must name child skill ${child}`);
      }
      assert.match(
        content,
        /never invoke[^\n]*implement/i,
        "must state it never invokes implement",
      );
    }
  });

  it("defines Stage 0 through Stage 3", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /Stage 0[^\n]*Grill/i);
      assert.match(content, /Stage 1[^\n]*Spec/i);
      assert.match(content, /Stage 2[^\n]*Design Review Gate/i);
      assert.match(content, /Stage 3[^\n]*Ticket/i);
    }
  });

  it("specifies the feature-scoped artifact tree, including one stable design-review file", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /\.scratch\/<feature-slug>\//);
      assert.match(content, /\.scratch\/<feature-slug>\/CONTEXT\.md/);
      assert.match(content, /\.scratch\/<feature-slug>\/adr\//);
      assert.match(content, /\.scratch\/<feature-slug>\/spec\.md/);
      assert.match(content, /\.scratch\/<feature-slug>\/design-review\.md/);
      assert.match(content, /\.scratch\/<feature-slug>\/issues\//);
    }
  });

  it("normalizes every scrutinize verdict without paraphrasing", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      for (const verdict of ["SHIP", "FIX_THEN_SHIP", "REWORK", "REJECT"]) {
        assert.match(content, new RegExp(verdict));
      }
    }
  });

  it("distinguishes spec-level rework from decision-level rework", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /spec-level/i);
      assert.match(content, /decision-level/i);
      // spec-level re-runs to-spec; decision-level returns to Stage 0
      assert.match(content, /decision-level[\s\S]{0,400}Stage 0/i);
    }
  });

  it("bounds the design review gate: six cycles, stall, no counter reset, human authorization", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /\b(6|six)\b/i);
      assert.match(content, /stall/i);
      assert.match(content, /human authoriz/i);
      assert.match(content, /carries over|never reset/i);
    }
  });

  it("halts REJECT instead of auto-resuming grilling", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /REJECT[\s\S]{0,300}(stop|halt)/i);
    }
  });

  it("prints the /clear then /implement resume handoff", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /\/clear/);
      assert.match(content, /\/implement \.scratch\/<feature-slug>\/issues\/01-/);
    }
  });

  it("forbids modifying upstream-tracked skills or the lock file", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /grill-with-docs/);
      assert.match(content, /skills-lock\.json/);
      assert.match(content, /mattpocock/i);
    }
  });

  it("ships Codex metadata that blocks implicit invocation", async () => {
    for (const dir of skillDirs) {
      const yaml = await readFile(path.resolve(dir, "agents/openai.yaml"), "utf8");
      assert.match(yaml, /display_name:/);
      assert.match(yaml, /short_description:/);
      assert.match(yaml, /\$grill-to-tickets/);
      assert.match(yaml, /allow_implicit_invocation:\s*false/);
    }
  });

  it("keeps the design-review-gate reference and resolves every SKILL.md link", async () => {
    for (const dir of skillDirs) {
      const skillDir = path.resolve(dir);
      const content = await readFile(path.join(skillDir, "SKILL.md"), "utf8");
      const links = localSkillLinks(content);
      assert.ok(links.length > 0, "SKILL.md links to at least one reference file");
      for (const link of links) {
        await fileExists(path.resolve(skillDir, link.split("#")[0]));
      }
      const gate = await readFile(path.join(skillDir, "references/design-review-gate.md"), "utf8");
      for (const verdict of ["SHIP", "FIX_THEN_SHIP", "REWORK", "REJECT"]) {
        assert.match(gate, new RegExp(verdict));
      }
      assert.match(gate, /spec-level/i);
      assert.match(gate, /decision-level/i);
      assert.match(gate, /stall/i);
    }
  });

  it("publishes a bilingual human guide with the install command", async () => {
    const guide = await readFile(path.resolve("docs/skills/agents/grill-to-tickets.md"), "utf8");
    assert.match(guide, /^## ภาษาไทย \/ Thai\s*$/m);
    assert.match(guide, /^## English \/ ภาษาอังกฤษ\s*$/m);
    assert.match(guide, /npx skills add ArrayaWongsaita\/skills --skill grill-to-tickets/);
  });
});
