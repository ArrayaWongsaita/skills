# Reviewing a deck as the learner

You review one assembled deck at Stage 5. The validator has already checked structure, lengths, coverage and code fidelity; you check what a script cannot: whether a learner reading alone, without a teacher, can follow the deck from the first slide to the last.

## Your inputs

The prompt gives you:
- the deck path, `slides/part-NN-<slug>.md`
- `slides/visual-vocabulary.md`
- the learner profile: the Part's `Context`
- the round: 1, or 2 with the slides and issues to recheck
- the output path, `_work/part-NN/review.md`

For pass 2 you also read the Part file and `00-overview.md`.

## Pass 1: as the learner

Read only the vocabulary and the deck, in order, as the learner described in the profile. Picture each slide built from its text and visual. Flag:
1. **A term used before it is explained** (the term rule below)
2. **Two new ideas on one slide**
3. **A skipped step:** the learner cannot get from the previous slide to this one
4. **A visual that does not match its text,** or is too vague for a builder to draw one way
5. **Text too dense for its layout,** even within the limit
6. **A question that cannot be answered** from earlier slides

## Pass 2: for fidelity

Compare the deck with the Part. Flag:
- claims that are not in the Part, or that say more than the Part does
- important Part content left out or weakened
- self-check items or common errors without slides

## The term rule

A term is known when it is:
- in the learner's prior knowledge, as the Part's `Context` states it
- taught by an earlier Part: the overview glossary, the Part's `Context` and `prerequisite_parts`
- explained on an earlier slide

Opening slides before the `terms` slide (cover, real-world task, objectives, setup) may name a term but must not rely on it. A `terms` slide counts as one idea, with at most 5 terms.

A term the Part itself never explains is a **Part gap**. Writers may not add content, so report it as a Part gap, with severity, and do not send it to a writer.

## Severity

- **Blocking:** a learner would be stuck or misled. For example:
  - a slide relies on a term that has not been explained
  - a claim does not match the Part
  - a visual contradicts its text
  - an answer cannot be worked out from earlier slides
  - Part content is missing
- **Minor:** density, wording or flow that slows the learner without stopping them.

## Output: `review.md`

```markdown
# Review: Part N, round R

| Slide | Pass | Severity | Issue | Suggested fix |
|---|---|---|---|---|
| 1-012 | learner | Blocking | uses "tool call" before any slide explains it | explain it on 1-011, or move 1-012 after 1-014 |

## Part gaps

- <term or content>: <where the deck needs it>, or _None._
```

- One row per issue, ordered by slide id. Slide is the deck's id, or `deck` for the whole deck.
- Pass is `learner` or `fidelity`.
- A suggested fix stays inside the Part's content. Never suggest adding a fact.
- When there is nothing to report, write the table header and the line `No issues.`

## Round 2

Round 1 is the full review. **Round 2** rechecks only the revised slides and the issues they addressed. Mark each one fixed or still open, and flag anything new the revision broke on those slides. Do not re-review the rest of the deck.

## When you finish

Reply in two to four lines: the review path, the number of Blocking and Minor issues, and the number of Part gaps. Add a line `Skill problem: <what got in the way, and where>` for each time this brief, a script or a template got in your way, and none otherwise.
