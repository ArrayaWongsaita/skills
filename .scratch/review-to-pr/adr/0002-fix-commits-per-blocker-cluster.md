# Blocker fixes land as one appended fix(review) commit per cluster

The integration branch arrives with one verified commit per ticket, in
dependency order — the property `subagent-implement` and `agy-implement` both
guarantee and the `feature_commit_granularity` memory asks for. Review fixes
have to land somewhere. Three options: (a) a separate `fix(review):` commit per
blocker cluster, appended; (b) fold each fix into its originating ticket commit
by rewriting integration history; (c) one squashed fix commit at the end.

Decision: (a). Each blocker cluster — a set of related blockers fixed together —
lands as exactly one `fix(review): <summary>` commit on the tip of the
integration branch, in the order the fixes are made. Fix commits are never
folded back into a ticket commit.

Why: append-only means no rebase cascade over the downstream ticket commits, and
no half-rewritten history if the run is interrupted mid-loop. Each cluster stays
its own bisectable unit, which is the *spirit* of the
`feature_commit_granularity` memory (one logical change per commit) applied to
the review phase — the memory's "one commit per ticket" rule governs the
implement pass, and review-fix is a distinct pass. The integration branch was
never pushed, so there is no published-history pressure that would justify (b)'s
fragility.

Trade-off: the eventual PR shows `01..NN` ticket commits followed by
`fix(review): …` commits rather than a pristine one-commit-per-ticket series. A
reviewer reads the fixes as their own small commits — acceptable, and arguably
clearer about what review changed. If a pristine series is ever wanted, an
interactive squash before opening the PR is a manual step, not this skill's job.
