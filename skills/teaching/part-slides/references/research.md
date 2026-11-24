# Researching one Part

Read this after the interview, before you plan any slide.

Research serves the learner's questions. It is not a survey of the field: you look up only what this Part needs, and you stop when you can fill in the format below for every topic.

## What to find, per topic

A **topic** is one thing the learner must be able to tell apart and explain: a method, a concept in a chain (data, model, training), a step. A Part has 3 to 5 topics, and never more than 6; more than that is two Parts, so say so. Choose and order topics by the learner's starting point: the first topic is the one they can reach from what they already know, and each topic uses only earlier ones.

For each topic find:
- its **parts**: the separable pieces the learner must tell apart (the arguments of a call, the stages of a process). A topic with no real parts has none, and gets no `parts` slides. Never invent parts to fill a slot.
- a **definition in beginner words**: one sentence with no term the learner does not know yet.
- one **analogy**, and where it stops being true.
- one **worked example**, small enough for one slide. For code, the program, which you will run in the build step.
- the **mistakes beginners really make**, only the real ones.
- the **sources** you read.

## How to research

- Use a search tool when you have one, then read the best pages (official documentation, standards, a respected textbook or reference). Use two sources that agree for any definition.
- Without a search tool, read pages you know the address of. Without any web access, use what you know and mark every such fact `unverified`.
- About ten searches and page reads for a Part is enough. If you need many more, the subject is too big for one Part: say so.
- Do not copy the sources' voice. You will explain it yourself, to this learner, in their words.

## The research file

`<work>/research.md`, at most one page per topic:

```
# Research: <Part title>

## <topic>
- Parts: <name> (what it is), <name> (what it is)
- In beginner words: …
- Analogy: … (it stops being true when …)
- Example: … (code: the program and the output you expect, to be run later)
- Beginner mistakes: …
- Sources: <url>, <url>
- Unverified: <facts you could not check, or "none">
```

Every number, name and claim that appears on a slide must be in this file.

## What I understood

Before any planning, tell the user in a few lines (their language, at most about 12 lines) what you understood:
- the topics in the order you propose, each with its parts in a few words,
- where the learner starts and the one thing the Part ends on,
- what you are unsure of (`Unverified`), and what you left out on purpose.

End by asking what is wrong or missing. Apply their corrections to `research.md`. The user often knows little about the subject, so it is normal that they react to this summary more than they create it: show a concrete proposal, not a menu.
