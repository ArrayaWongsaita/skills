# opencode-implement is a standalone sibling, with its own copy of the machinery

`opencode-implement` is the third terminal target for the `grill-to-tickets` handoff,
beside `/implement`, `/agy-implement`, and `/subagent-implement`. It is built as a fully
standalone skill under `skills/agents/opencode-implement/`, mirrored to
`.agents/skills/opencode-implement/`, with a human guide at
`docs/skills/agents/opencode-implement.md` and a repo decision record at
`docs/decisions/0007-opencode-implement-standalone.md`.

It carries its own copy of the planning, worktree, verification, decomposition, fallback,
and state/resume machinery in `references/`. It does not modify or depend on
`grill-to-tickets`, `agy-implement`, `subagent-implement`, `engineering-workflow`, any
`mattpocock/skills`-sourced file, or `skills-lock.json`.

This mirrors repo ADRs 0004 (`agy-implement`) and 0005 (`subagent-implement`), which both
deferred a shared-`references/` refactor until the siblings stop diverging. This is now
the third copy — but `opencode-implement`'s worker contract (a local `opencode run`
process, an interleaved JSONL event stream, a hard 32k context window, context-fit
decomposition, an automatic subagent fallback tier) diverges enough that the shared
surface is still not stable. Three real consumers is a better basis for the eventual
refactor than two; the refactor stays deferred (see spec Further Notes).

Rejected: build it as a thin variant sharing `subagent-implement`'s references (the
serial-execution shape is close, but the dispatch, decomposition, and fallback
machinery are not). Rejected: wire it into `engineering-workflow` as an
`IMPLEMENTATION` delegate (the owner may remove `engineering-workflow`; the standalone
short path needs no dependency registry).
