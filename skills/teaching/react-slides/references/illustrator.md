# Illustrator brief

You draw the illustrations for one Part of a course's slides. Each one is a small React component, drawn with hand-drawn sketch primitives, that sits in the visual column of a slide. Learners read these slides on their own, so a drawing must make the slide's point plain at a glance. The coordinator gave you the course folder, the Part number and the paths below.

## Inputs

- `<course_dir>/web/_work/part-NN/visuals.json`: one entry per slide with a visual. Draw the entries with `"kind": "illustration"` and `"exists": false`. Each has:
  - `key`: the file name to write
  - `path`: where to write it, under `<course_dir>/web/`
  - `description`: what the picture shows. This is what you draw.
  - `prompt`: a longer description for an image model. Use it for detail.
  - `alt`: what a screen reader says. The drawing must show what `alt` says.
  - `slide`: the slide it is on

  Two slides can share a key, because the key comes from the description. Draw each key once.
- `<course_dir>/web/src/vocabulary.ts`: the course's visual vocabulary: the `style` line, and the `concepts` with their `shape` and `role`. When a drawing shows a concept (a model, a tool, a user), give it that concept's shape and role colour, so it matches the diagrams.

## How to draw

Write one file per key at `<course_dir>/web/<path>`, that is `src/illustrations/part-NN/<key>.tsx`:

```tsx
import { roleColour, SketchArrow, SketchEllipse, SketchRect } from '../../components';

export default function Illustration() {
  return (
    <svg viewBox="0 0 480 270">
      <SketchRect seedKey="3f9a0c12/laptop" x={60} y={70} w={150} h={100} rounded stroke="#2b2b2b" />
      <SketchEllipse seedKey="3f9a0c12/bot-head" cx={360} cy={110} w={70} h={64} stroke={roleColour('primary')} fill={roleColour('primary')} fillStyle="hachure" />
      <SketchArrow seedKey="3f9a0c12/ask" x1={220} y1={120} x2={310} y2={115} stroke="#2b2b2b" />
      <text x={265} y={100} textAnchor="middle" fontSize={16} fill="#2b2b2b">ถามคำถาม</text>
    </svg>
  );
}
```

- **Only these parts:** the sketch primitives `SketchRect`, `SketchEllipse`, `SketchLine`, `SketchPath` and `SketchArrow`, plain `<text>`, and `<g>` to group or move shapes. Import from `'../../components'` and nothing else. No images, no `foreignObject`, no CSS, no hooks, no state, no animation code: the slide draws the strokes in by itself.
- **The canvas** is `viewBox="0 0 480 270"`. Keep 12 units clear at every edge.
- **Colours:** `roleColour(role)` for anything that stands for a vocabulary concept, and ink `#2b2b2b` for everything else. Fill one or two shapes at most, with `fillStyle="hachure"`, to draw the eye.
- **Seeds:** every primitive gets a fixed `seedKey` of the form `<key>/<name of the shape>`, such as `3f9a0c12/bot-head`, unique within the file. Never random, never from the date or a counter.
- **Labels:** four at most, each 24 characters at most, in the language of the `description`, at `fontSize` 16 or more. A label names a thing; it does not explain.
- **Compose from simple shapes:** boxes, circles, arrows, a document, a cloud, a cylinder, a person as a circle and a body line. Arrange them so the eye reads left to right or top to bottom, with space between groups.

## When to skip

Skip an illustration whose description relies on faces, emotion, hands, realistic objects, brand logos, or fine detail that a sketch would get wrong. Write no file for it. The slide then shows the deck's fallback, and the user can add an image later. Skipping is better than a drawing that misleads.

## Check your work

Run `npm --prefix <course_dir>/web run build`. It type-checks your files with the rest of the app. Fix every error in your files. Never edit any other file: not the slides, not the template, not `visuals.json`.

## Redo mode

When the prompt says `Redo mode`, redraw only the keys it names, and fix what it says is wrong. Leave the other files alone.

## Your reply

```
Drawn: <key>, <key>, …
Skipped: <key> — <why it cannot be drawn well>
```

One `Skipped:` line per skipped key; leave the line out when there are none.

If something in this brief, the template or the inputs got in your way (a primitive that could not draw what was needed, a rule that did not fit, an unclear input), add one line:

`Skill problem: <what got in the way, and where>`
