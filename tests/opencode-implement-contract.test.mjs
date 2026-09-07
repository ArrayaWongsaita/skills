import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

// The reference set SKILL.md links, the guide's Related files list, and the
// references/ directory must agree. One source of truth for the three checks.
const SKILL_REFERENCES = [
  "planning.md",
  "worker-contract.md",
  "prompt-scaffold.md",
  "decomposition.md",
  "fallback.md",
  "worktree-integration.md",
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

const canonicalDir = "skills/agents/opencode-implement";
const mirrorDir = ".agents/skills/opencode-implement";
const skillDirs = [canonicalDir, mirrorDir];
const skillFiles = skillDirs.map((dir) => path.resolve(dir, "SKILL.md"));

async function bothSkillBodies() {
  return Promise.all(
    skillFiles.map(async (file) => (await readFile(file, "utf8")).replace(/^---\n[\s\S]*?\n---\n/, "")),
  );
}

describe("opencode-implement skill contract", () => {
  describe("scaffold and trigger policy", () => {
    it("exists in the canonical and mirror locations with valid frontmatter", async () => {
      for (const file of skillFiles) {
        await fileExists(file);
        const meta = parseFrontmatter(await readFile(file, "utf8"));
        assert.equal(meta.name, "opencode-implement");
        assert.ok(
          meta.description && meta.description.length >= 80,
          "description must be at least 80 characters",
        );
        assert.equal(meta["disable-model-invocation"], "true");
      }
    });

    it("names the full span in its description", async () => {
      const meta = parseFrontmatter(await readFile(skillFiles[0], "utf8"));
      for (const beat of [/ticket/i, /local/i, /opencode/i, /sub-step|decompos/i, /verif/i, /fall ?back/i, /integrat/i, /review/i]) {
        assert.match(meta.description, beat);
      }
    });

    it("keeps the canonical and mirror SKILL.md byte-identical", async () => {
      const [canonical, mirror] = await Promise.all(
        skillFiles.map((file) => readFile(file, "utf8")),
      );
      assert.equal(canonical, mirror);
    });

    it("documents the invocation surface, the sub-commands, and the run options", async () => {
      for (const file of skillFiles) {
        const content = await readFile(file, "utf8");
        assert.match(content, /\/opencode-implement <dir\|slug>/);
        assert.match(content, /\$opencode-implement/);
        assert.match(content, /\bcontinue\b/);
        assert.match(content, /\bstatus\b/);
        assert.match(content, /\blist\b/);
        assert.match(content, /explicit/i);
        assert.match(content, /--model/);
        assert.match(content, /ollama\/qwen3\.8:27b-mlx-32k/);
        assert.match(content, /--fallback-agent/);
        assert.match(content, /--no-fallback/);
      }
    });

    it("frames the skill as a slow serial local-first tool", async () => {
      for (const body of await bothSkillBodies()) {
        assert.match(body, /local/i);
        assert.match(body, /serial/i);
        assert.match(body, /background|hours-long|slow/i);
        assert.match(body, /parallelism is a non-goal|non-goal/i);
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
        assert.match(yaml, /\$opencode-implement/);
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

    it("names the standalone ADR", async () => {
      for (const file of skillFiles) {
        const c = await readFile(file, "utf8");
        assert.match(c, /docs\/decisions\/0007-opencode-implement-standalone\.md/);
      }
    });

    it("ships trigger-evals.json with positive and negative cases in both copies", async () => {
      for (const dir of skillDirs) {
        const triggers = JSON.parse(
          await readFile(path.resolve(dir, "evals/trigger-evals.json"), "utf8"),
        );
        assert.ok(Array.isArray(triggers) && triggers.length > 0);
        const decisions = new Set(triggers.map((t) => t.should_trigger));
        assert.ok(decisions.has(true) && decisions.has(false));
        assert.ok(
          triggers.some((t) => t.should_trigger === false && /implement this/i.test(t.query)),
          "has a negative case for a bare 'implement this'",
        );
        assert.ok(
          triggers.some((t) => t.should_trigger === false && /(agy-implement|subagent-implement)/i.test(t.query)),
          "has a negative case for a sibling skill",
        );
      }
    });

    it("publishes a bilingual human guide with the install command", async () => {
      const guide = await readFile(path.resolve("docs/skills/agents/opencode-implement.md"), "utf8");
      assert.match(guide, /^## ภาษาไทย \/ Thai\s*$/m);
      assert.match(guide, /^## English \/ ภาษาอังกฤษ\s*$/m);
      assert.match(guide, /npx skills add ArrayaWongsaita\/skills --skill opencode-implement/);
    });
  });

  describe("Stage 0 — Plan (read-only)", () => {
    it("SKILL.md drives references/planning.md from a Stage 0 section", async () => {
      for (const file of skillFiles) {
        const content = await readFile(file, "utf8");
        assert.match(content, /##\s*Stage 0[^\n]*Plan/i);
        assert.match(content, /references\/planning\.md/);
      }
    });

    it("Stage 0 pauses for explicit approval and mutates nothing outside .scratch", async () => {
      for (const body of await bothSkillBodies()) {
        const stage0 = body.match(/##\s*Stage 0[\s\S]*?(?=\n## )/i);
        assert.ok(stage0, "Stage 0 section present");
        assert.match(stage0[0], /approv/i);
        assert.match(stage0[0], /\.scratch\/<feature-slug>\//);
      }
    });

    it("planning.md specifies parsing, DAG validation, dependency order, and seam selection", async () => {
      for (const dir of skillDirs) {
        const planning = await readFile(path.resolve(dir, "references/planning.md"), "utf8");
        assert.match(planning, /Blocked by/i);
        assert.match(planning, /acyclic|cycle/i);
        assert.match(planning, /TICKET_SET_CYCLIC/);
        assert.match(planning, /TICKET_SET_MISSING_BLOCKER/);
        assert.match(planning, /TICKET_SET_NUMBERING/);
        assert.match(planning, /topological|numbering/i);
        assert.match(planning, /dependency order/i);
        assert.match(planning, /test seam/i);
        assert.match(planning, /Testing Decisions/);
        assert.match(planning, /halt/i);
      }
    });

    it("planning.md drops waves, touch-sets, and the model column", async () => {
      for (const dir of skillDirs) {
        const planning = await readFile(path.resolve(dir, "references/planning.md"), "utf8");
        assert.match(planning, /no wave|without a wave|no wave computation/i);
        assert.match(planning, /touch-set/i);
        assert.match(planning, /no model column/i);
        assert.match(planning, /non-goal/i);
      }
    });

    it("planning.md builds a criterion-level step plan per ticket with a budget and a split rule", async () => {
      for (const dir of skillDirs) {
        const planning = await readFile(path.resolve(dir, "references/planning.md"), "utf8");
        assert.match(planning, /step plan/i);
        assert.match(planning, /one acceptance criterion per sub-step|one criterion per sub-step/i);
        assert.match(planning, /one-sub-step chain|single criterion is a one-sub-step/i);
        assert.match(planning, /context budget/i);
        assert.match(planning, /~?13k/);
        assert.match(planning, /32k/);
        assert.match(planning, /split(s|ting)? (it )?finer|split finer/i);
        assert.match(planning, /over-split|bias/i);
        assert.match(planning, /file scope/i);
        assert.match(planning, /probe C/);
      }
    });

    it("planning.md predicts each ticket's path and handles --no-fallback", async () => {
      for (const dir of skillDirs) {
        const planning = await readFile(path.resolve(dir, "references/planning.md"), "utf8");
        assert.match(planning, /predict.*path|path.*predict/i);
        assert.match(planning, /`?local`?/);
        assert.match(planning, /subagent-fallback/);
        assert.match(planning, /TICKET_TOO_LARGE_FOR_CONTEXT/);
        assert.match(planning, /--no-fallback/);
      }
    });

    it("resolves the target from an explicit dir, a slug, or the most recent issues dir", async () => {
      for (const body of await bothSkillBodies()) {
        assert.match(body, /most recent(ly modified)?\s+`?\.scratch\/\*\/issues\/`?/i);
        assert.match(body, /nam(e|ed) (it )?back|confirm/i);
      }
    });
  });

  describe("standalone ADR 0007", () => {
    it("ships a bilingual ADR recording the standalone local-first sibling stance", async () => {
      const adr = await readFile(path.resolve("docs/decisions/0007-opencode-implement-standalone.md"), "utf8");
      assert.match(adr, /^# ADR 0007:/m);
      assert.match(adr, /## Status \/ สถานะ/);
      assert.match(adr, /## Context \/ บริบท/);
      assert.match(adr, /## Decision \/ การตัดสินใจ/);
      assert.match(adr, /## Consequences \/ ผลที่ตามมา/);
      assert.match(adr, /agy-implement/);
      assert.match(adr, /subagent-implement/);
      assert.match(adr, /standalone/i);
      assert.match(adr, /local/i);
      assert.match(adr, /own(s)? (its )?(own )?(copy|machinery)/i);
    });
  });
});
