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
const skillDirs = [canonicalDir];
const skillFiles = skillDirs.map((dir) => path.resolve(dir, "SKILL.md"));

async function skillBodies() {
  return Promise.all(
    skillFiles.map(async (file) => (await readFile(file, "utf8")).replace(/^---\n[\s\S]*?\n---\n/, "")),
  );
}

describe("opencode-implement skill contract", () => {
  describe("scaffold and trigger policy", () => {
    it("has valid frontmatter", async () => {
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
      for (const beat of [/ticket/i, /opencode/i, /hosted/i, /wave|parallel/i, /verif/i, /fall ?back/i, /integrat/i, /review/i]) {
        assert.match(meta.description, beat);
      }
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
        assert.match(content.replace(/\s+/g, " "), /no skill-level default/i);
        assert.match(content, /--fallback-agent/);
        assert.match(content, /--opencode-only/);
        assert.match(content, /--no-fallback/);
        assert.match(content, /--strict-local/);
        assert.match(content, /concurrency cap/i);
      }
    });

    it("frames the skill as a hosted-model, wave/parallel skill, with no local/Ollama/zero-cost/private/slow-background language", async () => {
      for (const body of await skillBodies()) {
        assert.match(body, /hosted/i);
        assert.match(body, /wave/i);
        assert.match(body, /parallel/i);
        assert.match(body, /concurrency cap/i);
        // Every ticket-06 purge target. The ticket-format phrase is now the
        // `grill-to-tickets` ticket format (renamed from `to-tickets` local
        // format), so the exemption follows the rename; the --strict-local
        // flag NAME is a literal deprecated-alias token, not prose
        // describing the skill as local.
        const withoutExemptions = body
          .replace(/`?grill-to-tickets`?\s*ticket format/gi, "")
          .replace(/--strict-local/gi, "");
        assert.doesNotMatch(withoutExemptions, /\blocal\b/i, "no 'local' language outside the grill-to-tickets ticket format name and the --strict-local flag name");
        assert.doesNotMatch(body, /ollama/i, "no Ollama language");
        assert.doesNotMatch(body, /zero-cost/i, "no zero-cost framing");
        assert.doesNotMatch(body, /\bprivate\b/i, "no privacy framing");
        assert.doesNotMatch(body, /slow background/i, "no 'slow background tool' framing");
      }
    });

    it("steers positively — no 'Never' or 'Do not' in the instruction body", async () => {
      for (const body of await skillBodies()) {
        assert.doesNotMatch(body, /\bNever\b/i, "prompt the positive instead of 'Never'");
        assert.doesNotMatch(body, /\bDo not\b/i, "prompt the positive instead of 'Do not'");
      }
    });

    it("ships Codex metadata that blocks implicit invocation", async () => {
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

    it("ships trigger-evals.json with positive and negative cases", async () => {
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
      assert.match(guide, /hosted/i);
      assert.match(guide, /wave|parallel/i);
      for (const ref of SKILL_REFERENCES) {
        assert.match(guide, new RegExp(ref.replace(/\./g, "\\.")), `guide lists ${ref}`);
      }
    });

    it("ships exactly the declared reference set, and SKILL.md links each", async () => {
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
      for (const body of await skillBodies()) {
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
      for (const body of await skillBodies()) {
        assert.match(body, /most recent(ly modified)?\s+`?\.scratch\/\*\/issues\/`?/i);
        assert.match(body, /nam(e|ed) (it )?back|confirm/i);
      }
    });

    it("SKILL.md's Stage 0 section summarizes the wave table, touch-set estimate, overlap flags, and concurrency cap", async () => {
      for (const body of await skillBodies()) {
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

  describe("ticket 07 — grill-to-tickets ticket format and Seam rule", () => {
    it("calls the input the grill-to-tickets ticket format, never the to-tickets local format", async () => {
      for (const dir of skillDirs) {
        const docs = (
          await Promise.all(
            ["SKILL.md", "references/planning.md", "references/worktree-integration.md"].map((file) =>
              readFile(path.resolve(dir, file), "utf8"),
            ),
          )
        ).join("\n");
        assert.match(docs, /the `grill-to-tickets` ticket format/);
        assert.doesNotMatch(docs, /(?<!-)to-tickets/);
      }
    });

    it("lists every ticket header field in the ticket-format block", async () => {
      for (const dir of skillDirs) {
        const planning = await readFile(path.resolve(dir, "references/planning.md"), "utf8");
        const block = planning.match(/## 2\. Parse the ticket format[\s\S]*?(?=\n## )/);
        assert.ok(block, "planning.md §2 ticket-format block present");
        for (const field of [
          "**What to build:**",
          "**Blocked by:**",
          "**Reuse:**",
          "**Stories:**",
          "**Seam:**",
          "**Context:**",
          "**Budget:**",
          "**Status:**",
          "- [ ]",
        ]) {
          assert.ok(block[0].includes(field), `ticket-format block lists ${field}`);
        }
      }
    });

    it("uses a ticket's Seam verbatim and today's rule otherwise", async () => {
      for (const dir of skillDirs) {
        const planning = await readFile(path.resolve(dir, "references/planning.md"), "utf8");
        const step = planning.match(/## \d+\. Select a test seam per ticket[\s\S]*?(?=\n## )/);
        assert.ok(step, "seam step present");
        assert.match(step[0], /\*\*Seam:\*\*/);
        assert.match(step[0], /verbatim/i);
        assert.match(step[0], /Testing Decisions/);
        assert.match(step[0], /narrowest/);
      }
    });
  });

  describe("ticket 08 — Context drives the worker prompt and touch-set", () => {
    const PATH_RULE_DOCS = ["references/prompt-scaffold.md", "references/worker-contract.md"];

    it("the scaffold and the contract state the path rule, never absolute-everywhere", async () => {
      for (const dir of skillDirs) {
        for (const rel of PATH_RULE_DOCS) {
          const c = await readFile(path.resolve(dir, rel), "utf8");
          assert.doesNotMatch(
            c,
            /every path in the prompt is\s+absolute|absolute\s+paths\s+everywhere/i,
            `${rel} drops the absolute-everywhere rule`,
          );
          assert.match(c, /relative to it|relative to this directory|inside the worker's working directory/i, `${rel} states relative paths resolve inside the working directory`);
          assert.match(c, /outside it[\s\S]{0,200}absolute|absolute[\s\S]{0,200}outside it/i, `${rel} states paths outside the working directory are absolute`);
          assert.match(c, /git ls-files --error-unmatch/, `${rel} names the untracked read-only test`);
          assert.match(c, /main checkout/i, `${rel} resolves an untracked read-only file in the main checkout`);
        }
      }
    });

    it("Context fills the read-only-sections list and groups its files as read, change, and create", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/prompt-scaffold.md"), "utf8");
        const notes = c.slice(c.indexOf("## Notes for the orchestrator"));
        assert.match(notes, /\*\*Context:\*\*/, "the notes rule names Context");
        assert.match(notes, /`spec §` refs[\s\S]{0,160}read only these sections|read only these sections[\s\S]{0,160}`spec §` refs/i, "spec refs become the read-only-sections list");
        assert.match(notes, /read[\s\S]{0,80}change[\s\S]{0,80}create/i, "files are grouped read, change, and create");
        assert.match(notes, /\(from NN\)/);
        assert.match(notes, /\(edit\)/);
        assert.match(notes, /\(edit from NN\)/);
        assert.match(notes, /\(new\)/);
        assert.match(notes, /without a context[\s\S]{0,160}today's|today's[\s\S]{0,160}without a context/i, "without Context, today's judgement applies");
      }
    });

    it("planning.md §5 takes the touch-set from Context and estimates as today otherwise", async () => {
      for (const dir of skillDirs) {
        const planning = await readFile(path.resolve(dir, "references/planning.md"), "utf8");
        const step = planning.match(/## 5\.[\s\S]*?(?=\n## )/);
        assert.ok(step, "planning.md §5 present");
        assert.match(step[0], /\*\*Context:\*\*/);
        assert.match(step[0], /\(edit\)/);
        assert.match(step[0], /\(new\)/);
        assert.match(step[0], /\(edit from NN\)/);
        assert.match(step[0], /estimate/i, "keeps the estimate for a ticket without Context");
        assert.match(step[0], /advisory/i, "stays an advisory hint");
      }
    });
  });

  describe("Stage 1 — the opencode worker contract", () => {
    it("SKILL.md has a Stage 1 section with a preflight and no smoke test or Ollama check", async () => {
      for (const body of await skillBodies()) {
        const stage1 = body.match(/##\s*Stage 1[\s\S]*?(?=\n## )/i);
        assert.ok(stage1, "Stage 1 section present");
        const s = stage1[0];
        assert.match(s, /preflight/i);
        assert.match(s, /uncommitted changes|dirty tree/i);
        assert.match(s, /stash/i);
        assert.match(s, /opencode-implement\/<feature-slug>/);
        assert.match(s, /\.gitignore/);
        assert.match(s, /serial/i);
        assert.match(s, /concurrency cap/i);
        assert.match(s, /references\/worker-contract\.md/);
        assert.match(s, /references\/prompt-scaffold\.md/);
        assert.doesNotMatch(s, /smoke test/i, "no smoke test — dropped along with the retired local-model path");
        assert.doesNotMatch(s, /ollama/i, "no Ollama-reachability check");
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
      for (const body of await skillBodies()) {
        const s = body.match(/##\s*Stage 1[\s\S]*?(?=\n## )/i)[0];
        assert.match(s, /whole[\s\S]{0,20}in one worker call/i);
        assert.doesNotMatch(s, /decomposition\.md/);
        assert.match(s, /references\/worker-contract\.md/);
        assert.match(s, /references\/worktree-integration\.md/);
        assert.match(s, /resolve[\s\S]{0,20}pin/i);
        assert.match(s, /verification gate/i);
        assert.match(s, /reproduce[\s\S]{0,30}red/i);
        assert.match(s, /MAX_TICKET_ATTEMPTS\s*=\s*3/);
        assert.match(s, /squash-merge/i);
        assert.match(s, /one commit/i);
        assert.match(s, /INTEGRATION_DESIGN_CONFLICT/);
        assert.doesNotMatch(s, /checkpoint check/i, "no per-sub-step checkpoint check — decomposition is gone");
        assert.doesNotMatch(s, /re-split/i, "no runtime re-split — decomposition is gone");
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
      for (const body of await skillBodies()) {
        assert.match(body, /orchestrator dispatches every ticket/i);
        assert.match(body, /mechanical merge conflict|mechanical conflict/i);
        assert.match(body, /BLOCKED/);
      }
    });
  });

  describe("Stage 1 — automatic subagent fallback", () => {
    it("SKILL.md Stage 1 has an automatic fallback subsection with no approval pause", async () => {
      for (const body of await skillBodies()) {
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

    it("SKILL.md documents --no-fallback as the primary suppression flag, with --opencode-only as its current alias and --strict-local as a deprecated alias", async () => {
      for (const file of skillFiles) {
        const raw = await readFile(file, "utf8");
        const content = raw.replace(/\s+/g, " "); // tolerate markdown line-wrap between words
        assert.match(content, /--no-fallback/);
        assert.match(content, /--opencode-only/);
        assert.match(content, /--strict-local/);
        assert.match(
          content,
          /--no-fallback[\s\S]{0,80}primary|primary[\s\S]{0,80}--no-fallback/i,
          "SKILL.md must present --no-fallback as the primary suppression flag",
        );
        assert.match(
          content,
          /--opencode-only[\s\S]{0,120}(?:current alias|is its alias)|(?:current alias|is its alias)[\s\S]{0,120}--opencode-only/i,
          "SKILL.md must document --opencode-only as the current alias of --no-fallback",
        );
        assert.match(
          content,
          /--strict-local[\s\S]{0,120}deprecated|deprecated[\s\S]{0,120}--strict-local/i,
          "SKILL.md must document --strict-local as a deprecated alias",
        );
      }
    });
  });

  describe("state, resume, and handoff", () => {
    it("a BLOCKED ticket halts only its dependency branch, and the report names the blocked ticket, the fallout, and the available partial path", async () => {
      for (const dir of skillDirs) {
        const d = await readFile(path.resolve(dir, "references/status-and-resume.md"), "utf8");
        assert.match(d, /halts? only (its|the) (own )?dependency branch/i);
        assert.match(d, /next frontier/i);
        assert.match(d, /downstream tickets?[\s\S]{0,20}not started|not started/i);
        assert.match(d, /partial path/i);
        assert.match(d, /`?\/opencode-implement continue`?/);
        // BLOCKED conditions unchanged in kind
        assert.match(d, /TICKET_VERIFICATION_FAILED/);
        assert.match(d, /TICKET_TOO_LARGE_FOR_CONTEXT/);
        assert.match(d, /INTEGRATION_DESIGN_CONFLICT/);
        // Per-ticket integration precedent: a BLOCKED ticket does not hold up
        // its wave-mates or the whole wave — everything that already passed
        // integrates regardless of the block.
        assert.match(
          d,
          /everything that passed[\s\S]{0,80}integrated|already integrated stays integrated/i,
          "must state everything that already passed is integrated, per-ticket, not held for the whole wave",
        );
        // Independent later waves are named as an available path, not auto-started
        assert.match(
          d,
          /independent (?:later )?(?:tickets?|waves?)[\s\S]{0,120}(?:not started automatically|available partial path)/i,
          "must state independent later waves are reported as an available partial path, not auto-started",
        );
        // Halt report contents, itemized
        const haltReport = d.match(/###\s*Halt report[\s\S]*?(?=\n##)/i);
        assert.ok(haltReport, "Halt report subsection present");
        assert.match(haltReport[0], /each `?BLOCKED`? ticket/i);
        assert.match(haltReport[0], /reason/i);
        assert.match(haltReport[0], /downstream tickets?/i);
        assert.match(haltReport[0], /independent tickets?\/?waves?|independent tickets? and waves?/i);
        assert.match(haltReport[0], /\/opencode-implement continue/);
      }
    });

    it("status.md holds the wave table, the pinned resolved model, the new per-ticket fields, and cumulative usage split by path", async () => {
      for (const dir of skillDirs) {
        const d = await readFile(path.resolve(dir, "references/status-and-resume.md"), "utf8");
        assert.match(d, /status\.md/);
        // Wave table: wave, tickets, serial/parallel disposition
        assert.match(d, /wave table/i);
        assert.match(d, /serial/i);
        assert.match(d, /parallel/i);
        assert.match(d, /disposition/i);
        // Pinned resolved model
        assert.match(d, /pinned resolved model|resolved.{0,10}pinned model|pinned model/i);
        // New per-ticket fields
        for (const field of ["status", "session_id", "attempts", "opencode_retries", "worker_branch", "commit", "usage"]) {
          assert.match(d, new RegExp(field.replace(/_/g, "[_ ]")), `status.md records ${field}`);
        }
        // Old per-sub-step shape must be gone from the LIVE per-ticket field
        // list (a one-time contrast naming the retired fields, the same way
        // the acceptance criteria themselves do, is fine — it must not be
        // part of what status.md actually records going forward).
        const perTicketBullet = d.match(/- per ticket:[\s\S]*?(?=\n- the \*\*integration branch ref)/i);
        assert.ok(perTicketBullet, "a 'per ticket:' bullet describing the live fields is present");
        assert.doesNotMatch(perTicketBullet[0], /\bsub_step\b/i, "must drop the old sub_step field from the live shape");
        assert.doesNotMatch(perTicketBullet[0], /\bsession_ids\b/i, "must drop the old plural session_ids[] field from the live shape");
        assert.doesNotMatch(perTicketBullet[0], /\bsubagent_id\b/i, "must drop the old subagent_id field from the live shape");
        assert.doesNotMatch(perTicketBullet[0], /tokens:\s*\{\s*local/i, "must drop the old tokens:{local, fallback} shape from the live per-ticket field");
        // Integration branch ref
        assert.match(d, /integration branch ref/i);
        // Cumulative usage split by path
        assert.match(d, /tokens\.main/);
        assert.match(d, /tokens\.fallback/);
        assert.match(d, /cumulative usage|cumulative[\s\S]{0,20}per path/i);
        assert.match(d, /no per-turn state-header/i);
      }
    });

    it("continue confirms git refs and worker branch/worktree existence, discards and re-dispatches mid-run tickets from clean HEAD, re-verifies integrated tickets, and rewinds on drift", async () => {
      for (const dir of skillDirs) {
        const d = await readFile(path.resolve(dir, "references/status-and-resume.md"), "utf8");
        assert.match(d, /reconcile[\s\S]{0,20}(?:it )?against reality|reality reconciliation/i);
        assert.match(d, /Git refs?/i);
        assert.match(
          d,
          /worker branch[\s\S]{0,60}worktree[\s\S]{0,30}(?:still )?exists?/i,
          "must confirm each recorded worker branch and worktree still exists",
        );
        assert.match(d, /half-built|mid-run/i);
        assert.match(d, /discard[\s\S]{0,30}worktree/i);
        assert.match(d, /re-dispatch[\s\S]{0,40}clean/i);
        assert.match(d, /re-run its verification|re-verif/i, "must re-verify tickets recorded as integrated");
        assert.match(d, /last still-verifying commit/i);
        assert.match(d, /reset the integration branch/i);
        assert.match(d, /discarded commits/i);
        assert.match(
          d,
          /discarded commits[\s\S]{0,120}top of the report|top of the report[\s\S]{0,120}discarded commits/i,
          "must list the discarded commits at the top of the report",
        );
        assert.match(d, /re-present the Plan/i);
        assert.match(d, /resume[\s\S]{0,30}(?:from )?the frontier|frontier/i);
      }
    });

    it("status and list are read-only; status reports the wave table, blockers, per-path usage, pinned model, and stalled workers; list is unchanged", async () => {
      for (const dir of skillDirs) {
        const d = await readFile(path.resolve(dir, "references/status-and-resume.md"), "utf8");
        assert.match(d, /read-only/i);
        assert.match(d, /`?\/opencode-implement status`?/);
        assert.match(d, /`?\/opencode-implement list`?/);
        const statusSection = d.match(/##\s*`?\/opencode-implement status[\s\S]*?(?=\n## )/i);
        assert.ok(statusSection, "status/list section present");
        const s = statusSection[0];
        const sFlat = s.replace(/\s+/g, " "); // tolerate markdown line-wrap between words
        assert.match(s, /wave table/i);
        assert.match(s, /status[\s\S]{0,20}blockers|blockers/i);
        assert.match(s, /cumulative usage per path|tokens\.main[\s\S]{0,40}tokens\.fallback/i);
        assert.match(s, /pinned[\s\S]{0,10}model|resolved model/i);
        assert.match(s, /possibly stalled/i);
        assert.match(
          sFlat,
          /slug, integration branch, tickets done\s*\/\s*total|slug.{0,20}integration branch.{0,20}tickets/i,
          "list must report one line per run: slug, integration branch, tickets done/total",
        );
        assert.match(s, /running,?\s*blocked,?\s*(?:or\s*)?complete/i);
      }
    });

    it("the completion handoff names the branch, the pinned model, both per-path token totals, and the review commands, and never pushes", async () => {
      for (const body of await skillBodies()) {
        const stop = body.match(/##\s*Stop[\s\S]*?(?=\n## |$)/i);
        assert.ok(stop, "Stop/Handoff section present");
        const s = stop[0];
        assert.match(s, /integration branch|opencode-implement\/<feature-slug>/i);
        assert.match(s, /one commit\s+per ticket|one-commit-per-ticket/i);
        assert.match(s, /resolved model/i);
        assert.match(s, /tokens\.main/);
        assert.match(s, /tokens\.fallback/);
        assert.match(s, /\/code-review/);
        assert.match(s, /\/scrutinize/);
        assert.match(s, /push|pull request/i);
        assert.doesNotMatch(s, /cost:?\s*0|zero-cost/i, "no 'cost: 0' framing for the main path");
      }
    });

    it("SKILL.md has a State section and drives status-and-resume.md", async () => {
      for (const body of await skillBodies()) {
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

  describe("Reuse Catalog", () => {
    it("the whole-ticket prompt carries the Reuse line, a read-only catalog pointer, and the Reuse Plan rule", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/prompt-scaffold.md"), "utf8");
        assert.match(c, /- Reuse: <the ticket's Reuse line, verbatim>/);
        assert.match(c, /- Reuse Catalog: <abs path to docs\/reuse-catalog\.md> — read-only for you/);
        assert.match(c, /only when the target repository has\s+`docs\/reuse-catalog\.md`/);
        assert.match(c, /any verb other than `use`[\s\S]{0,120}Reuse\s+Plan/);
        assert.match(c, /gets `none`/);
      }
    });

    it("the fallback subagent inherits the Reuse lines through the same scaffold", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/fallback.md"), "utf8");
        assert.match(c, /same template[\s\S]{0,80}Reuse line/);
        assert.match(c, /nothing\s+about reuse changes on escalation/);
      }
    });

    it("per-ticket integration writes catalog entries serially inside each ticket's squash commit", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/worktree-integration.md"), "utf8");
        assert.ok(c.includes("## Reuse Catalog update"), "catalog update section present");
        const section = c.slice(c.indexOf("## Reuse Catalog update"));
        assert.match(section, /`git merge --squash` and `git commit`/);
        assert.match(section, /fallback subagent/);
        assert.match(section, /workers only\s+read the catalog/);
        for (const verb of ["create-shared", "create-candidate", "extend", "promote"]) {
          assert.match(section, new RegExp(`\`${verb}\``), `handles ${verb}`);
        }
        assert.match(section, /Grep the bare symbol/);
        assert.match(section, /not found in changed files/);
        assert.match(section, /reads no code/);
        assert.match(section, /Coverage dates stay/);
        assert.match(section, /no catalog file, skip/i);
      }
      for (const body of await skillBodies()) {
        assert.match(body, /\*\*Reuse:\*\*/);
        assert.match(body, /docs\/reuse-catalog\.md/);
        assert.match(body, /catalog's only writer while wave-mates only read it/);
      }
    });
  });

  describe("local-only tickets", () => {
    it("ticks the ticket file on disk when .scratch/ is git-ignored and inside the commit when it is tracked", async () => {
      for (const rel of ["SKILL.md", "references/worktree-integration.md"]) {
        const content = await readFile(path.resolve(canonicalDir, rel), "utf8");
        assert.match(content, /on\s+disk/i, `${rel} states the on-disk tick`);
        assert.match(content, /git-ignored/, `${rel} names the git-ignored case`);
        assert.match(content, /tracked/, `${rel} names the tracked case`);
      }
    });

    it("re-opens invalidated ticket files when a rewind resets the integration branch", async () => {
      const content = await readFile(path.resolve(canonicalDir, "references/status-and-resume.md"), "utf8");
      assert.match(content, /re-open each invalidated ticket file/);
      assert.match(content, /un-tick/);
    });
  });
});

describe("ticket 09 — budget_estimate and usage_total", () => {
  it("status.md records budget_estimate and usage_total per ticket with the path, per-invocation, BLOCKED, and unknown rules", async () => {
    for (const dir of skillDirs) {
      const d = await readFile(path.resolve(dir, "references/status-and-resume.md"), "utf8");
      const record = d.match(/- per ticket:[\s\S]*?(?=\n- the \*\*integration branch ref)/i);
      assert.ok(record, "per-ticket record present");
      assert.match(record[0], /budget_estimate/, "per-ticket record gains budget_estimate");
      assert.match(record[0], /usage_total/, "per-ticket record gains usage_total");
      assert.match(
        d,
        /budget_estimate[\s\S]{0,160}Budget line[\s\S]{0,80}verbatim|Budget line[\s\S]{0,80}verbatim[\s\S]{0,160}budget_estimate/i,
        "budget_estimate is the Budget line verbatim",
      );
      assert.match(d, /`?none`?[\s\S]{0,160}budget_estimate|budget_estimate[\s\S]{0,200}`?none`?/i, "budget_estimate is none without a Budget line");
      assert.match(
        d,
        /path that delivered[\s\S]{0,240}(main `?opencode`? path|native-subagent fallback|fallback)/i,
        "the delivering path names the main path and the native-subagent fallback",
      );
      assert.match(
        d,
        /every\s+(dispatch|invocation)[\s\S]{0,80}resume/i,
        "usage_total is summed per invocation, every dispatch and resume",
      );
      assert.match(
        d,
        /BLOCKED[\s\S]{0,240}path whose budget[\s\S]{0,160}exhausted|path whose budget[\s\S]{0,160}exhausted[\s\S]{0,240}BLOCKED/i,
        "a BLOCKED ticket sums the path whose budget it exhausted",
      );
      assert.match(d, /`?unknown`?/, "usage_total is unknown when unreported");
      assert.match(d, /existing `?usage`?[^\n]{0,80}(stays|stay|remain|kept)/i, "existing usage fields stay");
      assert.match(
        d,
        /input\s*\+\s*output\s*\+\s*reasoning/,
        "derives the main-path usage_total from input + output + reasoning",
      );
      assert.match(d, /step_finish/, "sums every step_finish event of every run");
      assert.match(
        d,
        /fallback[\s\S]{0,200}(reported tokens|subagent's reported)|(reported tokens|subagent's reported)[\s\S]{0,200}fallback/i,
        "the fallback path records the subagent's reported tokens",
      );
    }
  });

  it("the Budget line makes TICKET_TOO_LARGE_FOR_CONTEXT rarer without ruling it out", async () => {
    for (const dir of skillDirs) {
      for (const rel of ["references/fallback.md", "references/status-and-resume.md"]) {
        const c = await readFile(path.resolve(dir, rel), "utf8");
        const hit = c.match(/[^\n]*TICKET_TOO_LARGE_FOR_CONTEXT[\s\S]{0,400}/);
        assert.ok(hit, `${rel} keeps TICKET_TOO_LARGE_FOR_CONTEXT`);
        const section = hit[0];
        assert.match(section, /Budget line/i, `${rel} ties the trigger to the Budget line`);
        assert.match(section, /rarer/i, `${rel} says the Budget line makes it rarer`);
        assert.match(section, /without ruling it out|not ruled out|does not rule it out|never rules it out/i, `${rel} does not retire the trigger`);
        assert.match(section, /rare/i, `${rel} keeps "rare"`);
        assert.match(section, /runtime/i, `${rel} keeps "runtime"`);
        assert.doesNotMatch(c, /context[- ]budget/i, `${rel} avoids "context budget"`);
      }
    }
  });
});
