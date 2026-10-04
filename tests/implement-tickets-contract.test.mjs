import { spawnSync } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { flatMarkdownSection, markdownSection } from "./helpers/markdown-contract.mjs";

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
    const dispatch = await read("references/dispatch-contract.md");
    assert.match(dispatch, /implement-tickets-work\/<slug>\/NN-aK/);
    assert.match(dispatch, /NN-aK-iJ/);
    assert.match(dispatch, /kept worktree[\s\S]{0,200}never collides/i);
    assert.match(dispatch, /assum[\s\S]{0,200}returns the worktree path and (?:its )?branch name/i);
    assert.match(dispatch, /git worktree list[\s\S]{0,200}confirm|confirm[\s\S]{0,300}git worktree list/i);
    assert.match(dispatch, /keep the worktree[\s\S]{0,120}new branch name/i);
    assert.doesNotMatch(dispatch, /discard the branch/i);
    const scaffold = await read("references/prompt-scaffold.md");
    assert.match(scaffold, /<worker-branch>[\s\S]{0,200}NN-aK/);
    assert.match(scaffold, /per attempt/i);
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
    const gate = await read("references/integration-gate.md");
    assert.match(gate, /green[\s\S]{0,300}row[\s\S]{0,200}written[\s\S]{0,300}Cleanup/i);
    assert.match(gate, /worktree, then the Worker branch, then any other branch the harness created/i);
    assert.match(gate, /integrated attempt and every earlier kept attempt[\s\S]{0,120}infrastructure-retry/i);
    assert.match(gate, /before (?:starting )?the next ticket/i);
    assert.match(gate, /git worktree remove <path>/);
    assert.match(gate, /no force flag/i);
    assert.match(gate, /git branch -D <branch>/);
    assert.match(gate, /squash-merge[\s\S]{0,200}unmerged/i);
    assert.match(gate, /never edits the Branch or Commit columns/i);
    assert.match(gate, /recorded path is `\?`[\s\S]{0,200}looked up by branch name[\s\S]{0,300}Step `cleanup`[\s\S]{0,120}nothing is removed/i);
    assert.match(gate, /fails[\s\S]{0,200}Step `cleanup`[\s\S]{0,200}still attempts the branch deletion[\s\S]{0,200}next ticket/i);
    assert.match(gate, /already gone[\s\S]{0,120}success[\s\S]{0,120}no report entry/i);
    const state = await read("references/status-and-resume.md");
    assert.match(state, /a worktree removal or branch deletion fails/i);
    assert.match(state, /Step: <[^>]*\bcleanup\b[^>]*>/);
    const skill = await read("SKILL.md");
    assert.match(skill, /Cleanup[\s\S]{0,200}integration-gate\.md#cleanup/);
    assert.ok(skill.indexOf("Cleanup") > skill.indexOf("Squash-merge and run the gate"), "Cleanup follows the gate in the flow");
  });

  it("keeps the worktree of a failed, rejected, or conflicted attempt and of a BLOCKED ticket", async () => {
    const gate = await read("references/integration-gate.md");
    assert.match(gate, /Redispatch the ticket[\s\S]{0,300}keeps? (?:its|the old) Worker worktree[\s\S]{0,120}new branch name/i);
    assert.match(gate, /conflict[\s\S]{0,300}old attempt keeps its worktree[\s\S]{0,120}new branch name/i);
    const dispatch = await read("references/dispatch-contract.md");
    assert.match(dispatch, /failed the gate[\s\S]{0,200}verifier[\s\S]{0,200}extras check[\s\S]{0,200}keeps its Worker worktree/i);
    assert.match(dispatch, /redispatch[\s\S]{0,120}new branch name/i);
    assert.match(dispatch, /BLOCKED[\s\S]{0,120}keeps all its attempts' worktrees/i);
    assert.match(dispatch, /never removed at run end/i);
  });

  it("names every leftover worktree in the handoff", async () => {
    const gate = await read("references/integration-gate.md");
    assert.match(gate, /every worktree left behind[\s\S]{0,200}BLOCKED[\s\S]{0,200}failed removal[\s\S]{0,200}unknown path/i);
  });

  it("continues after Worker branches are gone", async () => {
    const state = await read("references/status-and-resume.md");
    assert.match(state, /integrated[\s\S]{0,200}only against its squash commit on the integration branch/i);
    assert.match(state, /removed Worker branch[\s\S]{0,120}not drift/i);
    assert.match(state, /Worker branches? (?:is|are) checked only for[\s\S]{0,80}not integrated/i);
    assert.match(state, /fresh worker, even when[\s\S]{0,60}Worker branch is missing/i);
    assert.match(state, /`verifying` or\s+`dispatched`[\s\S]{0,200}infrastructure-retry[\s\S]{0,60}`NN-aK-iJ`/i);
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
    assert.match(state, /\| Ticket \| Status \| Attempts \| Branch \| Commit \| Worktree \| Extras \| Risk \| Verifier \|/);
    assert.match(state, /`aK: <path>`[\s\S]{0,200}`aK-iJ: <path>`[\s\S]{0,200}\(harness: <branch>\)[\s\S]{0,200}`\?`/);
    assert.match(state, /written when the worker returns/i);
    assert.match(state, /matching its branch name in the worktree list/i);
    assert.match(state, /unknown path/i);
    assert.match(state, /Worktree cell[\s\S]{0,200}local branches[\s\S]{0,200}worktree list[\s\S]{0,200}never from the `Attempts` column/i);
    const verification = await read("references/verification.md");
    assert.match(verification, /recorded worktree path/i);
    assert.match(verification, /scratch checkout[\s\S]{0,200}out of Cleanup/i);
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
    const unnamed = /harness branch[^.]*result does not name[^.]*(?:not deleted|left alone)[^.]*Cleanup[\s\S]{0,300}unknown[\s\S]{0,200}report\.md[\s\S]{0,200}handoff/i;

    it("says in the dispatch contract assumption paragraph that Cleanup leaves it and reports it unknown", async () => {
      const dispatch = await readFile(path.join(skillRoot, "references/dispatch-contract.md"), "utf8");
      const section = flatMarkdownSection(dispatch, "Worker branch per attempt");
      assert.match(section, unnamed);
    });

    it("says in the integration gate Cleanup section that Cleanup leaves it and reports it unknown", async () => {
      const gate = await readFile(path.join(skillRoot, "references/integration-gate.md"), "utf8");
      const section = flatMarkdownSection(gate, "Cleanup");
      assert.match(section, unnamed);
    });
  });

  describe("ticket 05 — Cleanup in the guide and the skill doc", () => {
    it("describes Cleanup after a green gate and its exceptions in Thai and English", async () => {
      for (const file of ["docs/guides/implement-tickets.md", "docs/skills/agents/implement-tickets.md"]) {
        const c = await readRepo(file);
        assert.match(c, /\*\*Cleanup:\*\* ลบ worktree ตามด้วย Worker branch[^.]*gate เขียว[\s\S]{0,400}ไม่ลบ[\s\S]{0,200}BLOCKED/, `${file} Thai Cleanup step with its exceptions`);
        assert.match(c, /\*\*Cleanup:\*\* after a green gate[^.]*remove[^.]*worktree, then the Worker branch[\s\S]{0,400}kept[\s\S]{0,200}BLOCKED[\s\S]{0,300}report\.md/i, `${file} English Cleanup step with its exceptions`);
        assert.match(c, /integration-gate\.md#cleanup/, `${file} links the Cleanup section`);
      }
    });
  });
});
