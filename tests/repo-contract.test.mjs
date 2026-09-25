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
