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
        assert.match(c, /feature integration branch only/i);
        assert.match(c, /bug fix or an? incident|hotfix|incident/i);
        assert.match(c, /branch name|git log <review-point>\.\.HEAD|`?fix:`?/i, "a criterion for spotting a non-feature branch");
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

  describe("ticket 04 — Stage 2, fix dispatch and the fix(review) commit", () => {
    it("SKILL.md drives references/fix-dispatch.md from a Stage 2 section that returns to Stage 1", async () => {
      for (const file of skillFiles) {
        const content = await readFile(file, "utf8");
        assert.match(content, /##\s*Stage 2/i);
        assert.match(content, /references\/fix-dispatch\.md/);
      }
      for (const body of await bothSkillBodies()) {
        const s = stageSection(body, 2);
        assert.ok(s, "Stage 2 section present");
        assert.match(s, /cluster/i);
        assert.match(s, /fix\(review\):/);
        assert.match(s, /return to Stage 1|back to Stage 1/i);
      }
    });

    it("fix-dispatch.md specifies clustering and the dispatch-vs-inline rule", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/fix-dispatch.md"), "utf8");
        assert.match(c, /one cluster per coherent fix/i);
        assert.match(c, /new or changed test/i);
        assert.match(c, /more than one file/i);
        assert.match(c, /one file[\s\S]*?no test change/i);
        assert.match(c, /hand-applied inline/i);
        assert.match(c, /affected tests and the typecheck are run inline|run inline/i);
        assert.match(c, /sanctioned context cost/i);
      }
    });

    it("fix-dispatch.md cites subagent-implement and carries the worktree dispatch contract", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/fix-dispatch.md"), "utf8");
        assert.match(c, /subagent-implement/);
        assert.match(c, /review-to-pr\/<feature-slug>\/fix-<n>/);
        assert.match(c, /integration `?HEAD`?/i);
        assert.match(c, /\.scratch\/<feature-slug>\/prompts\/fix-<n>\.md/);
        assert.match(c, /isolation:\s*"worktree"/);
        assert.match(c, /\bfork\b/, "rules out fork explicitly");
        assert.match(c, /--agent/);
        assert.match(c, /general-purpose/);
        assert.match(c, /--model/);
        assert.match(c, /test-first/i);
      }
    });

    it("fix-dispatch.md carries the fresh Explore verifier that renders no verdict", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/fix-dispatch.md"), "utf8");
        assert.match(c, /fresh `?Explore`? subagent/i);
        assert.match(c, /writes no files/i);
        assert.match(c, /only the test files/i);
        assert.match(c, /would-be-red|reproduce.*red/i);
        assert.match(c, /no verdict/i);
        assert.match(c, /vacuous|tautolog/i);
        assert.match(c, /fallback/i);
      }
    });

    it("fix-dispatch.md defines the retry budget and the SendMessage resume", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/fix-dispatch.md"), "utf8");
        assert.match(c, /MAX_FIX_ATTEMPTS\s*=\s*3/);
        assert.match(c, /SendMessage/);
        assert.match(c, /same worker/i);
        assert.match(c, /crash, timeout, or lost subagent[\s\S]*?one attempt/i);
        assert.match(c, /\bno\s+separate\s+failover budget/i);
      }
    });

    it("fix-dispatch.md specifies one appended fix(review): commit per cluster and the unfixable path", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/fix-dispatch.md"), "utf8");
        assert.match(c, /exactly\*{0,2} one\*{0,2} `?fix\(review\)/i);
        assert.match(c, /git merge --squash review-to-pr\/<feature-slug>\/fix-<n>/);
        assert.match(c, /fix_commits/);
        assert.match(c, /ADR 0002|adr\/0002/);
        assert.match(c, /unfixable/);
        assert.match(c, /worktree is kept|keeps the worktree/i);
        assert.match(c, /not PR-ready/i);
        assert.match(c, /writes no fix code[\s\S]*?dispatched cluster|visible signal/i);
      }
    });

    it("fix-dispatch.md carries the five-item first-use confirmation checklist", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/fix-dispatch.md"), "utf8");
        assert.match(c, /first[- ]use confirmation/i);
        assert.match(c, /re-invokes the orchestrator on completion/i);
        assert.match(c, /isolation: "worktree"`? keeps a worktree that has commits/i);
        assert.match(c, /`?SendMessage`? resumes a backgrounded worker/i);
        assert.match(c, /token usage/i);
        assert.match(c, /`?Explore`? reads deeply enough/i);
      }
    });
  });

  describe("ticket 05 — Stage 3, the conditional system-scrutinize gate", () => {
    it("SKILL.md drives references/scrutiny-gate.md from a conditional Stage 3 section", async () => {
      for (const file of skillFiles) {
        const content = await readFile(file, "utf8");
        assert.match(content, /##\s*Stage 3/i);
        assert.match(content, /references\/scrutiny-gate\.md/);
      }
      for (const body of await bothSkillBodies()) {
        const s = stageSection(body, 3);
        assert.ok(s, "Stage 3 section present");
        assert.match(s, /cross-cutting|risky/i);
        assert.match(s, /skip[\s\S]*?Stage 4|self-contained/i);
        assert.match(s, /scrutinize/i);
      }
    });

    it("scrutiny-gate.md carries the full ADR 0003 cross-cutting checklist", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/scrutiny-gate.md"), "utf8");
        assert.match(c, /ADR 0003|adr\/0003/);
        assert.match(c, /routing/i);
        assert.match(c, /DI container/i);
        assert.match(c, /root schema/i);
        assert.match(c, /migrations directory/i);
        assert.match(c, /shared config/i);
        assert.match(c, /\bauth\b/i);
        assert.match(c, /concurrency or locking/i);
        assert.match(c, /on-wire or on-disk format|on-wire \/ on-disk/i);
        assert.match(c, /spans many modules/i);
        assert.match(c, /structural finding/i);
        assert.match(c, /self-contained[\s\S]*?skipped/i);
      }
    });

    it("scrutiny-gate.md specifies the inline pass and verbatim verdict normalization", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/scrutiny-gate.md"), "utf8");
        assert.match(c, /inline/i);
        assert.match(c, /end-to-end/i);
        assert.match(c, /git diff <review-point>\.\.\.HEAD/);
        assert.match(c, /`ship`/);
        assert.match(c, /`fix-then-ship`/);
        assert.match(c, /`rework`/);
        assert.match(c, /`reject`/);
        assert.match(c, /no paraphrasing/i);
      }
    });

    it("scrutiny-gate.md routes each verdict and stops on reject", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/scrutiny-gate.md"), "utf8");
        assert.match(c, /`ship`[\s\S]*?Stage 4/i);
        assert.match(c, /`fix-then-ship`[\s\S]*?sub-loop|sub-loop/i);
        assert.match(c, /`reject`[\s\S]*?stop/i);
        assert.match(c, /single biggest reason/i);
        assert.match(c, /human decision/i);
        assert.match(c, /no auto-loop/i);
      }
    });

    it("scrutiny-gate.md specifies the never-skipped code-review sub-loop step", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/scrutiny-gate.md"), "utf8");
        assert.match(c, /scrutinize\s*→\s*fix\s*→\s*tests or typecheck\s*→\s*code-review\s*→\s*scrutinize/);
        assert.match(c, /always[\s\S]{0,10}run/i);
        assert.match(c, /consumes a scrutinize cycle,?\s*not a code cycle/i);
      }
    });

    it("scrutiny-gate.md gives the gate an independent six-cycle budget with a stall stop", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/scrutiny-gate.md"), "utf8");
        assert.match(c, /six scrutinize cycles/i);
        assert.match(c, /independent(ly)? of the[\s\S]*?code budget/i);
        assert.match(c, /same blocking findings surviving two consecutive cycles/i);
        assert.match(c, /cycle 7 needs explicit human[\s\S]*?authorization/i);
      }
    });
  });

  describe("ticket 06 — Stages 4-5, state, resume, and the full eval suite", () => {
    it("SKILL.md has a Stage 4 section: fresh verifier, whole typecheck and whole suite, red is a blocker", async () => {
      for (const body of await bothSkillBodies()) {
        const s = stageSection(body, 4);
        assert.ok(s, "Stage 4 section present");
        assert.match(s, /fresh\s+`?Explore`?\s+verifier/i);
        assert.match(s, /whole[\s\S]*?typecheck/i);
        assert.match(s, /whole[\s\S]*?test suite|whole[\s\S]*?suite/i);
        assert.match(s, /integration branch `?HEAD`?/i);
        assert.match(s, /red[\s\S]*?new blocker/i);
        assert.match(s, /Stage 2/);
        assert.match(s, /ceiling[\s\S]*?spent[\s\S]*?unresolved|not PR-ready/i);
      }
    });

    it("SKILL.md has a Stage 5 handoff section that performs no PR step", async () => {
      for (const body of await bothSkillBodies()) {
        const s = stageSection(body, 5);
        assert.ok(s, "Stage 5 section present");
        assert.match(s, /integration branch/i);
        assert.match(s, /code-review/);
        assert.match(s, /scrutinize/);
        assert.match(s, /fix\(review\):/);
        assert.match(s, /green.*suite|suite.*green/i);
        assert.match(s, /\/pr-to-dev/);
        assert.match(s, /no `?git push`?/i);
        assert.match(s, /no `?gh`?/i);
        assert.match(s, /no PR step|no `?\/pr-to-dev`?/i);
      }
      // the run must not instruct an actual push / gh / pr-to-dev call
      for (const body of await bothSkillBodies()) {
        assert.doesNotMatch(body, /run `?\/pr-to-dev`?|execute `?gh pr|`git push` origin/i);
      }
    });

    it("status-and-resume.md defines the full review-status.md field set with no per-turn header", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/status-and-resume.md"), "utf8");
        for (const field of [
          "review_point", "feature_slug", "integration_branch", "spec_source",
          "stage", "code_cycles", "scrutinize_cycles", "findings", "fix_commits",
        ]) {
          assert.match(c, new RegExp(field.replace(/_/g, "[_ ]")), `review-status.md records ${field}`);
        }
        assert.match(c, /whole record/i);
        assert.match(c, /no per-turn state-header|no per-turn header/i);
        assert.match(c, /open[\s\S]{0,6}resolved[\s\S]{0,10}stalled[\s\S]{0,10}unfixable/i);
      }
    });

    it("status-and-resume.md specifies continue with Reality reconciliation and status read-only", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/status-and-resume.md"), "utf8");
        assert.match(c, /Reality reconciliation/i);
        assert.match(c, /integration branch exists/i);
        assert.match(c, /fix_commits[\s\S]*?reachable|reachable from the branch tip/i);
        assert.match(c, /re-run `?code-review`?[\s\S]*?full suite|re-run the full suite/i);
        assert.match(c, /re-open/i);
        assert.match(c, /superseded/i);
        assert.match(c, /resume[\s\S]*?stage[\s\S]*?records|from the stage/i);
        assert.match(c, /`\/review-to-pr status`?[\s\S]*?read-only/i);
        assert.match(c, /mutating nothing/i);
      }
    });

    it("status-and-resume.md defines the halt / partial report", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/status-and-resume.md"), "utf8");
        assert.match(c, /partial report/i);
        assert.match(c, /unresolved blockers/i);
        assert.match(c, /stage reached/i);
        assert.match(c, /cycles spent/i);
        assert.match(c, /`\/review-to-pr continue`/);
        assert.match(c, /force-pushed, reset, or discarded|Nothing is force-pushed/i);
      }
    });

    it("asserts the handoff order (/retro-to-remedies before /pr-to-dev) and the partial-report order (after /review-to-pr continue)", async () => {
      for (const body of await bothSkillBodies()) {
        const s = stageSection(body, 5);
        assert.ok(s, "Stage 5 section present");
        assert.match(
          s,
          /\/retro-to-remedies\s*\n\s*\/pr-to-dev/,
          "Stage 5 handoff block prints /retro-to-remedies on the line before /pr-to-dev",
        );
      }
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/status-and-resume.md"), "utf8");
        const partial = c.match(/### Halt \/ partial report[\s\S]*?(?=\n## )/)?.[0];
        assert.ok(partial, "Halt / partial report section present");
        assert.match(
          partial,
          /`\/review-to-pr continue`[\s\S]*?`\/retro-to-remedies`/,
          "partial report lists /retro-to-remedies after /review-to-pr continue",
        );
      }
    });

    it("names the retro step in both human guides", async () => {
      for (const guidePath of ["docs/guides/review-to-pr.md", "docs/skills/agents/review-to-pr.md"]) {
        const guide = await readFile(path.resolve(guidePath), "utf8");
        assert.match(guide, /\/retro-to-remedies/, `${guidePath} names the retro step`);
      }
    });

    it("the guide and the reference set stay in agreement", async () => {
      const guide = await readFile(path.resolve("docs/skills/agents/review-to-pr.md"), "utf8");
      for (const ref of SKILL_REFERENCES) {
        assert.match(guide, new RegExp(ref.replace(/\./g, "\\.")), `guide lists ${ref}`);
      }
      for (const dir of skillDirs) {
        const entries = (await readdir(path.resolve(dir, "references"))).sort();
        assert.deepEqual(entries, [...SKILL_REFERENCES].sort());
      }
    });

    it("the .scratch design-review record exists with the Gate 2 verdict", async () => {
      const dr = await readFile(path.resolve(".scratch/review-to-pr/design-review.md"), "utf8");
      assert.match(dr, /cycle/i);
      assert.match(dr, /FIX_THEN_SHIP|fix-then-ship/i);
      assert.match(dr, /blockingFindings|blocking findings/i);
      assert.match(dr, /route/i);
    });
  });

  describe("Reuse Catalog", () => {
    it("the Standards axis reviews against docs/reuse-catalog.md as a documented standard", async () => {
      for (const dir of skillDirs) {
        const c = await readFile(path.resolve(dir, "references/review-loop.md"), "utf8");
        assert.match(c, /When the repository has\s+`docs\/reuse-catalog\.md`, name it among the standards sources/);
        assert.match(c, /duplicates a catalogued one[\s\S]{0,120}documented-standard violation/);
        assert.match(c, /cite the\s+catalog line/);
        assert.match(c, /`code-review`\s+itself stays unchanged/);
        assert.match(c, /Reuse Catalog finding[\s\S]{0,120}blocker when it has a\s+concrete consequence/);
      }
      for (const body of await bothSkillBodies()) {
        assert.match(body, /Standards axis also reviews against it as a documented standard/);
      }
    });
  });
});
