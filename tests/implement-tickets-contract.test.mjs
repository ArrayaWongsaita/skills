import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { markdownHeaderBlock, markdownHeadings, markdownSection } from "./helpers/markdown-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillRoot = path.join(repoRoot, "skills/agents/implement-tickets");
const gatePath = path.join(skillRoot, "references/integration-gate.md");
const statePath = path.join(skillRoot, "references/status-and-resume.md");
const wavesScript = path.join(skillRoot, "scripts/waves.mjs");
const preflightScript = path.join(skillRoot, "scripts/preflight.mjs");
const ticketCheckerScript = path.join(repoRoot, "skills/agents/grill-to-tickets/scripts/check-tickets.mjs");
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

const flatten = (text) => text?.replace(/\s*\n\s*/g, " ");

// Whole file with line breaks flattened; scope assertions with flatSection.
async function readFlat(rel) {
  return flatten(await readTextOrNull(path.join(skillRoot, rel)));
}

// One named section of a skill file, flattened.
async function flatSection(rel, title) {
  const section = markdownSection((await readTextOrNull(path.join(skillRoot, rel))) ?? "", title);
  assert.ok(section, `${rel} has a "${title}" section`);
  return flatten(section);
}

// The Thai and English run-mode sections of the two implement-tickets docs.
const docRunModeSections = ["โหมดการรันและ extras", "Run modes and extras"];

function docSection(markdown, title, file) {
  const section = markdownSection(markdown, title);
  assert.ok(section, `${file} has a "${title}" section`);
  return flatten(section);
}

async function evalById(id) {
  const { evals } = JSON.parse(await readTextOrNull(path.join(skillRoot, "evals/evals.json")));
  const entry = evals.find((e) => e.id === id);
  assert.ok(entry, `eval ${id} exists`);
  return JSON.stringify(entry);
}

async function readDrainSection() {
  const gate = await readTextOrNull(gatePath);
  const drainSection = markdownSection(gate ?? "", "Conflict deferral and drain rounds");
  assert.ok(drainSection, "the conflict deferral and drain rounds section exists");
  return drainSection.replace(/\s+/g, " ");
}

async function glossaryRow(term) {
  const glossary = await readTextOrNull(path.join(repoRoot, "docs/glossary.md"));
  return (glossary?.split(/\r?\n/) ?? []).find((line) => line.startsWith(`| ${term} |`));
}

function ticket(number, { blockers = [], context = "", seam = "the core contract test", title = `Ticket ${number}`, risk } = {}) {
  return [
    `# ${number}: ${title}`,
    "",
    "**What to build:** Fixture behavior.",
    `**Blocked by:** ${blockers.length ? blockers.join(", ") : "None (can start immediately)"}`,
    "**Stories:** 1",
    `**Seam:** ${seam}`,
    `**Context:** ${context}`,
    "**Budget:** read ~1k tokens · 1 criteria · 1 modules",
    ...(risk === undefined ? [] : [`**Risk:** ${risk}`]),
    "**Status:** ready-for-agent",
    "",
    "- [ ] Fixture criterion.",
    "",
  ].join("\n");
}

async function fixture(tickets, { spec } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "implement-tickets-contract-"));
  const issues = path.join(root, "issues");
  await mkdir(issues, { recursive: true });
  if (spec !== undefined) await writeFile(path.join(root, "spec.md"), spec, "utf8");
  for (const [number, contents] of Object.entries(tickets)) {
    await writeFile(path.join(issues, `${number}-fixture.md`), contents, "utf8");
  }
  return { root, issues };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function manifestFor(spec, tickets) {
  return {
    version: 1,
    specSha256: sha256(Buffer.from(spec)),
    waves: [],
    tickets,
  };
}

function manifestTicket(number, blockedBy = []) {
  return {
    number: Number(number),
    file: `issues/${number}-fixture.md`,
    blockedBy: blockedBy.map(Number),
  };
}

async function writeManifest(root, manifest) {
  await writeFile(
    path.join(root, "manifest.json"),
    typeof manifest === "string" ? manifest : `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

async function gitRepository() {
  const root = await mkdtemp(path.join(tmpdir(), "implement-tickets-git-repo-"));
  const result = spawnSync("git", ["init", "--quiet"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, `temporary Git repository initializes: ${result.stderr || result.stdout}`);
  return root;
}

async function invokeWaves(dir, options = []) {
  assert.equal(await exists(wavesScript), true, "wave planning behavior is missing: scripts/waves.mjs does not exist");
  return spawnSync(process.execPath, [wavesScript, dir, ...options], { encoding: "utf8" });
}

async function runWaves(dir, options = []) {
  const result = await invokeWaves(dir, options);
  assert.equal(result.status, 0, `wave script exits successfully: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

function assertTicketSetWarning(output, number) {
  assert.ok(output.manifest.statuses.includes("ticket set differs"));
  assert.ok(output.manifest.warnings.some((warning) =>
    new RegExp(`ticket ${number}\\b`, "i").test(warning)));
  assert.deepEqual(output.warnings, output.manifest.warnings);
  assert.ok(!output.manifest.statuses.includes("matches"));
}

async function invokePreflight(options = [], { cwd } = {}) {
  assert.equal(await exists(preflightScript), true, "adapter preflight behavior is missing: scripts/preflight.mjs does not exist");
  const temporaryRoot = cwd ? null : await gitRepository();
  try {
    return spawnSync(process.execPath, [preflightScript, ...options], {
      cwd: cwd ?? temporaryRoot,
      encoding: "utf8",
    });
  } finally {
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
  }
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

function markdownSections(markdown) {
  const topLevelSections = markdownHeadings(markdown)
    .filter(({ level }) => level === 2)
    .map(({ title }) => markdownSection(markdown, title))
    .filter(Boolean);
  return [markdownHeaderBlock(markdown), ...topLevelSections];
}

function linkedReferences(sections) {
  return [...new Set(sections.flatMap((section) =>
    [...section.matchAll(/references\/([^/\s)`]+\.md)/g)].map((match) => match[1]),
  ))].sort();
}

describe("implement-tickets wave planner contract", () => {
  it("reports each ticket's own Budget line, or none when absent", async () => {
    const ownBudget = "read ~19k tokens · 4 criteria · 3 modules";
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(edit) src/one.mjs" })
        .replace("**Budget:** read ~1k tokens · 1 criteria · 1 modules", "**Budget:** " + ownBudget),
      "02": ticket("02", { context: "(edit) src/two.mjs" })
        .replace(/^\*\*Budget:\*\*[^\r\n]*\r?\n/m, ""),
    });
    try {
      await writeManifest(root, manifestFor("# Fixture spec\n", [
        { ...manifestTicket("01"), budget: "manifest copy must be ignored" },
        { ...manifestTicket("02"), budget: "manifest copy must not fill a missing ticket value" },
      ]));

      const output = await runWaves(issues);
      assert.deepEqual(output.tickets.map(({ budget }) => budget), [ownBudget, "none"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("reports a changed spec in manifest and top-level warnings without failing planning", async () => {
    const spec = "# Fixture spec\n";
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(edit) src/one.mjs" }),
    }, { spec });
    try {
      const manifest = manifestFor(spec, [manifestTicket("01")]);
      manifest.specSha256 = "0".repeat(64);
      await writeManifest(root, manifest);

      const result = await invokeWaves(issues);
      assert.equal(result.status, 0, result.stderr);
      const output = JSON.parse(result.stdout);
      assert.deepEqual(output.manifest.statuses, ["spec changed"]);
      assert.equal(output.manifest.warnings.length, 1);
      assert.match(output.manifest.warnings[0], /spec changed since the tickets were checked/i);
      assert.match(output.manifest.warnings[0], /re-run the ticket checker with --write-budget/i);
      assert.deepEqual(output.warnings, output.manifest.warnings);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports matches without a manifest warning when the raw spec fingerprint matches", async () => {
    const spec = "# Fixture spec\n";
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(edit) src/one.mjs" }),
    }, { spec });
    try {
      await writeManifest(root, manifestFor(spec, [manifestTicket("01")]));

      const output = await runWaves(issues);
      assert.deepEqual(output.manifest.statuses, ["matches"]);
      assert.deepEqual(output.manifest.warnings, []);
      assert.deepEqual(output.warnings, []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("warns when a ticket is added after the manifest was written", async () => {
    const spec = "# Fixture spec\n";
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(edit) src/one.mjs" }),
    }, { spec });
    try {
      await writeManifest(root, manifestFor(spec, [manifestTicket("01")]));
      await writeFile(path.join(issues, "02-fixture.md"), ticket("02", { context: "(edit) src/two.mjs" }), "utf8");

      const output = await runWaves(issues);
      assertTicketSetWarning(output, "02");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("warns when a ticket recorded in the manifest has been removed", async () => {
    const spec = "# Fixture spec\n";
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(edit) src/one.mjs" }),
    }, { spec });
    try {
      await writeManifest(root, manifestFor(spec, [manifestTicket("01"), manifestTicket("02")]));

      const output = await runWaves(issues);
      assertTicketSetWarning(output, "02");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("warns when a ticket file is renamed without changing its number", async () => {
    const spec = "# Fixture spec\n";
    const contents = ticket("01", { context: "(edit) src/one.mjs" });
    const { root, issues } = await fixture({ "01": contents }, { spec });
    try {
      await writeManifest(root, manifestFor(spec, [manifestTicket("01")]));
      await rm(path.join(issues, "01-fixture.md"));
      await writeFile(path.join(issues, "01-renamed.md"), contents, "utf8");

      const output = await runWaves(issues);
      assertTicketSetWarning(output, "01");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("warns when a ticket's resolved blockers differ from the manifest", async () => {
    const spec = "# Fixture spec\n";
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(new) src/base.mjs" }),
      "02": ticket("02", { blockers: ["01"], context: "(edit) src/next.mjs" }),
    }, { spec });
    try {
      await writeManifest(root, manifestFor(spec, [manifestTicket("01"), manifestTicket("02")]));

      const output = await runWaves(issues);
      assertTicketSetWarning(output, "02");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps equivalent numeric and title blocker references silent", async () => {
    const spec = "# Fixture spec\n";
    for (const blocker of ["# 1", "Groundwork"]) {
      const { root, issues } = await fixture({
        "01": ticket("01", { title: "Groundwork", context: "(new) src/base.mjs" }),
        "02": ticket("02", { blockers: [blocker], context: "(edit) src/next.mjs" }),
      }, { spec });
      try {
        await writeManifest(root, manifestFor(spec, [manifestTicket("01"), manifestTicket("02", ["01"])]));

        const output = await runWaves(issues);
        assert.deepEqual(output.manifest.statuses, ["matches"], `blocker reference ${blocker}`);
        assert.deepEqual(output.manifest.warnings, [], `blocker reference ${blocker}`);
        assert.deepEqual(output.warnings, [], `blocker reference ${blocker}`);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  });

  it("keeps title and non-dependency ticket edits silent", async () => {
    const spec = "# Fixture spec\n";
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(edit) src/one.mjs" }),
    }, { spec });
    try {
      await writeManifest(root, manifestFor(spec, [manifestTicket("01")]));
      const changed = ticket("01", {
        title: "A revised title",
        seam: "a revised seam",
        context: "(edit) src/elsewhere.mjs",
      }).replace("**Budget:** read ~1k tokens · 1 criteria · 1 modules", "**Budget:** read ~9k tokens · 8 criteria · 4 modules");
      await writeFile(path.join(issues, "01-fixture.md"), changed, "utf8");

      const output = await runWaves(issues);
      assert.deepEqual(output.manifest.statuses, ["matches"]);
      assert.deepEqual(output.manifest.warnings, []);
      assert.deepEqual(output.warnings, []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("ignores files outside the ticket naming pattern on both sides", async () => {
    const spec = "# Fixture spec\n";
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(edit) src/one.mjs" }),
    }, { spec });
    try {
      await writeFile(path.join(issues, "notes.md"), "not a ticket\n", "utf8");
      const manifest = manifestFor(spec, [
        manifestTicket("01"),
        { number: 99, file: "issues/notes.md", blockedBy: [] },
      ]);
      await writeManifest(root, manifest);

      const output = await runWaves(issues);
      assert.deepEqual(output.manifest.statuses, ["matches"]);
      assert.deepEqual(output.manifest.warnings, []);
      assert.deepEqual(output.warnings, []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports a changed spec and a differing ticket set together", async () => {
    const spec = "# Current fixture spec\n";
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(edit) src/one.mjs" }),
      "02": ticket("02", { context: "(edit) src/two.mjs" }),
    }, { spec });
    try {
      const manifest = manifestFor("# Previous fixture spec\n", [manifestTicket("01")]);
      await writeManifest(root, manifest);

      const output = await runWaves(issues);
      assert.deepEqual(output.manifest.statuses, ["spec changed", "ticket set differs"]);
      assert.ok(output.manifest.warnings.some((warning) => /spec changed/i.test(warning)));
      assert.ok(output.manifest.warnings.some((warning) => /ticket 02\b/i.test(warning)));
      assert.deepEqual(output.warnings, output.manifest.warnings);
      assert.ok(!output.manifest.statuses.includes("matches"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("clears a changed-spec warning after the real checker rewrites the manifest", async () => {
    const scratch = path.join(repoRoot, ".scratch");
    await mkdir(scratch, { recursive: true });
    const root = await mkdtemp(path.join(scratch, "implement-tickets-manifest-reader-"));
    const issues = path.join(root, "issues");
    const spec = [
      "# Checker fixture",
      "",
      "## User Stories",
      "",
      "1. A fixture story.",
      "   Scenario: given a fixture when checked then it passes.",
      "",
      "## Implementation Decisions",
      "",
      "No additional decisions.",
      "",
    ].join("\n");
    try {
      await mkdir(issues, { recursive: true });
      await writeFile(path.join(root, "spec.md"), spec, "utf8");
      await writeFile(
        path.join(issues, "01-fixture.md"),
        ticket("01", { context: "(new) src/manifest-reader-fixture.mjs" }),
        "utf8",
      );

      const initialCheck = spawnSync(process.execPath, [ticketCheckerScript, root, "--write-budget"], {
        cwd: repoRoot,
        encoding: "utf8",
      });
      assert.equal(initialCheck.status, 0, `${initialCheck.stdout}\n${initialCheck.stderr}`);

      await writeFile(path.join(root, "spec.md"), `${spec}\n`, "utf8");
      const stale = await runWaves(issues);
      assert.deepEqual(stale.manifest.statuses, ["spec changed"]);

      const refreshedCheck = spawnSync(process.execPath, [ticketCheckerScript, root, "--write-budget"], {
        cwd: repoRoot,
        encoding: "utf8",
      });
      assert.equal(refreshedCheck.status, 0, `${refreshedCheck.stdout}\n${refreshedCheck.stderr}`);

      const refreshed = await runWaves(root);
      assert.deepEqual(refreshed.manifest.statuses, ["matches"]);
      assert.deepEqual(refreshed.manifest.warnings, []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("warns when the manifest is missing and continues with a successful plan", async () => {
    const spec = "# Fixture spec\n";
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(edit) src/one.mjs" }),
    }, { spec });
    try {
      const result = await invokeWaves(issues);
      assert.equal(result.status, 0, result.stderr);
      const output = JSON.parse(result.stdout);
      assert.deepEqual(output.manifest.statuses, ["missing"]);
      assert.equal(output.manifest.warnings.length, 1);
      assert.match(output.manifest.warnings[0], /manifest.*missing/i);
      assert.deepEqual(output.warnings, output.manifest.warnings);
      assert.deepEqual(output.waves, [["01"]]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("ignores invalid JSON, unsupported versions, incomplete schemas, and invalid ticket entries", async () => {
    const spec = "# Fixture spec\n";
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(edit) src/one.mjs" }),
    }, { spec });
    const valid = manifestFor(spec, [manifestTicket("01")]);
    const invalidCases = [
      ["invalid JSON", "{"],
      ["unsupported version", { ...valid, version: 2 }],
      ["missing fingerprint", { version: 1, tickets: valid.tickets }],
      ["missing tickets", { version: 1, specSha256: valid.specSha256 }],
      ["null ticket", { ...valid, tickets: [null] }],
      ["non-object ticket", { ...valid, tickets: ["01"] }],
      ["non-integer number", { ...valid, tickets: [{ ...valid.tickets[0], number: "01" }] }],
      ["non-string file", { ...valid, tickets: [{ ...valid.tickets[0], file: 1 }] }],
      ["non-array blockers", { ...valid, tickets: [{ ...valid.tickets[0], blockedBy: null }] }],
      ["string blocker member", { ...valid, tickets: [{ ...valid.tickets[0], blockedBy: ["01"] }] }],
      ["fractional blocker member", { ...valid, tickets: [{ ...valid.tickets[0], blockedBy: [1.5] }] }],
    ];
    try {
      for (const [label, contents] of invalidCases) {
        await writeManifest(root, contents);
        const result = await invokeWaves(issues);
        assert.equal(result.status, 0, `${label}: ${result.stderr}`);
        const output = JSON.parse(result.stdout);
        assert.deepEqual(output.manifest.statuses, ["ignored"], label);
        assert.equal(output.manifest.warnings.length, 1, label);
        assert.match(output.manifest.warnings[0], /manifest.*ignored/i, label);
        assert.deepEqual(output.warnings, output.manifest.warnings, label);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("ignores malformed manifest blocker members and keeps the ticket-file wave plan", async () => {
    const spec = "# Fixture spec\n";
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(new) src/base.mjs" }),
      "02": ticket("02", { blockers: ["01"], context: "(edit) src/next.mjs" }),
    }, { spec });
    const manifest = manifestFor(spec, [
      manifestTicket("01"),
      { ...manifestTicket("02"), blockedBy: [{ toString: 1 }] },
    ]);
    try {
      await writeManifest(root, manifest);

      const result = await invokeWaves(issues);
      assert.equal(result.status, 0, `wave script continues with an advisory manifest warning: ${result.stderr}`);
      const output = JSON.parse(result.stdout);
      assert.deepEqual(output.manifest.statuses, ["ignored"]);
      assert.match(output.manifest.warnings.join(" "), /manifest.*ignored/i);
      assert.deepEqual(output.warnings, output.manifest.warnings);
      assert.deepEqual(output.waves, [["01"], ["02"]]);
      assert.deepEqual(output.tickets.map(({ blockers }) => blockers), [[], ["01"]]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("ignores duplicate manifest ticket numbers and retains ticket-file planning facts", async () => {
    const spec = "# Fixture spec\n";
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(edit) src/one.mjs" }),
    }, { spec });
    const manifest = manifestFor(spec, [
      { ...manifestTicket("01", ["99"]), file: "issues/01-old.md" },
      manifestTicket("01"),
    ]);
    try {
      await writeManifest(root, manifest);

      const result = await invokeWaves(issues);
      assert.equal(result.status, 0, `wave script treats the duplicate manifest as advisory: ${result.stderr}`);
      const output = JSON.parse(result.stdout);
      assert.deepEqual(output.manifest.statuses, ["ignored"]);
      assert.equal(output.manifest.warnings.length, 1);
      assert.match(output.manifest.warnings[0], /manifest.*ignored/i);
      assert.deepEqual(output.warnings, output.manifest.warnings);
      assert.deepEqual(output.waves, [["01"]]);
      assert.deepEqual(output.tickets.map(({ blockers }) => blockers), [[]]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("ignores non-ticket manifest entries during duplicate validation", async () => {
    const spec = "# Fixture spec\n";
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(edit) src/one.mjs" }),
    }, { spec });
    const manifest = manifestFor(spec, [
      manifestTicket("01"),
      { number: 1, file: "issues/notes.md", blockedBy: [] },
    ]);
    try {
      await writeManifest(root, manifest);

      const result = await invokeWaves(issues);
      assert.equal(result.status, 0, result.stderr);
      const output = JSON.parse(result.stdout);
      assert.deepEqual(output.manifest.statuses, ["matches"]);
      assert.deepEqual(output.manifest.warnings, []);
      assert.deepEqual(output.warnings, []);
      assert.deepEqual(output.waves, [["01"]]);
      assert.deepEqual(output.tickets.map(({ blockers }) => blockers), [[]]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports an unavailable spec fingerprint when the manifest exists but spec.md does not", async () => {
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(edit) src/one.mjs" }),
    });
    try {
      await writeManifest(root, {
        ...manifestFor("# Removed spec\n", [manifestTicket("01")]),
      });

      const result = await invokeWaves(issues);
      assert.equal(result.status, 0, result.stderr);
      const output = JSON.parse(result.stdout);
      assert.deepEqual(output.manifest.statuses, ["spec unavailable"]);
      assert.match(output.manifest.warnings.join(" "), /fingerprint cannot be checked/i);
      assert.deepEqual(output.warnings, output.manifest.warnings);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("finds the same manifest from feature and issues paths in relative, absolute, and trailing-slash forms", async () => {
    const spec = "# Fixture spec\n";
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(edit) src/one.mjs" }),
    }, { spec });
    try {
      await writeManifest(root, manifestFor(spec, [manifestTicket("01")]));
      const featureRelative = path.relative(repoRoot, root);
      const issuesRelative = path.relative(repoRoot, issues);
      const outputs = await Promise.all([
        runWaves(root),
        runWaves(`${root}${path.sep}`),
        runWaves(issues),
        runWaves(`${issues}${path.sep}`),
        runWaves(`${issuesRelative}${path.sep}`),
        runWaves(issuesRelative),
        runWaves(featureRelative),
        runWaves(`${featureRelative}${path.sep}`),
      ]);

      for (const output of outputs) assert.deepEqual(output.manifest, outputs[0].manifest);
      assert.deepEqual(outputs[0].manifest.statuses, ["matches"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps waves, blockers, and touch sets independent of manifest contents", async () => {
    const spec = "# Fixture spec\n";
    const { root, issues } = await fixture({
      "01": ticket("01", { context: "(new) src/base.mjs" }),
      "02": ticket("02", { blockers: ["01"], context: "(edit) src/left.mjs" }),
      "03": ticket("03", { blockers: ["01"], context: "(edit) src/right.mjs" }),
    }, { spec });
    const entries = [manifestTicket("01"), manifestTicket("02", ["01"]), manifestTicket("03", ["01"])];
    try {
      const missing = await runWaves(issues);
      const matchingManifest = manifestFor(spec, entries);
      matchingManifest.waves = [["99"]];
      await writeManifest(root, matchingManifest);
      const matching = await runWaves(issues);

      const changedSpec = { ...matchingManifest, specSha256: "0".repeat(64) };
      await writeManifest(root, changedSpec);
      const changed = await runWaves(issues);

      await writeManifest(root, "{");
      const ignored = await runWaves(issues);
      const planningFacts = ({ waves, tickets }) => ({
        waves,
        tickets: tickets.map(({ number, blockers, touchSet }) => ({ number, blockers, touchSet })),
      });
      assert.deepEqual(planningFacts(matching), planningFacts(missing));
      assert.deepEqual(planningFacts(changed), planningFacts(missing));
      assert.deepEqual(planningFacts(ignored), planningFacts(missing));
      assert.deepEqual(matching.waves, [["01"], ["02", "03"]]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a ticket with no Context field and names the ticket and field", async () => {
    const missingContext = ticket("01", { context: "(edit) src/one.mjs" })
      .replace(/^\*\*Context:\*\*.*\n/m, "");
    const { root, issues } = await fixture({ "01": missingContext });
    try {
      const result = await invokeWaves(issues);
      assert.notEqual(result.status, 0, "malformed ticket stops planning");
      assert.match(result.stderr, /issues\/01.*Context/i, "error identifies ticket 01 and its missing Context field");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects an explicitly empty Context field", async () => {
    const { root, issues } = await fixture({ "01": ticket("01", { context: "" }) });
    try {
      const result = await invokeWaves(issues);
      assert.notEqual(result.status, 0, "empty Context stops planning");
      assert.match(result.stderr, /issues\/01.*Context/i, "error identifies ticket 01 and its empty Context field");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

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

  it("reports each ticket's declared risk without changing waves, blockers, or touch sets", async () => {
    const tickets = {
      "01": ticket("01", { context: "(edit) src/one.mjs", risk: "high — shared interface" }),
      "02": ticket("02", { context: "(edit) src/two.mjs", risk: "low", blockers: ["01"] }),
      "03": ticket("03", { context: "(edit) src/three.mjs", blockers: ["01"] }),
      "04": ticket("04", { context: "(edit) src/four.mjs", risk: "medium" }),
    };
    const plain = {
      "01": ticket("01", { context: "(edit) src/one.mjs" }),
      "02": ticket("02", { context: "(edit) src/two.mjs", blockers: ["01"] }),
      "03": ticket("03", { context: "(edit) src/three.mjs", blockers: ["01"] }),
      "04": ticket("04", { context: "(edit) src/four.mjs" }),
    };
    const { root, issues } = await fixture(tickets);
    const control = await fixture(plain);
    try {
      const output = await runWaves(issues);
      const risks = Object.fromEntries(output.tickets.map((item) => [item.number, item.risk]));
      assert.deepEqual(risks, { "01": "high", "02": "low", "03": "low", "04": "high" });
      const malformed = output.tickets.find((item) => item.number === "04");
      assert.match(malformed.warnings.join(" "), /risk/i);
      assert.ok(output.warnings.some((warning) => /04/.test(warning) && /risk/i.test(warning)));
      for (const number of ["01", "02", "03"]) {
        const item = output.tickets.find((entry) => entry.number === number);
        assert.ok(!item.warnings.some((warning) => /risk/i.test(warning)), `ticket ${number} has no risk warning`);
      }
      const planningFacts = ({ waves, tickets: items }) => ({
        waves,
        tickets: items.map(({ number, wave, blockers, touchSet }) => ({ number, wave, blockers, touchSet })),
      });
      assert.deepEqual(planningFacts(output), planningFacts(await runWaves(control.issues)));
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(control.root, { recursive: true, force: true });
    }
  });

  it("reads a Risk value with trailing whitespace without a warning, as the ticket checker does", async () => {
    const padded = (number, risk) =>
      ticket(number, { context: `(edit) src/${number}.mjs`, risk }).replace(/^(\*\*Risk:\*\*.*)$/m, "$1 \t ");
    const { root, issues } = await fixture({
      "01": padded("01", "high — shared interface"),
      "02": padded("02", "low"),
    });
    try {
      const output = await runWaves(issues);
      const byNumber = Object.fromEntries(output.tickets.map((t) => [t.number, t]));
      assert.equal(byNumber["01"].risk, "high");
      assert.equal(byNumber["02"].risk, "low");
      assert.deepEqual([...byNumber["01"].warnings, ...byNumber["02"].warnings], []);
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
    const header = skill.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(header, "the skill begins with frontmatter");
    assert.match(header[1], /^name: implement-tickets$/m);
    assert.match(header[1], /^disable-model-invocation: true$/m);
    assert.ok(agent, "the Codex agent metadata exists");
    const policyMapping = agent.match(/^policy:[ \t]*\r?\n((?:[ \t]+[^\r\n]*(?:\r?\n|$))*)/m)?.[1];
    assert.ok(policyMapping, "the Codex agent metadata has a root policy mapping");
    const policyLines = policyMapping.split(/\r?\n/).filter((line) => line.trim() && !line.trimStart().startsWith("#"));
    const policyChildIndent = Math.min(...policyLines.map((line) => line.length - line.trimStart().length));
    assert.ok(Number.isFinite(policyChildIndent), "the Codex policy has direct mapping entries");
    const directPolicyChildren = policyLines.filter((line) => line.length - line.trimStart().length === policyChildIndent);
    assert.ok(
      directPolicyChildren.some((line) => line.slice(policyChildIndent).match(/^allow_implicit_invocation:\s*false\s*(?:#.*)?$/)),
      "allow_implicit_invocation is false as a direct child of the root policy mapping",
    );
  });

  it("runs clean-tree preflight for every backend before presenting the Plan", async () => {
    const skill = await readTextOrNull(path.join(skillRoot, "SKILL.md"));
    assert.ok(skill, "the implement-tickets skill exists");
    const invocation = markdownSection(skill, "Invocation");
    assert.ok(invocation, "the skill has an Invocation section");
    assert.match(invocation, /Before presenting any Plan, run/i);
    assert.match(invocation, /scripts\/preflight\.mjs/);
    assert.match(invocation, /every backend,\s+including\s+native/i);
    assert.match(invocation, /Git repository with a clean working tree/i);
    assert.match(invocation, /If preflight\s+fails,[\s\S]*stop before presenting the Plan/i);
    assert.match(invocation, /Pass the run's `--with`, `--agent`, and `--model` options to preflight/i);
    assert.match(invocation, /rejects `--agent` combined with `--with`/i);
    assert.match(invocation, /When `--with <name>`[\s\S]*also searches/i,
      "adapter discovery remains part of preflight when an adapter is selected");
  });

  it("specifies every Plan field and pauses before changes outside the feature directory", async () => {
    const planning = await readTextOrNull(path.join(skillRoot, "references/planning.md"));
    assert.ok(planning, "the planning procedure exists");
    const plan = markdownSection(planning, "5. Present the Plan and pause");
    assert.ok(plan, "the Plan presentation and approval subsection exists");
    assert.match(
      plan,
      /\| Ticket \| Wave \| Blockers \| Budget \| Touch set \| Seam \| Matched agent \| Retry budget \|/,
      "the Plan has a row for every ticket with all required columns",
    );
    assert.match(
      plan,
      /Budget column[\s\S]*ticket file's own Budget field[\s\S]*information only[\s\S]*no limit[\s\S]*triage/i,
      "the Budget column uses the ticket's own field and has no limit or triage effect",
    );
    assert.match(
      plan,
      /\| Retry budget \| Risk \|[\s\S]*Risk column[\s\S]*declared[\s\S]*Risk field[\s\S]*missing field[\s\S]*`low`/i,
      "every Plan row shows the declared risk, with a missing field shown as low",
    );
    assert.match(plan, /backend:\s*native harness subagents/i, "the Plan names the default backend");
    assert.match(plan, /concurrency cap[^`]{0,80}`4` by default/i, "the Plan names the default concurrency cap in parallel mode");
    assert.match(plan, /all script and planning warnings/i, "the Plan includes all planning warnings");
    assert.match(plan, /parallel not yet validated/, "the pending marker is printed in the Plan");
    assert.match(plan, /strict run presents the Plan[\s\S]{0,160}until the person approves/i, "a strict Plan waits for explicit approval");
    assert.match(plan, /pause for explicit approval/i, "the strict pause names explicit approval");
    assert.match(plan, /no file outside the\s+feature directory changes until approval/i, "files outside the feature directory stay untouched before approval");
  });

  it("defaults to serial runs and opts in to parallel waves with --parallel", async () => {
    const skill = await readTextOrNull(path.join(skillRoot, "SKILL.md"));
    const planning = await readTextOrNull(path.join(skillRoot, "references/planning.md"));
    assert.ok(skill && planning, "the skill and planning reference exist");
    const invocation = markdownSection(skill, "Invocation");
    assert.match(invocation, /--parallel`[\s\S]{0,160}opt/i, "--parallel opts in to waves built from blockers and touch sets");
    assert.match(invocation, /--serial`[\s\S]{0,120}alias[\s\S]{0,60}default/i, "--serial is an alias of the default");
    assert.match(invocation, /--concurrency N`[\s\S]{0,120}implies[\s\S]{0,20}`--parallel`/i, "--concurrency implies --parallel");
    assert.match(invocation, /`--serial`[\s\S]{0,60}(?:with|and)[\s\S]{0,60}`--parallel`[\s\S]{0,120}`--concurrency[\s\S]{0,120}reject[\s\S]{0,80}before[\s\S]{0,40}Plan/i, "combining --serial with --parallel or --concurrency is rejected before the Plan");
    const stage0 = markdownSection(skill, "Stage 0 — Plan, then pause");
    assert.match(stage0, /run\s+mode/i, "the Plan names the run mode");
    assert.match(stage0, /parallel mode[\s\S]{0,160}parallel not yet validated|parallel not yet validated[\s\S]{0,160}parallel mode/i, "the not-validated line is parallel-mode only");
    const waves = markdownSection(planning, "3. Compute waves");
    assert.match(waves, /pass(?:es)? `--serial`[\s\S]{0,80}unless parallel mode/i, "the planner receives --serial unless parallel mode is selected");
    const plan = markdownSection(planning, "5. Present the Plan and pause");
    assert.match(plan, /run mode:[\s\S]{0,160}serial[\s\S]{0,80}default/i, "the Plan states the run mode");
    assert.match(plan, /serial mode[\s\S]{0,80}no concurrency cap/i, "serial mode shows no cap");
    assert.match(plan, /cap of four[\s\S]{0,60}silently/i, "the shared cap of four stays enforced silently");
  });

  it("describes serial as the default and parallel as the opt-in in the glossary Wave entry", async () => {
    const glossary = await readTextOrNull(path.join(repoRoot, "docs/glossary.md"));
    const wave = glossary?.split(/\r?\n/).find((line) => line.startsWith("| Wave |"));
    assert.ok(wave, "the glossary has a Wave entry");
    assert.match(wave, /serial[\s\S]{0,40}default/i);
    assert.match(wave, /`--parallel`/);
  });

  it("records the run mode above the run-state table and resumes in it", async () => {
    const state = await readTextOrNull(statePath);
    assert.ok(state, "the status reference exists");
    const runState = markdownSection(state, "Run status, failure, and resume");
    const template = runState.match(/```markdown\s*([\s\S]*?)```/)?.[1];
    assert.match(template, /^Run mode: (?:serial|parallel)/m, "the template has a run mode line");
    assert.ok(template.indexOf("Run mode:") < template.indexOf("| Ticket |"), "the mode line sits above the table");
    const continueSection = markdownSection(state, "Continue and reconcile");
    assert.match(continueSection, /reads? the run mode from the `Run mode:` line/i, "continue reads the mode from the line");
    assert.match(continueSection, /mode change[\s\S]{0,40}needs approval/i, "a mode change needs approval");
    assert.match(continueSection, /no `Run mode:`\s+line[\s\S]{0,160}parallel when any wave holds more\s+than\s+one\s+ticket[\s\S]{0,40}otherwise[\s\S]{0,20}serial/i, "a record without a mode line is inferred from its waves");
  });

  it("documents advisory manifest warnings in planning and resume procedures", async () => {
    const skill = await readTextOrNull(path.join(skillRoot, "SKILL.md"));
    const planning = await readTextOrNull(path.join(skillRoot, "references/planning.md"));
    const resume = await readTextOrNull(path.join(skillRoot, "references/status-and-resume.md"));
    assert.ok(skill, "the implement-tickets skill exists");
    assert.ok(planning, "the planning procedure exists");
    assert.ok(resume, "the status and resume procedure exists");

    const stage0 = markdownSection(skill, "Stage 0 — Plan, then pause");
    const compute = markdownSection(planning, "3. Compute waves");
    const presentPlan = markdownSection(planning, "5. Present the Plan and pause");
    const continueRun = markdownSection(resume, "Continue and reconcile");
    assert.match(compute, /JSON[\s\S]*`manifest` field/i, "the planning reference documents the script's manifest field");
    assert.match(presentPlan, /manifest warnings join the other planning warnings/i, "manifest warnings join the Plan's other warnings");
    assert.match(presentPlan, /Spec changed since the tickets\s+were checked; re-run the ticket checker with `--write-budget` to refresh the\s+manifest\./, "the Plan pins the spec-hash warning wording and its cure");
    assert.match(continueRun, /continue[\s\S]*re-present(?:s|ing) the Plan/i, "continue re-presents the Plan");
    assert.match(continueRun, /manifest\s+check/i, "continue reruns the manifest check");
    assert.match(continueRun, /spec\.md/i, "the resume check names the spec file");
    assert.match(continueRun, /edited\s+between sessions[\s\S]*spec-hash warning/i, "continue surfaces a spec edit made between sessions");
    assert.match(stage0, /every manifest state[\s\S]*cannot stop the run[\s\S]*not recorded in\s+the run status file[\s\S]*strict run always reaches the approval pause/i, "manifest state is advisory and does not affect run state or the strict approval pause");
    assert.match(stage0, /wave planning comes from ticket files\s+and never from the manifest/i, "waves are computed from ticket files only");
  });

  it("summarizes manifest comparisons, named warnings, and Budget in both languages with a linked remedy", async () => {
    for (const file of ["docs/guides/implement-tickets.md", "docs/skills/agents/implement-tickets.md"]) {
      const doc = await readTextOrNull(path.join(repoRoot, file));
      assert.ok(doc, `${file} exists`);
      const thai = markdownSection(doc, "ภาษาไทย / Thai");
      const english = markdownSection(doc, "English / ภาษาอังกฤษ");
      assert.ok(thai && english, `${file} has Thai and English sections`);

      for (const [language, section] of [["Thai", thai], ["English", english]]) {
        const summary = section.split(/\r?\n\s*\r?\n/).find((paragraph) =>
          /manifest/i.test(paragraph) && /Budget/i.test(paragraph));
        assert.ok(summary, `${file} ${language} has a concise manifest and Budget summary`);
        if (language === "Thai") {
          assert.match(summary, /ตัวอ่าน manifest[\s\S]*เปรียบเทียบ spec และชุด ticket/i,
            `${file} Thai summary says the manifest reader compares the spec and ticket set`);
          assert.match(summary, /Plan[\s\S]*คำเตือน spec-hash[\s\S]*คำเตือน ticket-set/i,
            `${file} Thai summary names both Plan warning types`);
          assert.match(summary, /คอลัมน์ Budget[\s\S]*แสดง Budget ของ ticket แต่ละใบ/i,
            `${file} Thai summary says Budget shows each ticket's Budget`);
          assert.match(summary, /\[planning reference\]\([^)]+planning\.md\)[\s\S]*อธิบายวิธีแก้คำเตือน spec-hash/i,
            `${file} Thai summary says the linked planning reference explains the spec-hash remedy`);
        } else {
          assert.match(summary, /manifest reader[\s\S]*compares the spec and ticket set/i,
            `${file} English summary says the manifest reader compares the spec and ticket set`);
          assert.match(summary, /Plan[\s\S]*spec-hash\s+warning[\s\S]*ticket-set\s+warning/i,
            `${file} English summary names both Plan warning types`);
          assert.match(summary, /Budget column[\s\S]*shows each ticket's Budget/i,
            `${file} English summary says Budget shows each ticket's Budget`);
          assert.match(summary, /\[planning reference\]\([^)]+planning\.md\)[\s\S]*explains how to clear the spec-hash warning/i,
            `${file} English summary says the linked planning reference explains the spec-hash remedy`);
        }
        assert.doesNotMatch(summary, /--write-budget|re-run the ticket checker/i,
          `${file} ${language} summary does not duplicate detailed manifest mechanics`);
      }
    }
  });

  it("records the manifest reader, warn-only rule, and raw-byte fingerprint in a dated bilingual ADR addendum", async () => {
    const adr = await readTextOrNull(path.join(repoRoot, "docs/decisions/0020-implement-tickets-core.md"));
    assert.ok(adr, "ADR 0020 exists");
    const heading = markdownHeadings(adr).find(({ title }) => title.startsWith("Addendum (2026-10-01) / ภาคผนวก"));
    assert.ok(heading, "ADR 0020 has a dated bilingual addendum");
    const addendum = markdownSection(adr, heading.title);
    assert.match(addendum, /manifest reader/i);
    assert.match(addendum, /warn-only[\s\S]*advisory/i);
    assert.match(addendum, /SHA-256 of the raw\s+bytes/i);
    assert.match(addendum, /ตัวอ่าน manifest/);
    assert.match(addendum, /เตือนเท่านั้น/);
    assert.match(addendum, /ไบต์ดิบ/);
  });

  it("pins the spec-hash warning eval for a produced Plan after the spec changes", async () => {
    const evalText = await readTextOrNull(path.join(skillRoot, "evals/evals.json"));
    assert.ok(evalText, "the implement-tickets evals exist");
    const { evals } = JSON.parse(evalText);
    const evalCase = evals.find(({ id }) => id === 19);
    assert.ok(evalCase, "eval 19 covers a spec-hash warning in the Plan");
    assert.equal(evalCase.name, "spec-hash warning appears in the produced Plan after the spec changes");
    assert.match(evalCase.prompt, /\/implement-tickets/);
    assert.match(evalCase.prompt, /ticket checker wrote manifest\.json[\s\S]*spec\.md changed/i);
    assert.match(evalCase.expected_output, /produced Plan[\s\S]*Spec changed since the tickets were checked[\s\S]*--write-budget/i);
  });

  it("links bilingual Seam and Context guidance to the planning reference in both user-facing pages", async () => {
    for (const file of ["docs/guides/implement-tickets.md", "docs/skills/agents/implement-tickets.md"]) {
      const doc = await readTextOrNull(path.join(repoRoot, file));
      assert.ok(doc, `${file} exists`);
      const header = markdownHeaderBlock(doc);
      const thaiSeamContext = markdownSection(doc, "Seam และ Context");
      const englishSeamContext = markdownSection(doc, "Seam and Context");
      assert.match(header, /implement-tickets/, `${file} identifies the skill in its introduction`);
      assert.ok(thaiSeamContext, `${file} has a Thai Seam and Context section`);
      assert.ok(englishSeamContext, `${file} has an English Seam and Context section`);
      assert.match(thaiSeamContext, /planning\.md/, `${file} links Thai Seam and Context guidance to planning`);
      assert.match(englishSeamContext, /planning\.md/, `${file} links English Seam and Context guidance to planning`);
    }
  });

  it("links bilingual user documentation to canonical mechanics without copying their rules", async () => {
    const pages = ["docs/guides/implement-tickets.md", "docs/skills/agents/implement-tickets.md"];
    const canonicalLinks = [
      ["core invocation contract", /\]\((?:\.\.\/)+skills\/agents\/implement-tickets\/SKILL\.md\)/],
      ["adapter contract", /\]\((?:\.\.\/)+skills\/agents\/implement-tickets\/references\/adapter-contract\.md\)/],
      ["planning reference", /\]\((?:\.\.\/)+skills\/agents\/implement-tickets\/references\/planning\.md\)/],
      ["parallel-validation reference", /\]\((?:\.\.\/)+skills\/agents\/implement-tickets\/references\/parallel-validation\.md\)/],
    ];
    const copiedRules = [
      ["CLI option effects", /--(?:with|agent|model|concurrency|serial)\b|default (?:backend|concurrency cap)|concurrency cap (?:is|of|เท่ากับ)\s*4|ค่าเริ่มต้น(?:ใช้|เป็น).{0,40}native harness/i],
      ["adapter search or lock fallback", /(?:\.agents\/skills|\.claude\/skills|skills-lock\.json|\.skill-lock\.json|preflight searches|preflight ค้นหา|(?:check|use|อ่าน) (?:the )?(?:project|user) lock.{0,80}(?:then|before|fallback))/i],
      ["adapter install fallback", /npx skills add <source>|npx skills add[^`\n]*--skill implement-tickets-[\w<]|<source of implement-tickets>|(?:generated|สร้าง) install line/i],
      ["adapter worktree ownership", /worker branch.{0,100}worktree|core.{0,100}(?:creates|owns|สร้าง).{0,100}worktree|(?:ลบ|remove|cleanup).{0,100}worktree/i],
      ["touch-set classification or overlap", /\((?:edit|new|edit from NN)\)|touch[- ]set overlap|path(?:s)? overlap|directory prefix|(?:read-only|read only).{0,80}touch[- ]set|touch[- ]set.{0,80}(?:overlap|path|read-only|from NN|edit from)/i],
      ["wave placement rules", /earliest eligible wave|wave เดี่ยว|first wave after|same wave|single wave|wave.{0,80}(?:blocker|overlap)|blocker.{0,80}wave|ticket.{0,60}wave.{0,60}(?:blocker|overlap)/i],
      ["validation marker behavior", /status:\s*(?:not validated|validated)|parallel not yet validated|marker.{0,100}(?:prints|Plan|แสดง)/i],
    ];

    for (const file of pages) {
      const doc = await readTextOrNull(path.join(repoRoot, file));
      assert.ok(doc, `${file} exists`);
      for (const [language, heading] of [["Thai", "ภาษาไทย / Thai"], ["English", "English / ภาษาอังกฤษ"]]) {
        const section = markdownSection(doc, heading);
        assert.ok(section, `${file} has its ${language} section`);
        const copied = copiedRules.filter(([, expression]) => expression.test(section)).map(([label]) => label);
        assert.deepEqual(copied, [], `${file} ${language} section must defer shared mechanics to canonical references`);
        for (const [label, expression] of canonicalLinks) {
          assert.match(section, expression, `${file} ${language} section links the ${label}`);
        }
      }
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
    for (const [label, content] of [["SKILL.md", skill], ["guide", guide], ["skill page", page]]) {
      assert.deepEqual(
        linkedReferences(markdownSections(content)),
        directoryReferences,
        `${label} links exactly the reference Markdown files across its sections`,
      );
    }
  });

  it("documents the human parallel-validation procedure and its marker", async () => {
    const marker = await readTextOrNull(path.join(skillRoot, "references/parallel-validation.md"));
    assert.ok(marker, "the parallel-validation reference exists");
    const markerHeader = markdownHeaderBlock(marker);
    const procedure = markdownSection(marker, "Procedure");
    assert.match(markerHeader, /^status: (?:not validated|validated \d{4}-\d{2}-\d{2})$/m);
    assert.ok(procedure, "the validation procedure section exists");
    assert.match(procedure, /scratch repository/i);
    assert.match(procedure, /two independent tickets/i);
    assert.match(procedure, /\/implement-tickets/);
    assert.match(procedure, /two-wide wave/i);
    assert.match(procedure, /\/implement-tickets --parallel/, "the smoke run opts in to parallel mode");
    assert.match(procedure, /background workers/i);
    assert.match(procedure, /TaskStop/);
    assert.match(procedure, /permission prompts[\s\S]*main session/i);
    assert.match(procedure, /docs\/decisions\/0020-implement-tickets-core\.md/);
    assert.match(procedure, /status: validated YYYY-MM-DD/);

    const adr = await readTextOrNull(path.join(repoRoot, "docs/decisions/0020-implement-tickets-core.md"));
    assert.ok(adr, "ADR 0020 exists");
    const record = markdownSection(adr, "Parallel validation record / บันทึกผล parallel validation");
    assert.ok(record, "ADR 0020 has a parallel validation record section");
    assert.match(record, /Status: awaiting human validation/i);
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
    const sync = markdownSection(prompt, "First command — sync to the integration tip");
    assert.ok(sync, "the worker's first-command section exists");
    const firstShellBlock = sync.match(/```bash\s*([\s\S]*?)```/i);
    assert.ok(firstShellBlock, "the prompt includes its sync command block");
    const firstCommand = firstShellBlock[1].trimStart().split(/\r?\n/, 1)[0];
    assert.match(firstCommand, /^git checkout -B /, "checkout is the worker's first shell command");
    assert.match(sync, /git checkout -B\s+"?<worker-branch>"?\s+"?<integration-sha>"?/,
      "the first worker command checks out the worker branch at the integration SHA");
    requireText(sync, /test\s+"\$\(git rev-parse HEAD\)"\s*=\s*"<integration-sha>"/, "the sync command asserts the integration SHA");
    requireText(sync, /mismatch[\s\S]*return `failed_infra`/i, "a sync mismatch is returned as failed_infra");
    const headings = markdownHeadings(prompt).map(({ title }) => title);
    assert.ok(
      headings.indexOf("First command — sync to the integration tip") < headings.indexOf("What to build"),
      "the sync step precedes ticket instructions",
    );
    requireText(sync, /every worker prompt[\s\S]*including ticket 1/i, "the first ticket also receives the sync step");
  });

  it("requires complete red and green evidence in the existing worker report sections", async () => {
    const prompt = await readTextOrNull(promptPath);
    assert.ok(prompt, "the worker prompt scaffold exists");
    const ret = markdownSection(prompt, "Return");
    assert.ok(ret, "the Return section exists");
    const red = ret.match(/\*\*Red output:\*\*([\s\S]*?)(?=\n- \*\*|$)/)?.[1];
    const green = ret.match(/\*\*Green output:\*\*([\s\S]*?)(?=\n- \*\*|$)/)?.[1];
    const table = ret.match(/\*\*Test → criterion table:\*\*([\s\S]*?)(?=\n- \*\*|$)/)?.[1];
    assert.ok(red && green && table, "Red output, Green output, and the table stay in the return");
    requireText(red, /command/i, "Red output states the red command");
    requireText(red, /exit code/i, "Red output states the exit code");
    requireText(red, /verbatim/i, "Red output is verbatim");
    requireText(green, /command/i, "Green output states the green command");
    requireText(green, /exit code/i, "Green output states the exit code");
    requireText(green, /verbatim/i, "Green output is verbatim");
    requireText(green, /typecheck[\s\S]*`none configured`/i, "Green output keeps the typecheck result or none configured");
    requireText(table, /each new test[\s\S]*acceptance criterion/i, "the table maps tests to criteria");
    assert.doesNotMatch(ret, /\*\*Evidence/i, "no new Evidence section");
    assert.doesNotMatch(ret, /\b(first|last|at most|up to)\s+\d+\s+lines\b/i, "no line bound on output");
    const method = markdownSection(prompt, "Method — red, green, refactor");
    assert.ok(method, "the Method section exists");
    requireText(method, /full test\s+suite is left to the integration gate/i, "the full suite is left to the integration gate");
  });

  it("caps workers and verifiers together and gives pending verifiers priority", async () => {
    const dispatch = await readTextOrNull(dispatchPath);
    assert.ok(dispatch, "the dispatch contract exists");
    const cap = markdownSection(dispatch, "Shared concurrency cap");
    assert.ok(cap, "the shared concurrency cap section exists");
    requireText(cap, /default(?:s)? (?:in-flight )?cap (?:is|of) 4/i, "the shared cap defaults to four");
    requireText(cap, /--concurrency N/, "the cap has a concurrency override");
    requireText(cap, /workers and verifiers together|workers plus verifiers/i, "workers and verifiers use the same cap");
    requireText(cap, /verifiers?\s+(?:are\s+)?(?:started|dispatched|take)\s+before\s+(?:starting\s+|dispatching\s+)?new workers/i, "verifiers have priority over new workers");
  });

  it("pipelines a fresh native verifier and keeps its report to raw evidence", async () => {
    const verification = await readTextOrNull(verificationPath);
    assert.ok(verification, "the verification contract exists");
    const contract = markdownSection(verification, "Worker verification contract");
    assert.ok(contract, "the worker verification contract section exists");
    requireText(contract, /as soon as (?:a )?worker\s+returns[\s\S]*?without waiting for the rest of the wave/i, "verification starts as each worker returns");
    requireText(contract, /fresh (?:native )?subagent[\s\S]*never\s+the orchestrator/i, "the verifier is a separate native subagent");
    requireText(contract, /subagent_type:\s*Explore/, "the first verifier is Explore");
    requireText(contract, /too shallow to judge[\s\S]*general-purpose/i, "shallow evidence triggers a general-purpose verifier");
    requireText(contract, /read-only/, "the fallback verifier is read-only");
    requireText(contract, /raw evidence[\s\S]*no verdict/i, "the verifier returns evidence without a verdict");
  });

  it("runs each worker and verifier in the background with its own soft-timeout wait", async () => {
    const dispatch = await readTextOrNull(dispatchPath);
    const verification = await readTextOrNull(verificationPath);
    assert.ok(dispatch, "the dispatch contract exists");
    assert.ok(verification, "the verification contract exists");
    const dispatchTimeouts = markdownSection(dispatch, "Background dispatch and timeouts");
    const verificationContract = markdownSection(verification, "Worker verification contract");
    assert.ok(dispatchTimeouts && verificationContract, "both dispatch and verification contract sections exist");
    requireText(dispatchTimeouts, /Workers and verifiers are dispatched in the background/i, "workers and verifiers run in the background");
    requireText(dispatchTimeouts, /one background wait per dispatch/i, "each child dispatch arms one background wait");
    requireText(dispatchTimeouts, /Worker wait: 2700 seconds/i, "workers have a 2700-second timeout");
    requireText(verificationContract, /Verifiers run in the background[\s\S]*900 seconds/i, "verifiers have a 900-second timeout");
    requireText(dispatchTimeouts, /background wait ends first[\s\S]*TaskStop/i, "an early wait stops its subagent");
    requireText(dispatchTimeouts, /timeout records `failed_infra` and does not count as a\s+ticket attempt/i, "timeouts are infra failures outside the attempt count");
  });

  it("routes crashes, lost subagents, and harness-cap rejections through infra retries", async () => {
    const dispatch = await readTextOrNull(dispatchPath);
    assert.ok(dispatch, "the dispatch contract exists");
    const cap = markdownSection(dispatch, "Shared concurrency cap");
    const timeouts = markdownSection(dispatch, "Background dispatch and timeouts");
    assert.ok(cap && timeouts, "the dispatch contract has cap and timeout sections");
    requireText(timeouts, /child crash or lost subagent[\s\S]*failed_infra/i, "crashed or lost subagents are infra failures");
    requireText(cap, /Concurrent subagent limit reached/, "harness capacity rejections are recognized");
    requireText(cap, /wait for a free slot and retry/i, "capacity rejections wait and retry");
    requireText(cap, /does not count against the two\s+infrastructure retries/i, "capacity waits do not use an infra retry");
    requireText(timeouts, /After two infra retries[\s\S]*BLOCKED \(TICKET_PROVIDER_FAILED\)/i, "two infra retries end in the provider-failed status");
  });

  it("has the worker report touch-set extras with a reason and allows required extra files", async () => {
    const prompt = await readTextOrNull(promptPath);
    assert.ok(prompt, "the worker prompt scaffold exists");
    const constraints = markdownSection(prompt, "Constraints");
    const ret = markdownSection(prompt, "Return");
    assert.ok(constraints && ret, "the prompt has constraint and return sections");
    requireText(constraints, /extra files? (?:are|is) allowed\s+when\s+required[\s\S]*report/i, "required extra files are allowed and must be reported");
    assert.doesNotMatch(constraints, /Touch only the files assigned/i, "the worker is no longer limited to assigned files");
    requireText(ret, /\*\*Touch-set extras:\*\*[\s\S]*every file outside (?:its|the) declared touch set[\s\S]*reason/i, "the return lists each extra with a reason");
  });

  it("measures extras from the worker branch diff before verification", async () => {
    const dispatch = await readTextOrNull(dispatchPath);
    const verification = await readTextOrNull(verificationPath);
    assert.ok(dispatch && verification, "the dispatch and verification contracts exist");
    const extras = markdownSection(dispatch, "Measuring touch-set extras");
    assert.ok(extras, "the dispatch contract has a measuring section");
    requireText(extras, /right\s+after\s+a\s+worker\s+returns[\s\S]*before\s+verification/i, "extras are computed before verification");
    requireText(extras, /git diff --name-only --no-renames <pre-ticket-integration-sha> <worker-branch>/, "extras come from the branch diff against the pre-ticket integration commit");
    requireText(extras, /rename or deletion[\s\S]*old and new paths/i, "a rename or deletion counts as old and new paths");
    requireText(extras, /omits? a changed file[\s\S]*still\s+(?:an\s+)?extras?/i, "a file missing from the report is still an extra");
    requireText(extras, /advisory[\s\S]*never replaces/i, "the worker's list is advisory");
    requireText(extras, /unknown touch set has no extras/i, "an unknown touch set has no extras");
    requireText(markdownSection(verification, "Touch-set extras before verification"), /measures the touch-set extras before the verifier/i, "verification reads the extras measured beforehand");
  });

  it("parks a ticket on a deny-list or cap hit and keeps its work", async () => {
    const dispatch = await readTextOrNull(dispatchPath);
    const state = await readTextOrNull(statePath);
    const adapter = await readTextOrNull(path.join(skillRoot, "references/adapter-contract.md"));
    assert.ok(dispatch && state && adapter, "dispatch, state and adapter files exist");
    const denyListSection = markdownSection(dispatch, "Deny-list and cap hits");
    assert.ok(denyListSection, "the dispatch contract has a deny-list and cap section");
    requireText(denyListSection, /deny-list[\s\S]{0,200}before\s+verification[\s\S]{0,200}BLOCKED \(TOUCH_SET_APPROVAL\)/i, "a deny-list extra parks the ticket before verification");
    for (const name of ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", ".github/workflows/", ".gitlab-ci.yml", ".env*", "docs/decisions/"]) {
      assert.ok(denyListSection.includes(name), `the deny-list names ${name}`);
    }
    requireText(denyListSection, /read-only Context items?[\s\S]{0,80}no ticket edits/i, "read-only Context items that no ticket edits are denied");
    requireText(denyListSection, /lockfile names?[\s\S]{0,80}environment files[\s\S]{0,60}any directory depth/i, "names and environment files match at any depth");
    requireText(denyListSection, /(?:directory|prefix)[\s\S]{0,60}from the repository root/i, "directory entries match from the repository root");
    requireText(denyListSection, /read-only[\s\S]{0,60}exact path/i, "read-only items match by exact path");
    requireText(denyListSection, /any\s+ticket\s+in\s+the\s+set\s+declares\s+as\s+its\s+own\s+edit[\s\S]{0,120}not a deny-list case/i, "an extra another ticket edits is not a deny-list case");
    requireText(denyListSection, /more\s+than\s+five\s+distinct\s+extra\s+files[\s\S]{0,120}all\s+its\s+dispatches[\s\S]{0,160}dropped[\s\S]{0,60}no\s+longer\s+count/i, "the cap is five distinct files across dispatches and dropped extras do not count");
    requireText(denyListSection, /unknown\s+touch\s+set[\s\S]{0,120}no\s+cap[\s\S]{0,80}deny-list\s+still\s+applies/i, "an unknown touch set has no cap but keeps the deny-list");
    requireText(denyListSection, /work\s+is\s+kept[\s\S]{0,60}worker\s+branch/i, "the parked work is kept on the worker branch");
    requireText(markdownHeaderBlock(state), /Status progresses[^.]*`BLOCKED \(TOUCH_SET_APPROVAL\)`/i, "the status list names the touch-set approval token");
    requireText(markdownSection(adapter, "Worktree cleanup"), /parked[\s\S]{0,120}exempt[\s\S]{0,80}sweep/i, "parked adapter worktrees are exempt from the sweep");
    requireText(markdownSection(dispatch, "Extras into a later-wave ticket's files"), /later-wave ticket[\s\S]{0,200}accepted with a warning[\s\S]{0,200}base that already contains the change/i, "an extra into a later-wave ticket's file is accepted with a warning");
    requireText(markdownSection(adapter, "Failover"), /Adapter backends carry the same Touch-set extras section[\s\S]{0,80}free-form[\s\S]{0,120}envelope schema does not change/i, "adapters carry extras in the free-form report with an unchanged envelope schema");
    assert.ok(await glossaryRow("Deny-list"), "the glossary defines deny-list");
    assert.ok(await glossaryRow("Touch-set approval block"), "the glossary defines touch-set approval block");
  });

  it("holds only what a parked ticket must and releases it after an answer", async () => {
    const state = await readTextOrNull(statePath);
    const gate = await readTextOrNull(gatePath);
    const verification = await readTextOrNull(path.join(skillRoot, "references/verification.md"));
    assert.ok(state && gate && verification, "state, gate and verification files exist");
    const holdSection = markdownSection(state, "Hold set and release");
    assert.ok(holdSection, "the run-state contract has a hold set and release section");
    requireText(holdSection, /hold set[\s\S]{0,300}overlaps[\s\S]{0,120}effective\s+touch\s+set[\s\S]{0,200}transitive\s+dependants/i, "the hold set is overlap plus transitive dependants");
    requireText(holdSection, /unknown\s+touch\s+set[\s\S]{0,80}holds\s+all\s+later\s+tickets/i, "an unknown touch set holds all later tickets");
    requireText(holdSection, /outside the hold set keep running[\s\S]{0,80}later waves[\s\S]{0,200}gate runs without any held ticket/i, "independent tickets keep running and the gate skips held tickets");
    requireText(holdSection, /in flight or verified finishes[\s\S]{0,120}not merged until release[\s\S]{0,300}original wave and ticket order/i, "held tickets finish but merge after release in original order");
    const partial = markdownSection(state, "Verification failure and partial path");
    assert.ok(partial, "the run-state contract has a partial path section");
    requireText(partial, /exception to the halt rule[\s\S]{0,200}stops only when every unintegrated ticket is\s+held or blocked/i, "the block is an exception to the halt rule");
    requireText(holdSection, /notes\s+line[\s\S]{0,120}keyed by ticket number/i, "the question and answer live in a notes line");
    requireText(holdSection, /Record the answer when it arrives[\s\S]{0,120}every frontier[\s\S]{0,120}clear/i, "the answer is recorded, read at every frontier, and cleared");
    requireText(holdSection, /shown at the end of the wave[\s\S]{0,120}does not wait/i, "the question is shown at the end of the wave");
    requireText(holdSection, /several\s+tickets\s+were\s+parked[\s\S]{0,80}shown\s+together,\s+once,\s+at\s+the\s+end\s+of\s+that\s+wave/i, "several parked questions are shown together once at the wave end");
    requireText(markdownSection(state, "Continue and reconcile"), /`BLOCKED \(TOUCH_SET_APPROVAL\)` park[\s\S]{0,120}without the explicit-continue gate/i, "continue after only a touch-set park needs no explicit-continue gate");
    requireText(holdSection, /fresh verifier[\s\S]{0,200}release\s+pass[\s\S]{0,200}pre-pass commit[\s\S]{0,200}hold is\s+released after it passes/i, "approval verifies, merges in a release pass, and releases after the gate");
    requireText(holdSection, /rejection[\s\S]{0,60}extras are dropped[\s\S]{0,200}latest integration commit[\s\S]{0,200}declared files[\s\S]{0,200}costs one attempt[\s\S]{0,120}hold stays until the\s+ticket integrates/i, "rejection redispatches at one attempt and keeps the hold");
    requireText(holdSection, /ends\s+blocked[\s\S]{0,80}overlap\s+lift[\s\S]{0,80}dependants\s+stay\s+held/i, "a blocked parked ticket lifts overlap-only holds");
    requireText(partial, /every unanswered parked question[\s\S]{0,160}including one for\s+another blocked ticket/i, "every halt report lists unanswered parked questions");
    requireText(markdownSection(state, "Continue and reconcile"), /re-asks any unanswered parked question[\s\S]{0,200}derives held and deferred state from the\s+parked rows, the notes line, and Git/i, "continue re-asks and derives held state");
    requireText(holdSection, /each parked ticket has its own `Notes:` line[\s\S]{0,400}release pre-pass sha is `none` until[\s\S]{0,300}clear a ticket's line[\s\S]{0,160}on release[\s\S]{0,80}on rejection/i, "the notes line covers several parked tickets, the pre-pass sha lifecycle, and clearing");
    requireText(markdownSection(gate, "Release pass"), /mini-wave[\s\S]{0,200}own pre-pass commit[\s\S]{0,60}gate base/i, "the release pass is a mini-wave with its own gate base");
    requireText(markdownHeaderBlock(gate), /gate runs without any\s+held ticket/i, "the integration gate runs without held tickets");
    requireText(markdownSection(verification, "Approved parked branch"), /approves[\s\S]{0,200}fresh verifier[\s\S]{0,200}release\s+pass/i, "an approved parked branch is re-verified");
    assert.match(await glossaryRow("Hold set") ?? "", /declared or effective touch set overlaps/i, "the glossary defines hold set by overlap");
  });

  it("points execution mechanics to canonical contracts in scoped skill and guide sections", async () => {
    const skill = await readTextOrNull(path.join(skillRoot, "SKILL.md"));
    const guide = await readTextOrNull(path.join(repoRoot, "docs/guides/implement-tickets.md"));
    const page = await readTextOrNull(path.join(repoRoot, "docs/skills/agents/implement-tickets.md"));
    assert.ok(skill && guide && page, "the skill and both user-facing pages exist");

    const skillStage1 = markdownSection(skill, "Stage 1 — Execute approved waves");
    assert.ok(skillStage1, "the skill's approved execution section exists");
    for (const reference of ["dispatch-contract", "prompt-scaffold", "verification", "integration-gate", "status-and-resume"]) {
      assert.match(skillStage1, new RegExp(`references/${reference}\\.md`), `the skill Stage 1 links ${reference}`);
    }
    assert.doesNotMatch(
      skillStage1,
      /2700\s+seconds|900\s+seconds|TaskStop|failed_infra|Explore|general-purpose|Concurrent subagent limit reached|TICKET_PROVIDER_FAILED|two infra retries/i,
      "the skill Stage 1 leaves dispatch and verifier mechanics in their contracts",
    );

    const executionSections = [
      [guide, "Dispatch, verifier และ timeout", "guide Thai execution summary"],
      [guide, "Dispatch and verification", "guide English execution summary"],
      [page, "Dispatch, verifier และ timeout", "skill page Thai execution summary"],
      [page, "Dispatch and verification", "skill page English execution summary"],
    ];
    for (const [document, heading, label] of executionSections) {
      const section = markdownSection(document, heading);
      assert.ok(section, `${label} exists`);
      for (const reference of ["dispatch-contract", "prompt-scaffold", "verification"]) {
        assert.match(section, new RegExp(`references/${reference}\\.md`), `${label} links ${reference}`);
      }
      assert.doesNotMatch(
        section,
        /2700\s+seconds|900\s+seconds|TaskStop|failed_infra|Explore|general-purpose|Concurrent subagent limit reached|TICKET_PROVIDER_FAILED|two infra retries/i,
        `${label} summarizes mechanics instead of restating them`,
      );
    }
  });

  it("links run-state and usage semantics to the canonical status contract and glossary", async () => {
    const guide = await readTextOrNull(path.join(repoRoot, "docs/guides/implement-tickets.md"));
    const page = await readTextOrNull(path.join(repoRoot, "docs/skills/agents/implement-tickets.md"));
    assert.ok(guide && page, "both user-facing pages exist");

    const sections = [
      [guide, "Integration gate, status, and resume", "../glossary.md", "guide Thai run-state summary"],
      [guide, "Run status, integration, and resume", "../glossary.md", "guide English run-state summary"],
      [page, "Integration gate, status, and resume", "../../glossary.md", "skill page Thai run-state summary"],
      [page, "Run status, integration, and resume", "../../glossary.md", "skill page English run-state summary"],
    ];

    for (const [document, heading, glossaryPath, label] of sections) {
      const section = markdownSection(document, heading);
      assert.ok(section, `${label} exists`);
      assert.match(section, /status-and-resume\.md/, `${label} links the run-state contract`);
      assert.match(section, new RegExp(`usage_total[^\\n]*${glossaryPath.replaceAll("/", "\\/")}`), `${label} links the canonical usage_total glossary entry`);
      assert.doesNotMatch(section, /cache-inclusive|usage reported[^\n]*dispatch|sum(?:s|med)?[^\n]*usage[^\n]*resume/i, `${label} does not repeat usage semantics`);
    }
  });
});

describe("implement-tickets adapter and preflight contract", () => {
  it("accepts native preflight from a clean Git checkout", async () => {
    const cwd = await gitRepository();
    try {
      const result = await invokePreflight([], { cwd });
      assert.equal(result.status, 0, result.stderr);
      const output = preflightOutput(result);
      assert.equal(output.backend, "native");
      assert.equal(output.error, null);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("rejects a dirty native checkout before planning", async () => {
    const cwd = await gitRepository();
    try {
      await writeFile(path.join(cwd, "untracked-change.txt"), "dirty\n", "utf8");
      const result = await invokePreflight([], { cwd });
      assert.notEqual(result.status, 0, "a dirty native checkout cannot produce a Plan");
      assert.match(preflightOutput(result).error, /working tree is not clean/i);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("rejects a dirty adapter checkout before planning", async () => {
    const cwd = await gitRepository();
    const adapterRoot = `${cwd}-adapters`;
    try {
      await addAdapter(adapterRoot, "fixture");
      await writeFile(path.join(cwd, "untracked-change.txt"), "dirty\n", "utf8");
      const result = await invokePreflight(["--with", "fixture", "--roots", adapterRoot], { cwd });
      assert.notEqual(result.status, 0, "a dirty adapter checkout cannot produce a Plan");
      const output = preflightOutput(result);
      assert.equal(output.backend, "fixture");
      assert.match(output.error, /working tree is not clean/i);
    } finally {
      await rm(cwd, { recursive: true, force: true });
      await rm(adapterRoot, { recursive: true, force: true });
    }
  });

  it("rejects preflight outside a Git repository", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "implement-tickets-no-git-repo-"));
    try {
      const result = await invokePreflight([], { cwd });
      assert.notEqual(result.status, 0, "planning requires a Git checkout");
      assert.match(preflightOutput(result).error, /Git repository/i);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

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

    const contractHeadings = markdownHeadings(contract).map(({ title }) => title);
    for (const heading of ["Input", "Resume", "Failover", "Worktree cleanup"]) {
      assert.ok(contractHeadings.includes(heading), `the adapter contract documents ${heading.toLowerCase()}`);
    }
    const input = markdownSection(contract, "Input");
    const failover = markdownSection(contract, "Failover");
    const cleanup = markdownSection(contract, "Worktree cleanup");
    const invocation = markdownSection(skill, "Invocation");
    assert.ok(input && failover && cleanup && invocation, "the adapter and invocation sections exist");
    const schema = JSON.parse(schemaText);
    assert.deepEqual(schema.properties.outcome.enum, ["completed", "failed_infra", "failed_other"]);
    assert.deepEqual(schema.required, ["outcome", "session_id", "report", "usage"]);
    assert.match(failover, /\| `completed` \|[^\n]*verification/i);
    assert.match(failover, /\| `failed_infra` \|[^\n]*not counted[^\n]*two[^\n]*BLOCKED \(TICKET_PROVIDER_FAILED\)/i);
    assert.match(failover, /\| `failed_other` \|[^\n]*one counted attempt/i);
    assert.match(input, /core creates[\s\S]*?worker\s+branch[\s\S]*?worktree/i);
    assert.match(input, /passes its path to the adapter/i);
    assert.match(cleanup, /removes?[\s\S]*?after integration/i);
    assert.match(cleanup, /native[\s\S]*?harness-managed isolation/i);
    assert.match(invocation, /`--with <backend>`[\s\S]*adapter/i);
    assert.match(invocation, /selected adapter\s+name is the Plan's backend/i);
    assert.match(invocation, /creates?[\s\S]*?worker branch[\s\S]*?worktree/i);
    assert.match(invocation, /passes[\s\S]*?path[\s\S]*?adapter/i);
    assert.match(invocation, /removes?[\s\S]*?after integration/i);
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

  it("links adapter guidance to its canonical contract in Thai and English", async () => {
    for (const file of ["docs/guides/implement-tickets.md", "docs/skills/agents/implement-tickets.md"]) {
      const doc = await readTextOrNull(path.join(repoRoot, file));
      assert.ok(doc, `${file} exists`);
      const thaiAdapter = markdownSection(doc, file.includes("docs/guides/") ? "ติดตั้ง" : "วิธีทำงานหลัก");
      const englishUse = markdownSection(doc, "Purpose and use");
      assert.ok(thaiAdapter && englishUse, `${file} has Thai and English adapter guidance sections`);
      assert.match(thaiAdapter, /adapter-contract\.md/, `${file} Thai guidance links the adapter contract`);
      assert.match(englishUse, /adapter-contract\.md/, `${file} English guidance links the adapter contract`);
    }
  });
});

describe("implement-tickets integration gate and run-state contract", () => {
  function requireText(text, expression, behavior) {
    assert.ok(expression.test(text), behavior);
  }

  it("squash-merges a fully verified wave in ticket order and gates the combined result", async () => {
    const gate = await readTextOrNull(gatePath);
    assert.ok(gate, "the integration gate procedure exists");
    const waveGate = markdownSection(gate, "Wave integration gate");
    assert.ok(waveGate, "the wave integration gate section exists");
    requireText(
      waveGate,
      /after every ticket in (?:the )?wave is verified[\s\S]*?squash-merge[\s\S]*?ticket(?:-number)?\s+order[\s\S]*?one commit per ticket[\s\S]*?full typecheck[\s\S]*?(?:full )?(?:test )?suite/i,
      "a verified wave is merged in order and checked as one result",
    );
  });

  it("locates a gate culprit, restores the last good commit, preserves later verified tickets, and retries alone", async () => {
    const gate = await readTextOrNull(gatePath);
    assert.ok(gate, "the integration gate procedure exists");
    const recovery = markdownSection(gate, "Find and isolate a failing merge");
    assert.ok(recovery, "the failing-merge recovery section exists");
    requireText(recovery, /gate fails[\s\S]*?re-merge[\s\S]*?ticket(?:-number)? order/i, "a failed gate is replayed in order");
    requireText(recovery, /after each merge[\s\S]*?typecheck[\s\S]*?suite/i, "each replayed merge runs both checks");
    requireText(recovery, /git checkout -B <integration-branch> <sha>/, "recovery checks out the last good commit onto the integration branch");
    requireText(recovery, /hard reset/i, "the recovery rule excludes hard reset");
    requireText(recovery, /already-verified later tickets[\s\S]*?without re-verifying/i, "later verified tickets are retained without another verifier run");
    requireText(recovery, /gate once more/i, "the rebuilt wave is gated once more");
    requireText(recovery, /re-dispatch(?:es)? the culprit alone as a serial attempt[\s\S]*?count(?:ing|s) one attempt/i, "only the culprit is retried and that retry counts once");
  });

  it("blocks a ticket after three verification failures and reports held and independent paths", async () => {
    const state = await readTextOrNull(statePath);
    assert.ok(state, "the run-state and resume procedure exists");
    const failure = markdownSection(state, "Verification failure and partial path");
    assert.ok(failure, "the verification-failure section exists");
    requireText(failure, /three failed verification attempts[\s\S]*?BLOCKED \(TICKET_VERIFICATION_FAILED\)/i, "three verification failures block the ticket");
    requireText(failure, /dependants?[\s\S]*?(?:held|not started)[\s\S]*?next frontier/i, "only dependants are held at the next frontier");
    requireText(failure, /independent tickets[\s\S]*?available partial path/i, "independent tickets are reported as an available partial path");
    requireText(failure, /halt report[\s\S]*?blocked tickets[\s\S]*?held tickets[\s\S]*?resume command/i, "the halt report names blocked tickets, held tickets, and the resume command");
    requireText(failure, /\/implement-tickets continue <feature-slug>/, "the halt report gives the implement-tickets continue command");
  });

  it("defines the status header and per-ticket table, including reported usage totals", async () => {
    const state = await readTextOrNull(statePath);
    assert.ok(state, "the run-state and resume procedure exists");
    const runState = markdownSection(state, "Run status, failure, and resume");
    assert.ok(runState, "the run-state format section exists");
    requireText(runState, /^skill: implement-tickets/m, "status.md starts with the skill identity");
    const template = runState.match(/```markdown\s*([\s\S]*?)```/)?.[1];
    assert.ok(template, "the run-state reference includes a status.md template");
    assert.equal(template.split(/\r?\n/, 1)[0], "skill: implement-tickets", "the template's first line is the skill identity");
    requireText(
      runState,
      /\| Ticket \| Wave \| Backend \| Touch set \| Extras \| Status \| Session ID \| Attempts \| Branch \| Commit \| Budget estimate \| Usage total \| Verifier usage total \|/i,
      "the ticket table contains all required state and usage columns",
    );
    requireText(runState, /usage_total[\s\S]*every dispatch and resume[\s\S]*delivering path/i, "worker usage is summed across dispatches and resumes on the delivering path");
    requireText(runState, /possibly cache-inclusive/i, "reported usage is marked as possibly cache-inclusive");
    requireText(runState, /`?unknown`? when none (?:is|was) reported/i, "missing usage is recorded as unknown");
    requireText(runState, /verifier_usage_total[\s\S]*verifier\s+dispatch/i, "verifier usage is tracked separately");
  });

  it("refuses legacy state and reconciles, rewinds, replans, and resumes valid state", async () => {
    const state = await readTextOrNull(statePath);
    assert.ok(state, "the run-state and resume procedure exists");
    const continueSection = markdownSection(state, "Continue and reconcile");
    assert.ok(continueSection, "the continue and reconcile section exists");
    requireText(continueSection, /status\.md\s+without the first line[\s\S]*refus/i, "continue refuses a status file without the identity line");
    requireText(continueSection, /recover the old skill from git history or start over/i, "legacy-state refusal gives the recovery choices");
    requireText(continueSection, /reconcile each recorded integration branch[\s\S]*against Git/i, "continue reconciles recorded state against git");
    requireText(continueSection, /drift[\s\S]*git checkout -B <integration-branch> <sha>/, "continue rewinds drift through a branch checkout");
    requireText(continueSection, /re-present the Plan[\s\S]*resume from (?:the )?(?:earliest eligible )?frontier/i, "continue presents the reconciled Plan and resumes at the frontier");
  });

  it("accepts a clean-merge overlap and defers only a real conflict to a drain round in the same wave", async () => {
    const drainText = await readDrainSection();
    requireText(drainText, /overlap[^.]{0,120}merges? cleanly[^.]{0,80}gate passes[^.]{0,80}(?:accepted|integrated)[^.]{0,80}recorded/i, "a clean-merge overlap is accepted and recorded");
    requireText(drainText, /squash-merge conflict[^.]{0,80}defers? the ticket to a drain round in the same wave/i, "a real conflict defers to a drain round in the same wave");
    requireText(drainText, /lowest ticket number wins[^.]{0,80}later tickets in the pass keep merging/i, "the lowest number wins and later tickets keep merging");
    requireText(drainText, /next wave (?:does not start|waits)[^.]{0,80}(?:integrated|drain)/i, "the next wave waits for the wave to be integrated");
  });

  it("restarts a deferred ticket on the latest integration commit, one per drain round in ticket order", async () => {
    const drainText = await readDrainSection();
    requireText(drainText, /fresh (?:worker )?dispatch from the latest integration commit[\s\S]*?note of its known extras[\s\S]*?verified again/i, "a deferred ticket is redispatched fresh with its extras and re-verified");
    requireText(drainText, /one (?:deferred ticket )?per drain round[\s\S]*?ticket order/i, "deferred tickets run one per drain round in ticket order");
  });

  it("charges no attempt for a deferral and one attempt for a gate culprit outside the drain", async () => {
    const drainText = await readDrainSection();
    requireText(drainText, /deferral adds no attempt/i, "a conflict deferral adds no attempt");
    requireText(drainText, /culprit of a failing gate[\s\S]*?serially[\s\S]*?one attempt[\s\S]*?not (?:go )?through a drain round/i, "a gate culprit costs one attempt and skips the drain round");
  });

  it("gates after the first pass and every drain round and isolates the culprit within the pass", async () => {
    const drainText = await readDrainSection();
    requireText(drainText, /gate runs after the first merge pass and after every drain round/i, "the gate runs after the first pass and each drain round");
    requireText(drainText, /replays only the tickets merged in that pass[\s\S]*?commit before (?:that|a) drain round/i, "isolation replays only that pass from the commit before a drain round");
    requireText(drainText, /culprit's (?:serial )?redispatch finishes[\s\S]*?before any pending drain round/i, "the culprit redispatch finishes before a pending drain round");
  });

  it("ends drain rounds because each round integrates, spends an attempt, or parks", async () => {
    const drainText = await readDrainSection();
    requireText(drainText, /integrates its ticket, spends an attempt, or parks it/i, "each drain round makes progress");
    requireText(drainText, /blocked after three attempts/i, "a ticket that keeps failing ends blocked after three attempts");
  });

  it("makes deferral win over mechanical conflict resolution for drift conflicts only", async () => {
    const skill = await readTextOrNull(path.join(skillRoot, "SKILL.md"));
    assert.ok(skill, "SKILL.md exists");
    requireText(markdownSection(skill, "Constraints"), /mechanical merge\s+conflict resolution[\s\S]*?outside drift[\s\S]*?drift conflict[\s\S]*?deferral (?:takes precedence|wins)/i, "deferral takes precedence for drift conflicts and the allowance stays outside drift");
  });

  it("defines drain round and real conflict in the glossary", async () => {
    assert.match(await glossaryRow("Drain round") ?? "", /deferred/i, "the glossary defines drain round");
    assert.match(await glossaryRow("Real conflict") ?? "", /squash-merge/i, "the glossary defines real conflict");
  });

  it("records accepted extras in the run state and reads them back on continue", async () => {
    const state = await readTextOrNull(statePath);
    assert.ok(state, "the run-state and resume procedure exists");
    const runState = markdownSection(state, "Run status, failure, and resume");
    requireText(runState, /extras column[\s\S]*after the Touch set column/i, "the extras column follows the Touch set column");
    requireText(runState, /write(?:s)? (?:a ticket's )?(?:accepted )?extras[\s\S]*when (?:they are|it is) accepted/i, "extras are written when accepted");
    requireText(runState, /clean[- ]merge overlap[\s\S]*row\s+of both tickets/i, "a clean-merge overlap is noted in both rows");
    const continueSection = markdownSection(state, "Continue and reconcile");
    requireText(continueSection, /read(?:s)? (?:each ticket's )?(?:accepted )?extras back from the (?:Extras column|run state)/i, "continue reads extras back");
  });

  it("accepts extras without asking and scopes Plan approval to the plan structure", async () => {
    const skill = await readTextOrNull(path.join(skillRoot, "SKILL.md"));
    const planning = await readTextOrNull(path.join(skillRoot, "references/planning.md"));
    const state = await readTextOrNull(statePath);
    const gate = await readTextOrNull(gatePath);
    assert.ok(skill && planning && state && gate, "skill, planning, state and gate files exist");
    const constraints = markdownSection(skill, "Constraints");
    assert.ok(constraints, "the skill has a Constraints section");
    requireText(constraints, /extra\s+file[\s\S]{0,200}not\s+on\s+the\s+deny-list[\s\S]{0,200}within\s+the\s+cap[\s\S]{0,200}no\s+sibling\s+ticket[\s\S]{0,200}accepted\s+without\s+asking/i, "a plain extra is accepted without asking");
    assert.doesNotMatch(constraints, /Keep\s+a\s+worker\s+inside\s+its\s+declared\s+touch\s+set/i, "the old touch-set constraint is gone");
    requireText(constraints, /declared\s+(?:touch\s+)?set\s+is\s+a\s+planning\s+baseline[\s\S]*extras\s+are\s+measured\s+and\s+accepted/i, "the declared set is a baseline and extras are accepted");
    const planApproval = markdownSection(planning, "5. Present the Plan and pause");
    assert.ok(planApproval, "the planning reference has a Plan section");
    requireText(planApproval, /approval\s+covers\s+the\s+run\s+mode,\s+waves,\s+blockers,\s+ticket\s+set,\s+budget,\s+backend,\s+and\s+concurrency/i, "approval covers the plan structure");
    requireText(planApproval, /change\s+to\s+any\s+of\s+them[\s\S]{0,60}ask(?:s)?\s+for\s+approval/i, "a structural change asks for approval");
    requireText(planApproval, /requested\s+(?:adjustment|edit)[\s\S]{0,120}ask(?:s)?\s+for\s+approval\s+again[\s\S]{0,80}silence/i, "a requested edit asks again and silence never starts");
    const stage0 = markdownSection(skill, "Stage 0 — Plan, then pause");
    requireText(stage0, /references\/planning\.md#5-present-the-plan-and-pause/, "Stage 0 points to the planning reference for the approval scope");
    requireText(constraints, /references\/planning\.md#5-present-the-plan-and-pause[\s\S]{0,120}asks\s+for\s+approval[\s\S]{0,80}accepted\s+extras\s+alone\s+never\s+do/i, "the constraint points to the approval scope and says extras never need approval");
    const continueSection = markdownSection(state, "Continue and reconcile");
    requireText(continueSection, /only\s+(?:accepted\s+)?extras[\s\S]{0,160}without\s+a\s+new\s+approval/i, "continue with only extras resumes without approval");
  });

  it("summarizes extras at each wave end and in the final handoff table", async () => {
    const gate = await readTextOrNull(gatePath);
    assert.ok(gate, "the integration gate procedure exists");
    const summary = markdownSection(gate, "Wave summary");
    assert.ok(summary, "the gate has a wave summary section");
    requireText(summary, /end of each wave[\s\S]*every ticket (?:that has|with) extras[\s\S]*files/i, "the wave summary lists each ticket with its extras");
    requireText(summary, /clean[- ]merge overlap[\s\S]*green gate[\s\S]*note/i, "a clean-merge overlap is a note in the summary");
    const handoff = markdownSection(gate, "Successful handoff");
    requireText(handoff, /table of (?:all )?tickets and their accepted extra files/i, "the handoff has an extras table");
  });

  it("defines extra and drift in the glossary and calls the touch set a planning baseline", async () => {
    assert.ok(await glossaryRow("Extra"), "the glossary defines Extra");
    assert.ok(await glossaryRow("Drift"), "the glossary defines Drift");
    assert.match(await glossaryRow("Touch set") ?? "", /planning baseline/i, "the glossary calls the touch set a planning baseline");
  });

  it("keeps status and list read-only", async () => {
    const state = await readTextOrNull(statePath);
    assert.ok(state, "the run-state and resume procedure exists");
    const inspection = markdownSection(state, "Read-only inspection");
    assert.ok(inspection, "the read-only inspection section exists");
    requireText(inspection, /status \[slug\][\s\S]*list[\s\S]*read-only[\s\S]*change nothing/i, "status and list only report saved state");
  });

  it("hands off a green integrated run without starting review or publication", async () => {
    const gate = await readTextOrNull(gatePath);
    assert.ok(gate, "the integration gate procedure exists");
    const handoff = markdownSection(gate, "Successful handoff");
    assert.ok(handoff, "the successful handoff section exists");
    requireText(handoff, /every ticket is integrated[\s\S]*last suite is green[\s\S]*handoff/i, "a successful run prints a handoff after its final gate");
    requireText(handoff, /implement-tickets\/<(?:feature-)?slug>/, "the handoff names the integration branch");
    requireText(handoff, /review commands/i, "the handoff names review commands");
    requireText(handoff, /do not run review, push, or (?:open|create) a pull\s+request/i, "the run stops before review and publication");
  });

  it("documents the gate, status file, and resume command on both user-facing pages", async () => {
    for (const file of ["docs/guides/implement-tickets.md", "docs/skills/agents/implement-tickets.md"]) {
      const doc = await readTextOrNull(path.join(repoRoot, file));
      assert.ok(doc, `${file} exists`);
      const thaiStatus = markdownSection(doc, "Integration gate, status, and resume");
      const englishStatus = markdownSection(doc, "Run status, integration, and resume");
      assert.ok(thaiStatus, `${file} has a Thai run-state section`);
      assert.ok(englishStatus, `${file} has an English run-state section`);
      for (const [label, section] of [["Thai", thaiStatus], ["English", englishStatus]]) {
        requireText(section, /integration-gate\.md/, `${file} ${label} section links the integration contract`);
        requireText(section, /status-and-resume\.md/, `${file} ${label} section links the run-state contract`);
        requireText(section, /\/implement-tickets continue \[slug\]/, `${file} ${label} section names the resume command`);
      }
    }
  });
});

describe("implement-tickets touch-set drift decision record and docs", () => {
  const adrPath = path.join(repoRoot, "docs/decisions/0021-touch-set-drift-without-reapproval.md");

  it("files a bilingual record that narrows the approval gate and clarifies the serial default", async () => {
    const adr = await readTextOrNull(adrPath);
    assert.ok(adr, "ADR 0021 exists");
    assert.match(adr, /^# ADR 0021: Touch-set drift without re-approval/m);
    assert.match(adr, /Narrows \/ [^\n]*: ADR 0020 decision 1/);
    assert.ok(markdownSection(adr, "Context / บริบท"), "has a Context section");
    const decision = markdownSection(adr, "Decision / การตัดสินใจ");
    assert.ok(decision, "has a Decision section");
    assert.match(decision, /run mode,\s+waves,\s+blockers,\s+ticket set,\s+budget,\s+backend,\s+and\s+concurrency/i);
    assert.match(decision, /Serial \(one ticket per wave\) is the default run mode/);
    assert.match(decision, /--parallel/);
    assert.match(decision, /This clarifies ADR 0020/);
    assert.match(decision, /[฀-๿]/, "has Thai text");
  });

  it("lists the rejected alternatives and the semantic-conflict trade-off", async () => {
    const adr = await readTextOrNull(adrPath);
    assert.ok(adr, "ADR 0021 exists");
    const rejected = markdownSection(adr, "Rejected alternatives / ทางเลือกที่ปฏิเสธ");
    assert.ok(rejected, "has a Rejected alternatives section");
    for (const alt of [/ask on every extra/i, /defer on any path overlap/i, /defer to the next wave/i, /keep parallel as the default/i, /strict flag/i]) {
      assert.match(rejected, alt);
    }
    const consequences = markdownSection(adr, "Consequences / ผลที่ตามมา");
    assert.ok(consequences, "has a Consequences section");
    assert.match(consequences, /semantic conflict/i);
    assert.match(consequences, /project's\s+tests/i);
  });

  it("mentions the default mode, parallel flag, validation marker, and extras on both pages", async () => {
    for (const file of ["docs/guides/implement-tickets.md", "docs/skills/agents/implement-tickets.md"]) {
      const doc = await readTextOrNull(path.join(repoRoot, file));
      assert.ok(doc, `${file} exists`);
      for (const heading of ["Run modes and extras", "โหมดการรันและ extras"]) {
        const section = markdownSection(doc, heading);
        assert.ok(section, `${file} has ${heading}`);
        assert.match(section, /serial|ทีละ ticket/i);
        assert.match(section, /--parallel/);
        assert.match(section, /parallel-validation\.md/);
        assert.match(section, /extras?/i);
        assert.match(section, /planning\.md/);
        assert.match(section, /0021-touch-set-drift-without-reapproval\.md/);
      }
    }
  });
});

describe("implement-tickets --strict flag and Plan strictness", () => {
  const skillConstraints = async () => flatSection("SKILL.md", "Constraints");

  it("lists --strict as set once per run and independent of the other options", async () => {
    const skill = await readFlat("SKILL.md");
    const entry = skill.match(/- `--strict`.*?(?= - `|\. Before presenting|$)/)?.[0];
    assert.ok(entry, "--strict is listed among the options");
    assert.match(entry, /once per run/i);
    for (const opt of ["--parallel", "--serial", "--concurrency", "--with", "--agent", "--model"]) {
      assert.ok(entry.includes(opt), `${opt} named as independent`);
    }
    assert.match(entry, /independent/i);
  });

  it("makes a strict run present the Plan and dispatch and write nothing until approval", async () => {
    const skill = await flatSection("SKILL.md", "Stage 0 — Plan, then pause");
    const planning = await flatSection("references/planning.md", "5. Present the Plan and pause");
    for (const text of [skill, planning]) {
      assert.match(text, /strict run[\s\S]{0,200}(?:no worker|dispatch)[\s\S]{0,200}(?:run state|run-state)/i);
    }
  });

  it("names Strictness on its own line next to Run mode and keeps it out of the waves", async () => {
    const planning = await flatSection("references/planning.md", "5. Present the Plan and pause");
    assert.match(planning, /`Strictness:` line[\s\S]{0,120}run mode/i);
    assert.match(planning, /change of strictness[\s\S]{0,120}(?:not|never)[\s\S]{0,60}waves/i);
  });

  it("puts a run with no flag in default strictness: the Plan prints, the run starts without a pause, and only risky tickets are verified", async () => {
    const skill = await flatSection("SKILL.md", "Stage 0 — Plan, then pause");
    const planning = await flatSection("references/planning.md", "5. Present the Plan and pause");
    const verification = await flatSection("references/verification.md", "Risk-based verification");
    for (const text of [skill, planning]) {
      assert.match(text, /a run with no flag is in default strictness/i);
      assert.match(text, /no flag[\s\S]{0,200}prints the Plan and starts without (?:a pause|waiting for approval)/i);
    }
    assert.match(verification, /default strictness[\s\S]{0,80}ticket is verified only when it is risky/i);
  });

  it("leaves no conditional wording about a default that has yet to be flipped", async () => {
    // A negative guard, applied to each markdown section rather than a whole file.
    const flipped = /default (?:has been|is) flipped|until (?:then|the default)[^.]{0,40}stays? strict|once the default/i;
    const files = ["SKILL.md", "agents/openai.yaml", "evals/evals.json", ...(await readdir(path.join(skillRoot, "references"))).map((f) => `references/${f}`)];
    for (const rel of files) {
      const raw = await readTextOrNull(path.join(skillRoot, rel));
      const parts = rel.endsWith(".md") ? markdownSections(raw) : [raw];
      for (const part of parts) assert.doesNotMatch(part, flipped, `${rel} has no flip conditional`);
    }
    for (const doc of ["docs/guides/implement-tickets.md", "docs/skills/agents/implement-tickets.md"]) {
      for (const part of markdownSections(await readFile(path.join(repoRoot, doc), "utf8"))) {
        assert.doesNotMatch(part, flipped, `${doc} has no flip conditional`);
      }
    }
  });

  it("stops on planning errors and failed preflight in both strictness values", async () => {
    const constraints = await skillConstraints();
    assert.match(constraints, /(?:planning error|cycle|unresolved blocker)[\s\S]{0,300}both strictness values/i);
  });

  it("adds nothing to extras, warnings, or retry in strict mode", async () => {
    const constraints = await skillConstraints();
    assert.match(constraints, /strict adds nothing[\s\S]{0,200}extras[\s\S]{0,80}warning[\s\S]{0,80}retry/i);
  });

  it("describes --strict in the English and Thai docs and in eval 20", async () => {
    for (const file of ["docs/guides/implement-tickets.md", "docs/skills/agents/implement-tickets.md"]) {
      for (const title of docRunModeSections) {
        const section = docSection(await readFile(path.join(repoRoot, file), "utf8"), title, file);
        assert.match(section, /`--strict`/, `${file} ${title} describes --strict`);
        assert.match(section, /`Strictness:`/, `${file} ${title} names Strictness:`);
      }
    }
    const eval20 = await evalById(20);
    assert.match(eval20, /--strict/);
    assert.match(eval20, /Strictness:/);
  });
});

describe("implement-tickets strict mode decision record", () => {
  const adrPath = path.join(repoRoot, "docs/decisions/0022-strict-mode-and-risk-based-verification.md");

  it("files a bilingual record that narrows ADR 0020 and overrides ADR 0021's second-mode argument", async () => {
    const adr = await readTextOrNull(adrPath);
    assert.ok(adr, "ADR 0022 exists");
    assert.match(adr, /^# ADR 0022: Strict mode and risk-based verification/m);
    assert.match(adr, /Narrows \/ [^\n]*: ADR 0020[^\n]*(?:approval)[^\n]*(?:verifier)/i);
    assert.match(adr, /Overrides \/ [^\n]*: ADR 0021[^\n]*second mode[^\n]*kept/i);
    const decision = markdownSection(adr, "Decision / การตัดสินใจ");
    assert.ok(decision, "has a Decision section");
    assert.match(decision, /`--strict` pauses for Plan approval and verifies every ticket/);
    assert.match(decision, /no flag[\s\S]{0,160}prints the Plan and starts/i);
    assert.match(decision, /Risk: high/);
    assert.match(decision, /[฀-๿]/, "has Thai text");
    assert.ok(markdownSection(adr, "Rejected alternatives / ทางเลือกที่ปฏิเสธ"), "has rejected alternatives");
    assert.ok(markdownSection(adr, "Consequences / ผลที่ตามมา"), "has consequences");
  });

  it("names ADR 0022 in the header of the core decision record", async () => {
    const adr = await readTextOrNull(path.join(repoRoot, "docs/decisions/0020-implement-tickets-core.md"));
    assert.match(adr, /Narrowed by \/ [^\n]*ADR 0022/);
    assert.match(adr, /Narrowed by \/ [^\n]*ADR 0021/);
  });
});

describe("implement-tickets risk-based verification", () => {
  const section = () => flatSection("references/verification.md", "Risk-based verification");

  it("verifies every ticket in a strict run, including Risk: low", async () => {
    const s = await section();
    assert.match(s, /strict run[\s\S]{0,200}every ticket[\s\S]{0,120}`Risk: low`[\s\S]{0,160}fresh verifier/i);
  });

  it("lets the orchestrator judge a non-risky default-strictness ticket from its evidence", async () => {
    const s = await section();
    assert.match(s, /default strictness[\s\S]{0,300}no `Risk: high`[\s\S]{0,200}no risk signal[\s\S]{0,200}complete evidence/i);
    for (const part of ["Red output", "Green output", "Test → criterion table", "Files changed", "measured extras"]) {
      assert.ok(s.includes(part), `${part} is judged`);
    }
    assert.match(s, /no verifier (?:is )?dispatched/i);
  });

  it("verifies a Risk: high ticket in default strictness", async () => {
    const s = await section();
    assert.match(s, /`Risk: high`[\s\S]{0,200}fresh verifier/i);
  });

  it("lists every risk signal", async () => {
    const s = await section();
    for (const re of [/counted retry/i, /measured touch-set extras/i, /unknown touch set/i, /incomplete evidence/i, /rerun[\s\S]{0,80}real merge conflict/i]) {
      assert.match(s, re);
    }
  });

  it("never lets a Risk: low or missing field lower a signal", async () => {
    const s = await section();
    assert.match(s, /`Risk: low`[\s\S]{0,80}missing[\s\S]{0,80}never lowers/i);
  });

  it("defines incomplete evidence and counts no attempt for it", async () => {
    const s = await section();
    for (const re of [/missing, empty/i, /command or exit code/i, /compile or import error/i, /did not pass/i, /counts no attempt/i]) {
      assert.match(s, re);
    }
  });

  it("treats a Green output missing the typecheck result or `none configured` as incomplete evidence", async () => {
    const s = await section();
    assert.match(s, /Evidence is incomplete when[\s\S]*Green output\s+lacks the typecheck result or `none configured`/i);
  });

  it("keeps reports and adapters that predate the evidence sections working", async () => {
    const s = await section();
    assert.match(s, /predates these evidence sections keeps working[\s\S]{0,80}missing sections are incomplete evidence[\s\S]{0,80}counts no attempt[\s\S]{0,40}fresh verifier/i);
  });

  it("decides after extras are measured and before dispatch, keeping the counted-failure path", async () => {
    const s = await section();
    assert.match(s, /after[\s\S]{0,40}extras[\s\S]{0,40}measured[\s\S]{0,80}before[\s\S]{0,60}verifier/i);
    assert.match(s, /fails the ticket[\s\S]{0,120}counted-failure path/i);
  });

  it("keeps parked deny-list and cap hits verified on approval", async () => {
    const s = await section();
    assert.match(s, /deny-list or cap hit[\s\S]{0,200}parks[\s\S]{0,200}verified on approval/i);
  });

  it("words risk-based verification as the default-strictness rule", async () => {
    const s = await section();
    assert.match(s, /without `--strict`[\s\S]{0,80}default strictness/i);
  });

  it("points dispatch, gate, and adapter text at the rule", async () => {
    for (const file of ["references/dispatch-contract.md", "references/integration-gate.md", "references/adapter-contract.md"]) {
      const text = await readFlat(file);
      assert.match(text, /verification\.md#risk-based-verification/, `${file} links the rule`);
    }
    const adapter = await readFlat("references/adapter-contract.md");
    assert.doesNotMatch(adapter, /Send the worker report to a fresh verifier\. Integrate only after verification\./);
  });
});

describe("implement-tickets status and resume record strictness", () => {
  const record = async () => markdownHeaderBlock(await readTextOrNull(statePath)).replace(/\s*\n\s*/g, " ");
  const continueSection = () => flatSection("references/status-and-resume.md", "Continue and reconcile");

  it("records Strictness and adds Risk and Verifier columns after the existing columns", async () => {
    const text = markdownHeaderBlock(await readTextOrNull(statePath));
    assert.match(text, /^Strictness: strict$/m);
    const header = text.split("\n").find((line) => line.startsWith("| Ticket |"));
    assert.match(header, /\| Verifier usage total \| Risk \| Verifier \|$/);
  });

  it("records a skipped verifier as verified, never verifying", async () => {
    const s = await record();
    assert.match(s, /`verified` with `Verifier: skipped`[\s\S]{0,200}never (?:as )?`verifying`/i);
    assert.match(s, /same wave-wait, hold, merge, and `continue` paths/i);
  });

  it("reads old records as strict with Verifier ran", async () => {
    const s = await record();
    assert.match(s, /no `Strictness:` line[\s\S]{0,160}strict/i);
    assert.match(s, /no Verifier column[\s\S]{0,80}`Verifier: ran`/i);
  });

  it("reads a row with no Risk column as legacy alongside the missing Verifier column", async () => {
    const s = await record();
    assert.match(s, /no Verifier column, or no Risk column, is read as legacy[\s\S]{0,120}`Verifier: ran`/i);
  });

  it("writes the default-strictness record when the run starts", async () => {
    const s = await record();
    assert.match(s, /default[- ]strictness[\s\S]{0,200}when the run starts[\s\S]{0,120}(?:rather than|not) after (?:an )?approval/i);
    assert.match(s, /without `--strict`[\s\S]{0,120}writes its run record when the run starts/i);
  });

  it("resumes in the recorded strictness and handles continue --strict", async () => {
    const s = await continueSection();
    assert.match(s, /`continue` resumes in the recorded strictness/i);
    assert.match(s, /default strictness[\s\S]{0,200}no approval unless the Plan changed/i);
    assert.match(s, /`continue --strict`[\s\S]{0,200}records? the run as strict[\s\S]{0,200}re-presents the Plan[\s\S]{0,160}approv/i);
    assert.match(s, /`Verifier: skipped`[\s\S]{0,200}not yet integrated[\s\S]{0,120}fresh verifier before (?:its|the) merge/i);
    assert.match(s, /integrated one is not re-verified/i);
    assert.match(s, /`continue` without `--strict`[\s\S]{0,120}recorded as strict[\s\S]{0,60}stays strict/i);
  });

  it("lists tickets that skipped the verifier in the handoff and shows verifier outcome in status", async () => {
    const gate = await flatSection("references/integration-gate.md", "Successful handoff");
    assert.match(gate, /skipped the (?:fresh )?verifier, by number, in the handoff/i);
    const inspection = await flatSection("references/status-and-resume.md", "Read-only inspection");
    assert.match(inspection, /`status`[\s\S]{0,200}strictness[\s\S]{0,120}verifier outcome/i);
  });

  it("is described in the docs and eval 22", async () => {
    for (const file of ["docs/guides/implement-tickets.md", "docs/skills/agents/implement-tickets.md"]) {
      for (const title of docRunModeSections) {
        const section = docSection(await readFile(path.join(repoRoot, file), "utf8"), title, file);
        assert.match(section, /Verifier: skipped/, `${file} ${title}`);
        assert.match(section, /continue --strict/, `${file} ${title}`);
      }
    }
    const eval22 = await evalById(22);
    assert.match(eval22, /continue --strict/);
    assert.match(eval22, /Verifier: skipped/);
  });
});
