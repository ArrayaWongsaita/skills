# Full Lesson Blueprint

Read this reference when designing a complete lesson, tutorial, workshop, live-coding session, or hands-on lab. Use it as a decision guide rather than a requirement to make every lesson long.

## Stage playbook

### 1. Hook

Open with a short, recognizable situation or question that points directly at the topic without naming the answer.

```text
Suppose one product remains in stock and 100 customers click Buy at the same time.
Who should receive it?
```

A useful hook is short, easy to understand, relevant, curiosity-producing, and unresolved. Avoid an opening such as “Redis is an in-memory data store...” when the problem can create the need first.

### 2. Context

State only what the learner needs:

- what the system does;
- who uses it;
- the current architecture;
- the requirement and relevant constraints.

Example:

```text
We have an E-commerce API built with NestJS and PostgreSQL.
The product has stock = 1, and concurrent checkout requests are allowed.
```

Do not add services, traffic scale, or business rules that do not affect the concept.

### 3. Problem

Choose a failure or limitation directly related to the concept. Common mappings include:

| Concept | Problem that can motivate it |
| --- | --- |
| Transaction | Partial failure or concurrent update |
| Redis | Shared/distributed state, caching, or an atomic operation |
| Kafka | Synchronous coupling, asynchronous processing, or event distribution |
| Dependency Injection | Tight coupling and difficult substitution in tests |
| Clean Architecture | Business logic coupled to a framework or infrastructure |
| Database Index | A query that becomes slow as data grows |
| Queue | Slow work blocking a synchronous request |
| Docker | Environment inconsistency |
| Retry | A temporary network or dependency failure |
| Idempotency | Duplicate delivery or repeated requests |
| Optimistic Locking | Lost updates under concurrency |
| Circuit Breaker | Cascading failure from an unhealthy dependency |

Treat this table as routing guidance, not a mandate. Verify that the selected problem fits the actual system and learning objective.

### 4. Naive Attempt

Show the first implementation a learner might reasonably believe is correct. Do not label it wrong before establishing its appeal.

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

Explain why this seems sensible: it reads the current state, checks the rule, and then updates the state.

### 5. Failure

Make the limitation observable. Prefer a timeline, sequence, diagram, request flow, state transition, code execution order, test, or log when it makes causality clearer.

```text
Request A → READ stock = 1
Request B → READ stock = 1

Request A → UPDATE stock = 0
Request B → UPDATE stock = 0
```

Then ask what the final state hides: both requests passed the rule even though only one item existed.

Do not use impossible scheduling, misleading scale, or a dependency failure that the stated design could not produce.

### 6. Question before concept

Ask for the property the missing solution needs:

```text
What kind of operation would prevent another request from intervening
between checking stock and decrementing it?
```

Or:

```text
If Email Service is unavailable, why must Order Service fail too?
```

Pause before revealing the term when teaching interactively. The goal is for the learner to desire the concept before receiving its name.

### 7. Introduce the concept

Explain in this order when practical:

#### What

Give a compact operational definition.

#### Why

Connect it to the demonstrated failure.

#### How

Explain its mechanism, boundaries, and important state transitions.

#### When to use

Name the signals, requirements, or failure modes that should make a developer consider it.

#### When not to use

Name simpler sufficient options and contexts where its cost exceeds its benefit.

Avoid a long academic definition before the learner understands the motivation.

### 8. Solution

Apply the concept to the original scenario. Make the changed property visible.

```text
Before                      After

READ                        Atomic conditional operation
CHECK              →                 ↓
UPDATE                       Only one request succeeds
```

Explicitly state what the concept fixes, what it leaves unchanged, and any new operational concern it introduces.

### 9. Demo

Use:

```text
Minimal → Working → Extend
```

For Kafka, for example:

```text
Level 1

Producer → Kafka → Consumer
```

Only after that model works, extend it:

```text
Order Service
     ↓
 OrderCreated
     ↓
   Kafka
  ↙   ↓   ↘
Email Stock Invoice
```

Keep the first code sample small. Add error handling, retries, observability, scaling, security, and deployment concerns in later increments when they support the objective.

### 10. Practice

Use progressive autonomy:

#### Level 1 — Follow

Reproduce the demonstrated mechanism with enough scaffolding to focus on the new concept.

#### Level 2 — Modify

Change one requirement, input, failure condition, or component so learners must adapt the example.

#### Level 3 — Solve

Give a related problem without the solution path. Require learners to choose and justify an approach.

#### Level 4 — Design

For a longer or advanced lesson, ask learners to design a solution under explicit constraints and compare alternatives.

Do not mistake code copying for practice. Each level should require at least one new decision.

### 11. Reflect

Test transfer and mental models rather than definition recall. Examples:

- How does Kafka change the coupling compared with a direct REST call?
- If no concurrent requests exist, is locking still necessary?
- Did Redis solve this because it is fast, or because the selected operation is atomic?
- If a Kafka consumer fails after receiving an event, which concern appears next?
- Which changed requirement would make the simpler solution preferable again?

## Framework selection

### Problem → Solution → Result

Use as the default for backend, database, algorithm, architecture, DevOps, and security concepts. Establish the failure, teach the mechanism that addresses it, and show the measurable or observable result.

### Before → After → Bridge

Use for Clean Architecture, DDD, refactoring, modular architecture, and testing strategy.

```text
Before
  ↓
Problems
  ↓
Desired architecture
  ↓
Bridge: safe transition steps
  ↓
After
```

Do not jump directly from poor code to a polished final architecture. The bridge is where learners see how the design can evolve safely.

### Three-Act Structure

Use for a larger lesson or multi-part workshop:

1. **Setup:** Current system, users, requirements, and apparent success.
2. **Conflict:** Failures, limitations, and increasingly important constraints.
3. **Resolution:** Concept, implementation, observed result, and remaining trade-offs.

### Progressive Failure

Use for advanced topics whose main lesson is evolution under constraints:

```text
Direct database update
      ↓
Race Condition
      ↓
Transaction
      ↓
High contention
      ↓
Optimistic Locking
      ↓
Retry pressure
      ↓
Queue
      ↓
Latency
      ↓
Redis atomic operation
      ↓
Consistency question
```

Choose only the stages required by the learning objective. The point is to expose trade-offs, not to imply that every system should progress through this exact technology chain.

## Audience calibration

### Beginner

- Use one unfamiliar concept at a time.
- Prefer minimal code and visible flows.
- Use an analogy only when it maps cleanly to the technical model; say where it stops mapping if needed.
- Define technical terms before relying on them.

### Intermediate

- Use realistic scenarios and code paths.
- Let learners diagnose the failure before revealing the fix.
- Include implementation choices, common mistakes, and trade-offs.

### Advanced

- Focus on concurrency, consistency, scalability, performance, architecture, and distributed failure modes as applicable.
- Quantify constraints when possible.
- Compare operational and organizational costs, not only code complexity.
- Prefer the precise system model over a decorative analogy.

## Default full-lesson output

Use this structure when the user asks for a lesson and does not specify another format. Adapt headings to the topic and omit only sections that genuinely do not apply.

```markdown
# <Topic>

## Learning Objectives

After the lesson, learners can...

## Prerequisites

What learners should already know.

## Hook

An opening question or situation.

## Context

The relevant system and requirements.

## Problem

The concrete problem to solve.

## First Attempt

The plausible simple approach.

## What Goes Wrong?

The demonstrated failure and its cause.

## Think About It

Questions learners consider before the concept is revealed.

## Concept

### What

### Why

### How

### When to Use

### When Not to Use

## Solution

Apply the concept to the original problem.

## Demo

Small code, diagram, or flow; then extend if useful.

## Hands-on Lab

### Level 1 — Follow

### Level 2 — Modify

### Level 3 — Solve

## Common Mistakes

Mistakes that reveal a broken mental model.

## Trade-offs

Benefits, costs, alternatives, and context-dependent choices.

## Reflection Questions

Questions that test transfer and reasoning.

## Key Takeaways

Three to five durable mental models.
```

Add `Level 4 — Design` after Level 3 only when the audience and available time support an open-ended architecture exercise. When planning live coding, also identify checkpoints where the instructor should run the code, ask for a prediction, inject the failure, pause for diagnosis, and let learners modify the system.

## Example behavior

### Dependency Injection in NestJS

Do not begin with “Dependency Injection is a design pattern...” Begin with a class that constructs its own dependencies:

```text
UserService creates PrismaClient and EmailService itself.
Production works, but a unit test must replace the real database and email sender.
How can those dependencies be substituted without editing UserService?
```

Then develop the causal chain:

```text
Tight Coupling
      ↓
Dependency substitution problem
      ↓
Abstraction
      ↓
Dependency Injection
      ↓
NestJS DI Container
```

### Kafka

Begin with a synchronous request path:

```text
POST /orders
      ↓
Create Order
      ↓
Update Stock
      ↓
Send Email
      ↓
Create Invoice
      ↓
Send Notification
```

Ask:

- If Email Service takes five seconds, must the Order API wait?
- If Email Service is unavailable, why must creating the order fail?

Then develop:

```text
Synchronous Coupling
      ↓
Event
      ↓
Kafka
      ↓
Producer / Broker / Consumer
```

Do not imply Kafka is the only asynchronous option. Compare a simpler background job, direct queue, or other event transport when those alternatives plausibly meet the requirements.

## Final teaching test

The finished lesson should enable the learner to answer:

> What kind of problem should make me think of this concept?

If the learner can only repeat what the technology is or copy its syntax, revise the hook, failure, questions, practice, or reflection until the causal mental model is explicit.
