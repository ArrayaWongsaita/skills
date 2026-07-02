---
name: grill-tdd-clean
description: Clarify requirements through a focused grilling interview, capture durable docs such as ADRs and glossary entries when decisions or domain language emerge, reduce common LLM coding mistakes, implement changes with vertical test-driven development, and clean the result with pragmatic review. Use when the user wants rigorous feature or bug-fix execution, red-green-refactor workflow, requirement sharpening, design interrogation with documentation, surgical changes, overengineering avoidance, code cleanup, or a single workflow that combines planning pressure, TDD, docs, and clean implementation quality.
---

# Grill TDD Clean

Use this skill to turn an unclear or risky coding request into clarified requirements, durable design notes, tested behavior, and clean code. Keep the workflow self-contained: do not ask the user to invoke or read other skills.

## Workflow

1. Ground in the codebase before asking questions. Inspect likely entrypoints, tests, types, configs, and existing patterns.
2. Surface assumptions, ambiguity, and tradeoffs. If multiple meanings are plausible and materially affect the result, ask before coding.
3. Grill the request until the work is decision-ready. Clarify the goal, success criteria, audience or caller, in-scope and out-of-scope behavior, constraints, failure modes, and acceptance tests.
4. Capture durable docs while grilling. Record domain terms, rejected options, chosen decisions, and ADR candidates when they will matter after the current task.
5. For non-trivial work, state a short plan where each step has a verification check.
6. Identify public seams before writing tests. A seam is the interface where behavior can be observed without reaching into internals. Prefer user-facing, API, CLI, component, service, or module boundaries already used by the project.
7. Write one failing test for one vertical behavior slice. The test must fail for the intended reason before production code changes.
8. Make the smallest implementation change that passes the test. Do not add speculative behavior for future tests.
9. Repeat red-green cycles until the requested behavior is covered.
10. Clean the code after behavior is green. Improve names, structure, duplication, error handling, and abstraction without changing behavior.
11. Verify with the relevant test, lint, typecheck, or build commands. Report what changed, what passed, what docs changed or were deferred, and any residual risk.

## Grilling Checklist

Ask only questions that materially change the implementation or test plan. Prefer discovering facts from the repo over asking the user.

- What exact behavior should change, and how will success be observed?
- Who or what calls this behavior?
- What input, state, permissions, or configuration matter?
- What should happen for invalid, missing, duplicate, empty, slow, or failing dependencies?
- Which existing behavior must not change?
- Which public seams should be tested?
- What domain words, states, roles, or workflows need precise shared definitions?
- What decision is being made, what options were rejected, and why?
- Is this decision durable enough to document as an ADR or glossary update?
- What is explicitly out of scope for this pass?

If the user wants immediate execution and the remaining ambiguity is low-risk, proceed with documented assumptions instead of blocking.

## Documentation During Grilling

Create or update docs only when they will prevent future confusion. Do not create paperwork for trivial fixes.

- Use existing documentation conventions first. Look for `docs/`, `adr/`, `decisions/`, `CONTEXT.md`, glossary files, or project-specific templates before inventing a format.
- Add an ADR when a decision changes architecture, data ownership, integration boundaries, public contracts, persistence, deployment, security posture, or long-term tradeoffs.
- Keep ADRs short: context, decision, considered options, consequences, status, and date if the project convention uses dates.
- Add glossary entries when domain terms, actor names, lifecycle states, business rules, or acronyms are ambiguous or newly defined.
- Use the same vocabulary in docs, tests, code names, and user-facing behavior.
- If docs are useful but out of scope for the current change, report the exact ADR or glossary entry that should be added later.

## Execution Guardrails

- Define verifiable success criteria before changing code. Turn vague requests into checks such as failing tests, passing validations, or observable behavior.
- Prefer the minimum code that solves the stated problem. Do not add features, configuration, extension points, or abstractions that were not requested.
- Keep changes surgical. Every changed line should trace directly to the user's request, test support, or cleanup caused by the current change.
- Match existing project style, even when another style would be preferable.
- Do not improve adjacent code, comments, formatting, or architecture unless it is necessary for the requested change.
- Remove imports, variables, functions, and tests made unused by the current change. Mention pre-existing dead code instead of deleting it.
- Push back when the simpler approach is better, the requested design is risky, or the success criteria are not verifiable.
- If a solution grows much larger than expected, pause and simplify before continuing.

## TDD Rules

- Red before green: do not write production code until there is a failing test.
- Work in vertical slices: one seam, one behavior, one failing test, one minimal implementation.
- Test behavior through public interfaces, not private methods or implementation details.
- Name tests like specifications of user- or caller-visible behavior.
- Use independent expected values: literals, worked examples, fixtures, or stated requirements. Do not recompute expected values with the same logic as the code under test.
- Avoid horizontal slicing where many imagined tests are written before implementation feedback.
- Refactor only after the test is green.

## Test Quality

Good tests:

- Verify behavior the user, caller, or system boundary cares about.
- Exercise public APIs or stable seams.
- Survive internal refactors.
- Describe what happens, not how it happens.
- Keep assertions focused on one logical behavior.

Bad tests:

- Mock internal collaborators or assert private call counts.
- Test private methods directly.
- Verify through side channels when a public interface can observe the result.
- Break when implementation changes but behavior stays the same.
- Use tautological assertions that duplicate the implementation.

## Mocking Policy

Mock only system boundaries:

- External APIs and services.
- Time, randomness, and environment.
- File systems when real files would make tests slow or brittle.
- Databases when a test database is unavailable or excessive for the seam.

Do not mock code owned by the project merely to make a test easier. Prefer dependency injection for external dependencies, and keep boundary interfaces specific enough that mocks return one clear shape per operation.

## Clean-Code Review

After tests pass, clean the touched code with these rules:

- Use intention-revealing, searchable names.
- Keep functions small and single-purpose.
- Keep one level of abstraction per function.
- Prefer clear code over explanatory comments; keep comments only for legal notes, non-obvious intent, external quirks, or tracked TODOs.
- Avoid hidden side effects and surprising global state changes.
- Keep related code close together and variables near their use.
- Use explicit error handling that preserves the main flow.
- Avoid returning or passing null-like values unless the project convention requires it.
- Reduce meaningful duplication, but do not introduce abstractions before they simplify real repeated behavior.
- Keep classes and modules focused on one responsibility.

## Completion Standard

Finish with a concise report:

- Behavior implemented or clarified.
- Docs created, updated, or intentionally deferred.
- Tests and checks run, including failures that remain.
- Important files changed.
- Assumptions made.
- Residual risks or follow-up work if any.
