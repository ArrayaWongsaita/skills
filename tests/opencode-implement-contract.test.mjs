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

    it("worker-contract.md specifies the whole-ticket invocation with a pinned model flag", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/worker-contract.md"), "utf8");
        // Canonical flag order from acceptance criteria
        assert.match(
          c,
          /opencode run --format json --model <[^>]+> --dir <[^>]+> --dangerously-skip-permissions/,
          "invocation must include --model <pinned-model> --dir <worktree> in the canonical flag order",
        );
        // Must NOT reference sub-step paths like prompts/NN/K.md
        assert.doesNotMatch(c, /prompts\/\d+\/\d+/, "must not reference sub-step prompt paths");
        // Must reference the whole-ticket prompt path
        assert.match(c, /prompts\/\d+\.md|prompts\/<NN>\.md/, "must reference whole-ticket prompt path");
      }
    });

    it("worker-contract.md specifies model-resolution-and-pin: resolve once before wave 0, capture and pin to every worker", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/worker-contract.md"), "utf8");
        // Resolution once, before wave 0
        assert.match(c, /resolv\w+\s+\w+\s+(?:once|model)\b|once[\s\S]{0,30}resolv/i, "must state model is resolved once");
        assert.match(c, /before\s+wave\s+0|before\s+any\s+worker/i, "must state resolution happens before wave 0");
        // Read back via opencode models or first event stream
        assert.match(
          c,
          /opencode models|step_start[\s\S]{0,60}resolved|first[\s\S]{0,30}event[\s\S]{0,30}resolv/i,
          "must name the mechanism to read back the resolved model",
        );
        // Pinned
        assert.match(c, /pinned|pin/i, "must state the model is pinned");
        // Every worker receives it
        assert.match(
          c,
          /every\s+(?:subsequent\s+)?worker|every\s+(?:parallel\s+)?worker|every\s+worker/i,
          "must state every worker receives the pinned model",
        );
        // As explicit --model flag
        assert.match(
          c,
          /explicit\s+--model|--model.*explicit|captured\s+value.*--model|--model.*captured/i,
          "must state the captured value is passed as an explicit --model flag",
        );
        // Recorded in status.md and Plan
        assert.match(c, /status\.md/i, "must state the resolved model is recorded in status.md");
        assert.match(c, /Plan/i, "must state the resolved model is recorded in the Plan");
      }
    });

    it("worker-contract.md states the two model-resolution paths: user-passed --model or opencode resolves its own", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/worker-contract.md"), "utf8");
        assert.match(
          c,
          /user\s+passed\s+--model|--model\s+at\s+invocation|invocation.*--model/i,
          "must describe the user-passed --model path",
        );
        assert.match(
          c,
          /no\s+--model\s+flag|without\s+--model|omit\s+--model|no\s+`--model`/i,
          "must describe the no-flag path where opencode resolves its own model",
        );
      }
    });

    it("worker-contract.md defines the three timeouts as provisional with no old numeric defaults or probe C reference", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/worker-contract.md"), "utf8");
        assert.match(c, /FIRST_EVENT_TIMEOUT/);
        assert.match(c, /STALL_INTERVAL/);
        assert.match(c, /WORKER_TIMEOUT/);
        assert.match(c, /timeout` is not on macOS|no `timeout`|background/i);
        assert.match(c, /kill/i);
        assert.match(c, /provisional/i);
        // Must NOT reference "probe C" (old local-model calibration label)
        assert.doesNotMatch(c, /probe C\b/, "must not reference probe C (old local-model calibration)");
        // Must reference a fresh calibration probe against the hosted model
        assert.match(
          c,
          /calibrat\w+\s+probe|fresh\s+calibrat|calibrat\w+.*hosted|hosted.*calibrat/i,
          "must state timeouts need fresh calibration against the resolved hosted model",
        );
        // Must NOT carry old local-model numeric defaults written as provisional (6m, 8m, 45m)
        assert.doesNotMatch(
          c,
          /provisional\s+6m|provisional\s+8m|provisional\s+45m|\(provisional\s+\d/,
          "must not carry old numeric timeout defaults from the local-model probe",
        );
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
        assert.match(c, /opencode`?\s+failure/i);
        assert.match(c, /verification failure/i);
        assert.match(c, /distinct/i);
      }
    });

    it("worker-contract.md specifies two distinct retry rules: verification failure resumes session; opencode-process failure redispatches fresh", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/worker-contract.md"), "utf8");
        // Must describe two rules
        assert.match(c, /two\s+(?:distinct\s+)?rules?|two\s+retry|distinct\s+rules?/i, "must describe two distinct retry rules");

        // Rule 1: verification failure → resume same session via opencode run -s <session>
        assert.match(
          c,
          /verification\s+failure[\s\S]{0,400}opencode run -s|opencode run -s[\s\S]{0,400}verification\s+failure/i,
          "must specify that verification failure uses opencode run -s <session>",
        );
        assert.match(c, /MAX_TICKET_ATTEMPTS\s*=\s*3/, "must bound verification-failure retries");
        assert.match(
          c,
          /specific\s+failure|failure\s+as\s+the\s+next\s+turn|next\s+turn/i,
          "must state the specific failure is carried as the next turn",
        );

        // Rule 2: opencode-process failure → fresh dispatch, never a session resume
        assert.match(
          c,
          /opencode.{0,30}(?:process\s+)?failure[\s\S]{0,300}fresh\s+dispatch|fresh\s+dispatch[\s\S]{0,300}opencode.{0,30}(?:process\s+)?failure/i,
          "must specify that opencode-process failure uses fresh dispatch",
        );
        assert.match(c, /MAX_OPENCODE_RETRIES\s*=\s*3/, "must bound opencode-process retries");
        assert.match(
          c,
          /never\s+(?:a\s+)?(?:session\s+)?resume|crash[\s\S]{0,200}no\s+(?:session|sessionID)|no\s+sessionID|killed before[\s\S]{0,60}sessionID/i,
          "must state that an opencode-process failure never resumes a session",
        );

        // The old single-rule patterns must be gone
        assert.doesNotMatch(c, /progress note/i, "must not carry the old progress-note retry pattern");
        assert.doesNotMatch(
          c,
          /replays[\s\S]{0,30}transcript/i,
          "must not carry the old 32k-window replay rationale",
        );
      }
    });

    it("worker-contract.md specifies that multiple opencode run processes may be in flight concurrently, one per parallel worker", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/worker-contract.md"), "utf8");
        assert.match(
          c,
          /multiple\s+`?opencode run`?\s+processes?|concurrent[\s\S]{0,100}opencode run|opencode run[\s\S]{0,100}concurrent/i,
          "must state that multiple opencode run processes may be in flight at once",
        );
        assert.match(
          c,
          /one\s+per\s+(?:parallel\s+)?worker|each\s+(?:parallel\s+)?worker[\s\S]{0,100}--dir/i,
          "must state each parallel worker has its own --dir <worktree>",
        );
        assert.match(
          c,
          /(?:background-PID|background\s+PID)[\s\S]{0,300}per\s+worker|per\s+worker[\s\S]{0,300}(?:background-PID|background\s+PID)/i,
          "must state the background-PID timeout watcher is applied per worker, not per run",
        );
      }
    });

    it("worker-contract.md drops the Ollama-specific smoke-test caveat and the 'nothing else using the local model' requirement", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/worker-contract.md"), "utf8");
        assert.doesNotMatch(c, /nothing else using the local model/i, "must drop the local-model exclusivity caveat");
        assert.doesNotMatch(c, /restart Ollama/i, "must drop the Ollama restart message");
      }
    });

    it("prompt-scaffold.md is a whole-ticket scaffold, self-contained, and test-first", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/prompt-scaffold.md"), "utf8");
        assert.match(c, /Working directory/i);
        assert.match(c, /What to build/i);
        assert.match(c, /Acceptance criteria/i);
        assert.match(c, /every one/i);
        assert.match(c, /Context you need/i);
        assert.match(c, /Parent spec/i);
        assert.match(c, /ADRs?/i);
        assert.match(c, /Domain glossary/i);
        assert.match(c, /Test seam/i);
        assert.match(c, /red.*green.*refactor|failing test/is);
        assert.match(c, /package install/i);
        assert.match(c, /push[\s\S]{0,40}pull\s+request/i);
        assert.match(c, /missing decision|stop and report/i);
        assert.match(c, /literal text|reach for no slash/i);
        assert.match(c, /Red output/);
        assert.match(c, /Green output/);
        assert.match(c, /Files changed/i);
        assert.match(c, /Test .*criterion/i);
        // Whole-ticket, not per-sub-step
        assert.match(c, /prompts\/<?NN>?\.md|prompts\/\d+\.md/, "one prompt file per ticket");
        assert.doesNotMatch(c, /Progress note/i, "the progress-note section is removed");
        assert.doesNotMatch(c, /sub-step/i, "no sub-step framing remains");
        assert.doesNotMatch(c, /Files in scope/i, "no per-sub-step file-scope section remains");
        assert.doesNotMatch(c, /prompts\/\d+\/\d+/, "must not reference sub-step nested prompt paths");
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
        assert.match(c, /full suite/i);
        assert.match(c, /worktree remove/i);
      }
    });

    it("worktree-integration.md's preflight drops the Ollama check and the smoke test", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/worktree-integration.md"), "utf8");
        const preflight = c.match(/##\s*Preflight[\s\S]*?(?=\n## )/i);
        assert.ok(preflight, "Preflight section present");
        assert.match(preflight[0], /opencode`?\s+on\s+`?PATH/i);
        assert.match(preflight[0], /opencode models/);
        assert.match(preflight[0], /pinned model|resolved model/i);
        assert.doesNotMatch(preflight[0], /ollama/i, "no Ollama-reachability check");
        assert.doesNotMatch(preflight[0], /smoke test/i, "no local-specific smoke test");
      }
    });

    it("worktree-integration.md specifies serial-vs-parallel dispatch within a wave, the concurrency cap, the queue, and the possibly-stalled flag", async () => {
      for (const dir of skillDirs) {
        const raw = await readFile(path.resolve(dir, "references/worktree-integration.md"), "utf8");
        const c = raw.replace(/\s+/g, " "); // tolerate markdown line-wrap between words
        assert.match(c, /[Ss]erial tickets?/);
        assert.match(c, /dependency edge/i);
        assert.match(c, /flagged pair|likely-overlapping/i);
        assert.match(c, /one worktree slot at a time/i);
        assert.match(c, /background/i);
        assert.match(c, /one background worker per (?:independent )?ticket/i);
        assert.match(c, /concurrency cap/i);
        assert.match(c, /default\s*4/);
        assert.match(c, /queue/i);
        assert.match(c, /start(s)? as slots free/i);
        assert.match(c, /possibly stalled/i);
        assert.match(c, /10 minutes|configurable interval/i);
        assert.match(c, /without blocking (its |the )?wave-mates/i);
        assert.match(c, /own log file|its own log/i);
      }
    });

    it("worktree-integration.md specifies per-ticket integration, not gated on the whole wave", async () => {
      for (const dir of skillDirs) {
        const raw = await readFile(path.resolve(dir, "references/worktree-integration.md"), "utf8");
        const c = raw.replace(/\s+/g, " "); // tolerate markdown line-wrap between words
        assert.match(c, /per-ticket integration|per ticket, not gated on the whole wave/i);
        assert.match(
          c,
          /as soon as it (?:passes|clears|is ready).{0,200}verification/i,
          "a ticket integrates as soon as it passes verification",
        );
        assert.match(
          c,
          /independent of (?:whether )?its wave-mates|whether or not its wave-mates|does not (?:hold up|block) its wave-mates/i,
          "integration for one ticket does not wait on its wave-mates",
        );
        assert.match(
          c,
          /escalat\w+ to (?:the )?fallback.{0,300}integrates? the same way|fallback tier.{0,300}integrates? the same way/i,
          "an escalated ticket still integrates the same way once fallback-verified",
        );
        assert.match(
          c,
          /cut from whatever (?:integration )?`?HEAD`? exists/i,
          "the fallback-verified ticket's integration is cut from whatever HEAD exists by then",
        );
      }
    });

    it("worktree-integration.md specifies the wave boundary gates only the start of the next wave", async () => {
      for (const dir of skillDirs) {
        const raw = await readFile(path.resolve(dir, "references/worktree-integration.md"), "utf8");
        const c = raw.replace(/\s+/g, " "); // tolerate markdown line-wrap between words
        assert.match(c, /wave boundary/i);
        assert.match(
          c,
          /next wave.{0,120}(?:does not start|waits?|start(s)? only)|(?:does not start|waits?).{0,120}next wave/i,
          "the next wave does not start until the current wave is fully resolved",
        );
        assert.match(
          c,
          /every ticket in (?:the current|that) wave[\s\S]{0,80}terminal state/i,
          "every ticket in the current wave must reach a terminal state first",
        );
        assert.match(c, /integrated,? or `?BLOCKED`?/i, "terminal state means integrated or BLOCKED");
        assert.match(
          c,
          /never gates? (?:any )?individual ticket'?s? own integration|does not gate (?:any )?individual ticket'?s? own integration/i,
          "the wave boundary never gates an individual ticket's own integration",
        );
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

    it("fallback.md's opening rationale is reframed around a capability ceiling, dropping the local-model-is-weak framing", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/fallback.md"), "utf8");
        assert.doesNotMatch(c, /27B/i, "must drop the '27B local model' framing");
        assert.doesNotMatch(c, /weak and slow/i, "must drop the 'weak and slow' framing");
        assert.doesNotMatch(c, /\blocal model\b/i, "must drop 'local model' framing entirely");
        assert.doesNotMatch(c, /decomposition\.md/, "must not link to the removed decomposition.md");
        assert.match(c, /capability ceiling/i, "must state the capability-ceiling rationale");
        assert.match(
          c,
          /structurally different executor/i,
          "must name a structurally different executor as the reason to escalate",
        );
        assert.match(
          c,
          /third failed attempt|three failed attempts/i,
          "must state a third failed attempt is the signal to escalate, not a fourth attempt on the same model",
        );
        assert.match(c, /fourth attempt/i, "must contrast with a fourth attempt on the same model");
      }
    });

    it("fallback.md keeps TICKET_TOO_LARGE_FOR_CONTEXT as a rare runtime edge case with no context-budget/decomposition language", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/fallback.md"), "utf8");
        assert.match(c, /TICKET_TOO_LARGE_FOR_CONTEXT/);
        assert.match(c, /rare/i, "must frame the trigger as rare");
        assert.match(c, /runtime/i, "must frame the trigger as a runtime edge case, not a planning-time prediction");
        assert.doesNotMatch(c, /context budget/i, "must not carry the retired context-budget language");
        assert.doesNotMatch(c, /split fine enough/i, "must not carry the retired decomposition language");
      }
    });

    it("fallback.md renames the suppression alias to --opencode-only, keeps --no-fallback primary, and documents --strict-local as a deprecated alias", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/fallback.md"), "utf8");
        assert.match(c, /--no-fallback/);
        assert.match(c, /--opencode-only/);
        assert.match(c, /--strict-local/);
        assert.match(
          c,
          /--strict-local[^\n]{0,100}deprecated|deprecated[^\n]{0,100}--strict-local/i,
          "must document --strict-local as a deprecated alias",
        );
      }
    });

    it("fallback.md's cost-and-privacy section discloses tokens.main for the main path alongside tokens.fallback", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/fallback.md"), "utf8");
        assert.match(c, /tokens\.main/, "must name tokens.main for the main path's real spend");
        assert.match(c, /tokens\.fallback/);
        assert.match(
          c,
          /only path[^\n]{0,80}(?:leaves|left) the machine|only[^\n]{0,80}spend[^\n]{0,80}leaves the machine/i,
          "must still note the fallback path is the only one whose spend leaves the machine",
        );
      }
    });

    it("SKILL.md's suppression-flag mention documents --opencode-only with --strict-local as a deprecated alias, --no-fallback unchanged", async () => {
      for (const file of skillFiles) {
        const content = await readFile(file, "utf8");
        assert.match(content, /--no-fallback/);
        assert.match(content, /--opencode-only/);
        assert.match(content, /--strict-local/);
        assert.match(
          content,
          /--strict-local[^\n]{0,120}deprecated|deprecated[^\n]{0,120}--strict-local/i,
          "SKILL.md must document --strict-local as a deprecated alias",
        );
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
