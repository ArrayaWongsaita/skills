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

  it("names no retired skill outside the historical records", async () => {
    const retired = [
      ["review", "to", "pr"],
      ["agy", "implement"],
      ["opencode", "implement"],
      ["retro", "to", "remedies"],
      ["engineering", "workflow"],
    ].map((parts) => parts.join("-"));
    const files = (await Promise.all(["skills", "tests", "docs", "scripts", ".github"].map(
      async (root) => {
        try {
          return await textFilesUnder(root);
        } catch {
          return [];
        }
      },
    ))).flat();
    for (const entry of await readdir(".", { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const text = await readTextOrNull(entry.name);
      if (text !== null) files.push({ file: entry.name, text });
    }
    // Only the settings file under .claude: its worktrees hold copies of the repo.
    const settings = await readTextOrNull(".claude/settings.json");
    if (settings !== null) files.push({ file: ".claude/settings.json", text: settings });

    // Historical records: every ADR, the retro log, and .scratch (not scanned).
    const isHistorical = (file) => {
      const relative = file.split(path.sep).join("/");
      return /^docs\/decisions\/\d{4}-[^/]+\.md$/.test(relative) || relative === "docs/retro-log.md";
    };
    const violations = [];
    for (const { file, text } of files) {
      if (isHistorical(file)) continue;
      text.split("\n").forEach((line, index) => {
        if (retired.some((name) => line.includes(name))) violations.push(`${file}:${index + 1}: ${line.trim()}`);
      });
    }

    assert.equal(
      violations.length,
      0,
      `found ${violations.length} references to a retired skill; first matches:\n${violations.slice(0, 20).join("\n")}`,
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
  it("keeps the glossary to terms in use, with the Seam, Tracker, and Run status rows", async () => {
    const glossary = await readTextOrNull("docs/glossary.md");
    assert.ok(glossary, "the glossary exists");

    for (const term of ["Seam", "Tracker", "Run status"]) {
      const row = tableRow(glossary, term);
      assert.ok(row, `the glossary has a row for ${term}`);
      assert.equal(row.split("|").length, 5, `the ${term} row has the Term, ภาษาไทย, and Definition cells`);
      assert.match(row.split("|")[3], / \/ .+/, `the ${term} definition is bilingual`);
    }
    assert.doesNotMatch(tableRow(glossary, "Seam"), /\*\*Seam:\*\*|\bticket (field|id|number)\b/i, "Seam is not tied to a ticket field");

    for (const term of ["Workflow Orchestrator", "Stage", "Gate", "Worker", "Wave", "Touch set", "Extra", "Drift", "Integration gate", "External Specialist", "Artifact Reference", "Workflow State", "Read set", "Budget line", "usage_total", "Scenario", "Manifest", "Ticket review", "Retro", "Miss", "Remedy", "Retro Log"]) {
      assert.equal(tableRow(glossary, term), null, `the glossary no longer has a row for ${term}`);
    }
  });

  it("records ADR 0027 and names it in each ADR it supersedes", async () => {
    assert.ok(await readTextOrNull("docs/decisions/0027-grill-to-tickets-and-implement-tickets-follow-upstream.md"), "ADR 0027 exists");
    const superseded = ["0002", "0003", "0006", "0010", "0012", "0013", "0014", "0016", "0017", "0018", "0019", "0020", "0021", "0022", "0023"];
    const files = await readdir("docs/decisions");
    for (const number of superseded) {
      const file = files.find((name) => name.startsWith(`${number}-`));
      assert.ok(file, `ADR ${number} exists`);
      const doc = await readText(`docs/decisions/${file}`);
      assert.match(doc, /Superseded by ADR 0027/, `ADR ${number} names ADR 0027`);
    }
  });
});
