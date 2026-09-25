import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { discoverSkills, renderIndex } from "../scripts/generate-skill-index.mjs";

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

      for (const file of ["references/spec-format.md", "references/ticket-format.md", "references/UPSTREAM-LICENSE.md"]) {
        assert.ok(list.includes(`\`${file}\``), `the ${language} related-files list names ${file}`);
      }

      const checker = listItem(list, "scripts/check-tickets.mjs");
      assert.ok(checker, `the ${language} related-files list has a check-tickets.mjs bullet`);
      for (const word of ["Seam", "Context", "Budget", "--write-budget", "warn", "DAG", "recommended implementer"]) {
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
    const thaiStage3 = page.match(/^4\. \*\*Stage 3 — Tickets\*\*[^\n]*$/m);
    const thaiStop = page.match(/^5\. \*\*Stop\*\*[^\n]*$/m);
    assert.ok(thaiStage3 && thaiStop, "the skill page's Thai text has Stage 3 and Stop lines");
    assertWarningsAndRecommendation("the skill page's Thai text", { warnings: thaiStage3[0], recommendation: thaiStop[0] }, thai);

    const englishWorkflow = sectionOf(page, "### Main workflow");
    assert.ok(englishWorkflow, "the skill page has an English Main workflow section");
    const flatEnglish = englishWorkflow.replace(/\s+/g, " ");
    assertWarningsAndRecommendation("the skill page's English text", { warnings: flatEnglish, recommendation: flatEnglish }, english);
  });

  it("defines Seam, Read set, Budget line, and usage_total in the glossary, after the Reuse Field row", async () => {
    const glossary = await readTextOrNull("docs/glossary.md");
    assert.ok(glossary, "the glossary exists");

    const rows = Object.fromEntries(["Seam", "Read set", "Budget line", "usage_total"].map((term) => [term, tableRow(glossary, term)]));
    for (const [term, row] of Object.entries(rows)) {
      assert.ok(row, `the glossary has a row for ${term}`);
      assert.equal(row.split("|").length, 5, `the ${term} row has the Term, ภาษาไทย, and Definition cells`);
    }

    const lines = glossary.split("\n");
    const reuseField = lines.indexOf(tableRow(glossary, "Reuse Field"));
    const retro = lines.indexOf(tableRow(glossary, "Retro"));
    assert.notEqual(reuseField, -1, "the glossary keeps its Reuse Field row");
    for (const [term, row] of Object.entries(rows)) {
      const index = lines.indexOf(row);
      assert.ok(index > reuseField && index < retro, `the ${term} row sits between the Reuse Field row and the Retro rows`);
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

    const usage = halves(rows.usage_total);
    assert.match(usage.english, /dispatch[\s\S]*resume/, "usage_total sums every dispatch and every resume");
    assert.match(
      usage.english,
      /agy-implement[\s\S]*opencode-implement[\s\S]*cache reads excluded[\s\S]*subagent-implement[\s\S]*cache-inclusive/,
      "usage_total excludes cache reads only for agy and opencode, and is possibly cache-inclusive for subagent-implement",
    );
    assert.match(usage.thai, /dispatch[\s\S]*resume/, "the Thai usage_total definition sums every dispatch and every resume");
    assert.match(usage.thai, /subagent-implement[\s\S]*cache-inclusive/, "the Thai usage_total definition says subagent-implement is possibly cache-inclusive");
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
