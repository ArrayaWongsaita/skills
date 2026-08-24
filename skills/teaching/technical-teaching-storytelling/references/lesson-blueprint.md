# Technical Lesson Blueprint

Read this reference when designing a complete lesson, tutorial, workshop, live-coding session, or hands-on lab, or when reviewing or substantially revising one. It is a component library and decision guide, not a universal lesson template.

## Align the lesson before choosing its shape

### Define an observable objective

State what the learner should be able to do after the lesson. Convert vague intentions into observable capabilities.

```text
Vague
Understand optimistic locking.

Observable
Explain why lost updates occur and implement optimistic locking
to detect conflicting writes.

Advanced
Compare optimistic locking, pessimistic locking, atomic updates,
and serialization under different contention patterns.
```

Keep the objective narrow enough for the available time. A lesson may have several objectives, but each should earn its own evidence and practice.

### Define evidence of learning

Match evidence to the verb in the objective:

| Objective | Suitable evidence |
| --- | --- |
| Explain | A causal explanation in the learner's own words |
| Predict or trace | A correct prediction or execution trace with reasoning |
| Implement | Working code plus an explanation of the important mechanism |
| Debug or diagnose | Evidence collection, a causal hypothesis, and repair of an unfamiliar failure |
| Compare or evaluate | A comparison using scenario-relevant criteria |
| Design or justify | Alternatives and a defensible decision under explicit constraints |

Do not claim alignment when the objective asks learners to design but the activity only asks them to repeat definitions.

### Estimate relevant prior knowledge and complexity

Check familiarity with:

- prerequisite concepts;
- the problem domain;
- the specific mechanism;
- the language, framework, or tool used in the example;
- the type of reasoning required by the task.

Use beginner, intermediate, senior, or similar labels only as clues. A senior frontend engineer may be new to distributed logs; a junior developer may already reason accurately about HTTP.

Increase scaffolding when several unfamiliar elements interact. Reduce it when learners can already explain prerequisite mechanisms and the objective requires comparison, diagnosis, or design.

## Choose only the lesson components that help

Available components include:

```text
Hook · Context · Prior Knowledge Activation · Problem · Prediction
Attempt · Observation · Failure · Question · Concept · Mechanism
Alternative · Trade-off · Demo · Self-Explanation · Practice
Retrieval · Transfer · Reflection
```

### Hook

Use a short situation or question when curiosity or motivation will help. Point toward the topic without prematurely naming the answer.

```text
Suppose one product remains in stock and 100 customers click Buy at the same time.
Who should receive it?
```

Skip the hook when a direct answer serves the objective better. “What does HTTP 404 mean?” does not need a manufactured crisis.

### Context

State only what affects the mechanism:

- what the system does;
- who or what interacts with it;
- the relevant current design;
- requirements and constraints.

```text
We have an E-commerce API built with NestJS and PostgreSQL.
The product has stock = 1, and concurrent checkout requests are allowed.
```

Do not add services, traffic scale, or business rules that do not affect the target concept.

### Prior knowledge activation

Briefly retrieve a prerequisite that the new idea will build on. For example, ask learners to trace a normal read/check/write sequence before introducing concurrency. Do not reteach prerequisites that the audience already controls.

### Problem

Use a real limitation, requirement, failure mode, or design pressure. State the undesirable behavior or missing property without assuming a technology.

### Prediction

Before revealing important behavior, show the relevant state and ask what the learner expects. Use prediction when competing mental models could produce different answers.

```text
Request A and Request B both read stock = 1.
What final state and business result do you predict after both updates?
```

After execution, compare `Prediction → Observation → Explanation`. Do not interrupt every trivial syntax step with a prediction question.

### Attempt

When useful, show or elicit a plausible approach. Establish why it appears correct before exposing its limitation.

```ts
const product = await prisma.product.findUnique({
  where: { id },
});

if (product.stock > 0) {
  await prisma.product.update({
    where: { id },
    data: { stock: product.stock - 1 },
  });
}
```

Do not include an attempt merely because a story template has that stage.

### Observation or failure

Make invisible behavior observable with a timeline, sequence, state transition, log, test, query result, or controlled experiment.

```text
Request A → READ stock = 1
Request B → READ stock = 1

Request A → UPDATE stock = 0
Request B → UPDATE stock = 0
```

The important failure is not merely the final value. Both requests passed a rule that only one should have passed. Do not use impossible scheduling, misleading scale, or failure behavior that the stated system could not produce.

### Question

Ask for the missing property before naming a concept when doing so helps learners connect need to mechanism.

```text
What property would ensure that only a valid stock transition succeeds,
even when requests overlap?
```

### Concept and mechanism

Give a compact operational definition, then explain:

1. what pressure or failure makes it useful;
2. how its state transitions or guarantees work;
3. which assumptions and boundaries it relies on;
4. when to consider it;
5. when a simpler option is enough.

Make the `Problem → Mechanism → Implementation` links visible. Avoid a long academic definition before the learner has a reason to care.

### Alternative and trade-off

When several mechanisms could provide the required property, compare only the dimensions that matter in this scenario. Ask:

```text
What did we gain?
What did we pay?
What new failure modes appeared?
```

### Demo, practice, retrieval, transfer, and reflection

Use the dedicated guidance below. These components convert an explanation into observable and durable learning; not every short answer needs all of them.

## Strategy playbooks

### Worked Example + Guidance Fading

Prefer this strategy when relevant prior knowledge is low, the procedure is unfamiliar, many steps interact, or mechanics and syntax are the immediate target.

```text
Model → Explain → Predict small steps → Completion → Modify → Solve
```

- Model a small complete example and narrate decisions, not every keystroke.
- Ask learners to predict selected outcomes and explain why a step is necessary.
- In a completion task, provide the structure while leaving a meaningful operation or decision unfinished.
- In modification, change a requirement or failure condition—not just variable names.
- Remove scaffolding only after learners can explain the mechanism they are applying.

For a developer new to NestJS Guards, first show the request flow and one minimal guard. Then let the learner complete a decision branch, modify the rule, and finally implement a guard for a new requirement. Do not begin by asking them to architect an authentication system.

### Guided Prediction

Prefer this strategy when the objective is conceptual and execution reveals the mental model.

```text
Show state → Predict → Execute → Observe → Explain → Apply
```

Good targets include the JavaScript event loop, promises, transaction isolation, cache behavior, query execution, and race conditions. After observing the result, require a causal explanation such as:

- Which state changed?
- Why did both requests observe the same value?
- Which execution order produced the result?
- Which invariant was violated?

### Guided Problem Solving

Prefer guided problem solving when learners know the component concepts but need help coordinating them in an unfamiliar task.

```text
Problem → Represent the state and goal → Plan one step → Attempt
→ Inspect evidence → Targeted feedback → Next decision → Reflect
```

Use questions, partial plans, checklists, or intermediate checkpoints rather than supplying the complete path. Reduce prompts as the learner demonstrates control. Guidance should advance the learner's reasoning, not convert the task into disguised copying.

### Productive Failure

Use productive failure only when learners possess enough prerequisites to generate plausible approaches and the attempt will improve later understanding or transfer.

```text
Problem → Generate plausible solution → Observe limitation
→ Compare approaches → Formal instruction → Apply improved model
```

Design the attempt around the target concept, time-box it, collect contrasting ideas, and connect those ideas explicitly to formal instruction. Provide prompts or partial representations when the search space is too large.

Do not use productive failure as shorthand for giving a novice a hard task, withholding support, and later displaying the answer. If the attempt does not contribute to comparison or formalization, use a worked example or guided investigation instead.

### Engineering Decision Reasoning

Use this strategy for architecture and system-design education.

```text
Problem → Requirements → Constraints → Required Properties
→ Candidate Mechanisms → Trade-offs → Decision → Consequences
```

Separate the layers:

```text
Problem
Lost update

Mechanism
Concurrency control

Required property
Only valid stock transitions may succeed

Candidate techniques
Atomic conditional write, optimistic locking, pessimistic locking,
serialized processing, or another mechanism that enforces the invariant

Technology
PostgreSQL, Redis, or another system only if its guarantees fit the constraints

Implementation
The exact query, client API, schema, configuration, and error handling
```

Use relevant decision dimensions such as consistency, availability, latency, throughput, contention, operational complexity, development complexity, observability, cost, recovery, deployment, and team capability. Select dimensions from the scenario rather than filling a generic matrix.

Finish with consequences, not a triumphant “solution.” State gains, costs, assumptions, and newly introduced failure modes.

### Diagnose → Explain → Repair

Use this strategy for debugging, incidents, unexpected behavior, and misconception correction.

```text
Observe symptom → Collect evidence → Form hypothesis → Trace mechanism
→ Identify cause → Repair → Explain why the repair works → Prevent recurrence
```

Do not jump from an error message directly to a fix. Show which evidence distinguishes competing causes. A repair is not learned until the learner can connect it to the violated invariant or failed assumption.

For a balance incremented twice after duplicate Kafka delivery, trace message identity, delivery attempts, consumer state changes, and the balance invariant before proposing an idempotency mechanism. Then explain why the chosen conditional write, unique record, or deduplication design prevents the duplicate effect and what failure window remains.

## Storytelling patterns

Storytelling is optional infrastructure. Use it when it improves causal understanding, motivation, retention, debugging intuition, or architecture reasoning.

### Problem → Solution → Result

Use when a demonstrated limitation creates a genuine need for a mechanism. This remains useful for many backend, database, algorithm, DevOps, and security lessons, but it is not their automatic default.

### Before → After → Bridge

Use for refactoring or architecture evolution:

```text
Before → Observed problems → Desired properties → Safe transition → After
```

The bridge should expose how the design evolves and which behavior must remain stable. Do not jump from poor code directly to a polished architecture.

### Three-Act Structure

Use for a larger lesson or workshop when an escalating narrative supports the objective:

1. **Setup:** Current system, users, requirements, and apparent success.
2. **Conflict:** Relevant limitations or new constraints.
3. **Resolution:** Mechanism, observed result, and remaining trade-offs.

### Classic causal sequence

Use any needed subset of:

```text
Hook → Context → Problem → Naive Attempt → Failure → Question
→ Concept → Solution → Demo → Practice → Reflect
```

Never fabricate a naive attempt or failure to fill a stage.

## Problem patterns and candidate mechanisms

Route from a problem to required properties before considering products or frameworks.

| Problem pattern | Required property | Candidate mechanisms |
| --- | --- | --- |
| Concurrent updates can violate an invariant | Only valid transitions succeed | Conditional atomic write, optimistic or pessimistic concurrency control, serialization |
| Several state changes must not become partially visible | Atomicity or explicit recovery | Local transaction, compensation, idempotent orchestration |
| Slow work blocks a request that need not wait | Decoupled completion or lower synchronous latency | Optimize the path, background job, queue, event-driven processing |
| Duplicate requests or deliveries repeat an effect | One logical operation changes state once | Idempotency key, unique constraint, conditional write, deduplication record |
| Multiple instances need ephemeral coordination | Cross-instance visibility and the required atomicity or expiry | Database, Redis, coordination service, message-based design |
| Query cost grows beyond its latency budget | Bounded or reduced work for the access pattern | Index, query redesign, precomputation, cache |
| A dependency failure propagates through callers | Isolation and bounded failure behavior | Timeout, bulkhead, circuit breaker, fallback, asynchronous decoupling |

These are candidate mechanisms, not equivalences. A requirement such as “need async” does not imply Kafka, and “need caching” does not imply Redis.

## Progressive Constraint Discovery

Teach architecture as a decision space rather than an upgrade ladder:

```text
Current Design → New Requirement / Constraint → Evaluate Current Design
→ Generate Alternatives → Compare Trade-offs
→ Choose a Change OR Keep Current Design → Observe Consequences
```

A new constraint does not automatically require a new technology. For example, if PostgreSQL already enforces a stock invariant with an atomic conditional update and traffic grows tenfold:

1. identify what actually changed—throughput, p99 latency, lock contention, database capacity, cost, or only a forecast;
2. measure whether the current design still meets correctness and service objectives;
3. keep it if it does;
4. otherwise compare mechanisms against source-of-truth, consistency, latency, operational, and recovery requirements;
5. treat Redis as one candidate only when its properties and new failure modes fit those requirements.

Do not turn transaction, optimistic locking, queueing, and Redis into successive maturity levels.

## Demo and cognitive-load design

Preserve the progression:

```text
Minimal → Working → Extend
```

- **Minimal:** Isolate one mechanism and remove irrelevant infrastructure.
- **Working:** Run the real state transition or behavior at the smallest useful scale.
- **Extend:** Add one constraint or production concern at a time when it supports the objective.

Make the mechanism observable by logging state transitions, identifiers, timestamps, request order, database rows, queue messages, before/after state, or controlled failures. A demo should prove behavior, not merely display syntax.

Delay retries, observability stacks, security, deployment, scaling, monitoring, and infrastructure until the learner has a stable core model. Introduce only production concerns that the objective requires.

Teaching implementations may be simpler than production architectures. Label intentional simplifications and state what production work remains; never simplify away the mechanism being taught.

For live coding, choose checkpoints where the instructor should:

1. run the smallest working path;
2. ask for a prediction;
3. trigger or inspect the important behavior;
4. pause for self-explanation or diagnosis;
5. let learners make the next decision.

## Practice, feedback, retrieval, and transfer

### Progressive autonomy

Use the existing progression and fade support deliberately:

#### Level 1 — Follow

Reproduce the demonstrated mechanism with enough scaffolding to focus on the new concept. Ask for at least one prediction or explanation so the task is not pure copying.

#### Level 2 — Modify

Change one meaningful input, requirement, failure condition, or component. The learner decides how the example must adapt.

#### Level 3 — Solve

Give a related problem without the solution path. Require selection and justification of an approach.

#### Level 4 — Design

When the objective and time support it, ask learners to design under explicit constraints, compare alternatives, and explain consequences.

Each level must introduce at least one new learner decision. Changing only names or literals is not progression.

### Self-explanation

Use prompts tied to the mechanism:

- What assumption failed?
- Which state changed?
- Why did both requests observe the same value?
- Which invariant was violated?
- Why does this operation prevent that failure?
- What would break if this step were removed?

### Feedback

Tie feedback to the objective and mechanism. Correct faulty causal reasoning, evidence collection, and engineering decisions—not only the final code or answer. During productive failure, delay direct correction long enough to compare attempts; during guidance fading, give the smallest prompt that lets the learner make the next decision.

### Retrieval

At selected checkpoints, ask learners to recall without looking back:

```text
1. What failure or design pressure made this concept useful?
2. What mechanism addresses it?
3. What assumption does that mechanism depend on?
4. When would you avoid it?
```

Use retrieval to reinforce important mental models, not to turn every section into a quiz.

### Transfer

Change at least one important constraint:

- Would this still work with ten application instances?
- What changes if the database is no longer the source of truth?
- What happens under high contention?
- Would this work across regions?
- What changes when duplicate delivery is possible?
- Which changed requirement would make the simpler design preferable again?

The learner has not demonstrated transfer merely by reproducing the original example.

## Select an output structure

Choose the smallest structure that produces the required evidence. Do not expose internal planning labels unless they help the user.

### Small explanation

```text
Context → Mechanism → Example → Check
```

### Conceptual lesson

```text
Context → Prediction → Observation → Mechanism
→ Self-Explanation → Practice → Retrieval
```

### Productive-failure lesson

```text
Problem → Attempt → Compare → Formalize → Apply → Transfer
```

### Architecture lesson

```text
Scenario → Requirements → Constraints → Required Properties
→ Alternatives → Trade-offs → Decision → Consequences
```

### Debugging lesson

```text
Symptom → Evidence → Hypothesis → Trace → Root Cause
→ Repair → Why It Works → Prevention
```

### Full lesson or workshop plan

Include only the applicable sections:

```markdown
# <Topic>

## Learning Objectives and Evidence
## Relevant Prerequisites
## Selected Lesson Sequence
## Demo or Investigation Checkpoints
## Guided and Independent Practice
## Feedback and Self-Explanation
## Retrieval and Transfer
## Trade-offs / Production Boundaries
## Durable Takeaways
```

Within `Selected Lesson Sequence`, use the components required by the chosen strategy. Do not automatically add Hook, First Attempt, or Failure headings.

## Review mode

Evaluate the existing material before rewriting it. Review at least:

1. learning objective clarity;
2. objective, activity, and evidence alignment;
3. technical correctness and volatile-detail verification;
4. causal reasoning;
5. fit to relevant prior knowledge;
6. cognitive load;
7. demo observability and scope;
8. practice progression and feedback;
9. self-explanation opportunities;
10. retrieval and transfer;
11. trade-off and consequence reasoning;
12. artificial storytelling;
13. technology bias.

When useful, report findings as:

```text
Strength
Problem
Why it matters
Recommended minimal change
```

Optional diagnostic summaries may use categories such as Technical Accuracy, Learning Alignment, Causal Clarity, Audience Fit, Cognitive Load, Practice Quality, Transfer, and Engineering Reasoning. Treat scores as navigation aids, not scientifically precise measurements.

## Revise mode

1. Preserve the original objective when it is valid.
2. Preserve technically correct, effective sections and the author's useful voice.
3. Fix only weaknesses established by review or the user's request.
4. Avoid stylistic rewrites that do not improve learning or correctness.
5. Explain structural changes when they change the instructional strategy or evidence of learning.

Do not transform every lesson into one V2 sequence. V2 supplies decisions and components, not a mandatory surface format.

## Example behavior

### Dependency Injection in NestJS

For a learner who knows classes but is new to NestJS dependency injection, begin with a small worked example and the substitution problem:

```text
UserService creates PrismaClient and EmailService itself.
Production works, but a unit test must replace the real database and email sender.
How can those dependencies be substituted without editing UserService?
```

Develop the causal chain without claiming one historical origin:

```text
Tight coupling → Dependency substitution pressure → Abstraction
→ Dependency Injection → NestJS container implementation
```

Show the request or construction flow, explain the container mechanism, then fade guidance from completing a provider declaration to designing a substitutable dependency for a new case. Verify current NestJS APIs before presenting version-specific code.

### Race condition

Use guided prediction. Show two requests reading the same stock value, ask for the predicted business outcome, run or trace the interleaving, and make the violated invariant visible. Require the learner to explain why the interleaving occurs and why a selected concurrency-control mechanism changes the result. Finish by changing contention, process count, or source-of-truth assumptions.

### Kafka

First determine whether the objective is to explain Kafka's log/partition/consumer mechanism, implement a current client API, or decide whether Kafka fits a system. For a decision lesson, start with requirements rather than Kafka:

```text
Current request path → Required completion semantics → Ordering / durability needs
→ Candidate background job, queue, log-based broker, or direct call
→ Trade-offs → Decision
```

If Kafka is selected or is itself the topic, explain records, partitions, offsets, consumer groups, ordering boundaries, and delivery behavior at the level required by the objective. Do not claim Kafka is universally better than RabbitMQ or another transport. Verify client APIs and configuration only when implementation details are included.

### Duplicate Kafka effect

Use the debugging route:

```text
Balance changed twice → Inspect message identity and delivery attempts
→ Trace consumer state transition → Identify violated one-effect invariant
→ Select an idempotency mechanism → Explain its failure window and recovery
```

Do not reduce the lesson to “use an idempotency key.”

## Final teaching test

The finished material should let learners do the stated objective and answer, at the appropriate level:

- What problem, constraint, failure mode, or pressure makes this concept useful?
- What mechanism changes the behavior?
- What assumption or invariant matters?
- Why does the demo provide evidence rather than merely show syntax?
- When would a simpler alternative be enough?
- How does the decision change when an important constraint changes?

If learners can only repeat a definition or copy the example, strengthen alignment, mechanism explanation, practice decisions, retrieval, or transfer rather than automatically adding more story.
