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
});
