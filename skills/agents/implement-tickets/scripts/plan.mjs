#!/usr/bin/env node
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const TICKET_FILE = /^(\d{2,})-[a-z0-9][a-z0-9-]*\.md$/;

function padTicket(number) {
  return String(number).padStart(2, "0");
}

function fieldValue(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`^\\*\\*${escaped}:\\*\\*[ \\t]*([^\\r\\n]*?)[ \\t]*$`, "m"))?.[1];
}

// A missing Risk field is low; `low` and `high — <reason>` are read as written;
// anything else, including a repeated Risk line, is treated as high with a
// warning. fieldValue already trims the value, as check-tickets.mjs does.
function parseRisk(numberText, riskText, riskLineCount) {
  if (riskLineCount > 1) return { level: "high", warning: `Ticket ${numberText} repeats the Risk field and is treated as high.` };
  if (riskText === undefined) return { level: "low", warning: null };
  if (riskText === "low") return { level: "low", warning: null };
  if (/^high — \S.*$/.test(riskText)) return { level: "high", warning: null };
  return { level: "high", warning: `Ticket ${numberText} has a malformed Risk value "${riskText}" and is treated as high.` };
}

function parseTicket(file, text) {
  const filename = file.match(TICKET_FILE);
  const heading = text.match(/^#\s+(\d+):\s*(.+?)\s*$/m);
  if (!filename || !heading) {
    throw new Error(`${file}: expected a numbered ticket filename and "# NN: title" heading`);
  }

  const number = Number(filename[1]);
  if (Number(heading[1]) !== number) {
    throw new Error(`${file}: heading number ${padTicket(Number(heading[1]))} differs from the filename`);
  }

  const numberText = padTicket(number);
  const contextText = fieldValue(text, "Context");
  if (!contextText?.trim()) {
    throw new Error(`issues/${numberText}: **Context:** is missing or empty`);
  }

  const { level: risk, warning: riskWarning } = parseRisk(numberText, fieldValue(text, "Risk"), (text.match(/^\*\*Risk:\*\*/gm) ?? []).length);

  return {
    file,
    number,
    numberText,
    title: heading[2],
    blockedByText: fieldValue(text, "Blocked by"),
    contextText,
    seam: fieldValue(text, "Seam") ?? "",
    risk,
    touchSet: null,
    warnings: riskWarning ? [riskWarning] : [],
  };
}

function parseBlockers(ticket, ticketsByNumber, ticketsByTitle) {
  const value = ticket.blockedByText?.trim();
  if (!value) throw new Error(`issues/${ticket.numberText}: **Blocked by:** is missing or empty`);
  if (/^none(?:\s*\(can start immediately\))?$/i.test(value)) return [];

  const blockers = new Set();
  for (const ref of value.split(",").map((item) => item.trim()).filter(Boolean)) {
    let number;
    const numeric = ref.match(/^#?\s*(\d+)\b/);
    if (numeric) {
      number = Number(numeric[1]);
    } else {
      const byTitle = ticketsByTitle.get(ref.toLowerCase());
      number = byTitle?.number;
    }

    const blocker = ticketsByNumber.get(number);
    if (!blocker) {
      throw new Error(`issues/${ticket.numberText}: Blocked by reference "${ref}" matches no ticket`);
    }
    if (blocker.number >= ticket.number) {
      throw new Error(`issues/${ticket.numberText}: blocker ${blocker.numberText} must have a lower number`);
    }
    blockers.add(blocker.numberText);
  }

  return [...blockers].sort((a, b) => Number(a) - Number(b));
}

function isGlobPath(value) {
  return /[*?{}\[\]]/.test(value);
}

function parseTouchSet(contextText) {
  const paths = new Set();
  let hasGlob = false;

  for (const rawItem of contextText.split("·").map((item) => item.trim()).filter(Boolean)) {
    const item = rawItem.match(/^\(edit\s+from\s+\d+\)\s+(.+)$/)
      ?? rawItem.match(/^\(edit\)\s+(.+)$/)
      ?? rawItem.match(/^\(new\)\s+(.+)$/);
    if (!item) continue;

    const rawPath = item[1].trim();
    if (!rawPath) continue;
    if (isGlobPath(rawPath)) {
      hasGlob = true;
      continue;
    }
    paths.add(path.posix.normalize(rawPath));
  }

  if (paths.size === 0 || hasGlob) return null;
  return [...paths].sort();
}

async function findTicketDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  if (entries.some((entry) => entry.isFile() && TICKET_FILE.test(entry.name))) return directory;
  const issues = path.join(directory, "issues");
  if ((await stat(issues).catch(() => null))?.isDirectory()) return issues;
  return directory;
}

async function loadTickets(directory) {
  const ticketDirectory = await findTicketDirectory(directory);
  const files = (await readdir(ticketDirectory))
    .filter((file) => TICKET_FILE.test(file))
    .sort((a, b) => Number(a.match(TICKET_FILE)[1]) - Number(b.match(TICKET_FILE)[1]));
  const tickets = await Promise.all(files.map(async (file) =>
    parseTicket(file, await readFile(path.join(ticketDirectory, file), "utf8"))));
  tickets.sort((a, b) => a.number - b.number);

  const ticketsByNumber = new Map();
  const ticketsByTitle = new Map();
  for (const ticket of tickets) {
    if (ticketsByNumber.has(ticket.number)) {
      throw new Error(`duplicate ticket number ${ticket.numberText}`);
    }
    ticketsByNumber.set(ticket.number, ticket);
    ticketsByTitle.set(ticket.title.toLowerCase(), ticket);
  }

  for (const ticket of tickets) {
    ticket.blockers = parseBlockers(ticket, ticketsByNumber, ticketsByTitle);
    ticket.touchSet = parseTouchSet(ticket.contextText);
  }
  return { ticketDirectory, tickets };
}

export async function planTickets({ directory }) {
  const { tickets } = await loadTickets(directory);
  for (const ticket of tickets) {
    if (ticket.touchSet === null) {
      ticket.warnings.push(`Ticket ${ticket.numberText} has an unknown touch set.`);
    }
  }

  return {
    tickets: tickets.map(({ numberText, title, blockers, touchSet, seam, risk, warnings }) => ({
      number: numberText,
      title,
      blockers,
      touchSet,
      seam,
      risk,
      warnings,
    })),
    warnings: tickets.flatMap((ticket) => ticket.warnings),
  };
}

async function main(argv) {
  try {
    const [directory, ...rest] = argv;
    if (!directory || rest.length > 0 || directory.startsWith("--")) {
      throw new Error("usage: node plan.mjs <ticket-dir>");
    }
    console.log(JSON.stringify(await planTickets({ directory }), null, 2));
    return 0;
  } catch (error) {
    console.error(`plan: ${error.message}`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
