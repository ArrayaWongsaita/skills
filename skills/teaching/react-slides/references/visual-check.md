# The visual check

The check page lays out every slide of a Part twice, in a 1280 × 720 frame and a 390 × 844 phone frame, measures each one and lists what it found. You read it through your browser tool; a person reads the same findings in a table at the top of the page. This page says how to run it, what each finding means, and what you may fix.

## Run it

1. `npm --prefix <course_dir>/web run build`. It must pass.
2. `npm --prefix <course_dir>/web run preview`, in the background. It serves the build at `http://localhost:4173/`; when that port is busy it prints the one it used.
3. Open `http://localhost:4173/#/check/part-NN` and run this in the page until `done` is true (it takes a second or two after the fonts load):

   ```js
   () => window.__reactSlidesCheck
   ```

   It returns `{ part, done, findings, measurements }`. Each finding is `{ slide, frame, kind, level, detail }`: `frame` is `desktop`, `phone`, `both`, or empty for page-wide findings, and `level` is `problem` or `note`.
4. Look at the slides yourself: every slide with a finding, and one slide of each layout. Open `http://localhost:4173/#/part-NN/<slide id>` with the window at 1280 × 800, and at 390 × 844 for a phone finding, and take a screenshot. Check that the text is legible, the diagram labels do not sit on top of each other, and each illustration shows what its slide says.

The check page is in every build but linked from nowhere.

## What each finding means

| Kind | Level | Means | What to do |
|---|---|---|---|
| `prose-overflow` (desktop) | problem | The slide's content is still bigger than the 16:9 frame with the text shrunk to 85 %. | A template defect. Never shorten the text. Record it in `skill-problems.md` with the slide id and the detail, and list it in the report. |
| `prose-overflow` (phone) | problem | Something is wider than the phone screen. | Find the element in a screenshot. When it is an illustration, fix the illustration. Otherwise it is a template defect: record it as above. |
| `scrolling-block` | note | A code or output block is taller than its box, so it scrolls with a fade at the bottom. | Nothing: this is how long code is shown. |
| `out-of-canvas` | problem | A diagram in the deck puts a node outside its canvas. | A deck problem. List it in the report, and point the user to `slide-design`. |
| `fallback` | problem | The slide shows its fallback: the illustration was skipped or failed to draw, or the screenshot was not captured. | Expected for skipped illustrations and screenshots: list them in the report. When a drawn illustration falls back, it failed: read the `console-error` finding and send it back to the illustrator. |
| `font-missing` | problem | Mali or JetBrains Mono did not load. | Check that `npm install` ran in `<web>` and that the build passed. If it persists, record it as a template defect. |
| `console-error` | problem | An error was logged while the page ran. | When it names an illustration file, send that illustration back to the illustrator. Otherwise record it as a template defect. |

## What you may change

- **Illustration files and images:** yes. A redraw goes through the illustrator in redo mode, with what is wrong.
- **Template files** (`src/components/`, `src/theme/`, the check page): never in the course's copy. A template defect is fixed in the skill, so record a `skill-problems.md` line and list it in the report. An edit in the course's copy would also be skipped from every later upgrade.
- **Slide text, code and output:** never. They are the deck's, and the deck is `slide-design`'s.
- **The generated Part files:** never. They come from the deck.

## One redo round

After the first check, send every illustration that needs a redo to the illustrator at once. Then build, check and look again, once. What is still wrong after that goes in the report, with the slide id and the finding.
