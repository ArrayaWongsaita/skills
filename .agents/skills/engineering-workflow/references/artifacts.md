# Artifacts

Repository conventions win. These defaults apply only when no convention is
documented:

| Artifact | Default path |
|---|---|
| tracker configuration | `docs/agents/issue-tracker.md` |
| workflow scratch root | `.scratch/<effort>/` |
| discovery/alignment evidence | `.scratch/<effort>/discovery.md` |
| specification | `.scratch/<effort>/spec.md` |
| tickets | `.scratch/<effort>/issues/<NN>-<slug>.md` |
| research/prototype evidence | `.scratch/<effort>/evidence/` |
| diagnosis/regression evidence | `.scratch/<effort>/evidence/diagnosis.md` and `regression.md` |
| design review | `.scratch/<effort>/reviews/design.md` |
| code review | `.scratch/<effort>/reviews/code.md` |
| system review | `.scratch/<effort>/reviews/system.md` |
| implementation verification | `.scratch/<effort>/evidence/implementation.md` |
| wayfinder map/frontier | tracker convention or `.scratch/<effort>/wayfinding.md` |
| post-mortem | `.scratch/<effort>/post-mortem.md` |

State stores only repository-relative artifact references with `kind`,
`fingerprint` (`sha256:<hex>`), `producerStage`, and optional `gitRef`.
Unchanged registration is idempotent. One stable review path is updated per
gate cycle; a second path for the same review kind is rejected. Design and
system review artifacts carry the concise cycle/progress record, while full
reports stay in the artifact rather than in workflow JSON. Each gate may
complete at most six scrutinize reviews; cycle 7 is never created
automatically.

On resume, missing/changed references, Git drift, worktree drift, or failed
verification rewinds to the earliest affected producer and records the reason.
Do not duplicate an artifact whose body already exists.

Domain glossary and ADRs are created lazily under repository conventions. A
missing tracker should be handled by the provider's existing setup skill, not a
new skill authored by this repository.
