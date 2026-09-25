import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Each standalone implementer keeps its own copy of the prose the three share
// word for word: the Reuse contract (ADR 0008) and the ticket-format, Seam, and
// Context blocks the reuse catalog's shared-prose rule registers here. These
// blocks are the parts whose wording must match exactly; the surrounding prose
// is free to differ per skill (serial vs wave dispatch).
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
    name: "worker prompt Test seam line",
    file: () => "references/prompt-scaffold.md",
    start: "- Test seam: <the ticket's **Seam:** line, verbatim;",
    end: "the seam chosen in planning, 1-3 sentences>",
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
  {
    name: "planning ticket-format parse",
    file: () => "references/planning.md",
    start: "Each ticket is in the `grill-to-tickets` ticket format:",
    end: "resolves by matching the title.",
  },
  {
    name: "planning test-seam selection",
    file: () => "references/planning.md",
    start: "A ticket's `**Seam:**` line, when present, is its test seam",
    end: "rather than being implemented without a test.",
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

describe("implementer prose shared word for word stays identical across skills (ADR 0008, reuse catalog)", () => {
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
