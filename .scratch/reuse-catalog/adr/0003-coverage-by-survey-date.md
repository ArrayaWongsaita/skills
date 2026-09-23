# Coverage records the survey date per area; re-surveys read only what changed

A catalog bootstrapped from one feature's survey covers only that feature's
area. Without a record of what was surveyed, later agents either trust a partial
catalog as complete (and miss existing code) or re-survey everything (and the
catalog saves nothing). So the catalog carries a **Coverage** section: one line
per surveyed area with the date of its last survey.

The Reuse survey then reads exactly the gaps: areas the idea touches that are not
in Coverage get a full survey; covered areas get a re-read of only the files
changed since their date —
`git log --since=<date> --first-parent --diff-merges=first-parent --name-only --format= -- <area>`.
Only a survey moves a Coverage date; an integration-time entry write does not.

Why a date and not a commit SHA: squash-merged PRs and rebases make a recorded
SHA unreachable from `main`, which would force full re-surveys in exactly the
workflow this repo uses. A date errs toward re-reading (rebased or same-day
commits show up again, harmlessly) and never toward missing a change.
`--first-parent` with first-parent merge diffs keeps a branch whose commits are
dated before the survey but merged after it from slipping through.
