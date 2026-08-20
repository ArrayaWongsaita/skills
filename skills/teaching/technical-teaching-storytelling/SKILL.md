---
name: technical-teaching-storytelling
description: Design, revise, or review programming and software-engineering lessons using problem-driven storytelling so learners understand why a concept exists, see realistic failure modes, apply it in a minimal demo, and reason about when to use it. Use for lesson plans, tutorials, workshops, live-coding sessions, hands-on labs, and technical explanations; do not force a story onto a simple factual lookup.
---

# Technical Teaching Storytelling

Make the concept feel like a necessary answer to a problem the learner already understands. The target learning journey is:

```text
See the problem
      ↓
Try a plausible solution
      ↓
Observe its limitation
      ↓
Understand why the concept exists
      ↓
See how it works
      ↓
Apply it
      ↓
Know when to use it—and when not to
```

Use Thai as the primary teaching language unless the user requests another language. Preserve established English technical terms such as `Race Condition`, `Transaction`, `Producer`, and `Consumer`; explain a term on first use when the audience may not know it.

## Analyze before drafting

Determine these points internally before generating the lesson. Ask the user only when a missing answer would materially change the result and cannot be inferred safely.

1. What should the learner be able to explain, implement, debug, or design afterward?
2. What prior knowledge is required?
3. Which realistic problem makes this topic necessary?
4. What plausible first attempt would the learner try?
5. Under what concrete condition does that attempt fail?
6. Which exact part of the failure does the new concept solve?
7. What limitation or trade-off remains?
8. What is the smallest working demo?
9. What practice moves the learner from following to independent reasoning?
10. What durable mental model should the learner retain?

If audience, duration, or format is not specified, choose a reasonable assumption, keep the scope compact, and state only assumptions that affect the lesson materially.

## Use the causal teaching sequence

Default to:

```text
Hook → Context → Problem → Naive Attempt → Failure → Question
     → Concept → Solution → Demo → Practice → Reflect
```

Preserve the causal chain even when shortening or combining stages. A short explanation does not need eleven visible headings; a full lesson normally does.

- **Hook:** Open with a short situation, question, or event that creates curiosity. Do not reveal the answer immediately, and do not begin with a definition when a problem can establish motivation.
- **Context:** Give only the users, current architecture, requirements, and constraints needed to understand the problem.
- **Problem:** Use a problem the concept was genuinely designed to address. Never manufacture a failure merely to justify a preferred technology.
- **Naive Attempt:** When useful, show the simple approach a competent newcomer might reasonably try. First establish why it appears correct.
- **Failure:** Trigger the attempt's real limitation with a concrete input, timeline, request flow, state transition, execution order, or small experiment.
- **Question:** Ask learners what property the solution needs before naming the concept. Make the concept the answer to that question.
- **Concept:** Explain `What`, `Why`, `How`, `When`, and `When Not`, in that order unless the audience requires a different emphasis.
- **Solution:** Apply the concept to the original problem and make the `Problem → Concept → Solution` link explicit.
- **Demo:** Build `Minimal → Working → Extend`. Start with the smallest system that proves the idea before adding production concerns.
- **Practice:** Progress from guided reproduction to changed requirements and independent problem solving. Avoid copy-only exercises.
- **Reflect:** Test the learner's mental model with transfer, comparison, failure-mode, or trade-off questions—not definition recall.

For a complete lesson, workshop, or live-coding plan, read [references/lesson-blueprint.md](references/lesson-blueprint.md) before drafting. It contains the expanded stage playbook, framework patterns, default output structure, practice levels, and examples. For a brief explanation or focused review, use the guidance here and load the reference only when its detail is useful.

## Select the storytelling shape

Choose the lightest structure that fits the topic:

- **Problem → Solution → Result:** Default for technical concepts, backend, databases, algorithms, architecture, DevOps, and security.
- **Before → After → Bridge:** Use for refactoring or architecture improvement. Establish the current design and its problems, define the desired state, then teach the transition.
- **Three-Act Structure:** Use for a large lesson: setup, escalating conflict, then concept-driven resolution.
- **Progressive Failure:** Use for advanced topics where each improvement creates a new constraint. Move through `Solution V1 → Problem → Solution V2 → New Problem → Solution V3 → Trade-off` so learners see why no architecture is universally best.

Do not add narrative complexity to a simple concept. Story serves the technical model; it must not obscure it.

## Maintain technical integrity

- Every concept must answer: “What problem was it created to solve?”
- Distinguish `Requirement`, `Problem`, `Constraint`, `Solution`, and `Trade-off` explicitly.
- Make each failure causally valid under the stated context. Show evidence rather than merely declaring the naive approach wrong.
- Explain why a simpler solution is insufficient before introducing a technology or pattern.
- Compare meaningful alternatives when more than one solution fits. Tie each recommendation to workload, consistency, latency, complexity, cost, team capability, and failure assumptions as relevant.
- Never call a technology “best” without its context. State what it improves, what it does not solve, and what cost it introduces.
- Avoid over-engineering. If the simple solution meets the requirements and constraints, say so.
- For advanced material, increase complexity progressively: `Simple → Problem → Improvement → New Problem → Better Model`.
- Keep code examples small and executable in concept. Add infrastructure and production hardening only after the core mechanism is visible.
- Use ASCII timelines, sequence diagrams, state diagrams, or request flows when concurrency, ordering, distributed behavior, or state changes would otherwise stay abstract.

## Adapt to the audience

### Beginner

Use one concept at a time, minimal code, diagrams, and analogies only when they preserve the technical truth. Define unfamiliar terms and avoid unexplained jargon.

### Intermediate

Emphasize realistic scenarios, debugging, implementation, failure cases, alternatives, and trade-offs.

### Advanced

Emphasize architecture, concurrency, performance, scalability, consistency, distributed failure modes, operational cost, and trade-offs. Prefer a precise technical model over an analogy when the analogy would distort the concept.

## Verify the lesson

Before returning the result, confirm that:

1. The hook creates the question the lesson later answers.
2. The scenario is realistic and contains no irrelevant complexity.
3. The first attempt is plausible and its failure is demonstrated causally.
4. The concept solves the named problem rather than merely appearing after it.
5. The demo proves the core mechanism at the smallest useful scale.
6. Practice requires progressively more learner decisions.
7. Trade-offs and simpler alternatives are visible.
8. Reflection checks whether learners can recognize a new situation where the concept does—or does not—apply.
