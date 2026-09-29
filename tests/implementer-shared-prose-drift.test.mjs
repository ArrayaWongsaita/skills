import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Each standalone implementer keeps its own copy of the prose the three share
// word for word: the ticket-format, Seam, Context, and Budget blocks. These
// blocks are the parts whose wording must match exactly; the
// surrounding prose is free to differ per skill (serial vs wave dispatch).
const IMPLEMENTERS = ["subagent-implement", "agy-implement", "opencode-implement"];

const SHARED_BLOCKS = [
  {
    name: "worker prompt Parent spec line",
    file: () => "references/prompt-scaffold.md",
    start: "- Parent spec: <abs path to spec.md> — read only these sections:",
    end: "or the sections chosen as today>",
  },
  {
    name: "worker prompt Context files lines",
    file: () => "references/prompt-scaffold.md",
    start: "- Context files, grouped from the ticket's `**Context:**` line:",
    end: "  - create: <`(new)` paths>",
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
    name: "budget_estimate sentence",
    file: () => "references/status-and-resume.md",
    start: "`budget_estimate` is the ticket's Budget line verbatim",
    end: "or `none` when the ticket carries none.",
  },
  {
    name: "planning ticket-format parse",
    file: () => "references/planning.md",
    start: "Each ticket is in the `grill-to-tickets` ticket format:",
    end: "resolves by matching the title.",
  },
  {
    name: "planning numbering bullet",
    file: () => "references/planning.md",
    start: "- **Numbering consistent with a topological order.**",
    end: "`BLOCKED (TICKET_SET_NUMBERING)` naming both.",
  },
  {
    name: "planning test-seam selection",
    file: () => "references/planning.md",
    start: "A ticket's `**Seam:**` line, when present, is its test seam",
    end: "rather than being implemented without a test.",
  },
  {
    name: "Select a test seam step",
    file: () => "SKILL.md",
    start: "**Select a test seam per ticket**",
    end: "planning rather than shipping without a test.",
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

describe("implementer prose shared word for word stays identical across skills", () => {
  for (const block of SHARED_BLOCKS) {
    it(`${block.name} match in all three implementers`, async () => {
      const copies = {};
      for (const skill of IMPLEMENTERS) {
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
