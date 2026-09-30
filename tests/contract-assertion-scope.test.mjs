import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

async function testCase(file, title) {
  const source = await readFile(file, "utf8");
  const start = source.indexOf(`  it("${title}"`);
  assert.notEqual(start, -1, `${file} contains the ${title} test`);
  const next = source.indexOf("\n  it(", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

describe("Markdown contract assertion scope", () => {
  it("scopes implementer manifest checks to Markdown sections", async () => {
    const source = await testCase(
      "tests/grill-to-tickets-contract.test.mjs",
      "keeps the manifest out of the three implementer skills and their references",
    );
    assert.doesNotMatch(
      source,
      /assert\.doesNotMatch\(\s*await readFile\(file,\s*["']utf8["']\)/,
      "tests/grill-to-tickets-contract.test.mjs:87 must not assert against an entire implementer file",
    );
    assert.match(source, /assertAbsentFromMarkdownSections\(/, "the implementer scan checks each Markdown section");
  });

  it("scopes ADR 0018 content checks to their Markdown sections", async () => {
    const source = await testCase(
      "tests/repo-contract.test.mjs",
      "records ADR 0018's bilingual scenarios, manifest, ticket review, and amendments",
    );
    assert.doesNotMatch(
      source,
      /assert\.match\(\s*adr18\s*,/,
      "tests/repo-contract.test.mjs:281-289 must not assert against the entire ADR",
    );
    for (const scope of ["context", "scenarioDecision", "manifestDecision", "ticketReviewDecision", "costDecision", "dispatchDecision"]) {
      assert.match(source, new RegExp(`assert\\.match\\(${scope}\\s*,`), `ADR 0018 assertions use ${scope}`);
    }
  });

  it("scopes guide content checks to their Markdown sections", async () => {
    const source = await testCase(
      "tests/repo-contract.test.mjs",
      "updates the Thai guide with scenarios, the manifest, the ticket review, and two subagent dispatches",
    );
    assert.doesNotMatch(
      source,
      /assert\.match\(\s*guide\s*,/,
      "tests/repo-contract.test.mjs:302-305 must not assert against the entire guide",
    );
    for (const scope of ["purpose", "stage1", "stage3"]) {
      assert.match(source, new RegExp(`assert\\.match\\(${scope}\\s*,`), `guide assertions use ${scope}`);
    }
  });
});
