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

describe("grill-to-tickets composite skill contract", () => {
  const canonicalDir = "skills/agents/grill-to-tickets";
  const skillDirs = [canonicalDir];
  const skillFiles = skillDirs.map((dir) => path.resolve(dir, "SKILL.md"));

  it("has valid frontmatter", async () => {
    for (const file of skillFiles) {
      await fileExists(file);
      const meta = parseFrontmatter(await readFile(file, "utf8"));
      assert.equal(meta.name, "grill-to-tickets");
      assert.ok(
        meta.description && meta.description.length >= 80,
        "description must be at least 80 characters",
      );
      assert.equal(meta["disable-model-invocation"], "true");
    }
  });

  it("inline-executes the three stage skills and two owned formats and hands the tickets to a later implementer run", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /inline/i, "must instruct inline execution");
      for (const item of ["grilling", "domain-modeling", "scrutinize", "spec-format", "ticket-format"]) {
        assert.match(content, new RegExp(item), `must name stage skill or owned format ${item}`);
      }
      assert.match(
        content,
        /\/subagent-implement\b/,
        "must hand the ticket directory to a later implementer run",
      );
      assert.match(
        content,
        /hands? off|handoff/i,
        "must frame the stop as a handoff rather than implementation",
      );
    }
  });

  it("steers positively — no 'Never' or 'Do not' in the instruction body", async () => {
    for (const file of skillFiles) {
      const body = (await readFile(file, "utf8")).replace(/^---\n[\s\S]*?\n---\n/, "");
      assert.doesNotMatch(body, /\bNever\b/i, "prompt the positive instead of 'Never'");
      assert.doesNotMatch(body, /\bDo not\b/i, "prompt the positive instead of 'Do not'");
    }
  });

  it("defines Stage 0 through Stage 3", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /Stage 0[^\n]*Grill/i);
      assert.match(content, /Stage 1[^\n]*Spec/i);
      assert.match(content, /Stage 2[^\n]*Design Review Gate/i);
      assert.match(content, /Stage 3[^\n]*Ticket/i);
    }
  });

  it("specifies the feature-scoped artifact tree, including one stable design-review file", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /\.scratch\/<feature-slug>\//);
      assert.match(content, /\.scratch\/<feature-slug>\/CONTEXT\.md/);
      assert.match(content, /\.scratch\/<feature-slug>\/adr\//);
      assert.match(content, /\.scratch\/<feature-slug>\/spec\.md/);
      assert.match(content, /\.scratch\/<feature-slug>\/design-review\.md/);
      assert.match(content, /\.scratch\/<feature-slug>\/issues\//);
      assert.match(content, /\.scratch\/<feature-slug>\/decisions\.md/);
    }
  });

  it("logs every decision to decisions.md and resumes a run from it", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /continue <feature-slug>/, "a resume invocation is documented");
      assert.match(content, /\(references\/decision-log\.md\)/);
      assert.match(content, /Stage 0[\s\S]*record each answer[\s\S]*before the next round[\s\S]*Stage 1/);
      assert.match(content, /Stage 1[\s\S]*Synthesize `decisions\.md`[\s\S]*every decision in the log/);
    }
    for (const dir of skillDirs) {
      const log = await readFile(path.resolve(dir, "references/decision-log.md"), "utf8");
      assert.match(log, /^## State$/m, "the log carries run State");
      assert.match(log, /^## Preflight$/m, "the log carries Preflight entries");
      assert.match(log, /waiting on/);
      assert.match(log, /decided: open/);
      assert.match(log, /before you post the next\s+round/);
      assert.match(log, /^## Resume — `continue <feature-slug>`$/m);
      assert.match(log, /cycle count from `design-review\.md`/, "one source of truth for the gate cycle count");

      const gate = await readFile(path.resolve(dir, "references/design-review-gate.md"), "utf8");
      assert.match(gate, /this finding and `decisions\.md` to a fresh writer/);
      assert.doesNotMatch(gate, /transcript/i, "the REWORK test reads the log, not a transcript");
    }
  });

  it("runs a Stage 0 Reuse survey against the project's Reuse Catalog", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /Stage 0[\s\S]*Reuse survey[\s\S]*Relentless interview/, "survey runs before the interview");
      assert.match(content, /docs\/reuse-catalog\.md/);
      assert.match(content, /drift-check/i);
      assert.match(content, /Coverage/);
      assert.match(content, /\(references\/reuse-pass\.md\)/);
      assert.match(content, /catalog changes/i, "the Stage 0 pause reports catalog changes");
    }
    for (const dir of skillDirs) {
      const pass = await readFile(path.resolve(dir, "references/reuse-pass.md"), "utf8");
      assert.match(pass, /exists now/i, "catalog lists only code that exists");
      assert.match(pass, /drift-check/i);
      assert.match(pass, /git log --since=<date> --first-parent --diff-merges=first-parent --name-only/);
      assert.match(pass, /Explore-type subagent/);
      assert.match(pass, /Bootstrap/);
      assert.match(pass, /AGENTS\.md[\s\S]{0,80}CLAUDE\.md/, "pointer goes to AGENTS.md, else CLAUDE.md");
      assert.match(pass, /numbered question with a\s+recommended answer/);

      const template = await readFile(path.resolve(dir, "references/reuse-catalog-template.md"), "utf8");
      assert.match(template, /every line describes code that exists now/i);
      assert.match(template, /- `symbol` — `path\/to\/file` — use for:/);
      for (const heading of ["Where shared code lives", "Rules", "Shared", "Candidates", "Coverage"]) {
        assert.match(template, new RegExp(`^## ${heading}$`, "m"), `template has ## ${heading}`);
      }
    }
  });

  it("writes a Reuse Plan in the spec and reviews it through the gate's reuse lens", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /Stage 1[\s\S]*### Reuse Plan[\s\S]*Stage 2/, "Stage 1 writes the Reuse Plan");
      assert.match(content, /Stage 2[\s\S]*reuse lens/i, "Stage 2 applies the reuse lens");
    }
    for (const dir of skillDirs) {
      const pass = await readFile(path.resolve(dir, "references/reuse-pass.md"), "utf8");
      for (const category of [
        "Use as-is",
        "Extend",
        "Create shared",
        "Create candidate",
        "Promote",
        "Kept separate on purpose",
      ]) {
        assert.match(pass, new RegExp(`\\*\\*${category}\\*\\*`), `Reuse Plan category ${category}`);
      }
      assert.match(pass, /create-shared bar/i);
      assert.match(pass, /two or more user stories/);
      assert.match(pass, /confirmed in Stage 0 that a named upcoming feature/);
      assert.match(pass, /designed for\s+extraction/i);

      const gate = await readFile(path.resolve(dir, "references/design-review-gate.md"), "utf8");
      assert.match(gate, /## Reuse lens/);
      for (const id of ["reuse-duplicate-", "reuse-unowned-", "reuse-speculative-", "reuse-undecided-"]) {
        assert.match(gate, new RegExp(id), `gate carries finding id ${id}`);
      }
      assert.match(gate, /reuse-duplicate-[^\n]*FIX_THEN_SHIP/);
      assert.match(gate, /reuse-undecided-[^\n]*decision-level/);
    }
  });

  it("runs a blind-spot pass over fixed categories before the Stage 0 pause", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /\*\*Blind-spot pass\.\*\*[\s\S]*\*\*Pause\.\*\*/, "the pass runs before the pause");
      assert.match(content, /\(references\/blind-spot-pass\.md\)/);
      assert.match(content, /blind-spot assumption appears in Further Notes/);
    }
    for (const dir of skillDirs) {
      const pass = await readFile(path.resolve(dir, "references/blind-spot-pass.md"), "utf8");
      for (const category of [
        "Scope and behaviour",
        "Domain and data",
        "Interaction and flow",
        "Quality attributes",
        "Integrations",
        "Edge cases and failure",
        "Constraints and trade-offs",
        "Terminology",
        "Completion signals",
      ]) {
        assert.match(pass, new RegExp(`^\\| ${category} \\|`, "m"), `category ${category}`);
      }
      for (const mark of ["`clear`", "`partial`", "`missing`", "`n/a`"]) {
        assert.ok(pass.includes(mark), `mark ${mark}`);
      }
      assert.match(pass, /at most five questions/);
      assert.match(pass, /stated assumption/);
      assert.match(pass, /## Blind-spot pass/);
      assert.match(pass, /done when every category carries a mark/);
    }
  });

  it("dispatches each Stage 2 review to a fresh, read-only reviewer", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      const stage2 = content.slice(content.indexOf("## Stage 2"), content.indexOf("## Stage 3"));
      assert.match(stage2, /fresh reviewer subagent/);
      assert.match(stage2, /edits nothing/);
      assert.match(stage2, /\(references\/design-review-gate\.md\) — Reviewer/);
      assert.match(content, /Stages 0, 1, and 3 run \*\*inline\*\*/);
      assert.match(content, /Two steps dispatch a subagent/);
    }
    for (const dir of skillDirs) {
      const gate = await readFile(path.resolve(dir, "references/design-review-gate.md"), "utf8");
      const reviewer = gate.slice(gate.indexOf("## Reviewer"), gate.indexOf("## Verdict vocabulary"));
      assert.ok(reviewer.startsWith("## Reviewer"), "the gate reference has a Reviewer section");
      for (const brief of ["**Paths:**", "**Task:**", "**Prior findings,**", "**Return:**"]) {
        assert.ok(reviewer.includes(brief), `the reviewer brief names ${brief}`);
      }
      assert.match(reviewer, /edits no file/);
      assert.match(reviewer, /`reviewer: inline`/, "the inline fallback is recorded");
      assert.match(gate, /^- `reviewer` — /m, "each cycle records its reviewer");
    }
    await fileExists(path.resolve("docs/decisions/0010-grill-to-tickets-fresh-context-design-review.md"));
  });

  it("sweeps every restatement of a fact that FIX_THEN_SHIP corrects", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /\*\*`FIX_THEN_SHIP`\*\*[^\n]*\n[^\n]*sweep the spec so every passage restating the same fact/);
    }
    for (const dir of skillDirs) {
      const gate = await readFile(path.resolve(dir, "references/design-review-gate.md"), "utf8");
      const fix = gate.slice(gate.indexOf("### `FIX_THEN_SHIP`"), gate.indexOf("### `REWORK` — spec-level"));
      assert.match(fix, /\*\*sweep\*\* the spec/);
      assert.match(fix, /done when a search for the old wording finds\s+nothing/);
      assert.match(fix, /`specEdits`/);
      assert.match(gate, /^- `specEdits` — /m, "each cycle records its spec edits");
    }
  });

  it("normalizes every scrutinize verdict without paraphrasing", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      for (const verdict of ["SHIP", "FIX_THEN_SHIP", "REWORK", "REJECT"]) {
        assert.match(content, new RegExp(verdict));
      }
    }
  });

  it("distinguishes spec-level rework from decision-level rework", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /spec-level/i);
      assert.match(content, /decision-level/i);
      // spec-level re-runs to-spec; decision-level returns to Stage 0
      assert.match(content, /decision-level[\s\S]{0,400}Stage 0/i);
    }
  });

  it("bounds the design review gate: six cycles, stall, no counter reset, human authorization", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /\b(6|six)\b/i);
      assert.match(content, /stall/i);
      assert.match(content, /human authoriz/i);
      assert.match(content, /carries over|never reset/i);
    }
  });

  it("halts REJECT instead of auto-resuming grilling", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /REJECT[\s\S]{0,300}(stop|halt)/i);
    }
  });

  it("keeps .scratch/ out of git: ensures a local exclude and asks for no commit of it", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      const storage = content.slice(content.indexOf("## Feature-Scoped Storage"), content.indexOf("## Stage 0"));
      assert.match(storage, /git check-ignore -q \.scratch\//);
      assert.match(storage, /git rev-parse --git-path info\/exclude/);
      assert.match(storage, /changes no tracked file/);
      const handoff = content.slice(content.indexOf("## Stop — Handoff"), content.indexOf("## Constraints"));
      assert.doesNotMatch(handoff, /Commit \.scratch\//, "the handoff must not ask to commit .scratch/");
    }
  });

  it("prints the catalog commit, /clear, then directory-implementer handoff", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      const handoff = content.slice(content.indexOf("## Stop — Handoff"));
      assert.match(handoff, /\.scratch\/ is local and git-ignored[\s\S]*Commit any\s+change to docs\/reuse-catalog\.md[\s\S]*clean\s+working tree/);
      assert.match(handoff, /\/clear/);
      assert.match(handoff, /\/subagent-implement \.scratch\/<feature-slug>\//);
      assert.match(handoff, /\/agy-implement[\s\S]{0,40}\/opencode-implement/);
      assert.ok(
        handoff.indexOf("Commit") < handoff.indexOf("/clear") &&
          handoff.indexOf("/clear") < handoff.indexOf("/subagent-implement"),
        "catalog commit, then /clear, then the implementer",
      );
    }
  });

  it("carries reuse into tickets: one owner per shared module and a Reuse field", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      const stage3 = content.slice(content.indexOf("## Stage 3"), content.indexOf("## Stop"));
      assert.match(stage3, /owner\s+ticket/i);
      assert.match(stage3, /\*\*Reuse:\*\*/);
      for (const verb of ["use", "extend", "create-shared", "create-candidate", "promote"]) {
        assert.match(stage3, new RegExp(`\`${verb}\``), `Stage 3 names the verb ${verb}`);
      }
      assert.match(stage3, /out of the\s+acceptance criteria/i);
    }
    for (const dir of skillDirs) {
      const pass = await readFile(path.resolve(dir, "references/reuse-pass.md"), "utf8");
      const stage3 = pass.slice(pass.indexOf("## Stage 3"));
      assert.match(stage3, /exactly one \*\*owner ticket\*\*/);
      assert.match(stage3, /`Blocked by`/);
      assert.match(stage3, /directly after `\*\*Blocked by:\*\*`/);
      assert.match(stage3, /`\*\*Reuse:\*\* none`/);
      assert.match(stage3, /map every acceptance criterion to a new test/);
      assert.match(stage3, /Check before the quiz/);
    }
  });

  it("runs the ticket checker before the quiz and traces every ticket to its stories", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      const stage3 = content.slice(content.indexOf("## Stage 3"), content.indexOf("## Stop"));
      assert.match(stage3, /`\*\*Stories:\*\*` line after `\*\*Reuse:\*\*`/);
      assert.match(stage3, /node <this skill's directory>\/scripts\/check-tickets\.mjs \.scratch\/<feature-slug>\//);
      assert.match(stage3, /\(scripts\/check-tickets\.mjs\)/);
      assert.match(stage3, /story-coverage table/);
      assert.match(stage3, /Re-run the checker after every change/);
      assert.match(stage3, /`result: PASS`/, "Stage 3 ends on a passing check");
    }
    for (const dir of skillDirs) {
      const pass = await readFile(path.resolve(dir, "references/reuse-pass.md"), "utf8");
      const check = pass.slice(pass.indexOf("### Check before the quiz"));
      assert.match(check, /scripts\/check-tickets\.mjs/);
      assert.match(check, /no reuse statement sits among the acceptance criteria/);
      assert.match(pass, /one module per bullet, its symbol first and in backticks/);
    }
  });

  it("preflights the three stage skills across install locations and keeps the tracker local", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      const preflight = content.slice(content.indexOf("## Preflight"), content.indexOf("## Feature-Scoped Storage"));
      assert.ok(preflight.startsWith("## Preflight"), "SKILL.md has a Preflight section before storage");
      const order = [
        ".agents/skills/<skill>/SKILL.md",
        ".claude/skills/<skill>/SKILL.md",
        "~/.agents/skills/<skill>/SKILL.md",
        "~/.claude/skills/<skill>/SKILL.md",
      ].map((p) => preflight.indexOf(p));
      assert.ok(order.every((i) => i !== -1), "all four locations are listed");
      assert.deepEqual([...order].sort((a, b) => a - b), order, "project installs are searched before global ones");
      assert.match(preflight, /stop before Stage 0/);
      for (const [source, skill] of [
        ["mattpocock/skills", "grilling"],
        ["mattpocock/skills", "domain-modeling"],
        ["thananon/9arm-skills", "scrutinize"],
      ]) {
        assert.ok(preflight.includes(`npx skills add ${source} --skill ${skill}`), `install line for ${skill}`);
      }
      assert.ok(!preflight.includes("to-spec"), "no install line for to-spec");
      assert.ok(!preflight.includes("to-tickets"), "no install line for to-tickets");
      assert.match(preflight, /skills-lock\.json/);
      assert.match(preflight, /computedHash/);
      assert.match(preflight, /~\/\.agents\/\.skill-lock\.json/);
      assert.match(preflight, /skillFolderHash/);
      assert.match(preflight, /no lock entry/);
      assert.match(preflight, /npx skills check/);
      assert.match(content, /at the\s+path Preflight found/);
      assert.match(content, /local files are the tracker/);
    }
  });

  it("forbids modifying upstream-tracked skills or the lock file", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      assert.match(content, /grill-with-docs/);
      assert.match(content, /skills-lock\.json/);
      assert.match(content, /mattpocock/i);
    }
  });

  it("ships Codex metadata that blocks implicit invocation", async () => {
    for (const dir of skillDirs) {
      const yaml = await readFile(path.resolve(dir, "agents/openai.yaml"), "utf8");
      assert.match(yaml, /display_name:/);
      assert.match(yaml, /short_description:/);
      assert.match(yaml, /\$grill-to-tickets/);
      assert.match(yaml, /allow_implicit_invocation:\s*false/);
    }
  });

  it("keeps the design-review-gate reference and resolves every SKILL.md link", async () => {
    for (const dir of skillDirs) {
      const skillDir = path.resolve(dir);
      const content = await readFile(path.join(skillDir, "SKILL.md"), "utf8");
      const links = localSkillLinks(content);
      assert.ok(links.length > 0, "SKILL.md links to at least one reference file");
      for (const link of links) {
        await fileExists(path.resolve(skillDir, link.split("#")[0]));
      }
      const gate = await readFile(path.join(skillDir, "references/design-review-gate.md"), "utf8");
      for (const verdict of ["SHIP", "FIX_THEN_SHIP", "REWORK", "REJECT"]) {
        assert.match(gate, new RegExp(verdict));
      }
      assert.match(gate, /spec-level/i);
      assert.match(gate, /decision-level/i);
      assert.match(gate, /stall/i);
    }
  });

  it("publishes a bilingual human guide with the install command", async () => {
    const guide = await readFile(path.resolve("docs/skills/agents/grill-to-tickets.md"), "utf8");
    assert.match(guide, /^## ภาษาไทย \/ Thai\s*$/m);
    assert.match(guide, /^## English \/ ภาษาอังกฤษ\s*$/m);
    assert.match(guide, /npx skills add ArrayaWongsaita\/skills --skill grill-to-tickets/);
  });

  it("owns spec-format.md adapted from to-spec with upstream source line and license", async () => {
    for (const dir of skillDirs) {
      const specFormatPath = path.resolve(dir, "references/spec-format.md");
      await fileExists(specFormatPath);
      const content = await readFile(specFormatPath, "utf8");

      // Opens with source line naming mattpocock/skills, skill path, computedHash as sha256 folder hash
      const firstLine = content.split("\n")[0];
      assert.match(firstLine, /mattpocock\/skills/);
      assert.match(firstLine, /skills\/engineering\/to-spec\/SKILL\.md/);
      assert.match(firstLine, /3fa1a0695d4ea242fae9e569e4d22aa1788623197abb33bfadafae7315789bbf/);
      assert.match(firstLine, /sha256 folder hash/);
      assert.match(firstLine, /\[UPSTREAM-LICENSE\.md\]\(UPSTREAM-LICENSE\.md\)/);

      // UPSTREAM-LICENSE.md exists and contains upstream MIT notice verbatim
      const licensePath = path.resolve(dir, "references/UPSTREAM-LICENSE.md");
      await fileExists(licensePath);
      const license = await readFile(licensePath, "utf8");
      assert.match(license, /^MIT License\s+Copyright \(c\) 2026 Matt Pocock/m);
      assert.match(license, /Permission is hereby granted, free of charge/);

      // Process & template
      assert.match(content, /explore/i);
      assert.match(content, /seam/i);
      for (const section of [
        "Problem Statement",
        "Solution",
        "User Stories",
        "Implementation Decisions",
        "Testing Decisions",
        "Out of Scope",
        "Further Notes",
      ]) {
        assert.match(content, new RegExp(`## ${section}`));
      }
      assert.match(content, /### Reuse Plan/);
      assert.match(content, /every decision in the log|every logged decision/i);
      assert.match(content, /blind-spot assumption/i);
      assert.match(content, /heading.*never.*repeat|unique/i);
      assert.match(content, /bold lines/i);
      assert.match(content, /### Changed tests and wording/);

      // No tracker, label, or /setup-matt-pocock-skills
      assert.doesNotMatch(content, /tracker/i);
      assert.doesNotMatch(content, /ready-for-agent/i);
      assert.doesNotMatch(content, /\/setup-matt-pocock-skills/);
    }
  });

  it("owns ticket-format.md adapted from to-tickets with upstream source line and license", async () => {
    for (const dir of skillDirs) {
      const ticketFormatPath = path.resolve(dir, "references/ticket-format.md");
      await fileExists(ticketFormatPath);
      const content = await readFile(ticketFormatPath, "utf8");

      // Opens with source line naming mattpocock/skills, skill path, computedHash as sha256 folder hash
      const firstLine = content.split("\n")[0];
      assert.match(firstLine, /mattpocock\/skills/);
      assert.match(firstLine, /skills\/engineering\/to-tickets\/SKILL\.md/);
      assert.match(firstLine, /bf5e6ebcb4f1272de0c188d5b3901f265a03d1fa9935a21a7a56938e21e2e761/);
      assert.match(firstLine, /sha256 folder hash/);
      assert.match(firstLine, /\[UPSTREAM-LICENSE\.md\]\(UPSTREAM-LICENSE\.md\)/);

      // Process & vertical slices
      assert.match(content, /vertical slice/i);
      assert.match(content, /prefactor/i);
      assert.match(content, /expand–contract|expand-contract/i);
      assert.match(content, /quiz/i);
      assert.match(content, /# <NN>:/);
      assert.match(content, /\*\*What to build:\*\*/);
      assert.match(content, /\*\*Blocked by:\*\*/);

      // Acceptance criteria rules
      assert.match(content, /suite.*typecheck.*lint.*not acceptance criteria|not acceptance criteria/i);
      assert.match(content, /testable statement/i);
      assert.match(content, /no file paths|avoid specific file paths/i);

      // No tracker, label, or /setup-matt-pocock-skills
      assert.doesNotMatch(content, /tracker/i);
      assert.doesNotMatch(content, /triage label/i);
      assert.doesNotMatch(content, /\/setup-matt-pocock-skills/);
    }
  });

  it("points SKILL.md, design-review-gate, and reuse-pass at owned formats", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");

      // Intro and diagram
      assert.match(content, /spec-format\.md/);
      assert.match(content, /ticket-format\.md/);
      assert.match(content, /locate the five stage skills/);

      // Inline Execution
      const inlineSection = content.slice(content.indexOf("## Inline Execution"), content.indexOf("## Preflight"));
      assert.match(inlineSection, /Stages 0, 1, and 3 run \*\*inline\*\*/);
      assert.match(inlineSection, /at the\s+path Preflight found/);
      for (const skill of ["grilling", "domain-modeling", "scrutinize"]) {
        assert.match(inlineSection, new RegExp(skill));
      }
      assert.match(inlineSection, /spec-format\.md/);
      assert.match(inlineSection, /ticket-format\.md/);
      assert.doesNotMatch(inlineSection, /tracker/i);

      // Feature-Scoped Storage carries "local files are the tracker"
      const storageSection = content.slice(content.indexOf("## Feature-Scoped Storage"), content.indexOf("## Stage 0"));
      assert.match(storageSection, /local files are the tracker/);

      // Stage 1 follows spec-format.md
      const stage1 = content.slice(content.indexOf("## Stage 1"), content.indexOf("## Stage 2"));
      assert.match(stage1, /spec-format\.md/);
      assert.match(stage1, /every\s+decision in the log appears in it/);
      assert.match(stage1, /### Reuse Plan/);

      // Stage 2 rework names Stage 1
      const stage2 = content.slice(content.indexOf("## Stage 2"), content.indexOf("## Stage 3"));
      assert.match(stage2, /re-run Stage 1/);
      assert.doesNotMatch(stage2, /re-run `?to-spec`?/);

      // Stage 3 follows ticket-format.md
      const stage3 = content.slice(content.indexOf("## Stage 3"), content.indexOf("## Stop"));
      assert.match(stage3, /ticket-format\.md/);
      assert.match(stage3, /Re-run the checker after every change/);
      assert.match(stage3, /story-coverage table/);
      assert.match(stage3, /`result: PASS`/);
    }

    for (const dir of skillDirs) {
      // design-review-gate.md
      const gate = await readFile(path.resolve(dir, "references/design-review-gate.md"), "utf8");
      assert.match(gate, /Stage 3 \(`ticket-format\.md`\)/);
      assert.match(gate, /re-run Stage 1 inline/);
      assert.match(gate, /Stage 1 cannot/);
      assert.match(gate, /re-run Stage 1 and re-review/);
      assert.match(gate, /re-run Stage 1 with the finding/);
      assert.doesNotMatch(gate, /`to-spec`/);
      assert.doesNotMatch(gate, /`to-tickets`/);

      // reuse-pass.md line 99
      const reusePass = await readFile(path.resolve(dir, "references/reuse-pass.md"), "utf8");
      assert.match(reusePass, /`spec-format\.md`'s rule/);
      assert.doesNotMatch(reusePass, /`to-spec`'s rule/);
    }
  });
});
