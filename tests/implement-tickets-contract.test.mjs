import { spawnSync } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { flatMarkdownSection, markdownHeaderBlock, markdownSection } from "./helpers/markdown-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillRoot = path.join(repoRoot, "skills/agents/implement-tickets");
const planScript = path.join(skillRoot, "scripts/plan.mjs");

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

const flatten = (text) => text.replace(/\s*\n\s*/g, " ");
const read = async (rel) => flatten(await readFile(path.join(skillRoot, rel), "utf8"));
const readRepo = async (rel) => flatten(await readFile(path.join(repoRoot, rel), "utf8"));
// One named section of a file, whitespace-collapsed so a rewrap cannot break a token.
const skillSection = async (rel, heading) => flatMarkdownSection(await readFile(path.join(skillRoot, rel), "utf8"), heading);
const repoSection = async (rel, heading) => flatMarkdownSection(await readFile(path.join(repoRoot, rel), "utf8"), heading);
// The text before the first `##` heading, whitespace-collapsed.
const skillHeader = async (rel) => markdownHeaderBlock(await readFile(path.join(skillRoot, rel), "utf8")).replace(/\s+/g, " ");
const matchAll = (text, patterns, label) => {
  for (const pattern of patterns) assert.match(text, pattern, `${label}: ${pattern}`);
};

function ticket(number, { blockers = [], context = "", seam = "the core contract test", title = `Ticket ${number}`, risk } = {}) {
  return [
    `# ${number}: ${title}`,
    "",
    "**What to build:** Fixture behavior.",
    `**Blocked by:** ${blockers.length ? blockers.join(", ") : "None (can start immediately)"}`,
    "**Stories:** 1",
    `**Seam:** ${seam}`,
    `**Context:** ${context}`,
    "**Budget:** read ~1k tokens · 1 criteria · 1 modules",
    ...(risk === undefined ? [] : [`**Risk:** ${risk}`]),
    "**Status:** ready-for-agent",
    "",
    "- [ ] Fixture criterion.",
    "",
  ].join("\n");
}

async function fixture(tickets) {
  const root = await mkdtemp(path.join(tmpdir(), "implement-tickets-contract-"));
  const issues = path.join(root, "issues");
  await mkdir(issues, { recursive: true });
  for (const [number, contents] of Object.entries(tickets)) {
    await writeFile(path.join(issues, `${number}-fixture.md`), contents, "utf8");
  }
  return { root, issues };
}

async function withFixture(tickets, run) {
  const { root, issues } = await fixture(tickets);
  try {
    return await run(issues);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function invokePlan(dir) {
  return spawnSync(process.execPath, [planScript, dir], { encoding: "utf8" });
}

function runPlan(dir) {
  const result = invokePlan(dir);
  assert.equal(result.status, 0, `plan script exits successfully: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

describe("implement-tickets plan script contract", () => {
  it("reports blockers, touch set, seam, and risk per ticket in ticket order", async () => {
    await withFixture({
      "01": ticket("01", { context: "(new) src/one.mjs · spec §1", seam: "the one seam" }),
      "02": ticket("02", { blockers: ["01"], context: "(edit from 01) src/one.mjs · (edit) src/two.mjs", risk: "high — shared interface" }),
    }, (issues) => {
      const output = runPlan(issues);
      assert.deepEqual(output.tickets.map(({ number }) => number), ["01", "02"]);
      assert.deepEqual(output.tickets[0].touchSet, ["src/one.mjs"]);
      assert.equal(output.tickets[0].seam, "the one seam");
      assert.deepEqual(output.tickets[1].blockers, ["01"]);
      assert.deepEqual(output.tickets[1].touchSet, ["src/one.mjs", "src/two.mjs"]);
      assert.deepEqual(output.tickets.map(({ risk }) => risk), ["low", "high"]);
      assert.deepEqual(output.warnings, []);
      assert.ok(!("waves" in output) && !("concurrency" in output) && !("manifest" in output), "no wave, concurrency, or manifest planning");
    });
  });

  it("resolves a blocker by number or exact title", async () => {
    for (const blocker of ["# 1", "Groundwork"]) {
      await withFixture({
        "01": ticket("01", { title: "Groundwork", context: "(new) src/base.mjs" }),
        "02": ticket("02", { blockers: [blocker], context: "(edit) src/next.mjs" }),
      }, (issues) => {
        assert.deepEqual(runPlan(issues).tickets[1].blockers, ["01"], `blocker reference ${blocker}`);
      });
    }
  });

  it("rejects a forward blocker, a missing blocker, and a missing or empty Context, naming the ticket", async () => {
    const cases = [
      [{ "01": ticket("01", { blockers: ["02"], context: "(edit) src/a.mjs" }), "02": ticket("02", { context: "(edit) src/b.mjs" }) }, /issues\/01.*lower number/i],
      [{ "01": ticket("01", { blockers: ["07"], context: "(edit) src/a.mjs" }) }, /issues\/01.*matches no ticket/i],
      [{ "01": ticket("01", { context: "(edit) src/a.mjs" }).replace(/^\*\*Context:\*\*.*\n/m, "") }, /issues\/01.*Context/i],
      [{ "01": ticket("01", { context: "" }) }, /issues\/01.*Context/i],
    ];
    for (const [tickets, pattern] of cases) {
      await withFixture(tickets, (issues) => {
        const result = invokePlan(issues);
        assert.notEqual(result.status, 0, "planning stops");
        assert.match(result.stderr, pattern);
      });
    }
  });

  it("treats a glob or empty change set as an unknown touch set with a warning", async () => {
    await withFixture({
      "01": ticket("01", { context: "(edit) src/**/*.mjs" }),
      "02": ticket("02", { context: "src/read-only.mjs" }),
    }, (issues) => {
      const output = runPlan(issues);
      assert.deepEqual(output.tickets.map(({ touchSet }) => touchSet), [null, null]);
      assert.equal(output.warnings.length, 2);
      assert.ok(output.warnings.every((warning) => /unknown touch set/i.test(warning)));
    });
  });

  it("reads a missing Risk as low, `high — reason` as high, and anything else as high with a warning", async () => {
    await withFixture({
      "01": ticket("01", { context: "(edit) src/one.mjs", risk: "high — shared interface" }),
      "02": ticket("02", { context: "(edit) src/two.mjs", risk: "low" }),
      "03": ticket("03", { context: "(edit) src/three.mjs" }),
      "04": ticket("04", { context: "(edit) src/four.mjs", risk: "medium" }),
      "05": ticket("05", { context: "(edit) src/five.mjs", risk: "low" }).replace(/^(\*\*Risk:\*\*.*)$/m, "$1\n**Risk:** low"),
    }, (issues) => {
      const output = runPlan(issues);
      assert.deepEqual(Object.fromEntries(output.tickets.map((item) => [item.number, item.risk])),
        { "01": "high", "02": "low", "03": "low", "04": "high", "05": "high" });
      assert.match(output.tickets[3].warnings.join(" "), /malformed Risk/i);
      assert.match(output.tickets[4].warnings.join(" "), /repeats the Risk field/i);
      assert.deepEqual(output.tickets.slice(0, 3).flatMap(({ warnings }) => warnings), []);
    });
  });

  it("reads a Risk value with trailing whitespace without a warning", async () => {
    const padded = ticket("01", { context: "(edit) src/one.mjs", risk: "low" }).replace(/^(\*\*Risk:\*\*.*)$/m, "$1 \t ");
    await withFixture({ "01": padded }, (issues) => {
      const output = runPlan(issues);
      assert.equal(output.tickets[0].risk, "low");
      assert.deepEqual(output.warnings, []);
    });
  });
});

describe("implement-tickets minimal serial core", () => {
  it("ships exactly the minimal set of files", async () => {
    const list = async (dir) => (await readdir(path.join(skillRoot, dir))).sort();
    assert.deepEqual(await list("references"), [
      "dispatch-contract.md",
      "integration-gate.md",
      "planning.md",
      "prompt-scaffold.md",
      "status-and-resume.md",
      "verification.md",
    ]);
    assert.deepEqual(await list("scripts"), ["plan.mjs"]);
    for (const removed of ["scripts/waves.mjs", "scripts/preflight.mjs", "references/adapter-contract.md", "references/envelope.schema.json", "references/parallel-validation.md"]) {
      assert.equal(await exists(path.join(skillRoot, removed)), false, `${removed} is gone`);
    }
  });

  it("declares explicit-only invocation for Claude Code and Codex", async () => {
    const skill = await readFile(path.join(skillRoot, "SKILL.md"), "utf8");
    assert.match(skill, /^---\nname: implement-tickets\n/);
    assert.match(skill, /^disable-model-invocation: true$/m);
    assert.match(skill, /\/implement-tickets <dir\|slug>/);
    assert.match(skill, /\$implement-tickets <dir\|slug>/);
    assert.match(skill, /\/implement-tickets continue \[slug\]/);
    const codex = await readFile(path.join(skillRoot, "agents/openai.yaml"), "utf8");
    assert.match(codex, /allow_implicit_invocation: false/);
  });

  it("has no option for the removed parallel, adapter, model, strict, or subcommand surface", async () => {
    const files = ["SKILL.md", "agents/openai.yaml", ...(await readdir(path.join(skillRoot, "references"))).map((file) => `references/${file}`)];
    for (const file of files) {
      const text = await read(file);
      assert.doesNotMatch(text, /--parallel|--concurrency|--serial|--strict|--with|--agent|--model|adapter|envelope|drain round|deny-list|hold set/i, `${file} mentions a removed feature`);
      assert.doesNotMatch(text, /implement-tickets (?:status|list)\b/, `${file} mentions a removed subcommand`);
    }
  });

  it("checks for a clean tree, plans with plan.mjs, and starts without a pause", async () => {
    const skill = await read("SKILL.md");
    assert.match(skill, /git status --porcelain --untracked-files=all/);
    assert.match(skill, /scripts\/plan\.mjs/);
    assert.match(skill, /run starts right after the Plan is printed/i);
    const planning = await read("references/planning.md");
    assert.match(planning, /one row per ticket[\s\S]*Ticket \| Blockers \| Touch set \| Seam \| Agent \| Risk/i);
    assert.match(planning, /\(verification\.md#attempts\)/);
    assert.match(planning, /Blockers must exist and have lower numbers, so ascending ticket number is the run order/i);
  });

  it("links every reference from the skill and every link resolves", async () => {
    const skill = await readFile(path.join(skillRoot, "SKILL.md"), "utf8");
    const linked = new Set([...skill.matchAll(/references\/([a-z-]+\.md)/g)].map((match) => match[1]));
    assert.deepEqual([...linked].sort(), (await readdir(path.join(skillRoot, "references"))).sort());
  });

  it("dispatches one native worker at a time in a worktree and treats crashes as infra failures", async () => {
    const dispatch = await read("references/dispatch-contract.md");
    assert.match(dispatch, /one native worker per ticket, one ticket at a time, in ascending ticket number/i);
    assert.match(dispatch, /isolation:\s+"worktree"/);
    assert.doesNotMatch(dispatch, /run_in_background/);
    assert.match(dispatch, /failed_infra[\s\S]*count no ticket attempt/i);
    assert.match(dispatch, /two infra retries[\s\S]*BLOCKED \(TICKET_PROVIDER_FAILED\)/i);
  });

  it("names the Worker branch per attempt and states the harness path assumption", async () => {
    const branch = await skillSection("references/dispatch-contract.md", "Worker branch per attempt");
    matchAll(branch, [
      /implement-tickets-work\/<slug>\/NN-aK`/,
      /`implement-tickets-work\/<slug>\/NN-aK-iJ`/,
      /a new name never collides/i,
      /This assumes `isolation: "worktree"` returns the worktree path and its branch name/,
      /Confirm it on the first real dispatch/,
      /compare the returned path and branch with `git worktree list`/,
      /matching the attempt's branch name in `git worktree list`/,
    ], "dispatch contract, Worker branch per attempt");
    const kept = await skillSection("references/dispatch-contract.md", "Kept worktrees");
    assert.doesNotMatch(kept, /discard the branch/i);
    const extras = await skillSection("references/dispatch-contract.md", "Measuring extras");
    assert.match(extras, /keep the worktree and redispatch on a new branch name/);
    assert.doesNotMatch(extras, /discard the branch/i);
    const scaffold = await skillSection("references/prompt-scaffold.md", "Working directory");
    assert.match(scaffold, /branch <worker-branch>, named per attempt/);
    assert.match(scaffold, /`implement-tickets-work\/<slug>\/NN-aK`, or `NN-aK-iJ` for an infrastructure retry/);
  });

  it("measures extras from the worker branch diff and rejects unexplained ones at one attempt", async () => {
    const dispatch = await read("references/dispatch-contract.md");
    assert.match(dispatch, /git diff --name-only --no-renames <pre-ticket-integration-sha> <worker-branch>/);
    assert.match(dispatch, /worker's own Touch-set extras list is advisory/i);
    assert.match(dispatch, /rejects extras that the acceptance criteria do not explain[\s\S]*at the cost of one attempt/i);
  });

  it("starts every worker prompt with a checkout and integration SHA assertion and requires red and green evidence", async () => {
    const scaffold = await read("references/prompt-scaffold.md");
    assert.match(scaffold, /git checkout -B "<worker-branch>" "<integration-sha>"/);
    assert.match(scaffold, /test "\$\(git rev-parse HEAD\)" = "<integration-sha>"/);
    assert.match(scaffold, /failed_infra/);
    for (const section of ["Red output", "Green output", "Files changed", "Test → criterion table", "Touch-set extras"]) {
      assert.ok(scaffold.includes(`**${section}:**`), `the worker return has ${section}`);
    }
    assert.match(scaffold, /typecheck[\s\S]*none configured/i);
  });

  it("verifies only risky tickets and lists every risk signal", async () => {
    const verification = await read("references/verification.md");
    assert.match(verification, /only when the ticket is risky/i);
    assert.match(verification, /marked `Risk: high`/);
    for (const signal of ["a counted retry", "any measured touch-set extras", "an unknown touch set", "incomplete evidence"]) {
      assert.ok(verification.includes(signal), `risk signal: ${signal}`);
    }
    assert.match(verification, /`Risk: low` field, or a missing field, never lowers a signal/);
    assert.match(verification, /Incomplete evidence counts no attempt/);
    assert.match(verification, /Record the ticket `Verifier: skipped`/);
  });

  it("uses a fresh Explore verifier that returns raw evidence and no verdict", async () => {
    const verification = await read("references/verification.md");
    assert.match(verification, /subagent_type: Explore/);
    assert.match(verification, /general-purpose[\s\S]*read-only/i);
    assert.match(verification, /returns raw evidence with no verdict/i);
    assert.match(verification, /pre-ticket integration SHA, apply only the worker's test files/i);
    assert.match(verification, /three failed attempts[\s\S]*BLOCKED \(TICKET_VERIFICATION_FAILED\)|After three failed attempts the ticket is `BLOCKED \(TICKET_VERIFICATION_FAILED\)`/);
  });

  it("squash-merges one commit per ticket, gates on the full checks, and rewinds the culprit", async () => {
    const gate = await read("references/integration-gate.md");
    assert.match(gate, /squash-merge[\s\S]*exactly one commit/i);
    assert.match(gate, /full typecheck and the full test suite/i);
    assert.match(gate, /Start the next ticket only after it/i);
    assert.match(gate, /git checkout -B <integration-branch> <sha>/);
    assert.match(gate, /the one rewind command/i);
    assert.match(gate, /counts one attempt/i);
  });

  it("cleans up the Worker worktree and branches after a green gate and a written row", async () => {
    const intro = await skillHeader("references/integration-gate.md");
    matchAll(intro, [
      /Once the gate is green/,
      /row is written/,
      /run \[Cleanup\]\(#cleanup\)/,
      /before starting the next ticket/,
    ], "integration gate intro");
    const cleanup = await skillSection("references/integration-gate.md", "Cleanup");
    matchAll(cleanup, [
      /the Worker worktree, then the Worker branch, then any other branch the harness created/,
      /every earlier kept attempt of the ticket, including infrastructure-retry attempts/,
      /before the next ticket starts/,
      /Take each path and harness branch from the Worktree cell/,
      /`git worktree remove <path>`/,
      /the plain form, no force flag/,
      /`git branch -D <branch>`/,
      /a squash-merge leaves the Worker branch unmerged/,
      /never edits the Branch or Commit columns of `status\.md`/,
      /recorded path is `\?`/,
      /looked up by branch name in the worktree list/,
      /nothing is removed for that attempt/,
      /When a removal fails/,
      /append a report entry with Step `cleanup`/,
      /Cleanup still attempts the branch deletion/,
      /A failure never stops the run/,
      /already gone counts as success and writes no report entry/,
    ], "integration gate, Cleanup");
    const report = await skillSection("references/status-and-resume.md", "Run report");
    assert.match(report, /a worktree removal or branch deletion fails during \[Cleanup\]\(integration-gate\.md#cleanup\)/);
    assert.match(report, /Step: <[^>]*\bcleanup\b[^>]*>/);
    const stage = await skillSection("SKILL.md", "Stage 1 — Build each ticket");
    assert.match(stage, /\[Cleanup\]\(references\/integration-gate\.md#cleanup\)/);
    assert.ok(stage.indexOf("Squash-merge and run the gate") !== -1, "Stage 1 has the gate step");
    assert.ok(stage.indexOf("Clean up the ticket's Worker worktrees") > stage.indexOf("Squash-merge and run the gate"), "Cleanup follows the gate in the flow");
  });

  it("keeps the worktree of a failed, rejected, or conflicted attempt and of a BLOCKED ticket", async () => {
    const failing = await skillSection("references/integration-gate.md", "Failing gate");
    assert.match(failing, /The failed attempt keeps its Worker worktree, so the retry takes a new branch name/);
    const intro = await skillHeader("references/integration-gate.md");
    assert.match(intro, /redispatch the ticket from the latest integration commit/);
    assert.match(intro, /The old attempt keeps its worktree and the new one takes a new branch name/);
    const kept = await skillSection("references/dispatch-contract.md", "Kept worktrees");
    matchAll(kept, [
      /An attempt that failed the gate/,
      /rejected by the verifier or the extras check/,
      /redispatched after a non-mechanical merge conflict/,
      /keeps its Worker worktree/,
      /the redispatch takes a new branch name/,
      /A BLOCKED ticket keeps all its attempts' worktrees/,
      /never removed at run end/,
    ], "dispatch contract, Kept worktrees");
  });

  it("names every leftover worktree in the handoff", async () => {
    const handoff = await skillSection("references/integration-gate.md", "Handoff");
    matchAll(handoff, [
      /Name every worktree left behind by path/,
      /all the worktrees of each BLOCKED ticket/,
      /each worktree of a failed removal/,
      /unknown path \(`\?`\)/,
    ], "integration gate, Handoff");
  });

  it("continues after Worker branches are gone", async () => {
    const cont = await skillSection("references/status-and-resume.md", "Continue");
    matchAll(cont, [
      /An integrated ticket is reconciled only against its squash commit on the integration branch/,
      /a removed Worker branch is not drift/,
      /Worker branches are checked only for tickets that are not integrated/,
      /A ticket that was `verifying` or `dispatched` restarts from a fresh worker/,
      /even when its recorded Worker branch is missing/,
      /infrastructure-retry branch name `NN-aK-iJ`/,
      /It counts no attempt/,
    ], "status-and-resume, Continue");
  });

  it("hands off a green run without starting review or publication", async () => {
    const gate = await read("references/integration-gate.md");
    assert.match(gate, /implement-tickets\/<slug>/);
    assert.match(gate, /\/review-to-pr <slug>/);
    assert.match(gate, /Accepted extra files/);
    assert.match(gate, /Skipped the verifier: 02, 04/);
    assert.match(gate, /Run report: none/);
    assert.match(gate, /Review, push, and the pull request stay with the person/i);
  });

  it("records the run in status.md and resumes only through continue", async () => {
    const state = await read("references/status-and-resume.md");
    assert.match(state, /first line is exactly `skill: implement-tickets`/);
    const header = await skillHeader("references/status-and-resume.md");
    assert.match(header, /\| Ticket \| Status \| Attempts \| Branch \| Commit \| Worktree \| Extras \| Risk \| Verifier \|/);
    const column = await skillSection("references/status-and-resume.md", "Worktree column");
    matchAll(column, [
      /`aK: <path>`/,
      /`aK-iJ: <path>`/,
      /\(harness: <branch>\)/,
      /written `\?`/,
      /The path is written when the worker returns/,
      /matching its branch name in the worktree list/,
      /reported as an unknown path in `report\.md` and the handoff/,
      /one more than the highest `K` found in the Worktree cell/,
      /in the local branches matching `implement-tickets-work\/<slug>\/NN-\*`/,
      /and in the worktree list, and derive `J` the same way/,
      /never from the `Attempts` column/,
    ], "status-and-resume, Worktree column");
    const verifier = await skillSection("references/verification.md", "Verifier");
    assert.match(verifier, /recorded worktree path from the ticket's Worktree cell, not the branch/);
    assert.match(verifier, /scratch checkout at the pre-ticket SHA stays the verifier's to remove and is out of Cleanup/);
    assert.doesNotMatch(state, /usage|Session ID|Budget estimate|Strictness|Run mode/i);
    assert.match(state, /holds its transitive dependants/i);
    assert.match(state, /\/implement-tickets continue <feature-slug>/);
    assert.match(state, /Refuse a `status\.md` whose first line is not `skill: implement-tickets`/);
    assert.match(state, /integration-gate\.md#failing-gate/);
    assert.match(state, /`\.scratch\/<feature-slug>\/report\.md`[\s\S]*Append one entry/);
    assert.match(state, /A clean run writes no report/);
  });
});

describe("implement-tickets documentation and decision record", () => {
  it("files ADR 0023 bilingually and marks the superseded records", async () => {
    const adr = await readRepo("docs/decisions/0023-implement-tickets-minimal-core.md");
    assert.match(adr, /^# ADR 0023: Implement Tickets is a minimal serial core/);
    assert.match(adr, /Supersedes[\s\S]*ADR 0020 decisions 2 and 4[\s\S]*ADR 0021 in full[\s\S]*ADR 0022 decision 1/);
    for (const heading of ["Context / บริบท", "Decision / การตัดสินใจ", "Rejected alternatives / ทางเลือกที่ปฏิเสธ", "Consequences / ผลที่ตามมา"]) {
      assert.ok(adr.includes(`## ${heading}`), `ADR 0023 has ${heading}`);
    }
    assert.match(adr, /[฀-๿]/, "ADR 0023 has Thai text");
    for (const file of ["0020-implement-tickets-core", "0021-touch-set-drift-without-reapproval", "0022-strict-mode-and-risk-based-verification"]) {
      const header = (await readFile(path.join(repoRoot, `docs/decisions/${file}.md`), "utf8")).split("\n").slice(0, 12).join("\n");
      assert.match(header, /ADR 0023/, `${file} names ADR 0023 in its header`);
    }
  });

  it("describes the minimal skill in both languages on both pages, linking the canonical references", async () => {
    for (const [file, prefix] of [["docs/guides/implement-tickets.md", "../../"], ["docs/skills/agents/implement-tickets.md", "../../../"]]) {
      const page = await readFile(path.join(repoRoot, file), "utf8");
      for (const heading of ["ภาษาไทย / Thai", "English / ภาษาอังกฤษ"]) {
        assert.ok(markdownSection(page, heading), `${file} has ${heading}`);
      }
      for (const reference of ["planning", "dispatch-contract", "prompt-scaffold", "verification", "integration-gate", "status-and-resume"]) {
        assert.ok(page.includes(`${prefix}skills/agents/implement-tickets/references/${reference}.md`), `${file} links ${reference}`);
      }
      assert.match(page, /\/implement-tickets continue \[slug\]/);
      assert.match(page, /ADR 0023/);
      assert.doesNotMatch(page, /--parallel|--strict|--with|adapter-contract|parallel-validation|waves\.mjs/, `${file} has no removed option`);
    }
  });

  describe("review fix 1 — unnamed harness branch is left alone", () => {
    const tokens = [
      /A harness branch the (?:worker )?result does not name is not deleted by Cleanup/,
      /Cleanup reports it as an unknown branch in `report\.md` \(Step `cleanup`\)/,
      /the handoff names it/,
    ];

    it("says in the dispatch contract assumption paragraph that Cleanup leaves it and reports it unknown", async () => {
      const section = await skillSection("references/dispatch-contract.md", "Worker branch per attempt");
      matchAll(section, tokens, "dispatch contract, Worker branch per attempt");
    });

    it("says in the integration gate Cleanup section that Cleanup leaves it and reports it unknown", async () => {
      const section = await skillSection("references/integration-gate.md", "Cleanup");
      matchAll(section, tokens, "integration gate, Cleanup");
    });
  });

  describe("ticket 05 — Cleanup in the guide and the skill doc", () => {
    it("describes Cleanup after a green gate and its exceptions in Thai and English", async () => {
      for (const file of ["docs/guides/implement-tickets.md", "docs/skills/agents/implement-tickets.md"]) {
        const thai = await repoSection(file, "ขั้นตอนหลัก");
        matchAll(thai, [
          /\*\*Cleanup:\*\* ลบ worktree ตามด้วย Worker branch/,
          /หลัง gate เขียว/,
          /ไม่ลบ worktree ของ attempt/,
          /ticket ที่ BLOCKED/,
          /`report\.md` \(Step `cleanup`\)/,
          /integration-gate\.md#cleanup/,
        ], `${file} Thai Main workflow`);
        const english = await repoSection(file, "Main workflow");
        matchAll(english, [
          /\*\*Cleanup:\*\* after a green gate/,
          /remove the ticket's worktree, then the Worker branch/,
          /failed the gate, was rejected by the verifier or for extras/,
          /every worktree of a BLOCKED ticket/,
          /`report\.md` \(Step `cleanup`\)/,
          /the handoff names each leftover worktree/,
          /integration-gate\.md#cleanup/,
        ], `${file} English Main workflow`);
      }
    });
  });

});
