import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { discoverSkills, renderIndex } from "../scripts/generate-skill-index.mjs";
import { assertAbsentFromMarkdownSections, markdownHeaderBlock, markdownSection } from "./helpers/markdown-contract.mjs";

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

function paragraphOf(section, start) {
  if (!section) return null;
  return section.split(/\n\s*\n/).find((paragraph) => paragraph.startsWith(start)) ?? null;
}

const englishProseMarkers = new Set([
  "a", "an", "and", "are", "as", "because", "but", "by", "for", "from", "has", "have", "in", "into", "is",
  "it", "its", "of", "on", "or", "the", "their", "they", "this", "to", "until", "was", "were", "when", "while",
  "with", "without", "would",
]);

function markdownProse(body) {
  return body
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, " ")
    .replace(/^\s{0,3}#{1,6}(?:\s+|$).*$/gm, " ")
    .replace(/`+[^`]*`+/g, " ");
}

function hasThaiProse(body) {
  return /[\u0e00-\u0e7f]{8,}/.test(markdownProse(body));
}

function hasEnglishProse(body) {
  const prose = markdownProse(body);
  return prose.split(/[.!?]\s+/).some((sentence) => {
    const words = sentence.match(/\b[a-z]{2,}\b/gi) ?? [];
    const proseWords = words.filter((word) => englishProseMarkers.has(word.toLowerCase()));
    const contentWords = words.filter((word) => !englishProseMarkers.has(word.toLowerCase()));
    return words.length >= 8 && proseWords.length >= 2 && contentWords.length >= 4;
  });
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

  it("lists implement-tickets in the generated agent-skill index", async () => {
    const skills = await discoverSkills();
    const index = await readText("docs/skills/README.md");

    assert.ok(skills.some((skill) => skill.category === "agents" && skill.name === "implement-tickets"));
    const row = tableRow(index, "implement-tickets");
    assert.ok(row, "the generated catalog has an implement-tickets row");
    assert.match(row, /\[คู่มือ \/ Guide\]\(agents\/implement-tickets\.md\)/);
  });

  it("removes the retired standalone skill without publishing an alias", async () => {
    const retiredName = ["subagent", "implement"].join("-");
    const index = await readText("docs/skills/README.md");
    const skills = await discoverSkills();

    for (const file of [
      `skills/agents/${retiredName}/SKILL.md`,
      `docs/guides/${retiredName}.md`,
      `docs/skills/agents/${retiredName}.md`,
      `tests/${retiredName}-contract.test.mjs`,
      `tests/${retiredName}-evals.test.mjs`,
    ]) {
      let exists = true;
      try {
        await access(file, constants.F_OK);
      } catch (error) {
        if (error.code === "ENOENT") exists = false;
        else throw error;
      }
      assert.equal(exists, false, `${file} has been retired`);
    }
    assert.ok(!skills.some((skill) => skill.name === retiredName), "the retired command has no installed-skill entry");
    assert.equal(tableRow(index, retiredName), null, "the generated catalog publishes no alias row");
  });

  it("finds no live reference to the retired command outside the bounded historical paths", async () => {
    const retiredName = ["subagent", "implement"].join("-");
    const historicalAdrNumbers = new Set(["0004", "0005", "0006", "0007", "0008", "0009", "0011", "0015", "0016"]);
    const roots = ["skills", "tests", "docs"];
    const files = (await Promise.all(roots.map(textFilesUnder))).flat();

    for (const entry of await readdir(".", { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      try {
        files.push({ file: entry.name, text: await readFile(entry.name, "utf8") });
      } catch {
        // Skip binary root files.
      }
    }
    try {
      files.push(...await textFilesUnder(".scratch"));
    } catch {
      // Scratch data is optional and local to a checkout.
    }

    const isHistorical = (file) => {
      const relative = file.split(path.sep).join("/");
      const adr = relative.match(/^docs\/decisions\/(\d{4})-[^/]+\.md$/);
      return relative.split("/").includes(".scratch")
        || relative === "docs/retro-log.md"
        || (adr && historicalAdrNumbers.has(adr[1]));
    };
    const violations = [];
    for (const { file, text } of files) {
      if (isHistorical(file)) continue;
      text.split("\n").forEach((line, index) => {
        if (line.includes(retiredName)) violations.push(`${file}:${index + 1}: ${line}`);
      });
    }

    assert.equal(
      violations.length,
      0,
      `found ${violations.length} live references; first matches:\n${violations.slice(0, 12).join("\n")}`,
    );
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

describe("production records and glossary", () => {
  it("records ADR 0020 as the implement-family core and supersedes the standalone statuses", async () => {
    const doc = await readTextOrNull("docs/decisions/0020-implement-tickets-core.md");
    assert.ok(doc, "ADR 0020 exists under docs/decisions/");
    const header = markdownHeaderBlock(doc);
    assert.match(header, /^# ADR 0020: Implement Tickets is the one core for the implement family$/m, "ADR 0020 has its expected header");
    for (const heading of ["Context / บริบท", "Decision / การตัดสินใจ", "Consequences / ผลที่ตามมา", "Rejected alternatives / ทางเลือกที่ไม่เลือก"]) {
      const section = markdownSection(doc, heading);
      const body = section?.split(/\r?\n/).slice(1).join("\n") ?? "";
      assert.ok(body && hasThaiProse(body), `ADR 0020 has Thai prose in ${heading}`);
      assert.ok(hasEnglishProse(body), `ADR 0020 has English prose in ${heading}`);
    }

    const decision = markdownSection(doc, "Decision / การตัดสินใจ");
    assert.ok(decision, "ADR 0020 has a bilingual Decision section");
    assert.ok(/defaults\s+to native subagents[\s\S]*parallel waves/i.test(decision), "the core defaults to native workers and parallel waves");
    assert.ok(/`implement-tickets-<backend>`[\s\S]*`--with <backend>`/.test(decision), "separate adapters are selected with --with");
    assert.ok(/retire(?:d)? the prior standalone core[\s\S]*no alias/i.test(decision), "the prior standalone core is retired without an alias");
    assert.ok(/`agy-implement`[\s\S]*`opencode-implement`[\s\S]*until their adapters ship/i.test(decision), "agy and opencode remain until adapters ship");
    assert.ok(/parallel readiness[\s\S]*recorded human validation/i.test(decision), "parallel readiness depends on a recorded human run");
    const validationRecord = markdownSection(doc, "Parallel validation record / บันทึกผล parallel validation");
    assert.ok(validationRecord, "ADR 0020 has a parallel validation record");
    assert.match(validationRecord, /Status: awaiting human validation/i, "the parallel-validation state is explicit");
    assert.match(validationRecord, /status: not validated/i, "the marker stays pending until the record is complete");
    assertAbsentFromMarkdownSections(doc, /26\.8%/, "the unverified conflict figure is not cited");

    const expectedStatusLine = "- Status / สถานะ: Superseded by ADR 0020 / ถูกแทนที่โดย ADR 0020, for the implement family (was: Accepted / ยอมรับแล้ว)";
    for (const file of [
      "docs/decisions/0004-agy-implement-standalone.md",
      `docs/decisions/0005-${["subagent", "implement"].join("-")}-standalone.md`,
      "docs/decisions/0007-opencode-implement-standalone.md",
    ]) {
      const previous = await readTextOrNull(file);
      assert.ok(previous, `${file} exists`);
      const statusBlock = file.includes("0007-")
        ? markdownSection(previous, "Status / สถานะ")
        : markdownHeaderBlock(previous);
      assert.ok(statusBlock, `${file} has a status metadata block`);
      const status = statusBlock.split("\n").find((line) => line.startsWith("- Status / สถานะ:"));
      assert.equal(status, expectedStatusLine, `${file} has the exact bilingual superseded status`);
    }
  });

  it("rejects ADR language evidence found only in inline code or Markdown headings", () => {
    const thaiInCode = "`ข้อความภาษาไทย`";
    const thaiInHeading = "### ภาษาไทยที่เป็นเพียงหัวข้อ";
    const repeatedFunctionWords = "the the the the the the the the.";

    assert.equal(hasThaiProse(thaiInCode), false, "Thai in inline code is not prose evidence");
    assert.equal(hasThaiProse(thaiInHeading), false, "Thai in a Markdown heading is not prose evidence");
    assert.equal(hasThaiProse("ก"), false, "one Thai codepoint is too short to count as prose");
    assert.equal(hasEnglishProse(repeatedFunctionWords), false, "repeated English function words are not prose evidence");
    assert.equal(hasThaiProse("นี่คือข้อความภาษาไทยที่เป็นเนื้อหาจริง"), true, "Thai prose is accepted");
    assert.equal(
      hasEnglishProse("The adapter remains ready while workers can complete the review."),
      true,
      "English prose with content words is accepted",
    );
  });

  it("defines implement-tickets vocabulary and both Worker senses in bilingual glossary rows", async () => {
    const glossary = await readTextOrNull("docs/glossary.md");
    assert.ok(glossary, "the glossary exists");

    const terms = ["Wave", "Touch set", "Integration gate"];
    const rows = Object.fromEntries(terms.map((term) => [term, tableRow(glossary, term)]));
    const meanings = {
      Wave: /group of tickets[\s\S]*run together/i,
      "Touch set": /paths?[\s\S]*\(edit from NN\)[\s\S]*extras/i,
      "Integration gate": /typecheck[\s\S]*full test suite[\s\S]*squash-merged/i,
    };
    for (const [term, row] of Object.entries(rows)) {
      assert.ok(row, `the glossary has a row for ${term}`);
      assert.equal(row.split("|").length, 5, `the ${term} row has the Term, ภาษาไทย, and Definition cells`);
      assert.ok(row.split("|")[2].trim(), `the ${term} row has a Thai term`);
      assert.match(row.split("|")[3], / \/ .+/, `the ${term} definition is bilingual`);
      assert.match(row.split("|")[3], meanings[term], `the ${term} definition describes its implement-tickets meaning`);
    }

    const worker = tableRow(glossary, "Worker");
    assert.ok(worker, "the glossary keeps a Worker row");
    assert.match(worker, /engineering-workflow[\s\S]*external specialist/i, "Worker retains its engineering-workflow meaning");
    assert.match(worker, /`implement-tickets`[\s\S]*subagent[\s\S]*one ticket/i, "Worker adds the implement-tickets subagent meaning");
    assert.match(worker, /ใน `engineering-workflow`[\s\S]*external specialist[\s\S]*ใน `implement-tickets`[\s\S]*ticket/, "Worker distinguishes both senses in Thai too");

    const usage = tableRow(glossary, "usage_total");
    assert.ok(usage, "the usage_total row exists");
    assert.doesNotMatch(usage, /`implement-tickets`/, "usage_total no longer names implement-tickets, which tracks no usage");
  });

  it("keeps the glossary to terms in use, with the Seam, Tracker, and Run status rows", async () => {
    const glossary = await readTextOrNull("docs/glossary.md");
    assert.ok(glossary, "the glossary exists");

    for (const term of ["Seam", "Tracker", "Run status"]) {
      const row = tableRow(glossary, term);
      assert.ok(row, `the glossary has a row for ${term}`);
      assert.equal(row.split("|").length, 5, `the ${term} row has the Term, ภาษาไทย, and Definition cells`);
      assert.match(row.split("|")[3], / \/ .+/, `the ${term} definition is bilingual`);
    }
    assert.doesNotMatch(tableRow(glossary, "Seam"), /\*\*Seam:\*\*|ticket/i, "Seam is not tied to a ticket field");

    for (const term of ["Budget line", "Scenario", "Manifest", "Ticket review"]) {
      assert.equal(tableRow(glossary, term), null, `the glossary no longer has a row for ${term}`);
    }
  });

  it("records ADR 0027 and names it in each ADR it has superseded so far", async () => {
    assert.ok(await readTextOrNull("docs/decisions/0027-grill-to-tickets-and-implement-tickets-follow-upstream.md"), "ADR 0027 exists");
    const superseded = {
      "0002": "engineering-workflow-orchestrator",
      "0003": "grill-to-tickets-standalone-composite",
      "0006": "review-to-pr-standalone",
      "0010": "grill-to-tickets-fresh-context-design-review",
      "0012": "retro-to-remedies-standalone",
      "0013": "grill-to-tickets-owns-spec-and-ticket-formats",
      "0014": "measure-tickets-before-limiting-them",
      "0017": "drop-reuse-and-let-the-user-bound-the-design-review",
      "0018": "grill-to-tickets-scenarios-manifest-and-ticket-review",
      "0019": "grill-to-tickets-tiers-parked-questions-and-one-pause",
    };
    for (const [number, slug] of Object.entries(superseded)) {
      const doc = await readText(`docs/decisions/${number}-${slug}.md`);
      assert.match(doc, /Superseded by ADR 0027/, `ADR ${number} names ADR 0027`);
    }
  });
});
