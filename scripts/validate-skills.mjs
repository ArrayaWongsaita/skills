#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const skillRoot = path.join(repoRoot, "skills");
const excludedSegments = new Set(["node_modules"]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (excludedSegments.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function parseFrontmatter(markdown, file) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, `${file} must start with YAML frontmatter`);

  const fields = new Map();
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([a-z_]+):\s*(.+)$/);
    assert.ok(field, `${file} has invalid frontmatter line: ${line}`);
    fields.set(field[1], field[2].trim());
  }

  return fields;
}

function validateSkillName(name, file) {
  assert.match(name, /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/, `${file} has invalid skill name`);
}

async function validateSkill(file) {
  const markdown = await readFile(file, "utf8");
  const metadata = parseFrontmatter(markdown, file);
  const name = metadata.get("name");
  const description = metadata.get("description");
  const folderName = path.basename(path.dirname(file));

  assert.ok(name, `${file} must define name`);
  assert.ok(description, `${file} must define description`);
  validateSkillName(name, file);
  assert.equal(name, folderName, `${file} name must match its folder`);
  assert.ok(description.length >= 80, `${file} description should explain when to use the skill`);
}

async function main() {
  const files = await walk(skillRoot);
  const skillFiles = files.filter((file) => path.basename(file) === "SKILL.md").sort();

  for (const file of skillFiles) {
    await validateSkill(file);
  }

  const plugin = JSON.parse(await readFile(path.join(repoRoot, ".codex-plugin/plugin.json"), "utf8"));
  assert.equal(plugin.skills, "./skills/", ".codex-plugin/plugin.json must expose ./skills/");

  if (skillFiles.length === 0) {
    console.log("validated 0 skills; add skills under skills/ when ready");
  } else {
    console.log(`validated ${skillFiles.length} skill(s)`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
