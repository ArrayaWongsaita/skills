import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

// ADR 0008 keeps one copy of the Reuse contract in each standalone implementer.
// These blocks are the parts of that contract whose wording must match exactly;
// the surrounding prose is free to differ per skill (serial vs wave dispatch).
const IMPLEMENTERS = {
  "subagent-implement": { integration: "references/verification-and-integration.md" },
  "agy-implement": { integration: "references/worktree-integration.md" },
  "opencode-implement": { integration: "references/worktree-integration.md" },
};

const SHARED_BLOCKS = [
  {
    name: "worker prompt Reuse lines",
    file: () => "references/prompt-scaffold.md",
    start: "- Reuse: <the ticket's Reuse line, verbatim>",
    end: "search it for an existing one",
  },
  {
    name: "orchestrator Reuse prompt rules",
    file: () => "references/prompt-scaffold.md",
    start: "- Copy the ticket's `**Reuse:**` line verbatim",
    end: "this ticket alone.",
  },
  {
    name: "Seam and Context prompt rules",
    file: () => "references/prompt-scaffold.md",
    start: '- The "Test seam" line is the seam selected in Stage 0 planning; the worker',
    end: "absolute path in the project root's main checkout.",
  },
  {
    name: "Reuse Catalog update steps",
    file: (skill) => IMPLEMENTERS[skill].integration,
    start: "1. **Path.**",
    end: "or add the entry when the module was not yet catalogued.",
  },
];

function extractBlock(content, start, end) {
  const from = content.indexOf(start);
  if (from < 0) return null;
  const to = content.indexOf(end, from);
  return to < 0 ? null : content.slice(from, to + end.length);
}

function firstDifference(a, b) {
  const left = a.split("\n");
  const right = b.split("\n");
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (left[i] !== right[i]) return { line: i + 1, left: left[i], right: right[i] };
  }
  return null;
}

describe("implementer Reuse contract stays identical across skills (ADR 0008)", () => {
  for (const block of SHARED_BLOCKS) {
    it(`${block.name} match in all three implementers`, async () => {
      const copies = {};
      for (const skill of Object.keys(IMPLEMENTERS)) {
        const file = path.join("skills/agents", skill, block.file(skill));
        const text = extractBlock(await readFile(path.resolve(file), "utf8"), block.start, block.end);
        assert.ok(text, `${file} must contain the "${block.name}" block, from "${block.start}" to "${block.end}"`);
        copies[skill] = text;
      }

      const [referenceSkill, ...others] = Object.keys(copies);
      for (const skill of others) {
        const diff = firstDifference(copies[referenceSkill], copies[skill]);
        assert.equal(
          diff,
          null,
          diff &&
            `"${block.name}" differs between ${referenceSkill} and ${skill} at block line ${diff.line}:\n` +
              `  ${referenceSkill}: ${diff.left}\n  ${skill}: ${diff.right}\n` +
              "Apply the same wording to all three implementers in one change.",
        );
      }
    });
  }
});
