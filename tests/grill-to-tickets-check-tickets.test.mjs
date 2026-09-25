import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat, chmod, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

import * as checkTicketsModule from "../skills/agents/grill-to-tickets/scripts/check-tickets.mjs";

const {
  checkFeature,
  checkFeatureDir,
  estimateTokens,
  formatReport,
  parseReusePlan,
  parseStories,
  parseTicket,
  sectionOf,
} = checkTicketsModule;

const script = path.resolve("skills/agents/grill-to-tickets/scripts/check-tickets.mjs");
const run = promisify(execFile);

const spec = `# Spec

## User Stories

1. As an admin, I want to export members, so that I can audit them
1a. As an admin, I want the export to include roles, so that I can review access
2. As an admin, I want a CSV file, so that I can open it anywhere
3. As a member, I want my email hidden from non-admins, so that it stays private
   - a nested note that is not a story

## Implementation Decisions

4. Not a story: this list belongs to another section

### Reuse Plan

- **Use as-is:** \`formatDate\` → story 2
- **Create shared:** \`buildMemberRows(members): Row[]\` — pure — consumers: stories 1, 2
- **Promote:** none

## Testing Decisions
`;

// The measurement rule from the spec, applied by hand: ⌈ASCII code points ÷ 4⌉
// + non-ASCII code points.
function countTokens(text) {
  let ascii = 0;
  let nonAscii = 0;
  for (const character of text) {
    if (character.codePointAt(0) < 128) ascii += 1;
    else nonAscii += 1;
  }
  return Math.ceil(ascii / 4) + nonAscii;
}

// The Budget line the checker should measure for a ticket fixture.
function autoBudget(text, context, files = {}) {
  const sources = [text.split("\n").filter((line) => !line.startsWith("**Budget:**")).join("\n")];
  const modules = new Set();
  let allowance = 0;
  for (const item of (context ?? "").split("·").map((s) => s.trim()).filter(Boolean)) {
    const specRef = item.match(/^spec\s+§\s+(.+)$/);
    if (specRef) {
      const section = sectionOf(spec, specRef[1]);
      if (section?.text) sources.push(section.text);
      continue;
    }
    const marker = item.match(/^\((edit|new|from\s+\d+|edit\s+from\s+\d+)\)\s+(.+)$/);
    const norm = path.posix.normalize(marker ? marker[2].trim() : item);
    if (!marker || marker[1] === "edit") {
      const content = files[norm];
      if (typeof content === "string") sources.push(content);
    }
    if (marker && marker[1] !== "edit") allowance += 2000;
    if (marker && marker[1] !== "from") modules.add(path.posix.dirname(norm));
  }
  const tokens = countTokens(sources.join("\n")) + allowance;
  const criteria = text.split("\n").filter((line) => /^\s*- \[[ xX]\] /.test(line)).length;
  return `read ~${Math.round(tokens / 1000)}k tokens · ${criteria} criteria · ${modules.size} modules`;
}

function ticket(
  number,
  title,
  {
    blockedBy = "None (can start immediately)",
    reuse = "none",
    stories = "none",
    seam = "test boundary",
    context = "spec § User Stories",
    budget,
    files = {},
    extra = "",
  } = {},
) {
  const lines = [`# ${number}: ${title}`, "", "**What to build:** something end to end.", ""];
  if (blockedBy !== null) lines.push(`**Blocked by:** ${blockedBy}`, "");
  if (reuse !== null) lines.push(`**Reuse:** ${reuse}`, "");
  if (stories !== null) lines.push(`**Stories:** ${stories}`, "");
  if (seam !== null) lines.push(`**Seam:** ${seam}`, "");
  if (context !== null) lines.push(`**Context:** ${context}`, "");
  lines.push(extra, "**Status:** ready-for-agent", "", "- [ ] It works");
  const file = `${number}-${title.toLowerCase().replace(/\W+/g, "-")}.md`;
  if (budget === null) return { file, text: lines.join("\n") };
  const contextIndex = lines.findIndex((line) => line.startsWith("**Context:**"));
  const insertAt = contextIndex === -1 ? lines.length : contextIndex + 1;
  const withBudget = [...lines];
  withBudget.splice(insertAt, 0, "**Budget:** placeholder");
  const line = budget ?? autoBudget(withBudget.join("\n"), context, files);
  withBudget[insertAt] = `**Budget:** ${line}`;
  return { file, text: withBudget.join("\n") };
}

const passing = () => [
  ticket("01", "Export members", { reuse: "create-shared `buildMemberRows`", stories: "1, 1a" }),
  ticket("02", "CSV download", { blockedBy: "01", reuse: "use `buildMemberRows` · use `formatDate`", stories: "2" }),
  ticket("03", "Hide emails", { blockedBy: "01: Export members", stories: "3" }),
];

// A temporary project for the --write-budget file-replacement tests. Ticket 01
// has a stale Budget line and 02 has none, so --write-budget rewrites both. 03
// already carries its measured Budget line, or, with `contextError`, cannot be
// measured (its Context names a file that does not exist) and must be left
// alone. The project is removed when `body` settles.
async function withBudgetProject(body, { contextError = false } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "check-tickets-replace-"));
  const dir = path.join(root, ".scratch", "export-feature");
  const issuesDir = path.join(dir, "issues");
  try {
    await mkdir(issuesDir, { recursive: true });
    await writeFile(path.join(dir, "spec.md"), spec);
    const tickets = [
      ticket("01", "Export members", {
        reuse: "create-shared `buildMemberRows`",
        stories: "1, 1a",
        budget: "read ~99k tokens · 9 criteria · 9 modules",
      }),
      ticket("02", "CSV download", {
        blockedBy: "01",
        reuse: "use `buildMemberRows` · use `formatDate`",
        stories: "2",
        context: "spec § User Stories · (new) src/csv.mjs",
        budget: null,
      }),
      ticket(
        "03",
        "Hide emails",
        contextError
          ? { blockedBy: "01", stories: "3", context: "spec § User Stories · src/absent.mjs", budget: null }
          : { blockedBy: "01", stories: "3" },
      ),
    ];
    for (const { file, text } of tickets) await writeFile(path.join(issuesDir, file), text);
    return await body({ dir, issuesDir, tickets, ticketPath: (t) => path.join(issuesDir, t.file) });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const budgetLinesOf = (text) => text.split("\n").filter((line) => line.startsWith("**Budget:**"));
const withoutBudgetLines = (text) => text.split("\n").filter((line) => !line.startsWith("**Budget:**"));

describe("check-tickets", () => {
  it("reads numbered stories, lettered ones included, from the User Stories section only", () => {
    assert.deepEqual(parseStories(spec), ["1", "1a", "2", "3"]);
  });

  it("passes a ticket set that covers every story and keeps every rule", () => {
    const result = checkFeature({ spec, tickets: passing() });
    assert.deepEqual(result.errors, []);
    assert.deepEqual([...result.coverage], [["1", [1]], ["1a", [1]], ["2", [2]], ["3", [3]]]);
  });

  it("flags a story no ticket delivers and a ticket naming a story the spec lacks", () => {
    const tickets = passing();
    tickets[2] = ticket("03", "Hide emails", { blockedBy: "01", stories: "9" });
    const { errors } = checkFeature({ spec, tickets });
    assert.ok(errors.includes("story 3 has no ticket"), errors.join("\n"));
    assert.ok(errors.some((e) => /03-hide-emails\.md: Stories story 9 is not defined/.test(e)), errors.join("\n"));
  });

  it("expands a story range and notes a ticket that delivers no story", () => {
    const tickets = [
      ticket("01", "Prefactor rows"),
      ticket("02", "Everything", { blockedBy: "01", reuse: "create-shared `buildMemberRows`", stories: "1-3" }),
    ];
    const result = checkFeature({ spec, tickets });
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.coverage.get("1a"), [2]);
    assert.ok(result.notes.some((n) => /01-prefactor-rows\.md delivers no story/.test(n)));
  });

  it("requires Blocked by entries to exist and to be lower-numbered", () => {
    const tickets = passing();
    tickets[0] = ticket("01", "Export members", { blockedBy: "02", reuse: "none", stories: "1, 1a" });
    tickets[1] = ticket("02", "CSV download", { blockedBy: "07", stories: "2" });
    const { errors } = checkFeature({ spec, tickets });
    assert.ok(errors.some((e) => /01-export-members\.md: Blocked by 02; a blocker must have a lower number/.test(e)));
    assert.ok(errors.some((e) => /02-csv-download\.md: Blocked by 07, which does not exist/.test(e)));
  });

  it("resolves a blocker written as a title and rejects one that matches no ticket", () => {
    const tickets = passing();
    tickets[2] = ticket("03", "Hide emails", { blockedBy: "Export members", stories: "3" });
    assert.deepEqual(checkFeature({ spec, tickets }).errors, []);
    tickets[2] = ticket("03", "Hide emails", { blockedBy: "Import members", stories: "3" });
    assert.ok(checkFeature({ spec, tickets }).errors.some((e) => /Blocked by "Import members" matches no ticket/.test(e)));
  });

  it("requires Reuse directly after Blocked by, with only the fixed verbs", () => {
    const tickets = passing();
    tickets[1] = ticket("02", "CSV download", { blockedBy: "01", reuse: null, stories: "2" });
    tickets[2] = ticket("03", "Hide emails", { blockedBy: "01", reuse: "reuse `maskEmail`", stories: "3" });
    const { errors } = checkFeature({ spec, tickets });
    assert.ok(errors.some((e) => /02-csv-download\.md: \*\*Reuse:\*\* is missing/.test(e)));
    assert.ok(errors.some((e) => /03-hide-emails\.md: Reuse "reuse" is not a Reuse verb/.test(e)));

    const misplaced = passing();
    misplaced[2] = ticket("03", "Hide emails", { blockedBy: "01", reuse: null, stories: "3", extra: "**Reuse:** none\n" });
    assert.ok(
      checkFeature({ spec, tickets: misplaced }).errors.some((e) => /must come directly after \*\*Blocked by:\*\*/.test(e)),
    );
  });

  it("gives each create-shared symbol one owner that blocks every other ticket using it", () => {
    const twoOwners = passing();
    twoOwners[1] = ticket("02", "CSV download", { blockedBy: "01", reuse: "create-shared `buildMemberRows`", stories: "2" });
    assert.ok(
      checkFeature({ spec, tickets: twoOwners }).errors.some((e) =>
        /create-shared `buildMemberRows` appears on tickets 01, 02/.test(e),
      ),
    );

    const unblocked = passing();
    unblocked[2] = ticket("03", "Hide emails", { reuse: "use `buildMemberRows`", stories: "3" });
    assert.ok(
      checkFeature({ spec, tickets: unblocked }).errors.some((e) =>
        /03-hide-emails\.md: uses `buildMemberRows`, so it must list its create-shared ticket 01/.test(e),
      ),
    );
  });

  it("reads the Reuse Plan's create-shared and promote entries by symbol", () => {
    const plan = parseReusePlan(spec.replace("- **Promote:** none", "- **Promote:** `useMemberFilters` → story 3"));
    assert.deepEqual(plan, { "create-shared": ["buildMemberRows"], promote: ["useMemberFilters"] });
  });

  it("requires a ticket for every create-shared and promote entry in the Reuse Plan", () => {
    const tickets = passing();
    tickets[0] = ticket("01", "Export members", { stories: "1, 1a" });
    tickets[1] = ticket("02", "CSV download", { blockedBy: "01", reuse: "use `formatDate`", stories: "2" });
    const { errors } = checkFeature({ spec, tickets });
    assert.ok(
      errors.includes('Reuse Plan create-shared `buildMemberRows` has no ticket carrying "create-shared `buildMemberRows`"'),
      errors.join("\n"),
    );
  });

  it("applies the same ownership rule to promote", () => {
    const tickets = [
      ticket("01", "Promote row builder", { reuse: "promote `buildRows`", stories: "1, 1a" }),
      ticket("02", "CSV download", { reuse: "use `buildRows`", stories: "2, 3" }),
    ];
    assert.ok(
      checkFeature({ spec, tickets }).errors.some((e) => /uses `buildRows`, so it must list its promote ticket 01/.test(e)),
    );
  });

  it("rejects badly named ticket files and headings that disagree with them", () => {
    const tickets = [...passing(), { file: "notes.md", text: "# scratch" }];
    tickets[0] = { file: tickets[0].file, text: tickets[0].text.replace("# 01:", "# 04:") };
    const { errors } = checkFeature({ spec, tickets });
    assert.ok(errors.includes("issues/notes.md: file name must be NN-<slug>.md"));
    assert.ok(errors.some((e) => /heading number 4 differs from the file number/.test(e)));
  });

  it("runs as a CLI: exit 0 with a coverage table when clean, 1 with errors, 2 without issues/ or without .scratch ancestor", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "check-tickets-"));
    const dir = path.join(root, ".scratch", "export-feature");
    try {
      await mkdir(path.join(dir, "issues"), { recursive: true });
      await writeFile(path.join(dir, "spec.md"), spec);
      for (const { file, text } of passing()) await writeFile(path.join(dir, "issues", file), text);
      const clean = await run("node", [script, dir]);
      assert.match(clean.stdout, /story coverage:\n  1 → 01\n  1a → 01\n  2 → 02\n  3 → 03/);
      assert.match(clean.stdout, /result: PASS/);

      await rm(path.join(dir, "issues", passing()[2].file));
      await assert.rejects(run("node", [script, dir]), (error) => {
        assert.equal(error.code, 1);
        assert.match(error.stdout, /story 3 has no ticket/);
        assert.match(error.stdout, /result: FAIL \(1 error\)/);
        return true;
      });

      await assert.rejects(run("node", [script, path.join(dir, "missing")]), (error) => error.code === 2);

      // Without .scratch ancestor, CLI exits 2
      const outside = path.join(root, "not-scratch", "feature");
      await mkdir(outside, { recursive: true });
      await assert.rejects(run("node", [script, outside]), (error) => error.code === 2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  // --- Acceptance Criteria 1: ticket-format.md definitions ---
  it("ticket-format.md documents Seam, Context's six forms, field order, and single-line rules", async () => {
    const tfPath = path.resolve("skills/agents/grill-to-tickets/references/ticket-format.md");
    const content = await readFile(tfPath, "utf8");

    // Seam definition and position
    assert.match(content, /\*\*Seam:\*\*/);
    assert.match(content, /Testing Decisions/i);
    assert.match(content, /directly after `?\*\*Stories:\*\*`?/i);

    // Context definition and position
    assert.match(content, /\*\*Context:\*\*/);
    assert.match(content, /directly after `?\*\*Seam:\*\*`?/i);
    assert.match(content, /spec § <ref>/);
    assert.match(content, /\(edit\)/);
    assert.match(content, /\(new\)/);
    assert.match(content, /\(from NN\)/);
    assert.match(content, /\(edit from NN\)/);

    // Template includes Seam and Context in order
    const templateMatch = content.slice(content.indexOf("## Local Ticket Template"));
    assert.match(templateMatch, /\*\*Stories:\*\*[\s\S]*?\*\*Seam:\*\*[\s\S]*?\*\*Context:\*\*/);
  });

  // --- Acceptance Criteria 2: parseTicket line index & checkFeature Seam and Context validation ---
  it("records lineIndex for each field in parseTicket", () => {
    const t = ticket("01", "Export");
    const parsed = parseTicket(t.file, t.text);
    const seamField = parsed.fields.find((f) => f.name === "Seam");
    const contextField = parsed.fields.find((f) => f.name === "Context");
    assert.ok(typeof seamField.lineIndex === "number");
    assert.ok(typeof contextField.lineIndex === "number");
    const lines = t.text.split("\n");
    assert.equal(lines[seamField.lineIndex], `**Seam:** ${seamField.value}`);
    assert.equal(lines[contextField.lineIndex], `**Context:** ${contextField.value}`);
  });

  it("checkFeature errors on Seam missing, empty, repeated, out of order, or followed directly by non-field line", () => {
    // Missing
    const missing = passing();
    missing[0] = ticket("01", "Export members", { reuse: "create-shared `buildMemberRows`", stories: "1, 1a", seam: null });
    const resMissing = checkFeature({ spec, tickets: missing });
    assert.ok(resMissing.errors.some((e) => /01-export-members\.md: \*\*Seam:\*\* is missing/.test(e)), resMissing.errors.join("\n"));

    // Empty
    const empty = passing();
    empty[0] = ticket("01", "Export members", { reuse: "create-shared `buildMemberRows`", stories: "1, 1a", seam: "   " });
    const resEmpty = checkFeature({ spec, tickets: empty });
    assert.ok(resEmpty.errors.some((e) => /01-export-members\.md: \*\*Seam:\*\* is empty/.test(e)), resEmpty.errors.join("\n"));

    // Repeated
    const repeated = passing();
    repeated[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      extra: "**Seam:** duplicate seam boundary\n",
    });
    const resRepeated = checkFeature({ spec, tickets: repeated });
    assert.ok(resRepeated.errors.some((e) => /01-export-members\.md: \*\*Seam:\*\* is repeated/.test(e)), resRepeated.errors.join("\n"));

    // Out of order: Seam before Stories
    const outOfOrder = passing();
    outOfOrder[0] = {
      file: outOfOrder[0].file,
      text: [
        "# 01: Export members",
        "",
        "**What to build:** something.",
        "",
        "**Blocked by:** None (can start immediately)",
        "",
        "**Reuse:** create-shared `buildMemberRows`",
        "",
        "**Seam:** test boundary",
        "",
        "**Stories:** 1, 1a",
        "",
        "**Context:** spec § User Stories",
        "",
        "**Status:** ready-for-agent",
        "",
        "- [ ] Task",
      ].join("\n"),
    };
    const resOrder = checkFeature({ spec, tickets: outOfOrder });
    assert.ok(
      resOrder.errors.some((e) => /01-export-members\.md: \*\*Seam:\*\* must come directly after \*\*Stories:\*\*/.test(e)),
      resOrder.errors.join("\n"),
    );

    // Followed directly by non-blank non-field line
    const followedNonField = passing();
    followedNonField[0] = {
      file: followedNonField[0].file,
      text: [
        "# 01: Export members",
        "",
        "**What to build:** something.",
        "",
        "**Blocked by:** None (can start immediately)",
        "",
        "**Reuse:** create-shared `buildMemberRows`",
        "",
        "**Stories:** 1, 1a",
        "",
        "**Seam:** test boundary",
        "this is an invalid continuation line",
        "",
        "**Context:** spec § User Stories",
        "",
        "**Status:** ready-for-agent",
        "",
        "- [ ] Task",
      ].join("\n"),
    };
    const resFollowed = checkFeature({ spec, tickets: followedNonField });
    assert.ok(
      resFollowed.errors.some((e) => /01-export-members\.md: \*\*Seam:\*\* is followed directly by a non-field line/.test(e)),
      resFollowed.errors.join("\n"),
    );
  });

  it("checkFeature errors on Context missing, empty, repeated, out of order, or followed directly by non-field line", () => {
    // Missing
    const missing = passing();
    missing[0] = ticket("01", "Export members", { reuse: "create-shared `buildMemberRows`", stories: "1, 1a", context: null });
    const resMissing = checkFeature({ spec, tickets: missing });
    assert.ok(resMissing.errors.some((e) => /01-export-members\.md: \*\*Context:\*\* is missing/.test(e)), resMissing.errors.join("\n"));

    // Empty
    const empty = passing();
    empty[0] = ticket("01", "Export members", { reuse: "create-shared `buildMemberRows`", stories: "1, 1a", context: "   " });
    const resEmpty = checkFeature({ spec, tickets: empty });
    assert.ok(resEmpty.errors.some((e) => /01-export-members\.md: \*\*Context:\*\* is empty/.test(e)), resEmpty.errors.join("\n"));

    // Repeated
    const repeated = passing();
    repeated[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      extra: "**Context:** spec § User Stories\n",
    });
    const resRepeated = checkFeature({ spec, tickets: repeated });
    assert.ok(resRepeated.errors.some((e) => /01-export-members\.md: \*\*Context:\*\* is repeated/.test(e)), resRepeated.errors.join("\n"));

    // Out of order: Context before Seam
    const outOfOrder = passing();
    outOfOrder[0] = {
      file: outOfOrder[0].file,
      text: [
        "# 01: Export members",
        "",
        "**What to build:** something.",
        "",
        "**Blocked by:** None (can start immediately)",
        "",
        "**Reuse:** create-shared `buildMemberRows`",
        "",
        "**Stories:** 1, 1a",
        "",
        "**Context:** spec § User Stories",
        "",
        "**Seam:** test boundary",
        "",
        "**Status:** ready-for-agent",
        "",
        "- [ ] Task",
      ].join("\n"),
    };
    const resOrder = checkFeature({ spec, tickets: outOfOrder });
    assert.ok(
      resOrder.errors.some((e) => /01-export-members\.md: \*\*Context:\*\* must come directly after \*\*Seam:\*\*/.test(e)),
      resOrder.errors.join("\n"),
    );

    // Followed directly by non-blank non-field line
    const followedNonField = passing();
    followedNonField[0] = {
      file: followedNonField[0].file,
      text: [
        "# 01: Export members",
        "",
        "**What to build:** something.",
        "",
        "**Blocked by:** None (can start immediately)",
        "",
        "**Reuse:** create-shared `buildMemberRows`",
        "",
        "**Stories:** 1, 1a",
        "",
        "**Seam:** test boundary",
        "",
        "**Context:** spec § User Stories",
        "invalid wrapping line",
        "",
        "**Status:** ready-for-agent",
        "",
        "- [ ] Task",
      ].join("\n"),
    };
    const resFollowed = checkFeature({ spec, tickets: followedNonField });
    assert.ok(
      resFollowed.errors.some((e) => /01-export-members\.md: \*\*Context:\*\* is followed directly by a non-field line/.test(e)),
      resFollowed.errors.join("\n"),
    );
  });

  // --- Acceptance Criteria 3: sectionOf and spec § refs ---
  it("sectionOf extracts section text by heading, ignoring fenced code, exact and case-sensitive", () => {
    const md = [
      "# Doc Title",
      "",
      "```markdown",
      "## Ignored In Code",
      "```",
      "",
      "## Section One ###",
      "Content of section one.",
      "",
      "### Subsection A",
      "Sub content.",
      "",
      "## Section Two",
      "Content of section two.",
    ].join("\n");

    // Exact heading match spans to next heading of same or higher level
    const sec1 = sectionOf(md, "Section One");
    assert.ok(sec1?.text);
    assert.ok(sec1?.text.includes("## Section One ###"));
    assert.ok(sec1?.text.includes("### Subsection A"));
    assert.ok(sec1?.text.includes("Sub content."));
    assert.ok(!sec1?.text.includes("## Section Two"));

    // Subsection spans to next heading of level <= 3 (Section Two is level 2)
    const subA = sectionOf(md, "Subsection A");
    assert.ok(subA?.text);
    assert.ok(subA?.text.includes("### Subsection A"));
    assert.ok(!subA?.text.includes("## Section Two"));

    // Headings inside fenced code are ignored
    const ignored = sectionOf(md, "Ignored In Code");
    assert.deepEqual(ignored, { error: "missing" });

    // Case sensitive
    assert.deepEqual(sectionOf(md, "section one"), { error: "missing" });
  });

  it("sectionOf matches qualified refs in ancestor order, not necessarily directly", () => {
    const md = [
      "# Root",
      "## Area A",
      "### Seam",
      "seam A",
      "## Area B",
      "### Nested",
      "#### Seam",
      "seam B",
    ].join("\n");

    // Unqualified "Seam" is ambiguous
    assert.deepEqual(sectionOf(md, "Seam"), { error: "ambiguous" });

    // Qualified matches direct ancestor
    const resA = sectionOf(md, "Area A › Seam");
    assert.ok(resA?.text);
    assert.ok(resA?.text.includes("seam A"));

    // Qualified matches ancestor not directly adjacent (Root › Seam matches Area B's Seam because Root is ancestor of both, but if disambiguated with Area B › Seam)
    const resB = sectionOf(md, "Area B › Seam");
    assert.ok(resB?.text);
    assert.ok(resB?.text.includes("seam B"));

    // Ancestor order mismatch
    assert.deepEqual(sectionOf(md, "Seam › Area A"), { error: "missing" });
  });

  it("checkFeature errors on missing and ambiguous spec § refs", () => {
    const tickets = passing();
    tickets[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      context: "spec § Missing Section",
    });
    const resMissing = checkFeature({ spec, tickets });
    assert.ok(
      resMissing.errors.some((e) => /01-export-members\.md: Context spec § Missing Section matches no heading in spec\.md/.test(e)),
      resMissing.errors.join("\n"),
    );

    const ambiguousSpec = `${spec}\n## User Stories\nDuplicate section\n`;
    const resAmbiguous = checkFeature({ spec: ambiguousSpec, tickets: passing() });
    assert.ok(
      resAmbiguous.errors.some((e) => /Context spec § User Stories is ambiguous/.test(e)),
      resAmbiguous.errors.join("\n"),
    );
  });

  // --- Acceptance Criteria 4: checkFeature Context path rules ---
  it("checkFeature errors on plain or (edit) path absent, and (new) path already existing", () => {
    // Plain absent
    const tPlain = passing();
    tPlain[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      context: "spec § User Stories · src/absent.mjs",
    });
    const resPlain = checkFeature({ spec, tickets: tPlain, files: {} });
    assert.ok(
      resPlain.errors.some((e) => /01-export-members\.md: Context path "src\/absent\.mjs" does not exist/.test(e)),
      resPlain.errors.join("\n"),
    );

    // (edit) absent
    const tEdit = passing();
    tEdit[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      context: "spec § User Stories · (edit) src/absent.mjs",
    });
    const resEdit = checkFeature({ spec, tickets: tEdit, files: {} });
    assert.ok(
      resEdit.errors.some((e) => /01-export-members\.md: Context \(edit\) path "src\/absent\.mjs" does not exist/.test(e)),
      resEdit.errors.join("\n"),
    );

    // (new) already existing
    const tNew = passing();
    tNew[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      context: "spec § User Stories · (new) src/exists.mjs",
    });
    const resNew = checkFeature({ spec, tickets: tNew, files: { "src/exists.mjs": "content" } });
    assert.ok(
      resNew.errors.some((e) => /01-export-members\.md: Context \(new\) path "src\/exists\.mjs" already exists/.test(e)),
      resNew.errors.join("\n"),
    );
  });

  it("checkFeature errors when two tickets mark the same path (new)", () => {
    const tickets = passing();
    tickets[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      context: "spec § User Stories · (new) src/dup.mjs",
    });
    tickets[1] = ticket("02", "CSV download", {
      blockedBy: "01",
      reuse: "use `buildMemberRows` · use `formatDate`",
      stories: "2",
      context: "spec § User Stories · (new) src/dup.mjs",
    });
    const res = checkFeature({ spec, tickets, files: {} });
    assert.ok(
      res.errors.some((e) => /two tickets.*mark.*src\/dup\.mjs.*\(new\)|Context path "src\/dup\.mjs" is marked \(new\) by multiple tickets/.test(e)),
      res.errors.join("\n"),
    );
  });

  it("checkFeature errors on path that is absolute, escapes root, or maps to directory", () => {
    // Absolute
    const tAbs = passing();
    tAbs[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      context: "spec § User Stories · /var/log/app.log",
    });
    const resAbs = checkFeature({ spec, tickets: tAbs, files: {} });
    assert.ok(
      resAbs.errors.some((e) => /01-export-members\.md: Context path "\/var\/log\/app\.log" is absolute/.test(e)),
      resAbs.errors.join("\n"),
    );

    // Escapes root
    const tEscape = passing();
    tEscape[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      context: "spec § User Stories · ../escape.mjs",
    });
    const resEscape = checkFeature({ spec, tickets: tEscape, files: {} });
    assert.ok(
      resEscape.errors.some((e) => /01-export-members\.md: Context path "\.\.\/escape\.mjs" escapes the project root/.test(e)),
      resEscape.errors.join("\n"),
    );

    // Directory
    const tDir = passing();
    tDir[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      context: "spec § User Stories · src",
    });
    const resDir = checkFeature({ spec, tickets: tDir, files: { src: { directory: true } } });
    assert.ok(
      resDir.errors.some((e) => /01-export-members\.md: Context path "src" is a directory/.test(e)),
      resDir.errors.join("\n"),
    );
  });

  it("checkFeature errors on (from NN) and (edit from NN) when NN missing, not transitive blocker, or lacks (new)", () => {
    // NN missing
    const tMissingNN = passing();
    tMissingNN[1] = ticket("02", "CSV download", {
      blockedBy: "01",
      reuse: "use `buildMemberRows` · use `formatDate`",
      stories: "2",
      context: "spec § User Stories · (from 99) src/created.mjs",
    });
    const resMissing = checkFeature({ spec, tickets: tMissingNN, files: {} });
    assert.ok(
      resMissing.errors.some((e) => /Context \(from 99\).*ticket 99.*does not exist/.test(e)),
      resMissing.errors.join("\n"),
    );

    // NN is not a transitive blocker
    const tNotBlocker = passing();
    tNotBlocker[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      context: "spec § User Stories · (new) src/created.mjs",
    });
    // Ticket 03 is blocked by nothing
    tNotBlocker[2] = ticket("03", "Hide emails", {
      blockedBy: "None (can start immediately)",
      stories: "3",
      context: "spec § User Stories · (from 01) src/created.mjs",
    });
    const resNotBlocker = checkFeature({ spec, tickets: tNotBlocker, files: {} });
    assert.ok(
      resNotBlocker.errors.some((e) => /Context \(from 01\).*ticket 01.*not a transitive blocker/.test(e)),
      resNotBlocker.errors.join("\n"),
    );

    // NN lacks (new) for that path (e.g. NN marks it (edit))
    const tLacksNew = passing();
    tLacksNew[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      context: "spec § User Stories · (edit) src/created.mjs",
      files: { "src/created.mjs": "content" },
    });
    tLacksNew[1] = ticket("02", "CSV download", {
      blockedBy: "01",
      reuse: "use `buildMemberRows` · use `formatDate`",
      stories: "2",
      context: "spec § User Stories · (from 01) src/created.mjs",
    });
    const resLacksNew = checkFeature({
      spec,
      tickets: tLacksNew,
      files: { "src/created.mjs": "content" },
    });
    assert.ok(
      resLacksNew.errors.some((e) => /Context \(from 01\).*ticket 01.*does not mark "src\/created\.mjs" as \(new\)/.test(e)),
      resLacksNew.errors.join("\n"),
    );

    // Same checks for (edit from NN)
    const tEditFrom = passing();
    tEditFrom[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      context: "spec § User Stories · (new) src/created.mjs",
    });
    tEditFrom[1] = ticket("02", "CSV download", {
      blockedBy: "01",
      reuse: "use `buildMemberRows` · use `formatDate`",
      stories: "2",
      context: "spec § User Stories · (edit from 01) src/created.mjs",
    });
    const resEditFromValid = checkFeature({ spec, tickets: tEditFrom, files: {} });
    assert.deepEqual(resEditFromValid.errors, []);
  });

  it("checkFeature normalises paths with path.posix.normalize and counts missing file as null", () => {
    const tickets = passing();
    tickets[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      context: "spec § User Stories · ./src/foo/../utils.mjs",
      files: { "src/utils.mjs": "export const x = 1;" },
    });
    const res = checkFeature({ spec, tickets, files: { "src/utils.mjs": "export const x = 1;" } });
    assert.deepEqual(res.errors, []);
  });

  // --- Acceptance Criteria 5: checkFeatureDir root resolution and file reads ---
  it("checkFeatureDir resolves project root as parent of nearest .scratch ancestor and reads Context files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "check-tickets-featuredir-"));
    const dir = path.join(root, ".scratch", "my-slug");
    try {
      await mkdir(path.join(dir, "issues"), { recursive: true });
      await mkdir(path.join(root, "src"), { recursive: true });
      await writeFile(path.join(dir, "spec.md"), spec);
      await writeFile(path.join(root, "src", "code.mjs"), "console.log(1);");

      const t = passing();
      t[0] = ticket("01", "Export members", {
        reuse: "create-shared `buildMemberRows`",
        stories: "1, 1a",
        context: "spec § User Stories · src/code.mjs",
        files: { "src/code.mjs": "console.log(1);" },
      });
      for (const { file, text } of t) await writeFile(path.join(dir, "issues", file), text);

      const res = await checkFeatureDir(dir);
      assert.deepEqual(res.errors, []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("checkFeatureDir rejects when there is no .scratch ancestor", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "check-tickets-noscratch-"));
    const dir = path.join(root, "some-dir", "my-slug");
    try {
      await mkdir(dir, { recursive: true });
      await assert.rejects(checkFeatureDir(dir), /cannot find \.scratch ancestor/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("checkFeatureDir reads a Context item that begins with spec § but is not a spec reference as a plain path, and reads spec § <heading> as a spec section only", async () => {
    // No space after the §, so this is a file name, not a spec reference.
    const notSpec = "spec §nospace";
    const specRef = "spec § User Stories";
    const body = "x".repeat(4000);

    // A temporary project holding `rootFiles` at its root and a ticket 01 whose
    // Context line is `context`; the Budget lines are measured by the test
    // helper from those same files, so only a real disagreement is an error.
    const check = async (context, rootFiles) => {
      const root = await mkdtemp(path.join(os.tmpdir(), "check-tickets-specname-"));
      const dir = path.join(root, ".scratch", "my-slug");
      try {
        await mkdir(path.join(dir, "issues"), { recursive: true });
        await writeFile(path.join(dir, "spec.md"), spec);
        for (const [name, text] of Object.entries(rootFiles)) await writeFile(path.join(root, name), text);

        const t = passing();
        t[0] = ticket("01", "Export members", {
          reuse: "create-shared `buildMemberRows`",
          stories: "1, 1a",
          context,
          files: rootFiles,
        });
        for (const { file, text } of t) await writeFile(path.join(dir, "issues", file), text);

        const res = await checkFeatureDir(dir);
        return { errors: res.errors, tokens: res.budgets[0].tokens };
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    };

    // Control: with the file absent, the plain path does not exist.
    const absent = await check(`spec § User Stories · ${notSpec}`, {});
    assert.deepEqual(absent.errors, [`issues/01-export-members.md: Context path "${notSpec}" does not exist`]);

    // With the file present, it exists, and its text is read into the ticket's tokens.
    const present = await check(`spec § User Stories · ${notSpec}`, { [notSpec]: body });
    assert.ok(
      !present.errors.some((e) => e.includes("does not exist")),
      `false "does not exist" for an existing file:\n${present.errors.join("\n")}`,
    );
    assert.deepEqual(present.errors, []);
    assert.ok(
      present.tokens - absent.tokens >= estimateTokens(body),
      `the file's ${estimateTokens(body)} tokens are not counted: ${absent.tokens} without it, ${present.tokens} with it`,
    );

    // The properly written spec form is a spec section, never a file: a file of
    // that exact name at the project root changes neither the errors nor the tokens.
    const withoutDecoy = await check(specRef, {});
    const withDecoy = await check(specRef, { [specRef]: body });
    assert.deepEqual(withoutDecoy.errors, []);
    assert.deepEqual(withDecoy.errors, []);
    assert.equal(withDecoy.tokens, withoutDecoy.tokens);
  });

  // --- Budget measurement: estimateTokens and checkFeature ---
  it("estimateTokens counts ASCII code points at one per four plus one per non-ASCII code point", () => {
    assert.equal(typeof checkTicketsModule.estimateTokens, "function");
    assert.equal(estimateTokens(""), 0);
    assert.equal(estimateTokens("abcd"), 1);
    assert.equal(estimateTokens("abcde"), 2);
    // 6 ASCII + 3 Thai: ⌈6 ÷ 4⌉ + 3 = 5
    assert.equal(estimateTokens("abcdefกขค"), 5);
    // a surrogate pair is one code point, not two UTF-16 units
    assert.equal(estimateTokens("a😀"), 2);
  });

  it("checkFeature measures read tokens over the ticket, its spec sections, and its read or (edit) files, with an allowance for absent files", () => {
    const budgetSpec = [
      "# Budget Spec",
      "",
      "## User Stories",
      "",
      "1. A story",
      "",
      "## Later",
      "",
      "later text",
    ].join("\n");
    const section = sectionOf(budgetSpec, "User Stories").text;
    const files = { "src/read.mjs": "export const read = 1;\n", "src/edit.mjs": "export const edit = 2;\n" };
    const t1 = [
      "# 01: Measure",
      "",
      "**Blocked by:** none",
      "**Reuse:** none",
      "**Stories:** 1",
      "**Seam:** test boundary",
      "**Context:** spec § User Stories · src/read.mjs · (edit) src/edit.mjs",
      "**Status:** ready-for-agent",
      "",
      "- [ ] first",
      "- [x] second",
    ].join("\n");
    const t2 = [
      "# 02: Create",
      "",
      "**Blocked by:** 01",
      "**Reuse:** none",
      "**Stories:** 1",
      "**Seam:** test boundary",
      "**Context:** spec § User Stories · (new) lib/created.mjs",
      "**Status:** ready-for-agent",
      "",
      "- [ ] only",
    ].join("\n");
    const t3 = [
      "# 03: Edit created",
      "",
      "**Blocked by:** 02",
      "**Reuse:** none",
      "**Stories:** 1",
      "**Seam:** test boundary",
      "**Context:** spec § User Stories · (edit from 02) lib/created.mjs",
      "**Status:** ready-for-agent",
      "",
      "- [ ] only",
    ].join("\n");

    const result = checkFeature({
      spec: budgetSpec,
      tickets: [
        { file: "01-measure.md", text: t1 },
        { file: "02-create.md", text: t2 },
        { file: "03-edit-created.md", text: t3 },
      ],
      files,
    });

    const expected = [
      countTokens([t1, section, files["src/read.mjs"], files["src/edit.mjs"]].join("\n")),
      countTokens([t2, section].join("\n")) + 2000,
      countTokens([t3, section].join("\n")) + 2000,
    ];
    assert.ok(Array.isArray(result.budgets), "checkFeature returns a budgets array");
    assert.deepEqual(
      result.budgets.map((b) => [b.number, b.tokens, b.criteria, b.modules, b.line]),
      [
        [1, expected[0], 2, 1, `read ~${Math.round(expected[0] / 1000)}k tokens · 2 criteria · 1 modules`],
        [2, expected[1], 1, 1, `read ~${Math.round(expected[1] / 1000)}k tokens · 1 criteria · 1 modules`],
        [3, expected[2], 1, 1, `read ~${Math.round(expected[2] / 1000)}k tokens · 1 criteria · 1 modules`],
      ],
    );
  });

  it("checkFeature errors on a Budget line that is missing, repeated, out of order, or followed by a non-field line", () => {
    const missing = passing();
    missing[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      budget: null,
    });
    const resMissing = checkFeature({ spec, tickets: missing });
    assert.ok(
      resMissing.errors.some((e) => /01-export-members\.md: \*\*Budget:\*\* is missing/.test(e)),
      resMissing.errors.join("\n"),
    );

    const empty = passing();
    empty[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      budget: "",
    });
    const resEmpty = checkFeature({ spec, tickets: empty });
    assert.ok(
      resEmpty.errors.some((e) => /01-export-members\.md: \*\*Budget:\*\* is empty/.test(e)),
      resEmpty.errors.join("\n"),
    );

    const repeated = passing();
    repeated[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      extra: "**Budget:** read ~1k tokens · 1 criteria · 1 modules\n",
    });
    const resRepeated = checkFeature({ spec, tickets: repeated });
    assert.ok(
      resRepeated.errors.some((e) => /01-export-members\.md: \*\*Budget:\*\* is repeated/.test(e)),
      resRepeated.errors.join("\n"),
    );

    const outOfOrder = passing();
    outOfOrder[0] = {
      file: "01-export-members.md",
      text: [
        "# 01: Export members",
        "",
        "**Blocked by:** None (can start immediately)",
        "**Reuse:** create-shared `buildMemberRows`",
        "**Stories:** 1, 1a",
        "**Seam:** test boundary",
        "**Budget:** read ~1k tokens · 1 criteria · 1 modules",
        "**Context:** spec § User Stories",
        "**Status:** ready-for-agent",
        "",
        "- [ ] It works",
      ].join("\n"),
    };
    const resOrder = checkFeature({ spec, tickets: outOfOrder });
    assert.ok(
      resOrder.errors.some((e) => /01-export-members\.md: \*\*Budget:\*\* must come directly after \*\*Context:\*\*/.test(e)),
      resOrder.errors.join("\n"),
    );

    const followedNonField = passing();
    followedNonField[0] = {
      file: "01-export-members.md",
      text: [
        "# 01: Export members",
        "",
        "**Blocked by:** None (can start immediately)",
        "**Reuse:** create-shared `buildMemberRows`",
        "**Stories:** 1, 1a",
        "**Seam:** test boundary",
        "**Context:** spec § User Stories",
        "**Budget:** read ~1k tokens · 1 criteria · 0 modules",
        "a wrapping line",
        "**Status:** ready-for-agent",
        "",
        "- [ ] It works",
      ].join("\n"),
    };
    const resFollowed = checkFeature({ spec, tickets: followedNonField });
    assert.ok(
      resFollowed.errors.some((e) => /01-export-members\.md: \*\*Budget:\*\* is followed directly by a non-field line/.test(e)),
      resFollowed.errors.join("\n"),
    );
  });

  it("checkFeature errors on a malformed, unmeasured, or differing Budget line, but skips differs for Context errors", () => {
    const malformed = passing();
    malformed[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      budget: "about twenty thousand tokens",
    });
    const resMalformed = checkFeature({ spec, tickets: malformed });
    assert.ok(
      resMalformed.errors.some((e) => /01-export-members\.md: \*\*Budget:\*\* is malformed/.test(e)),
      resMalformed.errors.join("\n"),
    );

    const unmeasured = passing();
    unmeasured[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      budget: "unmeasured",
    });
    const resUnmeasured = checkFeature({ spec, tickets: unmeasured });
    assert.ok(
      resUnmeasured.errors.some((e) => /01-export-members\.md: \*\*Budget:\*\* is unmeasured/.test(e)),
      resUnmeasured.errors.join("\n"),
    );

    const stale = passing();
    stale[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      budget: "read ~99k tokens · 1 criteria · 0 modules",
    });
    const resStale = checkFeature({ spec, tickets: stale });
    assert.ok(
      resStale.errors.some((e) =>
        /01-export-members\.md: \*\*Budget:\*\* read ~99k tokens · 1 criteria · 0 modules differs from the measurement/.test(e),
      ),
      resStale.errors.join("\n"),
    );

    const contextErrors = passing();
    contextErrors[0] = ticket("01", "Export members", {
      reuse: "create-shared `buildMemberRows`",
      stories: "1, 1a",
      context: "spec § User Stories · src/absent.mjs",
      budget: "read ~99k tokens · 1 criteria · 0 modules",
    });
    const resSkipped = checkFeature({ spec, tickets: contextErrors, files: {} });
    assert.ok(
      resSkipped.errors.some((e) => /Context path "src\/absent\.mjs" does not exist/.test(e)),
      resSkipped.errors.join("\n"),
    );
    assert.ok(!resSkipped.errors.some((e) => /differs from the measurement/.test(e)), resSkipped.errors.join("\n"));
  });

  // --- --write-budget and the report's budget table ---
  it("--write-budget, in any argument position, rewrites every Budget line and then reports", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "check-tickets-budget-"));
    const dir = path.join(root, ".scratch", "export-feature");
    try {
      await mkdir(path.join(dir, "issues"), { recursive: true });
      await writeFile(path.join(dir, "spec.md"), spec);

      const tickets = passing();
      tickets[0] = ticket("01", "Export members", {
        reuse: "create-shared `buildMemberRows`",
        stories: "1, 1a",
        budget: "read ~99k tokens · 9 criteria · 9 modules",
      });
      tickets[1] = ticket("02", "CSV download", {
        blockedBy: "01",
        reuse: "use `buildMemberRows` · use `formatDate`",
        stories: "2",
        context: "spec § User Stories · (new) src/csv.mjs",
        budget: null,
      });
      for (const { file, text } of tickets) await writeFile(path.join(dir, "issues", file), text);

      const { stdout } = await run("node", [script, dir, "--write-budget"]);
      assert.match(stdout, /result: PASS/);

      const coverageIndex = stdout.indexOf("story coverage:");
      const budgetIndex = stdout.indexOf("budget:");
      assert.ok(coverageIndex !== -1 && budgetIndex > coverageIndex, stdout);
      assert.match(
        stdout,
        /budget:\n\s*ticket\s+read tokens\s+criteria\s+modules\n\s*01\s+\d+\s+1\s+0/,
        stdout,
      );

      const expected01 = autoBudget(tickets[0].text, "spec § User Stories");
      const written01 = await readFile(path.join(dir, "issues", tickets[0].file), "utf8");
      assert.deepEqual(
        written01.split("\n").filter((line) => line.startsWith("**Budget:**")),
        [`**Budget:** ${expected01}`],
      );

      const expected02 = autoBudget(tickets[1].text, "spec § User Stories · (new) src/csv.mjs");
      const written02 = await readFile(path.join(dir, "issues", tickets[1].file), "utf8");
      const lines02 = written02.split("\n");
      assert.equal(
        lines02[lines02.findIndex((line) => line.startsWith("**Context:**")) + 1],
        `**Budget:** ${expected02}`,
      );

      // The flag works in any argument position and a second run changes nothing.
      const again = await run("node", [script, "--write-budget", dir]);
      assert.match(again.stdout, /result: PASS/);
      assert.equal(await readFile(path.join(dir, "issues", tickets[0].file), "utf8"), written01);
      assert.equal(await readFile(path.join(dir, "issues", tickets[1].file), "utf8"), written02);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("--write-budget leaves a ticket with Context errors unchanged", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "check-tickets-ctx-budget-"));
    const dir = path.join(root, ".scratch", "export-feature");
    try {
      await mkdir(path.join(dir, "issues"), { recursive: true });
      await writeFile(path.join(dir, "spec.md"), spec);

      const tickets = passing();
      tickets[0] = ticket("01", "Export members", {
        reuse: "create-shared `buildMemberRows`",
        stories: "1, 1a",
        budget: null,
      });
      tickets[2] = ticket("03", "Hide emails", {
        blockedBy: "01",
        stories: "3",
        context: "spec § User Stories · src/absent.mjs",
        budget: null,
      });
      for (const { file, text } of tickets) await writeFile(path.join(dir, "issues", file), text);

      const result = await checkFeatureDir(dir, { writeBudget: true });
      assert.ok(
        result.errors.some((e) => /03-hide-emails\.md: Context path "src\/absent\.mjs" does not exist/.test(e)),
        result.errors.join("\n"),
      );
      assert.ok(
        result.errors.some((e) => /03-hide-emails\.md: \*\*Budget:\*\* is missing/.test(e)),
        result.errors.join("\n"),
      );

      const written01 = await readFile(path.join(dir, "issues", tickets[0].file), "utf8");
      assert.match(written01, /\*\*Budget:\*\* read ~\d+k tokens · 1 criteria · 0 modules/);
      const written03 = await readFile(path.join(dir, "issues", tickets[2].file), "utf8");
      assert.equal(written03, tickets[2].text);
      assert.ok(!written03.includes("**Budget:**"), written03);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  // --- --write-budget replaces a ticket file atomically ---
  // Tickets live under the git-ignored .scratch/, so a write interrupted
  // half-way must not truncate one: the new text goes to a temporary file that
  // is renamed over the ticket, which gives the ticket a new inode.
  it("--write-budget replaces a ticket file instead of rewriting it in place", async () => {
    await withBudgetProject(async ({ dir, tickets, ticketPath }) => {
      const before = await Promise.all(tickets.map(async (t) => (await stat(ticketPath(t))).ino));

      const { stdout } = await run("node", [script, dir, "--write-budget"]);
      assert.match(stdout, /result: PASS/);

      for (const [index, expected] of [
        [0, autoBudget(tickets[0].text, "spec § User Stories")],
        [1, autoBudget(tickets[1].text, "spec § User Stories · (new) src/csv.mjs")],
      ]) {
        const written = await readFile(ticketPath(tickets[index]), "utf8");
        assert.deepEqual(budgetLinesOf(written), [`**Budget:** ${expected}`]);
        assert.deepEqual(withoutBudgetLines(written), withoutBudgetLines(tickets[index].text));
        const after = (await stat(ticketPath(tickets[index]))).ino;
        assert.notEqual(after, before[index], `${tickets[index].file} was rewritten in place (same inode)`);
      }
    });
  });

  it("--write-budget keeps the file mode of each ticket it rewrites", async () => {
    await withBudgetProject(async ({ dir, tickets, ticketPath }) => {
      const modes = [0o640, 0o660];
      for (const [index, mode] of modes.entries()) {
        await chmod(ticketPath(tickets[index]), mode);
        assert.equal((await stat(ticketPath(tickets[index]))).mode & 0o777, mode);
      }

      const result = await checkFeatureDir(dir, { writeBudget: true });
      assert.deepEqual(result.errors, []);

      for (const [index, mode] of modes.entries()) {
        const written = await readFile(ticketPath(tickets[index]), "utf8");
        assert.notEqual(written, tickets[index].text, `${tickets[index].file} should have been rewritten`);
        const kept = (await stat(ticketPath(tickets[index]))).mode & 0o777;
        assert.equal(kept.toString(8), mode.toString(8), `${tickets[index].file} lost its mode`);
      }
    });
  });

  it("--write-budget leaves no temporary file in issues/", async () => {
    await withBudgetProject(async ({ dir, issuesDir, tickets }) => {
      const original = tickets.map((t) => t.file).sort();
      assert.deepEqual((await readdir(issuesDir)).sort(), original);

      const result = await checkFeatureDir(dir, { writeBudget: true });
      assert.deepEqual(result.errors, []);

      assert.deepEqual((await readdir(issuesDir)).sort(), original);
    });
  });

  it("--write-budget does not touch a ticket that already has its measured Budget line", async () => {
    await withBudgetProject(async ({ dir, tickets, ticketPath }) => {
      const snapshot = async () =>
        Promise.all(
          tickets.map(async (t) => ({
            ino: (await stat(ticketPath(t))).ino,
            text: await readFile(ticketPath(t), "utf8"),
          })),
        );
      const initial = await snapshot();

      await run("node", [script, dir, "--write-budget"]);
      const first = await snapshot();
      // Ticket 03 arrived with its measured Budget line, so the first run left it alone.
      assert.equal(first[2].ino, initial[2].ino, `${tickets[2].file} was replaced although nothing changed`);
      assert.equal(first[2].text, initial[2].text);

      await run("node", [script, "--write-budget", dir]);
      const second = await snapshot();
      for (const [index, t] of tickets.entries()) {
        assert.equal(second[index].ino, first[index].ino, `${t.file} was replaced although nothing changed`);
        assert.equal(second[index].text, first[index].text, `${t.file} changed on the second run`);
      }
    });
  });

  it("--write-budget leaves a ticket with Context errors as the same file with the same text", async () => {
    await withBudgetProject(
      async ({ dir, tickets, ticketPath }) => {
        const inoBefore = (await stat(ticketPath(tickets[2]))).ino;

        const result = await checkFeatureDir(dir, { writeBudget: true });
        assert.ok(
          result.errors.some((e) => /03-hide-emails\.md: Context path "src\/absent\.mjs" does not exist/.test(e)),
          result.errors.join("\n"),
        );

        assert.equal((await stat(ticketPath(tickets[2]))).ino, inoBefore, "the Context-error ticket was replaced");
        assert.equal(await readFile(ticketPath(tickets[2]), "utf8"), tickets[2].text);
      },
      { contextError: true },
    );
  });

  // --- Warnings: an acceptance criterion that mentions a suite or tool run ---
  it("warns, naming the ticket and criterion, when an acceptance criterion mentions a suite or tool run", () => {
    const warningsFor = (criterion) => {
      const tickets = passing();
      tickets[2] = ticket("03", "Hide emails", {
        blockedBy: "01",
        stories: "3",
        extra: `- [ ] ${criterion}\n`,
      });
      const result = checkFeature({ spec, tickets });
      assert.deepEqual(result.errors, []);
      return result.warnings;
    };

    for (const criterion of [
      "npm test",
      "npm run lint",
      "npm run validate",
      "npm run typecheck",
      "tests pass",
      "test passes",
      "typecheck passes",
      "lint passes",
      "suite passes",
      "Run NPM TEST before the commit",
    ]) {
      const warnings = warningsFor(criterion);
      assert.deepEqual(warnings?.length, 1, `${criterion}: ${warnings?.join("\n")}`);
      assert.match(warnings[0], /issues\/03-hide-emails\.md/);
      assert.ok(warnings[0].includes(criterion), warnings[0]);
    }

    assert.deepEqual(warningsFor("the guide describes X"), []);
  });

  // --- Warnings: two tickets changing the same path without an edge ---
  it("warns when two tickets change the same path and neither transitively blocks the other", () => {
    const files = { "src/shared.mjs": "export const shared = 1;\n" };
    const edit = "spec § User Stories · (edit) src/shared.mjs";
    const unordered = [
      ticket("01", "Export members", { reuse: "create-shared `buildMemberRows`", stories: "1, 1a", context: edit, files }),
      ticket("02", "CSV download", { stories: "2", context: edit, files }),
      ticket("03", "Hide emails", { stories: "3" }),
    ];
    const resUnordered = checkFeature({ spec, tickets: unordered, files });
    assert.deepEqual(resUnordered.errors, []);
    assert.deepEqual(resUnordered.warnings?.length, 1, resUnordered.warnings?.join("\n"));
    assert.match(resUnordered.warnings[0], /issues\/01-export-members\.md and issues\/02-csv-download\.md/);
    assert.match(resUnordered.warnings[0], /src\/shared\.mjs/);

    // A direct edge between the pair ends the warning.
    const ordered = [
      ticket("01", "Export members", { reuse: "create-shared `buildMemberRows`", stories: "1, 1a", context: edit, files }),
      ticket("02", "CSV download", { blockedBy: "01", stories: "2", context: edit, files }),
      ticket("03", "Hide emails", { stories: "3" }),
    ];
    assert.deepEqual(checkFeature({ spec, tickets: ordered, files }).warnings, []);

    // A transitive edge counts too: 03 is blocked by 02, which is blocked by 01.
    const transitive = [
      ticket("01", "Export members", { reuse: "create-shared `buildMemberRows`", stories: "1, 1a", context: edit, files }),
      ticket("02", "CSV download", { blockedBy: "01", stories: "2", context: edit, files }),
      ticket("03", "Hide emails", { blockedBy: "02", stories: "3", context: edit, files }),
    ];
    assert.deepEqual(checkFeature({ spec, tickets: transitive, files }).warnings, []);

    // One ticket naming the path twice is not two tickets changing it.
    const twice = [
      ticket("01", "Export members", {
        reuse: "create-shared `buildMemberRows`",
        stories: "1, 1a",
        context: "spec § User Stories · (edit) src/shared.mjs · (edit) src/shared.mjs",
        files,
      }),
      ticket("02", "CSV download", { stories: "2" }),
      ticket("03", "Hide emails", { stories: "3" }),
    ];
    assert.deepEqual(checkFeature({ spec, tickets: twice, files }).warnings, []);
  });

  it("warns on the same path marked (new) or (edit from NN) when no edge orders the pair", () => {
    const dupNew = [
      ticket("01", "Export members", { stories: "1, 1a", context: "spec § User Stories · (new) src/dup.mjs" }),
      ticket("02", "CSV download", { stories: "2", context: "spec § User Stories · (new) src/dup.mjs" }),
      ticket("03", "Hide emails", { stories: "3" }),
    ];
    const resNew = checkFeature({ spec, tickets: dupNew, files: {} });
    assert.ok(
      resNew.warnings?.some(
        (w) => /01-export-members\.md and issues\/02-csv-download\.md/.test(w) && /src\/dup\.mjs/.test(w),
      ),
      resNew.warnings?.join("\n"),
    );

    const editFrom = [
      ticket("01", "Export members", {
        reuse: "create-shared `buildMemberRows`",
        stories: "1, 1a",
        context: "spec § User Stories · (new) src/created.mjs",
      }),
      ticket("02", "CSV download", {
        blockedBy: "01",
        stories: "2",
        context: "spec § User Stories · (edit from 01) src/created.mjs",
      }),
      ticket("03", "Hide emails", {
        blockedBy: "01",
        stories: "3",
        context: "spec § User Stories · (edit from 01) src/created.mjs",
      }),
    ];
    const resEditFrom = checkFeature({ spec, tickets: editFrom, files: {} });
    assert.deepEqual(resEditFrom.errors, []);
    assert.deepEqual(resEditFrom.warnings?.length, 1, resEditFrom.warnings?.join("\n"));
    assert.match(resEditFrom.warnings[0], /issues\/02-csv-download\.md and issues\/03-hide-emails\.md/);
    assert.match(resEditFrom.warnings[0], /src\/created\.mjs/);
  });

  // --- Warnings: more than 15 tickets ---
  it("warns above 15 tickets, proposing a split into separate feature slugs", () => {
    const many = (count) =>
      Array.from({ length: count }, (_, index) => {
        const number = String(index + 1).padStart(2, "0");
        return ticket(number, `Ticket ${number}`, {
          blockedBy: index === 0 ? "None (can start immediately)" : "01",
          stories: "1",
        });
      });

    const res16 = checkFeature({ spec, tickets: many(16) });
    assert.deepEqual(res16.warnings?.length, 1, res16.warnings?.join("\n"));
    assert.match(res16.warnings[0], /16 tickets/);
    assert.match(res16.warnings[0], /separate feature slugs/i);

    assert.deepEqual(checkFeature({ spec, tickets: many(15) }).warnings, []);
  });

  // --- DAG summary: waves, width, critical path, recommendation ---
  it("computes each ticket's wave, the maximum wave width, and the critical-path length", () => {
    const chain = [
      ticket("01", "First", { stories: "1" }),
      ticket("02", "Second", { blockedBy: "01", stories: "1a" }),
      ticket("03", "Third", { blockedBy: "02", stories: "2, 3" }),
    ];
    assert.deepEqual(checkFeature({ spec, tickets: chain }).dag, {
      waves: [[1], [2], [3]],
      width: 1,
      criticalPath: 3,
      recommendation: ["subagent-implement"],
    });

    const diamond = [
      ticket("01", "Base", { stories: "1" }),
      ticket("02", "Left", { blockedBy: "01", stories: "1a" }),
      ticket("03", "Right", { blockedBy: "01", stories: "2" }),
      ticket("04", "Join", { blockedBy: "02, 03", stories: "3" }),
    ];
    assert.deepEqual(checkFeature({ spec, tickets: diamond }).dag, {
      waves: [[1], [2, 3], [4]],
      width: 2,
      criticalPath: 3,
      recommendation: ["subagent-implement", "agy-implement", "opencode-implement"],
    });

    const wide = [
      ticket("01", "Base", { stories: "1" }),
      ticket("02", "Second", { blockedBy: "01", stories: "1a" }),
      ticket("03", "Third", { blockedBy: "01", stories: "2" }),
      ticket("04", "Fourth", { blockedBy: "01", stories: "3" }),
    ];
    assert.deepEqual(checkFeature({ spec, tickets: wide }).dag, {
      waves: [[1], [2, 3, 4]],
      width: 3,
      criticalPath: 2,
      recommendation: ["agy-implement", "opencode-implement"],
    });
  });

  // --- Report order and warnings-only PASS ---
  it("formatReport prints errors, warnings, story coverage, the budget table, the DAG summary, notes, then the result", () => {
    const tickets = passing();
    tickets[2] = ticket("03", "Hide emails", { blockedBy: "01", stories: "none", extra: "- [ ] npm test\n" });
    const report = formatReport(".scratch/export-feature", checkFeature({ spec, tickets }));

    const at = (needle) => {
      const index = report.indexOf(needle);
      assert.ok(index !== -1, `"${needle}" missing from:\n${report}`);
      return index;
    };
    const positions = ["errors (", "warnings (", "story coverage:", "budget:", "dag:", "notes:", "result: FAIL"].map(at);
    assert.deepEqual([...positions].sort((a, b) => a - b), positions, report);
    assert.match(
      report,
      /dag:\n  wave 0: 01\n  wave 1: 02, 03\n  maximum wave width: 2\n  critical-path length: 2\n  recommended implementer: subagent-implement, agy-implement, opencode-implement/,
    );
  });

  it("prints warnings and a DAG summary, and exits 0, when the only findings are warnings", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "check-tickets-warnings-"));
    const dir = path.join(root, ".scratch", "export-feature");
    try {
      await mkdir(path.join(dir, "issues"), { recursive: true });
      await writeFile(path.join(dir, "spec.md"), spec);
      const tickets = passing();
      tickets[2] = ticket("03", "Hide emails", { blockedBy: "01", stories: "3", extra: "- [ ] npm test\n" });
      tickets.push(ticket("04", "Docs pass", { stories: "none" }));
      for (const { file, text } of tickets) await writeFile(path.join(dir, "issues", file), text);

      // execFile rejects on a non-zero exit code, so reaching the assertions means exit 0.
      const { stdout } = await run("node", [script, dir]);
      assert.match(stdout, /warnings \(1\):/);
      assert.match(stdout, /npm test/);
      const positions = ["warnings (", "story coverage:", "budget:", "dag:", "notes:", "result: PASS"].map((needle) => {
        const index = stdout.indexOf(needle);
        assert.ok(index !== -1, `"${needle}" missing from:\n${stdout}`);
        return index;
      });
      assert.deepEqual([...positions].sort((a, b) => a - b), positions, stdout);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  // --- Documentation of the Budget line ---
  it("ticket-format.md documents the Budget line, its measurement, and the unmeasured fallback", async () => {
    const content = await readFile(
      path.resolve("skills/agents/grill-to-tickets/references/ticket-format.md"),
      "utf8",
    );
    assert.match(content, /\*\*Budget:\*\*/);
    assert.match(content, /directly after `?\*\*Context:\*\*`?/i);
    assert.match(content, /read ~<N>k tokens · <C> criteria · <M> modules/);
    assert.match(content, /\*\*Budget:\*\* unmeasured/);
    assert.match(content, /⌈ASCII code points ÷ 4⌉ \+ non-ASCII code points/);
    assert.match(content, /2000/);
    const template = content.slice(content.indexOf("## Local Ticket Template"));
    assert.match(template, /\*\*Context:\*\*[\s\S]*?\*\*Budget:\*\*[\s\S]*?\*\*Status:\*\*/);
  });

  it("the checker header lists the Budget checks, the measurement, and --write-budget", async () => {
    const content = await readFile(script, "utf8");
    const header = content.slice(0, content.indexOf("\nimport "));
    assert.match(header, /\*\*Budget:\*\*/);
    assert.match(header, /2000/);
    assert.match(header, /--write-budget/);
    assert.match(header, /warning/i);
    assert.match(header, /wave/i);
  });
});
