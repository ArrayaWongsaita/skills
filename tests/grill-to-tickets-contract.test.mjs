import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { assertAbsentFromMarkdownSections, assertSkillMarkdownSectionsDoNotMatch, markdownHeaderBlock, markdownHeadings, markdownSection } from "./helpers/markdown-contract.mjs";

async function fileExists(filePath) {
  await access(filePath, constants.R_OK);
}

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(filePath) : [filePath];
  }));
  return nested.flat();
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

function assertPattern(text, pattern, message) {
  assert.ok(pattern.test(text), message ?? `expected text to match ${pattern}`);
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

  it("keeps the manifest out of the three implementer skills and their references", async () => {
    for (const implementer of ["subagent-implement", "agy-implement", "opencode-implement"]) {
      const directory = path.resolve("skills/agents", implementer);
      const files = [path.join(directory, "SKILL.md"), ...(await filesUnder(path.join(directory, "references")))];
      for (const file of files) {
        assertAbsentFromMarkdownSections(
          await readFile(file, "utf8"),
          /\bmanifest\b/i,
          `${file} must not depend on the manifest`,
        );
      }
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
      assert.match(log, /maximum and rounds used from State/, "resume reads the gate maximum and rounds used");
      assert.match(log, /never refill spent rounds/, "resume keeps spent rounds spent");

      const gate = await readFile(path.resolve(dir, "references/design-review-gate.md"), "utf8");
      assert.match(gate, /this finding and `decisions\.md` to a fresh writer/);
      assert.doesNotMatch(markdownSection(gate, "Reviewer"), /transcript/i, "the REWORK test reads the log, not a transcript");
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
      const inlineSection = markdownSection(content, "Inline Execution");
      assertPattern(inlineSection, /Stages 0, 1, and 3 run \*\*inline\*\*/);
      assertPattern(inlineSection, /Two steps dispatch a subagent, and neither decides/, "both review steps dispatch and neither decides");
      assertPattern(inlineSection, /Stage 2 design reviewer[\s\S]*Stage 3\.5 ticket reviewer/, "the sentences after the inline statement name both reviewers");
    }
    for (const dir of skillDirs) {
      const gate = await readFile(path.resolve(dir, "references/design-review-gate.md"), "utf8");
      const report = markdownSection(gate, "Stable report");
      const reviewer = gate.slice(gate.indexOf("## Reviewer"), gate.indexOf("## Verdict vocabulary"));
      assert.ok(reviewer.startsWith("## Reviewer"), "the gate reference has a Reviewer section");
      for (const brief of ["**Paths:**", "**Task:**", "**Prior findings,**", "**Return:**"]) {
        assert.ok(reviewer.includes(brief), `the reviewer brief names ${brief}`);
      }
      assert.match(reviewer, /edits no file/);
      assert.match(reviewer, /`reviewer: inline`/, "the inline fallback is recorded");
      assert.match(report, /^- `reviewer` — /m, "each cycle records its reviewer");
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

  it("bounds the design review gate by the user's rounds, not a fixed budget", async () => {
    for (const dir of skillDirs) {
      const skill = await readFile(path.resolve(dir, "SKILL.md"), "utf8");
      const gate = await readFile(path.resolve(dir, "references/design-review-gate.md"), "utf8");
      const stage2 = markdownSection(skill, "Stage 2 — Design Review Gate");
      const budget = markdownSection(gate, "Budget and early stops");
      assert.ok(stage2, "SKILL.md has a Stage 2 section");
      assert.ok(budget, "design-review-gate.md has the budget and early-stops section");
      for (const content of [stage2, budget]) {
        assert.match(content, /at most\s+how many rounds/i, "Stage 2 asks for a maximum number of rounds");
        assert.match(content, /(propose|Propose)\s+(\*\*)?3/, "the proposed default is 3");
        assert.match(content, /`0` skips the review/, "0 skips the review");
        assert.match(content, /--review N/, "--review N answers the entry question");
        assert.match(content, /a?\s*missing or invalid value\s+falls back to asking/i, "missing or invalid --review values fall back to asking");
        assert.match(content, /stall/i);
        assert.match(content, /add\s+(more\s+)?rounds/i);
        assert.match(content, /Known\s+unresolved\s+review\s+findings/);
        assert.match(content, /carries over|never reset|rounds spent stay spent|without refilling/i);
        assert.doesNotMatch(content, /\bsix[- ]cycle|cycle 6|\b6 cycles|human authoriz|fresh budget/i, "no fixed six-cycle bound remains in the gate section");
      }
      assert.match(budget, /Go on\*\* is the default/, "going on is the default at the exit");
      assert.match(budget, /there is no default\s+number/, "added rounds have no default number");
      assert.match(budget, /`maxRounds`[\s\S]*`roundsUsed`/, "the report records the maximum and rounds used");
      assert.match(budget, /`REJECT` is not part of this exit: it stops the run at once/);
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

  it("carries no reuse contract: no survey, catalog, Reuse Plan, Reuse field, or reuse lens", async () => {
    await assertSkillMarkdownSectionsDoNotMatch(
      skillDirs,
      /reuse-catalog|Reuse Catalog|Reuse Plan|Reuse survey|reuse lens|\*\*Reuse:\*\*|reuse-pass/i,
      "grill-to-tickets carries no reuse contract",
    );
    for (const dir of skillDirs) {
      for (const gone of ["references/reuse-pass.md", "references/reuse-catalog-template.md"]) {
        await assert.rejects(access(path.resolve(dir, gone)), `${gone} is removed`);
      }
      const check = await readFile(path.resolve(dir, "scripts/check-tickets.mjs"), "utf8");
      const parserStart = check.indexOf("export function parseTicket(");
      const parserEnd = check.indexOf("\nexport function estimateTokens", parserStart);
      assert.ok(parserStart >= 0 && parserEnd > parserStart, "the checker has a parseTicket function");
      const ticketParser = check.slice(parserStart, parserEnd);
      assert.doesNotMatch(ticketParser, /Reuse Plan|REUSE_VERBS|parseReusePlan/, "the ticket parser no longer validates reuse");
    }
  });

  it("prints /clear, then the directory-implementer handoff", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      const handoff = content.slice(content.indexOf("## Stop — Handoff"));
      assert.match(handoff, /\.scratch\/ is local and git-ignored[\s\S]*clean\s+working tree/);
      assert.doesNotMatch(handoff, /catalog/i, "the handoff has no catalog-commit step");
      assert.match(handoff, /\/clear/);
      assert.match(handoff, /\/subagent-implement \.scratch\/<feature-slug>\//);
      assert.match(handoff, /\/agy-implement[\s\S]{0,40}\/opencode-implement/);
      assert.ok(
        handoff.indexOf("/clear") < handoff.indexOf("/subagent-implement"),
        "/clear, then the implementer",
      );
    }
  });

  it("Stage 3 follows SHIP, a zero skip, or the user's choice to go on after exhaustion or stall", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      const stage3 = markdownSection(content, "Stage 3 — Tickets");
      assert.ok(stage3, "SKILL.md has a Stage 3 section");
      assert.match(
        stage3,
        /After `SHIP`, a recorded `0` skip, or the user's choice to go on after\s+exhaustion or stall/,
        "all three allowed routes reach Stage 3",
      );
    }
  });

  it("runs the ticket checker before the quiz and traces every ticket to its stories", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      const stage3 = content.slice(content.indexOf("## Stage 3"), content.indexOf("## Stop"));
      assert.match(stage3, /`\*\*Stories:\*\*` line after `\*\*Blocked by:\*\*`/);
      assert.match(stage3, /node <this skill's directory>\/scripts\/check-tickets\.mjs \.scratch\/<feature-slug>\//);
      assert.match(stage3, /\(scripts\/check-tickets\.mjs\)/);
      assert.match(stage3, /story-coverage table/);
      assert.match(stage3, /Re-run the checker after every change/);
      assert.match(stage3, /`result: PASS`/, "Stage 3 ends on a passing check");
    }
  });

  it("runs Stage 3 as draft, --write-budget, fix, quiz, re-run, and settles every warning in the log", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      const stage3 = content.slice(content.indexOf("## Stage 3"), content.indexOf("## Stop"));
      assert.match(
        stage3,
        /draft[\s\S]*--write-budget[\s\S]*fix[\s\S]*quiz/i,
        "Stage 3 orders draft -> --write-budget -> fix errors -> quiz",
      );
      assert.match(
        stage3,
        /Re-run the checker after every change[^\n]*--write-budget/,
        "each change is re-checked with --write-budget",
      );
      assert.match(
        stage3,
        /Seam[\s\S]*Context[\s\S]*Budget[\s\S]*story-coverage\s+table[\s\S]*budget\s+table[\s\S]*DAG\s+summary[\s\S]*warning/i,
        "the quiz shows each ticket's Seam, Context, and Budget, the coverage and budget tables, the DAG summary, and every warning",
      );
      assert.match(stage3, /`result: PASS`/);
      assert.match(stage3, /## Ticket warnings/);
      assert.match(stage3, /— acknowledged/);
      assert.match(stage3, /— fixed: <change>/);
      assert.match(stage3, /user\s+approves/i);
    }
    for (const dir of skillDirs) {
      const log = await readFile(path.resolve(dir, "references/decision-log.md"), "utf8");
      assert.match(log, /^## Ticket warnings$/m, "the log carries Ticket warnings entries");
      assert.match(log, /— acknowledged/);
      assert.match(log, /— fixed: <change>/);
    }
  });

  it("prints the DAG summary and recommended implementer between /clear and the implementer commands", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      const handoff = content.slice(content.indexOf("## Stop — Handoff"));
      const clearIndex = handoff.indexOf("/clear");
      const implementerIndex = handoff.indexOf("/subagent-implement");
      assert.ok(clearIndex !== -1 && implementerIndex !== -1, "the handoff has /clear and the implementer command");
      const between = handoff.slice(clearIndex + "/clear".length, implementerIndex);
      assert.match(between, /DAG summary/i, "the DAG summary sits after /clear");
      assert.match(between, /recommended implementer/i, "the recommendation sits after /clear");
      const recommendation = between.split("\n").find((line) => /recommended implementer/i.test(line));
      assert.ok(recommendation, "the DAG summary carries the recommendation line");
      assert.doesNotMatch(recommendation, /\//, "the recommended skills carry no leading slash");
    }
  });

  it("lists the checker-derived manifest and conditionally places its path after the DAG summary", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");
      const storage = content.slice(content.indexOf("## Feature-Scoped Storage"), content.indexOf("## Stage 0"));
      const handoff = content.slice(content.indexOf("## Stop — Handoff"));

      assert.match(storage, /├── issues\/[^\n]*\n└── manifest\.json\s+# derived by the ticket checker/i,
        "the storage tree lists the manifest beside issues and marks it as checker-derived");

      const manifestLines = handoff.split("\n").filter((line) =>
        /Manifest: \.scratch\/<feature-slug>\/manifest\.json/.test(line));
      assert.equal(manifestLines.length, 1, "the handoff names the manifest path on one line");
      const [manifestLine] = manifestLines;
      assert.doesNotMatch(manifestLine, /recommended implementer/i,
        "the manifest line does not match the recommended-implementer phrase");

      const dagEnd = handoff.indexOf("recommended implementer:");
      const manifestIndex = handoff.indexOf(manifestLine);
      const implementerIntro = handoff.indexOf("Then implement the whole ticket directory");
      const implementerCommand = handoff.indexOf("/subagent-implement");
      assert.ok(
        dagEnd !== -1 && dagEnd < manifestIndex && manifestIndex < implementerIntro && implementerIntro < implementerCommand,
        "the manifest line follows the DAG summary and precedes the implementer command",
      );

      assert.match(handoff, /line appears only when the last checker run exited 0/i,
        "the manifest line requires a successful final checker run");
      assert.match(handoff, /omit it when\s+the checker could not run or could not write the manifest/i,
        "the line is omitted when the checker could not run or write the manifest");
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
      const templateStart = content.indexOf("## Spec Template");
      const templateFenceStart = content.indexOf("```", templateStart);
      const templateFenceEnd = content.indexOf("```", templateFenceStart + 3);
      assert.ok(templateFenceStart >= 0 && templateFenceEnd > templateFenceStart, "the spec template is a fenced block");
      const specTemplate = content.slice(templateFenceStart, templateFenceEnd);
      assert.doesNotMatch(specTemplate, /### Reuse Plan/);
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

  it("requires a one-line Scenario under every story in new specs", async () => {
    for (const dir of skillDirs) {
      const format = await readFile(path.resolve(dir, "references/spec-format.md"), "utf8");
      const templateStart = format.indexOf("## Spec Template");
      const templateFenceStart = format.indexOf("```", templateStart);
      const templateFenceEnd = format.indexOf("```", templateFenceStart + 3);
      const template = format.slice(templateFenceStart, templateFenceEnd);
      assert.match(template, /^\s+Scenario: given <precondition> when <action> then <outcome>$/m);
      const userStoriesStart = template.indexOf("## User Stories");
      const implementationDecisionsStart = template.indexOf("## Implementation Decisions", userStoriesStart);
      const userStories = template.slice(userStoriesStart, implementationDecisionsStart);
      assert.match(userStories, /Every new spec carries at least one `Scenario:` line under every story\./i);
      assert.match(userStories, /A\s+Scenario is one line\./i);

      const skill = await readFile(path.resolve(dir, "SKILL.md"), "utf8");
      const stage1 = skill.slice(skill.indexOf("## Stage 1"), skill.indexOf("## Stage 2"));
      assert.match(stage1, /For every new spec, write at\s+least one `Scenario:` line under every story\./i);

      const checker = await readFile(path.resolve(dir, "scripts/check-tickets.mjs"), "utf8");
      const header = checker.slice(0, checker.indexOf("import {"));
      assert.match(header, /new specs carry one or more Scenario lines under every story/i);
      assert.match(header, /a spec with[\s\S]*no Scenario line[\s\S]*warns/i);
      assert.match(header, /whole words given, when, then/i);
      assert.match(header, /outside a story,[\s\S]*indentation, then keyword/i);
      assert.match(header, /multiple Scenario lines under one story/i);
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

  it("ticket-format.md's quiz step shows Budget and the checker's tables, DAG summary, and warnings, as Stage 3 does", async () => {
    for (const dir of skillDirs) {
      const content = await readFile(path.resolve(dir, "references/ticket-format.md"), "utf8");
      const from = content.indexOf("### 4. Quiz the user");
      const to = content.indexOf("### 5.", from);
      assert.ok(from >= 0 && to > from, "ticket-format.md has a quiz step between ### 4. and ### 5.");
      const quiz = content.slice(from, to);

      assert.match(quiz, /^- \*\*Budget\*\*:/m, "the quiz lists each ticket's Budget line");
      assert.match(quiz, /story-coverage table/, "the quiz shows the checker's story-coverage table");
      assert.match(quiz, /budget table/, "the quiz shows the checker's budget table");
      assert.match(quiz, /DAG summary[\s\S]{0,80}recommended implementer/, "the quiz shows the DAG summary with the recommended implementer");
      assert.match(quiz, /every warning/, "the quiz shows every warning");
      assert.match(quiz, /## Ticket warnings/, "each warning is logged under ## Ticket warnings");
      assert.match(quiz, /acknowledged[\s\S]{0,40}fixed/, "each warning is logged as acknowledged or fixed");
      assert.match(quiz, /--write-budget/, "the checker is re-run with --write-budget after each change");
    }
  });

  it("points SKILL.md and design-review-gate at owned formats", async () => {
    for (const file of skillFiles) {
      const content = await readFile(file, "utf8");

      // Intro and diagram
      assert.match(content, /spec-format\.md/);
      assert.match(content, /ticket-format\.md/);
      assert.match(content, /locate the three stage skills/);
      assert.doesNotMatch(content, /five stage skills/);

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
      assert.match(gate, /re-run Stage 1 inline with the finding/);
      assert.doesNotMatch(gate, /`to-spec`/);
      assert.doesNotMatch(gate, /`to-tickets`/);
    }
  });

  it("derives ticket acceptance criteria from delivered-story scenarios without checker comparison", async () => {
    for (const dir of skillDirs) {
      const ticketFormat = await readFile(path.resolve(dir, "references/ticket-format.md"), "utf8");
      const rulesStart = ticketFormat.indexOf("#### Rules for ticket contents and acceptance criteria");
      const rulesEnd = ticketFormat.indexOf("### 4. Quiz the user", rulesStart);
      assert.ok(rulesStart >= 0 && rulesEnd > rulesStart, "ticket-format.md has its criteria rules section");
      const rules = ticketFormat.slice(rulesStart, rulesEnd);

      assert.match(
        rules,
        /criteria derive from the scenarios of the stories (?:this ticket|the ticket) delivers/i,
        "criteria derive from scenarios belonging to the stories a ticket delivers",
      );
      assert.match(
        rules,
        /checker does not compare (?:acceptance )?criteria with scenarios/i,
        "the checker does not compare criteria with scenarios",
      );
    }
  });

  it("adds the conditional scenario-testability question to the Stage 2 Reviewer brief without changing review outcomes", async () => {
    for (const dir of skillDirs) {
      const gate = await readFile(path.resolve(dir, "references/design-review-gate.md"), "utf8");
      const reviewer = markdownSection(gate, "Reviewer");
      assert.ok(reviewer, "design-review-gate.md has a Reviewer section");

      assert.match(
        reviewer,
        /when the spec carries scenarios[\s\S]{0,200}ask whether each\s+scenario is testable at a seam named in Testing Decisions/i,
        "the scenario question applies when the spec carries scenarios",
      );
      assert.match(
        reviewer,
        /when the spec\s+carries no scenarios[\s\S]{0,100}omit (?:this|that) question/i,
        "the brief omits the scenario question when the spec has no scenarios",
      );
      assert.match(
        reviewer,
        /adds no new cycle, verdict, or\s+finding type/i,
        "the scenario question leaves the existing cycles, verdicts, and finding types unchanged",
      );
    }
  });

  it("carries the scenario rules in the Stage 3 body ahead of the review step", async () => {
    const skill = await readFile(path.resolve(canonicalDir, "SKILL.md"), "utf8");
    const stage3 = markdownSection(skill, "Stage 3 — Tickets");
    const body = stage3.slice(0, stage3.indexOf("Stage 3.5"));
    assertPattern(body, /acceptance criteria[\s\S]*Scenario/i, "ticket acceptance criteria come from the story's Scenario lines");
    assertPattern(body, /given[\s\S]*when[\s\S]*then[\s\S]*in order/i, "the checker enforces given, when, then in order");
    assertPattern(body, /under every story/i, "every story needs a Scenario");
    assertPattern(body, /without Scenarios[\s\S]*warning/i, "older specs without Scenarios pass with a warning");
    assertPattern(body, /\(references\/ticket-format\.md\)/, "the paragraph links ticket-format.md");
  });

  it("runs Stage 3.5 once after a passing check and before the quiz, with the whole-token skip flag", async () => {
    const skill = await readFile(path.resolve(canonicalDir, "SKILL.md"), "utf8");
    const invocation = markdownSection(skill, "Invocation");
    const stage2 = markdownSection(skill, "Stage 2 — Design Review Gate");
    const stage3 = markdownSection(skill, "Stage 3 — Tickets");
    const stage35 = stage3.slice(stage3.indexOf("Stage 3.5"), stage3.indexOf("Stage 3.5") + 2500);
    const gate = await readFile(path.resolve(canonicalDir, "references/design-review-gate.md"), "utf8");

    assertPattern(stage35, /Stage 3\.5\s+[—–-] Ticket review/i, "Stage 3 labels the step Stage 3.5 — Ticket review");
    assert.ok(stage3.indexOf("Stage 3.5") > stage3.indexOf("Fix every error"), "review follows error fixes");
    assertPattern(stage35, /run one review before the quiz/i, "Stage 3.5 precedes the quiz");
    assert.equal(
      markdownHeadings(skill).some(({ level, title }) => level === 2 && /^Stage 3\.5\b/.test(title)),
      false,
      "Stage 3.5 stays within Stage 3",
    );
    assertPattern(stage35, /after the checker prints `result: PASS`[\s\S]*run one review before the quiz/i, "Stage 3.5 runs once after a passing check and before the quiz");
    assertPattern(stage35, /one fresh reviewer/, "Stage 3.5 dispatches one fresh reviewer");
    assertPattern(invocation, /`--ticket-review 0`[\s\S]*whole token[\s\S]*other value[^\n]*absent/i, "the invocation paragraph documents exact skip-flag matching");
    assertPattern(stage35, /`--ticket-review 0`[\s\S]*whole token[\s\S]*other value[^\n]*absent/i, "Stage 3.5 documents exact skip-flag matching");
    assertPattern(stage35, /absent flag[^\n]*runs the review\s+once/i, "an absent flag runs the review once");
    assertPattern(stage35, /no subagent[\s\S]*main context[\s\S]*`reviewer: inline`/i, "no-subagent harnesses run inline and record the reviewer");
    assert.doesNotMatch(stage2, /--ticket-review/);
    assert.doesNotMatch(gate, /--ticket-review/);
  });

  it("initializes and resumes the ticket-review State from the log", async () => {
    const skill = await readFile(path.resolve(canonicalDir, "SKILL.md"), "utf8");
    const stage0 = markdownSection(skill, "Stage 0 — Grill");
    const stage0Step1 = stage0.slice(stage0.indexOf("1. **Ground"), stage0.indexOf("2. **Relentless"));
    const log = await readFile(path.resolve(canonicalDir, "references/decision-log.md"), "utf8");
    const format = markdownSection(log, "Format");
    const resume = markdownSection(log, "Resume — `continue <feature-slug>`");

    assertPattern(stage0Step1, /creates `decisions\.md`[\s\S]*`ticket review: skipped`[\s\S]*`ticket review: pending`/,
      "Stage 0 initializes the review State from the skip flag");
    assertPattern(format, /State[\s\S]*`ticket review: pending`, `done`, or\s+`skipped`[\s\S]*key becomes `done` after the review/i,
      "the log defines the review State values and completion transition");
    assertPattern(resume, /State key wins over (?:any|all) invocation flags?/i,
      "a saved review State takes precedence over invocation flags");
    assertPattern(resume, /explicit\s+`--ticket-review 0` turns `pending` into `skipped`/,
      "an explicit zero skips a pending review");
    assertPattern(resume, /`done` review stays[\s\S]{0,100}`done` with every flag/,
      "an explicit zero leaves a done review done");
    assertPattern(resume, /State with\s+no `ticket review` key[\s\S]*invocation's flag[\s\S]*otherwise runs the\s+review once/i,
      "an older State follows the invocation flag and defaults to one review");
  });

  it("logs ticket-review verdicts and resumes open questions without changing done or skipped State", async () => {
    const log = await readFile(path.resolve(canonicalDir, "references/decision-log.md"), "utf8");
    const ticketReview = markdownSection(log, "Format");
    const resume = markdownSection(log, "Resume — `continue <feature-slug>`");

    assertPattern(ticketReview, /^- reviewer: subagent$/m,
      "the review log records its reviewer");
    assertPattern(ticketReview, /reviewer line, either `- reviewer: subagent` or\s+`- reviewer: inline`/i,
      "the reviewer line allows inline review");
    assertPattern(ticketReview, /- NN READY/,
      "the review log has one READY line per ticket");
    assertPattern(ticketReview, /- NN ASK: <question>/,
      "the review log records each ASK question");
    assertPattern(ticketReview, /ASK: <question>[\s\S]{0,120}— resolved: <change>/,
      "a resolved ASK records its change");
    assertPattern(ticketReview, /ASK: <question>[\s\S]{0,120}— acknowledged/,
      "an acknowledged ASK records its resolution");
    assertPattern(ticketReview, /- review skipped/,
      "a skipped review has a log line");
    assertPattern(resume, /read[\s\S]*## Ticket review[\s\S]*ASK questions? (?:that are )?still open/i,
      "resume reads verdicts to recover open ASK questions");
    assertPattern(resume, /`done` review stays[\s\S]*`skipped` review stays[\s\S]*`skipped`/i,
      "resume preserves completed and skipped reviews");
  });

  it("requires settled ticket-review state and a successful final checker before Stage 3 is done", async () => {
    const skill = await readFile(path.resolve(canonicalDir, "SKILL.md"), "utf8");
    const stage3 = markdownSection(skill, "Stage 3 — Tickets");

    assertPattern(stage3, /Stage 3 is done when[\s\S]*`ticket review`\s+State[\s\S]*`done` or\s+`skipped`[\s\S]*every `ASK` line[\s\S]*— resolved:[\s\S]*— acknowledged[\s\S]*either the last checker run exits 0 or, where Node is unavailable,\s+the by-hand checks listed in the script's header pass/i,
      "Stage 3 completion requires the review and ASK resolutions plus a successful checker or passing manual checks");
    assertPattern(stage3, /After a manifest write\s+failure,[\s\S]*report the failure[\s\S]*re-run the checker before finishing Stage 3/i,
      "Stage 3 reports a manifest failure and checks again before completion");
    assert.doesNotMatch(stage3, /\bNever\b/i, "the skill states completion rules positively");
    assert.doesNotMatch(stage3, /\bDo not\b/i, "the skill states completion rules positively");
  });

  it("briefs a read-only ambiguity review with READY or ASK and a missing-verdict fallback", async () => {
    const review = await readFile(path.resolve(canonicalDir, "references/ticket-review.md"), "utf8");
    const briefIntro = markdownHeaderBlock(review);
    const reviewer = markdownSection(review, "Reviewer");

    for (const pathText of [
      "issues/",
      "spec.md",
      "Context",
      ".scratch/<feature-slug>/CONTEXT.md",
      ".scratch/<feature-slug>/adr/",
      "docs/glossary.md",
      "docs/decisions/",
    ]) {
      assert.ok(reviewer.includes(pathText), `review brief names ${pathText}`);
    }
    assert.doesNotMatch(reviewer, /tracker/i);
    assertPattern(briefIntro, /one fresh reviewer/, "the brief assigns one fresh reviewer");
    assertPattern(reviewer, /edits nothing/, "the reviewer edits nothing");
    assertPattern(reviewer, /every file named in the tickets' `\*\*Context:\*\*`\s+lines/i, "the reviewer reads every Context-named file");
    assertPattern(reviewer, /fresh worker holding only that\s+ticket and what its\s+Context line lists[\s\S]*could start without asking anyone/i, "the brief asks whether a fresh worker can start");
    assertPattern(reviewer, /glossary, ADRs, and spec text outside the Context-named\s+sections[\s\S]{0,80}only to understand terms/i, "extra context explains terms without filling worker gaps");
    assertPattern(reviewer, /one line per ticket/i, "the reviewer returns one line per ticket");
    assertPattern(reviewer, /`NN READY` or `NN ASK: <question>`/, "the brief pins its one-line return format");
    assertPattern(reviewer, /ticket with no line in the\s+return is treated as `ASK` with the question `the\s+reviewer returned no verdict`/i, "a missing verdict becomes ASK with the stated question");
    assertPattern(reviewer, /exactly the verdicts `READY` or `ASK`/, "the verdicts are exactly READY and ASK");
    assertPattern(reviewer, /ambiguity only[\s\S]*sets no limit/i, "review reads for ambiguity and sets no limit");
    assertPattern(reviewer, /ambiguity-only form of the\s+readiness dry-run that ADR 0014 deferred/i, "the brief identifies its ADR 0014 relationship");
  });

  it("puts each ASK beside Seam, Context, and Budget and leaves its resolution to the person", async () => {
    const skill = await readFile(path.resolve(canonicalDir, "SKILL.md"), "utf8");
    const stage3 = markdownSection(skill, "Stage 3 — Tickets");
    const format = await readFile(path.resolve(canonicalDir, "references/ticket-format.md"), "utf8");
    const quizStart = format.indexOf("### 4. Quiz the user");
    const quizEnd = format.indexOf("### 5.", quizStart);
    const formatQuiz = format.slice(quizStart, quizEnd);

    for (const [label, quiz] of [["Stage 3", stage3], ["ticket-format.md", formatQuiz]]) {
      assertPattern(quiz, /each `ASK` question[\s\S]{0,200}Seam[\s\S]{0,100}Context[\s\S]{0,100}Budget/i, `${label} places ASK with ticket context`);
      assertPattern(quiz, /person decides[^\n]*fix or acknowledge/i, `${label} leaves the choice to the person`);
      assertPattern(quiz, /main\s+thread[\s\S]{0,80}waits?[\s\S]{0,80}seen/i, `${label} shows ASK before any fix`);
      assertPattern(quiz, /checker[^\n]*`--write-budget`/i, `${label} re-runs the budget-writing checker`);
      assertPattern(quiz, /second review[^\n]*only when the person asks/i, `${label} requires the person to ask for another review`);
    }
    for (const [label, quiz] of [["Stage 3", stage3], ["ticket-format.md", formatQuiz]]) {
      assertPattern(quiz, /`ASK` lines\s+name tickets as\s+numbered at review time/i, `${label} keeps review-time numbers`);
      assertPattern(quiz, /ticket[\s\S]{0,80}quiz removes[\s\S]{0,80}`— acknowledged`/i, `${label} acknowledges a removed ticket`);
      assertPattern(quiz, /tickets? (?:the )?quiz\s+creates[\s\S]{0,100}join a review only after the person\s+asks/i, `${label} leaves new tickets outside this review`);
    }
  });

  it("draws Stage 3.5 in the stage diagram and states it is the one dispatched step inside Stage 3", async () => {
    const skill = await readFile(path.resolve(canonicalDir, "SKILL.md"), "utf8");
    const diagram = markdownHeaderBlock(skill).match(/```\n([\s\S]*?)```/)?.[1] ?? "";
    const inline = markdownSection(skill, "Inline Execution");

    assertPattern(diagram, /Stage 3: Tickets[\s\S]*Stage 3\.5: Ticket review[\s\S]*Stop: handoff/, "the diagram places the ticket review between Stage 3 and the handoff");
    assertPattern(inline, /Stages 0, 1, and 3 run \*\*inline\*\*[\s\S]{0,400}ticket review is the one dispatched step inside\s+Stage 3[\s\S]{0,120}interview, the spec, and the ticket\s+writing remain inline/i,
      "Inline Execution says the ticket review is the one dispatched step inside Stage 3");
  });

  it("records the skipped, waiting, and done ticket-review State in Stage 3.5", async () => {
    const skill = await readFile(path.resolve(canonicalDir, "SKILL.md"), "utf8");
    const stage3 = markdownSection(skill, "Stage 3 — Tickets");
    const start = stage3.indexOf("**Stage 3.5");
    const end = stage3.indexOf("Stage 3 is done when");
    const stage35 = stage3.slice(start, end);

    assertPattern(stage35, /`--ticket-review 0`[\s\S]*`- review skipped`[\s\S]*`## Ticket review`[\s\S]*`ticket review: skipped`/, "a skipped review records the single line and the State key");
    assertPattern(stage35, /`waiting on: ticket-quiz approval`/, "the quiz sets waiting on ticket-quiz approval");
    assertPattern(stage35, /`ticket review:`[^\n]*`done`|`ticket review: done`/, "State ticket review becomes done after the review");
  });

  it("lists the Stage 3 completion conditions as a clean sentence", async () => {
    const skill = await readFile(path.resolve(canonicalDir, "SKILL.md"), "utf8");
    const stage3 = markdownSection(skill, "Stage 3 — Tickets");
    const done = stage3.slice(stage3.indexOf("Stage 3 is done when"), stage3.indexOf("After a manifest write"));

    assert.doesNotMatch(done, /—,/, "no stray comma after an em dash");
    assert.doesNotMatch(done, /\band\b[^.]*\band\b[^.]*\band\b/, "no doubled and-chain");
    for (const [pattern, label] of [
      [/every warning[\s\S]*`## Ticket warnings`[\s\S]*— acknowledged[\s\S]*— fixed: <change>/, "warnings logged"],
      [/`ticket review` State is `done` or\s+`skipped`/, "review State settled"],
      [/every `ASK` line[\s\S]*— resolved: <change>[\s\S]*— acknowledged/, "ASK lines settled"],
      [/the user approves the breakdown/, "user approval"],
      [/the last checker run exits 0/, "checker exit 0"],
    ]) assertPattern(done, pattern, `the completion list names ${label}`);
  });
});
