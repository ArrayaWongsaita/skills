import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

import * as checkTicketsModule from "../skills/agents/grill-to-tickets/scripts/check-tickets.mjs";

const {
  checkFeature,
  checkFeatureDir,
  parseReusePlan,
  parseStories,
  parseTicket,
} = checkTicketsModule;

const sectionOf = (...args) => checkTicketsModule.sectionOf?.(...args);

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

function ticket(
  number,
  title,
  {
    blockedBy = "None (can start immediately)",
    reuse = "none",
    stories = "none",
    seam = "test boundary",
    context = "spec § User Stories",
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
  return { file: `${number}-${title.toLowerCase().replace(/\W+/g, "-")}.md`, text: lines.join("\n") };
}

const passing = () => [
  ticket("01", "Export members", { reuse: "create-shared `buildMemberRows`", stories: "1, 1a" }),
  ticket("02", "CSV download", { blockedBy: "01", reuse: "use `buildMemberRows` · use `formatDate`", stories: "2" }),
  ticket("03", "Hide emails", { blockedBy: "01: Export members", stories: "3" }),
];

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
});
