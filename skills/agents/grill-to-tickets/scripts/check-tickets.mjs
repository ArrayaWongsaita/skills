#!/usr/bin/env node
// Mechanical checks on a grill-to-tickets feature directory, run before the
// Stage 3 quiz and again after every change the quiz makes:
//
//   node <skill-dir>/scripts/check-tickets.mjs .scratch/<feature-slug>/
//
// - every numbered story under spec.md's "## User Stories" has a ticket;
// - every ticket's **Stories:** names only stories the spec defines;
// - every **Blocked by:** entry names an existing, lower-numbered ticket;
// - every ticket has **Reuse:** directly after **Blocked by:**, using only the
//   fixed verbs;
// - every create-shared and promote entry in spec.md's "### Reuse Plan" has a
//   ticket carrying that verb for its symbol;
// - each create-shared or promote symbol has exactly one ticket, and every
//   other ticket naming that symbol lists it in **Blocked by:**.
//
// Exit codes: 0 clean, 1 errors found, 2 unusable input.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REUSE_VERBS = new Set(["use", "extend", "create-shared", "create-candidate", "promote"]);
const OWNING_VERBS = ["create-shared", "promote"];
const TICKET_FILE = /^(\d{2,})-[a-z0-9][a-z0-9-]*\.md$/;
const STORY_ID = /^\d+[a-z]?$/;

export function parseStories(spec) {
  const lines = spec.split("\n");
  const start = lines.findIndex((line) => /^## User Stories\s*$/.test(line));
  if (start === -1) return [];
  const stories = [];
  for (const line of lines.slice(start + 1)) {
    if (/^## /.test(line)) break;
    const story = line.match(/^(\d+[a-z]?)\.\s+\S/);
    if (story) stories.push(story[1]);
  }
  return stories;
}

// The Reuse Plan's owning entries, one module per bullet:
// "- **Create shared:** `buildRows(report): Row[]` — ..." → buildRows.
export function parseReusePlan(spec) {
  const plan = { "create-shared": [], promote: [] };
  const lines = spec.split("\n");
  const start = lines.findIndex((line) => /^### Reuse Plan\s*$/.test(line));
  if (start === -1) return plan;
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,3} /.test(line)) break;
    const entry = line.match(/^\s*[-*]\s+\*\*(Create shared|Promote):\*\*\s*`([A-Za-z_$][\w$.]*)/);
    if (entry) plan[entry[1] === "Promote" ? "promote" : "create-shared"].push(entry[2]);
  }
  return plan;
}

export function parseTicket(file, text) {
  const heading = text.match(/^#\s+(\d+):\s*(.+?)\s*$/m);
  const fields = [];
  for (const line of text.split("\n")) {
    const field = line.match(/^\*\*([A-Za-z][A-Za-z ]*):\*\*\s*(.*?)\s*$/);
    if (field) fields.push({ name: field[1], value: field[2] });
  }
  return {
    file,
    number: heading ? Number(heading[1]) : null,
    title: heading ? heading[2] : null,
    fields,
    field: (name) => fields.find((f) => f.name === name)?.value,
  };
}

function numberOfFile(file) {
  return Number(file.match(TICKET_FILE)[1]);
}

function parseBlockedBy(value, tickets) {
  const text = value.replace(/\.\s*$/, "").trim();
  if (/^none\b/i.test(text)) return { refs: [], unresolved: [] };
  const segments = text.split(/,\s*/);
  if (!/^#?\d+\b/.test(segments[0])) {
    const titled = tickets.find((t) => t.title?.toLowerCase() === text.toLowerCase());
    if (titled) return { refs: [titled.number], unresolved: [] };
    const refs = [];
    const unresolved = [];
    for (const segment of segments) {
      const match = tickets.find((t) => t.title?.toLowerCase() === segment.trim().toLowerCase());
      if (match) refs.push(match.number);
      else unresolved.push(segment.trim());
    }
    return { refs, unresolved };
  }
  // A segment after a numbered one without its own number continues that
  // ticket's title ("01: Parse, validate, and store"), so it adds no edge.
  const refs = [];
  for (const segment of segments) {
    const numbered = segment.match(/^#?(\d+)\b/);
    if (numbered) refs.push(Number(numbered[1]));
  }
  return { refs, unresolved: [] };
}

function parseReuse(value) {
  if (/^none\b/i.test(value)) return { items: [], problems: [] };
  const items = [];
  const problems = [];
  for (const raw of value.split("·").map((s) => s.trim()).filter(Boolean)) {
    const item = raw.match(/^(\S+)\s+`([^`]+)`/);
    if (!item) {
      problems.push(`"${raw}" is not <verb> \`symbol\``);
    } else if (!REUSE_VERBS.has(item[1])) {
      problems.push(`"${item[1]}" is not a Reuse verb (${[...REUSE_VERBS].join(", ")})`);
    } else {
      items.push({ verb: item[1], symbol: item[2] });
    }
  }
  return { items, problems };
}

function parseStoryRefs(value, stories) {
  if (/^none\b/i.test(value)) return { refs: [], problems: [] };
  const refs = [];
  const problems = [];
  for (const token of value.split(/\s*,\s*/).filter(Boolean)) {
    const range = token.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      const [low, high] = [Number(range[1]), Number(range[2])];
      const inRange = stories.filter((id) => parseInt(id, 10) >= low && parseInt(id, 10) <= high);
      if (inRange.length === 0) problems.push(`range ${token} matches no story in spec.md`);
      refs.push(...inRange);
    } else if (STORY_ID.test(token)) {
      if (stories.includes(token)) refs.push(token);
      else problems.push(`story ${token} is not defined in spec.md`);
    } else {
      problems.push(`"${token}" is not a story number`);
    }
  }
  return { refs, problems };
}

export function checkFeature({ spec, tickets: ticketFiles }) {
  const errors = [];
  const notes = [];
  const stories = parseStories(spec ?? "");
  if (spec === null) errors.push("spec.md is missing");
  else if (stories.length === 0) errors.push('spec.md has no numbered stories under "## User Stories"');

  const tickets = [];
  const seen = new Map();
  for (const { file, text } of ticketFiles) {
    if (!TICKET_FILE.test(file)) {
      errors.push(`issues/${file}: file name must be NN-<slug>.md`);
      continue;
    }
    const ticket = parseTicket(file, text);
    const where = `issues/${file}`;
    if (ticket.number === null) {
      errors.push(`${where}: first heading must be "# NN: <title>"`);
      ticket.number = numberOfFile(file);
    } else if (ticket.number !== numberOfFile(file)) {
      errors.push(`${where}: heading number ${ticket.number} differs from the file number`);
    }
    if (seen.has(ticket.number)) {
      errors.push(`${where}: ticket number ${ticket.number} is also used by issues/${seen.get(ticket.number)}`);
    }
    seen.set(ticket.number, file);
    tickets.push(ticket);
  }
  tickets.sort((a, b) => a.number - b.number);

  const coverage = new Map(stories.map((id) => [id, []]));
  const pad = (n) => String(n).padStart(2, "0");

  for (const ticket of tickets) {
    const where = `issues/${ticket.file}`;

    const blockedBy = ticket.field("Blocked by");
    ticket.blockers = new Set();
    if (blockedBy === undefined) {
      errors.push(`${where}: **Blocked by:** is missing`);
    } else {
      const { refs, unresolved } = parseBlockedBy(blockedBy, tickets);
      for (const name of unresolved) errors.push(`${where}: Blocked by "${name}" matches no ticket`);
      for (const ref of refs) {
        if (!seen.has(ref)) errors.push(`${where}: Blocked by ${pad(ref)}, which does not exist`);
        else if (ref >= ticket.number) {
          errors.push(`${where}: Blocked by ${pad(ref)}; a blocker must have a lower number`);
        }
        ticket.blockers.add(ref);
      }
    }

    const reuse = ticket.field("Reuse");
    ticket.reuse = [];
    if (reuse === undefined) {
      errors.push(`${where}: **Reuse:** is missing (write "**Reuse:** none" when it has no reuse action)`);
    } else {
      const blockedIndex = ticket.fields.findIndex((f) => f.name === "Blocked by");
      if (blockedIndex !== -1 && ticket.fields[blockedIndex + 1]?.name !== "Reuse") {
        errors.push(`${where}: **Reuse:** must come directly after **Blocked by:**`);
      }
      const { items, problems } = parseReuse(reuse);
      for (const problem of problems) errors.push(`${where}: Reuse ${problem}`);
      ticket.reuse = items;
    }

    const storyField = ticket.field("Stories");
    if (storyField === undefined) {
      errors.push(`${where}: **Stories:** is missing (the spec's story numbers it delivers, or "none")`);
    } else {
      const { refs, problems } = parseStoryRefs(storyField, stories);
      for (const problem of problems) errors.push(`${where}: Stories ${problem}`);
      for (const ref of refs) coverage.get(ref)?.push(ticket.number);
      if (refs.length === 0 && problems.length === 0) notes.push(`${where} delivers no story (Stories: none)`);
    }
  }

  const plan = parseReusePlan(spec ?? "");
  for (const verb of OWNING_VERBS) {
    for (const symbol of plan[verb]) {
      const carried = tickets.some((t) => t.reuse.some((i) => i.verb === verb && i.symbol === symbol));
      if (!carried) errors.push(`Reuse Plan ${verb} \`${symbol}\` has no ticket carrying "${verb} \`${symbol}\`"`);
    }
  }

  for (const verb of OWNING_VERBS) {
    const owners = new Map();
    for (const ticket of tickets) {
      for (const item of ticket.reuse.filter((i) => i.verb === verb)) {
        owners.set(item.symbol, [...(owners.get(item.symbol) ?? []), ticket]);
      }
    }
    for (const [symbol, owning] of owners) {
      if (owning.length > 1) {
        const list = owning.map((t) => pad(t.number)).join(", ");
        errors.push(`${verb} \`${symbol}\` appears on tickets ${list}; exactly one ticket may carry it`);
        continue;
      }
      const owner = owning[0];
      for (const ticket of tickets) {
        if (ticket === owner) continue;
        const names = ticket.reuse.some((i) => i.symbol === symbol && (i.verb === "use" || i.verb === "extend"));
        if (names && !ticket.blockers.has(owner.number)) {
          errors.push(
            `issues/${ticket.file}: uses \`${symbol}\`, so it must list its ${verb} ticket ${pad(owner.number)} in Blocked by`,
          );
        }
      }
    }
  }

  for (const [id, covering] of coverage) {
    if (covering.length === 0) errors.push(`story ${id} has no ticket`);
  }

  return { errors, notes, coverage, tickets: tickets.map((t) => t.number) };
}

export async function checkFeatureDir(dir) {
  const spec = await readFile(path.join(dir, "spec.md"), "utf8").catch(() => null);
  const issuesDir = path.join(dir, "issues");
  const names = (await readdir(issuesDir)).filter((name) => name.endsWith(".md")).sort();
  const tickets = await Promise.all(
    names.map(async (file) => ({ file, text: await readFile(path.join(issuesDir, file), "utf8") })),
  );
  return checkFeature({ spec, tickets });
}

export function formatReport(dir, { errors, notes, coverage }) {
  const pad = (n) => String(n).padStart(2, "0");
  const lines = [`check-tickets: ${dir}`];
  if (errors.length > 0) {
    lines.push(`errors (${errors.length}):`, ...errors.map((e) => `  - ${e}`));
  }
  lines.push("story coverage:");
  for (const [id, covering] of coverage) {
    lines.push(`  ${id} → ${covering.length ? covering.map(pad).join(", ") : "(none)"}`);
  }
  if (notes.length > 0) lines.push("notes:", ...notes.map((n) => `  - ${n}`));
  const count = `${errors.length} error${errors.length === 1 ? "" : "s"}`;
  lines.push(errors.length === 0 ? "result: PASS" : `result: FAIL (${count})`);
  return lines.join("\n");
}

async function main(argv) {
  const dir = argv[0];
  if (!dir) {
    console.error("usage: node check-tickets.mjs .scratch/<feature-slug>/");
    return 2;
  }
  let result;
  try {
    result = await checkFeatureDir(dir);
  } catch (error) {
    console.error(`check-tickets: cannot read ${path.join(dir, "issues")}: ${error.message}`);
    return 2;
  }
  console.log(formatReport(dir, result));
  return result.errors.length === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
