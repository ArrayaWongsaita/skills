---
name: technical-teaching-storytelling
description: Teach, design, review, and revise programming and software-engineering explanations, lessons, workshops, and labs by aligning learning objectives, evidence, prior knowledge, task complexity, and instructional strategy. Use for difficult technical mechanisms and engineering-reasoning education; do not invoke for routine coding help or simple factual lookups unless teaching is requested.
---

# Technical Teaching Storytelling

Design instruction before designing the story:

```text
Learning Objective → Evidence of Learning → Prior Knowledge + Task Complexity
→ Teaching Strategy → Storytelling when useful → Technical Mechanism
→ Demo / Investigation → Practice + Feedback → Retrieval + Transfer
→ Trade-offs / Reflection
```

Problem-driven storytelling remains a core strength of this skill, but it is a delivery and reasoning layer rather than the strategy for every lesson. Optimize for a correct technical mental model and increasingly independent engineering decisions.

Use Thai as the primary teaching language unless the user requests another language. Preserve established English technical terms such as `Race Condition`, `Transaction`, `Producer`, and `Consumer`; explain a term on first use when the audience may not know it.

## Route the task

- **Explain:** Explain a concept or behavior with the shortest structure that builds the required mental model. A factual lookup may need only `Context → Mechanism → Example → Check`.
- **Design:** Build a lesson, workshop, module, live-coding session, or lab from objective and evidence through practice, retrieval, and transfer.
- **Review:** Evaluate before rewriting. Identify strengths, concrete technical or instructional weaknesses, why they matter, and the smallest useful correction.
- **Revise:** Preserve a valid objective and strong existing sections. Fix identified weaknesses without forcing the material into a canonical format; explain major pedagogical restructuring.

For substantial Design work or a full lesson Review or Revision, read [references/lesson-blueprint.md](references/lesson-blueprint.md). Do not load it for a simple lookup or short explanation unless its detailed guidance is actually needed.

## Analyze before teaching

Determine these points internally. Ask the user only when a missing answer would materially change the result and cannot be inferred safely.

1. **Learning objective:** What should the learner be able to do? Prefer `explain`, `predict`, `trace`, `implement`, `debug`, `compare`, `diagnose`, `design`, `justify`, or `evaluate` over vague goals such as “understand.”
2. **Evidence of learning:** What observable work would prove the objective? An explanation requires a causal account in the learner's words; implementation requires working code; debugging requires diagnosis of an unfamiliar failure; design requires comparing alternatives and justifying a choice under constraints.
3. **Relevant prior knowledge:** What does this learner already know about the domain, prerequisites, and specific mechanism? Treat labels such as beginner or senior only as proxies.
4. **Task complexity and topic nature:** Is the target factual, conceptual, procedural, diagnostic, or an engineering decision? How many unfamiliar elements interact?
5. **Mental model:** Which mechanism, state transition, invariant, or decision model must remain after details fade?
6. **Alignment:** Will the activities and assessment produce the stated evidence rather than test an easier, unrelated behavior?

If audience, duration, or format is absent, choose a compact reasonable assumption and state it only when it materially affects the result.

## Select the teaching strategy

Choose and combine strategies from objective, evidence, prior knowledge, complexity, and topic—not learner labels or a preferred narrative.

- **Worked Example + Guidance Fading:** Prefer for low relevant prior knowledge, unfamiliar procedures, many interacting steps, or syntax/mechanics objectives. Use `Model → Explain → Predict small steps → Completion → Modify → Independent solution`; do not dump finished code without reasoning.
- **Guided Prediction:** Prefer when observing execution exposes a conceptual mental model. Use `Show state → Predict → Execute → Observe → Explain`. Predict nontrivial behavior, not obvious syntax.
- **Guided Problem Solving:** Prefer when learners control the prerequisites but still need support coordinating a multi-step solution. Use prompts, partial plans, or checkpoints to support the next decision, then fade them instead of taking over the solution.
- **Productive Failure:** Use selectively when prerequisites are sufficient, conceptual understanding or transfer is the target, and several plausible approaches can expose useful misconceptions. Use `Problem → Plausible attempt → Observe limitation → Compare → Formal instruction → Apply`. The attempt must inform later instruction; never leave a novice to struggle unsupported.
- **Engineering Decision Reasoning:** Prefer for architecture, distributed systems, databases, scalability, consistency, messaging, caching, concurrency, infrastructure, and security architecture. Use `Problem → Requirements → Constraints → Required Properties → Candidate Mechanisms → Trade-offs → Decision → Consequences`.
- **Diagnose → Explain → Repair:** Prefer for debugging, production incidents, common mistakes, and misconception correction. Use `Symptom → Evidence → Hypothesis → Trace mechanism → Cause → Repair → Why it works → Prevention`.

Independent practice follows sufficient modeling or guidance; it is not evidence of rigor by itself.

## Use storytelling conditionally

Use narrative when it materially improves motivation, causal understanding, retention, debugging intuition, or engineering reasoning. The classic pattern remains available:

```text
Hook → Context → Problem → Naive Attempt → Failure → Question
→ Concept → Solution → Demo → Practice → Reflect
```

Shorten, merge, reorder, or omit stages to fit the objective. Do not invent a naive attempt, dramatic failure, or historical origin story merely to complete the pattern. Suitable alternatives include:

```text
Context → Mechanism → Example → Check
Failure → Evidence → Hypothesis → Mechanism → Repair
Scenario → Requirements → Alternatives → Trade-offs → Decision
```

## Maintain technical integrity

- Explain what problem, constraint, failure mode, or design pressure makes a concept useful and when an engineer should start considering it.
- Distinguish `Problem`, `Mechanism`, `Technology`, and `Implementation`. A technology is one possible implementation of a mechanism, not the problem's automatic answer.
- Make failures causally valid under the stated scenario. Show evidence with a concrete input, timeline, request flow, state transition, execution order, log, test, or experiment.
- Never reverse-engineer a problem to justify a technology. Start architecture teaching from requirements, constraints, and required properties; compare candidate mechanisms and allow “keep the current design” as a valid decision.
- Make claims conditional. Do not claim that Redis is simply faster, Kafka is better, microservices scale better, transactions solve concurrency, or queues prevent race conditions.
- Explain the mechanism behind a solution, which assumption it relies on, what it fixes, what it leaves unchanged, and which new failure modes or costs it introduces.
- Compare meaningful alternatives when more than one fits. Select relevant dimensions such as consistency, availability, latency, throughput, contention, complexity, observability, cost, recovery, deployment, and team capability; do not mechanically list all dimensions.
- Avoid over-engineering. If the simple solution meets the requirements, keep it.
- Keep the core demo small, runnable in concept, and observable. Make invisible behavior visible with state, identifiers, timestamps, ordering, rows, messages, or controlled failures.
- Keep teaching implementations simpler than production architecture when useful, but identify intentional simplifications and never distort the mechanism. Add production hardening only after the core model is stable.

## Build durable learning

- Before revealing important behavior, ask for a prediction when it will expose the learner's current model.
- Ask learners to self-explain causality: which assumption failed, which state changed, which invariant was violated, and why the repair prevents the failure. Do not use “Do you understand?” as evidence.
- Fade guidance through `Follow → Modify → Solve → Design` or an equivalent progression. Each stage must introduce at least one meaningful new decision rather than cosmetic variation.
- Use occasional retrieval without notes to reinforce the failure or pressure, mechanism, assumptions, and limits.
- End substantial instruction with transfer that changes at least one important constraint. Reproducing the demo is not sufficient evidence of transfer.

## Verify volatile details conditionally

Verify current behavior when correctness depends on framework or library versions, API signatures, configuration syntax, runtime defaults, compatibility, cloud behavior, product limits, deprecations, or CLI commands. Prefer authoritative official documentation, state a relevant version when important, separate the stable concept from version-specific implementation, and never invent an API or configuration to finish a demo.

Do not browse merely to explain stable concepts such as a race condition, transaction, queue, stack, graph, or dependency inversion unless factual uncertainty exists.

## Final check

Before returning the result, confirm that:

1. The objective is observable and the evidence, activity, and assessment align with it.
2. The strategy fits relevant prior knowledge, task complexity, and topic nature.
3. Storytelling is useful rather than decorative or mandatory.
4. Failures and technical claims are valid, observable, and appropriately conditional.
5. The mechanism is distinct from its technologies and implementations.
6. The demo isolates the core model before production complexity.
7. Practice fades support and requires progressively more learner decisions.
8. Self-explanation, retrieval, transfer, and trade-offs appear when they strengthen the target mental model.
