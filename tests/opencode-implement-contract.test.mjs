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

    it("publishes a bilingual human guide with the install command and the reference set", async () => {
      const guide = await readFile(path.resolve("docs/skills/agents/opencode-implement.md"), "utf8");
      assert.match(guide, /^## ภาษาไทย \/ Thai\s*$/m);
      assert.match(guide, /^## English \/ ภาษาอังกฤษ\s*$/m);
      assert.match(guide, /npx skills add ArrayaWongsaita\/skills --skill opencode-implement/);
      assert.match(guide, /background|overnight/i);
      assert.match(guide, /reliab|hang|slow/i);
      for (const ref of SKILL_REFERENCES) {
        assert.match(guide, new RegExp(ref.replace(/\./g, "\\.")), `guide lists ${ref}`);
      }
    });

    it("ships exactly the declared reference set in both copies, and SKILL.md links each", async () => {
      for (const dir of skillDirs) {
        const entries = (await readdir(path.resolve(dir, "references"))).sort();
        assert.deepEqual(entries, [...SKILL_REFERENCES].sort());
      }
      for (const file of skillFiles) {
        const c = await readFile(file, "utf8");
        for (const ref of SKILL_REFERENCES) {
          assert.match(c, new RegExp(`references/${ref}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        }
      }
    });

    it("keeps every reference file byte-identical across the skill copies", async () => {
      for (const ref of SKILL_REFERENCES) {
        const [canonical, mirror] = await Promise.all(
          skillDirs.map((dir) => readFile(path.resolve(dir, `references/${ref}`), "utf8")),
        );
        assert.equal(canonical, mirror, `references/${ref} copies must match`);
      }
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

    it("planning.md specifies parsing, DAG validation, wave computation, and seam selection", async () => {
      for (const dir of skillDirs) {
        const planning = await readFile(path.resolve(dir, "references/planning.md"), "utf8");
        assert.match(planning, /Blocked by/i);
        assert.match(planning, /acyclic|cycle/i);
        assert.match(planning, /TICKET_SET_CYCLIC/);
        assert.match(planning, /TICKET_SET_MISSING_BLOCKER/);
        assert.match(planning, /TICKET_SET_NUMBERING/);
        assert.match(planning, /topological|numbering/i);
        assert.match(planning, /execution waves/i);
        assert.match(planning, /test seam/i);
        assert.match(planning, /Testing Decisions/);
        assert.match(planning, /halt/i);
      }
    });

    it("planning.md computes execution waves, estimates touch-sets, and still drops the model column", async () => {
      for (const dir of skillDirs) {
        const planning = await readFile(path.resolve(dir, "references/planning.md"), "utf8");
        assert.match(planning, /Wave 0/i);
        assert.match(planning, /Wave K/i);
        assert.match(planning, /touch-set/i);
        assert.match(planning, /likely-overlapping/i);
        assert.match(planning, /no model column/i);
      }
    });

    it("planning.md estimates touch-sets as an advisory hint and flags cross-cutting overlap, with no step-plan/context-budget language", async () => {
      for (const dir of skillDirs) {
        const planning = await readFile(path.resolve(dir, "references/planning.md"), "utf8");
        assert.match(planning, /advisory/i);
        assert.match(planning, /likely-overlapping — consider serializing/);
        assert.match(planning, /router/i);
        assert.match(planning, /DI container/i);
        assert.match(planning, /migrations/i);
        assert.match(planning, /package\.json/);
        assert.match(planning, /CI config/i);
        assert.doesNotMatch(planning, /step plan/i);
        assert.doesNotMatch(planning, /sub-step/i);
        assert.doesNotMatch(planning, /context budget/i);
      }
    });

    it("planning.md no longer predicts each ticket's path", async () => {
      for (const dir of skillDirs) {
        const planning = await readFile(path.resolve(dir, "references/planning.md"), "utf8");
        assert.doesNotMatch(planning, /predict(s|ing)?\s+each ticket/i);
        assert.doesNotMatch(planning, /subagent-fallback/i);
        assert.doesNotMatch(planning, /TICKET_TOO_LARGE_FOR_CONTEXT/);
      }
    });

    it("resolves the target from an explicit dir, a slug, or the most recent issues dir", async () => {
      for (const body of await bothSkillBodies()) {
        assert.match(body, /most recent(ly modified)?\s+`?\.scratch\/\*\/issues\/`?/i);
        assert.match(body, /nam(e|ed) (it )?back|confirm/i);
      }
    });

    it("SKILL.md's Stage 0 section summarizes the wave table, touch-set estimate, overlap flags, and concurrency cap", async () => {
      for (const body of await bothSkillBodies()) {
        const stage0 = body.match(/##\s*Stage 0[\s\S]*?(?=\n## )/i)[0];
        assert.match(stage0, /wave/i);
        assert.match(stage0, /touch-set/i);
        assert.match(stage0, /overlap/i);
        assert.match(stage0, /concurrency cap/i);
        assert.match(stage0, /MAX_TICKET_ATTEMPTS/);
        assert.match(stage0, /MAX_OPENCODE_RETRIES/);
        assert.doesNotMatch(stage0, /step plan/i);
        assert.doesNotMatch(stage0, /sub-step/i);
        assert.doesNotMatch(stage0, /predicted path/i);
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
    it("SKILL.md Stage 1 dispatches the whole ticket and drives worktree-integration.md", async () => {
      for (const body of await bothSkillBodies()) {
        const s = body.match(/##\s*Stage 1[\s\S]*?(?=\n## )/i)[0];
        assert.match(s, /whole in one worker call/i);
        assert.doesNotMatch(s, /decomposition\.md/);
        assert.match(s, /references\/worker-contract\.md/);
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

  describe("Stage 1 — automatic subagent fallback", () => {
    it("SKILL.md Stage 1 has an automatic fallback subsection with no approval pause", async () => {
      for (const body of await bothSkillBodies()) {
        const s = body.match(/##\s*Stage 1[\s\S]*?(?=\n## )/i)[0];
        assert.match(s, /references\/fallback\.md/);
        assert.match(s, /automatic fallback|automatically fall|fallback to a native subagent/i);
        assert.match(s, /no\s+approval\s+pause|no\s+pause/i);
        assert.match(s, /--no-fallback/);
        assert.match(s, /TICKET_TOO_LARGE_FOR_CONTEXT/);
      }
    });

    it("fallback.md lists the three triggers and the --no-fallback behaviour", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/fallback.md"), "utf8");
        assert.match(c, /TICKET_TOO_LARGE_FOR_CONTEXT/);
        assert.match(c, /MAX_TICKET_ATTEMPTS\s*=\s*3/);
        assert.match(c, /MAX_OPENCODE_RETRIES\s*=\s*3/);
        assert.match(c, /within[\s\S]{0,20}retry budget[\s\S]{0,30}not escalated|retried locally, not escalated/i);
        assert.match(c, /--no-fallback/);
        assert.match(c, /--strict-local/);
        assert.match(c, /BLOCKED \(TICKET_TOO_LARGE_FOR_CONTEXT\)/);
        assert.match(c, /BLOCKED \(TICKET_VERIFICATION_FAILED\)/);
      }
    });

    it("fallback.md dispatches one whole-ticket subagent from clean HEAD, never fork", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/fallback.md"), "utf8");
        assert.match(c, /discard[\s\S]{0,40}partial[\s\S]{0,30}worktree/i);
        assert.match(c, /fresh worker branch/i);
        assert.match(c, /integration `?HEAD`?/i);
        assert.match(c, /subagent_type/);
        assert.match(c, /--fallback-agent/);
        assert.match(c, /general-purpose/);
        assert.match(c, /isolation:\s*"worktree"/);
        assert.match(c, /\bfork\b/i);
        assert.match(c, /whole ticket/i);
        assert.match(c, /no progress note|no decomposition/i);
        assert.match(c, /SendMessage/);
      }
    });

    it("fallback.md keeps the orchestrator as the verification authority and discloses the cost", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/fallback.md"), "utf8");
        assert.match(c, /same[\s\S]{0,40}verification gate/i);
        assert.match(c, /no verifier subagent|verification authority/i);
        assert.match(c, /Claude tokens/i);
        assert.match(c, /left the\s+machine|off the\s+machine/i);
        assert.match(c, /status\.md/);
        assert.match(c, /handoff/i);
        assert.match(c, /tokens\.fallback/);
      }
    });
  });

  describe("state, resume, and handoff", () => {
    it("a BLOCKED ticket halts only its dependency branch and the report names the fallout", async () => {
      for (const dir of skillDirs) {
        const d = await readFile(path.resolve(dir, "references/status-and-resume.md"), "utf8");
        assert.match(d, /halts? only (its|the) (own )?dependency branch/i);
        assert.match(d, /next frontier/i);
        assert.match(d, /downstream tickets?[\s\S]{0,20}not started|not started/i);
        assert.match(d, /partial path/i);
        assert.match(d, /`?\/opencode-implement continue`?/);
        assert.match(d, /TICKET_VERIFICATION_FAILED/);
        assert.match(d, /INTEGRATION_DESIGN_CONFLICT/);
      }
    });

    it("status.md persists the per-ticket fields, the integration ref, and per-path totals", async () => {
      for (const dir of skillDirs) {
        const d = await readFile(path.resolve(dir, "references/status-and-resume.md"), "utf8");
        assert.match(d, /status\.md/);
        for (const field of ["status", "path", "sub_step", "session_ids", "subagent_id", "attempts", "opencode_retries", "worker_branch", "commit"]) {
          assert.match(d, new RegExp(field.replace(/_/g, "[_ ]")), `status.md records ${field}`);
        }
        assert.match(d, /integration branch ref/i);
        assert.match(d, /per-path token totals|cumulative per-path/i);
        assert.match(d, /no per-turn state-header/i);
      }
    });

    it("continue reconciles reality, discards half-built tickets, and rewinds on drift", async () => {
      for (const dir of skillDirs) {
        const d = await readFile(path.resolve(dir, "references/status-and-resume.md"), "utf8");
        assert.match(d, /Reality reconciliation/i);
        assert.match(d, /Git refs?/i);
        assert.match(d, /half-built|mid-run/i);
        assert.match(d, /discard[\s\S]{0,30}worktree/i);
        assert.match(d, /re-dispatch[\s\S]{0,40}clean/i);
        assert.match(d, /last still-verifying commit/i);
        assert.match(d, /reset the integration branch/i);
        assert.match(d, /discarded commits/i);
      }
    });

    it("status and list are read-only", async () => {
      for (const dir of skillDirs) {
        const d = await readFile(path.resolve(dir, "references/status-and-resume.md"), "utf8");
        assert.match(d, /read-only/i);
        assert.match(d, /`?\/opencode-implement status`?/);
        assert.match(d, /`?\/opencode-implement list`?/);
      }
    });

    it("the completion handoff names the branch and the review commands and never pushes", async () => {
      for (const body of await bothSkillBodies()) {
        const stop = body.match(/##\s*Stop[\s\S]*?(?=\n## |$)/i);
        assert.ok(stop, "Stop/Handoff section present");
        const s = stop[0];
        assert.match(s, /integration branch|opencode-implement\/<feature-slug>/i);
        assert.match(s, /one commit\s+per ticket|one-commit-per-ticket/i);
        assert.match(s, /per-path token usage/i);
        assert.match(s, /\/code-review/);
        assert.match(s, /\/scrutinize/);
        assert.match(s, /push|pull request/i);
      }
    });

    it("SKILL.md has a State section and drives status-and-resume.md", async () => {
      for (const body of await bothSkillBodies()) {
        assert.match(body, /##\s*State, failure, and resume/i);
        assert.match(body, /references\/status-and-resume\.md/);
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
