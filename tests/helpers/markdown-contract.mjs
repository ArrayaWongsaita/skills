import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

function parseHeading(line) {
  const match = line.match(/^(#{1,6})[ \t]+(.+?)\s*#*\s*$/);
  return match ? { level: match[1].length, title: match[2].trim() } : null;
}

function headingEntries(markdown) {
  const entries = [];
  const lines = markdown.split(/\r?\n/);
  const backtick = String.fromCharCode(96);
  const fenceStart = new RegExp("^ {0,3}(" + backtick + "{3,}|~{3,})");
  let fence = null;

  lines.forEach((line, index) => {
    const marker = line.match(fenceStart)?.[1];
    if (fence) {
      const fenceChar = fence[0];
      const fenceEnd = new RegExp("^ {0,3}" + fenceChar + "{" + fence.length + ",}\\s*$");
      if (fenceEnd.test(line)) fence = null;
      return;
    }
    if (marker) {
      fence = marker;
      return;
    }

    const heading = parseHeading(line);
    if (heading) entries.push({ index, heading });
  });

  return { lines, entries };
}

export function markdownHeadings(markdown) {
  return headingEntries(markdown).entries.map(({ heading }) => heading);
}

export function markdownHeaderBlock(markdown) {
  const { lines, entries } = headingEntries(markdown);
  const firstSection = entries.find(({ heading }) => heading.level === 2);
  return lines.slice(0, firstSection?.index ?? lines.length).join("\n");
}

export function markdownSection(markdown, headingTitle) {
  const { lines, entries } = headingEntries(markdown);
  const start = entries.find((entry) => entry.heading.title === headingTitle);
  if (!start) return null;

  const nextSection = entries.find(
    (entry) => entry.index > start.index && entry.heading.level <= start.heading.level,
  );
  return lines.slice(start.index, nextSection?.index ?? lines.length).join("\n");
}

export function assertAbsentFromMarkdownSections(markdown, pattern, message) {
  const { lines, entries } = headingEntries(markdown);
  const sections = [];

  if (entries.length === 0) {
    sections.push({ title: "document", text: markdown });
  } else {
    if (entries[0].index > 0) {
      sections.push({ title: "preamble", text: lines.slice(0, entries[0].index).join("\n") });
    }
    entries.forEach(({ index, heading }, position) => {
      const next = entries[position + 1]?.index ?? lines.length;
      sections.push({
        title: heading.title,
        text: lines.slice(index, next).join("\n"),
      });
    });
  }

  for (const section of sections) {
    assert.doesNotMatch(section.text, pattern, message + " (section: " + section.title + ")");
  }
}

export async function assertSkillMarkdownSectionsDoNotMatch(skillDirs, pattern, message) {
  for (const dir of skillDirs) {
    const references = (await readdir(path.resolve(dir, "references"))).filter((file) => file.endsWith(".md"));
    for (const file of ["SKILL.md", ...references.map((reference) => "references/" + reference)]) {
      const markdown = await readFile(path.resolve(dir, file), "utf8");
      assertAbsentFromMarkdownSections(markdown, pattern, message + " (" + file + ")");
    }
  }
}
