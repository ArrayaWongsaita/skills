import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
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
const budgetGuideFile = path.resolve(
  canonicalDir,
  "references/budget-and-chunking.md",
);

async function fileExists(filePath) {
  await access(filePath, constants.R_OK);
}

// Every file under the skill's own directory, at any depth, so the
// no-model-identifier scan keeps covering the evals JSON when it lands.
async function listFilesRecursive(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const child = path.resolve(directory, entry.name);
      return entry.isDirectory() ? listFilesRecursive(child) : child;
    }),
  );
  return files.flat();
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

describe("tokenme-agent budget and chunking contract", () => {
  it("ships the guide and resolves the skill's link to it from What to delegate", async () => {
    await fileExists(budgetGuideFile);
    const markdown = await readFile(skillFile, "utf8");
    const whatToDelegate = markdownSection(markdown, "What to delegate");
    assert.ok(whatToDelegate, "the What to delegate section exists");
    const links = sectionLinks(whatToDelegate);
    const guideLink = links.find((link) =>
      link.endsWith("references/budget-and-chunking.md"),
    );
    assert.ok(
      guideLink,
      "the What to delegate section links to references/budget-and-chunking.md",
    );
    await fileExists(path.resolve(canonicalDir, guideLink));
  });

  it("sizes every delegation against the 60k planning budget with the 90k ceiling, not the 128k window", async () => {
    const guide = await readFile(budgetGuideFile, "utf8");
    const budget = flatMarkdownSection(guide, "The planning budget");
    assert.match(
      budget,
      /planning budget of 60k tokens/,
      "the planning budget is 60k tokens",
    );
    assert.match(
      budget,
      /footprint plus the run's fixed overhead/,
      "the budget counts the task's footprint plus the run's fixed overhead",
    );
    assert.match(
      budget,
      /ceiling is 90k tokens/,
      "the ceiling is 90k tokens",
    );
    assert.match(
      budget,
      /128k window is not the planning number/,
      "the model's 128k window is named as not the planning number",
    );
  });

  it("gives the footprint formula, the two overhead figures, and a worked example", async () => {
    const guide = await readFile(budgetGuideFile, "utf8");
    const formula = flatMarkdownSection(guide, "The footprint formula");
    assert.match(
      formula,
      /footprint = file bytes \/ 4 \* 1\.5/,
      "the formula is file bytes divided by 4, times 1.5",
    );
    assert.match(
      formula,
      /divided by 4/,
      "the prose states the division by 4",
    );
    assert.match(
      formula,
      /times 1\.5/,
      "the prose states the multiplication by 1.5",
    );
    assert.match(
      formula,
      /the fixed overhead is added on top/,
      "the footprint excludes the fixed overhead, which is added separately",
    );
    assert.match(
      formula,
      /about 1k for a bare run/,
      "a bare run adds about 1k of fixed overhead",
    );
    assert.match(
      formula,
      /about 28k for a run that is not bare/,
      "a run that is not bare adds about 28k of fixed overhead",
    );
    assert.match(
      formula,
      /three files totalling 120 KB/,
      "the worked example uses three files totalling 120 KB",
    );
    assert.match(
      formula,
      /about 45k of footprint/,
      "120 KB comes to about 45k of footprint",
    );
    assert.match(
      formula,
      /plus about 1k of bare overhead/,
      "the bare example adds about 1k of overhead",
    );
    assert.match(
      formula,
      /it fits/,
      "the 120 KB example fits the budget",
    );
    assert.match(
      formula,
      /about 400 KB/,
      "the second example points at about 400 KB",
    );
    assert.match(
      formula,
      /about 150k/,
      "400 KB comes to about 150k",
    );
    assert.match(
      formula,
      /does not fit/,
      "the 400 KB example does not fit the budget",
    );
  });

  it("splits an oversized job into independent chunks that run as separate delegate runs", async () => {
    const guide = await readFile(budgetGuideFile, "utf8");
    const splitting = flatMarkdownSection(guide, "Splitting an oversized job");
    assert.match(
      splitting,
      /refactor spanning forty files/,
      "a refactor spanning forty files is the oversized example",
    );
    assert.match(
      splitting,
      /per-file or per-directory chunks/,
      "the split is into per-file or per-directory chunks",
    );
    assert.match(
      splitting,
      /each chunk runs as a separate delegate run/,
      "each chunk runs as its own delegate run",
    );
    assert.match(
      splitting,
      /none depends on another chunk's output/,
      "the chunks do not depend on each other's output",
    );
  });

  it("names the three overflow symptoms and treats a run showing one as failed", async () => {
    const guide = await readFile(budgetGuideFile, "utf8");
    const symptoms = flatMarkdownSection(guide, "Overflow symptoms");
    assert.match(
      symptoms,
      /Truncated edits/,
      "truncated edits are a named symptom",
    );
    assert.match(
      symptoms,
      /omits files it was told to touch/,
      "a result that omits files it was told to touch is a named symptom",
    );
    assert.match(
      symptoms,
      /terminal reason other than `completed`/,
      "a terminal reason other than completed is a named symptom",
    );
    assert.match(
      symptoms,
      /is treated as failed/,
      "a run showing one symptom is treated as failed",
    );
    assert.match(
      symptoms,
      /re-split the task into smaller chunks/,
      "the failed run's task is re-split smaller",
    );
  });

  it("answers oversized work with a split and leaves compaction out of the plan", async () => {
    const guide = await readFile(budgetGuideFile, "utf8");
    const compaction = flatMarkdownSection(guide, "Compaction");
    assert.match(
      compaction,
      /Compaction is never relied on/,
      "compaction is never relied on",
    );
    assert.match(
      compaction,
      /split is what brings an oversized task back inside the budget/,
      "the split, not compaction, brings an oversized task back inside the budget",
    );
  });
});

describe("tokenme-agent dispatch contract", () => {
  const dispatchFile = path.resolve(
    canonicalDir,
    "references/dispatch-contract.md",
  );
  const skillDir = path.resolve(canonicalDir);

  // The history-changing git shell prefixes and global flags the deny list
  // blocks, in the order the contract lists them.
  const gitDenyPrefixes = [
    "commit",
    "push",
    "reset",
    "checkout",
    "clean",
    "stash",
    "rebase",
    "merge",
    "pull",
    "restore",
    "switch",
    "cherry-pick",
    "revert",
    "am",
    "-C",
    "-c",
  ];

  async function dispatchSection(title) {
    const dispatch = await readFile(dispatchFile, "utf8");
    return flatMarkdownSection(dispatch, title);
  }

  it("ships the dispatch contract and resolves the skill's link to it from the Workflow", async () => {
    const markdown = await readFile(skillFile, "utf8");
    const workflow = markdownSection(markdown, "Workflow");
    assert.ok(workflow, "the Workflow section exists");
    const links = sectionLinks(workflow);
    const dispatchLink = links.find((link) =>
      link.endsWith("references/dispatch-contract.md"),
    );
    assert.ok(
      dispatchLink,
      "the Workflow section links to references/dispatch-contract.md",
    );
    await fileExists(path.resolve(canonicalDir, dispatchLink));
  });

  it("dispatches bare by default and documents the opt-out that adds about 28k to the budget check", async () => {
    const command = await dispatchSection("The dispatch command");
    assert.match(
      command,
      /--bare/,
      "the dispatch command carries the bare flag",
    );
    const bare = await dispatchSection("Bare by default");
    assert.match(
      bare,
      /`--bare` is the default for every delegate run/,
      "bare is the default for every delegate run",
    );
    assert.match(
      bare,
      /truly depends on project instructions/,
      "the opt-out is for a task that truly depends on project instructions",
    );
    assert.match(
      bare,
      /adds about 28k tokens of overhead to the budget check/,
      "dropping bare adds about 28k tokens of overhead to the budget check",
    );
  });

  it("reads the prompt from a prompt file instead of inlining it in the shell command", async () => {
    const command = await dispatchSection("The dispatch command");
    assert.match(
      command,
      /-p "\$\(cat \/tmp\/tokenme-prompts\/<task-id>\.md\)"/,
      "the prompt is passed by reading the prompt file",
    );
    assert.match(
      command,
      /read from the prompt file/,
      "the prose states the prompt is read from the prompt file",
    );
  });

  it("sends JSON to a result file on stdout and warnings to a separate error file on stderr", async () => {
    const command = await dispatchSection("The dispatch command");
    assert.match(
      command,
      /--output-format json/,
      "the run uses the JSON output format",
    );
    assert.match(
      command,
      /> \/tmp\/tokenme-runs\/<task-id>\.json/,
      "stdout is redirected to the result file",
    );
    assert.match(
      command,
      /2> \/tmp\/tokenme-runs\/<task-id>\.err/,
      "stderr is redirected to a separate error file",
    );
    const dispatch = await readFile(dispatchFile, "utf8");
    assertAbsentFromMarkdownSections(
      dispatch,
      /2>&1|&>/,
      "no merged stdout and stderr redirection appears in the dispatch contract",
    );
  });

  it("keeps one-shot runs out of session storage and out of slash-command expansion", async () => {
    const command = await dispatchSection("The dispatch command");
    assert.match(
      command,
      /--no-session-persistence/,
      "one-shot runs carry the no-session-persistence flag",
    );
    assert.match(
      command,
      /--disable-slash-commands/,
      "one-shot runs carry the disable-slash-commands flag",
    );
  });

  it("restricts a read-only task such as summarising a log to the read tools", async () => {
    const scoping = await dispatchSection("Tool scoping by task kind");
    assert.match(
      scoping,
      /summarising a log/,
      "a read-only task such as summarising a log is the named case",
    );
    assert.match(
      scoping,
      /--allowed-tools "Read Glob Grep"/,
      "the read-only scoping restricts the tool set to read, glob and grep",
    );
    assert.match(
      scoping,
      /cannot edit a file or run a shell command/,
      "the read-only scoping leaves the run no edit and no shell",
    );
  });

  it("allows the edit, write and shell tools explicitly for a task that edits files and runs a formatter", async () => {
    const scoping = await dispatchSection("Tool scoping by task kind");
    assert.match(
      scoping,
      /formatting pass/,
      "a task that edits files and runs a formatter is the named case",
    );
    assert.match(
      scoping,
      /--allowed-tools "Read Glob Grep Edit Write Bash"/,
      "the edit scoping names edit, write and shell explicitly",
    );
    assert.match(
      scoping,
      /does not stall on a permission prompt/,
      "the explicit allow list keeps an unattended run off a permission prompt",
    );
  });

  it("denies the history-changing git prefixes and starting another claude or claude-tokenme run", async () => {
    const denyList = await dispatchSection("The deny list");
    assert.match(
      denyList,
      /--disallowed-tools/,
      "the deny list rides on the disallowed-tools flag",
    );
    for (const prefix of gitDenyPrefixes) {
      assert.ok(
        denyList.includes(`Bash(git ${prefix}:*)`),
        `the deny list blocks git ${prefix}`,
      );
    }
    assert.ok(
      denyList.includes("Bash(claude:*)") &&
        denyList.includes("Bash(claude-tokenme:*)"),
      "the deny list blocks starting another claude or claude-tokenme run",
    );
  });

  it("carries the deny list onto a non-bare run and names prefix rules with host verification as the backstop", async () => {
    const denyList = await dispatchSection("The deny list");
    assert.match(
      denyList,
      /not bare carries the same deny list/,
      "a run that is not bare carries the same deny list",
    );
    assert.match(
      denyList,
      /prefix rules/,
      "the deny patterns are prefix rules",
    );
    assert.match(
      denyList,
      /Host verification is the backstop/,
      "host verification backs the deny list up",
    );
  });

  it("takes the model from the tokenme settings file and names no model identifier in any skill file", async () => {
    const preflight = await dispatchSection("Preflight");
    assert.match(
      preflight,
      /The model is whatever the tokenme settings file configures/,
      "the model comes from the user's tokenme settings file",
    );
    const files = await listFilesRecursive(skillDir);
    assert.ok(
      files.some((file) => file.endsWith("SKILL.md")),
      "the scan reaches the skill's own files",
    );
    assert.ok(
      files.some((file) => file.endsWith("openai.yaml")),
      "the scan reaches the agent config",
    );
    for (const file of files) {
      const text = await readFile(file, "utf8");
      assert.equal(
        text.match(/qwen[\s-]?\d/i),
        null,
        `${path.relative(skillDir, file)} names a model identifier`,
      );
    }
  });

  it("preflights the tokenme command and falls back to the expanded claude --settings form", async () => {
    const preflight = await dispatchSection("Preflight");
    assert.match(
      preflight,
      /command -v claude-tokenme/,
      "the preflight checks that claude-tokenme exists",
    );
    assert.match(
      preflight,
      /claude --settings/,
      "the preflight accepts the expanded claude --settings form",
    );
    assert.match(
      preflight,
      /aliases do not expand/,
      "the expanded form is for shells where aliases do not expand",
    );
    assert.match(
      preflight,
      /stop and give the user the one-time setup/,
      "the preflight stops with setup instructions when neither form exists",
    );
  });

  it("shows one-time harness allow rules for both command forms", async () => {
    const setup = await dispatchSection("One-time harness setup");
    assert.ok(
      setup.includes("Bash(claude-tokenme:*)"),
      "the allow rules cover the alias form",
    );
    assert.ok(
      setup.includes("Bash(claude --settings:*)"),
      "the allow rules cover the expanded form",
    );
  });
});
