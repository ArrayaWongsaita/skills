import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { discoverSkills, renderIndex } from "../scripts/generate-skill-index.mjs";
import { markdownHeaderBlock, markdownHeadings, markdownSection } from "./helpers/markdown-contract.mjs";

async function fileExists(path) {
  await access(path, constants.R_OK);
}

async function readText(path) {
  return readFile(path, "utf8");
}

async function readTextOrNull(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function textFilesUnder(dir) {
  const files = [];
  for (const entry of await readdir(dir, { recursive: true })) {
    const full = path.join(dir, entry);
    try {
      files.push({ file: full, text: await readFile(full, "utf8") });
    } catch {
      // skip directories and unreadable entries
    }
  }
  return files;
}

function bulletLine(doc, label) {
  return doc.split("\n").find((line) => line.startsWith(`- **${label}**`)) ?? null;
}

function assertFirstMentionOrder(text, markers, message) {
  const flat = text.replace(/\s+/g, " ");
  const positions = markers.map((marker) => flat.indexOf(marker));

  markers.forEach((marker, index) => {
    assert.notEqual(positions[index], -1, `${message}: names ${marker}`);
  });
  for (let index = 1; index < markers.length; index += 1) {
    assert.ok(
      positions[index - 1] < positions[index],
      `${message}: ${markers[index - 1]} comes before ${markers[index]}`,
    );
  }
}

function frontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, "SKILL.md starts with YAML frontmatter");
  return match[1];
}

// The lines under a heading, up to the next heading of the same or a higher
// level; a "#" line inside a fenced block is not a heading.
function sectionOf(doc, heading) {
  const lines = doc.split("\n");
  const start = lines.indexOf(heading);
  if (start === -1) return null;

  const level = heading.match(/^#+/)[0].length;
  const body = [];
  let fenced = false;
  for (const line of lines.slice(start + 1)) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const next = fenced ? null : line.match(/^(#+) /);
    if (next && next[1].length <= level) break;
    body.push(line);
  }
  return body.join("\n");
}

function numberedMarkdownItem(section, number) {
  if (!section) return null;
  const lines = section.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`${number}. `));
  if (start === -1) return null;

  const rest = lines.slice(start + 1);
  const next = rest.findIndex((line) => /^\d+\. /.test(line));
  return [lines[start], ...(next === -1 ? rest : rest.slice(0, next))].join("\n");
}

function withoutCodeFences(text) {
  return text.replace(/^```[^\n]*\n[\s\S]*?^```$/gm, "");
}

// One "- `label` ..." bullet of a file list with its wrapped lines, on one line.
function listItem(list, label) {
  const lines = list.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`- \`${label}\``));
  if (start === -1) return null;

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line === "" || line.startsWith("- "));
  return [lines[start], ...(end === -1 ? rest : rest.slice(0, end))].join(" ").replace(/\s+/g, " ");
}

async function assertLinksToCanonicalContracts(file, section, language) {
  const links = [...section.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
  const canonicalFiles = [
    "skills/agents/grill-to-tickets/SKILL.md",
    "skills/agents/grill-to-tickets/references/ticket-review.md",
  ];

  for (const canonicalFile of canonicalFiles) {
    const expected = path.resolve(canonicalFile);
    assert.ok(
      links.some((target) => path.resolve(path.dirname(file), target) === expected),
      `${language} section links to ${canonicalFile} from ${file}`,
    );
    await fileExists(canonicalFile);
  }
}

// The glossary table row whose Term cell is `term`, backticks aside.
function tableRow(doc, term) {
  const row = doc
    .split("\n")
    .find((line) => line.startsWith("|") && line.split("|")[1].trim().replace(/`/g, "") === term);
  return row ?? null;
}

describe("personal AI skills repository contract", () => {
  it("documents the personal skills workspace and installation commands", async () => {
    const readme = await readText("README.md");

    assert.match(readme, /# Personal AI Skills/);
    assert.match(readme, /npx skills add ArrayaWongsaita\/skills --list/);
    assert.match(readme, /npx skills add ArrayaWongsaita\/skills --skill agent-instructions-architect/);
    assert.match(readme, /npx skills add ArrayaWongsaita\/skills --all/);
    assert.match(readme, /docs\/skills\/README\.md/);
    assert.match(readme, /scripts\/validate-skills\.mjs/);
    assert.doesNotMatch(readme, /link-skills\.sh|\.codex-plugin/);
  });

  it("includes setup files for local validation and generated documentation", async () => {
    await fileExists("scripts/validate-skills.mjs");
    await fileExists("scripts/generate-skill-index.mjs");
    await fileExists("docs/skills/README.md");
    await fileExists("docs/glossary.md");
    await fileExists("docs/decisions/0001-skill-library-layout.md");
  });

  it("shows the required skill frontmatter in the README example", async () => {
    const readme = await readText("README.md");
    const example = readme.match(/```markdown\n([\s\S]*?)\n```/);

    assert.ok(example, "README includes a SKILL.md example");
    const metadata = frontmatter(example[1]);
    assert.match(metadata, /^name:\s*my-skill$/m);
    assert.match(metadata, /^description:\s*.+AI agent.+$/m);
  });

  it("keeps the generated skill index in sync", async () => {
    const skills = await discoverSkills();
    const index = await readText("docs/skills/README.md");

    assert.equal(index, renderIndex(skills));
  });

  it("renders repeated skill flags for a multi-skill category", () => {
    const index = renderIndex([
      { category: "demo", name: "first-skill", description: "First skill description" },
      { category: "demo", name: "second-skill", description: "Second skill description" },
    ]);

    assert.match(index, /--skill first-skill \\\n  --skill second-skill/);
    assert.match(index, /\[คู่มือ \/ Guide\]\(demo\/first-skill\.md\)/);
    assert.match(index, /\[คู่มือ \/ Guide\]\(demo\/second-skill\.md\)/);
  });
});

const UPSTREAM_FORMAT_NAMES = /(^|[^-a-z])to-(spec|tickets)/;

function allowedUpstreamMention(file, lineNumber, line) {
  const normalized = file.split(path.sep).join("/");

  if (/references\/(spec-format|ticket-format)\.md$/.test(normalized)) {
    return lineNumber === 1 && /^Adapted from mattpocock\/skills/.test(line);
  }
  if (/references\/UPSTREAM-LICENSE\.md$/.test(normalized)) {
    return true;
  }
  if (/trigger-evals\.json$/.test(normalized)) {
    return line.includes('"query": "Use to-spec to turn what we just discussed into a spec."');
  }
  if (normalized.startsWith("tests/")) {
    return /doesNotMatch|includes\(|never|no .*left|renamed from|adapted from|engineering.*SKILL|re-runs? to-/i.test(line);
  }
  return false;
}

describe("grill-to-tickets production records and guides", () => {
  it("records ADR 0013: grill-to-tickets owns the spec and ticket formats", async () => {
    const doc = await readTextOrNull("docs/decisions/0013-grill-to-tickets-owns-spec-and-ticket-formats.md");

    assert.ok(doc, "ADR 0013 exists under docs/decisions/");
    assert.match(doc, /^# ADR 0013: grill-to-tickets owns the spec and ticket formats$/m);
    assert.match(doc, /- Status \/ สถานะ: Accepted/);
    assert.match(doc, /- Amends \/ แก้ไขบริบทของ: ADR 0003/);
    assert.match(doc, /## Context \/ บริบท/);
    assert.match(doc, /## Decision \/ การตัดสินใจ/);
    assert.match(doc, /## Rejected alternatives \/ ทางเลือกที่ไม่เลือก/);

    // Owned formats and upstream notice
    assert.match(doc, /references\/spec-format\.md/);
    assert.match(doc, /references\/ticket-format\.md/);
    assert.match(doc, /UPSTREAM-LICENSE\.md/);

    // The three stage skills stay installed dependencies
    for (const skill of ["grilling", "domain-modeling", "scrutinize"]) {
      assert.match(doc, new RegExp(skill), `ADR 0013 keeps ${skill}`);
    }

    // Preflight records the lock as found; updates go through the skills CLI
    assert.match(doc, /lock/i);
    assert.match(doc, /recomput|without comparison|no comparison/i);
    assert.match(doc, /npx skills check/);

    // Rejected alternatives
    assert.match(doc, /vendor(?:ing)? all five/i);
    assert.match(doc, /vendor(?:ing)? none/i);
    assert.match(doc, /known-good/i);
    assert.match(doc, /hash check/i);

    // Trade-off
    assert.match(doc, /no longer arrive automatically/i);
  });

  it("records ADR 0017: reuse is removed and the user bounds the design review", async () => {
    const doc = await readTextOrNull("docs/decisions/0017-drop-reuse-and-let-the-user-bound-the-design-review.md");
    assert.ok(doc, "ADR 0017 exists under docs/decisions/");
    const headings = markdownHeadings(doc).map(({ title }) => title);
    assert.equal(headings[0], "ADR 0017: Drop reuse, and let the user bound the design review");
    const header = markdownHeaderBlock(doc);
    assert.match(header, /^- Status \/ สถานะ: Accepted/m);
    assert.match(header, /^- Supersedes \/ แทนที่: ADR 0008/m);
    for (const heading of ["Context / บริบท", "Decision / การตัดสินใจ", "Consequences / ผลที่ตามมา", "Rejected alternatives / ทางเลือกที่ไม่เลือก"]) {
      assert.ok(headings.includes(heading), `ADR 0017 has ## ${heading}`);
    }

    const adr8 = await readTextOrNull("docs/decisions/0008-reuse-catalog-cross-skill-contract.md");
    assert.ok(adr8, "ADR 0008 exists");
    assert.match(markdownHeaderBlock(adr8), /^- Status \/ สถานะ: Superseded by ADR 0017/m, "ADR 0008 is marked Superseded by ADR 0017");
    const adr10 = await readTextOrNull("docs/decisions/0010-grill-to-tickets-fresh-context-design-review.md");
    assert.ok(adr10, "ADR 0010 exists");
    assert.match(markdownHeaderBlock(adr10), /ADR 0017 replaces only the fixed six-cycle bound/, "ADR 0010 notes that only its bound is replaced");
    assert.match(markdownHeaderBlock(adr10), /ADR 0018 amends decision 5/, "ADR 0010 records the new Stage 3 ticket-review dispatch");
  });

  it("no longer holds a reuse catalog", async () => {
    assert.equal(await readTextOrNull("docs/reuse-catalog.md"), null, "docs/reuse-catalog.md is removed");
  });

  it("records ADR 0014: tickets are measured before they are limited", async () => {
    const doc = await readTextOrNull("docs/decisions/0014-measure-tickets-before-limiting-them.md");

    assert.ok(doc, "ADR 0014 exists under docs/decisions/");
    assert.match(doc, /^# ADR 0014: Measure tickets before limiting them$/m);
    assert.match(doc, /- Status \/ สถานะ: Accepted/);
    assert.match(doc, /## Context \/ บริบท/);
    assert.match(doc, /## Decision \/ การตัดสินใจ/);
    assert.match(doc, /## Rejected alternatives \/ ทางเลือกที่ไม่เลือก/);

    // Seam, Context, and Budget contract
    assert.match(doc, /`?\*\*Seam:\*\*`?/);
    assert.match(doc, /`?\*\*Context:\*\*`?/);
    assert.match(doc, /`?\*\*Budget:\*\*`?/);
    assert.match(doc, /--write-budget/);
    assert.match(doc, /check-tickets\.mjs/);

    // The implementers' recording
    assert.match(doc, /budget_estimate/);
    assert.match(doc, /usage_total/);

    // Deferral of limits
    assert.match(doc, /ticket-budget-calibration/);
    assert.match(doc, /at least five/i);

    // Rejected alternative and trade-off
    assert.match(doc, /provisional limits/i);
    assert.match(doc, /visible in the budget table/i);
    assert.match(doc, /not flagged/i);
  });

  it("records ADR 0018's bilingual scenarios, manifest, ticket review, and amendments", async () => {
    const adr18 = await readTextOrNull("docs/decisions/0018-grill-to-tickets-scenarios-manifest-and-ticket-review.md");
    assert.ok(adr18, "ADR 0018 exists under docs/decisions/");
    const headings = markdownHeadings(adr18).map(({ title }) => title);
    assert.equal(headings[0], "ADR 0018: Scenarios, manifest, and ticket review for grill-to-tickets");
    for (const heading of ["Context / บริบท", "Decision / การตัดสินใจ", "Consequences / ผลที่ตามมา", "Rejected alternatives / ทางเลือกที่ไม่เลือก"]) {
      assert.ok(headings.includes(heading), `ADR 0018 has ## ${heading}`);
    }

    const header = markdownHeaderBlock(adr18);
    assert.match(header, /^- Status \/ สถานะ: Accepted/m);
    assert.match(header, /Amends \/ แก้ไข: ADR 0014 and ADR 0010 decision 5/i);
    const context = markdownSection(adr18, "Context / บริบท");
    const decision = markdownSection(adr18, "Decision / การตัดสินใจ");
    assert.ok(context, "ADR 0018 has its Context section");
    assert.ok(decision, "ADR 0018 has its Decision section");

    assert.match(context, /Scenario/i, "ADR 0018 Context introduces the Scenario line");
    const scenarioDecision = numberedMarkdownItem(decision, 1);
    const manifestDecision = numberedMarkdownItem(decision, 2);
    const ticketReviewDecision = numberedMarkdownItem(decision, 3);
    const costDecision = numberedMarkdownItem(decision, 5);
    const dispatchDecision = numberedMarkdownItem(decision, 6);
    assert.ok(scenarioDecision, "ADR 0018 Decision has decision 1");
    assert.ok(manifestDecision, "ADR 0018 Decision has decision 2");
    assert.ok(ticketReviewDecision, "ADR 0018 Decision has decision 3");
    assert.ok(costDecision, "ADR 0018 Decision has decision 5");
    assert.ok(dispatchDecision, "ADR 0018 Decision has decision 6");
    assert.match(scenarioDecision, /สถานการณ์/, "ADR 0018 decision 1 records the Thai scenario wording");
    for (const term of [/manifest\.json/, /manifest/]) {
      assert.match(manifestDecision, term, `ADR 0018 decision 2 records ${term}`);
    }
    for (const term of [/ticket review/i, /รีวิว ticket/i]) {
      assert.match(ticketReviewDecision, term, `ADR 0018 decision 3 records ${term}`);
    }
    assert.match(costDecision, /readiness dry-runs/i, "ADR 0018 identifies ADR 0014's readiness dry-run deferral");
    assert.match(costDecision, /ambiguity-only/i, "the ticket review is the ambiguity-only form of a readiness dry-run");
    assert.match(costDecision, /limits, profiles,[\s\S]*over-budget warnings, and Budget calibration stay deferred/i, "the other budget-calibration work stays deferred");
    assert.match(costDecision, /default-on/i, "ADR 0018 explains the default-on review cost");
    assert.match(costDecision, /no calibration data/i, "the review cost does not need calibration data");
    assert.match(costDecision, /--ticket-review 0/, "the review cost can be turned off");
    assert.match(dispatchDecision, /Stage 3 now also dispatches the ticket reviewer/i, "ADR 0018 amends ADR 0010 decision 5");

    const adr14 = await readTextOrNull("docs/decisions/0014-measure-tickets-before-limiting-them.md");
    assert.match(markdownHeaderBlock(adr14), /^- Amended by \/ แก้ไขโดย: ADR 0018/m, "ADR 0014 names ADR 0018 in its header");
    const adr10 = await readTextOrNull("docs/decisions/0010-grill-to-tickets-fresh-context-design-review.md");
    const adr10Header = markdownHeaderBlock(adr10);
    assert.match(adr10Header, /ADR 0017 replaces only the fixed six-cycle bound/, "ADR 0010 keeps its ADR 0017 amendment");
    assert.match(adr10Header, /ADR 0018 amends decision 5/, "ADR 0010 names ADR 0018 in its header");
  });

  it("updates the Thai guide with scenarios, the manifest, the ticket review, and two subagent dispatches", async () => {
    const guide = await readTextOrNull("docs/guides/grill-to-tickets.md");
    assert.ok(guide, "the grill-to-tickets guide exists");
    const purpose = markdownSection(guide, "จุดประสงค์หลักและคุณสมบัติเด่น");
    assert.ok(purpose, "the guide has its purpose section");
    assert.match(purpose, /2 ขั้นตอน[^\n]*dispatch[^\n]*subagent/i, "the guide says two steps dispatch a subagent");

    const tree = guide.match(/```text\n(\.scratch\/<feature-slug>\/[\s\S]*?)```/);
    assert.ok(tree, "the guide has the feature storage tree");
    assert.match(tree[1], /manifest\.json/, "the feature storage tree lists manifest.json");

    const guideWorkflow = sectionOf(guide, "### ขั้นตอนการทำงาน 4 ลำดับขั้น");
    const steps = [...guideWorkflow.matchAll(/^(\d)\. \*\*/gm)].map((match) => match[1]);
    assert.deepEqual(steps, ["1", "2", "3", "4", "5"], "the guide keeps five top-level steps and Stop at step 5");
    const stage1 = numberedMarkdownItem(guideWorkflow, 2);
    const stage3 = numberedMarkdownItem(guideWorkflow, 4);
    assert.ok(stage1, "the guide keeps Stage 1 inside the workflow section");
    assert.ok(stage3, "the guide keeps Stage 3 inside the workflow section");
    assert.match(stage1, /Scenario: given/i, "the guide describes the scenario line in Stage 1");
    assert.match(stage3, /manifest\.json/, "the guide describes the manifest in Stage 3");
    assert.match(stage3, /Ticket review/i, "the guide describes the ticket review in Stage 3");
    assert.match(stage3, /^   - \*\*Ticket review[^\n]*READY[^\n]*ASK/m, "the guide makes ticket review and its verdicts a step 4 sub-bullet");
    assert.match(stage3, /^     - [^\n]*ASK/m, "the guide nests quiz handling under the ticket-review sub-bullet");
  });

  it("orders the guide handoff to match SKILL.md: recommended implementer, then Manifest", async () => {
    const guide = await readTextOrNull("docs/guides/grill-to-tickets.md");
    const stop = guide.match(/^5\. \*\*Stop[^\n]*\n([\s\S]*?)(?=\n#{2,3} )/m);
    assert.ok(stop, "the guide has the Stop step");
    const order = stop[1].split("\n").find((line) => /^   - พิมพ์ข้อความ handoff/.test(line));
    assert.ok(order, "the Stop step has the handoff-order bullet");
    const at = (needle) => order.indexOf(needle);
    assert.ok(at("DAG summary") !== -1 && at("DAG summary") < at("Manifest:") && at("Manifest:") < at("`/subagent-implement`"),
      "the Manifest line is between the DAG summary and the implementer command");
    assert.ok(at("recommended implementer") !== -1 && at("recommended implementer") < at("Manifest:"),
      "the Manifest line follows the recommended implementer line");
    assert.match(order, /Manifest: `?\.scratch\/<feature-slug>\/manifest\.json/, "the line is spelled Manifest:");
    const example = stop[1].match(/recommended implementer: [^\n]*\n\s*(\S+):/);
    assert.ok(example, "the example shows a line after recommended implementer");
    assert.equal(example[1], "Manifest", "the example prints Manifest: after recommended implementer");
    assert.doesNotMatch(stop[1], /^\s*manifest: /m, "no lowercase manifest: example line");
  });

  it("mentions the conditional manifest line in the skill page Stop item and English handoff", async () => {
    const page = await readTextOrNull("docs/skills/agents/grill-to-tickets.md");
    const englishStart = page.indexOf("## English / ภาษาอังกฤษ");
    const thaiStop = page.slice(0, englishStart).match(/^5\. \*\*Stop\*\*[^\n]*$/m);
    assert.ok(thaiStop, "the Thai Stop item exists");
    assert.match(thaiStop[0], /Manifest: \.scratch\/<feature-slug>\/manifest\.json/, "the Thai Stop item names the Manifest line");
    assert.match(thaiStop[0], /exit 0|exited 0|ออกด้วย 0/, "the Thai Stop item makes the line conditional on exit 0");
    const english = page.slice(englishStart);
    const para = english.slice(english.indexOf("prints a handoff in this order"));
    const handoff = para.slice(0, para.indexOf("### Example prompt"));
    assert.match(handoff, /Manifest: \.scratch\/<feature-slug>\/manifest\.json/, "the English handoff names the Manifest line");
    assert.match(handoff, /exited 0/, "the English handoff makes the line conditional on exit 0");
    assert.ok(handoff.indexOf("DAG summary") < handoff.indexOf("Manifest:"), "the Manifest line follows the DAG summary");
    assert.ok(handoff.indexOf("Manifest:") < handoff.indexOf("implementer command"), "the Manifest line precedes the implementer command");
  });

  it("ADR 0018 names ADR 0014's rejection of dry-runs as a cost calibrated against nothing", async () => {
    const adr18 = await readTextOrNull("docs/decisions/0018-grill-to-tickets-scenarios-manifest-and-ticket-review.md");
    const decision5 = adr18.match(/^5\. [\s\S]*?(?=^6\. )/m)[0];
    const thaiStart = decision5.search(/[\u0E00-\u0E7F]/);
    const english = decision5.slice(0, thaiStart);
    const thai = decision5.slice(thaiStart);
    assert.match(english, /ADR 0014 rejected[\s\S]*calibrated against nothing/i, "the English half names ADR 0014's rejection");
    assert.match(english, /no calibration data[\s\S]*sets no\s+limit[\s\S]*--ticket-review 0/i, "the English half gives the reasons the cost is accepted");
    assert.match(thai, /ADR 0014[\s\S]*(ปฏิเสธ|ไม่เลือก)[\s\S]*calibrat/i, "the Thai half names ADR 0014's rejection");
  });

  it("updates both skill-page halves and their related-file lists for the ticket review", async () => {
    const page = await readTextOrNull("docs/skills/agents/grill-to-tickets.md");
    assert.ok(page, "the grill-to-tickets skill page exists");
    const englishStart = page.indexOf("## English / ภาษาอังกฤษ");
    assert.notEqual(englishStart, -1, "the skill page keeps its English half");
    const thai = page.slice(0, englishStart);
    const english = page.slice(englishStart);

    assert.match(thai, /2 ขั้นตอน[^\n]*dispatch[^\n]*subagent/i, "the Thai skill page says two steps dispatch a subagent");
    assert.match(english, /Two steps dispatch a subagent/i, "the English skill page says two steps dispatch a subagent");
    for (const [language, half] of [["Thai", thai], ["English", english]]) {
      assert.match(half, /Scenario: given/i, `${language} skill-page half describes scenarios`);
      assert.match(half, /manifest\.json/, `${language} skill-page half describes the manifest`);
      assert.match(half, /Ticket review/i, `${language} skill-page half describes the ticket review`);
    }

    const thaiStage3 = thai.match(/^4\. \*\*Stage 3 — Tickets\*\*[^\n]*$/m);
    const thaiStop = thai.match(/^5\. \*\*Stop\*\*/m);
    assert.ok(thaiStage3 && thaiStop, "the Thai skill-page workflow keeps Stage 3 and Stop at steps 4 and 5");
    assert.match(thaiStage3[0], /Ticket review/i, "the Thai ticket review stays on the Stage 3 line");
    const englishWorkflow = sectionOf(page, "### Main workflow");
    assert.ok(englishWorkflow, "the skill page has an English Main workflow section");
    const englishTicketParagraph = englishWorkflow.split(/\n\s*\n/).find((paragraph) => /After `SHIP`/.test(paragraph));
    assert.ok(englishTicketParagraph, "the English ticket workflow is one paragraph");
    assert.match(englishTicketParagraph, /Ticket review/i, "the English ticket review stays in the Stage 3 paragraph");

    for (const [language, heading] of [["Thai", "### ไฟล์ที่เกี่ยวข้อง"], ["English", "### Related files"]]) {
      const list = sectionOf(page, heading);
      assert.ok(list, `the ${language} related-files list exists`);
      assert.ok(list.includes("`references/ticket-review.md`"), `the ${language} list names the ticket-review reference`);
      assert.ok(list.includes("manifest.json"), `the ${language} list names the manifest`);
      const checker = listItem(list, "scripts/check-tickets.mjs");
      assert.ok(checker, `the ${language} list describes the ticket checker`);
      assert.match(checker, /Scenario/i, `the ${language} checker description mentions the scenario rules`);
      assert.match(checker, /manifest\.json/, `the ${language} checker description mentions the manifest`);
    }
  });

  it("links concise ticket-review and manifest summaries to the canonical contracts", async () => {
    const guideFile = "docs/guides/grill-to-tickets.md";
    const guide = await readTextOrNull(guideFile);
    assert.ok(guide, "the grill-to-tickets guide exists");
    const guideWorkflow = sectionOf(guide, "### ขั้นตอนการทำงาน 4 ลำดับขั้น");
    const guideStage3 = numberedMarkdownItem(guideWorkflow, 4);
    assert.ok(guideStage3, "the guide has a Stage 3 section");
    assert.match(guideStage3, /manifest\.json/, "the guide keeps the derived manifest summary");
    assert.match(guideStage3, /Ticket review/i, "the guide keeps the Stage 3.5 ticket-review summary");
    assert.doesNotMatch(guideStage3, /--ticket-review 0/, "the guide does not duplicate the ticket-review skip flag");
    assert.doesNotMatch(guideStage3, /spec fingerprint|planning-time ticket facts|no Status or timestamp/i, "the guide does not repeat manifest internals");
    await assertLinksToCanonicalContracts(guideFile, guideStage3, "Thai guide Stage 3");
    const guideStorage = guide.match(/```text\n(\.scratch\/<feature-slug>\/[\s\S]*?)```/);
    assert.ok(guideStorage, "the guide keeps the feature storage tree");
    assert.match(guideStorage[1], /manifest\.json/, "the storage tree keeps the manifest path");
    assert.doesNotMatch(guideStorage[1], /spec fingerprint|planning facts|timestamp/i, "the storage tree does not duplicate manifest internals");

    const pageFile = "docs/skills/agents/grill-to-tickets.md";
    const page = await readTextOrNull(pageFile);
    assert.ok(page, "the grill-to-tickets skill page exists");
    const thaiPageSection = sectionOf(page, "## ภาษาไทย / Thai");
    const englishPageSection = sectionOf(page, "## English / ภาษาอังกฤษ");
    assert.ok(thaiPageSection && englishPageSection, "the skill page keeps both language sections");
    assert.doesNotMatch(thaiPageSection, /--ticket-review 0/, "the Thai skill page does not restate the ticket-review skip flag");
    assert.doesNotMatch(englishPageSection, /--ticket-review 0/, "the English skill page does not restate the ticket-review skip flag");

    const thaiWorkflow = sectionOf(page, "### วิธีทำงานหลัก");
    assert.ok(thaiWorkflow, "the skill page has a Thai main workflow section");
    const thaiStage3 = numberedMarkdownItem(thaiWorkflow, 4);
    assert.ok(thaiStage3, "the skill page keeps the Thai Stage 3 summary");
    assert.match(thaiStage3, /Ticket review/i, "the Thai summary keeps Stage 3.5 ticket review");
    assert.match(thaiStage3, /manifest\.json/, "the Thai summary keeps the derived manifest path");
    assert.doesNotMatch(thaiStage3, /--ticket-review 0/, "the Thai summary does not repeat the skip flag");
    assert.doesNotMatch(thaiStage3, /spec fingerprint|planning-time ticket facts|no Status or timestamp/i, "the Thai summary does not repeat manifest internals");
    await assertLinksToCanonicalContracts(pageFile, thaiStage3, "Thai skill-page Stage 3");

    const englishWorkflow = sectionOf(page, "### Main workflow");
    assert.ok(englishWorkflow, "the skill page has an English Main workflow section");
    const englishTicketParagraph = englishWorkflow.split(/\n\s*\n/).find((paragraph) => /After `SHIP`/.test(paragraph));
    assert.ok(englishTicketParagraph, "the English ticket workflow is one paragraph");
    assert.match(englishTicketParagraph, /manifest\.json/, "the English summary keeps the derived manifest path");
    assert.match(englishTicketParagraph, /Ticket review/i, "the English summary keeps Stage 3.5 ticket review");
    assert.doesNotMatch(englishTicketParagraph, /--ticket-review 0/, "the English summary does not repeat the skip flag");
    assert.doesNotMatch(englishTicketParagraph, /spec fingerprint|planning-time ticket facts|no Status or timestamp/i, "the English summary does not repeat manifest internals");
    await assertLinksToCanonicalContracts(pageFile, englishTicketParagraph, "English skill-page ticket workflow");

    const relatedFiles = sectionOf(page, "### Related files");
    assert.ok(relatedFiles, "the skill page has a Related files section");
    const manifestItem = listItem(relatedFiles, ".scratch/<feature-slug>/manifest.json");
    assert.ok(manifestItem, "the related-files list keeps the manifest path");
    assert.doesNotMatch(manifestItem, /--write-budget|fingerprint|planning-time ticket facts|timestamp|on PASS/i, "the manifest entry does not duplicate write semantics");
    const checkerItem = listItem(relatedFiles, "scripts/check-tickets.mjs");
    assert.ok(checkerItem, "the related-files list describes the checker");
    assert.doesNotMatch(checkerItem, /writes?[^\n]*manifest\.json[^\n]*PASS|manifest\.json[^\n]*on PASS/i, "the checker entry defers manifest write conditions to the canonical contract");
  });

  it("describes owned formats, the three-skill Preflight, ticket fields, --write-budget, warnings, and the handoff recommendation", async () => {
    for (const file of ["docs/guides/grill-to-tickets.md", "docs/skills/agents/grill-to-tickets.md"]) {
      const doc = await readTextOrNull(file);
      assert.ok(doc, `${file} exists`);

      assert.match(doc, /spec-format\.md/, `${file} names the owned spec format`);
      assert.match(doc, /ticket-format\.md/, `${file} names the owned ticket format`);
      for (const skill of ["grilling", "domain-modeling", "scrutinize"]) {
        assert.match(doc, new RegExp(skill), `${file} keeps ${skill}`);
      }
      assert.doesNotMatch(doc, /five stage skills|stage skills ทั้ง 5|ทั้งหมด 5 ตัว/, `${file} no longer claims five stage skills`);

      assert.match(doc, /\*\*Seam:\*\*/, `${file} names the Seam field`);
      assert.match(doc, /\*\*Context:\*\*/, `${file} names the Context field`);
      assert.match(doc, /\*\*Budget:\*\*/, `${file} names the Budget field`);

      assert.match(doc, /--write-budget/, `${file} documents --write-budget`);
      assert.match(doc, /## Ticket warnings/, `${file} documents the warnings log`);
      assert.match(doc, /acknowledged/, `${file} documents warning acknowledgement`);
      assert.match(doc, /recommended implementer/i, `${file} documents the handoff recommendation`);
    }

    const guide = await readTextOrNull("docs/guides/grill-to-tickets.md");
    assert.ok(guide, "the grill-to-tickets guide exists");
    const installs = guide.match(/npx skills add [^\n`]+/g) || [];
    const dependencyInstalls = installs.filter((line) => !line.includes("--skill grill-to-tickets"));
    assert.equal(dependencyInstalls.length, 3, "the guide installs exactly three stage skills");
    for (const skill of ["grilling", "domain-modeling", "scrutinize"]) {
      assert.ok(
        dependencyInstalls.some((line) => line.includes(`--skill ${skill}`)),
        `the guide installs ${skill}`,
      );
    }
  });

  it("describes Seam and Context use, the path rule, and the budget recording in the three implementer guides", async () => {
    for (const skill of ["subagent-implement", "agy-implement", "opencode-implement"]) {
      for (const file of [`docs/guides/${skill}.md`, `docs/skills/agents/${skill}.md`]) {
        const doc = await readTextOrNull(file);
        assert.ok(doc, `${file} exists`);

        assert.match(doc, /\*\*Seam:\*\*/, `${file} names the Seam field`);
        assert.match(doc, /\*\*Context:\*\*/, `${file} names the Context field`);
        assert.match(doc, /verbatim/, `${file} says the Seam is used verbatim`);
        assert.match(doc, /read list|read set|รายการอ่าน/, `${file} calls Context the worker's read list`);
        assert.match(doc, /relative[\s\S]{0,220}absolute/i, `${file} states the path rule`);
        assert.match(doc, /budget_estimate/, `${file} records budget_estimate`);
        assert.match(doc, /usage_total/, `${file} records usage_total`);
      }
    }
  });

  it("describes the grill-to-tickets handoff in the skill's order: /clear, then the DAG summary, then the implementer command", async () => {
    const guide = await readTextOrNull("docs/guides/grill-to-tickets.md");
    assert.ok(guide, "the grill-to-tickets guide exists");

    const diagramLine = guide.match(/^Stop: Handoff message[^\n]*$/m);
    assert.ok(diagramLine, "the guide's diagram has a Stop: Handoff message line");
    assertFirstMentionOrder(
      diagramLine[0],
      ["/clear", "DAG summary", "/subagent-implement"],
      "guide diagram line",
    );

    const step = guide.match(/^5\. \*\*Stop — Handoff[^\n]*\n([\s\S]*?)(?=\n---)/m);
    assert.ok(step, "the guide has a Stage 5 Stop — Handoff step");
    assertFirstMentionOrder(step[1], ["/clear", "DAG summary", "/subagent-implement"], "guide handoff step");
    const message = step[1].match(/```text\n([\s\S]*?)```/);
    assert.ok(message, "the guide's handoff step shows the message");
    assertFirstMentionOrder(
      message[1],
      ["/clear", "recommended implementer", "/subagent-implement"],
      "guide handoff message",
    );

    const page = await readTextOrNull("docs/skills/agents/grill-to-tickets.md");
    assert.ok(page, "the grill-to-tickets skill page exists");

    const english = page.replace(/\s+/g, " ").match(/prints a handoff.*?and stops\./);
    assert.ok(english, "the skill page's English text describes the handoff");
    assertFirstMentionOrder(
      english[0],
      ["/clear", "DAG summary", "recommended implementer", "/subagent-implement"],
      "skill page English handoff",
    );

    const stage5 = page.match(/^5\. \*\*Stop\*\*[^\n]*$/m);
    assert.ok(stage5, "the skill page's Thai text has a Stage 5 Stop line");
    assertFirstMentionOrder(stage5[0], ["/clear", "DAG summary"], "skill page Thai Stage 5 line");
  });

  it("says the orchestrator builds the worker's read list into the prompt, in the guides and the skill pages", async () => {
    for (const skill of ["subagent-implement", "agy-implement", "opencode-implement"]) {
      const guideFile = `docs/guides/${skill}.md`;
      const guide = await readTextOrNull(guideFile);
      assert.ok(guide, `${guideFile} exists`);

      const context = bulletLine(guide, "Context:");
      assert.ok(context, `${guideFile} has a Context bullet`);
      assert.match(context, /read list/, `${guideFile} Context bullet keeps the read list`);
      assert.doesNotMatch(context, /worker\s*สร้าง|ของตัวเอง/, `${guideFile} Context bullet does not have the worker build its own read list`);
      assert.match(
        context,
        /(orchestrator|implementer)[^;]*\*\*read list\*\*[^;]*prompt/,
        `${guideFile} Context bullet has the orchestrator build the read list into the worker prompt`,
      );

      const pageFile = `docs/skills/agents/${skill}.md`;
      const page = await readTextOrNull(pageFile);
      assert.ok(page, `${pageFile} exists`);

      const passages = page.split(/\n\s*\n/).filter((paragraph) => /^Seam, Context/.test(paragraph));
      assert.equal(passages.length, 2, `${pageFile} has a Thai and an English Seam, Context paragraph`);
      for (const passage of passages) {
        const flat = passage.replace(/\s+/g, " ");
        assert.doesNotMatch(
          flat,
          /ประกอบ \*\*read list\*\* ของตัวเอง|builds its \*\*read list\*\*/,
          `${pageFile} does not have the worker build its own read list`,
        );
        assert.match(
          flat,
          /orchestrator (ประกอบ|builds)[^.]*\*\*read list\*\*/,
          `${pageFile} has the orchestrator build the read list`,
        );
      }
    }
  });

  it("records subagent-implement's usage_total as the worker's reported tokens, possibly cache-inclusive, and leaves the agy and opencode cache wording", async () => {
    const subagent = await readTextOrNull("docs/guides/subagent-implement.md");
    assert.ok(subagent, "the subagent-implement guide exists");

    const budget = bulletLine(subagent, "การบันทึก budget:");
    assert.ok(budget, "the subagent-implement guide has a budget bullet");
    assert.match(budget, /usage_total/, "the budget bullet records usage_total");
    assert.match(budget, /cache-inclusive/, "the budget bullet says the tokens are possibly cache-inclusive");
    assert.match(budget, /dispatch/, "the budget bullet sums every dispatch");
    assert.match(budget, /resume/, "the budget bullet sums every resume");
    assert.match(budget, /verifier_usage_total/, "the budget bullet keeps verifier_usage_total separate");
    assert.doesNotMatch(budget, /ไม่นับ cache read/, "the budget bullet no longer excludes cache reads");

    for (const skill of ["agy-implement", "opencode-implement"]) {
      const guide = await readTextOrNull(`docs/guides/${skill}.md`);
      assert.ok(guide, `the ${skill} guide exists`);

      const line = bulletLine(guide, "การบันทึก budget:");
      assert.ok(line, `the ${skill} guide has a budget bullet`);
      assert.match(line, /ไม่นับ cache read/, `the ${skill} budget bullet still excludes cache reads`);
    }
  });

  it("splits opencode-implement's usage_total in its guide: the main path excludes cache reads, the fallback path is the subagent's reported tokens, possibly cache-inclusive", async () => {
    const file = "docs/guides/opencode-implement.md";
    const guide = await readTextOrNull(file);
    assert.ok(guide, `${file} exists`);

    const line = bulletLine(guide, "การบันทึก budget:");
    assert.ok(line, `${file} has a budget bullet`);
    assert.match(line, /budget_estimate/, `${file} budget bullet keeps budget_estimate`);
    assert.match(line, /จากทุก usage report บน path ที่ส่ง ticket สำเร็จ/, `${file} budget bullet sums every usage report on the path that delivered the ticket`);
    assert.match(line, /`unknown`/, `${file} budget bullet keeps the unknown case`);

    // The main path is named first and the fallback path second; each gets its own rule.
    const split = line.indexOf("fallback path");
    assert.notEqual(split, -1, `${file} budget bullet names the fallback path`);
    const mainPath = line.slice(0, split);
    const fallbackPath = line.slice(split);

    assert.match(
      mainPath,
      /main path[\s\S]*input \+ output \+ reasoning[\s\S]*`step_finish`[\s\S]*ไม่นับ cache read/,
      `${file} budget bullet has the main path count input + output + reasoning over every step_finish event without cache reads`,
    );
    assert.doesNotMatch(mainPath, /cache-inclusive/, `${file} budget bullet does not call the main path cache-inclusive`);
    assert.match(
      fallbackPath,
      /subagent[\s\S]*รายงาน[\s\S]*ตามที่ให้มา[\s\S]*cache-inclusive/,
      `${file} budget bullet has the fallback path record the subagent's reported tokens as given, possibly cache-inclusive`,
    );
    assert.doesNotMatch(fallbackPath, /ไม่นับ cache read/, `${file} budget bullet does not exclude cache reads on the fallback path`);
  });

  it("says in the guide's no-issue-tracker bullet that the owned formats have no publish or setup step", async () => {
    const guide = await readTextOrNull("docs/guides/grill-to-tickets.md");
    assert.ok(guide, "the grill-to-tickets guide exists");

    const bullet = bulletLine(guide, "ไม่ต้องตั้งค่า issue tracker:");
    assert.ok(bullet, "the guide has a no-issue-tracker bullet");
    assert.match(bullet, /\.scratch\/<feature-slug>\/.*tracker/, "the bullet says the .scratch files are the tracker");
    assert.doesNotMatch(
      bullet,
      /บอกให้ publish|ถูกแทนด้วย|Stage 1 และ Stage 3/,
      "the bullet no longer says upstream Stage 1 and Stage 3 steps are replaced",
    );
    assert.match(bullet, /spec-format\.md/, "the bullet names the owned spec format");
    assert.match(bullet, /ticket-format\.md/, "the bullet names the owned ticket format");
    assert.match(bullet, /ไม่มีขั้นตอน[\s\S]*publish/, "the bullet says the owned formats have no publish step");
  });

  it("lists the owned formats and the licence in both related-file lists, and describes the whole checker in both", async () => {
    const page = await readTextOrNull("docs/skills/agents/grill-to-tickets.md");
    assert.ok(page, "the grill-to-tickets skill page exists");

    const lists = { Thai: "### ไฟล์ที่เกี่ยวข้อง", English: "### Related files" };
    for (const [language, heading] of Object.entries(lists)) {
      const list = sectionOf(page, heading);
      assert.ok(list, `the skill page has the ${language} related-files list`);

      for (const file of ["references/spec-format.md", "references/ticket-format.md", "references/ticket-review.md", "references/UPSTREAM-LICENSE.md"]) {
        assert.ok(list.includes(`\`${file}\``), `the ${language} related-files list names ${file}`);
      }
      assert.ok(list.includes("manifest.json"), `the ${language} related-files list names the manifest`);

      const checker = listItem(list, "scripts/check-tickets.mjs");
      assert.ok(checker, `the ${language} related-files list has a check-tickets.mjs bullet`);
      for (const word of ["Seam", "Context", "Budget", "--write-budget", "warn", "DAG", "recommended implementer", "Scenario", "manifest.json"]) {
        assert.ok(checker.includes(word), `the ${language} check-tickets.mjs bullet names ${word}`);
      }
      assert.match(checker, /exit 0[^)]*\b1\b[^)]*\b2\b/, `the ${language} check-tickets.mjs bullet keeps the three exit codes`);
    }
  });

  it("says in the subagent-implement skill page that usage_total is the worker's reported tokens, possibly cache-inclusive, and leaves the agy and opencode pages alone", async () => {
    const seamParagraphs = async (skill) => {
      const file = `docs/skills/agents/${skill}.md`;
      const page = await readTextOrNull(file);
      assert.ok(page, `${file} exists`);

      const paragraphs = page.split(/\n\s*\n/).filter((paragraph) => /^Seam, Context/.test(paragraph));
      assert.equal(paragraphs.length, 2, `${file} has a Thai and an English Seam, Context paragraph`);
      return { file, flat: paragraphs.map((paragraph) => paragraph.replace(/\s+/g, " ")) };
    };

    const subagent = await seamParagraphs("subagent-implement");
    for (const flat of subagent.flat) {
      assert.match(flat, /usage_total/, `${subagent.file} records usage_total`);
      assert.doesNotMatch(flat, /real token cost|token จริง/, `${subagent.file} no longer calls usage_total the real token cost`);
      assert.match(flat, /cache-inclusive/, `${subagent.file} says the tokens are possibly cache-inclusive`);
      assert.match(flat, /dispatch/, `${subagent.file} sums every dispatch`);
      assert.match(flat, /resume/, `${subagent.file} sums every resume`);
      assert.match(flat, /verifier_usage_total/, `${subagent.file} keeps verifier_usage_total separate`);
    }

    for (const skill of ["agy-implement", "opencode-implement"]) {
      const { file, flat } = await seamParagraphs(skill);
      for (const paragraph of flat) {
        assert.match(paragraph, /usage_total/, `${file} records usage_total`);
        assert.doesNotMatch(paragraph, /cache-inclusive/, `${file} does not say cache-inclusive`);
      }
    }
  });

  it("says what raises a checker warning and how the recommended implementer is chosen, in the guide and the skill page", async () => {
    const widthMapping = (allThree) =>
      new RegExp(
        `maximum wave width[\\s\\S]{0,100}?\\b1\\b[\\s\\S]{0,20}?\`subagent-implement\`[\\s\\S]{0,20}?\\b2\\b[\\s\\S]{0,20}?${allThree}` +
          "[\\s\\S]{0,20}?\\b3\\b[\\s\\S]{0,30}?`agy-implement`[\\s\\S]{0,20}?`opencode-implement`",
      );
    const assertWarningsAndRecommendation = (where, { warnings, recommendation }, wording) => {
      const warningText = withoutCodeFences(warnings);
      for (const trigger of ["npm test", "tests pass", "typecheck passes", "lint passes", "suite passes", "(edit)", "(new)", "(edit from NN)"]) {
        assert.ok(warningText.includes(trigger), `${where} names ${trigger} among the warning triggers`);
      }
      assert.match(warningText, wording.suiteRun, `${where} says a warning is raised for a suite or tool run`);
      assert.match(warningText, wording.samePath, `${where} says a warning is raised for the same path`);
      assert.match(warningText, wording.transitive, `${where} says neither ticket transitively blocks the other`);
      assert.match(warningText, /15 ticket/, `${where} says a warning is raised above 15 tickets`);

      const recommendationText = withoutCodeFences(recommendation);
      assert.match(recommendationText, widthMapping(wording.allThree), `${where} maps maximum wave width to the recommended implementer`);
      assert.match(recommendationText, wording.advice, `${where} says the recommendation is advice only`);
    };
    const thai = {
      suiteRun: /รัน suite หรือ tool/,
      samePath: /path เดียวกัน/,
      transitive: /ทางอ้อม/,
      allThree: "ทั้งสามตัว",
      advice: /คำแนะนำเท่านั้น/,
    };
    const english = {
      suiteRun: /suite or tool run/,
      samePath: /same path/,
      transitive: /transitively/,
      allThree: "all three",
      advice: /advice only/,
    };

    const guide = await readTextOrNull("docs/guides/grill-to-tickets.md");
    assert.ok(guide, "the grill-to-tickets guide exists");
    const stage3 = guide.match(/^4\. \*\*Stage 3[^\n]*\n([\s\S]*?)(?=\n5\. \*\*Stop)/m);
    assert.ok(stage3, "the guide has a Stage 3 step");
    const handoff = guide.match(/^5\. \*\*Stop — Handoff[^\n]*\n([\s\S]*?)(?=\n---)/m);
    assert.ok(handoff, "the guide has a Stop — Handoff step");
    assertWarningsAndRecommendation("the guide", { warnings: stage3[1], recommendation: handoff[1] }, thai);

    const page = await readTextOrNull("docs/skills/agents/grill-to-tickets.md");
    assert.ok(page, "the grill-to-tickets skill page exists");
    const thaiWorkflow = sectionOf(page, "### วิธีทำงานหลัก");
    const thaiStage3 = numberedMarkdownItem(thaiWorkflow, 4);
    const thaiStop = numberedMarkdownItem(thaiWorkflow, 5);
    assert.ok(thaiStage3 && thaiStop, "the skill page's Thai text has Stage 3 and Stop sections");
    assertWarningsAndRecommendation("the skill page's Thai text", { warnings: thaiStage3, recommendation: thaiStop }, thai);

    const englishWorkflow = sectionOf(page, "### Main workflow");
    assert.ok(englishWorkflow, "the skill page has an English Main workflow section");
    const flatEnglish = englishWorkflow.replace(/\s+/g, " ");
    assertWarningsAndRecommendation("the skill page's English text", { warnings: flatEnglish, recommendation: flatEnglish }, english);
  });

  it("defines the planning and implementation terms in bilingual glossary rows", async () => {
    const glossary = await readTextOrNull("docs/glossary.md");
    assert.ok(glossary, "the glossary exists");

    const rows = Object.fromEntries(["Seam", "Read set", "Budget line", "usage_total", "Scenario", "Manifest", "Ticket review"].map((term) => [term, tableRow(glossary, term)]));
    for (const [term, row] of Object.entries(rows)) {
      assert.ok(row, `the glossary has a row for ${term}`);
      assert.equal(row.split("|").length, 5, `the ${term} row has the Term, ภาษาไทย, and Definition cells`);
    }

    const lines = glossary.split("\n");
    const anchor = lines.indexOf(tableRow(glossary, "Workflow State"));
    const retro = lines.indexOf(tableRow(glossary, "Retro"));
    assert.notEqual(anchor, -1, "the glossary keeps its Workflow State row");
    for (const [term, row] of Object.entries(rows)) {
      const index = lines.indexOf(row);
      assert.ok(index > anchor && index < retro, `the ${term} row sits between the Workflow State row and the Retro rows`);
    }

    // A Definition cell is the English definition, " / ", then the Thai one.
    const halves = (row) => {
      const cell = row.split("|")[3].trim();
      const cut = cell.indexOf(" / ");
      assert.notEqual(cut, -1, "the Definition cell has an English half and a Thai half");
      return { english: cell.slice(0, cut), thai: cell.slice(cut + 3) };
    };
    const seam = halves(rows.Seam);
    assert.match(seam.english, /\*\*Seam:\*\*/, "Seam is tied to the ticket's Seam line");
    assert.match(seam.english, /one test boundary/, "Seam is the one test boundary");
    assert.match(seam.thai, /\*\*Seam:\*\*/, "the Thai Seam definition names the Seam line");

    const readSet = halves(rows["Read set"]);
    assert.match(readSet.english, /\*\*Context:\*\*/, "Read set is tied to the ticket's Context field");
    assert.match(readSet.english, /\(edit from NN\)/, "Read set names the ticket's file markers");
    assert.match(readSet.english, /worker's \*\*read list\*\*/, "Read set bridges to the implementers' read list");
    assert.match(readSet.thai, /\*\*read list\*\*/, "the Thai Read set definition bridges to the read list");

    const budget = halves(rows["Budget line"]);
    assert.match(budget.english, /\*\*Budget:\*\*/, "Budget line is tied to the ticket's Budget field");
    assert.match(budget.english, /sets no limit/, "Budget line records an estimate and sets no limit");
    assert.match(budget.thai, /\*\*Budget:\*\*/, "the Thai Budget line definition names the Budget field");

    const scenario = halves(rows.Scenario);
    assert.match(scenario.english, /one or more[\s\S]*testable example/i, "Scenario defines a testable example for a story");
    assert.match(scenario.thai, /สถานการณ์ทดสอบ|ตัวอย่างที่ทดสอบได้/, "Scenario has a Thai definition");
    assert.match(rows.Scenario.split("|")[2], /สถานการณ์/, "Scenario has a Thai term");

    const manifest = halves(rows.Manifest);
    assert.match(manifest.english, /derived snapshot[\s\S]*manifest\.json/i, "Manifest defines the derived manifest file");
    assert.match(manifest.thai, /manifest\.json|ไฟล์สรุปแผนงาน/, "Manifest has a Thai definition");
    assert.match(rows.Manifest.split("|")[2], /ไฟล์|manifest/i, "Manifest has a Thai term");

    const ticketReview = halves(rows["Ticket review"]);
    assert.match(ticketReview.english, /fresh reviewer[\s\S]*READY[\s\S]*ASK/i, "Ticket review defines the fresh READY or ASK pass");
    assert.match(ticketReview.thai, /ผู้รีวิว|READY[\s\S]*ASK/, "Ticket review has a Thai definition");
    assert.match(rows["Ticket review"].split("|")[2], /ทบทวน|รีวิว/, "Ticket review has a Thai term");

    const usage = halves(rows.usage_total);
    assert.match(usage.english, /dispatch[\s\S]*resume/, "usage_total sums every dispatch and every resume");
    assert.match(
      usage.english,
      /agy-implement[\s\S]*opencode-implement[\s\S]*cache reads excluded[\s\S]*subagent-implement[\s\S]*cache-inclusive/,
      "usage_total excludes cache reads only for agy and opencode, and is possibly cache-inclusive for subagent-implement",
    );
    assert.match(usage.thai, /dispatch[\s\S]*resume/, "the Thai usage_total definition sums every dispatch and every resume");
    assert.match(usage.thai, /subagent-implement[\s\S]*cache-inclusive/, "the Thai usage_total definition says subagent-implement is possibly cache-inclusive");

    // opencode-implement is in both groups: its main path excludes cache reads, its native-subagent fallback path
    // records the subagent's reported tokens as given. Each half is cut where the cache-excluding clause ends.
    const cutAfter = (text, marker) => {
      const at = text.indexOf(marker);
      assert.notEqual(at, -1, `the usage_total definition says "${marker}"`);
      return { excluding: text.slice(0, at + marker.length), reported: text.slice(at + marker.length) };
    };

    const english = cutAfter(usage.english, "cache reads excluded");
    assert.match(english.excluding, /`agy-implement`/, "usage_total excludes cache reads for agy-implement");
    assert.match(english.excluding, /`opencode-implement`'s main path/, "usage_total excludes cache reads for opencode-implement's main path");
    assert.doesNotMatch(
      english.excluding,
      /`opencode-implement`(?!'s main path)/,
      "usage_total does not list opencode-implement unqualified among the cache-excluding implementers",
    );
    assert.match(english.reported, /`subagent-implement`/, "usage_total records subagent-implement's reported tokens");
    assert.match(
      english.reported,
      /`opencode-implement`'s native-subagent fallback path[\s\S]*cache-inclusive/,
      "usage_total is possibly cache-inclusive for opencode-implement's native-subagent fallback path",
    );

    const thai = cutAfter(usage.thai, "ไม่นับ cache read");
    assert.match(thai.excluding, /`agy-implement`/, "the Thai usage_total definition excludes cache reads for agy-implement");
    assert.match(thai.excluding, /main path ของ `opencode-implement`/, "the Thai usage_total definition excludes cache reads for opencode-implement's main path");
    assert.doesNotMatch(
      thai.excluding,
      /(?<!main path ของ )`opencode-implement`/,
      "the Thai usage_total definition does not list opencode-implement unqualified among the cache-excluding implementers",
    );
    assert.match(thai.reported, /`subagent-implement`/, "the Thai usage_total definition records subagent-implement's reported tokens");
    assert.match(
      thai.reported,
      /fallback path[^`]*ของ `opencode-implement`[\s\S]*cache-inclusive/,
      "the Thai usage_total definition says opencode-implement's fallback path is possibly cache-inclusive",
    );
  });

  it("keeps the upstream format names only at the licensed and assertion sites", async () => {
    const roots = [
      "skills/agents/grill-to-tickets",
      "skills/agents/subagent-implement",
      "skills/agents/agy-implement",
      "skills/agents/opencode-implement",
      "tests",
    ];
    const violations = [];

    for (const root of roots) {
      for (const { file, text } of await textFilesUnder(root)) {
        text.split("\n").forEach((line, index) => {
          if (UPSTREAM_FORMAT_NAMES.test(line) && !allowedUpstreamMention(file, index + 1, line)) {
            violations.push(`${file}:${index + 1}: ${line}`);
          }
        });
      }
    }

    assert.deepEqual(violations, []);
  });

  it("has no absolute-path wording in the three implementer directories", async () => {
    const pattern = /every path in the prompt is\s+absolute|absolute\s+paths\s+everywhere/i;
    const found = [];

    for (const skill of ["subagent-implement", "agy-implement", "opencode-implement"]) {
      for (const { file, text } of await textFilesUnder(path.join("skills/agents", skill))) {
        if (file.endsWith(".md") && pattern.test(text)) {
          found.push(file);
        }
      }
    }

    assert.deepEqual(found, []);
  });
});
