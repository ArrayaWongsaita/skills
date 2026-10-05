import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { checkFeatureDir } from "../skills/agents/grill-to-tickets/scripts/check-tickets.mjs";
import { planTickets } from "../skills/agents/implement-tickets/scripts/plan.mjs";

// One table of Blocked by values runs through the checker and the planner, so
// the two readers cannot silently disagree about what a value means.

const SPEC = `# Spec

## User Stories

1. As an admin, I want to export members, so that I can audit them
   Scenario: given an admin requests an export when export is available then the members are included
`;

const temporaryRoots = [];
after(async () => {
  await Promise.all(temporaryRoots.map((root) => rm(root, { recursive: true, force: true })));
});

function slugOf(number) {
  return `${String(number).padStart(2, "0")}-ticket.md`;
}

function ticketText({ number, title, blockedBy }) {
  const pad = String(number).padStart(2, "0");
  return [
    `# ${pad}: ${title}`,
    "",
    "**Stories:** 1",
    "**Seam:** a seam",
    "**Context:** (new) src/parity-fixture.mjs",
    "**Budget:** unmeasured",
    `**Blocked by:** ${blockedBy}`,
    "",
    "## What to build",
    "",
    "Something.",
    "",
  ].join("\n");
}

// The spec topology: tickets 01 and 02 exist with Blocked by None, and the
// value under test is the Blocked by of ticket 03.
function topology(value, { title1 = "Export members", title2 = "CSV download" } = {}) {
  return [
    { number: 1, title: title1, blockedBy: "None" },
    { number: 2, title: title2, blockedBy: "None" },
    { number: 3, title: "Third ticket", blockedBy: value },
  ];
}

// Tickets 01 and 03 share a title, and ticket 02 names it.
function duplicateTitleTopology() {
  return [
    { number: 1, title: "Export members", blockedBy: "None" },
    { number: 2, title: "CSV download", blockedBy: "Export members" },
    { number: 3, title: "Export members", blockedBy: "None" },
  ];
}

async function buildFeature(tickets) {
  const root = await mkdtemp(path.join(os.tmpdir(), "blocked-by-parity-"));
  temporaryRoots.push(root);
  const feature = path.join(root, ".scratch", "parity");
  await mkdir(path.join(feature, "issues"), { recursive: true });
  await writeFile(path.join(feature, "spec.md"), SPEC);
  for (const ticket of tickets) {
    await writeFile(path.join(feature, "issues", slugOf(ticket.number)), ticketText(ticket));
  }
  return feature;
}

// The checker accepts when no error starts with the ticket's file name and
// names Blocked by; other errors, such as Budget, are ignored.
async function checkerAccepts(feature, tickets) {
  const result = await checkFeatureDir(feature);
  const prefixes = tickets.map((ticket) => `issues/${slugOf(ticket.number)}:`);
  return !result.errors.some((error) => prefixes.some((prefix) => error.startsWith(prefix)) && error.includes("Blocked by"));
}

// The planner accepts when it does not throw.
async function plannerAccepts(feature) {
  try {
    await planTickets({ directory: feature });
    return true;
  } catch {
    return false;
  }
}

async function verdicts(tickets, overrides = {}) {
  const feature = await buildFeature(tickets);
  return {
    checker: await (overrides.checker ?? checkerAccepts)(feature, tickets),
    planner: await (overrides.planner ?? plannerAccepts)(feature, tickets),
  };
}

// Both scripts must give the same verdict, and it must be the expected one.
function assertAgreement(label, { checker, planner }, expected) {
  const name = (accepted) => (accepted ? "accepts" : "rejects");
  assert.equal(
    checker,
    planner,
    `${label}: the checker ${name(checker)} but the planner ${name(planner)}`,
  );
  assert.equal(planner, expected, `${label}: both scripts ${planner ? "accept" : "reject"}, expected both to ${expected ? "accept" : "reject"}`);
}

const ACCEPTED = [
  "01",
  "02, 01",
  "01: Export members",
  "# 01",
  "None",
  "None (can start immediately)",
  "01, Export members",
  "Export members",
  "01,",
  "01,,02",
  ",",
];

const REJECTED = [
  ["None, because X", "None, because X"],
  ["None.", "None."],
  ["a comma inside a reason", "01, 02 (reason, with a comma)"],
  ["an empty value", ""],
  ["a whitespace-only value", "   "],
  ["a title typo", "Export memebers"],
];

describe("Blocked by parity between the checker and the planner", () => {
  for (const value of ACCEPTED) {
    it(`both scripts accept ${JSON.stringify(value)}`, async () => {
      assertAgreement(JSON.stringify(value), await verdicts(topology(value)), true);
    });
  }

  for (const [label, value] of REJECTED) {
    it(`both scripts reject ${label}`, async () => {
      assertAgreement(label, await verdicts(topology(value)), false);
    });
  }

  it("both scripts reject a title that contains a comma, built by retitling ticket 01", async () => {
    const title = "Export, members";
    assertAgreement("comma title on 01", await verdicts(topology(title, { title1: title })), false);
  });

  it("both scripts reject a title that contains a comma, built by retitling ticket 02", async () => {
    const title = "CSV, download";
    assertAgreement("comma title on 02", await verdicts(topology(title, { title2: title })), false);
  });

  it("both scripts reject a duplicate title that resolves to a later ticket, so a first-wins checker fails", async () => {
    assertAgreement("duplicate title", await verdicts(duplicateTitleTopology()), false);
  });

  it("the agreement assertion fails when only one script rejects a row", async () => {
    const oneSided = await verdicts(topology("01"), { checker: async () => false });
    assert.deepEqual(oneSided, { checker: false, planner: true });
    assert.throws(() => assertAgreement("one-sided row", oneSided, true), /the checker rejects but the planner accepts/);

    const otherWay = await verdicts(topology("None."), { planner: async () => true });
    assert.deepEqual(otherWay, { checker: false, planner: true });
    assert.throws(() => assertAgreement("one-sided row", otherWay, false), /the checker rejects but the planner accepts/);
  });
});
