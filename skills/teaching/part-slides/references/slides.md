# Writing the slides of a Part

Read this when the plan is approved, before you write the Part's files.

A Part is written as typed React, directly, in the course's app (`<web>` is `<course_dir>/web`). The slides are the single source: a change to a slide is an edit to one element of one file. Write what the plan says, no more, and keep the slide ids and the order of the plan.

## The files

- `<web>/src/parts/part-NN.tsx`: the slides, as direct children of `<Deck>`, each with its `id`.
- `<web>/src/parts/part-NN.data.ts`: `meta`, and the code the slides show (`listings`) with its real output (`outputs`).
- `<web>/src/visuals/part-NN.tsx`: the Part's own drawings, one exported component each. Create the folder when you need it.

`scaffold.py` made the first two with an Opening cover. Replace the cover's text and add the slides. Import everything a slide needs from `'../components'`.

```tsx
import { B, Cover, Deck, Explain, Steps, Topic } from '../components';
import { Strip } from '../visuals/part-01';
import { listings, meta, outputs } from './part-01.data';

export default function Part01() {
  return (
    <Deck meta={meta} diagrams={{}} listings={listings} outputs={outputs}>
      <Cover id="1-001" section="Opening" title={<>…</>} body={<>…</>} />
      <Topic id="1-002" section="Topic name" title={<>Topic name</>} body={<>one-line tagline</>} />
      <Explain id="1-003" section="Topic name" phase="know" title={<>…</>} body={<>… <B>key word</B> …</>} visual={<Strip highlight={1} />} />
    </Deck>
  );
}
```

Every slide has `id` (`<part>-<nnn>`, in order), `section` (`"Opening"`, `"Closing"`, or the topic's name: it is shown in the top line and is how the check page groups slides) and, inside a topic, `phase` (`know`, `parts`, `example`, `watchout`, `check`: it becomes the kicker, with `n/m` when the phase has several slides). Text is JSX: `<>…</>`, with `<B>` for bold, `<I>`, `<C>` for inline code and `<A href>`; use `<P>`, `<Ul>`, `<Ol>`, `<Li>` for blocks. After adding or removing slides run `scaffold.py <course_dir> --sync-count N`, which keeps `meta.slideCount` equal to the number of slides: the check page waits for that many.

## The layouts

Required props are first; optional ones are marked `?`. `visual` takes a figure, your own drawing or any node.

| Layout | Props | Use |
|---|---|---|
| `Cover` | `title`, `body?`, `visual?` | the Part's first slide |
| `Topic` | `title`, `body?`, `visual?` | a topic's divider: the name large, an optional tagline, nothing else |
| `Focus` | `title`, `body`, `visual?` | one point or a hook |
| `Explain` | `title`, `body`, `visual?` | the default explanation |
| `Steps` | `title`, `items` (2–6), `visual?` | a process or a list of parts |
| `Compare` | `title`, `left`, `right`, `takeaway`, `leftBlocks?`, `rightBlocks?` | two things side by side |
| `Anatomy` | `title`, `pieces`, `items` (2–6), `body?`, `notice?` | a call or a formula in numbered pieces |
| `Example` | `title`, `body`, `snippet`, `lines?`, `highlight?`, `notice?` | code with its output |
| `Code` | `title`, `body`, `snippet`, `lines?`, `highlight?`, `notice?` | code alone |
| `Output` | `title`, `body`, `snippet`, `notice?` | an output alone |
| `Error` | `title`, `cause`, `fix`, `symptom?`, `blocks?`, `visual?` | a mistake, its cause and its fix; with a `visual` it is a two-column slide, so leave the code for the next slide |
| `Question`, `Answer` | `question`, `body`, `items?` · `answer`, `why`, `revisit` | the optional review |
| `Summary` | `title`, `items`, `visual?` | the Closing's summary |
| `Sources` | `title`, `items` (`<A href>` links) | the last slide |
| `Objectives` | `title`, `items`, `visual?` | what the learner will be able to do |

Also in the template and not used by this flow: `Setup`, `Terms`, `Practice`, `MapSlide`, `Assemble` (they belong to the old course pipeline), and `Field`, the wrapper the layouts use for their text.

`Anatomy`: `pieces` is the line cut into `{ text, n? }`: the pieces joined must equal the line exactly, and a piece with `n` has its number on the line and in the legend `items[n-1]`. Pieces without `n` are plain text between them.

## Pictures

A picture earns its place: it shows the thing, it does not decorate. Choose in this order:

1. **A figure,** when the idea has one of these shapes (they take plain labels and draw themselves): `Flow` (steps in order), `Pipeline` (stages with a note each), `Nested` (a set inside a set), `Cells` (a row of values with positions and pointers), `Bars` (a few numbers compared), `Network` (layers of nodes), `Cycle` (a loop). `highlight` marks the one element the slide is about.
2. **Your own drawing,** in `src/visuals/part-NN.tsx`, from the sketch primitives `SketchRect`, `SketchEllipse`, `SketchLine`, `SketchPath`, `SketchArrow` (each takes a fixed `seedKey`, `stroke`, and optionally `strokeWidth`, `fill`, `fillStyle`, `dashed`), plain `<text>` and `<g>`, with `roleColour('primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'neutral')` for colours.
3. **An image file** the user supplies, in `src/assets/images/part-NN/<name>.png`, shown by a node you write.

Rules for a drawing:
- `<svg viewBox="0 0 460 330">` (or similar) with the class name `rs-figure`, so it scales to the picture column; keep 12 units clear at every edge.
- Text at `fontSize` 16 or more. No two labels closer than the width of the longer one. A label names a thing; it does not explain.
- A box has one label in its centre. A second line inside the same box goes at least 1.6 × `fontSize` below the first (Thai marks need that room), and the first line moves up to make room: never put a second label on the box's centre. The check page reports labels of one drawing that sit on top of each other as a `text-overlap` problem.
- Give the drawing the props the slides need (`highlight`, `current`), so one drawing serves several slides: the same picture for the same concept, with the part under discussion highlighted, is what keeps a learner oriented.
- The same concept has the same colour all through the Part (and the course: see `course-notes.md`).
- Draw nothing you have not looked at: you will take a screenshot of every distinct drawing in the check step.
- No faces, hands, realistic objects or logos: a sketch gets them wrong. Use a labelled shape instead.

## Code

A topic with code shows the real program and its real output.
1. Write the program in `part-NN.data.ts`: `listings.<name> = { lang: 'python', status: 'verified', reason: '', code: '…' }`.
2. **Run it** with the real interpreter (Bash). Put exactly what it printed in `outputs.<name> = { lang: 'text', info: 'text', text: '…' }`.
3. When you cannot run it, set `status: 'unverified'`, give a `reason`, mark the output `info: 'text illustrative'` and put a `notice` on the slide that says so. Tell the user.
4. `<Example snippet="name" highlight={[[2, 3]]} …/>` shows the lines; `lines` picks an excerpt (whole listing by default). The one copy button copies exactly what the slide shows.
5. **Highlight only the one place the learner must look at** (a line or two). When most of the lines matter, highlight none: a highlight on everything points at nothing. The check page reports a highlight on more than half of the shown lines.

## Writing the text

- Write in the learner's language, in short sentences, as you would explain it to the person across the table. No source voice ("X states that…"), no names of institutions or papers, no term the learner has not met.
- One new idea per slide, at most 160 characters of text in Thai (220 elsewhere). When it will not fit, make two slides: do not shrink the text.
- A title says what the slide is about in the learner's words ("Why a list has a first position 0"), not a label ("Indexing").
- The `parts` slide of a component says what it is, what it does here, and shows it in the picture or the code line.
- Facts come from `research.md`. When you need one that is not there, research it first and add it.
