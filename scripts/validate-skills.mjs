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

function localMarkdownLinks(markdown) {
  return [...markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
    .map((match) => match[1].trim().split(/\s+/)[0].replace(/^<|>$/g, ""))
    .filter((target) => target && !target.startsWith("#") && !/^[a-z][a-z0-9+.-]*:/i.test(target));
}

function inside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function readJson(file, errors, label) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    errors.push(`${label}: invalid JSON (${error.message})`);
    return null;
  }
}

async function validate() {
  const errors = [];
  const skillRoot = path.join(repoRoot, "skills");
  const skills = await discoverSkills();
  const names = new Map();

  for (const skill of skills) {
    const skillDirectory = path.join(repoRoot, skill.skillPath);
    const skillFile = path.join(skillDirectory, "SKILL.md");
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

    const skillMarkdown = await readFile(skillFile, "utf8");
    for (const link of localMarkdownLinks(skillMarkdown)) {
      let decoded;
      try {
        decoded = decodeURIComponent(link.split("#", 1)[0]);
      } catch {
        errors.push(`${skill.skillPath}/SKILL.md: malformed local link: ${link}`);
        continue;
      }
      const target = path.resolve(skillDirectory, decoded);
      if (!inside(skillDirectory, target)) {
        errors.push(`${skill.skillPath}/SKILL.md: local link leaves the skill directory: ${link}`);
      } else if (!await exists(target)) {
        errors.push(`${skill.skillPath}/SKILL.md: broken local link: ${link}`);
      }
    }

    const openAiMetadata = path.join(skillDirectory, "agents/openai.yaml");
    if (await exists(openAiMetadata)) {
      const metadata = await readFile(openAiMetadata, "utf8");
      if (!metadata.includes("display_name:") || !metadata.includes("short_description:")) {
        errors.push(`${skill.skillPath}/agents/openai.yaml: display_name and short_description are required`);
      }
      if (!metadata.includes(`$${skill.name}`)) {
        errors.push(`${skill.skillPath}/agents/openai.yaml: default_prompt must invoke $${skill.name}`);
      }
      if (!/allow_implicit_invocation:\s*(true|false)\s*$/m.test(metadata)) {
        errors.push(`${skill.skillPath}/agents/openai.yaml: allow_implicit_invocation must be boolean`);
      }
    }

    const triggerFile = path.join(skillDirectory, "evals/trigger-evals.json");
    if (await exists(triggerFile)) {
      const triggers = await readJson(
        triggerFile,
        errors,
        `${skill.skillPath}/evals/trigger-evals.json`,
      );
      if (triggers && (!Array.isArray(triggers) || triggers.length === 0)) {
        errors.push(`${skill.skillPath}/evals/trigger-evals.json: expected a non-empty array`);
      } else if (triggers) {
        const expectedDecisions = new Set(triggers.map((item) => item?.should_trigger));
        if (!expectedDecisions.has(true) || !expectedDecisions.has(false)) {
          errors.push(`${skill.skillPath}/evals/trigger-evals.json: include positive and negative routing cases`);
        }
        triggers.forEach((item, index) => {
          if (!item || typeof item.query !== "string" || item.query.trim() === "") {
            errors.push(`${skill.skillPath}/evals/trigger-evals.json[${index}]: query is required`);
          }
          if (typeof item?.should_trigger !== "boolean") {
            errors.push(`${skill.skillPath}/evals/trigger-evals.json[${index}]: should_trigger must be boolean`);
          }
        });
      }
    }

    const evalFile = path.join(skillDirectory, "evals/evals.json");
    if (await exists(evalFile)) {
      const payload = await readJson(evalFile, errors, `${skill.skillPath}/evals/evals.json`);
      if (payload) {
        if (payload.skill_name !== skill.name) {
          errors.push(`${skill.skillPath}/evals/evals.json: skill_name must equal ${skill.name}`);
        }
        if (!Array.isArray(payload.evals) || payload.evals.length === 0) {
          errors.push(`${skill.skillPath}/evals/evals.json: evals must be a non-empty array`);
        } else {
          const ids = new Set();
          const evalNames = new Set();
          for (const [index, item] of payload.evals.entries()) {
            if (!item || !Number.isInteger(item.id) || ids.has(item.id)) {
              errors.push(`${skill.skillPath}/evals/evals.json[${index}]: id must be a unique integer`);
            } else {
              ids.add(item.id);
            }
            if (typeof item?.name !== "string" || !item.name || evalNames.has(item.name)) {
              errors.push(`${skill.skillPath}/evals/evals.json[${index}]: name must be a unique string`);
            } else {
              evalNames.add(item.name);
            }
            if (typeof item?.prompt !== "string" || !item.prompt) {
              errors.push(`${skill.skillPath}/evals/evals.json[${index}]: prompt is required`);
            }
            if (typeof item?.expected_output !== "string" || !item.expected_output) {
              errors.push(`${skill.skillPath}/evals/evals.json[${index}]: expected_output is required`);
            }
            if (!Array.isArray(item?.expectations) || item.expectations.length === 0) {
              errors.push(`${skill.skillPath}/evals/evals.json[${index}]: expectations are required`);
            }
            if (!Array.isArray(item?.files)) {
              errors.push(`${skill.skillPath}/evals/evals.json[${index}]: files must be an array`);
              continue;
            }
            for (const fixture of item.files) {
              if (typeof fixture !== "string") {
                errors.push(`${skill.skillPath}/evals/evals.json[${index}]: invalid fixture path ${fixture}`);
                continue;
              }
              const resolved = path.resolve(skillDirectory, fixture);
              if (!inside(skillDirectory, resolved)) {
                errors.push(`${skill.skillPath}/evals/evals.json[${index}]: invalid fixture path ${fixture}`);
              } else if (!await exists(resolved)) {
                errors.push(`${skill.skillPath}/evals/evals.json[${index}]: missing fixture ${fixture}`);
              }
            }
          }
        }
      }
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
