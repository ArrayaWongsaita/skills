import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

// The reference set SKILL.md links, the guide's Related files list, and the
// references/ directory must agree. One source of truth for the three checks.
const SKILL_REFERENCES = [
  "dispatch-contract.md",
  "planning.md",
  "prompt-scaffold.md",
  "status-and-resume.md",
  "verification-and-integration.md",
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

const canonicalDir = "skills/agents/subagent-implement";
const skillDirs = [canonicalDir];
const skillFiles = skillDirs.map((dir) => path.resolve(dir, "SKILL.md"));

async function skillBodies() {
  return Promise.all(
    skillFiles.map(async (file) => (await readFile(file, "utf8")).replace(/^---\n[\s\S]*?\n---\n/, "")),
  );
}

async function joinDocs(dir, ...refs) {
  const files = ["SKILL.md", ...refs.map((r) => `references/${r}`)];
  const bodies = await Promise.all(files.map((f) => readFile(path.resolve(dir, f), "utf8")));
  return bodies.join("\n");
}

describe("subagent-implement skill contract", () => {
  describe("scaffold and trigger policy", () => {
    it("has valid frontmatter", async () => {
      for (const file of skillFiles) {
        await fileExists(file);
        const meta = parseFrontmatter(await readFile(file, "utf8"));
        assert.equal(meta.name, "subagent-implement");
        assert.ok(
          meta.description && meta.description.length >= 80,
          "description must be at least 80 characters",
        );
        assert.equal(meta["disable-model-invocation"], "true");
      }
    });

    it("names the full span in its description", async () => {
      const meta = parseFrontmatter(await readFile(skillFiles[0], "utf8"));
      for (const beat of [/ticket/i, /subagent/i, /context/i, /verif/i, /integrat/i, /review/i]) {
        assert.match(meta.description, beat);
      }
    });

    it("documents the invocation surface and the sub-commands", async () => {
      for (const file of skillFiles) {
        const content = await readFile(file, "utf8");
        assert.match(content, /\/subagent-implement <dir\|slug>/);
        assert.match(content, /\$subagent-implement/);
        assert.match(content, /\bcontinue\b/);
        assert.match(content, /\bstatus\b/);
        assert.match(content, /\blist\b/);
        assert.match(content, /explicit/i);
        assert.match(content, /--agent/);
        assert.match(content, /--model/);
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
        assert.match(yaml, /\$subagent-implement/);
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
        assert.match(c, /docs\/decisions\/0005-subagent-implement-standalone\.md/);
      }
    });

    it("ships exactly the declared reference set, nothing extra", async () => {
      for (const dir of skillDirs) {
        const entries = (await readdir(path.resolve(dir, "references"))).sort();
        assert.deepEqual(entries, [...SKILL_REFERENCES].sort());
      }
    });

    it("publishes a bilingual human guide listing the reference set and the install command", async () => {
      const guide = await readFile(path.resolve("docs/skills/agents/subagent-implement.md"), "utf8");
      assert.match(guide, /^## ภาษาไทย \/ Thai\s*$/m);
      assert.match(guide, /^## English \/ ภาษาอังกฤษ\s*$/m);
      assert.match(guide, /npx skills add ArrayaWongsaita\/skills --skill subagent-implement/);
      for (const ref of SKILL_REFERENCES) {
        assert.match(guide, new RegExp(ref.replace(/\./g, "\\.")), `guide lists ${ref}`);
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

    it("planning drops waves and touch-sets and keeps no model column", async () => {
      for (const dir of skillDirs) {
        const planning = await readFile(path.resolve(dir, "references/planning.md"), "utf8");
        assert.match(planning, /no wave|without a wave|no wave table/i);
        assert.match(planning, /touch-set/i, "explains why touch-sets are dropped");
        assert.match(planning, /no model column/i);
      }
    });

    it("resolves the target from an explicit dir, a slug, or the most recent issues dir", async () => {
      for (const body of await skillBodies()) {
        assert.match(body, /most recent(ly modified)?\s+`?\.scratch\/\*\/issues\/`?/i);
        assert.match(body, /nam(e|ed) (it )?back|confirm/i);
      }
    });
  });

  describe("grill-to-tickets ticket format and Seam rule", () => {
    it("calls the input the grill-to-tickets ticket format, never the to-tickets local format", async () => {
      for (const dir of skillDirs) {
        const docs = await joinDocs(dir, "planning.md");
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
        assert.match(step[0], /\*\*Seam:\*\*[\s\S]{0,120}verbatim/i, "a ticket's Seam is used verbatim");
        assert.match(step[0], /Testing Decisions/);
        assert.match(step[0], /narrowest/);
      }
    });
  });

  describe("ticket 08 — Context drives the worker prompt", () => {
    // Each doc states the path rule in one section: the scaffold's notes, the
    // contract's dispatch section.
    const PATH_RULE_DOCS = [
      ["references/prompt-scaffold.md", "## Notes for the orchestrator"],
      ["references/dispatch-contract.md", "## Dispatching a worker"],
    ];

    it("the scaffold and the contract state the path rule, never absolute-everywhere", async () => {
      for (const dir of skillDirs) {
        for (const [rel, heading] of PATH_RULE_DOCS) {
          const c = await readFile(path.resolve(dir, rel), "utf8");
          assert.ok(c.includes(heading), `${rel} has the "${heading}" section`);
          const section = c.slice(c.indexOf(heading)).split("\n## ")[0];
          assert.doesNotMatch(
            c,
            /every path in the prompt is\s+absolute|absolute\s+paths\s+everywhere/i,
            `${rel} drops the absolute-everywhere rule`,
          );
          assert.match(section, /relative to it|relative to this directory|inside the worker's working directory/i, `${rel} states relative paths resolve inside the working directory`);
          assert.match(section, /outside it[\s\S]{0,200}absolute|absolute[\s\S]{0,200}outside it/i, `${rel} states paths outside the working directory are absolute`);
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

    it("the Working directory placeholder names the harness-made worktree without an absolute path", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/prompt-scaffold.md"), "utf8");
        const section = c.match(/## Working directory[\s\S]*?(?=\n## )/);
        assert.ok(section, "Working directory section present");
        assert.doesNotMatch(section[0], /absolute path to this worker's git worktree/i);
        assert.match(section[0], /your current working directory/i);
        assert.match(section[0], /worktree the harness created/i);
      }
    });
  });

  describe("Stage 1 — dispatch, verify, integrate", () => {
    it("dispatch-contract.md documents the Agent-tool call and the agent/model resolution", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/dispatch-contract.md"), "utf8");
        assert.match(c, /subagent_type/);
        assert.match(c, /isolation:\s*"worktree"/);
        assert.match(c, /\bfork\b/i, "rules out fork explicitly");
        assert.match(c, /--agent/);
        assert.match(c, /general-purpose/);
        assert.match(c, /--model/);
        assert.match(c, /inherit/i);
        assert.match(c, /SendMessage/);
        assert.match(c, /MAX_TICKET_ATTEMPTS\s*=\s*3/);
        assert.match(c, /BLOCKED \(TICKET_VERIFICATION_FAILED\)/);
        assert.match(c, /confirm/i, "carries first-use confirmation items");
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
        assert.match(c, /push[\s\S]{0,40}pull request|open a PR/i);
        assert.match(c, /missing decision|stop and report/i);
        assert.match(c, /test .*criterion|criterion.*table/i);
        assert.match(c, /no other slash-command|reach for no other/i);
      }
    });

    it("the verification gate uses a fresh Explore verifier that renders no verdict", async () => {
      for (const body of await skillBodies()) {
        const gate = body.match(/###\s*Verification gate[\s\S]*?(?=\n###?\s)/i);
        assert.ok(gate, "Verification gate section present");
        const g = gate[0];
        assert.match(g, /fresh\s+verifier|verifier subagent/i);
        assert.match(g, /Explore/);
        assert.match(g, /reproduce.*red|red state/i);
        assert.match(g, /full (test )?suite/i);
        assert.match(g, /no verdict|renders no verdict/i);
        assert.match(g, /vacuous|tautolog/i);
        assert.match(g, /criteri/i);
        assert.match(g, /typecheck/i);
      }
    });

    it("verification-and-integration.md defines the verifier contract, judgment, and squash-merge", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/verification-and-integration.md"), "utf8");
        assert.match(c, /preflight/i);
        assert.match(c, /uncommitted changes|dirty tree/i);
        assert.match(c, /stash/i);
        assert.match(c, /subagent-implement\/<feature-slug>/);
        assert.match(c, /Explore/);
        assert.match(c, /pre-ticket .*HEAD/i);
        assert.match(c, /only the test files/i);
        assert.match(c, /fallback/i);
        assert.match(c, /squash/i);
        assert.match(c, /one commit per ticket/i);
        assert.match(c, /dependency order|ascending ticket/i);
        assert.match(c, /checkbox/i);
        assert.match(c, /mechanical conflict/i);
        assert.match(c, /design (decision|collision)|encodes a design/i);
        assert.match(c, /no separate integration gate|without a separate integration gate/i);
        assert.match(c, /worktree remove/i);
      }
    });

    it("keeps the orchestrator out of ticket implementation and its own steps text-only", async () => {
      for (const body of await skillBodies()) {
        assert.match(body, /orchestrator dispatches every ticket/i);
        assert.match(body, /mechanical merge conflict|mechanical conflict/i);
        assert.match(body, /text-only/i);
        assert.match(body, /BLOCKED/);
      }
    });
  });

  describe("Reuse Catalog", () => {
    it("the worker prompt carries the Reuse line, a read-only catalog pointer, and the Reuse Plan rule", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/prompt-scaffold.md"), "utf8");
        assert.match(c, /- Reuse: <the ticket's Reuse line, verbatim>/);
        assert.match(c, /- Reuse Catalog: <abs path to docs\/reuse-catalog\.md> — read-only for you/);
        assert.match(c, /only when the target repository has\s+`docs\/reuse-catalog\.md`/);
        assert.match(c, /any verb other than `use`[\s\S]{0,120}Reuse\s+Plan/);
        assert.match(c, /gets `none`/);
      }
    });

    it("integration writes catalog entries from text inside the ticket's squash commit", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/verification-and-integration.md"), "utf8");
        const section = c.slice(c.indexOf("## Reuse Catalog update"));
        assert.match(section, /between `git merge --squash` and\s+`git commit`/);
        for (const verb of ["create-shared", "create-candidate", "extend", "promote"]) {
          assert.match(section, new RegExp(`\`${verb}\``), `handles ${verb}`);
        }
        assert.match(section, /Grep the bare symbol/);
        assert.match(section, /Reuse Plan entry/);
        assert.match(section, /not found in changed files/);
        assert.match(section, /reads no code/);
        assert.match(section, /only writer during a run/);
        assert.match(section, /Coverage dates stay/);
        assert.match(section, /no catalog file, skip/i);
      }
      for (const body of await skillBodies()) {
        assert.match(body, /\*\*Reuse:\*\*/);
        assert.match(body, /docs\/reuse-catalog\.md/);
        assert.match(body, /update the Reuse\s+Catalog from text/);
      }
    });
  });

  describe("state, resume, and handoff", () => {
    const stateDocs = (dir) => joinDocs(dir, "status-and-resume.md");

    it("a BLOCKED ticket halts only its dependency branch and the report names the fallout", async () => {
      for (const dir of skillDirs) {
        const d = await stateDocs(dir);
        assert.match(d, /halts? only (its|the) (own )?dependency branch/i);
        assert.match(d, /next frontier/i);
        assert.match(d, /downstream tickets? .*not started|not started/i);
        assert.match(d, /partial path/i);
        assert.match(d, /`?\/subagent-implement continue`?/);
      }
    });

    it("status.md persists the per-ticket fields and the integration ref, with no provider usage", async () => {
      for (const dir of skillDirs) {
        const d = await stateDocs(dir);
        assert.match(d, /status\.md/);
        for (const field of ["status", "subagent_id", "agent_type", "model", "attempts", "worker_branch", "commit"]) {
          assert.match(d, new RegExp(field.replace(/_/g, "[_ ]")), `status.md records ${field}`);
        }
        assert.match(d, /integration branch ref/i);
        assert.match(d, /no per-provider|there is no external provider/i);
      }
    });

    it("continue performs Reality reconciliation and rewinds to the last still-good commit", async () => {
      for (const dir of skillDirs) {
        const d = await stateDocs(dir);
        assert.match(d, /Reality reconciliation/i);
        assert.match(d, /git refs?/i);
        assert.match(d, /fresh verifier/i);
        assert.match(d, /last still-good commit/i);
        assert.match(d, /reset the integration branch/i);
        assert.match(d, /discard.*worktree/i);
        assert.match(d, /discarded commits/i);
      }
    });

    it("status and list are read-only", async () => {
      for (const dir of skillDirs) {
        const d = await stateDocs(dir);
        assert.match(d, /read-only/i);
        assert.match(d, /`?\/subagent-implement status`?/);
        assert.match(d, /`?\/subagent-implement list`?/);
      }
    });

    it("the completion handoff names the branch and the review commands and never pushes", async () => {
      for (const body of await skillBodies()) {
        const stop = body.match(/##\s*Stop[\s\S]*?(?=\n## |$)/i);
        assert.ok(stop, "Stop/Handoff section present");
        const s = stop[0];
        assert.match(s, /integration branch/i);
        assert.match(s, /one commit per ticket|one-commit-per-ticket/i);
        assert.match(s, /\/code-review/);
        assert.match(s, /\/scrutinize/);
        assert.match(s, /push|pull request/i);
      }
    });
  });

  describe("standalone ADR 0005", () => {
    it("ships a bilingual ADR recording the standalone sibling stance", async () => {
      const adr = await readFile(path.resolve("docs/decisions/0005-subagent-implement-standalone.md"), "utf8");
      assert.match(adr, /^# ADR 0005:/m);
      assert.match(adr, /Status \/ สถานะ/);
      assert.match(adr, /## Context \/ บริบท/);
      assert.match(adr, /## Decision \/ การตัดสินใจ/);
      assert.match(adr, /## Consequences \/ ผลที่ตามมา/);
      assert.match(adr, /agy-implement/);
      assert.match(adr, /engineering-workflow/);
      assert.match(adr, /standalone/i);
      assert.match(adr, /own(s)? (its )?(own )?(copy|machinery)/i);
      assert.match(adr, /portable/i);
    });
  });

  describe("local-only tickets", () => {
    it("ticks the ticket file on disk when .scratch/ is git-ignored and inside the commit when it is tracked", async () => {
      for (const rel of ["SKILL.md", "references/verification-and-integration.md"]) {
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
      assert.match(record[0], /verifier_usage_total/, "per-ticket record gains verifier_usage_total");
      assert.match(
        d,
        /budget_estimate[\s\S]{0,160}Budget line[\s\S]{0,80}verbatim|Budget line[\s\S]{0,80}verbatim[\s\S]{0,160}budget_estimate/i,
        "budget_estimate is the Budget line verbatim",
      );
      assert.match(d, /`?none`?[\s\S]{0,160}budget_estimate|budget_estimate[\s\S]{0,200}`?none`?/i, "budget_estimate is none without a Budget line");
      assert.match(
        d,
        /path that delivered[\s\S]{0,160}every (dispatch|invocation)[\s\S]{0,80}resume/i,
        "usage_total sums the delivering path per invocation, every dispatch and resume",
      );
      assert.match(
        d,
        /BLOCKED[\s\S]{0,240}path whose budget[\s\S]{0,160}exhausted|path whose budget[\s\S]{0,160}exhausted[\s\S]{0,240}BLOCKED/i,
        "a BLOCKED ticket sums the path whose budget it exhausted",
      );
      assert.match(d, /`?unknown`?/, "usage_total is unknown when unreported");
      assert.match(d, /`usage`[^\n]{0,80}(stays|stay|remains|kept)/i, "the worker's reported usage stays");
      assert.match(d, /possibly\s+cache-inclusive/i, "the reported tokens are noted as possibly cache-inclusive");
      assert.match(d, /no per-provider|there is no external provider/i, "keeps the no per-provider roll-up sentence");
    }
  });

  it("dispatch-contract.md confirms the token-usage row and questions a resumed report's cumulativeness", async () => {
    for (const dir of skillDirs) {
      const c = await readFile(path.resolve(dir, "references/dispatch-contract.md"), "utf8");
      const usageRow = c.match(/\|[^\n|]*final report carries token usage[^\n|]*\|[^\n]*\|/i);
      assert.ok(usageRow, "the token-usage row is present");
      assert.match(usageRow[0], /confirmed/i, "the token-usage row is marked confirmed");
      assert.doesNotMatch(usageRow[0], /\bbonus\b/i, "the bonus wording is gone");
      const points = c.match(/## Points to confirm[\s\S]*?(?=\n## |$)/);
      assert.ok(points, "the Points to confirm table is present");
      assert.match(
        points[0],
        /^\|[^|\n]*resum[^|\n]*usage[^|\n]*cumulative[^|\n]*\|/im,
        "a point to confirm asks whether a resumed report's usage is cumulative",
      );
    }
  });
});
