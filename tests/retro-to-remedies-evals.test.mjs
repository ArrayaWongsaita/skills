import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

async function fileExists(filePath) {
  await access(filePath, constants.R_OK);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

const evalDirs = [
  "skills/agents/retro-to-remedies/evals",
  ".agents/skills/retro-to-remedies/evals",
];
const canonicalDir = evalDirs[0];

const evalsJson = () => readJson(path.resolve(canonicalDir, "evals.json"));
const triggerJson = () => readJson(path.resolve(canonicalDir, "trigger-evals.json"));

describe("retro-to-remedies eval suite contract", () => {
  it("ships trigger-evals.json and evals.json in canonical and mirror copies", async () => {
    for (const dir of evalDirs) {
      await fileExists(path.resolve(dir, "trigger-evals.json"));
      await fileExists(path.resolve(dir, "evals.json"));
    }
  });

  it("keeps every eval file byte-identical across the skill copies", async () => {
    for (const name of ["trigger-evals.json", "evals.json"]) {
      const contents = await Promise.all(
        evalDirs.map((dir) => readFile(path.resolve(dir, name), "utf8")),
      );
      for (const other of contents.slice(1)) {
        assert.equal(other, contents[0], `${name} copies must match ${canonicalDir}`);
      }
    }
  });

  describe("trigger-evals.json", () => {
    it("confirms positive cases for /retro-to-remedies with/without slug, with --transcript, with --fresh, and $retro-to-remedies", async () => {
      const triggers = await triggerJson();
      const positives = triggers.filter((t) => t.should_trigger);

      assert.ok(positives.some((t) => t.query.trim() === "/retro-to-remedies"), "bare /retro-to-remedies");
      assert.ok(positives.some((t) => /\/retro-to-remedies\s+[a-z0-9_-]+/i.test(t.query) && !t.query.includes("--")), "/retro-to-remedies with slug");
      assert.ok(positives.some((t) => t.query.includes("/retro-to-remedies") && t.query.includes("--transcript")), "/retro-to-remedies with --transcript");
      assert.ok(positives.some((t) => t.query.includes("/retro-to-remedies") && t.query.includes("--fresh")), "/retro-to-remedies with --fresh");
      assert.ok(positives.some((t) => t.query.includes("$retro-to-remedies")), "$retro-to-remedies");
    });

    it("includes at least three negative cases, none using explicit invocation", async () => {
      const triggers = await triggerJson();
      const negatives = triggers.filter((t) => !t.should_trigger);
      assert.ok(negatives.length >= 3, "at least three negative cases are required");
      for (const item of negatives) {
        assert.doesNotMatch(
          item.query,
          /[/$]retro-to-remedies/,
          "negative cases must not use an explicit retro-to-remedies invocation",
        );
      }
    });
  });

  describe("evals.json", () => {
    it("declares skill_name retro-to-remedies and unique ids and names", async () => {
      const payload = await evalsJson();
      assert.equal(payload.skill_name, "retro-to-remedies");
      assert.ok(Array.isArray(payload.evals) && payload.evals.length > 0);
      const ids = new Set();
      const names = new Set();
      for (const item of payload.evals) {
        assert.ok(Number.isInteger(item.id) && !ids.has(item.id), `unique id ${item.id}`);
        ids.add(item.id);
        assert.ok(typeof item.name === "string" && !names.has(item.name), "unique name");
        names.add(item.name);
        assert.ok(Array.isArray(item.files), `case ${item.id} carries a files array`);
        assert.ok(Array.isArray(item.expectations) && item.expectations.length > 0);
      }
    });

    it("drives every case through an explicit retro-to-remedies invocation", async () => {
      for (const item of (await evalsJson()).evals) {
        assert.match(
          item.prompt,
          /[/$]retro-to-remedies/,
          `case ${item.id} must invoke retro-to-remedies explicitly`,
        );
      }
    });

    it("covers the branches listed in ticket 01 (explicit-only start, slug resolution, protected-branch refusal)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));

      assert.ok(
        hay(/explicit-only|explicit invocation only|does not start itself/i),
        "case for explicit-only start",
      );
      assert.ok(
        hay(/argument|slug from argument/i),
        "case for slug from argument",
      );
      assert.ok(
        hay(/integration branch|branch stem/i),
        "case for slug from integration branch stem",
      );
      assert.ok(
        hay(/most recent(ly modified)? .*\.scratch|confirm/i),
        "case for slug from most recent .scratch confirmed",
      );
      assert.ok(
        hay(/protected branch|refuses? on main|main, master, or dev/i),
        "case for protected-branch refusal",
      );
    });

    it("covers the branches listed in ticket 02 (fixture 8 misses, missing status.md, no .scratch asks before transcript)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));

      // fixture Run yields eight Misses of Further Notes table with locations
      assert.ok(
        hay(/fixture.*eight misses|fixture.*8 misses|eight misses.*fixture|fixture.*further notes/i),
        "case for fixture Run yielding eight Misses with locations",
      );

      // Run with no status.md proceeds and names it missing
      assert.ok(
        hay(/missing status\.md|no status\.md.*proceeds|no status\.md.*names it missing/i),
        "case for Run with no status.md proceeding and naming it missing",
      );

      // no .scratch/<feature-slug>/ asks before reading transcript
      assert.ok(
        hay(/no \.scratch.*asks before reading.*transcript|no \.scratch.*asks.*transcript/i),
        "case for no .scratch/<feature-slug>/ asking before reading transcript",
      );
    });

    it("covers the branches listed in ticket 03 (classification of fixture Run, reuse convention rule, evidence-free dropped, Open bug kept out, apply refused on Code remedy)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));

      // fixture Run classified as the spec's Further Notes table:
      // instructions wrong -> Skill fix
      assert.ok(
        hay(/instructions wrong.*Skill fix|wrong.*instructions.*Skill fix/i),
        "case for instructions wrong -> Skill fix",
      );
      // ticket 02's departure -> Check
      assert.ok(
        hay(/ticket 02.*departure.*Check|departure.*Check/i),
        "case for ticket 02's departure -> Check",
      );
      // std-3 -> Check
      assert.ok(
        hay(/std-3.*Check/i),
        "case for std-3 -> Check",
      );
      // std-2 -> Standard
      assert.ok(
        hay(/std-2.*Standard/i),
        "case for std-2 -> Standard",
      );
      // std-4 -> proposed decline
      assert.ok(
        hay(/std-4.*proposed decline/i),
        "case for std-4 -> proposed decline",
      );
      // a reuse convention -> Reuse Catalog Rule
      assert.ok(
        hay(/reuse convention.*Reuse Catalog Rule|reuse convention.*Rule/i),
        "case for a reuse convention -> Reuse Catalog Rule",
      );
      // an evidence-free Remedy dropped
      assert.ok(
        hay(/evidence-free.*dropped|no evidence.*dropped/i),
        "case for evidence-free Remedy dropped",
      );
      // an Open bug kept out of Remedies
      assert.ok(
        hay(/Open bug.*kept out.*Remedies|Open bug.*never.*Remed/i),
        "case for Open bug kept out of Remedies",
      );
      // apply refused on a Code remedy
      assert.ok(
        hay(/apply refused on.*Code remedy|refuse.*apply.*Code remedy/i),
        "case for apply refused on a Code remedy",
      );
    });

    it("covers the branches listed in ticket 04 (applied Standard creates CODING_STANDARDS.md, Pointer creates AGENTS.md, three applied make three commits, red test stops handoff, Code remedy prompt only)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));

      // an applied Standard in a project without CODING_STANDARDS.md creates it
      assert.ok(
        hay(/applied Standard.*without CODING_STANDARDS\.md creates it|applied Standard.*creates.*CODING_STANDARDS\.md/i),
        "case for applied Standard in project without CODING_STANDARDS.md creates it",
      );

      // a Pointer in a project with neither instruction file creates AGENTS.md
      assert.ok(
        hay(/Pointer.*neither instruction file creates AGENTS\.md|Pointer.*creates.*AGENTS\.md/i),
        "case for Pointer in project with neither instruction file creates AGENTS.md",
      );

      // three applied Remedies make three commits
      assert.ok(
        hay(/three applied Remedies make three commits|three applied.*three commits/i),
        "case for three applied Remedies make three commits",
      );

      // a red test stops the handoff
      assert.ok(
        hay(/red `?test`? stops the handoff|red test.*stops.*handoff/i),
        "case for red test stops the handoff",
      );

      // a Code remedy answered hand off appears only as a prompt
      assert.ok(
        hay(/Code remedy answered `?hand off`? appears only as a prompt|Code remedy.*hand off.*only as a prompt/i),
        "case for Code remedy answered hand off appears only as a prompt",
      );
    });

    it("covers the branches listed in ticket 05 (first Retro creates file with header, applied Remedy in its own commit, Run with only declined and deferred still produces log commit, two Runs on different slugs produce distinct ids)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));

      // a first Retro creates the file with its header
      assert.ok(
        hay(/first Retro creates (the )?file with (its )?header|creates.*retro-log\.md.*header/i),
        "case for first Retro creates file with its header",
      );

      // an applied Remedy's entry lands in its own commit
      assert.ok(
        hay(/applied Remedy('s)? entry lands in (its )?own commit|applied Remedy('s)? entry.*same commit/i),
        "case for applied Remedy's entry lands in its own commit",
      );

      // a Run with only declined and deferred Remedies still produces the log commit
      assert.ok(
        hay(/Run with only declined and deferred.*log commit|declined and deferred.*chore\(retro\):\s*log/i),
        "case for Run with only declined and deferred Remedies still produces log commit",
      );

      // two Runs on different slugs produce distinct ids
      assert.ok(
        hay(/two Runs on different slugs produce distinct ids|distinct ids.*different slugs|two Runs.*distinct ids/i),
        "case for two Runs on different slugs produce distinct ids",
      );
    });

    it("covers the branches listed in ticket 06 (re-run on fixture counts nothing as recurrence, Standard becomes Failed Remedy Check, declined recurs proposed with both occurrences, declined without recurrence not proposed, handed-off done becomes applied)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));

      // re-running on the fixture Run after its Retro counts nothing as recurrence
      assert.ok(
        hay(/re-running on (the )?fixture Run after its Retro counts nothing as recurrence|fixture.*nothing as recurrence/i),
        "case for re-running on fixture Run after its Retro counts nothing as recurrence",
      );

      // a Standard applied in one Run whose Miss appears in another becomes a Failed Remedy proposed as a Check
      assert.ok(
        hay(/Standard applied in one Run whose Miss appears in another becomes a Failed Remedy proposed as a Check|Standard applied.*Failed Remedy.*Check/i),
        "case for Standard applied in one Run becoming Failed Remedy Check",
      );

      // a declined Remedy whose Miss recurs is proposed with both occurrences
      assert.ok(
        hay(/declined Remedy whose Miss recurs is proposed with both occurrences|declined Remedy.*recur.*both occurrences/i),
        "case for declined Remedy whose Miss recurs is proposed with both occurrences",
      );

      // a declined Remedy without a new occurrence is not proposed
      assert.ok(
        hay(/declined Remedy without a new occurrence is not proposed|declined.*without (a )?new occurrence.*not proposed/i),
        "case for declined Remedy without a new occurrence is not proposed",
      );

      // a handed-off Remedy answered "done" becomes applied
      assert.ok(
        hay(/handed-off Remedy answered ["']?done["']? becomes `?applied`?|handed-off.*done.*applied/i),
        "case for handed-off Remedy answered done becomes applied",
      );
    });

    it("covers the branches listed in ticket 07 (fixture subagent-implement fixes routed as own-library prompts, mattpocock Upstream feedback, globally installed own skill, no lock entry project-local, issue request opens one issue and nothing more)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));

      // the fixture Run's subagent-implement fixes routed as own-library prompts for this repository
      assert.ok(
        hay(/subagent-implement fixes routed as own-library prompts for this repository|subagent-implement.*own-library prompt/i),
        "case for fixture subagent-implement fixes routed as own-library prompts",
      );

      // a Miss caused by a mattpocock/skills skill becomes Upstream feedback
      assert.ok(
        hay(/mattpocock\/skills.*Upstream feedback|mattpocock.*Upstream feedback/i),
        "case for mattpocock/skills skill becoming Upstream feedback",
      );

      // a globally installed own skill is found through the global lock
      assert.ok(
        hay(/globally installed own skill.*(is )?found through (the )?global lock|global lock.*globally installed/i),
        "case for globally installed own skill found through global lock",
      );

      // a skill with no lock entry is project-local
      assert.ok(
        hay(/skill with no lock entry.*is project-local|no lock entry.*project-local/i),
        "case for skill with no lock entry is project-local",
      );

      // an issue request opens one issue and nothing more
      assert.ok(
        hay(/issue request opens one issue and nothing more|opens one issue and nothing more/i),
        "case for issue request opening one issue and nothing more",
      );
    });

    it("covers the branches listed in ticket 08 (--transcript lists matching sessions and waits for pick, without flag no transcript read, outside Claude Code path asked, subagent return holds Misses only)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));

      // --transcript lists matching sessions and waits for a pick
      assert.ok(
        hay(/--transcript.*lists matching sessions and waits for a pick|--transcript.*(lists|waits for a pick)/i),
        "case for --transcript listing matching sessions and waiting for a pick",
      );

      // without the flag no transcript is read
      assert.ok(
        hay(/without (the )?flag no transcript is read|no transcript is read without (the )?flag|without --transcript/i),
        "case for without the flag no transcript is read",
      );

      // outside Claude Code the path is asked for
      assert.ok(
        hay(/outside Claude Code (the )?path is asked for|outside Claude Code.*path/i),
        "case for outside Claude Code the path is asked for",
      );

      // the subagent's return holds Misses only
      assert.ok(
        hay(/subagent('s)? return holds Misses only|read-only subagent.*Misses only/i),
        "case for subagent's return holds Misses only",
      );
    });

    it("covers the branches listed in ticket 09 (report with no answers resumes at pause without re-reading sources, report with two of three applied Remedies committed resumes at Stage 2 committing only the third, --fresh rebuilds report from sources)", async () => {
      const { evals } = await evalsJson();
      const hay = (re) => evals.some((e) => re.test(e.name) || re.test(e.expected_output));

      // a report with no answers resumes at the pause without re-reading sources
      assert.ok(
        hay(/report with no answers resumes at (the )?pause without re-reading sources|no answers resumes at (the )?pause/i),
        "case for report with no answers resumes at the pause without re-reading sources",
      );

      // a report with two of three applied Remedies committed resumes at Stage 2 and commits only the third
      assert.ok(
        hay(/report with two of three applied Remedies committed resumes at Stage 2 and commits only the third|two of three applied.*commits only the third/i),
        "case for report with two of three applied Remedies committed resumes at Stage 2 and commits only the third",
      );

      // --fresh rebuilds the report from the sources
      assert.ok(
        hay(/--fresh rebuilds (the )?report from (the )?sources|--fresh rebuilds.*report/i),
        "case for --fresh rebuilds the report from the sources",
      );
    });
  });
});




