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

  describe("ticket 02 — Stage 0 Plan (read-only)", () => {
    it("keeps every reference file byte-identical across the skill copies", async () => {
      const refs = ["references/planning.md"];
      for (const ref of refs) {
        const [canonical, mirror] = await Promise.all(
          skillDirs.map((dir) => readFile(path.resolve(dir, ref), "utf8")),
        );
        assert.equal(canonical, mirror, `${ref} copies must match`);
      }
    });

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
        assert.match(stage0[0], /read-only|no source|without (writing|touching)/i);
      }
    });

    it("planning.md specifies parsing, DAG validation, waves, touch-sets, and seam selection", async () => {
      for (const dir of skillDirs) {
        const planning = await readFile(path.resolve(dir, "references/planning.md"), "utf8");
        assert.match(planning, /Blocked by/i, "names the ticket blocker field");
        assert.match(planning, /acyclic|cycle/i);
        assert.match(planning, /topological|numbering/i);
        assert.match(planning, /wave/i);
        assert.match(planning, /touch-set/i);
        assert.match(planning, /likely-overlapping — consider serializing/);
        assert.match(planning, /cross-cutting/i);
        assert.match(planning, /router|lockfile|migrations|package\.json/i);
        assert.match(planning, /test seam/i);
        assert.match(planning, /Testing Decisions/);
      }
    });

    it("the Plan lists wave, touch-set, disposition+reason, overlap flags, seam, retry budget — and no model column", async () => {
      for (const dir of skillDirs) {
        const planning = await readFile(path.resolve(dir, "references/planning.md"), "utf8");
        const skill = await readFile(path.resolve(dir, "SKILL.md"), "utf8");
        const both = `${planning}\n${skill}`;
        assert.match(both, /wave/i);
        assert.match(both, /touch-set/i);
        assert.match(both, /serial|parallel/i);
        assert.match(both, /overlap/i);
        assert.match(both, /seam/i);
        assert.match(both, /retry budget|retry budgets/i);
        assert.match(planning, /no model column|model is not|without a model/i);
      }
    });

    it("rejects a malformed ticket set naming the specific broken ticket, before other work", async () => {
      for (const dir of skillDirs) {
        const planning = await readFile(path.resolve(dir, "references/planning.md"), "utf8");
        assert.match(planning, /cycle[\s\S]{0,200}(name|report|identif)/i);
        assert.match(planning, /missing blocker|unresolvable|blocker.*(exist|resolve)/i);
        assert.match(planning, /halt|stop/i);
      }
    });

    it("resolves the target from an explicit dir, a slug, or the most recent issues dir", async () => {
      for (const body of await bothSkillBodies()) {
        assert.match(body, /most recent(ly modified)?\s+`?\.scratch\/\*\/issues\/`?/i);
        assert.match(body, /nam(e|ed) (it )?back|confirm/i);
      }
    });
  });

  describe("ticket 03 — single-ticket execution", () => {
    const refs = [
      "references/agy-contract.md",
      "references/prompt-scaffold.md",
      "references/worktree-integration.md",
      "references/qwen-agent-skill.md",
    ];

    it("ships the execution references byte-identical across the skill copies", async () => {
      for (const ref of refs) {
        const [canonical, mirror] = await Promise.all(
          skillDirs.map((dir) => readFile(path.resolve(dir, ref), "utf8")),
        );
        assert.equal(canonical, mirror, `${ref} copies must match`);
      }
    });

    it("SKILL.md links every execution reference and has a Verification gate section", async () => {
      for (const file of skillFiles) {
        const content = await readFile(file, "utf8");
        for (const ref of refs) {
          assert.match(content, new RegExp(ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        }
        assert.match(content, /##\s*Stage 1/i);
        assert.match(content, /Verification gate/i);
      }
    });

    it("agy-contract.md documents the invocation flags and the result envelope", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/agy-contract.md"), "utf8");
        for (const flag of ["-p", "--add-dir", "--output-format json", "--print-timeout", "--disable-slash-commands"]) {
          assert.match(c, new RegExp(flag.replace(/[-/]/g, "\\$&")));
        }
        assert.match(c, /--sandbox|accept-edits|--dangerously-skip-permissions/);
        assert.match(c, /conversation_id/);
        assert.match(c, /usage/);
        assert.match(c, /provisional/i, "failure/timeout status tokens marked provisional");
        assert.match(c, /probe 1|validation probe/i);
      }
    });

    it("prompt-scaffold.md carries the full red-green-refactor protocol and the worker constraints", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/prompt-scaffold.md"), "utf8");
        assert.match(c, /working directory/i);
        assert.match(c, /What to build/);
        assert.match(c, /acceptance criteria/i);
        assert.match(c, /test seam/i);
        assert.match(c, /red.*green.*refactor|failing test first/is);
        assert.match(c, /package install/i);
        assert.match(c, /push[\s\S]{0,40}pull request|open a PR|without push/i);
        assert.match(c, /missing decision|stop and report/i);
        assert.match(c, /test.*criterion|criterion.*table/i);
      }
    });

    it("worktree-integration.md specifies the serial worktree lifecycle and the squash-merge", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/worktree-integration.md"), "utf8");
        assert.match(c, /worktree/i);
        assert.match(c, /worker branch/i);
        assert.match(c, /integration (branch|HEAD)/i);
        assert.match(c, /symlink/i);
        assert.match(c, /package install/i);
        assert.match(c, /squash/i);
        assert.match(c, /ticket-number order|ascending ticket/i);
        assert.match(c, /checkbox|acceptance check/i);
      }
    });

    it("the verification gate reproduces red itself and defines the failure kinds", async () => {
      for (const body of await bothSkillBodies()) {
        const gate = body.match(/###\s*Verification gate[\s\S]*?(?=\n###?\s)/i);
        assert.ok(gate, "Verification gate section present");
        const g = gate[0];
        assert.match(g, /reproduce.*red|red state/i);
        assert.match(g, /only the (ticket's )?test files|test files applied/i);
        assert.match(g, /vacuous|tautolog/i);
        assert.match(g, /criteri/i);
        assert.match(g, /typecheck/i);
      }
    });

    it("defines the ticket retry budget, BLOCKED status, and a separate failover budget", async () => {
      for (const dir of skillDirs) {
        const both = (await Promise.all([
          readFile(path.resolve(dir, "SKILL.md"), "utf8"),
          readFile(path.resolve(dir, "references/agy-contract.md"), "utf8"),
        ])).join("\n");
        assert.match(both, /MAX_TICKET_ATTEMPTS\s*=\s*3|three attempts|up to 3/i);
        assert.match(both, /--conversation/);
        assert.match(both, /BLOCKED \(TICKET_VERIFICATION_FAILED\)/);
        assert.match(both, /worktree.*kept|kept.*inspection/i);
        assert.match(both, /MAX_FAILOVER_ATTEMPTS\s*=\s*3|separate (failover )?budget/i);
        assert.match(both, /Failover/);
      }
    });

    it("keeps the orchestrator out of ticket implementation", async () => {
      for (const body of await bothSkillBodies()) {
        assert.match(body, /orchestrator[\s\S]{0,240}(mechanical|conflict)/i);
        assert.match(body, /dispatches every ticket/i);
      }
    });
  });
});
