import { spawnSync } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillRoot = path.join(repoRoot, "skills/agents/implement-tickets");
const wavesScript = path.join(skillRoot, "scripts/waves.mjs");
const preflightScript = path.join(skillRoot, "scripts/preflight.mjs");
const adapterFixtureRoot = path.join(repoRoot, "tests/fixtures/implement-tickets/adapters");
const envelopeFixtureRoot = path.join(repoRoot, "tests/fixtures/implement-tickets/envelopes");
const fixtureLock = path.join(repoRoot, "tests/fixtures/implement-tickets/locks/skills-lock.json");

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function readTextOrNull(file) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

function ticket(number, { blockers = [], context = "", seam = "the core contract test", title = `Ticket ${number}` } = {}) {
  return [
    `# ${number}: ${title}`,
    "",
    "**What to build:** Fixture behavior.",
    `**Blocked by:** ${blockers.length ? blockers.join(", ") : "None (can start immediately)"}`,
    "**Stories:** 1",
    `**Seam:** ${seam}`,
    `**Context:** ${context}`,
    "**Budget:** read ~1k tokens · 1 criteria · 1 modules",
    "**Status:** ready-for-agent",
    "",
    "- [ ] Fixture criterion.",
    "",
  ].join("\n");
}

async function fixture(tickets) {
  const root = await mkdtemp(path.join(tmpdir(), "implement-tickets-contract-"));
  const issues = path.join(root, "issues");
  await mkdir(issues, { recursive: true });
  for (const [number, contents] of Object.entries(tickets)) {
    await writeFile(path.join(issues, `${number}-fixture.md`), contents, "utf8");
  }
  return { root, issues };
}

async function runWaves(dir, options = []) {
  assert.equal(await exists(wavesScript), true, "wave planning behavior is missing: scripts/waves.mjs does not exist");
  const result = spawnSync(process.execPath, [wavesScript, dir, ...options], { encoding: "utf8" });
  assert.equal(result.status, 0, `wave script exits successfully: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

async function invokePreflight(options = []) {
  assert.equal(await exists(preflightScript), true, "adapter preflight behavior is missing: scripts/preflight.mjs does not exist");
  return spawnSync(process.execPath, [preflightScript, ...options], { encoding: "utf8" });
}

function preflightOutput(result) {
  assert.ok(result.stdout.trim(), `preflight prints its result: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

async function addAdapter(root, name) {
  const adapterDirectory = path.join(root, `implement-tickets-${name}`);
  await mkdir(adapterDirectory, { recursive: true });
  await writeFile(
    path.join(adapterDirectory, "SKILL.md"),
    `---\nname: implement-tickets-${name}\ndescription: Fixture adapter for contract tests.\n---\n`,
    "utf8",
  );
  return adapterDirectory;
}

async function writeLock(file, source) {
  await mkdir(path.dirname(file), { recursive: true });
  const skills = source ? { "implement-tickets": { source } } : {};
  await writeFile(file, `${JSON.stringify({ version: 1, skills }, null, 2)}\n`, "utf8");
}

function wavesAsNumbers(output) {
  return output.waves.map((wave) => wave.map(String));
}

describe("implement-tickets wave planner contract", () => {
  it("puts independent tickets behind the same blocker in one wave when their touch sets differ", async () => {
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(new) src/right.mjs" }),
      "02": ticket("02", { blockers: ["01"], context: "(edit) src/left.mjs" }),
      "03": ticket("03", { blockers: ["01"], context: "(edit from 01) src/right.mjs · docs/reference.md" }),
    });
    try {
      const output = await runWaves(issues);
      assert.deepEqual(wavesAsNumbers(output), [["01"], ["02", "03"]]);
      assert.deepEqual(output.tickets.find((item) => item.number === "02").touchSet, ["src/left.mjs"]);
      assert.deepEqual(output.tickets.find((item) => item.number === "03").touchSet, ["src/right.mjs"]);
      assert.deepEqual(output.tickets.find((item) => item.number === "03").blockers, ["01"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("places same-path tickets in successive waves in ticket order", async () => {
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(new) src/base.mjs" }),
      "02": ticket("02", { blockers: ["01"], context: "(edit) src/shared.mjs" }),
      "03": ticket("03", { blockers: ["01"], context: "(edit) src/shared.mjs" }),
      "05": ticket("05", { blockers: ["01"], context: "(edit) src/shared.mjs" }),
    });
    try {
      const output = await runWaves(issues);
      assert.deepEqual(wavesAsNumbers(output), [["01"], ["02"], ["03"], ["05"]]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("gives unknown touch sets their own wave, prevents later tickets joining, and reports a warning", async () => {
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(edit) src/shared.mjs" }),
      "02": ticket("02", { context: "docs/readme.md" }),
      "03": ticket("03", { context: "(edit) src/shared.mjs" }),
    });
    try {
      const output = await runWaves(issues);
      assert.deepEqual(wavesAsNumbers(output), [["01"], ["02"], ["03"]]);
      const unknown = output.tickets.find((item) => item.number === "02");
      assert.equal(unknown.touchSet, null);
      assert.match(unknown.warnings.join(" "), /unknown touch set/i);
      assert.ok(output.warnings.some((warning) => /02/.test(warning)));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps wave placement stable when concurrency changes and isolates every ticket in serial mode", async () => {
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(new) src/base.mjs" }),
      "02": ticket("02", { blockers: ["01"], context: "(edit) src/left.mjs" }),
      "03": ticket("03", { blockers: ["01"], context: "(edit) src/right.mjs" }),
    });
    try {
      const two = await runWaves(issues, ["--concurrency", "2"]);
      const nine = await runWaves(issues, ["--concurrency", "9"]);
      const serial = await runWaves(issues, ["--serial", "--concurrency", "9"]);
      assert.deepEqual(nine.waves, two.waves);
      assert.equal(two.concurrency, 2);
      assert.equal(nine.concurrency, 9);
      assert.deepEqual(wavesAsNumbers(serial), [["01"], ["02"], ["03"]]);
      assert.equal(serial.concurrency, 9);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reads the parallel-validation marker and reports whether parallel work is validated", async () => {
    const { root, issues } = await fixture({ "01": ticket("01", { context: "(edit) src/one.mjs" }) });
    const marker = path.join(root, "parallel-validation.md");
    try {
      await writeFile(marker, "# Parallel validation\n\nstatus: not validated\n", "utf8");
      const pending = await runWaves(issues, ["--marker", marker]);
      assert.equal(pending.parallelValidated, false);
      assert.equal(pending.parallelValidationStatus, "not validated");

      await writeFile(marker, "# Parallel validation\n\nstatus: validated 2026-09-30\n", "utf8");
      const validated = await runWaves(issues, ["--marker", marker]);
      assert.equal(validated.parallelValidated, true);
      assert.equal(validated.parallelValidationStatus, "validated 2026-09-30");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("applies directory containment in a fixture unreachable from checker-valid ticket sets", async () => {
    // The ticket checker rejects directory Context paths, so this defensive
    // ancestor/descendant case cannot come from a checker-valid ticket set.
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(new) src/base.mjs" }),
      "02": ticket("02", { blockers: ["01"], context: "(edit) src" }),
      "03": ticket("03", { blockers: ["01"], context: "(edit) src/module.mjs" }),
    });
    try {
      const output = await runWaves(issues);
      assert.deepEqual(wavesAsNumbers(output), [["01"], ["02"], ["03"]]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("implement-tickets skill and documentation contract", () => {
  it("declares explicit-only invocation for Claude Code and Codex", async () => {
    const skill = await readTextOrNull(path.join(skillRoot, "SKILL.md"));
    const agent = await readTextOrNull(path.join(skillRoot, "agents/openai.yaml"));
    assert.ok(skill, "the implement-tickets skill exists");
    assert.match(skill, /^name: implement-tickets$/m);
    assert.match(skill, /^disable-model-invocation: true$/m);
    assert.ok(agent, "the Codex agent metadata exists");
    assert.match(agent, /^\s*allow_implicit_invocation:\s*false\s*$/m);
  });

  it("specifies every Plan field and pauses before changes outside the feature directory", async () => {
    const planning = await readTextOrNull(path.join(skillRoot, "references/planning.md"));
    assert.ok(planning, "the planning procedure exists");
    assert.match(
      planning,
      /\| Ticket \| Wave \| Blockers \| Touch set \| Seam \| Matched agent \| Retry budget \|/,
      "the Plan has a row for every ticket with all required columns",
    );
    assert.match(planning, /backend/i);
    assert.match(planning, /concurrency cap/i);
    assert.match(planning, /warnings/i);
    assert.match(planning, /parallel not yet validated/);
    assert.match(planning, /pause for explicit approval/i);
    assert.match(planning, /no file outside the\s+feature directory changes until approval/i);
  });

  it("documents the skill and bilingual Seam and Context paragraphs in both user-facing pages", async () => {
    for (const file of ["docs/guides/implement-tickets.md", "docs/skills/agents/implement-tickets.md"]) {
      const doc = await readTextOrNull(path.join(repoRoot, file));
      assert.ok(doc, `${file} exists`);
      assert.match(doc, /^#{2,3} Seam และ Context$/m);
      assert.match(doc, /\*\*Seam:\*\*[\s\S]*?\*\*Context:\*\*/);
      assert.match(doc, /^#{2,3} Seam and Context$/m);
      assert.match(doc, /\*\*Seam:\*\*[\s\S]*?verbatim[\s\S]*?\*\*Context:\*\*[\s\S]*?read list/i);
      assert.match(doc, /รายการอ่าน/);
      assert.match(doc, /`implement-tickets`/);
    }
  });

  it("keeps explicit-invocation frontmatter and the reference list aligned across the skill, guide, page, and directory", async () => {
    const skill = await readTextOrNull(path.join(skillRoot, "SKILL.md"));
    const guide = await readTextOrNull(path.join(repoRoot, "docs/guides/implement-tickets.md"));
    const page = await readTextOrNull(path.join(repoRoot, "docs/skills/agents/implement-tickets.md"));
    assert.ok(skill && guide && page, "the skill and both user-facing pages exist");

    const header = skill.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(header, "the skill begins with frontmatter");
    assert.match(header[1], /^name: implement-tickets$/m);
    assert.match(header[1], /^disable-model-invocation: true$/m);

    const directoryReferences = (await readdir(path.join(skillRoot, "references")))
      .filter((file) => file.endsWith(".md"))
      .sort();
    const linkedReferences = (content) => [...new Set(
      [...content.matchAll(/references\/([^/\s)`]+\.md)/g)].map((match) => match[1]),
    )].sort();

    for (const [label, content] of [["SKILL.md", skill], ["guide", guide], ["skill page", page]]) {
      assert.deepEqual(
        linkedReferences(content),
        directoryReferences,
        `${label} lists exactly the reference Markdown files in the skill directory`,
      );
    }
  });

  it("puts the parallel-validation marker in the skill reference", async () => {
    const marker = await readTextOrNull(path.join(skillRoot, "references/parallel-validation.md"));
    assert.ok(marker, "the parallel-validation reference exists");
    assert.match(marker, /^status: not validated$/m);
  });
});

describe("implement-tickets worker dispatch and verification contract", () => {
  const dispatchPath = path.join(skillRoot, "references/dispatch-contract.md");
  const promptPath = path.join(skillRoot, "references/prompt-scaffold.md");
  const verificationPath = path.join(skillRoot, "references/verification.md");

  function requireText(text, expression, behavior) {
    assert.ok(expression.test(text), behavior);
  }

  it("starts every worker prompt with a checkout and integration SHA assertion", async () => {
    const prompt = await readTextOrNull(promptPath);
    assert.ok(prompt, "the worker prompt scaffold exists");
    const firstShellBlock = prompt.match(/```bash\s*([\s\S]*?)```/i);
    assert.ok(firstShellBlock, "the prompt includes its sync command block");
    const firstCommand = firstShellBlock[1].trimStart().split(/\r?\n/, 1)[0];
    assert.match(firstCommand, /^git checkout -B /, "checkout is the worker's first shell command");
    const checkout = prompt.match(/git checkout -B\s+"?<worker-branch>"?\s+"?<integration-sha>"?/);
    const checkoutIndex = checkout?.index ?? -1;
    assert.notEqual(checkoutIndex, -1, "the first worker command checks out the worker branch at the integration SHA");
    requireText(prompt, /test\s+"\$\(git rev-parse HEAD\)"\s*=\s*"<integration-sha>"/, "the sync command asserts the integration SHA");
    requireText(prompt, /mismatch[\s\S]*return `failed_infra`/i, "a sync mismatch is returned as failed_infra");
    const taskBodyIndex = prompt.indexOf("<the ticket's \"What to build\" paragraph");
    assert.ok(taskBodyIndex > checkoutIndex, "the sync step precedes ticket instructions");
    requireText(prompt, /every worker prompt[\s\S]*including ticket 1/i, "the first ticket also receives the sync step");
  });

  it("caps workers and verifiers together and gives pending verifiers priority", async () => {
    const dispatch = await readTextOrNull(dispatchPath);
    assert.ok(dispatch, "the dispatch contract exists");
    requireText(dispatch, /default(?:s)? (?:in-flight )?cap (?:is|of) 4/i, "the shared cap defaults to four");
    requireText(dispatch, /--concurrency N/, "the cap has a concurrency override");
    requireText(dispatch, /workers and verifiers together|workers plus verifiers/i, "workers and verifiers use the same cap");
    requireText(dispatch, /verifiers?\s+(?:are\s+)?(?:started|dispatched|take)\s+before\s+(?:starting\s+|dispatching\s+)?new workers/i, "verifiers have priority over new workers");
  });

  it("pipelines a fresh native verifier and keeps its report to raw evidence", async () => {
    const verification = await readTextOrNull(verificationPath);
    assert.ok(verification, "the verification contract exists");
    requireText(verification, /as soon as (?:a )?worker\s+returns[\s\S]*?without waiting for the rest of the wave/i, "verification starts as each worker returns");
    requireText(verification, /fresh (?:native )?subagent[\s\S]*never\s+the orchestrator/i, "the verifier is a separate native subagent");
    requireText(verification, /subagent_type:\s*Explore/, "the first verifier is Explore");
    requireText(verification, /too shallow to judge[\s\S]*general-purpose/i, "shallow evidence triggers a general-purpose verifier");
    requireText(verification, /read-only/, "the fallback verifier is read-only");
    requireText(verification, /raw evidence[\s\S]*no verdict/i, "the verifier returns evidence without a verdict");
  });

  it("runs each worker and verifier in the background with its own soft-timeout wait", async () => {
    const dispatch = await readTextOrNull(dispatchPath);
    const verification = await readTextOrNull(verificationPath);
    assert.ok(dispatch, "the dispatch contract exists");
    assert.ok(verification, "the verification contract exists");
    const combined = `${dispatch}\n${verification}`;
    requireText(combined, /workers and verifiers[\s\S]*?background/i, "workers and verifiers run in the background");
    requireText(combined, /one background wait per dispatch/i, "each child dispatch arms one background wait");
    requireText(combined, /worker[^\n]*2700 seconds/i, "workers have a 2700-second timeout");
    requireText(combined, /verifier[^\n]*900 seconds/i, "verifiers have a 900-second timeout");
    requireText(combined, /wait (?:ends|completes) first[\s\S]*TaskStop/i, "an early wait stops its subagent");
    requireText(combined, /timeout[\s\S]*failed_infra[\s\S]*does not count (?:as|against) (?:a\s+ticket\s+)?attempt/i, "timeouts are infra failures outside the attempt count");
  });

  it("routes crashes, lost subagents, and harness-cap rejections through infra retries", async () => {
    const dispatch = await readTextOrNull(dispatchPath);
    assert.ok(dispatch, "the dispatch contract exists");
    requireText(dispatch, /crash(?:es|ed)? or lost subagents?[\s\S]*failed_infra/i, "crashed or lost subagents are infra failures");
    requireText(dispatch, /Concurrent subagent limit reached/, "harness capacity rejections are recognized");
    requireText(dispatch, /wait for a free slot[\s\S]*retry/i, "capacity rejections wait and retry");
    requireText(dispatch, /do(?:es)? not count against (?:the )?two infra retries/i, "capacity waits do not use an infra retry");
    requireText(dispatch, /after two infra retries[\s\S]*BLOCKED \(TICKET_PROVIDER_FAILED\)/i, "two infra retries end in the provider-failed status");
  });

  it("describes dispatch, sync, the shared cap, verification, and timeouts on both user-facing pages", async () => {
    for (const file of ["docs/guides/implement-tickets.md", "docs/skills/agents/implement-tickets.md"]) {
      const doc = await readTextOrNull(path.join(repoRoot, file));
      assert.ok(doc, `${file} exists`);
      const requirements = [
        ["worker dispatch", /dispatch(?:es|ing)? (?:one )?(?:background )?worker/i],
        ["worker sync step", /sync step|integration sha/i],
        ["shared worker and verifier cap", /concurrency cap[\s\S]*workers and verifiers/i],
        ["fresh verifier", /fresh (?:native )?verifier/i],
        ["worker and verifier timeouts", /2700 seconds[\s\S]*900 seconds|45 minutes[\s\S]*15 minutes/i],
      ];
      for (const [name, expression] of requirements) {
        assert.ok(expression.test(doc), `${file} describes ${name}`);
      }
    }
  });
});

describe("implement-tickets adapter and preflight contract", () => {
  it("searches project and user adapter roots in order and preserves a raw model value", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "implement-tickets-adapter-roots-"));
    const roots = [
      path.join(root, "project-agent-skills"),
      path.join(root, "project-claude-skills"),
      path.join(root, "user-agent-skills"),
      path.join(root, "user-claude-skills"),
    ];
    const model = "provider/model --raw-option='keep this value'";
    try {
      const adapterPaths = [];
      for (const adapterRoot of roots) {
        await mkdir(adapterRoot, { recursive: true });
        adapterPaths.push(await addAdapter(adapterRoot, "fixture"));
      }
      for (let priority = 0; priority < roots.length; priority += 1) {
        for (let previous = 0; previous < priority; previous += 1) {
          await rm(adapterPaths[previous], { recursive: true, force: true });
        }
        const result = await invokePreflight([
          "--with", "fixture",
          "--model", model,
          "--roots", ...roots,
        ]);
        assert.equal(result.status, 0, result.stderr);
        const output = preflightOutput(result);
        assert.equal(output.backend, "fixture");
        assert.equal(output.adapterPath, adapterPaths[priority]);
        assert.equal(output.model, model);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses the project lock source first and the user lock source as fallback", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "implement-tickets-lock-order-"));
    const roots = [path.join(root, "no-project-adapter"), path.join(root, "no-user-adapter")];
    const projectLock = path.join(root, "project", "skills-lock.json");
    const userLock = path.join(root, "user", ".skill-lock.json");
    try {
      for (const adapterRoot of roots) await mkdir(adapterRoot, { recursive: true });
      await writeLock(projectLock, "project/core-source");
      await writeLock(userLock, "user/core-source");
      const options = ["--with", "codex", "--roots", ...roots, "--lock", projectLock, userLock];

      const projectFirst = await invokePreflight(options);
      assert.notEqual(projectFirst.status, 0);
      assert.equal(preflightOutput(projectFirst).installLine, "npx skills add project/core-source --skill implement-tickets-codex");

      await writeLock(projectLock, null);
      const userFallback = await invokePreflight(options);
      assert.notEqual(userFallback.status, 0);
      assert.equal(preflightOutput(userFallback).installLine, "npx skills add user/core-source --skill implement-tickets-codex");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prints a source placeholder and guidance when neither lock has the core entry", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "implement-tickets-no-lock-entry-"));
    const roots = [path.join(root, "project-agent"), path.join(root, "project-claude")];
    const projectLock = path.join(root, "project", "skills-lock.json");
    const userLock = path.join(root, "user", ".skill-lock.json");
    try {
      for (const adapterRoot of roots) await mkdir(adapterRoot, { recursive: true });
      await writeLock(projectLock, null);
      await writeLock(userLock, null);
      const result = await invokePreflight([
        "--with", "codex",
        "--roots", ...roots,
        "--lock", projectLock, userLock,
      ]);
      assert.notEqual(result.status, 0);
      const output = preflightOutput(result);
      assert.equal(output.installLine, "npx skills add <source of implement-tickets> --skill implement-tickets-codex");
      assert.match(output.note, /source that installed the core/i);
      assert.ok(result.stdout.includes("npx skills add <source of implement-tickets> --skill implement-tickets-codex"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a native agent pin with an adapter before planning", async () => {
    const result = await invokePreflight(["--with", "codex", "--agent", "general-purpose"]);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}\n${result.stdout}`, /--agent[\s\S]*--with|--with[\s\S]*--agent/i);
    assert.doesNotMatch(`${result.stderr}\n${result.stdout}`, /planning starts|plan created/i);
  });

  it("defines the adapter input, resume, failover, worktree lifecycle, envelope, and routing table", async () => {
    const contract = await readTextOrNull(path.join(skillRoot, "references/adapter-contract.md"));
    const schemaText = await readTextOrNull(path.join(skillRoot, "references/envelope.schema.json"));
    const skill = await readTextOrNull(path.join(skillRoot, "SKILL.md"));
    assert.ok(contract, "the adapter contract exists");
    assert.ok(schemaText, "the envelope schema exists");
    assert.ok(skill, "the core skill exists");

    for (const heading of ["Input", "Resume", "Failover", "Worktree cleanup"]) {
      assert.match(contract, new RegExp(`^## ${heading}(?:$|\\s)`, "m"), `the adapter contract documents ${heading.toLowerCase()}`);
    }
    const schema = JSON.parse(schemaText);
    assert.deepEqual(schema.properties.outcome.enum, ["completed", "failed_infra", "failed_other"]);
    assert.deepEqual(schema.required, ["outcome", "session_id", "report", "usage"]);
    assert.match(contract, /\| `completed` \|[^\n]*verification/i);
    assert.match(contract, /\| `failed_infra` \|[^\n]*not counted[^\n]*two[^\n]*BLOCKED \(TICKET_PROVIDER_FAILED\)/i);
    assert.match(contract, /\| `failed_other` \|[^\n]*one counted attempt/i);
    assert.match(contract, /core creates[\s\S]*?worker branch[\s\S]*?worktree/i);
    assert.match(contract, /passes[\s\S]*?worktree path/i);
    assert.match(contract, /removes?[\s\S]*?after integration/i);
    assert.match(contract, /native[\s\S]*?harness-managed isolation/i);
    assert.match(skill, /`--with <backend>`[\s\S]*adapter/i);
    assert.match(skill, /selected adapter\s+name is the Plan's backend/i);
    assert.match(skill, /creates?[\s\S]*?worker branch[\s\S]*?worktree/i);
    assert.match(skill, /passes[\s\S]*?path[\s\S]*?adapter/i);
    assert.match(skill, /removes?[\s\S]*?after integration/i);
  });

  it("validates every scripted fixture envelope through preflight and rejects a malformed envelope", async () => {
    const fixtureAdapter = path.join(adapterFixtureRoot, "implement-tickets-fixture", "SKILL.md");
    const envelopeNames = ["completed.json", "failed-infra.json", "failed-other.json", "resume.json"];
    const root = await mkdtemp(path.join(tmpdir(), "implement-tickets-malformed-envelope-"));
    const malformed = path.join(root, "malformed.json");
    try {
      assert.equal(await exists(fixtureAdapter), true, "the scripted fixture adapter exists");
      assert.equal(await exists(fixtureLock), true, "the fixture lock file exists");
      const schemaText = await readTextOrNull(path.join(skillRoot, "references/envelope.schema.json"));
      assert.ok(schemaText, "the envelope schema exists");
      const schema = JSON.parse(schemaText);
      assert.deepEqual(schema.properties.outcome.enum, ["completed", "failed_infra", "failed_other"]);

      for (const name of envelopeNames) {
        const envelope = path.join(envelopeFixtureRoot, name);
        assert.equal(await exists(envelope), true, `the ${name} scripted envelope exists`);
        const result = await invokePreflight([
          "--with", "fixture",
          "--roots", adapterFixtureRoot,
          "--lock", fixtureLock,
          "--envelope", envelope,
        ]);
        assert.equal(result.status, 0, result.stderr);
        assert.equal(preflightOutput(result).envelopeValidation.valid, true, `${name} validates against the schema`);
      }

      await writeFile(malformed, JSON.stringify({
        outcome: "completed",
        session_id: "missing-required-fields",
        report: "incomplete envelope",
      }), "utf8");
      const rejected = await invokePreflight([
        "--with", "fixture",
        "--roots", adapterFixtureRoot,
        "--lock", fixtureLock,
        "--envelope", malformed,
      ]);
      assert.notEqual(rejected.status, 0);
      assert.equal(preflightOutput(rejected).envelopeValidation.valid, false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("documents adapter selection, the contract, and its source-based install line", async () => {
    for (const file of ["docs/guides/implement-tickets.md", "docs/skills/agents/implement-tickets.md"]) {
      const doc = await readTextOrNull(path.join(repoRoot, file));
      assert.ok(doc, `${file} exists`);
      assert.ok(/--with <name>/.test(doc), `${file} documents adapter selection`);
      assert.ok(/adapter-contract\.md/.test(doc), `${file} links the adapter contract`);
      assert.ok(
        /npx skills add <source> --skill implement-tickets-<name>/i.test(doc),
        `${file} documents the source-based install line`,
      );
    }
  });
});

describe("implement-tickets integration gate and run-state contract", () => {
  const gatePath = path.join(skillRoot, "references/integration-gate.md");
  const statePath = path.join(skillRoot, "references/status-and-resume.md");

  function requireText(text, expression, behavior) {
    assert.ok(expression.test(text), behavior);
  }

  it("squash-merges a fully verified wave in ticket order and gates the combined result", async () => {
    const gate = await readTextOrNull(gatePath);
    assert.ok(gate, "the integration gate procedure exists");
    requireText(
      gate,
      /after every ticket in (?:the )?wave is verified[\s\S]*?squash-merge[\s\S]*?ticket(?:-number)?\s+order[\s\S]*?one commit per ticket[\s\S]*?full typecheck[\s\S]*?(?:full )?(?:test )?suite/i,
      "a verified wave is merged in order and checked as one result",
    );
  });

  it("locates a gate culprit, restores the last good commit, preserves later verified tickets, and retries alone", async () => {
    const gate = await readTextOrNull(gatePath);
    assert.ok(gate, "the integration gate procedure exists");
    requireText(gate, /gate fails[\s\S]*?re-merge[\s\S]*?ticket(?:-number)? order/i, "a failed gate is replayed in order");
    requireText(gate, /after each merge[\s\S]*?typecheck[\s\S]*?suite/i, "each replayed merge runs both checks");
    requireText(gate, /git checkout -B <integration-branch> <sha>/, "recovery checks out the last good commit onto the integration branch");
    requireText(gate, /hard reset/i, "the recovery rule excludes hard reset");
    requireText(gate, /already-verified later tickets[\s\S]*?without re-verifying/i, "later verified tickets are retained without another verifier run");
    requireText(gate, /gate once more/i, "the rebuilt wave is gated once more");
    requireText(gate, /re-dispatch(?:es)? the culprit alone as a serial attempt[\s\S]*?count(?:ing|s) one attempt/i, "only the culprit is retried and that retry counts once");
  });

  it("blocks a ticket after three verification failures and reports held and independent paths", async () => {
    const state = await readTextOrNull(statePath);
    assert.ok(state, "the run-state and resume procedure exists");
    requireText(state, /three failed verification attempts[\s\S]*?BLOCKED \(TICKET_VERIFICATION_FAILED\)/i, "three verification failures block the ticket");
    requireText(state, /dependants?[\s\S]*?(?:held|not started)[\s\S]*?next frontier/i, "only dependants are held at the next frontier");
    requireText(state, /independent tickets[\s\S]*?available partial path/i, "independent tickets are reported as an available partial path");
    requireText(state, /halt report[\s\S]*?blocked tickets[\s\S]*?held tickets[\s\S]*?resume command/i, "the halt report names blocked tickets, held tickets, and the resume command");
    requireText(state, /\/implement-tickets continue <feature-slug>/, "the halt report gives the implement-tickets continue command");
  });

  it("defines the status header and per-ticket table, including reported usage totals", async () => {
    const state = await readTextOrNull(statePath);
    assert.ok(state, "the run-state and resume procedure exists");
    requireText(state, /^skill: implement-tickets/m, "status.md starts with the skill identity");
    const template = state.match(/```markdown\s*([\s\S]*?)```/)?.[1];
    assert.ok(template, "the run-state reference includes a status.md template");
    assert.equal(template.split(/\r?\n/, 1)[0], "skill: implement-tickets", "the template's first line is the skill identity");
    requireText(
      state,
      /\| Ticket \| Wave \| Backend \| Touch set \| Status \| Session ID \| Attempts \| Branch \| Commit \| Budget estimate \| Usage total \| Verifier usage total \|/i,
      "the ticket table contains all required state and usage columns",
    );
    requireText(state, /usage_total[\s\S]*every dispatch and resume[\s\S]*delivering path/i, "worker usage is summed across dispatches and resumes on the delivering path");
    requireText(state, /possibly cache-inclusive/i, "reported usage is marked as possibly cache-inclusive");
    requireText(state, /`?unknown`? when none (?:is|was) reported/i, "missing usage is recorded as unknown");
    requireText(state, /verifier_usage_total[\s\S]*verifier\s+dispatch/i, "verifier usage is tracked separately");
  });

  it("refuses legacy state and reconciles, rewinds, replans, and resumes valid state", async () => {
    const state = await readTextOrNull(statePath);
    assert.ok(state, "the run-state and resume procedure exists");
    requireText(state, /continue[\s\S]*status\.md\s+without the first line[\s\S]*refus/i, "continue refuses a status file without the identity line");
    requireText(state, /recover the old skill from git history or start over/i, "legacy-state refusal gives the recovery choices");
    requireText(state, /continue[\s\S]*reconcile[\s\S]*git/i, "continue reconciles recorded state against git");
    requireText(state, /drift[\s\S]*git checkout -B <integration-branch> <sha>/, "continue rewinds drift through a branch checkout");
    requireText(state, /re-present the Plan[\s\S]*resume from (?:the )?(?:earliest eligible )?frontier/i, "continue presents the reconciled Plan and resumes at the frontier");
  });

  it("keeps status and list read-only", async () => {
    const state = await readTextOrNull(statePath);
    assert.ok(state, "the run-state and resume procedure exists");
    requireText(state, /status \[slug\][\s\S]*list[\s\S]*read-only[\s\S]*change nothing/i, "status and list only report saved state");
  });

  it("hands off a green integrated run without starting review or publication", async () => {
    const gate = await readTextOrNull(gatePath);
    assert.ok(gate, "the integration gate procedure exists");
    requireText(gate, /every ticket is integrated[\s\S]*last suite is green[\s\S]*handoff/i, "a successful run prints a handoff after its final gate");
    requireText(gate, /implement-tickets\/<(?:feature-)?slug>/, "the handoff names the integration branch");
    requireText(gate, /review commands/i, "the handoff names review commands");
    requireText(gate, /do not run review, push, or (?:open|create) a pull\s+request/i, "the run stops before review and publication");
  });

  it("documents the gate, status file, and resume command on both user-facing pages", async () => {
    for (const file of ["docs/guides/implement-tickets.md", "docs/skills/agents/implement-tickets.md"]) {
      const doc = await readTextOrNull(path.join(repoRoot, file));
      assert.ok(doc, `${file} exists`);
      requireText(doc, /integration gate[\s\S]*typecheck[\s\S]*suite/i, `${file} describes the integration gate`);
      requireText(doc, /status\.md[\s\S]*skill: implement-tickets/i, `${file} describes the status file identity`);
      requireText(doc, /\/implement-tickets continue \[slug\]/, `${file} documents the resume command`);
    }
  });
});
