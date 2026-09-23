import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, access, readdir, lstat, readlink } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const SKILL_REFERENCES = [
  "miss-sources.md",
  "classification.md",
  "retro-report.md",
  "apply-and-handoff.md",
  "retro-log.md",
  "skill-fix-routing.md",
  "transcript-mode.md",
  "resume.md",
];

const FIXTURE_FILES = [
  "review-status.md",
  "status.md",
  "reports/03.md",
  "design-review.md",
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

const canonicalDir = "skills/agents/retro-to-remedies";
const mirrorDir = ".agents/skills/retro-to-remedies";
const symlinkPath = ".claude/skills/retro-to-remedies";
const skillDirs = [canonicalDir, mirrorDir];
const skillFiles = skillDirs.map((dir) => path.resolve(dir, "SKILL.md"));

async function bothSkillBodies() {
  return Promise.all(
    skillFiles.map(async (file) => (await readFile(file, "utf8")).replace(/^---\n[\s\S]*?\n---\n/, "")),
  );
}

async function walkDirectory(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkDirectory(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

describe("retro-to-remedies skill contract", () => {
  describe("ticket 01 — scaffold, invocation surface, and trigger policy", () => {
    it("exists in the canonical and mirror locations with valid frontmatter", async () => {
      for (const file of skillFiles) {
        await fileExists(file);
        const raw = await readFile(file, "utf8");
        const meta = parseFrontmatter(raw);
        assert.equal(meta.name, "retro-to-remedies");
        assert.ok(
          meta.description && meta.description.length >= 80,
          "description must be at least 80 characters",
        );
        assert.doesNotMatch(meta.description, /\n/, "description must be a single line");
        assert.equal(meta["disable-model-invocation"], "true");
      }
    });

    it("keeps the canonical and mirror directories byte-identical", async () => {
      const canonicalFiles = (await walkDirectory(path.resolve(canonicalDir)))
        .map((f) => path.relative(path.resolve(canonicalDir), f))
        .sort();
      const mirrorFiles = (await walkDirectory(path.resolve(mirrorDir)))
        .map((f) => path.relative(path.resolve(mirrorDir), f))
        .sort();

      assert.deepEqual(mirrorFiles, canonicalFiles, "canonical and mirror directory trees must match");

      for (const rel of canonicalFiles) {
        const [cBytes, mBytes] = await Promise.all([
          readFile(path.resolve(canonicalDir, rel)),
          readFile(path.resolve(mirrorDir, rel)),
        ]);
        assert.ok(cBytes.equals(mBytes), `file ${rel} must be byte-identical between canonical and mirror`);
      }
    });

    it("has .claude/skills/retro-to-remedies as a symlink to ../../.agents/skills/retro-to-remedies", async () => {
      const stat = await lstat(path.resolve(symlinkPath));
      assert.ok(stat.isSymbolicLink(), `${symlinkPath} must be a symbolic link`);
      const linkTarget = await readlink(path.resolve(symlinkPath));
      assert.equal(linkTarget, "../../.agents/skills/retro-to-remedies");
    });

    it("ships Codex metadata blocking implicit invocation in both copies", async () => {
      for (const dir of skillDirs) {
        const yaml = await readFile(path.resolve(dir, "agents/openai.yaml"), "utf8");
        assert.match(yaml, /display_name:/);
        assert.match(yaml, /short_description:/);
        assert.match(yaml, /\$retro-to-remedies/);
        assert.match(yaml, /allow_implicit_invocation:\s*false/);
      }
    });

    it("documents the invocation surface and the slug resolution order", async () => {
      for (const body of await bothSkillBodies()) {
        assert.match(body, /\/retro-to-remedies\s+\[<feature-slug>\]\s+\[--transcript\]\s+\[--fresh\]/);
        assert.match(body, /\$retro-to-remedies/);
        assert.match(body, /argument\b/i);
        assert.match(body, /integration branch/i);
        assert.match(body, /\.scratch/i);
        assert.match(body, /confirmation|named back/i);
      }
    });

    it("refuses to run on protected branches before reading any source", async () => {
      for (const body of await bothSkillBodies()) {
        assert.match(body, /\bmain\b/);
        assert.match(body, /\bmaster\b/);
        assert.match(body, /\bdev\b/);
        assert.match(body, /branch to create|create a branch/i);
      }
    });

    it("provides the Stage 0, Stage 1, Stage 2, and handoff overview with pause after Stage 1", async () => {
      for (const body of await bothSkillBodies()) {
        assert.match(body, /Stage 0/i);
        assert.match(body, /Stage 1/i);
        assert.match(body, /Stage 2/i);
        assert.match(body, /handoff/i);
        assert.match(body, /pause/i);
      }
    });

    it("links every reference file and all local links resolve inside the skill directory", async () => {
      for (const dir of skillDirs) {
        const content = await readFile(path.resolve(dir, "SKILL.md"), "utf8");
        for (const ref of SKILL_REFERENCES) {
          assert.match(content, new RegExp(`references/${ref}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        }
        for (const link of localSkillLinks(content)) {
          await fileExists(path.resolve(dir, link.split("#")[0]));
        }
      }
    });

    it("ships exactly the declared reference set, each as a non-empty stub", async () => {
      for (const dir of skillDirs) {
        const entries = (await readdir(path.resolve(dir, "references"))).sort();
        assert.deepEqual(entries, [...SKILL_REFERENCES].sort());
        for (const ref of SKILL_REFERENCES) {
          const text = await readFile(path.resolve(dir, "references", ref), "utf8");
          assert.ok(text.trim().length > 20, `reference ${ref} must contain content`);
        }
      }
    });

    it("steers positively — no 'Never' or 'Do not' in the instruction body", async () => {
      for (const body of await bothSkillBodies()) {
        assert.doesNotMatch(body, /\bNever\b/i, "prompt the positive instead of 'Never'");
        assert.doesNotMatch(body, /\bDo not\b/i, "prompt the positive instead of 'Do not'");
        assert.doesNotMatch(body, /\bDon't\b/i, "prompt the positive instead of 'Don't'");
      }
    });

    it("ships the fixture Run with every absolute home path and username redacted", async () => {
      for (const dir of skillDirs) {
        const fixtureDir = path.resolve(dir, "evals/fixtures/opencode-implement-hosted-model");
        for (const file of FIXTURE_FILES) {
          const filePath = path.resolve(fixtureDir, file);
          await fileExists(filePath);
          const content = await readFile(filePath, "utf8");
          assert.doesNotMatch(
            content,
            /\/Users\/[a-zA-Z0-9_-]+/i,
            `${file} must not contain /Users/<username> absolute paths`,
          );
          assert.doesNotMatch(
            content,
            /\/home\/[a-zA-Z0-9_-]+/i,
            `${file} must not contain /home/<username> absolute paths`,
          );
        }
      }
    });

    it("publishes bilingual docs and guides describing purpose, chain location, and invocation", async () => {
      const skillDoc = await readFile(path.resolve("docs/skills/agents/retro-to-remedies.md"), "utf8");
      assert.match(skillDoc, /^## ภาษาไทย \/ Thai\s*$/m);
      assert.match(skillDoc, /^## English \/ ภาษาอังกฤษ\s*$/m);
      assert.match(skillDoc, /review-to-pr/);
      assert.match(skillDoc, /pr-to-dev/);
      assert.match(skillDoc, /\/retro-to-remedies/);
      assert.match(skillDoc, /npx skills add ArrayaWongsaita\/skills --skill retro-to-remedies/);

      const guideDoc = await readFile(path.resolve("docs/guides/retro-to-remedies.md"), "utf8");
      assert.match(guideDoc, /review-to-pr/);
      assert.match(guideDoc, /pr-to-dev/);
      assert.match(guideDoc, /\/retro-to-remedies/);
    });

    it("records ADR 0010 and adds domain glossary entries", async () => {
      const adr = await readFile(path.resolve("docs/decisions/0010-retro-to-remedies-standalone.md"), "utf8");
      assert.match(adr, /retro-to-remedies/);
      assert.match(adr, /review-to-pr/);
      assert.match(adr, /pr-to-dev/);
      assert.match(adr, /0001/);
      assert.match(adr, /0002/);
      assert.match(adr, /0003/);
      assert.match(adr, /0004/);

      const glossary = await readFile(path.resolve("docs/glossary.md"), "utf8");
      assert.match(glossary, /\|\s*Retro\s*\|/);
      assert.match(glossary, /\|\s*Miss\s*\|/);
      assert.match(glossary, /\|\s*Remedy\s*\|/);
      assert.match(glossary, /\|\s*Retro Log\s*\|/);
    });
  });

  describe("ticket 02 — Stage 0, collect Misses", () => {
    it("references/miss-sources.md lists, per source, what counts as a Miss", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/miss-sources.md"), "utf8");

        // review-status.md
        assert.match(c, /review-status\.md/);
        assert.match(c, /blocking finding/i);
        assert.match(c, /carried finding/i);
        assert.match(c, /open/i);
        assert.match(c, /non-blocking/i);
        assert.match(c, /unfixable/i);
        assert.match(c, /stalled/i);
        assert.match(c, /budget/i);

        // implementer status.md
        assert.match(c, /status\.md/);
        assert.match(c, /more than one attempt|retry|attempts/i);
        assert.match(c, /BLOCKED/);
        assert.match(c, /lesson/i);
        assert.match(c, /notes/i);

        // implementer reports or logs
        assert.match(c, /reports\/<NN>\.md|reports\/\*|reports/);
        assert.match(c, /logs\/<NN>\.json|logs\/\*|logs/);
        assert.match(c, /verification failure/i);
        assert.match(c, /reason/i);

        // design-review.md
        assert.match(c, /design-review\.md/);
        assert.match(c, /SHIP/);
        assert.match(c, /REWORK/);

        // git
        assert.match(c, /git\b/i);
        assert.match(c, /fix\(review\):/);
        assert.match(c, /revert/i);
        assert.match(c, /review_point/);
        assert.match(c, /merge-base.*main|merge-base with `?main`?/i);
      }
    });

    it("states that every Miss carries its location (file plus id, line, or SHA) and a verbatim quote, and run-state files are read, never edited", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/miss-sources.md"), "utf8");
        assert.match(c, /location/i);
        assert.match(c, /file/i);
        assert.match(c, /id/i);
        assert.match(c, /line/i);
        assert.match(c, /sha/i);
        assert.match(c, /verbatim quote/i);
        assert.match(c, /read/i);
        assert.match(c, /never edit|never edited|edits? none|read-only/i);
      }
    });

    it("SKILL.md's ## Stage 0 section drives the reference and ends on its completion criterion", async () => {
      for (const file of skillFiles) {
        const content = await readFile(file, "utf8");
        assert.match(content, /##\s*Stage 0/i);
        assert.match(content, /references\/miss-sources\.md/);
      }
      for (const body of await bothSkillBodies()) {
        const stage0Match = body.match(/###?\s*Stage 0[\s\S]*?(?=###?\s*Stage 1|$)/i);
        assert.ok(stage0Match, "Stage 0 section must be present");
        const stage0Text = stage0Match[0];
        assert.match(stage0Text, /completion/i);
        assert.match(stage0Text, /every present source read|every Primary source present has been read/i);
        assert.match(stage0Text, /location/i);
        assert.match(stage0Text, /quote/i);
      }
    });

    it("lists missing expected sources for report's opening section and asks before reading transcript when no .scratch/<feature-slug>/", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/miss-sources.md"), "utf8");
        assert.match(c, /missing expected sources|missing sources/i);
        assert.match(c, /report.*opening|opening section/i);
        assert.match(c, /no `?\.scratch(\/<feature-slug>\/)?`?/i);
        assert.match(c, /ask/i);
        assert.match(c, /transcript/i);
      }
      for (const body of await bothSkillBodies()) {
        const stage0Match = body.match(/###?\s*Stage 0[\s\S]*?(?=###?\s*Stage 1|$)/i);
        assert.ok(stage0Match);
        const stage0Text = stage0Match[0];
        assert.match(stage0Text, /missing/i);
        assert.match(stage0Text, /ask/i);
        assert.match(stage0Text, /transcript/i);
      }
    });

    it("both guides describe what Stage 0 reads", async () => {
      const skillDoc = await readFile(path.resolve("docs/skills/agents/retro-to-remedies.md"), "utf8");
      assert.match(skillDoc, /Stage 0/i);
      assert.match(skillDoc, /review-status\.md/);
      assert.match(skillDoc, /status\.md/);
      assert.match(skillDoc, /reports|logs/);
      assert.match(skillDoc, /design-review\.md/);
      assert.match(skillDoc, /git/i);

      const guideDoc = await readFile(path.resolve("docs/guides/retro-to-remedies.md"), "utf8");
      assert.match(guideDoc, /Stage 0/i);
      assert.match(guideDoc, /review-status\.md/);
      assert.match(guideDoc, /status\.md/);
      assert.match(guideDoc, /reports|logs/);
      assert.match(guideDoc, /design-review\.md/);
      assert.match(guideDoc, /git/i);
    });
  });

  describe("ticket 03 — Stage 1, classify, rank, and report", () => {
    it("references/classification.md states the six Remedy kinds and the ordered rule", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/classification.md"), "utf8");

        // 6 kinds
        assert.match(c, /\bCheck\b/);
        assert.match(c, /\bStandard\b/);
        assert.match(c, /\bPointer\b/);
        assert.match(c, /\bSkill fix\b/);
        assert.match(c, /\bPrune\b/);
        assert.match(c, /\bAccess\b/);

        // Ordered rule:
        // (1) following a skill's instructions as written produced the Miss, because they are wrong or outdated -> Skill fix,
        // while an agent that departed from correct instructions falls to the rules below
        assert.match(c, /following a skill's instructions as written[\s\S]*?produced the Miss[\s\S]*?wrong or outdated[\s\S]*?Skill fix/i);
        assert.match(c, /departed from correct instructions/i);

        // (2) Mechanical miss -> Check
        assert.match(c, /Mechanical miss[\s\S]*?Check|Check[\s\S]*?Mechanical miss/i);

        // (3) Judgement miss -> Standard, or a Reuse Catalog Rule for a reuse convention
        assert.match(c, /Judgement miss[\s\S]*?Standard/i);
        assert.match(c, /Reuse Catalog.*Rule.*reuse convention|reuse convention.*Reuse Catalog.*Rule/i);

        // (4) navigation effort -> Pointer
        assert.match(c, /navigation.*Pointer|Pointer.*navigation/i);

        // (5) unreachable information -> Access
        assert.match(c, /unreachable information.*Access|Access.*unreachable information|information.*could not reach.*Access|Access.*information.*could not reach/i);

        // (6) a project instruction with no effect or gone stale -> Prune
        assert.match(c, /no effect or.*gone stale.*Prune|Prune.*no effect or.*gone stale|stale.*Prune|Prune.*stale/i);
      }
    });

    it("holds the Destinations table from the spec, with Prune limited and Text vs Code split", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/classification.md"), "utf8");

        // Destinations table
        assert.match(c, /\|.*Remedy kind.*\|.*Destination.*\|/);
        assert.match(c, /\|.*Check.*\|.*handed off:.*(test|lint|hook|CI).*/i);
        assert.match(c, /\|.*Standard.*\|.*CODING_STANDARDS\.md.*Reuse Catalog.*Rule.*/i);
        assert.match(c, /\|.*Pointer.*\|.*AGENTS\.md.*CLAUDE\.md.*/i);
        assert.match(c, /\|.*Skill fix.*\|.*handed off:.*\/grill-to-tickets.*Upstream feedback.*/i);
        assert.match(c, /\|.*Prune.*\|.*AGENTS\.md.*CLAUDE\.md.*CODING_STANDARDS\.md.*Reuse Catalog.*/i);
        assert.match(c, /\|.*Access.*\|.*handed off:.*config.*tooling.*/i);

        // Prune limitation
        assert.match(c, /an instruction inside a skill is a Skill fix/i);

        // Text remedy (Standard, Pointer, Prune) versus Code remedy (Check, Skill fix, Access)
        assert.match(c, /Text remed(y|ies)[\s\S]*?(Standard|Pointer|Prune)/i);
        assert.match(c, /Code remed(y|ies)[\s\S]*?(Check|Skill fix|Access)/i);
      }
    });

    it("states the evidence bar, merge of same-cause Misses, cost ranking, Carried findings, and Open bugs", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/classification.md"), "utf8");

        // Evidence bar: at least one located, quoted Primary source per Remedy; none -> dropped
        assert.match(c, /at least one located, quoted Primary source/i);
        assert.match(c, /without evidence.*dropped|none.*dropped/i);

        // Merge same-cause Misses
        assert.match(c, /Merge Misses that share a cause into one Remedy|causes, not symptoms/i);

        // Cost ranking: blocker, BLOCKED, failed verification, no SHIP, then the rest
        assert.match(c, /blocker/i);
        assert.match(c, /BLOCKED/);
        assert.match(c, /failed verification/i);
        assert.match(c, /SHIP/);

        // Carried findings each mapped to a Remedy or a proposed decline
        assert.match(c, /Carried finding.*mapped to.*(Remedy|proposed decline)/i);

        // Open bugs reported for /diagnosing-bugs and never as Remedies
        assert.match(c, /Open bug.*\/diagnosing-bugs/i);
        assert.match(c, /never.*Remed(y|ies)|not.*Remed(y|ies)/i);
      }
    });

    it("references/retro-report.md defines sections in order, remedy fields, and choice validity", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/retro-report.md"), "utf8");

        // Sections in order:
        // 1. sources read and missing
        // 2. handed-off follow-ups (and their answers)
        // 3. project Remedies
        // 4. Skill fixes
        // 5. Carried findings
        // 6. Open bugs
        assert.match(c, /sources read and missing/i);
        assert.match(c, /handed-off follow-ups/i);
        assert.match(c, /project Remedies/i);
        assert.match(c, /Skill fixes/i);
        assert.match(c, /Carried findings/i);
        assert.match(c, /Open bugs/i);

        // Each Remedy's fields:
        // id, kind, severity reason, Misses with location and quote, destination, exact change or /grill-to-tickets prompt, recommended answer, Choice: line
        assert.match(c, /\bid\b/i);
        assert.match(c, /\bkind\b/i);
        assert.match(c, /severity reason/i);
        assert.match(c, /location.*quote|quote.*location/i);
        assert.match(c, /\bdestination\b/i);
        assert.match(c, /exact change[\s\S]*?\/grill-to-tickets prompt|\/grill-to-tickets prompt[\s\S]*?exact change/i);
        assert.match(c, /recommended answer/i);
        assert.match(c, /Choice:/);

        // Choice validity: apply is valid only for Text remedies and hand off only for Code remedies
        assert.match(c, /`?apply`? is valid only for Text remedies/i);
        assert.match(c, /`?hand off`? (is valid )?only for Code remedies/i);
      }
    });

    it("SKILL.md's ## Stage 1 section drives both references and ends on its completion criterion and pauses", async () => {
      for (const file of skillFiles) {
        const content = await readFile(file, "utf8");
        assert.match(content, /##\s*Stage 1/i);
        assert.match(content, /references\/classification\.md/);
        assert.match(content, /references\/retro-report\.md/);
      }
      for (const body of await bothSkillBodies()) {
        const stage1Match = body.match(/###?\s*Stage 1[\s\S]*?(?=###?\s*Stage 2|$)/i);
        assert.ok(stage1Match, "Stage 1 section must be present");
        const stage1Text = stage1Match[0];
        assert.match(stage1Text, /completion criterion|completion/i);
        assert.match(stage1Text, /every Miss (is )?covered by a Remedy, an Open bug, or a proposed decline/i);
        assert.match(stage1Text, /every Remedy (is )?complete|every Remedy has a kind/i);
        assert.match(stage1Text, /pause/i);
      }
    });

    it("both guides describe the report and the four answers", async () => {
      const skillDoc = await readFile(path.resolve("docs/skills/agents/retro-to-remedies.md"), "utf8");
      assert.match(skillDoc, /Stage 1/i);
      assert.match(skillDoc, /apply/);
      assert.match(skillDoc, /hand off/);
      assert.match(skillDoc, /decline/);
      assert.match(skillDoc, /defer/);
      assert.match(skillDoc, /retro\.md/);

      const guideDoc = await readFile(path.resolve("docs/guides/retro-to-remedies.md"), "utf8");
      assert.match(guideDoc, /Stage 1/i);
      assert.match(guideDoc, /apply/);
      assert.match(guideDoc, /hand off/);
      assert.match(guideDoc, /decline/);
      assert.match(guideDoc, /defer/);
      assert.match(guideDoc, /retro\.md/);
    });
  });

  describe("ticket 04 — Stage 2, apply Text remedies and hand off", () => {
    it("references/apply-and-handoff.md applies each destination (Standard, Pointer, Prune)", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/apply-and-handoff.md"), "utf8");

        // Standard into CODING_STANDARDS.md (created with short header when absent)
        assert.match(c, /CODING_STANDARDS\.md/);
        assert.match(c, /short header/i);
        assert.match(c, /created.*absent|when absent.*created|absent.*created/i);

        // Standard for reuse convention into Reuse Catalog's Rules
        assert.match(c, /reuse convention/i);
        assert.match(c, /Reuse Catalog.*Rule|Rules.*Reuse Catalog/i);

        // Pointer into AGENTS.md, else CLAUDE.md, else a new AGENTS.md
        assert.match(c, /Pointer/i);
        assert.match(c, /AGENTS\.md/);
        assert.match(c, /CLAUDE\.md/);
        assert.match(c, /AGENTS\.md.*else.*CLAUDE\.md.*else.*new.*AGENTS\.md|AGENTS\.md,?\s+else\s+CLAUDE\.md,?\s+else\s+a\s+new\s+AGENTS\.md/i);

        // Prune removed from the project instruction file holding it
        assert.match(c, /Prune/i);
        assert.match(c, /removed from the project instruction file holding it/i);
      }
    });

    it("specifies one chore(retro): <remedy> commit per applied Remedy on the working branch and writes SHA into report", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/apply-and-handoff.md"), "utf8");
        assert.match(c, /chore\(retro\):\s*<remedy>/);
        assert.match(c, /working branch|integration branch|current branch/i);
        assert.match(c, /one.*commit|each applied remed(y|ies).*commit/i);
        assert.match(c, /SHA.*(is )?(written|recorded).*report|(written|recorded).*SHA.*report|report.*SHA/i);
      }
    });

    it("runs existing check scripts once and stops on red naming the failing command and preceding Retro commit", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/apply-and-handoff.md"), "utf8");
        assert.match(c, /validate/);
        assert.match(c, /check/);
        assert.match(c, /lint/);
        assert.match(c, /test/);
        assert.match(c, /once/i);
        assert.match(c, /red.*stop.*before.*handoff|red.*stops.*handoff/i);
        assert.match(c, /names? the failing command/i);
        assert.match(c, /Retro commit it follows/i);
      }
    });

    it("prints Code remedy prompts then /pr-to-dev, never pushes or opens PR, issue only on explicit request", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/apply-and-handoff.md"), "utf8");
        assert.match(c, /Code remed(y|ies).*prompt/i);
        assert.match(c, /\/pr-to-dev/);
        assert.match(c, /pushes nothing|no push|never push/i);
        assert.match(c, /opens no pull request|no PR/i);
        assert.match(c, /GitHub issue only on an explicit request|issue only on.*explicit request/i);
      }
    });

    it("SKILL.md's ## Stage 2 and ## Handoff sections drive the reference and end on their completion criteria", async () => {
      for (const file of skillFiles) {
        const content = await readFile(file, "utf8");
        assert.match(content, /##\s*Stage 2/i);
        assert.match(content, /##\s*Handoff/i);
        assert.match(content, /references\/apply-and-handoff\.md/);
      }
      for (const body of await bothSkillBodies()) {
        const stage2Match = body.match(/###?\s*Stage 2[\s\S]*?(?=###?\s*Handoff|$)/i);
        assert.ok(stage2Match, "Stage 2 section must be present");
        const stage2Text = stage2Match[0];
        assert.match(stage2Text, /completion criterion|completion/i);
        assert.match(stage2Text, /applied Text remed(y|ies).*commit/i);

        const handoffMatch = body.match(/###?\s*Handoff[\s\S]*?$/i);
        assert.ok(handoffMatch, "Handoff section must be present");
        const handoffText = handoffMatch[0];
        assert.match(handoffText, /completion criterion|completion/i);
        assert.match(handoffText, /Code remed(y|ies).*prompt/i);
        assert.match(handoffText, /\/pr-to-dev/);
      }
    });

    it("both guides describe what gets committed and what gets handed off", async () => {
      const skillDoc = await readFile(path.resolve("docs/skills/agents/retro-to-remedies.md"), "utf8");
      assert.match(skillDoc, /Stage 2/i);
      assert.match(skillDoc, /chore\(retro\):\s*<remedy>/);
      assert.match(skillDoc, /CODING_STANDARDS\.md/);
      assert.match(skillDoc, /AGENTS\.md/);
      assert.match(skillDoc, /\/pr-to-dev/);

      const guideDoc = await readFile(path.resolve("docs/guides/retro-to-remedies.md"), "utf8");
      assert.match(guideDoc, /Stage 2/i);
      assert.match(guideDoc, /chore\(retro\):\s*<remedy>/);
      assert.match(guideDoc, /CODING_STANDARDS\.md/);
      assert.match(guideDoc, /AGENTS\.md/);
      assert.match(guideDoc, /\/pr-to-dev/);
    });
  });

  describe("ticket 05 — Retro Log", () => {
    it("defines the self-describing header comment and that only a Retro reads the file", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/retro-log.md"), "utf8");
        // header comment
        assert.match(c, /header comment/i);
        assert.match(c, /entry format/i);
        assert.match(c, /Outcome states/i);
        assert.match(c, /id rule/i);
        // only a Retro reads the file; no Pointer to Retro Log in AGENTS.md / CLAUDE.md
        assert.match(c, /only a Retro reads the file|only the Retro reads/i);
        assert.match(c, /no Pointer.*(AGENTS\.md|CLAUDE\.md)|no Pointer to (the )?Retro Log/i);
      }
    });

    it("defines the block format from the spec: id · kind · outcome, Remedy:, Misses: lines, and History: lines", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/retro-log.md"), "utf8");
        assert.match(c, /###\s*<id>\s*·\s*<kind>\s*·\s*<outcome>/);
        assert.match(c, /Remedy:/);
        assert.match(c, /Misses:/);
        assert.match(c, /slug\s*·\s*source#location\s*·\s*date\s*·\s*"quote"/i);
        assert.match(c, /History:/);
      }
    });

    it("defines the id rule: R-<feature-slug>-<NN>, numbered within the Run, and never change", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/retro-log.md"), "utf8");
        assert.match(c, /R-<feature-slug>-<NN>/);
        assert.match(c, /numbered within the Run/i);
        assert.match(c, /never change/i);
      }
    });

    it("defines the four Outcomes and history updating rule", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/retro-log.md"), "utf8");
        // four outcomes
        assert.match(c, /\bapplied\b/);
        assert.match(c, /\bhanded-off\b/);
        assert.match(c, /\bdeclined\b/);
        assert.match(c, /\bdeferred\b/);
        // definition of applied
        assert.match(c, /applied[\s\S]*?(change is in place|confirmed done)/i);
        // heading and history update
        assert.match(c, /appends a History line/i);
        assert.match(c, /updates the heading/i);
      }
    });

    it("defines the two commit rules: applied Remedy in its own commit, other Outcomes in chore(retro): log <feature-slug>", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/retro-log.md"), "utf8");
        assert.match(c, /applied.*(same commit as its change|own commit)/i);
        assert.match(c, /chore\(retro\):\s*log\s*<feature-slug>/);
        assert.match(c, /handed-off.*declined.*deferred|every other Outcome/i);
      }
    });

    it("both guides describe the Retro Log", async () => {
      const skillDoc = await readFile(path.resolve("docs/skills/agents/retro-to-remedies.md"), "utf8");
      assert.match(skillDoc, /docs\/retro-log\.md/);
      assert.match(skillDoc, /R-<feature-slug>-<NN>/);
      assert.match(skillDoc, /applied/);
      assert.match(skillDoc, /handed-off/);
      assert.match(skillDoc, /declined/);
      assert.match(skillDoc, /deferred/);
      assert.match(skillDoc, /chore\(retro\):\s*log\s*<feature-slug>/);

      const guideDoc = await readFile(path.resolve("docs/guides/retro-to-remedies.md"), "utf8");
      assert.match(guideDoc, /docs\/retro-log\.md/);
      assert.match(guideDoc, /R-<feature-slug>-<NN>/);
      assert.match(guideDoc, /applied/);
      assert.match(guideDoc, /handed-off/);
      assert.match(guideDoc, /declined/);
      assert.match(guideDoc, /deferred/);
      assert.match(guideDoc, /chore\(retro\):\s*log\s*<feature-slug>/);
    });
  });

  describe("ticket 06 — Retro Log — read at Stages 0–1", () => {
    it("references/retro-log.md specifies the handed-off follow-up and its three answers mapped to Outcomes", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/retro-log.md"), "utf8");
        // handed-off follow-up
        assert.match(c, /handed-off/i);
        // done -> applied
        assert.match(c, /done[*\s]*(→|->|to|:\s*)[*\s]*`?applied`?/i);
        // still pending -> stays handed-off
        assert.match(c, /still pending[*\s]*(→|->|to|:\s*)[*\s]*(stays\s*)?`?handed-off`?/i);
        // drop -> declined
        assert.match(c, /drop[*\s]*(→|->|to|:\s*)[*\s]*`?declined`?/i);
      }
    });

    it("references/retro-log.md specifies the same-occurrence rule and recurrence definition", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/retro-log.md"), "utf8");
        // same-occurrence: a Miss whose slug and location the log already lists is the same occurrence, never a recurrence
        assert.match(c, /same occurrence.*never a recurrence|same occurrence/i);
        assert.match(c, /slug and location.*already lists|already lists.*slug and location/i);
        // recurrence: Miss from another Run, or from the same Run after the Remedy's commit
        assert.match(c, /recurrence.*(from another Run|after the Remedy's commit)/i);
      }
    });

    it("references/retro-log.md specifies Failed Remedy escalation and the declined rule", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/retro-log.md"), "utf8");
        // Failed Remedy escalation:
        // Standard -> Check where mechanical
        assert.match(c, /Standard[*\s]*(→|->|to)[*\s]*Check\s*(where\s*(the\s*rule\s*is\s*)?mechanical)?/i);
        // Pointer -> sharper wording, then inlined material
        assert.match(c, /Pointer[*\s]*(→|->|to)[*\s]*sharper wording,?\s*then inlined material/i);
        // Check or Skill fix -> follow-up of the same kind citing the recurrence
        assert.match(c, /(Check or Skill fix|Skill fix or Check)[*\s]*(→|->|to)[*\s]*(a\s*)?follow-up of the same kind citing the recurrence/i);

        // declined rule:
        // a declined Remedy returns only with a recurrence after the decline, showing both occurrences
        assert.match(c, /declined.*(returns|proposed again).*only with a recurrence after the decline.*both occurrences/i);
      }
    });

    it("references/classification.md ranks Failed Remedy, then recurring, then the cost ranking", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/classification.md"), "utf8");
        assert.match(c, /Failed Remedy.*recurring.*(costly|cost ranking)/is);
      }
    });

    it("SKILL.md's Stage 0 asks follow-ups before reading sources, and Stage 1 matches against log before classifying", async () => {
      for (const body of await bothSkillBodies()) {
        const stage0Match = body.match(/###?\s*Stage 0[\s\S]*?(?=###?\s*Stage 1|$)/i);
        assert.ok(stage0Match, "Stage 0 section must be present");
        const stage0Text = stage0Match[0];
        // asks follow-ups before reading sources
        assert.match(stage0Text, /ask.*handed-off.*(done|still pending|drop)[\s\S]*?read.*Primary source|follow-up[\s\S]*?Primary source/i);

        const stage1Match = body.match(/###?\s*Stage 1[\s\S]*?(?=###?\s*Stage 2|$)/i);
        assert.ok(stage1Match, "Stage 1 section must be present");
        const stage1Text = stage1Match[0];
        // matches against log before classifying
        assert.match(stage1Text, /match.*(against|with).*Retro Log[\s\S]*?classif/i);
      }
    });

    it("both guides describe how recurrence and declines work", async () => {
      const skillDoc = await readFile(path.resolve("docs/skills/agents/retro-to-remedies.md"), "utf8");
      assert.match(skillDoc, /recurrence|recurring/i);
      assert.match(skillDoc, /Failed Remedy/i);
      assert.match(skillDoc, /decline/i);

      const guideDoc = await readFile(path.resolve("docs/guides/retro-to-remedies.md"), "utf8");
      assert.match(guideDoc, /recurrence|recurring/i);
      assert.match(guideDoc, /Failed Remedy/i);
      assert.match(guideDoc, /decline/i);
    });
  });
});



