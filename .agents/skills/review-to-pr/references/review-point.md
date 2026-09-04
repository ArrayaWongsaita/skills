# Pin the review point (Stage 0)

The read-only opening stage. It reads git and the feature directory, writes only
`.scratch/<feature-slug>/review-status.md`, and pauses for approval. It cuts no
branch, runs no `code-review`, and makes no fix.

## 1. Preflight

- **Clean working tree on the integration branch.** Run `git status
  --porcelain`. Any uncommitted change — staged, unstaged, or untracked that
  would be swept into a fix commit — stops Stage 0 and asks the user to deal with
  it. The run stashes nothing and mixes its work with none of the user's.
- **`main` resolves.** `git rev-parse --verify main` succeeds. A repo whose
  integration target is not `main` needs the explicit `<ref>` argument (see §2);
  the skill infers no other target from remote `HEAD` or CI config.
- **v1 accepts a feature integration branch only.** Read the branch's shape: the
  branch name (a `fix/`, `hotfix/`, or `incident/` prefix) and the commits in
  `git log <review-point>..HEAD` (dominated by `fix:` / `revert:` commits with no
  `feat:` ticket series, or a single emergency commit). When the branch reads as
  a bug fix or an incident rather than a feature ticket series, name what you saw
  and stop — bug-flow and incident-branch support is a deferred follow-up.

## 2. Resolve the review point

The review point is the one fixed point both `code-review` axes and every diff in
the run are measured against. Resolve it once, here, and pin it for the whole run.

1. **An explicit argument that `git rev-parse --verify <arg>` resolves** is the
   review point — a commit SHA, a branch, or a tag.
2. **Otherwise** the review point is `git merge-base main HEAD`. This is correct
   even when `main` has advanced since the branch was cut, and it is the fixed
   point the implement siblings already name in their handoff (`/code-review
   since <merge-base with main>`), so the chain is seamless.

**Argument that is both a ref and a slug.** An argument that `git rev-parse
--verify` resolves *and* also names an existing `.scratch/<arg>/` directory is
taken as the **review-point override**; the feature slug then falls back to the
branch-name stem (§3).

**Halt conditions.** Stop Stage 0, naming the reason, when:

- the argument resolves as neither a git ref nor a `.scratch/<slug>/` directory —
  an unresolvable ref;
- `git diff <review-point>...HEAD` is empty — there is nothing to review.

## 3. Resolve the feature slug and the spec source

Resolve the slug in order:

1. **An explicit `<slug>` argument** (one that does not resolve as a git ref).
2. **Else the integration-branch name stem** — the segment after the last `/`,
   so `subagent-implement/wishlist-sync` → `wishlist-sync` and a flat
   `wishlist-sync` → `wishlist-sync`.
3. **Else the most recently modified `.scratch/*/` directory**, named back to the
   user for confirmation before it is used.

Then set the **spec source** for the Spec axis:

- `.scratch/<feature-slug>/spec.md` and `.scratch/<feature-slug>/issues/` are
  loaded when they exist — the Spec axis reviews against the acceptance criteria
  they carry.
- With neither present, the Spec axis runs against the **commit messages alone**.
  This is the degraded mode; `spec_source` records it as `commit-messages` and
  the Stage 5 handoff states the Spec axis ran degraded.

## 4. Write the initial `review-status.md`

Create `.scratch/<feature-slug>/review-status.md` with, at minimum:

| field | value |
| --- | --- |
| `review_point` | the resolved commit (SHA), plus how it was resolved (`explicit <arg>` or `merge-base main HEAD`) |
| `feature_slug` | the resolved slug |
| `integration_branch` | the current branch name and its `HEAD` SHA |
| `spec_source` | `spec.md + issues/`, `spec.md`, or `commit-messages` |
| `stage` | `0 — awaiting approval` |

The full field set (`code_cycles`, `scrutinize_cycles`, the `findings` ledger,
`fix_commits`) is defined in [status-and-resume.md](status-and-resume.md) and
grows as later stages run.

## 5. Pause for approval

Present, and wait for explicit approval before Stage 1:

- the **review point** and how it was resolved;
- the **commit count** (`git rev-list --count <review-point>..HEAD`) and the
  **file count** (`git diff --stat <review-point>...HEAD`);
- the **spec source** — including whether the Spec axis will run degraded.

Nothing outside `.scratch/<feature-slug>/` has been touched. Approval starts
Stage 1.
