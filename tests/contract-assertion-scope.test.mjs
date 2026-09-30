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

  it("scopes Scenario-format requirements to the User Stories template section", async () => {
    const source = await testCase(
      "tests/grill-to-tickets-contract.test.mjs",
      "requires a one-line Scenario under every story in new specs",
    );
    assert.doesNotMatch(source, /assert\.match\(format\s*,/,
      "tests/grill-to-tickets-contract.test.mjs:567-568 must not assert against the entire spec format");
    assert.match(source, /assert\.match\(userStories\s*,/,
      "Scenario-format assertions use the User Stories template section");
  });

  it("scopes the spec-format contract to its process, template, and individual sections", async () => {
    const source = await testCase(
      "tests/grill-to-tickets-contract.test.mjs",
      "owns spec-format.md adapted from to-spec with upstream source line and license",
    );
    assert.doesNotMatch(source, /assert\.(?:match|doesNotMatch)\(content\s*,/,
      "spec-format content assertions must not search the entire Markdown file");
    for (const scope of ["process", "testingDecisions"]) {
      assert.match(source, new RegExp(`assert\\.(?:match|doesNotMatch)\\(${scope}\\s*,`),
        `spec-format assertions use ${scope}`);
    }
    assert.match(source, /markdownSection\(specTemplate,\s*["']User Stories["']\)/,
      "template story checks use the parsed User Stories section");
    assert.match(source, /assert\.ok\(userStories,/,
      "the User Stories section is present in the specific template");
    assert.match(source, /assertAbsentFromMarkdownSections\(content,/,
      "spec-wide exclusions check each Markdown section");
  });

  it("scopes the ticket-format contract to its owning sections and template", async () => {
    const source = await testCase(
      "tests/grill-to-tickets-contract.test.mjs",
      "owns ticket-format.md adapted from to-tickets with upstream source line and license",
    );
    assert.doesNotMatch(source, /assert\.(?:match|doesNotMatch)\(content\s*,/,
      "ticket-format content assertions must not search the entire Markdown file");
    for (const scope of ["process", "prefactoring", "verticalSlices", "quizBody", "ticketTemplate", "criteriaRules"]) {
      assert.match(source, new RegExp(`assert\\.(?:match|doesNotMatch)\\(${scope}\\s*,`),
        `ticket-format assertions use ${scope}`);
    }
    assert.match(source, /assert\.match\(expandContractBody,/,
      "the expand-contract term is checked in its section body");
    assert.match(source, /assertAbsentFromMarkdownSections\(content,/,
      "ticket-wide exclusions check each Markdown section");
  });

  it("scopes the overview and Design Review Gate assertions to their Markdown sections", async () => {
    const source = await testCase(
      "tests/grill-to-tickets-contract.test.mjs",
      "points SKILL.md and design-review-gate at owned formats",
    );
    assert.doesNotMatch(source, /assert\.(?:match|doesNotMatch)\(content\s*,/,
      "overview assertions must not search the entire skill file");
    assert.match(source, /const overview = markdownHeaderBlock\(content\)/,
      "overview claims use the Markdown header block");
    assert.doesNotMatch(source, /assert\.(?:match|doesNotMatch)\(gate\s*,/,
      "Design Review Gate assertions must not search the entire reference");
    for (const scope of ["ship", "specLevel", "decisionLevel"]) {
      assert.match(source, new RegExp(`assert\\.(?:match|doesNotMatch)\\(${scope}\\s*,`),
        `gate assertions use ${scope}`);
    }
    assert.match(source, /assertAbsentFromMarkdownSections\(gate,/,
      "gate-wide exclusions check each Markdown section");
  });

  it("enforces the positive-instruction prohibition independently in each skill section", async () => {
    const positive = await testCase(
      "tests/grill-to-tickets-contract.test.mjs",
      "steers positively — no 'Never' or 'Do not' in the instruction body",
    );
    assert.doesNotMatch(positive, /assert\.doesNotMatch\(body\s*,/,
      "the positive-instruction prohibition must not scan the whole body at once");
    assert.match(positive, /assertAbsentFromMarkdownSections\(body,/,
      "the positive-instruction prohibition checks every body section");

    const rationalizations = await testCase(
      "tests/grill-to-tickets-contract.test.mjs",
      "links the reference once in the section immediately after Invocation and resolves it",
    );
    assert.doesNotMatch(rationalizations, /assert\.ok\(!\/.*\.test\(skill\)/,
      "the rationalizations contract must not scan the whole skill file at once");
    assert.match(rationalizations, /assertAbsentFromMarkdownSections\(body,/,
      "the rationalizations contract checks the prohibition in every skill section");
  });

  it("checks Stage 3.5 placement against parsed top-level headings", async () => {
    const source = await testCase(
      "tests/grill-to-tickets-contract.test.mjs",
      "runs Stage 3.5 once after a passing check and before the quiz, with the whole-token skip flag",
    );
    assert.doesNotMatch(source, /assert\.doesNotMatch\(skill\s*,/,
      "tests/grill-to-tickets-contract.test.mjs:766 must not assert against the entire skill file");
    assert.match(source, /markdownHeadings\(skill\)\.some\(/,
      "Stage 3.5 placement is checked from parsed Markdown headings");
  });

  it("scopes the Design Review Gate flag exclusion to its Budget and early stops section", async () => {
    const source = await testCase(
      "tests/grill-to-tickets-contract.test.mjs",
      "runs Stage 3.5 once after a passing check and before the quiz, with the whole-token skip flag",
    );
    assert.doesNotMatch(source, /assert\.doesNotMatch\(gate\s*,\s*\/--ticket-review\//,
      "the Design Review Gate exclusion must not search the entire file");
    assert.match(source, /const budget = markdownSection\(gate, [\"']Budget and early stops[\"']\)/,
      "the Design Review Gate exclusion uses its Budget and early stops section");
    assert.match(source, /assert\.doesNotMatch\(budget\s*,\s*\/--ticket-review\//,
      "the Design Review Gate flag exclusion is asserted within that section");
  });

  it("scopes ticket-review State transitions to the decision-log Format section", async () => {
    const source = await testCase(
      "tests/grill-to-tickets-contract.test.mjs",
      "initializes and resumes the ticket-review State from the log",
    );
    assert.doesNotMatch(source, /assertPattern\(log\s*,\s*\/State/,
      "tests/grill-to-tickets-contract.test.mjs:786 must not assert against the entire decision log");
    assert.match(source, /assertPattern\(format\s*,/,
      "ticket-review State assertions use the decision-log Format section");
  });

  it("scopes positive completion-language checks to the Stage 3 section", async () => {
    const source = await testCase(
      "tests/grill-to-tickets-contract.test.mjs",
      "requires settled ticket-review state and a successful final checker before Stage 3 is done",
    );
    assert.doesNotMatch(source, /assert\.doesNotMatch\(body\s*,/,
      "tests/grill-to-tickets-contract.test.mjs:832-833 must not assert against the whole skill body");
    assert.match(source, /assert\.doesNotMatch\(stage3\s*,/,
      "positive completion-language assertions use the Stage 3 section");
  });

  it("scopes Inline Execution dispatch assertions to the Inline Execution section", async () => {
    const source = await testCase(
      "tests/grill-to-tickets-contract.test.mjs",
      "dispatches each Stage 2 review to a fresh, read-only reviewer",
    );
    assert.doesNotMatch(
      source,
      /assertPattern\(content\s*,\s*\/(?:Two steps dispatch a subagent|Stage 2 design reviewer)/,
      "dispatch assertions must not search the entire skill file",
    );
    assert.match(source, /assertPattern\(inlineSection\s*,\s*\/Two steps dispatch a subagent/,
      "the two dispatches are asserted in Inline Execution");
    assert.match(source, /assertPattern\(inlineSection\s*,\s*\/Stage 2 design reviewer/,
      "the two reviewer roles are asserted in Inline Execution");
  });

  it("scopes Ticket Review Brief assertions to its Reviewer section", async () => {
    const source = await testCase(
      "tests/grill-to-tickets-contract.test.mjs",
      "briefs a read-only ambiguity review with READY or ASK and a missing-verdict fallback",
    );
    assert.doesNotMatch(source, /assert\.ok\(review\.includes\(/,
      "brief paths must not be asserted against the whole document");
    assert.doesNotMatch(source, /assertPattern\(review\s*,/,
      "brief behavior must not be asserted against the whole document");
    assert.match(source, /assert\.ok\(reviewer\.includes\(/,
      "brief paths are asserted in the Reviewer section");
    assert.match(source, /assertPattern\(briefIntro\s*,\s*\/one fresh reviewer/,
      "the brief's opening instruction is checked in the parsed heading block");
    assert.match(source, /assertPattern\(reviewer\s*,/,
      "brief behavior is asserted in the Reviewer section");
  });

  it("scopes the tracker exclusion to the ticket-review brief section", async () => {
    const source = await testCase(
      "tests/grill-to-tickets-contract.test.mjs",
      "briefs a read-only ambiguity review with READY or ASK and a missing-verdict fallback",
    );
    assert.doesNotMatch(source, /assert\.doesNotMatch\(review\s*,/,
      "tests/grill-to-tickets-contract.test.mjs:850 must not assert against the entire brief file");
    assert.match(source, /assert\.doesNotMatch\(reviewer\s*,/,
      "the tracker exclusion uses the ticket-review brief section");
  });
});
