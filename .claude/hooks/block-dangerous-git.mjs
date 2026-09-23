#!/usr/bin/env node
// PreToolUse guardrail for the Bash tool. Enforces the "Forbidden automatically"
// git list from skills/git/pr-to-dev/references/safety-rules.md for every agent
// working in this repository, so those rules hold even when no skill is loaded.
//
// Exit 2 blocks the command and shows stderr to the agent. Any internal error
// exits 0: a bug in the guardrail must never wedge the session.
//
// Scope: commands the agent types. A git call hidden inside a script file or a
// `bash -c` string is out of reach, so this is a guardrail, not a sandbox.

import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const PROTECTED_BRANCHES = new Set(["main", "master", "dev"]);
const WRAPPERS = new Set(["sudo", "command", "exec", "env", "time", "nohup"]);

// Split a shell command into segments of words. Quotes are honoured, and
// `;` `&` `|` newlines, parentheses and backticks end a segment.
function segments(command) {
  const result = [];
  let words = [];
  let word = "";
  let inWord = false;
  let quote = null;

  const endWord = () => {
    if (inWord) words.push(word);
    word = "";
    inWord = false;
  };
  const endSegment = () => {
    endWord();
    if (words.length > 0) result.push(words);
    words = [];
  };

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && i + 1 < command.length) word += command[++i];
      else word += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      inWord = true;
    } else if (ch === "\\" && i + 1 < command.length) {
      word += command[++i];
      inWord = true;
    } else if (ch === "$" && command[i + 1] === "(") {
      endSegment();
      i++;
    } else if (";&|\n()`".includes(ch)) {
      endSegment();
    } else if (/\s/.test(ch)) {
      endWord();
    } else {
      word += ch;
      inWord = true;
    }
  }
  endSegment();
  return result;
}

function resolveDir(base, target) {
  if (!target || target === "~") return os.homedir();
  if (target.startsWith("~/")) return path.join(os.homedir(), target.slice(2));
  return path.resolve(base, target);
}

function currentBranch(dir) {
  try {
    return execFileSync("git", ["-C", dir, "symbolic-ref", "--short", "-q", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

const hasPathspecAll = (args) => args.includes(".") || args.includes(":/");
const hasShortFlag = (args, letter) =>
  args.some((a) => /^-[a-zA-Z]+$/.test(a) && a.slice(1).includes(letter));

function checkPush(rest, dir) {
  const flags = rest.filter((a) => a.startsWith("-"));
  const positionals = rest.filter((a) => !a.startsWith("-"));

  if (flags.includes("--force") || hasShortFlag(flags, "f")) {
    return "git push --force rewrites remote history; use --force-with-lease=refs/heads/<branch>:<expected-sha>";
  }
  const lease = flags.find((a) => a === "--force-with-lease" || a.startsWith("--force-with-lease="));
  if (lease && !lease.includes(":")) {
    return "a force-with-lease must bind the exact remote SHA: --force-with-lease=refs/heads/<branch>:<expected-sha>";
  }
  if (flags.some((a) => ["--delete", "-d", "--prune", "--mirror"].includes(a))) {
    return "git push that deletes remote branches";
  }

  const refspecs = positionals.slice(1);
  for (const spec of refspecs) {
    if (spec.startsWith("+")) return `force push via refspec "${spec}"`;
    if (spec.startsWith(":")) return `remote branch deletion via refspec "${spec}"`;
  }
  const targets = refspecs.length === 0 ? ["HEAD"] : refspecs;
  for (const spec of targets) {
    let dst = spec.includes(":") ? spec.slice(spec.lastIndexOf(":") + 1) : spec;
    if (dst === "HEAD") dst = currentBranch(dir) ?? "HEAD";
    dst = dst.replace(/^refs\/heads\//, "");
    if (PROTECTED_BRANCHES.has(dst)) return `push to protected branch "${dst}"`;
  }
  return null;
}

// Returns a reason string when the git invocation is forbidden, else null.
function checkGit(args, cwd) {
  let dir = cwd;
  let i = 0;
  while (i < args.length && args[i].startsWith("-")) {
    const opt = args[i];
    if (opt === "-C") {
      dir = resolveDir(dir, args[i + 1]);
      i += 2;
    } else if (["-c", "--git-dir", "--work-tree", "--namespace"].includes(opt)) {
      i += 2;
    } else {
      i += 1;
    }
  }
  const sub = args[i];
  const rest = args.slice(i + 1);

  switch (sub) {
    case "reset":
      return rest.includes("--hard") ? "git reset --hard discards uncommitted work" : null;
    case "clean": {
      const dryRun = rest.includes("--dry-run") || hasShortFlag(rest, "n");
      const force = rest.includes("--force") || hasShortFlag(rest, "f");
      return force && !dryRun ? "git clean -f deletes untracked files" : null;
    }
    case "push":
      return checkPush(rest, dir);
    case "branch": {
      const forceDelete =
        hasShortFlag(rest, "D") ||
        ((rest.includes("--delete") || hasShortFlag(rest, "d")) &&
          (rest.includes("--force") || hasShortFlag(rest, "f")));
      return forceDelete ? "git branch -D force-deletes a branch and its unmerged commits" : null;
    }
    case "checkout":
      if (!hasPathspecAll(rest)) return null;
      return rest.includes("--ours") || rest.includes("--theirs")
        ? "repository-wide --ours/--theirs resolution; resolve conflicts path by path"
        : "git checkout . discards every working-tree change";
    case "restore": {
      if (!hasPathspecAll(rest)) return null;
      const indexOnly =
        (rest.includes("--staged") || hasShortFlag(rest, "S")) &&
        !(rest.includes("--worktree") || hasShortFlag(rest, "W"));
      return indexOnly ? null : "git restore . discards every working-tree change";
    }
    case "stash":
      return ["drop", "clear"].includes(rest[0]) ? `git stash ${rest[0]} deletes stashed work` : null;
    case "commit": {
      const branch = currentBranch(dir);
      return branch && PROTECTED_BRANCHES.has(branch)
        ? `commit directly on protected branch "${branch}"; create a working branch first (git switch -c <name>)`
        : null;
    }
    default:
      return null;
  }
}

// Returns the first forbidden action in a whole Bash command, else null.
function findViolation(command, cwd) {
  let dir = cwd;
  for (let words of segments(command)) {
    while (words.length > 0 && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0]) || WRAPPERS.has(words[0]))) {
      words = words.slice(1);
    }
    if (words.length === 0) continue;
    if (words[0] === "cd") {
      dir = resolveDir(dir, words[1]);
      continue;
    }
    if (path.basename(words[0]) === "git") {
      const reason = checkGit(words.slice(1), dir);
      if (reason) return reason;
    }
  }
  return null;
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const input = JSON.parse(raw || "{}");
  if (input.tool_name && input.tool_name !== "Bash") return 0;
  const command = input.tool_input?.command ?? "";
  const reason = findViolation(command, input.cwd || process.cwd());
  if (!reason) return 0;
  process.stderr.write(
    `Blocked by .claude/hooks/block-dangerous-git.mjs: ${reason}.\n` +
      "This repository reserves that action for the user. If it is genuinely needed, " +
      "stop and ask the user to run it themselves with `! <command>`.\n",
  );
  return 2;
}

main().then(
  (code) => process.exit(code),
  () => process.exit(0),
);
