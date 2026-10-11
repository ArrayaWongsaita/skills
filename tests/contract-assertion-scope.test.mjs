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
  it("scopes implement-tickets index entries", async () => {
    const indexRow = await testCase(
      "tests/repo-contract.test.mjs",
      "lists implement-tickets in the generated agent-skill index",
    );
    assert.doesNotMatch(indexRow, /assert\.match\(index\s*,/,
      "the generated index contract must assert against the skill's table row");
    assert.match(indexRow, /tableRow\(index,\s*["']implement-tickets["']\)/,
      "the generated index contract locates the implement-tickets row");

    const alias = await testCase(
      "tests/repo-contract.test.mjs",
      "removes the retired standalone skill without publishing an alias",
    );
    assert.doesNotMatch(alias, /index\.includes\(retiredName\)/,
      "the catalog exclusion is scoped to skill rows");
    assert.match(alias, /tableRow\(index,\s*retiredName\)/,
      "the retired command is excluded from the generated skill rows");

  });
});
