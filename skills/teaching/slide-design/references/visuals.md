# Choosing and drawing visuals

Read this at Stage 1 when you plan the deck's visuals, and as a writer when you set a slide's visual. The learner reads the deck alone, so the visual carries half the explanation. It has to be precise enough that a builder in Google Slides or React draws exactly one thing.

## Which kind

Prefer them in this order:

1. **`diagram`:** for anything with parts and relations: a flow, a loop, a structure, data passing between functions. This is the default. A diagram can be built up over several slides, which is how the learner sees one new piece at a time.
2. **`illustration`:** only where a diagram cannot carry the idea, typically the Part's analogy or the opening hook. It must be generated, so it costs the user a step.
3. **`screenshot`:** only for a real interface the learner must use, typically a setup step such as creating an API key. Screenshots go stale, so use them rarely.

`code`, `output` and `error` slides use their own content as the visual; they take no `visual` block.

At the gate, say for every illustration and screenshot why a diagram is not enough.

## Why a fixed grid, not Mermaid

Mermaid lays diagrams out automatically, so adding one box moves the others, and elements jump between build steps. The deck's diagrams are tool-neutral JSON on a fixed grid instead: every element keeps its place on every slide, and both Google Slides (shapes and connectors) and React (SVG) draw the same picture from the same numbers.

## Laying out a diagram

- Pick a `canvas` of `[columns, rows]`, at most 24 × 14. Twelve columns by four to six rows suits most slides.
- Place every node with `at` `[column, row]` and `size` `[width, height]`. Leave at least one empty column between nodes that an edge joins, so the arrow and its label have room.
- Read left to right, top to bottom, in the order things happen.
- Nodes never overlap; touching is allowed.
- Labels are at most 24 characters. Use the words of the slide text, so the learner can match them.
- Use the same diagram, unchanged, everywhere the same idea returns: the core mental model in the opening, in a sub-topic and in the summary.

## Build steps

A **build step** is a slide that shows elements the previous slide on that diagram did not. List exactly those in `new`: the builder draws them emphasised.
- Add one idea per step: a node and the edge to it, or a group around existing nodes.
- A slide that adds nothing has an empty `new`. It may use `highlight` to point at elements already shown, for example to walk through a finished diagram part by part, or to point back from an answer.
- Use `dim` to fade what the slide is not about.
- `new`, `highlight` and `dim` are subsets of `show` and never overlap.
- **Closure:** when an edge is shown, both its ends are shown. When a badge or note is shown, the element it sits near is shown. When a group is shown, all its members are shown.
- A `steps` slide shows numbered badges 1…n, one per numbered item, near the element each item describes.

## Shapes and colours

A node's `concept` comes from the vocabulary, and the concept fixes its shape and colour role. Shapes every target can draw:

| Shape | Use it for |
|---|---|
| `box` | a component, a function, a tool |
| `rounded-box` | a model or another active decision-maker |
| `circle` | a start, an end, or a single event |
| `cylinder` | storage: a database, a vector store, memory |
| `document` | data passed around: a message, a value, a state |
| `person` | a user or another human actor |
| `cloud` | an external service or API |

Colour roles come from the vocabulary's `## Colour roles` (by default `primary`, `secondary`, `accent`, `success`, `warning`, `danger`, `neutral`). The builder may change the hex values but keeps one role per concept across every deck. When a Part needs a concept the vocabulary lacks, add it to `new-concepts.json`; never change an existing one.

## Illustrations

- `description`: what the picture shows, in the slide language.
- `prompt`: an English image-generation prompt. Describe the scene concretely, with no text in the image. End it with the vocabulary's illustration style sentence, exactly, so every picture in the course looks alike.
- `alt`: alt text in the slide language.
- `fallback`: what the builder uses when no image is generated. Prefer a diagram state, which needs no `new`; otherwise `{"kind": "text", "text": "…"}`.

## Screenshots

- `url`: the page, from the Part's sources.
- `capture`: which screen, in what state, and what to highlight, precisely enough for the user to take it.
- `fallback`: `{"kind": "text", "text": "1. … 2. …"}` with the same steps as numbered text.

Every illustration and screenshot is listed in the deck notes under `### Visuals to produce`.
