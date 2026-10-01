#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const TICKET_FILE = /^(\d{2,})-[a-z0-9][a-z0-9-]*\.md$/;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_MARKER = fileURLToPath(new URL("../references/parallel-validation.md", import.meta.url));

function padTicket(number) {
  return String(number).padStart(2, "0");
}

function fieldValue(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`^\\*\\*${escaped}:\\*\\*[ \\t]*([^\\r\\n]*?)[ \\t]*$`, "m"))?.[1];
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

  return {
    file,
    number,
    numberText,
    title: heading[2],
    blockedByText: fieldValue(text, "Blocked by"),
    contextText,
    seam: fieldValue(text, "Seam") ?? "",
    budget: fieldValue(text, "Budget") ?? "none",
    touchSet: null,
    warnings: [],
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

function pathsOverlap(left, right) {
  if (left === right || left === "." || right === ".") return true;
  return left.startsWith(`${right.replace(/\/$/, "")}/`) || right.startsWith(`${left.replace(/\/$/, "")}/`);
}

function touchSetsOverlap(left, right) {
  return left.some((leftPath) => right.some((rightPath) => pathsOverlap(leftPath, rightPath)));
}

function makeWaves(tickets, { serial }) {
  const byNumber = new Map(tickets.map((ticket) => [ticket.numberText, ticket]));
  const occupied = new Map();
  const exclusiveWaves = new Set();
  let serialWave = 0;

  for (const ticket of tickets) {
    const blockerWave = Math.max(0, ...ticket.blockers.map((number) => byNumber.get(number).wave));

    if (serial) {
      ticket.wave = Math.max(++serialWave, blockerWave + 1);
    } else {
      let candidate = blockerWave + 1;
      while (true) {
        const inWave = occupied.get(candidate) ?? [];
        const conflicts = exclusiveWaves.has(candidate)
          || (ticket.touchSet === null && inWave.length > 0)
          || (ticket.touchSet !== null && inWave.some((other) =>
            other.touchSet === null || touchSetsOverlap(ticket.touchSet, other.touchSet)));
        if (!conflicts) break;
        candidate += 1;
      }
      ticket.wave = candidate;
    }

    const inWave = occupied.get(ticket.wave) ?? [];
    inWave.push(ticket);
    occupied.set(ticket.wave, inWave);

    if (ticket.touchSet === null) {
      exclusiveWaves.add(ticket.wave);
      ticket.warnings.push(`Ticket ${ticket.numberText} has an unknown touch set and runs alone.`);
    }
  }

  const highest = Math.max(0, ...tickets.map((ticket) => ticket.wave));
  return Array.from({ length: highest }, (_, index) =>
    (occupied.get(index + 1) ?? []).map((ticket) => ticket.numberText),
  );
}

async function readParallelValidation(markerFile) {
  let marker;
  try {
    marker = await readFile(markerFile, "utf8");
  } catch {
    return { status: "not validated", validated: false };
  }

  const status = marker.match(/^\s*status:\s*(not validated|validated\s+\d{4}-\d{2}-\d{2})\s*$/m)?.[1]
    ?? "not validated";
  return { status, validated: status.startsWith("validated ") };
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

function isUsableManifest(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && value.version === 1
    && typeof value.specSha256 === "string"
    && Array.isArray(value.tickets)
    && value.tickets.every((ticket) => ticket !== null
      && typeof ticket === "object"
      && !Array.isArray(ticket)
      && Number.isInteger(ticket.number)
      && typeof ticket.file === "string"
      && Array.isArray(ticket.blockedBy)
      && ticket.blockedBy.every((blocker) => Number.isInteger(blocker)))
    && new Set(value.tickets.map((ticket) => ticket.number)).size === value.tickets.length;
}

function manifestStatus(status, warning) {
  return { statuses: [status], warnings: warning ? [warning] : [] };
}

function manifestTicketFacts(value) {
  const tickets = new Map();
  for (const ticket of value.tickets) {
    const file = path.posix.basename(ticket.file.replaceAll("\\", "/"));
    const match = file.match(TICKET_FILE);
    if (!match) continue;

    tickets.set(ticket.number, {
      file,
      blockers: [...new Set(ticket.blockedBy.map(Number))].sort((a, b) => a - b),
    });
  }
  return tickets;
}

function currentTicketFacts(tickets) {
  return new Map(tickets.map((ticket) => [ticket.number, {
    file: ticket.file,
    blockers: ticket.blockers.map(Number).sort((a, b) => a - b),
  }]));
}

function ticketSetWarnings(manifestTickets, tickets) {
  const currentTickets = currentTicketFacts(tickets);
  const numbers = [...new Set([...manifestTickets.keys(), ...currentTickets.keys()])]
    .sort((a, b) => a - b);
  const warnings = [];

  for (const number of numbers) {
    const recorded = manifestTickets.get(number);
    const current = currentTickets.get(number);
    const numberText = padTicket(number);
    if (!recorded) {
      warnings.push(`Ticket ${numberText} was added after the manifest was written.`);
      continue;
    }
    if (!current) {
      warnings.push(`Ticket ${numberText} recorded in the manifest is missing from the current ticket set.`);
      continue;
    }
    if (recorded.file !== current.file) {
      warnings.push(`Ticket ${numberText} was renamed from ${recorded.file} to ${current.file} after the manifest was written.`);
    }
    if (recorded.blockers.length !== current.blockers.length
      || recorded.blockers.some((blocker, index) => blocker !== current.blockers[index])) {
      warnings.push(`Ticket ${numberText} has different resolved blockers than the manifest.`);
    }
  }

  return warnings;
}

async function readManifest(featureDirectory, tickets) {
  let bytes;
  try {
    bytes = await readFile(path.join(featureDirectory, "manifest.json"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return manifestStatus("missing", "Manifest is missing; run the ticket checker with --write-budget to create it.");
    }
    return manifestStatus("ignored", "Manifest was ignored because it could not be read.");
  }

  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    return manifestStatus("ignored", "Manifest was ignored because it is not valid JSON.");
  }
  if (!isUsableManifest(value)) {
    return manifestStatus("ignored", "Manifest was ignored because its version or required data is unsupported.");
  }

  const statuses = [];
  const warnings = [];
  let specBytes;
  try {
    specBytes = await readFile(path.join(featureDirectory, "spec.md"));
  } catch {
    statuses.push("spec unavailable");
    warnings.push("Spec fingerprint cannot be checked because spec.md is unavailable.");
  }

  if (specBytes) {
    const currentSpecSha256 = createHash("sha256").update(specBytes).digest("hex");
    if (currentSpecSha256 !== value.specSha256) {
      statuses.push("spec changed");
      warnings.push("Spec changed since the tickets were checked; re-run the ticket checker with --write-budget to refresh the manifest.");
    }
  }

  const comparisonWarnings = ticketSetWarnings(manifestTicketFacts(value), tickets);
  if (comparisonWarnings.length > 0) {
    statuses.push("ticket set differs");
    warnings.push(...comparisonWarnings);
  }
  if (statuses.length === 0) statuses.push("matches");
  return { statuses, warnings };
}

function featureDirectoryFor(directory, ticketDirectory) {
  const absoluteTicketDirectory = path.resolve(ticketDirectory);
  if (path.basename(absoluteTicketDirectory) === "issues") {
    return path.dirname(absoluteTicketDirectory);
  }
  return path.resolve(directory);
}

function parseArguments(argv) {
  const result = { directory: null, serial: false, concurrency: DEFAULT_CONCURRENCY, marker: DEFAULT_MARKER };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--serial") {
      result.serial = true;
    } else if (argument === "--concurrency" || argument === "--marker") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
      index += 1;
      if (argument === "--marker") {
        result.marker = path.resolve(value);
      } else {
        const concurrency = Number(value);
        if (!Number.isInteger(concurrency) || concurrency < 1) {
          throw new Error("--concurrency must be a positive integer");
        }
        result.concurrency = concurrency;
      }
    } else if (argument.startsWith("--")) {
      throw new Error(`unknown option ${argument}`);
    } else if (result.directory === null) {
      result.directory = argument;
    } else {
      throw new Error(`unexpected argument ${argument}`);
    }
  }

  if (!result.directory) throw new Error("usage: node waves.mjs <ticket-dir> [--serial] [--concurrency N] [--marker <file>]");
  return result;
}

export async function planWaves({ directory, serial = false, concurrency = DEFAULT_CONCURRENCY, marker = DEFAULT_MARKER }) {
  const { ticketDirectory, tickets } = await loadTickets(directory);
  const waves = makeWaves(tickets, { serial });
  const validation = await readParallelValidation(marker);
  const manifest = await readManifest(featureDirectoryFor(directory, ticketDirectory), tickets);
  const warnings = [...tickets.flatMap((ticket) => ticket.warnings), ...manifest.warnings];

  return {
    concurrency,
    serial,
    parallelValidated: validation.validated,
    parallelValidationStatus: validation.status,
    manifest,
    waves,
    tickets: tickets.map(({ numberText, title, blockers, wave, touchSet, budget, warnings: ticketWarnings }) => ({
      number: numberText,
      title,
      wave,
      blockers,
      touchSet,
      budget,
      warnings: ticketWarnings,
    })),
    warnings,
  };
}

async function main(argv) {
  try {
    const options = parseArguments(argv);
    const result = await planWaves(options);
    console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (error) {
    console.error(`waves: ${error.message}`);
    return 2;
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
