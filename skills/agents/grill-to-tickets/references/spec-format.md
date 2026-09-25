Adapted from mattpocock/skills:skills/engineering/to-spec/SKILL.md (sha256 folder hash 3fa1a0695d4ea242fae9e569e4d22aa1788623197abb33bfadafae7315789bbf). See [UPSTREAM-LICENSE.md](UPSTREAM-LICENSE.md).

# Spec Format

Turn the agreed context, decisions, and codebase understanding into `spec.md`. Synthesize what is already settled in `decisions.md`; keep the interview closed.

## Process

1. **Explore the codebase.** Understand the current state of the code, if you have not already. Use the project's domain glossary vocabulary throughout the spec, and respect any ADRs in the area being touched.

2. **Sketch test seams.** Sketch out the seams at which the feature will be tested. Existing seams are preferred to new ones; choose the highest seam possible. When new seams are needed, place them at the highest viable point. The fewer seams across the codebase, the better — the ideal number is one. Check with the user that these seams match their expectations.

3. **Write the spec.** Write `.scratch/<feature-slug>/spec.md` following the template below.

Every logged decision in `decisions.md` must appear in the spec — as a user story, an implementation decision, a testing decision, an out-of-scope line, or a further note. Every blind-spot assumption from Stage 0 must appear in Further Notes.

Keep headings unique: no heading in `spec.md` may repeat another heading's text, so that Context references stay unambiguous. When user stories are grouped into categories, use bold lines (for example, `**Group Name**`), not markdown headings.

Avoid specific file paths or code snippets in the spec prose. They go stale quickly. Exceptions:
- A `### Changed tests and wording` subsection under Testing Decisions lists existing tests and prose that the change contradicts by path and line. Outside this subsection, omit file paths.
- If a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it within the relevant decision and note briefly that it came from a prototype. Trim to the decision-rich parts, not a working demo.

Under Implementation Decisions, include a `### Reuse Plan` subsection: name every reusable module the spec touches, by bare symbol, categorized as use as-is, extend, create shared, create candidate, promote, or kept separate on purpose, following [reuse-pass.md](reuse-pass.md).

## Spec Template

```markdown
# Spec — <Feature Name>

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A numbered list of user stories. Each user story follows the format:

1. As an <actor>, I want a <feature>, so that <benefit>

This list should be extensive and cover all aspects of the feature. When grouping stories, format category headers as bold lines (e.g. `**Category Name**`), not headings.

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built or modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Omit file paths and code snippets here (except inlined prototype snippets).

### Reuse Plan

- **Use as-is:** `symbol` → stories
- **Extend:** `symbol` — interface changes; existing callers unchanged → stories
- **Create shared:** `symbol(args): ReturnType` — invariants; error modes — consumers: stories — use for: purpose
- **Create candidate:** `symbol(args)` — plausible second use — use for: purpose
- **Promote:** `symbol` — new consumer → stories
- **Kept separate on purpose:** pair of look-alike modules and why they change for different reasons

## Testing Decisions

A list of testing decisions that were made:

- What makes a good test (only test external behavior at the public seam, not internal implementation details)
- Which modules will be tested
- Prior art for the tests (similar tests in the codebase)

### Changed tests and wording

List existing tests and documentation that this change contradicts, by path and line number. Outside this subsection, keep file paths out of the spec.

## Out of Scope

A description of things that are out of scope for this spec.

## Further Notes

Any further notes about the feature, including every stated assumption from the blind-spot pass.
```
