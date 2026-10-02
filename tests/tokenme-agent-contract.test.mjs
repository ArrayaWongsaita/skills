import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import {
  assertAbsentFromMarkdownSections,
  flatMarkdownSection,
  markdownSection,
} from "./helpers/markdown-contract.mjs";

const canonicalDir = "skills/agents/tokenme-agent";
const skillFile = path.resolve(canonicalDir, "SKILL.md");
const agentConfigFile = path.resolve(canonicalDir, "agents/openai.yaml");
const policyFile = path.resolve(canonicalDir, "references/delegation-policy.md");

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

// Markdown link targets inside one section, so a policy link is asserted
// where the skill uses it instead of anywhere in the file.
function sectionLinks(markdown) {
  return [...markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
    .map((match) => match[1].trim().split(/\s+/)[0]);
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

describe("tokenme-agent delegation policy contract", () => {
  it("ships the policy and resolves the skill's link to it", async () => {
    const markdown = await readFile(skillFile, "utf8");
    const whatToDelegate = markdownSection(markdown, "What to delegate");
    assert.ok(whatToDelegate, "the What to delegate section exists");
    const links = sectionLinks(whatToDelegate);
    const policyLink = links.find((link) => link.endsWith("references/delegation-policy.md"));
    assert.ok(
      policyLink,
      "the What to delegate section links to references/delegation-policy.md",
    );
    await fileExists(path.resolve(canonicalDir, policyLink));
  });

  it("keeps secret-file work on the host and dispatches nothing", async () => {
    const policy = await readFile(policyFile, "utf8");
    const keepLocal = flatMarkdownSection(policy, "Keep-local rules");
    assert.match(
      keepLocal,
      /secrets file/,
      "the keep-local rules name secrets files",
    );
    assert.match(
      keepLocal,
      /credential files/,
      "the keep-local rules name credential files",
    );
    assert.match(
      keepLocal,
      /`\.env` files/,
      "the keep-local rules name `.env` files",
    );
    assert.match(
      keepLocal,
      /keeps the task/,
      "the host keeps a task that would touch a secrets file",
    );
    assert.match(
      keepLocal,
      /dispatches nothing|sends nothing to the gateway/,
      "a kept task reaches no gateway",
    );
  });

  it("keeps high-risk tickets and user-marked-local code on the host, and checks the mark before dispatch", async () => {
    const policy = await readFile(policyFile, "utf8");
    const keepLocal = flatMarkdownSection(policy, "Keep-local rules");
    assert.match(
      keepLocal,
      /`Risk: high`/,
      "tickets marked Risk: high stay on the host",
    );
    assert.match(
      keepLocal,
      /staying local/,
      "code the user marked as staying local stays on the host",
    );

    const markOrigin = flatMarkdownSection(
      policy,
      "Where the keep-local mark comes from",
    );
    assert.match(
      markOrigin,
      /the user's request/,
      "a keep-local mark can come from the user's request",
    );
    assert.match(
      markOrigin,
      /the host's own instruction files/,
      "a keep-local mark can come from the host's own instruction files",
    );
    assert.match(
      markOrigin,
      /before dispatch/,
      "the host checks the mark before dispatch",
    );
    assert.match(
      markOrigin,
      /reads no project instructions/,
      "a bare delegate run reads no project instructions, so the host check is the only check",
    );
  });

  it("applies the three-check eligibility checklist before every delegation", async () => {
    const policy = await readFile(policyFile, "utf8");
    const checklist = flatMarkdownSection(policy, "Eligibility checklist");
    assert.match(
      checklist,
      /before every delegation/,
      "the checklist runs before every delegation",
    );
    const selfContained = checklist.search(/\*\*Self-contained\*\*/);
    const fitsBudget = checklist.search(/\*\*Fits the budget\*\*/);
    const verifiable = checklist.search(/\*\*Verifiable by a diff or a test run\*\*/);
    assert.notEqual(selfContained, -1, "check one is self-contained");
    assert.notEqual(fitsBudget, -1, "check two fits the budget");
    assert.notEqual(verifiable, -1, "check three is verifiable by a diff or a test run");
    assert.ok(
      selfContained < fitsBudget && fitsBudget < verifiable,
      "the three checks appear in checklist order",
    );
    assert.match(
      checklist,
      /needs this chat's earlier context fails this check and stays on the host/,
      "a task needing earlier chat context fails the checklist and stays on the host",
    );
    assert.doesNotMatch(
      checklist,
      /60k|90k|128k/,
      "the checklist names the budget check without restating the budget numbers",
    );
  });

  it("excludes architecture choices, judgment debugging, and security-sensitive edits", async () => {
    const policy = await readFile(policyFile, "utf8");
    const exclusions = flatMarkdownSection(policy, "Exclusions");
    assert.match(
      exclusions,
      /host keeps this work itself/,
      "the host keeps excluded work itself",
    );
    assert.match(
      exclusions,
      /choosing between two architectures/,
      "a request to choose between two architectures is excluded",
    );
    assert.match(
      exclusions,
      /debugging that needs judgment/i,
      "debugging that needs judgment is excluded",
    );
    assert.match(
      exclusions,
      /security-sensitive edits/i,
      "security-sensitive edits are excluded",
    );
  });

  it("summarises the keep-local rules in the skill in positive wording", async () => {
    const markdown = await readFile(skillFile, "utf8");
    const whatToDelegate = flatMarkdownSection(markdown, "What to delegate");
    assert.match(
      whatToDelegate,
      /Keep on the host anything touching secrets/,
      "the summary keeps secrets work on the host in positive wording",
    );
    assert.match(
      whatToDelegate,
      /`\.env` or credential files/,
      "the summary keeps `.env` and credential files on the host",
    );
    assert.match(
      whatToDelegate,
      /`Risk: high`/,
      "the summary keeps Risk: high tickets on the host",
    );
    assert.match(
      whatToDelegate,
      /staying local/,
      "the summary keeps user-marked-local code on the host",
    );
    assertAbsentFromMarkdownSections(
      markdown,
      /\bNever\b|\bDo not\b|\bDon't\b/i,
      "the skill steers positively",
    );
  });
});
