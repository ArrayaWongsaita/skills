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

  describe("ticket 02 — Stage 0, pin the review point", () => {
    it("SKILL.md drives references/review-point.md from a read-only Stage 0 section", async () => {
      for (const file of skillFiles) {
        const content = await readFile(file, "utf8");
        assert.match(content, /##\s*Stage 0[^\n]*review point/i);
        assert.match(content, /references\/review-point\.md/);
      }
      for (const body of await bothSkillBodies()) {
        const s = stageSection(body, 0);
        assert.ok(s, "Stage 0 section present");
        assert.match(s, /read-only/i);
        assert.match(s, /\.scratch\/<feature-slug>\//);
        assert.match(s, /mutates nothing|writes only|nothing else/i);
        assert.match(s, /approv/i);
      }
    });

    it("review-point.md specifies the preflight — clean tree, dirty stops and asks, no stash, main resolves", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/review-point.md"), "utf8");
        assert.match(c, /preflight/i);
        assert.match(c, /clean working tree|working tree is clean/i);
        assert.match(c, /dirty|uncommitted/i);
        assert.match(c, /stash/i, "names stashing explicitly to rule it out");
        assert.match(c, /stops|asks/i);
        assert.match(c, /`?main`? resolves|rev-parse --verify main/i);
      }
    });

    it("review-point.md specifies both review-point resolution paths", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/review-point.md"), "utf8");
        assert.match(c, /git rev-parse --verify/);
        assert.match(c, /git merge-base main HEAD/);
        assert.match(c, /pin(ned)? .* (whole|entire) run|pin it .* run/i);
      }
    });

    it("review-point.md names the two halt conditions", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/review-point.md"), "utf8");
        assert.match(c, /unresolvable ref|resolves as neither/i);
        assert.match(c, /git diff <review-point>\.\.\.HEAD` is empty|empty .* nothing to review/i);
        assert.match(c, /halt|stop/i);
      }
    });

    it("review-point.md specifies feature-slug resolution in order", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/review-point.md"), "utf8");
        assert.match(c, /explicit `?<slug>`? argument/i);
        assert.match(c, /branch-name stem|segment after the last `?\/`?/i);
        assert.match(c, /subagent-implement\/wishlist-sync.*wishlist-sync/i);
        assert.match(c, /most recently modified `?\.scratch\/\*\/`? director/i);
        assert.match(c, /named back[\s\S]*?confirm/i);
      }
    });

    it("review-point.md specifies the spec source and the degraded mode", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/review-point.md"), "utf8");
        assert.match(c, /spec\.md.*issues\//is);
        assert.match(c, /commit messages? alone/i);
        assert.match(c, /degraded/i);
        assert.match(c, /commit-messages/);
        assert.match(c, /handoff (states|records)/i);
      }
    });

    it("review-point.md handles an argument that is both a ref and a slug", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/review-point.md"), "utf8");
        assert.match(c, /both a ref and a slug/i);
        assert.match(c, /review-point override/i);
        assert.match(c, /slug[\s\S]*?falls back[\s\S]*?branch-name stem/i);
      }
    });

    it("review-point.md defines the initial review-status.md field set and the pause", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/review-point.md"), "utf8");
        for (const field of ["review_point", "feature_slug", "integration_branch", "spec_source", "stage"]) {
          assert.match(c, new RegExp(field.replace(/_/g, "[_ ]")), `review-status.md records ${field}`);
        }
        assert.match(c, /commit count|rev-list --count/i);
        assert.match(c, /file count|diff --stat/i);
        assert.match(c, /explicit approval/i);
      }
    });
  });

  describe("ticket 03 — Stage 1, the two-axis code-review loop", () => {
    it("SKILL.md drives references/review-loop.md from a Stage 1 section that routes on the result", async () => {
      for (const file of skillFiles) {
        const content = await readFile(file, "utf8");
        assert.match(content, /##\s*Stage 1/i);
        assert.match(content, /references\/review-loop\.md/);
      }
      for (const body of await bothSkillBodies()) {
        const s = stageSection(body, 1);
        assert.ok(s, "Stage 1 section present");
        assert.match(s, /code-review/i);
        assert.match(s, /blocker[\s\S]*?Stage 2/i);
        assert.match(s, /none[\s\S]*?Stage 3|Stage 3/i);
      }
    });

    it("review-loop.md specifies the inline two-axis call reported side by side", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/review-loop.md"), "utf8");
        assert.match(c, /inline/i);
        assert.match(c, /Standards axis/);
        assert.match(c, /Spec axis/);
        assert.match(c, /parallel sub-agents?/i);
        assert.match(c, /side by side/i);
        assert.match(c, /rerank/i);
        assert.match(c, /merge/i);
        assert.match(c, /<review-point>\.\.\.HEAD/);
      }
    });

    it("review-loop.md carries the gates.md blocking rule and the carried non-blocking case", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/review-loop.md"), "utf8");
        assert.match(c, /gates\.md/);
        assert.match(c, /Code normalization/i);
        assert.match(c, /spec mismatch/i);
        assert.match(c, /missing or wrong behaviour/i);
        assert.match(c, /regression risk with no covering test/i);
        assert.match(c, /documented-standard violation with a concrete consequence/i);
        assert.match(c, /style preference/i);
        assert.match(c, /carried[\s\S]*?not fixed|not fixed/i);
        assert.match(c, /Standards axis only[\s\S]*?Spec axis only|either axis/i);
      }
    });

    it("review-loop.md defines the findings ledger fields", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/review-loop.md"), "utf8");
        assert.match(c, /findings/);
        assert.match(c, /`id`|stable identit/i);
        assert.match(c, /`axis`|standards.*spec/i);
        assert.match(c, /open.*resolved.*stalled.*unfixable/is);
        assert.match(c, /`cluster`/);
      }
    });

    it("review-loop.md specifies the three-cycle ceiling and the no-progress early stop", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/review-loop.md"), "utf8");
        assert.match(c, /one completed two-axis review consumes one (code )?cycle/i);
        assert.match(c, /editing between reviews[\s\S]*?consumes no cycle/i);
        assert.match(c, /ceiling is three cycles|three cycles/i);
        assert.match(c, /code_cycles/);
        assert.match(c, /no-progress/i);
        assert.match(c, /resolves[\s\S]{0,12}blocker[\s\S]{0,40}nothing new/i);
        assert.match(c, /stalled/);
      }
    });
  });
});
