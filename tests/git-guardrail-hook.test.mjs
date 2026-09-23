import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const hookPath = path.resolve(".claude/hooks/block-dangerous-git.mjs");
const repoRoot = path.resolve(".");

function runHook(command, cwd = repoRoot, toolName = "Bash") {
  const input = JSON.stringify({ tool_name: toolName, tool_input: { command }, cwd });
  return spawnSync(process.execPath, [hookPath], { input, encoding: "utf8" });
}

function assertBlocked(command, cwd) {
  const result = runHook(command, cwd);
  assert.equal(result.status, 2, `expected "${command}" to be blocked; stderr: ${result.stderr}`);
  assert.match(result.stderr, /Blocked by \.claude\/hooks\/block-dangerous-git\.mjs/);
}

function assertAllowed(command, cwd) {
  const result = runHook(command, cwd);
  assert.equal(result.status, 0, `expected "${command}" to be allowed; stderr: ${result.stderr}`);
}

describe("git guardrail hook: pr-to-dev forbidden actions", () => {
  const blocked = [
    "git reset --hard",
    "git reset --hard HEAD~1",
    "git clean -fd",
    "git clean --force -x",
    "git push --force",
    "git push -f origin feat/x",
    "git push origin +feat/x",
    "git push --force-with-lease",
    "git push --force-with-lease=refs/heads/feat/x origin feat/x",
    "git push origin main",
    "git push origin HEAD:dev",
    "git push origin feat/x:refs/heads/master",
    "git push origin --delete feat/x",
    "git push origin :feat/x",
    "git branch -D feat/x",
    "git branch --delete --force feat/x",
    "git checkout .",
    "git checkout -- .",
    "git checkout --ours .",
    "git checkout --theirs .",
    "git restore .",
    "git stash drop",
    "git stash clear",
  ];
  for (const command of blocked) {
    it(`blocks: ${command}`, () => assertBlocked(command));
  }

  const allowed = [
    "git status",
    "git log --oneline -5",
    "git reset --soft HEAD~1",
    "git reset HEAD README.md",
    "git clean -n",
    "git clean -nfd",
    "git push origin feat/x",
    "git push --force-with-lease=refs/heads/feat/x:0123abc origin feat/x",
    "git branch -d feat/x",
    "git checkout feat/x",
    "git checkout -b feat/new",
    "git checkout --ours src/a.ts",
    "git restore --staged .",
    "git stash",
    "git stash pop",
    "git merge --squash subagent-implement/foo/01",
    "git worktree remove .claude/worktrees/foo",
  ];
  for (const command of allowed) {
    it(`allows: ${command}`, () => assertAllowed(command));
  }
});

describe("git guardrail hook: command parsing", () => {
  it("finds a forbidden git call anywhere in a chain or subshell", () => {
    assertBlocked("npm test && git reset --hard");
    assertBlocked("npm test; git stash clear");
    assertBlocked("(cd .. && git reset --hard)");
    assertBlocked("echo $(git reset --hard)");
    assertBlocked("GIT_TRACE=1 git reset --hard");
    assertBlocked("git -C /somewhere --no-pager reset --hard");
  });

  it("ignores git text that is only an argument to another command", () => {
    assertAllowed('echo "git reset --hard"');
    assertAllowed("grep -n 'git push --force' skills/git/pr-to-dev/SKILL.md");
    assertAllowed('git log --grep "git reset --hard"');
  });

  it("ignores tools other than Bash", () => {
    const result = runHook("git reset --hard", repoRoot, "Write");
    assert.equal(result.status, 0);
  });
});

describe("git guardrail hook: protected branches", () => {
  let repo;
  let elsewhere;

  before(() => {
    repo = mkdtempSync(path.join(os.tmpdir(), "guardrail-repo-"));
    elsewhere = mkdtempSync(path.join(os.tmpdir(), "guardrail-cwd-"));
    execFileSync("git", ["init", "-q", repo]);
  });

  after(() => {
    rmSync(repo, { recursive: true, force: true });
    rmSync(elsewhere, { recursive: true, force: true });
  });

  const onBranch = (branch) => execFileSync("git", ["-C", repo, "symbolic-ref", "HEAD", `refs/heads/${branch}`]);

  it("blocks commit and implicit push while main, master, or dev is checked out", () => {
    for (const branch of ["main", "master", "dev"]) {
      onBranch(branch);
      assertBlocked('git commit -m "x"', repo);
      assertBlocked("git push", repo);
      assertBlocked("git push -u origin HEAD", repo);
    }
  });

  it("follows cd and -C to the repository the command really targets", () => {
    onBranch("main");
    assertBlocked(`cd ${repo} && git commit -m "x"`, elsewhere);
    assertBlocked(`git -C ${repo} commit -m "x"`, elsewhere);
  });

  it("allows commit and push on a working branch", () => {
    onBranch("feat/guardrail");
    assertAllowed('git commit -m "x"', repo);
    assertAllowed("git push -u origin HEAD", repo);
  });
});

describe("git guardrail hook: wiring", () => {
  it("is registered as a PreToolUse Bash hook in .claude/settings.json", () => {
    const settings = JSON.parse(readFileSync(path.resolve(".claude/settings.json"), "utf8"));
    const commands = (settings.hooks?.PreToolUse ?? [])
      .filter((entry) => entry.matcher === "Bash")
      .flatMap((entry) => entry.hooks.map((hook) => hook.command));
    assert.ok(
      commands.some((command) => command.includes(".claude/hooks/block-dangerous-git.mjs")),
      "settings.json must run block-dangerous-git.mjs before every Bash call",
    );
  });
});
