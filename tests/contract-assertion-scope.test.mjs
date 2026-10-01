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
  it("scopes implement-tickets planning and bilingual page claims", async () => {
    const planning = await testCase(
      "tests/implement-tickets-contract.test.mjs",
      "specifies every Plan field and pauses before changes outside the feature directory",
    );
    assert.doesNotMatch(planning, /assert\.match\(\s*planning\s*,/,
      "planning requirements must use the Plan subsection instead of the complete reference");
    assert.match(planning, /markdownSection\(planning,\s*["']5\. Present the Plan and pause["']\)/,
      "Plan requirements are read from the presentation and pause subsection");

    const pages = await testCase(
      "tests/implement-tickets-contract.test.mjs",
      "links bilingual Seam and Context guidance to the planning reference in both user-facing pages",
    );
    assert.doesNotMatch(pages, /assert\.match\(\s*doc\s*,/,
      "bilingual page claims must not search the complete guide or skill page");
    assert.match(pages, /markdownSection\(doc,\s*["']Seam และ Context["']\)/,
      "Thai Seam and Context claims are read from their owning section");
    assert.match(pages, /markdownSection\(doc,\s*["']Seam and Context["']\)/,
      "English Seam and Context claims are read from their owning section");

    const adapter = await testCase(
      "tests/implement-tickets-contract.test.mjs",
      "links adapter guidance to its canonical contract in Thai and English",
    );
    assert.doesNotMatch(adapter, /assert\.(?:match|doesNotMatch)\(\s*doc\s*,|\/--with[^\n]+\.test\(doc\)/,
      "adapter documentation claims must use their installation or usage sections");
    assert.match(adapter, /markdownSection\(doc,\s*file\.includes\(["']docs\/guides\//,
      "the guide adapter contract is checked in its Thai usage section");
    assert.match(adapter, /["']วิธีทำงานหลัก["']\)/,
      "the skill-page adapter contract is checked in its Thai workflow section");
    assert.match(adapter, /markdownSection\(doc,\s*["']Purpose and use["']\)/,
      "adapter install details are checked in the English usage section");
  });

  it("scopes canonical-link and duplicated-mechanics claims to each language section", async () => {
    const source = await testCase(
      "tests/implement-tickets-contract.test.mjs",
      "links bilingual user documentation to canonical mechanics without copying their rules",
    );
    assert.doesNotMatch(source, /assert\.(?:match|doesNotMatch|deepEqual)\(\s*doc\s*,/,
      "canonical links and copied mechanics must not be checked against a whole page");
    assert.match(source, /\[\["Thai", "ภาษาไทย \/ Thai"\], \["English", "English \/ ภาษาอังกฤษ"\]\]/,
      "the regression enumerates the Thai and English language sections");
    assert.match(source, /markdownSection\(doc,\s*heading\)/,
      "each page claim is extracted by its owning language heading");
    assert.match(source, /assert\.match\(section,\s*expression,/,
      "canonical links are checked within the extracted language section");
    assert.match(source, /copiedRules\.filter\(\(\[,\s*expression\]\)\s*=>\s*expression\.test\(section\)\)/,
      "duplicated rules are detected within the extracted language section");
    assert.match(source, /assert\.deepEqual\(copied,\s*\[\]/,
      "each language section must have no copied normative mechanics");
  });

  it("scopes implement-tickets marker and ADR 0020 claims", async () => {
    const marker = await testCase(
      "tests/implement-tickets-contract.test.mjs",
      "documents the human parallel-validation procedure and its marker",
    );
    assert.doesNotMatch(marker, /assert\.match\(\s*marker\s*,/,
      "parallel-validation prose must be checked within its procedure section");
    assert.match(marker, /markdownSection\(marker,\s*["']Procedure["']\)/,
      "parallel-validation procedure claims use the Procedure section");
    assert.match(marker, /markdownHeaderBlock\(marker\)/,
      "the status marker is checked in the document header block");

    const adr = await testCase(
      "tests/repo-contract.test.mjs",
      "records ADR 0020 as the implement-family core and supersedes the standalone statuses",
    );
    assert.doesNotMatch(adr, /assert\.(?:match|doesNotMatch)\(\s*doc\s*,|assert\.ok\(\s*\/[^\n;]*?\.test\(doc\)/,
      "ADR 0020 content claims must use their owning sections");
    assert.match(adr, /markdownSection\(doc,\s*["']Parallel validation record \/ บันทึกผล parallel validation["']\)/,
      "the parallel-validation marker claim uses the record section");
    assert.match(adr, /assert\.match\(validationRecord,\s*\/status: not validated/i,
      "the exact marker value is checked within the ADR record section");
    assert.match(adr, /markdownHeaderBlock\(doc\)/,
      "the ADR title is checked in its header block");
  });

  it("scopes adapter routing claims to the adapter contract and invocation section", async () => {
    const source = await testCase(
      "tests/implement-tickets-contract.test.mjs",
      "defines the adapter input, resume, failover, worktree lifecycle, envelope, and routing table",
    );
    assert.doesNotMatch(source, /assert\.match\(\s*(?:contract|skill)\s*,/,
      "adapter routing claims must not search the complete reference or skill file");
    for (const scope of ["input", "failover", "cleanup", "invocation"]) {
      assert.match(source, new RegExp(`assert\\.match\\(${scope}\\s*,`),
        `adapter routing assertions use the ${scope} section`);
    }
    assert.match(source, /markdownSection\(contract,\s*["']Input["']\)/,
      "worker input behavior is checked in its contract section");
    assert.match(source, /markdownSection\(contract,\s*["']Failover["']\)/,
      "outcome routing is checked in its contract section");
    assert.match(source, /markdownSection\(contract,\s*["']Worktree cleanup["']\)/,
      "worktree lifecycle behavior is checked in its contract section");
    assert.match(source, /markdownSection\(skill,\s*["']Invocation["']\)/,
      "adapter invocation behavior is checked in its owning skill section");
  });

  it("scopes implement-tickets dispatch and run-state assertions to contract sections", async () => {
    const references = await testCase(
      "tests/implement-tickets-contract.test.mjs",
      "keeps explicit-invocation frontmatter and the reference list aligned across the skill, guide, page, and directory",
    );
    assert.doesNotMatch(references, /linkedReferences\(content\)/,
      "reference inventory is collected from parsed Markdown sections");
    assert.match(references, /linkedReferences\(markdownSections\(content\)\)/,
      "the reference inventory receives section slices");

    const scopedCases = [
      ["tests/implement-tickets-contract.test.mjs", "starts every worker prompt with a checkout and integration SHA assertion", "prompt"],
      ["tests/implement-tickets-contract.test.mjs", "caps workers and verifiers together and gives pending verifiers priority", "dispatch"],
      ["tests/implement-tickets-contract.test.mjs", "pipelines a fresh native verifier and keeps its report to raw evidence", "verification"],
      ["tests/implement-tickets-contract.test.mjs", "runs each worker and verifier in the background with its own soft-timeout wait", "dispatch|verification"],
      ["tests/implement-tickets-contract.test.mjs", "routes crashes, lost subagents, and harness-cap rejections through infra retries", "dispatch"],
      ["tests/implement-tickets-contract.test.mjs", "squash-merges a fully verified wave in ticket order and gates the combined result", "gate"],
      ["tests/implement-tickets-contract.test.mjs", "locates a gate culprit, restores the last good commit, preserves later verified tickets, and retries alone", "gate"],
      ["tests/implement-tickets-contract.test.mjs", "blocks a ticket after three verification failures and reports held and independent paths", "state"],
      ["tests/implement-tickets-contract.test.mjs", "defines the status header and per-ticket table, including reported usage totals", "state"],
      ["tests/implement-tickets-contract.test.mjs", "refuses legacy state and reconciles, rewinds, replans, and resumes valid state", "state"],
      ["tests/implement-tickets-contract.test.mjs", "keeps status and list read-only", "state"],
      ["tests/implement-tickets-contract.test.mjs", "hands off a green integrated run without starting review or publication", "gate"],
    ];
    for (const [file, title, aliases] of scopedCases) {
      const source = await testCase(file, title);
      assert.doesNotMatch(source,
        new RegExp(`(?:assert\\.(?:match|doesNotMatch)|requireText)\\(\\s*(?:${aliases})\\s*,`),
        `${title} must assert against an extracted contract section`);
      assert.match(source, /markdownSection\(/, `${title} extracts its owning Markdown section`);
    }
  });

  it("scopes implement-tickets index entries and file-wide Markdown exclusions", async () => {
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

    const exclusions = await testCase(
      "tests/repo-contract.test.mjs",
      "has no absolute-path wording in the three implementer directories",
    );
    assert.match(exclusions, /assertAbsentFromMarkdownSections\(text,/,
      "Markdown exclusions are checked within parsed sections");
    assert.doesNotMatch(exclusions, /pattern\.test\(text\)/,
      "the absolute-path exclusion must not scan a complete Markdown file");
  });

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

  it("scopes owned-format guide orientation claims to their workflow summaries", async () => {
    const source = await testCase(
      "tests/repo-contract.test.mjs",
      "orients readers to owned formats, Preflight, ticket fields, the checker, and handoff",
    );
    assert.doesNotMatch(source, /assert\.(?:match|doesNotMatch)\(\s*(?:doc|guide|page)\s*,/,
      "guide orientation assertions must not scan a whole document alias");
    assert.doesNotMatch(source, /\b(?:doc|guide|page)\.match\(/,
      "guide orientation counts must not call match on a whole document alias");
    assert.match(source, /sectionOf\(guide,\s*["']### คำสั่งติดตั้งทั้งหมด["']\)/,
      "install command counts use the installation section");
    assert.match(source, /assert\.ok\(installSection,/,
      "the installation section exists before its commands are counted");
    assert.match(source, /numberedMarkdownItem\(guideWorkflow, 4\)/,
      "the Thai guide Stage 3 claims use item 4");
    assert.match(source, /numberedMarkdownItem\(guideWorkflow, 5\)/,
      "the Thai guide handoff claims use item 5");
    assert.match(source, /numberedMarkdownItem\(thaiWorkflow, 4\)/,
      "the skill page Thai Stage 3 claims use item 4");
    assert.match(source, /numberedMarkdownItem\(thaiWorkflow, 5\)/,
      "the skill page Thai handoff claims use item 5");
    assert.match(source, /paragraphOf\(englishWorkflow, ["']Stage 3 writes vertical tickets/,
      "English Stage 3 claims use their workflow summary paragraph");
    assert.match(source, /paragraphOf\(englishWorkflow, ["']Then the skill prints a handoff/,
      "English handoff claims use their handoff summary paragraph");
  });

  it("scopes handoff ordering to the guide and skill-page workflow summaries", async () => {
    const source = await testCase(
      "tests/repo-contract.test.mjs",
      "describes the grill-to-tickets handoff in the skill's order: /clear, then the DAG summary, then the implementer command",
    );
    assert.doesNotMatch(source, /assert\.(?:match|doesNotMatch)\(\s*(?:guide|page)\s*,/,
      "handoff assertions must not scan a whole guide or skill page");
    assert.doesNotMatch(source, /\b(?:guide|page)\.(?:replace|match)\(/,
      "handoff extraction must not normalize or match an entire guide or skill page");
    assert.match(source, /sectionOf\(guide,\s*["']### ขั้นตอนการทำงาน 4 ลำดับขั้น["']\)/,
      "the Thai guide diagram and handoff use its workflow section");
    assert.match(source, /numberedMarkdownItem\(guideWorkflow,\s*5\)/,
      "the Thai guide handoff order uses workflow item 5");
    assert.match(source, /sectionOf\(page,\s*["']### วิธีทำงานหลัก["']\)/,
      "the Thai skill-page stop uses its workflow section");
    assert.match(source, /numberedMarkdownItem\(thaiWorkflow,\s*5\)/,
      "the Thai skill-page stop assertion uses workflow item 5");
    assert.match(source, /sectionOf\(page,\s*["']### Main workflow["']\)/,
      "the English handoff uses its workflow section");
    assert.match(source, /paragraphOf\(englishWorkflow,\s*["']Then the skill prints a handoff/,
      "the English handoff order uses its summary paragraph");
  });

  it("scopes guide storage-tree checks to the feature-storage section", async () => {
    const source = await testCase(
      "tests/repo-contract.test.mjs",
      "updates the Thai guide with scenarios, the manifest, the ticket review, and two subagent dispatches",
    );
    assert.doesNotMatch(source, /\bguide\.match\(/,
      "the feature storage tree must not be extracted from the whole guide");
    assert.doesNotMatch(source, /assert\.(?:match|doesNotMatch)\(\s*guide\s*,/,
      "storage-tree contract assertions must not target the whole guide");
    assert.match(source, /sectionOf\(guide,\s*["']### โครงสร้างไฟล์ที่สร้างขึ้น \(Feature-scoped Storage\)["']\)/,
      "the tree fence is read from the guide's Feature-scoped Storage section");
    assert.match(source, /storageSection\.match\(/,
      "storage-tree extraction runs on that section");
  });

  it("scopes guide handoff order checks to workflow item 5", async () => {
    const source = await testCase(
      "tests/repo-contract.test.mjs",
      "orders the guide handoff to match SKILL.md: recommended implementer, then Manifest",
    );
    assert.doesNotMatch(source, /\bguide\.match\(/,
      "the guide handoff must not be extracted from the whole guide");
    assert.doesNotMatch(source, /assert\.(?:match|doesNotMatch)\(\s*guide\s*,/,
      "guide handoff assertions must not target the whole guide");
    assert.match(source, /sectionOf\(guide,\s*["']### ขั้นตอนการทำงาน 4 ลำดับขั้น["']\)/,
      "the handoff is read from the guide workflow section");
    assert.match(source, /numberedMarkdownItem\(guideWorkflow,\s*5\)/,
      "the handoff-order checks use workflow item 5");
  });

  it("scopes concise guide storage-tree checks to Feature-scoped Storage", async () => {
    const source = await testCase(
      "tests/repo-contract.test.mjs",
      "links concise ticket-review and manifest summaries to the canonical contracts",
    );
    assert.doesNotMatch(source, /\bguide\.match\(/,
      "the storage tree must not be extracted from the whole guide");
    assert.doesNotMatch(source, /assert\.(?:match|doesNotMatch)\(\s*(?:guide|page)\s*,/,
      "summary contract assertions must not target a whole guide or skill page");
    assert.match(source, /sectionOf\(guide,\s*["']### โครงสร้างไฟล์ที่สร้างขึ้น \(Feature-scoped Storage\)["']\)/,
      "the storage tree is read from the guide's Feature-scoped Storage section");
    assert.match(source, /guideStorageSection\.match\(/,
      "storage-tree extraction runs on that section");
  });

  it("scopes skill-page manifest handoff checks to workflow summaries", async () => {
    const source = await testCase(
      "tests/repo-contract.test.mjs",
      "keeps the manifest line in the skill page Stop item and English handoff",
    );
    assert.doesNotMatch(source, /\bpage\.(?:indexOf|slice|match)\(/,
      "manifest handoff checks must not search or slice the whole skill page");
    assert.doesNotMatch(source, /assert\.(?:match|doesNotMatch)\(\s*page\s*,/,
      "manifest handoff assertions must not target the whole skill page");
    assert.match(source, /sectionOf\(page,\s*["']### วิธีทำงานหลัก["']\)/,
      "the Thai Stop item is read from its workflow section");
    assert.match(source, /numberedMarkdownItem\(thaiWorkflow,\s*5\)/,
      "the Thai Stop assertion uses workflow item 5");
    assert.match(source, /const thaiStopHeader = thaiStop\.split\(["']\\n["'],\s*1\)\[0\]/,
      "the Thai Manifest claims are scoped to the Stop item header line");
    assert.match(source, /assert\.match\(thaiStopHeader,\s*\/Manifest:/,
      "the Thai header line names the Manifest path");
    assert.match(source, /assert\.match\(thaiStopHeader,\s*\/เมื่อมี\//,
      "the Thai header line indicates when the Manifest path appears");
    assert.match(source, /sectionOf\(page,\s*["']### Main workflow["']\)/,
      "the English handoff is read from its workflow section");
    assert.match(source, /paragraphOf\(englishWorkflow,\s*["']Then the skill prints a handoff/,
      "the English handoff checks use the summary paragraph");
  });

  it("scopes the ADR 0018 cost rationale to decision 5", async () => {
    const source = await testCase(
      "tests/repo-contract.test.mjs",
      "ADR 0018 names ADR 0014's rejection of dry-runs as a cost calibrated against nothing",
    );
    assert.doesNotMatch(source, /\badr18\.match\(/,
      "the cost rationale must not be extracted from the whole ADR");
    assert.doesNotMatch(source, /assert\.(?:match|doesNotMatch)\(\s*adr18\s*,/,
      "cost-rationale assertions must not target the whole ADR");
    assert.match(source, /markdownSection\(adr18,\s*["']Decision \/[^"']+["']\)/,
      "the cost rationale is read from the ADR Decision section");
    assert.match(source, /numberedMarkdownItem\(decision,\s*5\)/,
      "the cost rationale checks numbered decision 5");
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
    assert.match(source, /markdownSection\(format,\s*["']Spec Template["']\)/,
      "Scenario-format checks first locate the Spec Template heading");
    assert.match(source, /assert\.ok\(templateSection,/,
      "Scenario-format checks require the Spec Template section before slicing its fence");
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
    assert.match(source, /markdownSection\(content,\s*["']Spec Template["']\)/,
      "spec-format fence extraction starts from the parsed Spec Template section");
    assert.match(source, /assert\.ok\(templateSection,/,
      "spec-format checks require the Spec Template heading before slicing its fence");
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
    assert.match(source, /markdownSection\(content,\s*["']Local Ticket Template["']\)/,
      "ticket-format fence extraction starts from the parsed template section");
    assert.match(source, /assert\.ok\(ticketTemplateSection,/,
      "ticket-format checks require the template heading before slicing its fence");
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

  it("scopes invocation, handoff, ADR status, and bilingual-body claims", async () => {
    const invocation = await testCase(
      "tests/implement-tickets-contract.test.mjs",
      "declares explicit-only invocation for Claude Code and Codex",
    );
    assert.doesNotMatch(invocation, /assert\.match\(agent,\s*\/\^\\s\*allow_implicit_invocation/,
      "Codex invocation metadata is not searched outside its owning YAML mapping");
    assert.match(invocation, /const policyMapping = agent\.match\(/,
      "Codex invocation metadata is extracted from its policy mapping");
    assert.match(invocation, /assert\.match\(policyMapping,\s*\/\^\\s\+allow_implicit_invocation/,
      "the Codex policy field is checked within the policy mapping");

    const handoff = await testCase(
      "tests/grill-to-tickets-contract.test.mjs",
      "inline-executes the three stage skills and two owned formats and hands the tickets to a later implementer run",
    );
    assert.doesNotMatch(handoff, /assert\.match\(\s*content\s*,\s*\/\\\/implement-tickets/,
      "the later implementer command is not accepted from anywhere in the whole skill");
    assert.match(handoff, /markdownSection\(content,\s*["']Stop — Handoff["']\)/,
      "the later implementer command is extracted from the Stop handoff section");
    assert.match(handoff, /assert\.match\([\s\S]*?handoff,\s*\/\\\/implement-tickets/,
      "the command is checked within the extracted handoff section");

    const adr = await testCase(
      "tests/repo-contract.test.mjs",
      "records ADR 0020 as the implement-family core and supersedes the standalone statuses",
    );
    assert.doesNotMatch(adr, /previous\.split\(/,
      "superseded status checks do not scan the complete ADR text");
    assert.match(adr, /file\.includes\(["']0007-["']\)[\s\S]*markdownHeaderBlock\(previous\)/,
      "inline ADR status metadata is read from the header block");
    assert.match(adr, /markdownSection\(previous,\s*["']Status \/ สถานะ["']\)/,
      "ADR 0007 continues to use its dedicated status section");

    assert.doesNotMatch(adr, /\.test\(section\)/,
      "bilingual ADR claims do not count Thai characters in the heading itself");
    assert.match(adr, /const body = section\?\.split\(/,
      "ADR section checks extract body text after the heading");
    assert.match(adr, /\.test\(body\)/,
      "Thai presence is checked within each ADR section body");
  });
});
