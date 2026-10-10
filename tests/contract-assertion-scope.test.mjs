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

function functionDeclaration(source, name) {
  const declaration = source.match(new RegExp(`^function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?^\\}`, "m"));
  return declaration?.[0] ?? null;
}

describe("Markdown contract assertion scope", () => {
  it("requires English prose as well as Thai text in ADR 0020 sections", async () => {
    const source = await testCase(
      "tests/repo-contract.test.mjs",
      "records ADR 0020 as the implement-family core and supersedes the standalone statuses",
    );
    const languageEvidence = await testCase(
      "tests/repo-contract.test.mjs",
      "rejects ADR language evidence found only in inline code or Markdown headings",
    );
    const assertions = await readFile("tests/repo-contract.test.mjs", "utf8");
    const markdownProse = functionDeclaration(assertions, "markdownProse");
    const hasThaiProse = functionDeclaration(assertions, "hasThaiProse");
    const hasEnglishProse = functionDeclaration(assertions, "hasEnglishProse");
    assert.match(source, /assert\.ok\(body && hasThaiProse\(body\)/,
      "ADR 0020 sections use the shared prose extractor for Thai evidence");
    assert.ok(markdownProse, "the Markdown prose helper declaration exists");
    assert.ok(hasThaiProse, "the Thai prose helper declaration exists");
    assert.ok(hasEnglishProse, "the English prose helper declaration exists");
    assert.match(markdownProse, /replace\(\/\^\\s\{0,3\}\#\{1,6\}/,
      "the shared prose extractor removes Markdown headings");
    assert.match(markdownProse, /replace\(\/`\+\[\^`\]\*`\+\/g, " "\)/,
      "the shared prose extractor removes inline code");
    assert.match(hasThaiProse, /markdownProse\(body\)/,
      "Thai evidence is checked only after shared prose extraction");
    assert.match(languageEvidence, /assert\.equal\(hasThaiProse\("ก"\),\s*false,/,
      "the language-evidence regression rejects one Thai codepoint");
    assert.match(languageEvidence, /assert\.equal\(hasThaiProse\("นี่คือข้อความภาษาไทยที่เป็นเนื้อหาจริง"\),\s*true,/,
      "the language-evidence regression accepts a genuine Thai sentence");
    assert.match(languageEvidence, /assert\.equal\(hasEnglishProse\(repeatedFunctionWords\),\s*false,/,
      "the language-evidence regression rejects repeated English function words");
    assert.match(languageEvidence, /hasEnglishProse\("The adapter remains ready while workers can complete the review\."\),\s*true,/,
      "the language-evidence regression accepts English prose with content words");
    assert.match(hasEnglishProse, /markdownProse\(body\)/,
      "English evidence uses the same prose extraction as Thai evidence");
    assert.match(hasEnglishProse, /const contentWords = words\.filter\(\(word\) => !englishProseMarkers\.has\(word\.toLowerCase\(\)\)\)/,
      "English prose evidence counts content words separately from function words");
    assert.match(hasEnglishProse, /return words\.length >= 8 && proseWords\.length >= 2 && contentWords\.length >= 4;/,
      "English evidence requires a sentence with multiple function and content words");
    assert.match(source, /assert\.ok\(hasEnglishProse\(body\),/,
      "each section asserts its own English prose evidence");
  });

  it("requires ADR prose helper assertions to use each helper's own source slice", async () => {
    const source = await testCase(
      "tests/contract-assertion-scope.test.mjs",
      "requires English prose as well as Thai text in ADR 0020 sections",
    );
    assert.doesNotMatch(source, /assert\.(?:match|doesNotMatch)\(\s*assertions\s*,/,
      "prose-helper implementation claims must not search all of repo-contract.test.mjs");
    for (const helper of ["markdownProse", "hasThaiProse", "hasEnglishProse"]) {
      assert.match(source, new RegExp(`const ${helper} = functionDeclaration\\(assertions, [\"']${helper}[\"']\\)`),
        `${helper} is extracted from its own declaration`);
      assert.match(source, new RegExp(`assert\\.match\\(${helper}\\s*,`),
        `${helper} implementation claims use its extracted declaration`);
    }
  });

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
