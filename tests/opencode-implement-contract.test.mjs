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

  describe("Stage 1 — the opencode worker contract", () => {
    it("SKILL.md has a Stage 1 section with a preflight and a smoke test", async () => {
      for (const body of await bothSkillBodies()) {
        const stage1 = body.match(/##\s*Stage 1[\s\S]*?(?=\n## )/i);
        assert.ok(stage1, "Stage 1 section present");
        const s = stage1[0];
        assert.match(s, /preflight/i);
        assert.match(s, /uncommitted changes|dirty tree/i);
        assert.match(s, /stash/i);
        assert.match(s, /opencode-implement\/<feature-slug>/);
        assert.match(s, /\.gitignore/);
        assert.match(s, /smoke test/i);
        assert.match(s, /serial/i);
        assert.match(s, /references\/worker-contract\.md/);
        assert.match(s, /references\/prompt-scaffold\.md/);
      }
    });

    it("worker-contract.md documents the opencode run invocation and snapshot handling", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/worker-contract.md"), "utf8");
        assert.match(c, /opencode run --format json/);
        assert.match(c, /--model/);
        assert.match(c, /--dir/);
        assert.match(c, /--dangerously-skip-permissions/);
        assert.match(c, /no `--print-timeout`|no --print-timeout/i);
        assert.match(c, /"snapshot":\s*false/);
        assert.match(c, /\.git\/info\/exclude/);
        assert.match(c, /merge --squash/);
      }
    });

    it("worker-contract.md defines the three timeouts and the macOS timeout workaround", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/worker-contract.md"), "utf8");
        assert.match(c, /FIRST_EVENT_TIMEOUT/);
        assert.match(c, /STALL_INTERVAL/);
        assert.match(c, /WORKER_TIMEOUT/);
        assert.match(c, /timeout` is not on macOS|no `timeout`|background/i);
        assert.match(c, /kill/i);
        assert.match(c, /provisional/i);
        assert.match(c, /probe C/);
      }
    });

    it("worker-contract.md parses the event stream defensively and separates opencode vs verification failure", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/worker-contract.md"), "utf8");
        assert.match(c, /newline-delimited\s+JSON/i);
        assert.match(c, /ignore\s+lines\s+that\s+do\s+not\s+parse/i);
        assert.match(c, /step_start/);
        assert.match(c, /step_finish/);
        assert.match(c, /part\.reason:\s*"stop"|reason.*stop/i);
        assert.match(c, /error/);
        assert.match(c, /tokens\.total/);
        assert.match(c, /cost.*0|`0` local/i);
        assert.match(c, /opencode`?\s+failure/i);
        assert.match(c, /verification failure/i);
        assert.match(c, /distinct/i);
      }
    });

    it("worker-contract.md carries state by a fresh session + progress note, never -s resume", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/worker-contract.md"), "utf8");
        assert.match(c, /fresh\s+`?opencode run`?/i);
        assert.match(c, /-s\s+`?<session>`?|session\s+resume/i);
        assert.match(c, /replays[\s\S]{0,30}transcript/i);
        assert.match(c, /progress note/i);
        assert.match(c, /MAX_OPENCODE_RETRIES\s*=\s*3/);
      }
    });

    it("worker-contract.md specifies the preflight smoke test with exclusive model access", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/worker-contract.md"), "utf8");
        assert.match(c, /smoke test/i);
        assert.match(c, /nothing else using the local model/i);
        assert.match(c, /bash/i);
        assert.match(c, /edit/i);
        assert.match(c, /restart Ollama|free up/i);
      }
    });

    it("prompt-scaffold.md is per-sub-step, self-contained, and test-first", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/prompt-scaffold.md"), "utf8");
        assert.match(c, /sub-step/i);
        assert.match(c, /Working directory/i);
        assert.match(c, /acceptance criterion/i);
        assert.match(c, /Progress note/i);
        assert.match(c, /Test seam/i);
        assert.match(c, /Files in scope/i);
        assert.match(c, /red.*green.*refactor|failing test/is);
        assert.match(c, /package install/i);
        assert.match(c, /push[\s\S]{0,40}pull\s+request/i);
        assert.match(c, /missing decision|stop and report/i);
        assert.match(c, /literal text|reach for no slash/i);
        assert.match(c, /Red output/);
        assert.match(c, /Green output/);
        assert.match(c, /Test .*criterion/i);
      }
    });
  });

  describe("Stage 1 — chain, verification, integration", () => {
    it("SKILL.md Stage 1 drives decomposition.md and worktree-integration.md", async () => {
      for (const body of await bothSkillBodies()) {
        const s = body.match(/##\s*Stage 1[\s\S]*?(?=\n## )/i)[0];
        assert.match(s, /references\/decomposition\.md/);
        assert.match(s, /references\/worktree-integration\.md/);
        assert.match(s, /checkpoint check/i);
        assert.match(s, /re-split/i);
        assert.match(s, /verification gate/i);
        assert.match(s, /reproduce[\s\S]{0,30}red/i);
        assert.match(s, /MAX_TICKET_ATTEMPTS\s*=\s*3/);
        assert.match(s, /squash-merge/i);
        assert.match(s, /one commit/i);
        assert.match(s, /INTEGRATION_DESIGN_CONFLICT/);
      }
    });

    it("decomposition.md runs the sub-step loop with progress notes and a checkpoint check", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/decomposition.md"), "utf8");
        assert.match(c, /progress note/i);
        assert.match(c, /commits? on the worker branch/i);
        assert.match(c, /checkpoint check/i);
        assert.match(c, /typechecks?|compiles?/i);
        assert.match(c, /red\/green|red.*green/i);
        assert.match(c, /re-split/i);
        assert.match(c, /overflow/i);
        assert.match(c, /truncated edit/i);
        assert.match(c, /status\.md/);
        assert.match(c, /not counted against `?MAX_TICKET_ATTEMPTS`?|not[\s\S]{0,20}MAX_TICKET_ATTEMPTS/i);
        assert.match(c, /TICKET_TOO_LARGE_FOR_CONTEXT/);
      }
    });

    it("worktree-integration.md defines the worktree, the verification gate, and the squash-merge", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/worktree-integration.md"), "utf8");
        assert.match(c, /preflight/i);
        assert.match(c, /uncommitted changes|dirty tree/i);
        assert.match(c, /stash/i);
        assert.match(c, /opencode-implement\/<feature-slug>/);
        assert.match(c, /git worktree add/);
        assert.match(c, /symlink/i);
        assert.match(c, /package install/i);
        assert.match(c, /"snapshot":\s*false/);
        assert.match(c, /pre-ticket integration `?HEAD`?/i);
        assert.match(c, /only the ticket's test files/i);
        assert.match(c, /vacuous|tautolog/i);
        assert.match(c, /MAX_TICKET_ATTEMPTS\s*=\s*3/);
        assert.match(c, /merge --squash/);
        assert.match(c, /ascending ticket-number order/i);
        assert.match(c, /checkbox/i);
        assert.match(c, /mechanical conflict/i);
        assert.match(c, /INTEGRATION_DESIGN_CONFLICT/);
        assert.match(c, /no\s+separate\s+integration\s+gate/i);
        assert.match(c, /worktree remove/i);
      }
    });

    it("keeps the orchestrator out of ticket implementation", async () => {
      for (const body of await bothSkillBodies()) {
        assert.match(body, /orchestrator dispatches every ticket/i);
        assert.match(body, /mechanical merge conflict|mechanical conflict/i);
        assert.match(body, /BLOCKED/);
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
