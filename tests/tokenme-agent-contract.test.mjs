import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { flatMarkdownSection, markdownSection } from "./helpers/markdown-contract.mjs";

const canonicalDir = "skills/agents/tokenme-agent";
const skillFile = path.resolve(canonicalDir, "SKILL.md");
const agentConfigFile = path.resolve(canonicalDir, "agents/openai.yaml");

async function fileExists(filePath) {
  await access(filePath, constants.R_OK);
}

// Frontmatter lines only, so a phrase moving into the body fails the
// description assertion instead of passing it by accident.
function frontmatterBlock(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, "SKILL.md must start with YAML frontmatter");
  return match[1];
}

function frontmatterFields(markdown) {
  const fields = {};
  for (const line of frontmatterBlock(markdown).split("\n")) {
    const field = line.match(/^([a-z][a-z0-9_-]*):\s*(.*)$/i);
    if (field) {
      fields[field[1]] = field[2].trim();
    }
  }
  return fields;
}

// The Invocation section hosts the three entry points; each invocation claim
// is asserted there, so wording elsewhere satisfies nothing.
function invocationSection(markdown) {
  return flatMarkdownSection(markdown, "Invocation");
}

describe("tokenme-agent skill contract", () => {
  it("has model-invocable frontmatter with a one-line description", async () => {
    await fileExists(skillFile);
    const markdown = await readFile(skillFile, "utf8");
    const frontmatter = frontmatterBlock(markdown);
    const meta = frontmatterFields(markdown);
    assert.equal(meta.name, "tokenme-agent");
    assert.doesNotMatch(
      frontmatter,
      /disable-model-invocation/,
      "the skill stays model-invocable by shipping no disable-model-invocation block",
    );
    const description = meta.description ?? "";
    assert.ok(
      description.length >= 80,
      "the description must be at least 80 characters",
    );
    const descriptionLine = frontmatter
      .split("\n")
      .findIndex((line) => line.startsWith("description:"));
    const nextLine = frontmatter.split("\n")[descriptionLine + 1] ?? "---";
    assert.match(
      nextLine,
      /^(?:[a-z][a-z0-9_-]*:|---)/,
      "the description sits on a single line, with no folded continuation",
    );
  });

  it("aims the description at mechanical, self-contained work, its phrases, and its exclusions", async () => {
    const meta = frontmatterFields(await readFile(skillFile, "utf8"));
    const description = meta.description ?? "";
    assert.match(
      description,
      /mechanical, self-contained/,
      "the description names the mechanical, self-contained work the skill takes",
    );
    assert.match(description, /use tokenme/);
    assert.match(description, /delegate this/);
    assert.match(description, /do this cheaply/);
    assert.match(
      description,
      /Keep on the host/,
      "the description states the work the skill is not for",
    );
  });

  it("directs a recognised mechanical subtask to delegation", async () => {
    await fileExists(skillFile);
    const markdown = await readFile(skillFile, "utf8");
    const invocation = invocationSection(markdown);
    assert.match(
      invocation,
      /recognise a mechanical, self-contained subtask/,
      "the Invocation section names the recognition trigger",
    );
    assert.match(
      invocation,
      /rename across small files/,
      "the Invocation section gives a rename across small files as the example",
    );
    assert.match(
      invocation,
      /delegate it/,
      "the Invocation section tells the agent to delegate the recognised subtask",
    );
  });

  it("reads 'use tokenme' phrasing in a task text as a reason to consider delegating", async () => {
    const markdown = await readFile(skillFile, "utf8");
    const invocation = invocationSection(markdown);
    assert.match(
      invocation,
      /"use tokenme"/,
      "the Invocation section accepts 'use tokenme' phrasing inside task text",
    );
    assert.match(
      invocation,
      /consider delegating/,
      "the Invocation section answers that phrasing by considering delegation",
    );
  });

  it("documents direct invocation by slash command and Codex command", async () => {
    const markdown = await readFile(skillFile, "utf8");
    const invocation = markdownSection(markdown, "Invocation");
    assert.ok(invocation, "the Invocation section exists");
    assert.match(invocation, /\/tokenme-agent <task description>/);
    assert.match(
      invocation,
      /\$tokenme-agent <task description>/,
      "the Invocation section documents the Codex command form",
    );
  });

  it("delegates the subtask in its workflow and keeps verification with the host", async () => {
    const markdown = await readFile(skillFile, "utf8");
    const workflow = flatMarkdownSection(markdown, "Workflow");
    assert.match(
      workflow,
      /\*\*Delegate\*\* the subtask/,
      "the Workflow section's delegation step names delegating the subtask",
    );
    assert.match(
      workflow,
      /\*\*Verify\*\* the outcome yourself/,
      "the Workflow section keeps verification with the host",
    );
  });

  it("configures the Codex agent entry for implicit invocation under $tokenme-agent", async () => {
    await fileExists(agentConfigFile);
    const config = await readFile(agentConfigFile, "utf8");
    const policyStart = config.indexOf("policy:");
    assert.notEqual(policyStart, -1, "openai.yaml has a policy section");
    const interfaceBlock = config.slice(0, policyStart);
    const policyBlock = config.slice(policyStart);
    assert.match(
      interfaceBlock,
      /default_prompt:\s*"[^"]*\$tokenme-agent/,
      "the default prompt invokes $tokenme-agent",
    );
    assert.match(
      policyBlock,
      /allow_implicit_invocation:\s*true/,
      "implicit invocation stays allowed",
    );
  });
});
