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

describe("Full-Lifecycle Orchestrator Contract (grill-with-docs)", () => {
  const skillPath = path.resolve(".agents/skills/grill-with-docs/SKILL.md");

  it("exists and defines valid YAML frontmatter", async () => {
    await fileExists(skillPath);
    const content = await readFile(skillPath, "utf8");
    const meta = parseFrontmatter(content);

    assert.equal(meta.name, "grill-with-docs");
    assert.ok(meta.description && meta.description.length > 20, "Description must be present");
    assert.equal(meta["disable-model-invocation"], "true");
  });

  it("defines all six sequential phases in the lifecycle", async () => {
    const content = await readFile(skillPath, "utf8");

    assert.match(content, /Phase 1.*(Discovery|Grilling|Domain Modeling)/i);
    assert.match(content, /Phase 2.*(Specification|Spec|Design Gate)/i);
    assert.match(content, /Phase 3.*(Vertical Ticket Breakdown|Tickets)/i);
    assert.match(content, /Phase 4.*(Context Boundary|Smart Zone Reset)/i);
    assert.match(content, /Phase 5.*(Implementation Loop|Test-Driven Implementation)/i);
    assert.match(content, /Phase 6.*(System Review|Review & Wrap-Up)/i);
  });

  it("enforces inline execution of child skills", async () => {
    const content = await readFile(skillPath, "utf8");

    assert.match(content, /inline/i, "Must instruct inline execution");
    assert.match(content, /grilling/i);
    assert.match(content, /domain-modeling/i);
    assert.match(content, /to-spec/i);
    assert.match(content, /scrutinize/i);
    assert.match(content, /to-tickets/i);
    assert.match(content, /tdd/i);
    assert.match(content, /code-review/i);
  });

  it("specifies the feature-scoped directory structure under .scratch/<feature-slug>/", async () => {
    const content = await readFile(skillPath, "utf8");

    assert.match(content, /\.scratch\/<feature-slug>\//);
    assert.match(content, /\.scratch\/<feature-slug>\/CONTEXT\.md/);
    assert.match(content, /\.scratch\/<feature-slug>\/adr\//);
    assert.match(content, /\.scratch\/<feature-slug>\/spec\.md/);
    assert.match(content, /\.scratch\/<feature-slug>\/issues\//);
  });

  it("defines explicit user confirmation gates across phase boundaries", async () => {
    const content = await readFile(skillPath, "utf8");

    // Post-Discovery gate
    assert.match(content, /Gate 1|Post-Discovery|Post-Grilling/i);
    // Post-Spec / Design gate
    assert.match(content, /Gate 2|Post-Spec|Design Gate/i);
    // Post-Tickets gate
    assert.match(content, /Gate 3|Post-Tickets/i);
    // Post-Ticket Implementation gate
    assert.match(content, /Gate 4|Post-Ticket Implementation/i);

    // Design review verdicts and bounded cycle budget
    assert.match(content, /Pass/);
    assert.match(content, /Minor Correction/);
    assert.match(content, /Rework/);
    assert.match(content, /Reject/);
    assert.match(content, /budget/i);
  });

  it("outputs clear context-clearing instructions (/clear) with resume commands", async () => {
    const content = await readFile(skillPath, "utf8");

    assert.match(content, /\/clear/);
    assert.match(content, /\/implement \.scratch\/<feature-slug>\/issues\/01-/);
    assert.match(content, /Smart Zone/);
  });
});
