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
    assert.match(plan, /backend:\s*native harness subagents/i, "the Plan names the default backend");
    assert.match(plan, /concurrency cap:\s*`4` by default/i, "the Plan names the default concurrency cap");
    assert.match(plan, /all script and planning warnings/i, "the Plan includes all planning warnings");
    assert.match(plan, /parallel not yet validated/, "the pending marker is printed in the Plan");
    assert.match(plan, /pause for explicit approval/i, "the Plan waits for explicit approval");
    assert.match(plan, /no file outside the\s+feature directory changes until approval/i, "files outside the feature directory stay untouched before approval");
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
    assert.match(stage0, /every manifest state[\s\S]*cannot stop the run[\s\S]*not recorded in\s+the run status file[\s\S]*approval pause is always reached/i, "manifest state is advisory and does not affect run state or the approval pause");
    assert.match(stage0, /wave planning comes from ticket files\s+and never from the manifest/i, "waves are computed from ticket files only");
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
  const gatePath = path.join(skillRoot, "references/integration-gate.md");
  const statePath = path.join(skillRoot, "references/status-and-resume.md");

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
      /\| Ticket \| Wave \| Backend \| Touch set \| Status \| Session ID \| Attempts \| Branch \| Commit \| Budget estimate \| Usage total \| Verifier usage total \|/i,
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
