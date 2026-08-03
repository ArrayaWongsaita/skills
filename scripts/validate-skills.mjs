#!/usr/bin/env node
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import { discoverSkills, indexPath, renderIndex, repoRoot } from "./generate-skill-index.mjs";

const skillNamePattern = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/;
const categoryPattern = /^[a-z0-9][a-z0-9-]*$/;

async function exists(file) {
  try {
    await access(file, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function hasGuideSection(guide, heading) {
  return new RegExp(`^## ${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m").test(guide);
}

async function validate() {
  const errors = [];
  const skillRoot = path.join(repoRoot, "skills");
  const skills = await discoverSkills();
  const names = new Map();

  for (const skill of skills) {
    if (!categoryPattern.test(skill.category)) {
      errors.push(`${skill.skillPath}: category must use lowercase letters, numbers, and hyphens`);
    }

    if (!skillNamePattern.test(skill.name)) {
      errors.push(`${skill.skillPath}: skill name must use lowercase letters, numbers, and hyphens`);
    }

    if (!skill.description) {
      errors.push(`${skill.skillPath}/SKILL.md: description is required`);
    } else if (skill.description.length < 80) {
      errors.push(`${skill.skillPath}/SKILL.md: description should be at least 80 characters`);
    }

    if (!skill.metadataName) {
      errors.push(`${skill.skillPath}/SKILL.md: name is required`);
    } else if (skill.metadataName !== path.posix.basename(skill.skillPath)) {
      errors.push(`${skill.skillPath}/SKILL.md: frontmatter name must match its directory`);
    }

    if (names.has(skill.name)) {
      errors.push(`${skill.skillPath}: duplicate skill name; also found at ${names.get(skill.name)}`);
    } else {
      names.set(skill.name, skill.skillPath);
    }

    const guideFile = path.join(repoRoot, skill.guidePath);
    if (!await exists(guideFile)) {
      errors.push(`${skill.guidePath}: guide is missing`);
      continue;
    }

    const guide = await readFile(guideFile, "utf8");
    if (!hasGuideSection(guide, "ภาษาไทย / Thai")) {
      errors.push(`${skill.guidePath}: Thai guide section is missing`);
    }
    if (!hasGuideSection(guide, "English / ภาษาอังกฤษ")) {
      errors.push(`${skill.guidePath}: English guide section is missing`);
    }
    if (!guide.includes(`npx skills add ArrayaWongsaita/skills`) || !guide.includes(`--skill ${skill.name}`)) {
      errors.push(`${skill.guidePath}: install command for ${skill.name} is missing`);
    }
  }

  const skillFiles = (await walk(skillRoot)).filter((file) => path.basename(file) === "SKILL.md");
  for (const file of skillFiles) {
    const relative = path.relative(skillRoot, file).split(path.sep);
    if (relative.length !== 3) {
      errors.push(`${path.relative(repoRoot, file)}: SKILL.md must be at skills/<category>/<skill>/SKILL.md`);
    }
  }

  if (!await exists(indexPath)) {
    errors.push("docs/skills/README.md: generated index is missing");
  } else {
    const actualIndex = await readFile(indexPath, "utf8");
    const expectedIndex = renderIndex(skills);
    if (actualIndex !== expectedIndex) {
      errors.push("docs/skills/README.md: run npm run docs:index to refresh the generated index");
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return skills;
}

try {
  const skills = await validate();
  console.log(`validated ${skills.length} skill(s), guides, and generated index`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
