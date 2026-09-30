#!/usr/bin/env node
import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SKILL_NAME = "implement-tickets";
const SCHEMA_FILE = fileURLToPath(new URL("../references/envelope.schema.json", import.meta.url));

function takeOne(argv, index, option) {
  const value = argv[index + 1];
  if (value === undefined) throw new Error(`${option} requires a value`);
  return { value, nextIndex: index + 1 };
}

function takeMany(argv, index, option) {
  const values = [];
  let nextIndex = index + 1;
  while (nextIndex < argv.length && !argv[nextIndex].startsWith("--")) {
    values.push(argv[nextIndex]);
    nextIndex += 1;
  }
  if (values.length === 0) throw new Error(`${option} requires at least one value`);
  return { values, nextIndex: nextIndex - 1 };
}

function parseArgs(argv) {
  const options = { with: null, agent: null, model: null, roots: null, locks: null, envelope: null };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--with", "--agent", "--model", "--envelope"].includes(argument)) {
      const { value, nextIndex } = takeOne(argv, index, argument);
      index = nextIndex;
      if (argument === "--with") options.with = value;
      if (argument === "--agent") options.agent = value;
      if (argument === "--model") options.model = value;
      if (argument === "--envelope") options.envelope = path.resolve(value);
    } else if (argument === "--roots" || argument === "--lock") {
      const { values, nextIndex } = takeMany(argv, index, argument);
      index = nextIndex;
      const resolved = values.map((value) => path.resolve(value));
      if (argument === "--roots") options.roots = resolved;
      else options.locks = resolved;
    } else if (argument.startsWith("--")) {
      throw new Error(`unknown option ${argument}`);
    } else {
      throw new Error(`unexpected argument ${argument}`);
    }
  }

  if (options.with && !/^[a-z0-9][a-z0-9-]*$/.test(options.with)) {
    throw new Error("--with requires a lowercase backend name containing letters, numbers, or hyphens");
  }
  if (options.agent && options.with) {
    throw new Error("--agent is only available for the native backend and cannot be combined with --with");
  }

  return options;
}

async function findProjectRoot(start = process.cwd()) {
  let current = path.resolve(start);
  while (true) {
    if (await stat(path.join(current, ".git")).then(() => true).catch(() => false)) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(start);
    current = parent;
  }
}

function defaultSearchRoots(projectRoot) {
  const home = homedir();
  return [
    path.join(projectRoot, ".agents", "skills"),
    path.join(projectRoot, ".claude", "skills"),
    path.join(home, ".agents", "skills"),
    path.join(home, ".claude", "skills"),
  ];
}

function defaultLockFiles(projectRoot) {
  return [
    path.join(projectRoot, "skills-lock.json"),
    path.join(homedir(), ".agents", ".skill-lock.json"),
  ];
}

async function findAdapter(backend, roots) {
  const adapterName = `${SKILL_NAME}-${backend}`;
  for (const root of roots) {
    const candidate = path.resolve(root, adapterName);
    try {
      await access(path.join(candidate, "SKILL.md"), constants.R_OK);
      return { adapterName, adapterPath: candidate };
    } catch {
      // Continue in the declared root order.
    }
  }
  return { adapterName, adapterPath: null };
}

async function lockSource(lockFiles) {
  for (const lockFile of lockFiles) {
    let lock;
    try {
      lock = JSON.parse(await readFile(lockFile, "utf8"));
    } catch {
      continue;
    }
    const source = lock?.skills?.[SKILL_NAME]?.source;
    if (typeof source === "string" && source.trim()) return source.trim();
  }
  return null;
}

function matchesType(value, expected) {
  const types = Array.isArray(expected) ? expected : [expected];
  return types.some((type) => {
    if (type === "null") return value === null;
    if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
    if (type === "array") return Array.isArray(value);
    if (type === "integer") return Number.isInteger(value);
    return typeof value === type;
  });
}

function validateAgainstSchema(value, schema, location = "$", errors = []) {
  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(`${location} must have type ${Array.isArray(schema.type) ? schema.type.join(" or ") : schema.type}`);
    return errors;
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push(`${location} must be one of ${schema.enum.join(", ")}`);
  }
  if (typeof value === "string" && schema.minLength && value.length < schema.minLength) {
    errors.push(`${location} must contain at least ${schema.minLength} character(s)`);
  }
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) {
    errors.push(`${location} must be at least ${schema.minimum}`);
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(value, required)) errors.push(`${location}.${required} is required`);
    }
    const properties = schema.properties ?? {};
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(properties, key) && schema.additionalProperties === false) {
        errors.push(`${location}.${key} is not allowed`);
      } else if (Object.hasOwn(properties, key)) {
        validateAgainstSchema(value[key], properties[key], `${location}.${key}`, errors);
      }
    }
  }

  return errors;
}

async function validateEnvelope(envelopeFile) {
  const schema = JSON.parse(await readFile(SCHEMA_FILE, "utf8"));
  let envelope;
  try {
    envelope = JSON.parse(await readFile(envelopeFile, "utf8"));
  } catch (error) {
    return { valid: false, errors: [`envelope is not valid JSON: ${error.message}`] };
  }

  const errors = validateAgainstSchema(envelope, schema);
  return { valid: errors.length === 0, errors };
}

export async function preflight(options) {
  const projectRoot = await findProjectRoot();
  const roots = options.roots ?? defaultSearchRoots(projectRoot);
  const locks = options.locks ?? defaultLockFiles(projectRoot);
  const source = await lockSource(locks);
  const adapter = options.with ? await findAdapter(options.with, roots) : { adapterName: null, adapterPath: null };

  let installLine = null;
  let note = null;
  let error = null;
  if (options.with && !adapter.adapterPath) {
    const installSource = source ?? "<source of implement-tickets>";
    installLine = `npx skills add ${installSource} --skill ${adapter.adapterName}`;
    error = `adapter ${adapter.adapterName} was not found`;
    if (!source) note = "No implement-tickets entry was found in either lock file; use the source that installed the core.";
  }

  const envelopeValidation = options.envelope ? await validateEnvelope(options.envelope) : null;
  if (envelopeValidation && !envelopeValidation.valid) error ??= "envelope does not match the adapter schema";

  return {
    backend: options.with ?? "native",
    adapterName: adapter.adapterName,
    adapterPath: adapter.adapterPath,
    model: options.model,
    source,
    installLine,
    note,
    envelopeValidation,
    error,
  };
}

async function main(argv) {
  try {
    const options = parseArgs(argv);
    const result = await preflight(options);
    console.log(JSON.stringify(result, null, 2));
    return result.error ? 1 : 0;
  } catch (error) {
    console.error(`preflight: ${error.message}`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
