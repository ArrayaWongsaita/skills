# The conditional system-scrutinize gate (Stage 3)

`scrutinize` is an end-to-end code-path trace with its own six-cycle budget —
expensive. On a self-contained feature whose blast radius the code-review Spec
axis already covered, it mostly restates the code-review result. So Stage 3 runs
it **only when the integrated change is cross-cutting or risky**. The checklist
below is feature ADR 0003, spelled out in full so an installed reader needs no
other file.

## 1. The cross-cutting / risky checklist

Judge `git diff <review-point>...HEAD`. The system gate runs when **any** of
these holds:

- the diff touches **routing** (a router, a route table, URL dispatch);
- the diff touches a **DI container** or a service-wiring root;
- the diff touches a **root schema** (a database schema, a root validation
  schema, a shared type that many modules import);
- the diff touches a **migrations directory**;
- the diff touches **shared config** (`package.json`, lockfiles, CI config, a
  root config module that many modules read);
- the diff touches **auth** (authentication or authorization);
- the diff touches **concurrency or locking**;
- the diff changes an **on-wire or on-disk format** (an API contract, a
  serialized shape, a file format);
- the diff **spans many modules** (a wide blast radius);
- the **code-review loop surfaced a structural finding** — Shotgun Surgery,
  Divergent Change, a wrong-layer decision.

**None of those** → skip Stage 3. Record the skip for the handoff as
`self-contained — skipped` and go straight to Stage 4.

## 2. The inline scrutinize pass

When the gate runs, run the installed `scrutinize` skill **inline, end-to-end**,
over `git diff <review-point>...HEAD` — intent first (is there a simpler way?),
then the real code path, not just the diff.

`scrutinize` closes with a lower-case one-liner. Normalize it to **exactly** one
of its four tokens, with **no paraphrasing and no intermediate synonym**:

| `scrutinize` closing line | normalized verdict |
| --- | --- |
| `ship` | `ship` |
| `fix-then-ship` | `fix-then-ship` |
| `rework` | `rework` |
| `reject` | `reject` |

Record the cycle in `review-status.md`: the reviewed `HEAD` fingerprint, the
verdict, the blocking findings (stable identities), and the new / resolved /
repeated findings.

## 3. Routing the verdict

- **`ship`** → close the gate, go to Stage 4.
- **`fix-then-ship`** or **`rework`** → enter the sub-loop (§4).
- **`reject`** → stop. Report the **single biggest reason** from `scrutinize` to
  the user. A `reject` is a human decision — there is no auto-loop back into
  fixing.

## 4. The scrutiny sub-loop

For a `fix-then-ship` or `rework` verdict, run:

```
scrutinize → fix → tests or typecheck → code-review → scrutinize
```

- **fix** — the finding's fix goes through the same Stage 2 machinery
  ([fix-dispatch.md](fix-dispatch.md)): cluster, dispatch or inline, one
  `fix(review):` commit.
- **tests or typecheck** — run the affected tests and the typecheck on the fix.
- **code-review** — run the two-axis `code-review` again. This step is **always
  run** — it is the gate check that a scrutinize fix did not regress a standard
  or the spec. This intra-sub-loop `code-review` **consumes a scrutinize cycle,
  not a code cycle** — the Stage 1 three-cycle budget is untouched here.
- **scrutinize** — re-run the inline pass and re-normalize the verdict.

Repeat until `scrutinize` returns `ship`.

## 5. Budget and early stops

- **The ceiling is six scrutinize cycles**, counted independently of the Stage 1
  code budget. One completed `scrutinize` review consumes one scrutinize cycle;
  so does the intra-sub-loop `code-review`. Editing between reviews does not.
- **Stall.** The **same blocking findings surviving two consecutive cycles** —
  with no new and no resolved findings — end the sub-loop early. Report the
  stalled findings rather than mechanically re-reviewing.
- **Budget exhaustion.** If cycle 6 completes without `ship`, stop and report the
  unresolved findings and the per-cycle history. **Cycle 7 needs explicit human
  authorization** and a materially different approach.

## 6. The handoff always records the gate

Whether it ran or not, the Stage 5 handoff states the system gate's disposition:

- ran → which checklist item triggered it, and the closing verdict;
- skipped → `self-contained — skipped`.
