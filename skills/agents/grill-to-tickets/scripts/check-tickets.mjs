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
// - every ticket has **Seam:** directly after **Stories:**;
// - every ticket has **Context:** directly after **Seam:**;
// - every **Seam:** and **Context:** is a single non-empty line with no non-field line directly after it;
// - every spec § ref in **Context:** matches exactly one heading in spec.md;
// - every path in **Context:** is relative to the project root, does not escape it, and is not a directory;
// - every plain and (edit) file in **Context:** exists in the repository;
// - every (new) file in **Context:** does not exist yet, and only one ticket marks it (new);
// - every (from NN) and (edit from NN) file in **Context:** is created by a transitive blocker NN marked (new);
// - every create-shared and promote entry in spec.md's "### Reuse Plan" has a
//   ticket carrying that verb for its symbol;
// - each create-shared or promote symbol has exactly one ticket, and every
//   other ticket naming that symbol lists it in **Blocked by:**.
//
// Exit codes: 0 clean, 1 errors found, 2 unusable input.

import { readFile, readdir, stat } from "node:fs/promises";
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

export function sectionOf(spec, ref) {
  if (typeof spec !== "string" || !ref) {
    return { error: "missing" };
  }

  const lines = spec.split("\n");
  let inFenced = false;
  let fenceChar = "";
  let fenceLen = 0;

  const headings = [];
  const ancestorStack = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const char = fenceMatch[1][0];
      const len = fenceMatch[1].length;
      if (!inFenced) {
        inFenced = true;
        fenceChar = char;
        fenceLen = len;
        continue;
      } else if (char === fenceChar && len >= fenceLen) {
        inFenced = false;
        continue;
      }
    }

    if (inFenced) continue;

    const hMatch = line.match(/^ {0,3}(#{1,6})(?:\s+(.*)|\s*$)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const rawText = hMatch[2] || "";
      const text = rawText.replace(/^[\s#]+/, "").replace(/[\s#]+$/, "").trim();

      while (ancestorStack.length > 0 && ancestorStack[ancestorStack.length - 1].level >= level) {
        ancestorStack.pop();
      }

      const ancestors = ancestorStack.map((a) => a.text);
      headings.push({ text, level, lineIndex: i, ancestors });
      ancestorStack.push({ text, level });
    }
  }

  const segments = ref.split("›").map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return { error: "missing" };

  const targetHeading = segments[segments.length - 1];
  const refAncestors = segments.slice(0, -1);

  const matches = headings.filter((h) => {
    if (h.text !== targetHeading) return false;
    if (refAncestors.length === 0) return true;
    let aIdx = 0;
    for (const needed of refAncestors) {
      let found = false;
      while (aIdx < h.ancestors.length) {
        if (h.ancestors[aIdx] === needed) {
          found = true;
          aIdx++;
          break;
        }
        aIdx++;
      }
      if (!found) return false;
    }
    return true;
  });

  if (matches.length === 0) return { error: "missing" };
  if (matches.length > 1) return { error: "ambiguous" };

  const matched = matches[0];
  const startLine = matched.lineIndex;

  let endLine = lines.length;
  for (const h of headings) {
    if (h.lineIndex > startLine && h.level <= matched.level) {
      endLine = h.lineIndex;
      break;
    }
  }

  const text = lines.slice(startLine, endLine).join("\n");
  return { text };
}

export function parseTicket(file, text) {
  const heading = text.match(/^#\s+(\d+):\s*(.+?)\s*$/m);
  const lines = text.split("\n");
  const fields = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const field = line.match(/^\*\*([A-Za-z][A-Za-z ]*):\*\*\s*(.*?)\s*$/);
    if (field) fields.push({ name: field[1], value: field[2], lineIndex: i });
  }
  return {
    file,
    number: heading ? Number(heading[1]) : null,
    title: heading ? heading[2] : null,
    fields,
    lines,
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

function isFollowedByNonField(field, lines) {
  if (!lines) return false;
  const nextIdx = field.lineIndex + 1;
  if (nextIdx >= lines.length) return false;
  const nextLine = lines[nextIdx];
  if (nextLine.trim() === "") return false;
  return !/^\*\*([A-Za-z][A-Za-z ]*):\*\*/.test(nextLine);
}

function getFile(files, normPath) {
  if (!files) return null;
  if (files instanceof Map) {
    return files.has(normPath) ? files.get(normPath) : null;
  }
  return Object.hasOwn(files, normPath) ? files[normPath] : null;
}

export function checkFeature({ spec, tickets: ticketFiles, files }) {
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

    // Seam validation
    const seamFields = ticket.fields.filter((f) => f.name === "Seam");
    if (seamFields.length === 0) {
      errors.push(`${where}: **Seam:** is missing`);
    } else {
      if (seamFields.length > 1) {
        errors.push(`${where}: **Seam:** is repeated`);
      }
      if (seamFields[0].value.trim() === "") {
        errors.push(`${where}: **Seam:** is empty`);
      }
      const storiesIndex = ticket.fields.findIndex((f) => f.name === "Stories");
      const seamIndex = ticket.fields.findIndex((f) => f.name === "Seam");
      if (storiesIndex !== -1 && seamIndex !== storiesIndex + 1) {
        errors.push(`${where}: **Seam:** must come directly after **Stories:**`);
      }
      for (const sf of seamFields) {
        if (isFollowedByNonField(sf, ticket.lines)) {
          errors.push(`${where}: **Seam:** is followed directly by a non-field line`);
        }
      }
    }

    // Context validation
    const contextFields = ticket.fields.filter((f) => f.name === "Context");
    if (contextFields.length === 0) {
      errors.push(`${where}: **Context:** is missing`);
    } else {
      if (contextFields.length > 1) {
        errors.push(`${where}: **Context:** is repeated`);
      }
      if (contextFields[0].value.trim() === "") {
        errors.push(`${where}: **Context:** is empty`);
      }
      const seamIndex = ticket.fields.findIndex((f) => f.name === "Seam");
      const contextIndex = ticket.fields.findIndex((f) => f.name === "Context");
      if (seamIndex !== -1 && contextIndex !== seamIndex + 1) {
        errors.push(`${where}: **Context:** must come directly after **Seam:**`);
      }
      for (const cf of contextFields) {
        if (isFollowedByNonField(cf, ticket.lines)) {
          errors.push(`${where}: **Context:** is followed directly by a non-field line`);
        }
      }
    }
  }

  // Calculate transitive blockers for each ticket
  const ticketMap = new Map(tickets.map((t) => [t.number, t]));
  const transitiveBlockers = new Map();
  for (const t of tickets) {
    const allBlockers = new Set();
    const queue = [...(t.blockers || [])];
    while (queue.length > 0) {
      const bNum = queue.pop();
      if (!allBlockers.has(bNum)) {
        allBlockers.add(bNum);
        const bTicket = ticketMap.get(bNum);
        if (bTicket && bTicket.blockers) {
          for (const nextB of bTicket.blockers) {
            if (!allBlockers.has(nextB)) queue.push(nextB);
          }
        }
      }
    }
    transitiveBlockers.set(t.number, allBlockers);
  }

  // Collect (new) paths per ticket and detect duplicate (new) across tickets
  const newPathsByTicket = new Map();
  for (const ticket of tickets) {
    ticket.newPaths = new Set();
    const contextVal = ticket.field("Context");
    if (!contextVal) continue;
    const items = contextVal.split("·").map((s) => s.trim()).filter(Boolean);
    for (const item of items) {
      const newMatch = item.match(/^\(new\)\s+(.+)$/);
      if (newMatch) {
        const norm = path.posix.normalize(newMatch[1].trim());
        ticket.newPaths.add(norm);
        const list = newPathsByTicket.get(norm) ?? [];
        list.push(ticket);
        newPathsByTicket.set(norm, list);
      }
    }
  }

  for (const [norm, ownerTickets] of newPathsByTicket) {
    if (ownerTickets.length > 1) {
      const list = ownerTickets.map((t) => pad(t.number)).join(", ");
      errors.push(`Context path "${norm}" is marked (new) by multiple tickets (${list})`);
    }
  }

  // Validate Context items
  for (const ticket of tickets) {
    const where = `issues/${ticket.file}`;
    const contextVal = ticket.field("Context");
    if (!contextVal) continue;
    const items = contextVal.split("·").map((s) => s.trim()).filter(Boolean);

    for (const item of items) {
      const specMatch = item.match(/^spec\s+§\s+(.+)$/);
      if (specMatch) {
        const ref = specMatch[1].trim();
        if (spec !== null) {
          const res = sectionOf(spec, ref);
          if (res.error === "missing") {
            errors.push(`${where}: Context spec § ${ref} matches no heading in spec.md`);
          } else if (res.error === "ambiguous") {
            errors.push(`${where}: Context spec § ${ref} is ambiguous`);
          }
        }
        continue;
      }

      let marker = "plain";
      let rawPath = "";
      let fromTicketNumber = null;

      const fromMatch = item.match(/^\(from\s+(\d+)\)\s+(.+)$/);
      const editFromMatch = item.match(/^\(edit\s+from\s+(\d+)\)\s+(.+)$/);
      const editMatch = item.match(/^\(edit\)\s+(.+)$/);
      const newMatch = item.match(/^\(new\)\s+(.+)$/);

      if (fromMatch) {
        marker = "from";
        fromTicketNumber = Number(fromMatch[1]);
        rawPath = fromMatch[2].trim();
      } else if (editFromMatch) {
        marker = "edit from";
        fromTicketNumber = Number(editFromMatch[1]);
        rawPath = editFromMatch[2].trim();
      } else if (editMatch) {
        marker = "edit";
        rawPath = editMatch[1].trim();
      } else if (newMatch) {
        marker = "new";
        rawPath = newMatch[1].trim();
      } else {
        marker = "plain";
        rawPath = item.trim();
      }

      if (path.posix.isAbsolute(rawPath)) {
        errors.push(`${where}: Context path "${rawPath}" is absolute`);
        continue;
      }

      const norm = path.posix.normalize(rawPath);
      if (norm.startsWith("../") || norm === ".." || norm.startsWith("/..")) {
        errors.push(`${where}: Context path "${rawPath}" escapes the project root`);
        continue;
      }

      const fileEntry = getFile(files, norm);
      if (fileEntry && typeof fileEntry === "object" && fileEntry.directory) {
        errors.push(`${where}: Context path "${norm}" is a directory`);
        continue;
      }

      if (marker === "plain") {
        if (fileEntry === null) {
          errors.push(`${where}: Context path "${norm}" does not exist`);
        }
      } else if (marker === "edit") {
        if (fileEntry === null) {
          errors.push(`${where}: Context (edit) path "${norm}" does not exist`);
        }
      } else if (marker === "new") {
        if (fileEntry !== null) {
          errors.push(`${where}: Context (new) path "${norm}" already exists`);
        }
      } else if (marker === "from" || marker === "edit from") {
        const nn = fromTicketNumber;
        const creator = ticketMap.get(nn);
        if (!creator) {
          errors.push(`${where}: Context (${marker} ${pad(nn)}) ticket ${nn} does not exist`);
        } else {
          const tBlockers = transitiveBlockers.get(ticket.number) ?? new Set();
          if (!tBlockers.has(nn)) {
            errors.push(`${where}: Context (${marker} ${pad(nn)}) ticket ${pad(nn)} is not a transitive blocker`);
          }
          if (!creator.newPaths.has(norm)) {
            errors.push(`${where}: Context (${marker} ${pad(nn)}) ticket ${pad(nn)} does not mark "${norm}" as (new)`);
          }
        }
      }
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

export function findProjectRoot(dir) {
  let current = path.resolve(dir);
  while (true) {
    if (path.basename(current) === ".scratch") {
      return path.dirname(current);
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`cannot find .scratch ancestor for ${dir}`);
    }
    current = parent;
  }
}

export async function checkFeatureDir(dir) {
  const projectRoot = findProjectRoot(dir);
  const spec = await readFile(path.join(dir, "spec.md"), "utf8").catch(() => null);
  const issuesDir = path.join(dir, "issues");
  const names = (await readdir(issuesDir)).filter((name) => name.endsWith(".md")).sort();
  const tickets = await Promise.all(
    names.map(async (file) => ({ file, text: await readFile(path.join(issuesDir, file), "utf8") })),
  );

  const files = new Map();
  for (const { text, file } of tickets) {
    const ticketObj = parseTicket(file, text);
    const contextVal = ticketObj.field("Context");
    if (!contextVal) continue;
    const items = contextVal.split("·").map((s) => s.trim()).filter(Boolean);
    for (const item of items) {
      if (item.startsWith("spec §") || item.startsWith("spec\t§")) continue;
      let rawPath = item;
      const m = item.match(/^\((?:edit|new|from\s+\d+|edit\s+from\s+\d+)\)\s+(.+)$/);
      if (m) rawPath = m[1];
      const norm = path.posix.normalize(rawPath.trim());
      if (path.posix.isAbsolute(norm) || norm.startsWith("../") || norm === "..") {
        continue;
      }
      if (!files.has(norm)) {
        const fullPath = path.resolve(projectRoot, norm);
        try {
          const st = await stat(fullPath);
          if (st.isDirectory()) {
            files.set(norm, { directory: true });
          } else {
            files.set(norm, await readFile(fullPath, "utf8"));
          }
        } catch (err) {
          if (err.code === "ENOENT") {
            files.set(norm, null);
          } else {
            throw err;
          }
        }
      }
    }
  }

  return checkFeature({ spec, tickets, files });
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
    console.error(`check-tickets: ${error.message}`);
    return 2;
  }
  console.log(formatReport(dir, result));
  return result.errors.length === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
