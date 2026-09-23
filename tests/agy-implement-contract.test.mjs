import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

// The reference set SKILL.md links, the guide's Related files list, and the
// references/ directory must agree. One source of truth for the three checks.
const SKILL_REFERENCES = [
  "agy-contract.md",
  "planning.md",
  "prompt-scaffold.md",
  "status-and-resume.md",
  "worktree-integration.md",
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

const canonicalDir = "skills/agents/agy-implement";
const skillDirs = [canonicalDir];
const skillFiles = skillDirs.map((dir) => path.resolve(dir, "SKILL.md"));

async function skillBodies() {
  return Promise.all(
    skillFiles.map(async (file) => (await readFile(file, "utf8")).replace(/^---\n[\s\S]*?\n---\n/, "")),
  );
}

// Concatenate SKILL.md plus named references for one skill copy. Several rules
// are spread across the workflow file and its references on purpose; the check
// is that the rule is stated somewhere in that set, once.
async function joinDocs(dir, ...refs) {
  const files = ["SKILL.md", ...refs.map((r) => `references/${r}`)];
  const bodies = await Promise.all(files.map((f) => readFile(path.resolve(dir, f), "utf8")));
  return bodies.join("\n");
}

describe("agy-implement skill contract", () => {
  describe("ticket 01 — scaffold and trigger policy", () => {
    it("has valid frontmatter", async () => {
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
      for (const body of await skillBodies()) {
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
    ];

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
      for (const body of await skillBodies()) {
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
        const both = await joinDocs(dir, "agy-contract.md");
        assert.match(both, /MAX_TICKET_ATTEMPTS\s*=\s*3|three attempts|up to 3/i);
        assert.match(both, /--conversation/);
        assert.match(both, /BLOCKED \(TICKET_VERIFICATION_FAILED\)/);
        assert.match(both, /worktree.*kept|kept.*inspection/i);
        assert.match(both, /MAX_FAILOVER_ATTEMPTS\s*=\s*3|separate (failover )?budget/i);
        assert.match(both, /Failover/);
      }
    });

    it("keeps the orchestrator out of ticket implementation", async () => {
      for (const body of await skillBodies()) {
        assert.match(body, /orchestrator[\s\S]{0,240}(mechanical|conflict)/i);
        assert.match(body, /dispatches every ticket/i);
      }
    });
  });

  describe("ticket 04 — parallel waves and integration gate", () => {
    it("worktree-integration.md specifies real parallel-wave dispatch", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/worktree-integration.md"), "utf8");
        const parallel = c.match(/##\s*Serial vs parallel[\s\S]*?(?=\n## )/i);
        assert.ok(parallel, "serial-vs-parallel dispatch section present");
        const p = parallel[0];
        assert.doesNotMatch(c, /Added in ticket 04/i, "placeholder replaced with real content");
        assert.match(p, /concurrency cap/i);
        assert.match(p, /\b4\b/, "default concurrency cap of 4");
        assert.match(p, /queue/i);
        assert.match(p, /background/i);
        assert.match(p, /re-?invoke|re-?enter|as each .*finish/i);
      }
    });

    it("assigns models by dispatch order, not ticket number, and records them in status.md", async () => {
      for (const dir of skillDirs) {
        const both = await joinDocs(dir, "agy-contract.md", "worktree-integration.md");
        assert.match(both, /dispatch order/i);
        assert.match(both, /not ticket number|not when the ticket is numbered/i);
        assert.match(both, /no (model )?list.*default|default.*no (model )?list/i);
        assert.match(both, /status\.md/);
      }
    });

    it("the integration gate distinguishes a mechanical conflict from a design-encoding one", async () => {
      for (const dir of skillDirs) {
        const both = await joinDocs(dir, "worktree-integration.md");
        assert.match(both, /mechanical conflict/i);
        assert.match(both, /design (decision|collision)|encodes a design/i);
        assert.match(both, /stop|halt|surface/i);
        assert.match(both, /return.*Stage 0|Stage 0/i);
        assert.match(both, /full (typecheck|suite|test suite)/i);
      }
    });

    it("flags a stalled worker in status", async () => {
      for (const dir of skillDirs) {
        const both = await joinDocs(dir, "worktree-integration.md", "agy-contract.md");
        assert.match(both, /stall/i);
        assert.match(both, /no output|no progress|silent/i);
        assert.match(both, /status\b/i);
      }
    });
  });

  describe("ticket 05 — failure, partial delivery, state and resume", () => {
    const stateDocs = (dir) => joinDocs(dir, "status-and-resume.md");

    it("ships references/status-and-resume.md and links it from SKILL.md", async () => {
      await fileExists(path.resolve(canonicalDir, "references/status-and-resume.md"));
      for (const file of skillFiles) {
        assert.match(await readFile(file, "utf8"), /references\/status-and-resume\.md/);
      }
    });

    it("a BLOCKED ticket halts only its dependency branch and the report names the fallout", async () => {
      for (const dir of skillDirs) {
        const d = await stateDocs(dir);
        assert.match(d, /halts? only (its|the) (dependency )?branch|only .* dependency branch/i);
        assert.match(d, /in-flight|already (in flight|running)|currently running/i);
        assert.match(d, /next frontier/i);
        assert.match(d, /downstream tickets? .*(not started|not begun)|not started/i);
        assert.match(d, /`?\/agy-implement continue`?/);
      }
    });

    it("status.md persists the per-ticket fields, the integration ref, and cumulative per-provider usage", async () => {
      for (const dir of skillDirs) {
        const d = await stateDocs(dir);
        assert.match(d, /status\.md/);
        for (const field of ["status", "conversation_id", "model", "attempts", "failover_attempts", "worker_branch", "commit", "usage"]) {
          assert.match(d, new RegExp(field.replace(/_/g, "[_ ]")), `status.md records ${field}`);
        }
        assert.match(d, /integration branch (ref|reference)/i);
        assert.match(d, /per-provider/i);
        assert.match(d, /as each ticket transitions|updated as/i);
      }
    });

    it("continue performs Reality reconciliation and rewinds to the last still-good commit", async () => {
      for (const dir of skillDirs) {
        const d = await stateDocs(dir);
        assert.match(d, /Reality reconciliation/i);
        assert.match(d, /git refs?|git status/i);
        assert.match(d, /acceptance check/i);
        assert.match(d, /last still-good commit|last commit .* still verif/i);
        assert.match(d, /rewind|reset the integration branch/i);
        assert.match(d, /discard.*worktree/i);
        assert.match(d, /list.*discarded commits|discarded commits .*(report|top)/i);
      }
    });

    it("status and list are read-only", async () => {
      for (const dir of skillDirs) {
        const d = await stateDocs(dir);
        assert.match(d, /`?\/agy-implement status`?[\s\S]{0,300}read-only/i);
        assert.match(d, /`?\/agy-implement list`?[\s\S]{0,300}(read-only|without mutating)/i);
      }
    });
  });

  describe("ticket 06 — preflight, handoff, docs, ADR", () => {
    const allDocs = (dir) => joinDocs(dir, "worktree-integration.md", "status-and-resume.md");

    it("preflight halts a dirty tree without stashing and sets up the integration branch", async () => {
      for (const dir of skillDirs) {
        const d = await allDocs(dir);
        assert.match(d, /preflight/i);
        assert.match(d, /uncommitted changes|dirty tree/i);
        assert.match(d, /stash/i, "names stashing explicitly (to rule it out)");
        assert.match(d, /agy-implement\/<feature-slug>/, "integration branch name");
        assert.match(d, /\.scratch\/<(feature-)?slug>\/worktrees\/[\s\S]{0,40}\.gitignore|\.gitignore[\s\S]{0,80}worktrees/i);
      }
    });

    it("the completion handoff names the branch, per-provider usage, and the review commands, and never pushes", async () => {
      for (const body of await skillBodies()) {
        const stop = body.match(/##\s*Stop[\s\S]*?(?=\n## |$)/i);
        assert.ok(stop, "Stop/Handoff section present");
        const s = stop[0];
        assert.match(s, /integration branch/i);
        assert.match(s, /one commit per ticket|one-commit-per-ticket/i);
        assert.match(s, /per-provider/i);
        assert.match(s, /\/code-review/);
        assert.match(s, /\/scrutinize/);
        assert.match(s, /push|pull request/i);
      }
    });

    it("ships a bilingual ADR 0004 recording the standalone stance", async () => {
      const adr = await readFile(path.resolve("docs/decisions/0004-agy-implement-standalone.md"), "utf8");
      assert.match(adr, /^# ADR 0004:/m);
      assert.match(adr, /Status \/ สถานะ/);
      assert.match(adr, /## Context \/ บริบท/);
      assert.match(adr, /## Decision \/ การตัดสินใจ/);
      assert.match(adr, /## Consequences \/ ผลที่ตามมา/);
      assert.match(adr, /grill-to-tickets/);
      assert.match(adr, /engineering-workflow/);
      assert.match(adr, /standalone/i);
      assert.match(adr, /own(s)? (its )?(own )?(copy|machinery)/i);
    });

    it("SKILL.md points at the standalone ADR and every reference file", async () => {
      for (const file of skillFiles) {
        const c = await readFile(file, "utf8");
        assert.match(c, /docs\/decisions\/0004-agy-implement-standalone\.md/);
        for (const ref of SKILL_REFERENCES) {
          assert.match(c, new RegExp(`references/${ref}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        }
      }
    });

    it("the guide's Related files list matches the shipped reference set", async () => {
      const guide = await readFile(path.resolve("docs/skills/agents/agy-implement.md"), "utf8");
      for (const ref of SKILL_REFERENCES) {
        assert.match(guide, new RegExp(ref.replace(/\./g, "\\.")), `guide lists ${ref}`);
      }
    });

    it("ships exactly the reference set SKILL.md and the guide name, nothing extra", async () => {
      for (const dir of skillDirs) {
        const entries = (await readdir(path.resolve(dir, "references"))).sort();
        assert.deepEqual(entries, [...SKILL_REFERENCES].sort());
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

    it("the integration gate writes catalog entries serially inside each ticket's squash commit", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/worktree-integration.md"), "utf8");
        const section = c.slice(c.indexOf("## Reuse Catalog update"));
        assert.ok(c.includes("## Reuse Catalog update"), "catalog update section present");
        assert.match(section, /`git merge --squash` and `git commit`/);
        assert.match(section, /ascending ticket-number order/);
        assert.match(section, /workers only read the catalog/);
        for (const verb of ["create-shared", "create-candidate", "extend", "promote"]) {
          assert.match(section, new RegExp(`\`${verb}\``), `handles ${verb}`);
        }
        assert.match(section, /Grep the bare symbol/);
        assert.match(section, /Reuse Plan entry/);
        assert.match(section, /not found in changed files/);
        assert.match(section, /reads no code/);
        assert.match(section, /Coverage dates stay/);
        assert.match(section, /no catalog file, skip/i);
      }
      for (const body of await skillBodies()) {
        assert.match(body, /\*\*Reuse:\*\*/);
        assert.match(body, /docs\/reuse-catalog\.md/);
        assert.match(body, /catalog's only writer while parallel wave-mates only read/);
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
