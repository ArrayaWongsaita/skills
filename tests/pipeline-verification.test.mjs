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
  const engWorkflowPath = path.resolve("skills/agents/engineering-workflow/SKILL.md");

  describe("File links and markdown references integrity", () => {
    it("all markdown links in engineering-workflow references point to existing files", async () => {
      for (const basePath of [engWorkflowPath]) {
        await fileExists(basePath);
        const content = await readFile(basePath, "utf8");
        const dir = path.dirname(basePath);
        await assertMarkdownLinksExist(dir, content, basePath);
      }
    });

    it("all reference docs in engineering-workflow/references/ exist and contain valid cross-links", async () => {
      const refDirs = [path.resolve("skills/agents/engineering-workflow/references")];

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
});
