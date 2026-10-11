import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import {
  assertAbsentFromMarkdownSections,
  flatMarkdownSection,
  markdownHeaderBlock,
  markdownHeadings,
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

// The dispatch contract sliced per section — one reader shared by the
// describe blocks that assert against it.
const dispatchFile = path.resolve(
  canonicalDir,
  "references/dispatch-contract.md",
);

async function dispatchSection(title) {
  const dispatch = await readFile(dispatchFile, "utf8");
  return flatMarkdownSection(dispatch, title);
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

describe("tokenme-agent result gate, verification and failure policy contract", () => {
  it("counts a run as successful only on a clean envelope plus a zero exit code, and fails it with stderr otherwise", async () => {
    const gate = await dispatchSection("The result gate");
    assert.match(
      gate,
      /--output-format json/,
      "the gate names the flag whose result object it reads",
    );
    assert.match(
      gate,
      /A run counts as successful only when/,
      "the gate states its conjunctive success rule",
    );
    const noError = gate.search(/`is_error` false/);
    const successSubtype = gate.search(/`subtype` reports success/);
    const completed = gate.search(/`terminal_reason` is `completed`/);
    const exitZero = gate.search(/exit code is zero/);
    assert.notEqual(noError, -1, "gate condition one is a false is_error");
    assert.notEqual(
      successSubtype,
      -1,
      "gate condition two is a success subtype",
    );
    assert.notEqual(
      completed,
      -1,
      "gate condition three is a completed terminal reason",
    );
    assert.notEqual(exitZero, -1, "gate condition four is a zero exit code");
    assert.ok(
      noError < successSubtype &&
        successSubtype < completed &&
        completed < exitZero,
      "the four gate conditions appear in order",
    );
    assert.match(
      gate,
      /`is_error` true/,
      "an error envelope is the named failure case",
    );
    assert.match(
      gate,
      /reports stderr/,
      "a failed run's stderr is reported",
    );
    assert.match(
      gate,
      /treats the run as failed/,
      "an envelope that fails the gate fails the run",
    );
    const links = sectionLinks(gate);
    assert.ok(
      links.some((link) => link.endsWith("budget-and-chunking.md")),
      "the completed check points at the overflow symptoms in budget-and-chunking.md",
    );
    assert.doesNotMatch(
      gate,
      /Truncated edits/,
      "the gate references the overflow symptom list instead of restating it",
    );
  });

  it("records the pre-dispatch baseline and compares it after the run", async () => {
    const baseline = await dispatchSection("The baseline comparison");
    assert.match(
      baseline,
      /git rev-parse HEAD/,
      "the host records HEAD before dispatch",
    );
    assert.match(
      baseline,
      /git status --porcelain --untracked-files=all/,
      "the host records the full porcelain status list with every untracked file",
    );
    assert.match(
      baseline,
      /untracked files one by one/,
      "the status list names untracked files one by one",
    );
    assert.match(
      baseline,
      /content hash of every file the prompt names/,
      "the host hashes every file the prompt names",
    );
    assert.match(
      baseline,
      /expanded by the host to its files/,
      "a named directory is expanded by the host to its files",
    );
    assert.match(
      baseline,
      /counts as named/,
      "a file created under a named directory counts as named",
    );
    assert.match(
      baseline,
      /modified or untracked/,
      "the host hashes every file already modified or untracked",
    );
    assert.match(
      baseline,
      /hashed individually/,
      "each recorded file is hashed individually",
    );
    assert.match(
      baseline,
      /compares/,
      "after the run the host records the same three and compares",
    );
  });

  it("rejects a run when a file outside the named set changed or HEAD moved, and names what the comparison cannot see", async () => {
    const baseline = await dispatchSection("The baseline comparison");
    assert.match(
      baseline,
      /a new untracked file appears in the status list/,
      "a new untracked file is caught by the comparison",
    );
    assert.match(
      baseline,
      /a commit the run made moves HEAD/,
      "a commit the run made is caught by the comparison",
    );
    assert.match(
      baseline,
      /an edit to a file that was already dirty/,
      "an edit to an already-dirty file is caught by the comparison",
    );
    assert.match(
      baseline,
      /is rejected when a file outside the named set changed or HEAD moved/,
      "the run is rejected on an out-of-set change or a moved HEAD",
    );
    assert.match(
      baseline,
      /disjoint file sets/,
      "parallel runs are attributed by their disjoint file sets",
    );
    assert.match(
      baseline,
      /ignores the other runs' file sets/,
      "each run's comparison ignores the other runs' file sets",
    );
    assert.match(
      baseline,
      /gitignored files/,
      "the comparison cannot see gitignored files",
    );
    assert.match(
      baseline,
      /`\.env`/,
      "gitignored files are exemplified by `.env`",
    );
    assert.match(
      baseline,
      /ref changes that leave HEAD in place/,
      "the comparison cannot see ref changes that leave HEAD in place",
    );
    for (const refForm of [
      "git branch -f",
      "git tag",
      "git update-ref",
      "git --git-dir",
    ]) {
      assert.ok(
        baseline.includes(`\`${refForm}\``),
        `the blind-spot list names ${refForm}`,
      );
    }
    assert.match(
      baseline,
      /cleaned up or committed first/,
      "unaccounted host work is cleaned up or committed before dispatch",
    );
  });

  it("runs the test, build or lint check itself and reads the run's summary as a claim, not proof", async () => {
    const verification = await dispatchSection("The host's own verification");
    assert.match(
      verification,
      /test, build or lint check/,
      "the host runs a test, build or lint check",
    );
    assert.match(
      verification,
      /where the task has one/,
      "the check runs where the task has one",
    );
    assert.match(
      verification,
      /is a claim to check, not proof/,
      "the run's own summary is a claim to check, not proof",
    );
  });

  it("retries a failed run once with a narrower chunk and then does the task itself", async () => {
    const failures = await dispatchSection("When a run fails");
    assert.match(
      failures,
      /retried once/,
      "a failed run is retried once",
    );
    assert.match(
      failures,
      /narrower chunk/,
      "the retry takes a narrower chunk",
    );
    assert.match(
      failures,
      /the host does the task itself/,
      "after the failed retry the host does the task itself",
    );
    assert.match(
      failures,
      /does not loop/,
      "the host does not loop a failing delegation",
    );
  });

  it("stops at a gateway or authentication failure, reports stderr and does the task itself without a retry", async () => {
    const failures = await dispatchSection("When a run fails");
    assert.match(
      failures,
      /gateway or authentication failure/,
      "a gateway or authentication failure is the named case",
    );
    assert.match(
      failures,
      /stops delegation at once/,
      "the failure stops delegation at once",
    );
    assert.match(
      failures,
      /without a retry/,
      "the gateway stop takes no retry",
    );
    assert.match(
      failures,
      /reports stderr/,
      "the gateway failure's stderr is reported",
    );
    assert.ok(
      (failures.match(/does the task itself/g) ?? []).length >= 2,
      "both the failed retry and the gateway failure end with the host doing the task itself",
    );
  });

  it("points the Workflow's verify step at the result gate, the baseline and the failure policy", async () => {
    const markdown = await readFile(skillFile, "utf8");
    const workflow = flatMarkdownSection(markdown, "Workflow");
    assert.match(
      workflow,
      /\*\*Verify\*\* the outcome yourself/,
      "the Workflow keeps verification with the host",
    );
    assert.match(
      workflow,
      /result gate/,
      "the verify step names the result gate",
    );
    assert.match(
      workflow,
      /baseline comparison/,
      "the verify step names the baseline comparison",
    );
    assert.match(
      workflow,
      /failure policy/,
      "the verify step names the failure policy",
    );
  });
});

describe("tokenme-agent parallel runs contract", () => {
  it("runs two tasks that edit different directories in the background, each with its own result and error file", async () => {
    const parallel = await dispatchSection("Parallel runs");
    assert.match(
      parallel,
      /two tasks that edit different directories/,
      "the two-directory example is the worked case",
    );
    assert.match(
      parallel,
      /its own result file and its own error file/,
      "the prose states the per-run result and error files",
    );
    const launches = parallel.match(
      /2> \/tmp\/tokenme-runs\/<task-[a-z-]+>\.err &/g,
    );
    assert.ok(
      (launches ?? []).length >= 2,
      "each of the two runs is launched as a background shell job",
    );
    for (const taskId of ["<task-a-id>", "<task-b-id>"]) {
      assert.match(
        parallel,
        new RegExp(`> /tmp/tokenme-runs/${taskId}\\.json`),
        `${taskId}'s stdout goes to its own result file`,
      );
      assert.match(
        parallel,
        new RegExp(`2> /tmp/tokenme-runs/${taskId}\\.err &`),
        `${taskId}'s stderr goes to its own error file and the run ends in the background`,
      );
    }
    assert.match(
      parallel,
      /`wait` holds the host/,
      "the host waits for the background jobs before verifying them",
    );
  });

  it("runs delegations together only on disjoint file sets and splits or serialises an overlap", async () => {
    const parallel = await dispatchSection("Parallel runs");
    assert.match(
      parallel,
      /run at the same time only when their file sets are disjoint/,
      "the disjointness rule gates parallel runs",
    );
    assert.match(
      parallel,
      /one file named by two prompts/,
      "a file named by two prompts is the named overlap",
    );
    assert.match(
      parallel,
      /splits the shared file into one task's set alone, or serialises/,
      "an overlap is answered by a split or by serialising",
    );
    assert.match(
      parallel,
      /the second run launches only after the first has passed its gate and its comparison/,
      "a serialised overlap runs the runs one after the other",
    );
    const links = sectionLinks(parallel);
    assert.ok(
      links.some((link) => link.endsWith("budget-and-chunking.md")),
      "the split answer points at the chunking guide",
    );
  });

  it("verifies each run against its own file set and ignores the other runs' file sets", async () => {
    const parallel = await dispatchSection("Parallel runs");
    assert.match(
      parallel,
      /each run is judged on its own/,
      "after the wait each run is judged on its own",
    );
    assert.match(
      parallel,
      /from its own result and error file/,
      "the gate reads each run's envelope and exit code from its own files",
    );
    assert.match(
      parallel,
      /ignores the other run's file set/,
      "a run's comparison ignores the other runs' file sets",
    );
    assert.match(
      parallel,
      /a change outside every run's set still rejects/,
      "a change outside every run's set still rejects",
    );

    const baseline = await dispatchSection("The baseline comparison");
    assert.match(
      baseline,
      /disjoint file sets/,
      "the baseline comparison attributes parallel runs by their disjoint file sets",
    );
    assert.match(
      baseline,
      /ignores the other runs' file sets/,
      "the baseline comparison keeps each run's check to its own set",
    );
  });

  it("carries the parallel rule in the Workflow's delegation step", async () => {
    const markdown = await readFile(skillFile, "utf8");
    const workflow = flatMarkdownSection(markdown, "Workflow");
    assert.match(
      workflow,
      /run in parallel/,
      "the Workflow names running independent delegations in parallel",
    );
    assert.match(
      workflow,
      /file sets are disjoint/,
      "the Workflow's parallel rule requires disjoint file sets",
    );
    assert.match(
      workflow,
      /one result and error file per run/,
      "the Workflow names the per-run logs",
    );
    assert.match(
      workflow,
      /each run verified against its own file set/,
      "the Workflow names the per-run verification",
    );
    assert.match(
      workflow,
      /run one after the other/,
      "the Workflow sends overlapping sets one after the other",
    );
  });
});

describe("tokenme-agent prompt scaffold contract", () => {
  const scaffoldFile = path.resolve(
    canonicalDir,
    "references/prompt-scaffold.md",
  );

  async function scaffoldSection(title) {
    const scaffold = await readFile(scaffoldFile, "utf8");
    return flatMarkdownSection(scaffold, title);
  }

  it("ships the prompt scaffold and resolves the skill's link to it from the Workflow", async () => {
    await fileExists(scaffoldFile);
    const markdown = await readFile(skillFile, "utf8");
    const workflow = markdownSection(markdown, "Workflow");
    assert.ok(workflow, "the Workflow section exists");
    const links = sectionLinks(workflow);
    const scaffoldLink = links.find((link) =>
      link.endsWith("references/prompt-scaffold.md"),
    );
    assert.ok(
      scaffoldLink,
      "the Workflow section links to references/prompt-scaffold.md",
    );
    await fileExists(path.resolve(canonicalDir, scaffoldLink));
  });

  it("requires absolute paths, named inputs and outputs, checkable acceptance criteria, and no references to earlier turns in every prompt", async () => {
    const carries = await scaffoldSection("What every prompt carries");
    assert.match(
      carries,
      /one shot with no conversation context/,
      "the requirements are grounded in the run having no conversation context",
    );
    assert.match(
      carries,
      /carries everything the run needs/,
      "the prompt is self-contained",
    );
    assert.match(
      carries,
      /\*\*Absolute paths\*\*/,
      "absolute paths are a named requirement",
    );
    assert.match(
      carries,
      /every path the prompt mentions is absolute/,
      "each path the prompt mentions is absolute",
    );
    assert.match(
      carries,
      /\*\*Named inputs and outputs\*\*/,
      "named inputs and outputs are a named requirement",
    );
    assert.match(
      carries,
      /\*\*Checkable acceptance criteria\*\*/,
      "checkable acceptance criteria are a named requirement",
    );
    assert.match(
      carries,
      /the host can check it after the run/,
      "each criterion is something the host checks after the run",
    );
    assert.match(
      carries,
      /\*\*No references to earlier turns\*\*/,
      "the no-earlier-turns rule is a named requirement",
    );
    assert.match(
      carries,
      /repeats whatever the run needs in full/,
      "the prompt repeats what the run needs instead of pointing at this chat",
    );
  });

  it("writes each convention the task needs into the prompt text because a bare run reads no project instructions", async () => {
    const conventions = await scaffoldSection(
      "Conventions travel in the prompt",
    );
    assert.match(
      conventions,
      /reads no project instructions/,
      "a bare run reads no project instructions",
    );
    assert.match(
      conventions,
      /no CLAUDE\.md, no hooks, no skills/,
      "the project instructions a bare run misses are named",
    );
    assert.match(
      conventions,
      /naming convention/,
      "a task that must follow a naming convention is the named case",
    );
    assert.match(
      conventions,
      /writes each convention out in full/,
      "the host writes each convention into the prompt text",
    );
    assert.match(
      conventions,
      /name every new test file `<module>\.test\.mjs`/,
      "the example writes the naming convention itself into the prompt text",
    );
    assert.match(
      conventions,
      /not "follow the project's naming rules"/,
      "the convention appears in the prompt text instead of a pointer to the project rule",
    );
  });

  it("carries a template for a read-only task and one for an edit task", async () => {
    const scaffold = await readFile(scaffoldFile, "utf8");
    const readOnly = markdownSection(scaffold, "Template: read-only task");
    assert.ok(readOnly, "the read-only template exists");
    assert.match(
      readOnly,
      /read-only tool scoping/,
      "the read-only template pairs with the read-only tool scoping",
    );
    assert.match(
      readOnly,
      /# Objective/,
      "the read-only template opens with an objective field",
    );
    assert.match(
      readOnly,
      /# Acceptance criteria/,
      "the read-only template carries acceptance criteria",
    );
    assert.match(
      readOnly,
      /unchanged/,
      "the read-only criteria keep the named inputs unchanged",
    );

    const edit = markdownSection(scaffold, "Template: edit task");
    assert.ok(edit, "the edit template exists");
    assert.match(
      edit,
      /edit-and-verify tool scoping/,
      "the edit template pairs with the edit-and-verify tool scoping",
    );
    assert.match(
      edit,
      /# Objective/,
      "the edit template opens with an objective field",
    );
    assert.match(
      edit,
      /# Conventions/,
      "the edit template carries a conventions field for the host to fill",
    );
    assert.match(
      edit,
      /# Acceptance criteria/,
      "the edit template carries acceptance criteria",
    );
  });

  it("carries the history and no-nested-run rules in the prompt's own words", async () => {
    const rules = await scaffoldSection("Rules the prompt carries");
    assert.match(
      rules,
      /deny list/,
      "the prompt-side rules mirror the dispatch contract's mechanical deny list",
    );
    assert.match(rules, /`git commit`/, "the prompt forbids git commit");
    assert.match(rules, /`git push`/, "the prompt forbids git push");
    assert.match(rules, /`git reset`/, "the prompt forbids git reset");
    assert.match(
      rules,
      /forbidden/,
      "the history-changing commands are stated as forbidden",
    );
    assert.match(
      rules,
      /Do the work yourself: start no other `claude` or `claude-tokenme` run/,
      "the run does the work itself without starting another delegate run",
    );
    const scaffold = await readFile(scaffoldFile, "utf8");
    const rulesSection = markdownSection(scaffold, "Rules the prompt carries");
    const links = sectionLinks(rulesSection);
    assert.ok(
      links.some((link) => link.endsWith("dispatch-contract.md")),
      "the rules section links to the deny list in dispatch-contract.md",
    );
  });
});

describe("tokenme-agent repo wiring contract", () => {
  const skillPageFile = path.resolve("docs/skills/agents/tokenme-agent.md");
  const guideFile = path.resolve("docs/guides/tokenme-agent.md");
  const indexFile = path.resolve("docs/skills/README.md");
  const glossaryFile = path.resolve("docs/glossary.md");
  const adr24File = path.resolve(
    "docs/decisions/0024-tokenme-agent-model-invocable-with-guards.md",
  );
  const adr25File = path.resolve(
    "docs/decisions/0025-tokenme-agent-bare-by-default-and-90k-budget.md",
  );

  // The glossary table row whose Term cell is `term`, backticks aside.
  function tableRow(markdown, term) {
    return (
      markdown
        .split("\n")
        .find(
          (line) =>
            line.startsWith("|") &&
            line.split("|")[1].trim().replace(/`/g, "") === term,
        ) ?? null
    );
  }

  it("ships the sibling layout parts: references, evals and the agent config", async () => {
    for (const part of [
      "SKILL.md",
      "references/delegation-policy.md",
      "references/budget-and-chunking.md",
      "references/dispatch-contract.md",
      "references/prompt-scaffold.md",
      "evals/evals.json",
      "evals/trigger-evals.json",
      "agents/openai.yaml",
    ]) {
      await fileExists(path.resolve(canonicalDir, part));
    }
  });

  it("lists tokenme-agent in the generated skill index linking to its skill page", async () => {
    const index = await readFile(indexFile, "utf8");
    const row = tableRow(index, "tokenme-agent");
    assert.ok(row, "the generated index has a tokenme-agent row");
    assert.match(
      row,
      /\[คู่มือ \/ Guide\]\(agents\/tokenme-agent\.md\)/,
      "the tokenme-agent row links to its bilingual skill page",
    );
  });

  it("publishes a bilingual skill page with an install line in both languages", async () => {
    await fileExists(skillPageFile);
    const page = await readFile(skillPageFile, "utf8");
    const thai = markdownSection(page, "ภาษาไทย / Thai");
    assert.ok(thai, "the skill page has a Thai section");
    const english = markdownSection(page, "English / ภาษาอังกฤษ");
    assert.ok(english, "the skill page has an English section");
    for (const section of [thai, english]) {
      assert.match(
        section,
        /npx skills add ArrayaWongsaita\/skills --skill tokenme-agent/,
        "the section carries the install line",
      );
    }
    assert.match(
      markdownHeaderBlock(page),
      /skills\/agents\/tokenme-agent\/SKILL\.md/,
      "the page header links to the skill's SKILL.md",
    );
  });

  it("tells the maintainer the repository validation gate is separate from the node test suite and is run before merging", async () => {
    const page = await readFile(skillPageFile, "utf8");
    const thai = flatMarkdownSection(page, "สำหรับผู้ดูแล (Maintainer notes)");
    assert.match(
      thai,
      /`npm run validate`/,
      "the Thai maintainer notes name npm run validate",
    );
    assert.match(
      thai,
      /แยกจาก node test suite/,
      "the Thai maintainer notes separate the gate from the node test suite",
    );
    assert.match(
      thai,
      /ก่อน merge/,
      "the Thai maintainer notes run the gate before merging",
    );

    const english = flatMarkdownSection(page, "For maintainers");
    assert.match(
      english,
      /`npm run validate`/,
      "the English maintainer notes name npm run validate",
    );
    assert.match(
      english,
      /separate from the node test suite/,
      "the English maintainer notes separate the gate from the node test suite",
    );
    assert.match(
      english,
      /run before merging/,
      "the English maintainer notes run the gate before merging",
    );
  });

  it("publishes the Thai long-form guide with the install line", async () => {
    await fileExists(guideFile);
    const guide = await readFile(guideFile, "utf8");
    assert.match(
      markdownHeaderBlock(guide),
      /skills\/agents\/tokenme-agent\/SKILL\.md/,
      "the guide header links to the skill's SKILL.md",
    );
    const install = flatMarkdownSection(
      guide,
      "2. การพึ่งพา Skill อื่น (Dependencies) และการติดตั้ง",
    );
    assert.match(
      install,
      /npx skills add ArrayaWongsaita\/skills --skill tokenme-agent/,
      "the guide's installation section carries the install line",
    );
    const topSections = markdownHeadings(guide).filter(
      (heading) => heading.level === 2,
    );
    assert.ok(
      topSections.length >= 5,
      "the guide is long-form, with at least five numbered sections",
    );
  });

  it("records ADR 0024: the skill is model-invocable, guarded by rules in the skill", async () => {
    await fileExists(adr24File);
    const adr = await readFile(adr24File, "utf8");
    assert.match(
      markdownHeaderBlock(adr),
      /^# ADR 0024: /m,
      "the file's title names ADR 0024",
    );
    assert.match(
      markdownHeaderBlock(adr),
      /^- Status \/ สถานะ: Accepted \/ ยอมรับแล้ว$/m,
      "the status header marks the decision accepted",
    );
    for (const section of [
      "Context / บริบท",
      "Decision / การตัดสินใจ",
      "Rejected alternatives / ทางเลือกที่ปฏิเสธ",
      "Consequences / ผลที่ตามมา",
    ]) {
      assert.ok(
        markdownSection(adr, section),
        `ADR 0024 has a ${section} section`,
      );
    }

    const context = flatMarkdownSection(adr, "Context / บริบท");
    assert.match(
      context,
      /`agy-agent`/,
      "the context names agy-agent among the explicit-only siblings",
    );
    assert.match(
      context,
      new RegExp(`\`${["opencode", "implement"].join("-")}\``),
      "the context names the retired opencode implementer among the explicit-only siblings",
    );
    assert.match(
      context,
      /`disable-model-invocation: true`/,
      "the context states the siblings' explicit-only frontmatter",
    );
    assert.match(
      context,
      /`implement-tickets`/,
      "the context names the orchestrator the skill stays decoupled from",
    );

    const decision = flatMarkdownSection(adr, "Decision / การตัดสินใจ");
    assert.match(
      decision,
      /ships model-invocable/,
      "the decision ships the skill model-invocable",
    );
    assert.match(
      decision,
      /no `disable-model-invocation`/,
      "the decision carries no disable-model-invocation frontmatter",
    );
    assert.match(
      decision,
      /allow_implicit_invocation: true/,
      "the decision allows implicit invocation in the agent config",
    );
    assert.match(
      decision,
      /keep-local rules/,
      "the decision's guards include the keep-local rules",
    );
    assert.match(
      decision,
      /eligibility checklist/,
      "the decision's guards include the eligibility checklist",
    );
    assert.match(
      decision,
      /host verification/,
      "the decision's guards include host verification",
    );
    assert.match(
      decision,
      /no-recursion rule/,
      "the decision's guards include the no-recursion rule",
    );

    const rejected = flatMarkdownSection(
      adr,
      "Rejected alternatives / ทางเลือกที่ปฏิเสธ",
    );
    assert.match(
      rejected,
      /Explicit-only invocation like the siblings/,
      "the rejected alternative is the siblings' explicit-only invocation",
    );

    const consequences = flatMarkdownSection(adr, "Consequences / ผลที่ตามมา");
    assert.match(
      consequences,
      /without a per-call request/,
      "the consequences name the gateway exposure the guards answer",
    );
  });

  it("records ADR 0025: bare by default and planned against the 90k ceiling with the measured numbers", async () => {
    await fileExists(adr25File);
    const adr = await readFile(adr25File, "utf8");
    assert.match(
      markdownHeaderBlock(adr),
      /^# ADR 0025: /m,
      "the file's title names ADR 0025",
    );
    assert.match(
      markdownHeaderBlock(adr),
      /^- Status \/ สถานะ: Accepted \/ ยอมรับแล้ว$/m,
      "the status header marks the decision accepted",
    );
    for (const section of [
      "Context / บริบท",
      "Decision / การตัดสินใจ",
      "Rejected alternatives / ทางเลือกที่ปฏิเสธ",
      "Consequences / ผลที่ตามมา",
    ]) {
      assert.ok(
        markdownSection(adr, section),
        `ADR 0025 has a ${section} section`,
      );
    }

    const context = flatMarkdownSection(adr, "Context / บริบท");
    assert.match(
      context,
      /2026-10-02/,
      "the context dates the measurement",
    );
    assert.match(
      context,
      /28,237/,
      "the context records the measured overhead of a run that is not bare",
    );
    assert.match(
      context,
      /1,142/,
      "the context records the measured overhead of a bare run",
    );
    assert.match(
      context,
      /90,000/,
      "the context records the 90k compaction setting",
    );
    assert.match(
      context,
      /128,000/,
      "the context records the 128k context cap",
    );
    assert.match(
      context,
      /no host in the loop/,
      "the context names why compaction cannot be relied on",
    );

    const decision = flatMarkdownSection(adr, "Decision / การตัดสินใจ");
    assert.match(
      decision,
      /bare by default/,
      "the decision makes bare the default",
    );
    assert.match(
      decision,
      /60k-token planning budget/,
      "the decision sets the 60k planning budget",
    );
    assert.match(
      decision,
      /90k as the ceiling/,
      "the decision sets the 90k ceiling",
    );
    assert.match(
      decision,
      /file bytes ÷ 4 × 1\.5/,
      "the decision names the footprint formula",
    );
    assert.match(
      decision,
      /about 1k bare, about 28k not bare/,
      "the decision carries both overhead figures",
    );
    assert.match(
      decision,
      /per-file or per-directory chunks/,
      "the decision splits oversized work into per-file or per-directory chunks",
    );

    const rejected = flatMarkdownSection(
      adr,
      "Rejected alternatives / ทางเลือกที่ปฏิเสธ",
    );
    assert.match(
      rejected,
      /Planning against the 128k window/,
      "planning against the 128k window is rejected",
    );
    assert.match(
      rejected,
      /Relying on compaction/,
      "relying on compaction is rejected",
    );
    assert.match(
      rejected,
      /Non-bare by default/,
      "non-bare by default is rejected",
    );

    const consequences = flatMarkdownSection(adr, "Consequences / ผลที่ตามมา");
    assert.match(
      consequences,
      /about 1k tokens of overhead instead of about 28k/,
      "the consequences carry the measured saving",
    );
  });

  it("defines the eight tokenme terms in bilingual glossary rows", async () => {
    await fileExists(glossaryFile);
    const glossary = await readFile(glossaryFile, "utf8");
    const meanings = {
      "delegate run": /headless `claude-tokenme -p`[\s\S]*self-contained task/,
      "claude-tokenme": /`claude --settings [\s\S]*settings file/,
      footprint: /÷ 4[\s\S]*× 1\.5[\s\S]*fixed overhead/,
      "planning budget": /60k tokens[\s\S]*128k window is not the planning number/,
      ceiling: /90k[\s\S]*compacts[\s\S]*trustworthy/,
      "bare run": /`--bare`[\s\S]*about 1k[\s\S]*about 28k[\s\S]*travels in the prompt/,
      envelope: /`is_error`[\s\S]*`terminal_reason`/,
      host: /authority on correctness[\s\S]*verifies every delegate run/,
    };
    for (const [term, meaning] of Object.entries(meanings)) {
      const row = tableRow(glossary, term);
      assert.ok(row, `the glossary has a row for ${term}`);
      assert.equal(
        row.split("|").length,
        5,
        `the ${term} row has the Term, Thai, and Definition cells`,
      );
      assert.match(
        row.split("|")[2],
        /[\u0E00-\u0E7F]/,
        `the ${term} row has a Thai cell`,
      );
      const definition = row.split("|")[3];
      assert.ok(
        definition.includes(" / "),
        `the ${term} definition has an English half and a Thai half`,
      );
      assert.match(
        definition,
        meaning,
        `the ${term} definition describes its tokenme meaning`,
      );
    }
  });
});
