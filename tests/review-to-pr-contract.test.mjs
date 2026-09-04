import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

// The reference set SKILL.md links, the guide's Related files list, and the
// references/ directory must agree. One source of truth for the three checks.
const SKILL_REFERENCES = [
  "fix-dispatch.md",
  "review-loop.md",
  "review-point.md",
  "scrutiny-gate.md",
  "status-and-resume.md",
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

const canonicalDir = "skills/agents/review-to-pr";
const mirrorDir = ".agents/skills/review-to-pr";
const skillDirs = [canonicalDir, mirrorDir];
const skillFiles = skillDirs.map((dir) => path.resolve(dir, "SKILL.md"));

async function bothSkillBodies() {
  return Promise.all(
    skillFiles.map(async (file) => (await readFile(file, "utf8")).replace(/^---\n[\s\S]*?\n---\n/, "")),
  );
}

// Concatenate SKILL.md plus named references for one skill copy. Several rules
// are spread across the workflow file and its references on purpose; the check
// is that the rule is stated somewhere in that set.
async function joinDocs(dir, ...refs) {
  const files = ["SKILL.md", ...refs.map((r) => `references/${r}`)];
  const bodies = await Promise.all(files.map((f) => readFile(path.resolve(dir, f), "utf8")));
  return bodies.join("\n");
}

function stageSection(body, n) {
  const re = new RegExp(`##\\s*Stage ${n}[\\s\\S]*?(?=\\n## )`, "i");
  return body.match(re)?.[0] ?? null;
}

describe("review-to-pr skill contract", () => {
  describe("ticket 01 — scaffold, invocation surface, and trigger policy", () => {
    it("exists in the canonical and mirror locations with valid frontmatter", async () => {
      for (const file of skillFiles) {
        await fileExists(file);
        const meta = parseFrontmatter(await readFile(file, "utf8"));
        assert.equal(meta.name, "review-to-pr");
        assert.ok(
          meta.description && meta.description.length >= 80,
          "description must be at least 80 characters",
        );
        assert.equal(meta["disable-model-invocation"], "true");
      }
    });

    it("names the full span in its description", async () => {
      const meta = parseFrontmatter(await readFile(skillFiles[0], "utf8"));
      for (const beat of [/review/i, /blocker/i, /scrutin/i, /suite/i, /PR|handoff/i]) {
        assert.match(meta.description, beat);
      }
    });

    it("keeps the canonical and mirror SKILL.md byte-identical", async () => {
      const [canonical, mirror] = await Promise.all(
        skillFiles.map((file) => readFile(file, "utf8")),
      );
      assert.equal(canonical, mirror);
    });

    it("keeps every reference file byte-identical across the skill copies", async () => {
      for (const ref of SKILL_REFERENCES) {
        const [canonical, mirror] = await Promise.all(
          skillDirs.map((dir) => readFile(path.resolve(dir, `references/${ref}`), "utf8")),
        );
        assert.equal(canonical, mirror, `references/${ref} copies must match`);
      }
    });

    it("keeps every eval file byte-identical across the skill copies", async () => {
      for (const name of ["evals.json", "trigger-evals.json"]) {
        const [canonical, mirror] = await Promise.all(
          skillDirs.map((dir) => readFile(path.resolve(dir, `evals/${name}`), "utf8")),
        );
        assert.equal(canonical, mirror, `evals/${name} copies must match`);
      }
    });

    it("documents the invocation surface and the sub-commands", async () => {
      for (const file of skillFiles) {
        const content = await readFile(file, "utf8");
        assert.match(content, /\/review-to-pr \[<ref>\|<slug>\]/);
        assert.match(content, /\$review-to-pr/);
        assert.match(content, /\bcontinue\b/);
        assert.match(content, /\bstatus\b/);
        assert.match(content, /--agent/);
        assert.match(content, /--model/);
        assert.match(content, /explicit/i);
      }
    });

    it("carries no list sub-command in v1 (deferred follow-up)", async () => {
      for (const body of await bothSkillBodies()) {
        assert.doesNotMatch(body, /\/review-to-pr list\b/);
      }
    });

    it("presents the six-stage flow, Stage 0 through Stage 5", async () => {
      for (const content of await Promise.all(skillFiles.map((f) => readFile(f, "utf8")))) {
        for (const n of [0, 1, 2, 3, 4, 5]) {
          assert.match(content, new RegExp(`##\\s*Stage ${n}\\b`), `Stage ${n} heading present`);
        }
      }
    });

    it("states a run starts only on explicit human invocation", async () => {
      for (const body of await bothSkillBodies()) {
        assert.match(body, /explicit human invocation/i);
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
        assert.match(yaml, /\$review-to-pr/);
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

    it("SKILL.md links every reference file and names the standalone ADR", async () => {
      for (const file of skillFiles) {
        const c = await readFile(file, "utf8");
        for (const ref of SKILL_REFERENCES) {
          assert.match(c, new RegExp(`references/${ref}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        }
        assert.match(c, /docs\/decisions\/0006-review-to-pr-standalone\.md/);
      }
    });

    it("ships exactly the declared reference set, nothing extra", async () => {
      for (const dir of skillDirs) {
        const entries = (await readdir(path.resolve(dir, "references"))).sort();
        assert.deepEqual(entries, [...SKILL_REFERENCES].sort());
      }
    });

    it("publishes a bilingual human guide listing the reference set and the install command", async () => {
      const guide = await readFile(path.resolve("docs/skills/agents/review-to-pr.md"), "utf8");
      assert.match(guide, /^## ภาษาไทย \/ Thai\s*$/m);
      assert.match(guide, /^## English \/ ภาษาอังกฤษ\s*$/m);
      assert.match(guide, /npx skills add ArrayaWongsaita\/skills --skill review-to-pr/);
      for (const ref of SKILL_REFERENCES) {
        assert.match(guide, new RegExp(ref.replace(/\./g, "\\.")), `guide lists ${ref}`);
      }
    });

    it("the guide names the sibling skills it defers to", async () => {
      const guide = await readFile(path.resolve("docs/skills/agents/review-to-pr.md"), "utf8");
      for (const sibling of ["grill-to-tickets", "engineering-workflow", "subagent-implement", "agy-implement"]) {
        assert.match(guide, new RegExp(sibling));
      }
    });

    it("ships a bilingual ADR 0006 recording the standalone §8–9 split", async () => {
      const adr = await readFile(path.resolve("docs/decisions/0006-review-to-pr-standalone.md"), "utf8");
      assert.match(adr, /^# ADR 0006:/m);
      assert.match(adr, /^## Status/m);
      assert.match(adr, /^## Context/m);
      assert.match(adr, /^## Decision/m);
      assert.match(adr, /^## Consequences/m);
      assert.match(adr, /บริบท/, "each section carries a Thai line");
      assert.match(adr, /engineering-workflow/);
      assert.match(adr, /§8[–-]9|feature-flow §8|8[–-]9/);
      assert.match(adr, /standalone/i);
      assert.match(adr, /own(s)? (its )?(own )?(copy|machinery)/i);
    });
  });
});
