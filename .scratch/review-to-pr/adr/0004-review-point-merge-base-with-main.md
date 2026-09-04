# The review point defaults to the merge-base with main

Stage 0 has to pin one fixed point that both `code-review` axes and every diff
in the run are measured against. Options: the merge-base with `main` computed
automatically; the first commit of the integration branch; or always ask the
user.

Decision: default to `git merge-base main HEAD`, computed automatically and
pinned for the whole run. An explicit `/review-to-pr <ref>` argument (a commit
SHA, branch, or tag) overrides it. The pinned value is recorded in
`review-status.md` and reused verbatim by `/review-to-pr continue`.

Why: this is the fixed point `subagent-implement` and `agy-implement` already
name in the handoff they print — `/code-review since <merge-base with main>` —
so `review-to-pr` picking it up by default makes the chain seamless. It is also
`code-review`'s own default. The merge-base is correct even when `main` has
advanced since the branch was cut, which the "first commit of the branch" option
is not.

Trade-off: a repo whose integration target is not `main` (a `dev`-based repo,
say) needs the explicit argument on every run. Acceptable — the argument exists,
and `main` is the overwhelmingly common case. The skill does not try to infer
the target branch from remote HEAD or CI config; that guesswork is worse than a
one-token argument.
