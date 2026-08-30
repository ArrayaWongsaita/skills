import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

async function fileExists(filePath) {
  await access(filePath, constants.R_OK);
}

function parseMarkdownLinks(markdown) {
  // Strip fenced code blocks before parsing links
  const contentWithoutCode = markdown.replace(/```[\s\S]*?```/g, "");
  const linkMatches = [...contentWithoutCode.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)];
  return linkMatches.map((m) => ({
    text: m[1],
    target: m[2].trim().split(/\s+/)[0].replace(/^<|>$/g, ""),
  })).filter((l) => l.target && !l.target.startsWith("#") && !/^[a-z][a-z0-9+.-]*:/i.test(l.target));
}

async function assertMarkdownLinksExist(baseDir, markdown, sourceFile, { requireLinks = true } = {}) {
  const links = parseMarkdownLinks(markdown);
  if (requireLinks) {
    assert.ok(links.length > 0, `${sourceFile} must contain reference links`);
  }
  for (const link of links) {
    const cleanTarget = link.target.split("#")[0];
    const resolved = path.resolve(baseDir, cleanTarget);
    await assert.doesNotReject(
      fileExists(resolved),
      `Broken link in ${sourceFile}: [${link.text}](${link.target}) -> ${resolved}`
    );
  }
  return links;
}

describe("Orchestration Pipeline End-to-End Verification", () => {
  const orchestratorSkillPath = path.resolve(".agents/skills/grill-with-docs/SKILL.md");
  const engWorkflowPath = path.resolve("skills/agents/engineering-workflow/SKILL.md");
  const localEngWorkflowPath = path.resolve(".agents/skills/engineering-workflow/SKILL.md");
  const scratchFeatureRoot = path.resolve(".scratch/skill-orchestrator-redesign");

  describe("File links and markdown references integrity", () => {
    it("all markdown links in grill-with-docs point to valid existing files", async () => {
      await fileExists(orchestratorSkillPath);
      const content = await readFile(orchestratorSkillPath, "utf8");
      const dir = path.dirname(orchestratorSkillPath);
      await assertMarkdownLinksExist(dir, content, "grill-with-docs/SKILL.md");
    });

    it("all child skills referenced by grill-with-docs exist in .agents/skills/", async () => {
      const childSkills = [
        "grilling",
        "domain-modeling",
        "to-spec",
        "scrutinize",
        "to-tickets",
        "tdd",
        "code-review",
        "pr-to-dev",
      ];

      for (const skill of childSkills) {
        const skillFile = path.resolve(`.agents/skills/${skill}/SKILL.md`);
        await assert.doesNotReject(
          fileExists(skillFile),
          `Child skill ${skill} must exist at .agents/skills/${skill}/SKILL.md`
        );
      }
    });

    it("all markdown links in engineering-workflow references point to existing files", async () => {
      for (const basePath of [engWorkflowPath, localEngWorkflowPath]) {
        await fileExists(basePath);
        const content = await readFile(basePath, "utf8");
        const dir = path.dirname(basePath);
        await assertMarkdownLinksExist(dir, content, basePath);
      }
    });

    it("all reference docs in engineering-workflow/references/ exist and contain valid cross-links", async () => {
      const refDirs = [
        path.resolve("skills/agents/engineering-workflow/references"),
        path.resolve(".agents/skills/engineering-workflow/references"),
      ];

      for (const refDir of refDirs) {
        const entries = await readdir(refDir);
        const mdFiles = entries.filter((e) => e.endsWith(".md"));
        assert.ok(mdFiles.length >= 8, `Expected at least 8 reference markdown files in ${refDir}`);

        for (const file of mdFiles) {
          const fullPath = path.join(refDir, file);
          const content = await readFile(fullPath, "utf8");
          await assertMarkdownLinksExist(refDir, content, fullPath, { requireLinks: false });
        }
      }
    });
  });

  describe("Simulated stage transitions from /grill-with-docs through /implement", () => {
    it("simulates full lifecycle phase transitions, gate confirmations, and Smart Zone resets", async () => {
      const content = await readFile(orchestratorSkillPath, "utf8");

      // Phase 1: Discovery & Domain Modeling
      assert.match(content, /## Phase 1:\s*Discovery & Domain Modeling/i);
      assert.match(content, /grilling/);
      assert.match(content, /domain-modeling/);
      assert.match(content, /CONTEXT\.md/);
      assert.match(content, /adr\//);
      assert.match(content, /Gate 1:\s*Post-Discovery Confirmation/i);
      assert.match(content, /explicit user confirmation/i);

      // Phase 2: Specification & Design Gate
      assert.match(content, /## Phase 2:\s*Specification & Design/i);
      assert.match(content, /to-spec/);
      assert.match(content, /spec\.md/);
      assert.match(content, /scrutinize/);
      assert.match(content, /Pass/);
      assert.match(content, /Minor Correction/);
      assert.match(content, /Rework/);
      assert.match(content, /Reject/);
      assert.match(content, /6-cycle/);
      assert.match(content, /Gate 2:\s*Post-Spec/i);

      // Phase 3: Vertical Ticket Breakdown
      assert.match(content, /## Phase 3:\s*Vertical Ticket Breakdown/i);
      assert.match(content, /to-tickets/);
      assert.match(content, /tracer-bullet/);
      assert.match(content, /Blocked by/);
      assert.match(content, /Gate 3:\s*Post-Tickets Confirmation/i);

      // Phase 4: Context Boundary
      assert.match(content, /## Phase 4:\s*Context Boundary/i);
      assert.match(content, /\/clear/);
      assert.match(content, /\/implement \.scratch\/<feature-slug>\/issues\/01-/);
      assert.match(content, /Smart Zone/);

      // Phase 5: Test-Driven Implementation Loop
      assert.match(content, /## Phase 5:\s*Test-Driven Implementation Loop/i);
      assert.match(content, /tdd/);
      assert.match(content, /code-review/);
      assert.match(content, /Standards/);
      assert.match(content, /Spec/);
      assert.match(content, /Gate 4:\s*Post-Ticket Implementation Confirmation/i);

      // Phase 6: System Review & Wrap-Up
      assert.match(content, /## Phase 6:\s*System Review/i);
      assert.match(content, /scrutinize/);
      assert.match(content, /pr-to-dev/);
    });
  });

  describe("Artifact tree specification validation", () => {
    it(".scratch/<feature-slug>/ contains all required architecture artifacts", async () => {
      await fileExists(scratchFeatureRoot);
      const entries = await readdir(scratchFeatureRoot);

      assert.ok(entries.includes("CONTEXT.md"), "CONTEXT.md must exist in feature root");
      assert.ok(entries.includes("adr"), "adr directory must exist in feature root");
      assert.ok(entries.includes("spec.md"), "spec.md must exist in feature root");
      assert.ok(entries.includes("issues"), "issues directory must exist in feature root");
    });

    it("CONTEXT.md satisfies domain glossary schema", async () => {
      const contextFile = path.join(scratchFeatureRoot, "CONTEXT.md");
      const content = await readFile(contextFile, "utf8");

      assert.match(content, /^# Domain Glossary/m);
      assert.match(content, /## Language/i);
      assert.match(content, /\*\*Full-Lifecycle Orchestrator\*\*:/);
      assert.match(content, /\*\*Smart Zone\*\*:/);
      assert.match(content, /\*\*Phase Boundary\*\*:/);
      assert.match(content, /\*\*Inline Execution\*\*:/);
      assert.match(content, /_Avoid_:/);
    });

    it("adr/ directory contains properly formatted ADRs", async () => {
      const adrDir = path.join(scratchFeatureRoot, "adr");
      const files = await readdir(adrDir);
      const adrFiles = files.filter((f) => /^\d{4}-.+\.md$/.test(f));

      assert.ok(adrFiles.length >= 1, "At least one ADR must exist matching NNNN-<slug>.md");
      for (const adr of adrFiles) {
        const content = await readFile(path.join(adrDir, adr), "utf8");
        assert.match(content, /^# \d{4}:/m, "ADR must start with # NNNN: Title");
        assert.match(content, /## Status/i, "ADR must contain ## Status");
        assert.match(content, /## Context/i, "ADR must contain ## Context");
        assert.match(content, /## Decision/i, "ADR must contain ## Decision");
        assert.match(content, /## Consequences/i, "ADR must contain ## Consequences");
      }
    });

    it("spec.md satisfies feature specification schema", async () => {
      const specFile = path.join(scratchFeatureRoot, "spec.md");
      const content = await readFile(specFile, "utf8");

      assert.match(content, /^# Spec:/m, "spec.md must start with # Spec:");
      assert.match(content, /## Problem Statement/i);
      assert.match(content, /## Solution/i);
      assert.match(content, /## User Stories/i);
      assert.match(content, /## Implementation Decisions/i);
      assert.match(content, /## Testing Decisions/i);
      assert.match(content, /## Out of Scope/i);
    });

    it("issues/ directory contains properly structured tracer-bullet tickets", async () => {
      const issuesDir = path.join(scratchFeatureRoot, "issues");
      const files = await readdir(issuesDir);
      const ticketFiles = files.filter((f) => /^\d{2}-.+\.md$/.test(f)).sort();

      assert.ok(ticketFiles.length >= 3, "Expected at least 3 tickets in issues/");
      for (const ticket of ticketFiles) {
        const content = await readFile(path.join(issuesDir, ticket), "utf8");
        assert.match(content, /^# \d{2}:/m, "Ticket must start with # NN: Title");
        assert.match(content, /\*\*What to build:\*\*/);
        assert.match(content, /\*\*Blocked by:\*\*/);
        assert.match(content, /\*\*Status:\*\*/);
        assert.match(content, /- \[[ x]\]/, "Ticket must contain acceptance criteria checklist");
      }
    });
  });
});
