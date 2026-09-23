import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

import {
  checkFeature,
  parseReusePlan,
  parseStories,
} from "../skills/agents/grill-to-tickets/scripts/check-tickets.mjs";

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

function ticket(number, title, { blockedBy = "None (can start immediately)", reuse = "none", stories = "none", extra = "" } = {}) {
  const lines = [`# ${number}: ${title}`, "", "**What to build:** something end to end.", ""];
  if (blockedBy !== null) lines.push(`**Blocked by:** ${blockedBy}`, "");
  if (reuse !== null) lines.push(`**Reuse:** ${reuse}`, "");
  if (stories !== null) lines.push(`**Stories:** ${stories}`, "");
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

  it("runs as a CLI: exit 0 with a coverage table when clean, 1 with errors, 2 without issues/", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "check-tickets-"));
    try {
      await mkdir(path.join(dir, "issues"));
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
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("ships byte-identical in the canonical and installed skill copies", async () => {
    const [canonical, mirror] = await Promise.all([
      readFile(script, "utf8"),
      readFile(path.resolve(".agents/skills/grill-to-tickets/scripts/check-tickets.mjs"), "utf8"),
    ]);
    assert.equal(mirror, canonical);
  });
});
