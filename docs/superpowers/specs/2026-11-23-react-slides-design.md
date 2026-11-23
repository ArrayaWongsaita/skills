# Design: `react-slides` skill

- Date: 2026-11-23
- Status: Draft
- Location of the skill: `skills/teaching/react-slides/`
- Input contract: `slide-design/deck@1` and `slide-design/vocabulary@1` (`skills/teaching/slide-design/references/deck-template.md`)
- The look was chosen from browser mockups during the brainstorm. They are not committed; §5.4 describes the result in words.

## 1. Intent

This is the third skill in the chain `course-research` → `slide-design` → `react-slides`. It turns the deck that `slide-design` wrote for one Part into slides in a React web app. The user deploys that app themselves and sends the link to learners, who read the slides on their own, without narration.

### What the user decided in the brainstorm

- **Who reads it:** learners open a link and read on their own. The user deploys the app. The skill never deploys.
- **Home page:** one card per Part. A card opens that Part's slides.
- **TSX:** a script generates one readable `part-NN.tsx` per Part from a fixed, typed component library (approach A, §4). The user may edit a generated file by hand, for example to add an animation to one slide.
- **Look:** minimal, white, hand-drawn lines, like the sketch-style slides the user showed as reference. The font is **Mali**.
- **Animation:** a diagram builds up across its build-step slides. The new elements are drawn in stroke by stroke, and the elements already shown stay where they are.
- **Copying code:** a code slide copies either the lines it shows or the whole program.
- **Illustrations:** the agent draws them as hand-drawn SVG, with no image-generation API. Screenshots are captured by the agent in a browser when the page is public.

### What success looks like

- A learner opens the link on a phone or a laptop, picks a Part on the home page, and reads every slide comfortably. Diagrams grow step by step, and copied code runs.
- Every slide's text, code and output is exactly what the deck says.
- The user can tweak one slide's TSX, re-run the skill after the deck changes, and keep the tweak (the skill refuses to overwrite it and says so).
- Every Part looks like the others.

## 2. Goals, non-goals, anti-goals

### Goals

- One web app per course, at `courses/<slug>/web/`, built up one Part per run.
- Every `deck@1` layout, field, visual kind and code block is rendered.
- Diagrams are drawn from the deck's data, with build-step animation.
- Code slides show syntax highlighting, the deck's highlight ranges and the real line numbers, and offer two copy buttons.
- Slides are readable on phones.
- A learner can resume reading where they left off.
- Hand edits survive re-runs, and template improvements still reach unedited files.
- `npm run build` gives a static `dist/` that works on any static host, at any path.

### Non-goals

- Deploying, hosting, analytics, logins, comments.
- Writing or changing slide content, and reading the Part file.
- Narration, audio, video, PDF export, presenter mode, a dark theme.
- Google Slides. That would be a separate skill on the same contract.
- Raster images from an image-generation API.

### Anti-goals (failure even if everything "runs")

- Slide text, code or output that differs from the deck, even by one character.
- Build steps merged into one slide, or elements that move between steps.
- Hand-drawn shapes that wobble between slides, so the same node looks different on every step.
- A hand edit silently overwritten.
- Text that overflows its slide on a phone or a desktop, and nobody notices.
- Parts that each look different because the agent improvised layouts.
- A site that works only at the domain root, or needs server rewrite rules.
- Any request to a third-party server when a learner opens the site, such as fonts from Google or a CDN script.

## 3. Constraints

- **Repo conventions** (from `AGENTS.md`):
  - stdlib Python 3.11+ scripts
  - pytest tests
  - `evals/acceptance.md`
  - a `## Reporting problems with this skill` section
  - the frontmatter `name` equals the folder name
- **Node.js:** the user needs Node.js and npm to build the app. The template pins its dependencies with a lockfile.
- **The deck contract is binding,** including its list of what the downstream skill must not do: read the Part, re-theme roles inconsistently, merge or reorder build steps, change text, code or output.
- **What the skill reads:**
  - the deck
  - the vocabulary
  - on the first run only, the `title` in the frontmatter of `00-overview.md`, for the course title. Nothing else from that file.
  - The skill hashes the Part file to see whether the deck is stale, but never parses its content.
- **Licences:** fonts are bundled from OFL packages, and every runtime dependency has a permissive licence.
- **Text handling:**
  - Thai has no spaces between words, so line breaking relies on the browser's Thai dictionary breaking. Never use `word-break: break-all` on prose.
  - Long unbroken tokens, such as URLs and identifiers, may wrap anywhere.
- **Harnesses vary:**
  - The visual check and screenshot capture need a browser tool. Without one, the skill skips them and says so in its report.
  - Without a subagent tool, the coordinator does every role inline.

## 4. Approaches considered

**How the deck becomes TSX:**

| | Approach | Trade-off | Outcome |
|---|---|---|---|
| A | A script generates one readable TSX file per Part that uses a fixed, typed component library | TypeScript checks every slide's fields against its layout at build time. The file is readable and editable, and text comes from the deck verbatim. A re-run must not destroy hand edits, which §5.8 handles. | **Picked** by the user |
| B | The script writes JSON, and TSX components render it | Safest to regenerate, but the slides are not TSX, and one slide is hard to customise | Rejected |
| C | The agent writes free TSX for every slide | The most creative per slide, but Parts drift apart in style, it costs more, it is hard to test, and the text can drift from the deck | Rejected |

**Where illustrations come from:**

| | Approach | Outcome |
|---|---|---|
| 1 | An image-generation API, using the deck's `prompt` | Rejected: needs a key and costs money, and raster art clashes with the sketch style |
| 2 | The agent draws a hand-drawn SVG component | **Picked.** It is free and matches the diagrams. A mockup showed the quality is enough for simple scenes. A scene it cannot draw well falls back (§5.7). |

## 5. The design (decided)

### 5.1 Inputs and outputs

**Inputs,** under `courses/<slug>/`:
- `slides/visual-vocabulary.md`
- `slides/part-NN-<slug>.md`
- `00-overview.md`, for its `title` only, on the first run

**Output:** `courses/<slug>/web/`, a Vite + React + TypeScript app:

```
web/
├── package.json, package-lock.json, vite.config.ts, tsconfig.json, index.html, .gitignore
├── .react-slides.json               ← manifest: template version, and each skill-written file with its SHA-256 (§5.8)
├── src/
│   ├── course.ts                    ← course title; written once, then owned by the user
│   ├── components/ …                ← the template: layouts, Diagram, Sketch primitives, CodeBlock, Home, navigation, check page
│   ├── theme/ …                     ← fonts, the role palette, base CSS
│   ├── vocabulary.ts                ← generated from visual-vocabulary.md
│   ├── parts/index.ts               ← generated: the list of Parts that have slides
│   ├── parts/part-NN.tsx            ← generated: the slides of Part NN
│   ├── parts/part-NN.data.ts        ← generated: that Part's diagram definitions and code listings
│   ├── illustrations/part-NN/<visual key>.tsx   ← drawn by the agent
│   └── assets/images/part-NN/<visual key>.png   ← screenshots, or images the user adds
└── _work/part-NN/                   ← run notes, visuals.json and skill-problems.md; git-ignored, never bundled
```

**Asset discovery:**
- Illustrations and images are found at build time with `import.meta.glob`.
- Adding a file and rebuilding is enough: no registry to edit.
- A slide whose file is missing shows its fallback.

**Visual keys** (my call, from the builder check):
- **Why not slide ids:** `slide-design` renumbers every slide each time it assembles a deck. A file named after a slide id would land on the wrong slide after a split upstream.
- **How a file is named instead:**
  - The key is the first 8 hex digits of the SHA-256 of the visual's content: an illustration's `description`, or a screenshot's `url` and `capture`, joined by a newline.
  - Renumbering changes nothing.
  - A changed description gets a new key, so its illustration is drawn again.
  - Two slides with the same illustration share one file.
- **What `visuals.json` records** for each slide id: its key, kind, content and file path.
- **Images the user adds:** the report names the exact file name for each one.
- **Unused files:** files whose key no longer matches any visual of the Part are listed as unused in the report. They are never deleted.

### 5.2 The run

The user names the course and the Part. The skill stops only for decisions that are the user's:
- overwriting a file they edited
- a deck it cannot read

**The steps:**

0. **Check the inputs:**
   - The deck's `template` must be `slide-design/deck@1`, and the vocabulary's must be `slide-design/vocabulary@1`. Refuse anything else, and name what was found.
   - `node` and `npm` must be on `PATH`.
   - If the deck's `source_sha256` no longer matches the Part file, warn that the deck is stale and suggest redoing it with `slide-design`. Then continue: the deck is still valid on its own.
1. **Scaffold or upgrade:**
   - **First run:** copy the template into `web/`, write `src/course.ts` with the overview's title, and run `npm install`.
   - **Later runs:** apply template upgrades under the manifest rules (§5.8), and run `npm install` when `package.json` changed.
2. **Convert:** `build_part.py <course_dir> <N>` does the following:
   - It parses the deck and checks what rendering needs: known layouts, the required fields per layout, that every referenced diagram, element and snippet exists, and that each code excerpt equals the listed lines of its snippet.
   - It writes `part-NN.tsx`, `part-NN.data.ts`, `vocabulary.ts` and `parts/index.ts`, under the manifest rules.
   - It writes `_work/part-NN/visuals.json`, the illustrations and screenshots to produce.
   - A deck that fails these checks is refused with every error listed, and the user is pointed to `slide-design`'s validator.
3. **Illustrations:** one illustrator subagent per Part draws every illustration listed in `visuals.json`, following `references/illustrator.md` (§5.7). The coordinator checks each one on the check page and allows one redo.
4. **Screenshots:** with a browser tool, the coordinator captures each screenshot that needs no login (§5.7). Every other one keeps its fallback.
5. **Build and check:**
   1. `npm run build` must pass. It runs `tsc --noEmit` and the Vite build.
   2. Serve the build with `npm run preview`.
   3. Open the check page for the Part (§5.9) and read its findings.
   4. Take screenshots of every slide with a finding, and one slide of each layout.
   5. Fix what can be fixed in the illustrations, then rebuild.

   Text overflow that the template's auto-fit cannot absorb is a template defect: it goes in the report and in `skill-problems.md`. The slide text is never changed to make it fit.
6. **Report,** briefly, in the user's language:
   - the app path
   - `npm run dev` to view it locally
   - `npm run build` to get `dist/` for deployment
   - illustrations drawn and fallen back, with their prompts
   - screenshots captured and fallen back
   - files skipped because the user edited them
   - remaining check findings
   - the skill-problems offer

**No state machine:**
- Each step can be repeated safely.
- On resume, the manifest, `visuals.json` and the files present say what is done.

### 5.3 The generated TSX

Each slide is one component element whose props are named after the contract's fields:

```tsx
// Generated by react-slides from slides/part-01-<slug>.md (deck sha256 …).
// You may edit this file. Once it differs from what the skill wrote, the skill will not overwrite it.
import { Deck, Explain, Code, Question, Answer, C } from '../components';
import { diagrams, listings } from './part-01.data';

export default function Part01() {
  return (
    <Deck part={1} title="เริ่มต้นกับ agent" language="th" diagrams={diagrams} listings={listings}>
      <Explain
        id="1-015"
        title={<><C>create_agent</C> ต่อ tool เข้ากับ model</>}
        body={<><C>create_agent</C> รับโมเดลและรายการ tool เมื่อโมเดลตัดสินใจว่าต้องใช้ tool ก็จะส่ง tool call ออกไป</>}
        visual={{ kind: 'diagram', diagram: 'd-agent-loop', show: ['n-user', 'n-model', 'e-ask'], new: ['e-ask'], highlight: [], dim: [] }}
      />
      <Code id="1-017" title={<>ขั้นที่ 1: ประกาศ tool</>} body={<>ใส่ <C>@tool</C> บนฟังก์ชันธรรมดาให้กลายเป็น tool</>}
        snippet="1.2-a" lines={[[5, 8]]} highlight={[[5, 5]]} />
    </Deck>
  );
}
```

**Rules:**
- **One component per layout:** `Cover`, `Focus`, `Explain`, `Steps`, `Compare`, `Code`, `Output`, `Error`, `Objectives`, `Setup`, `Terms`, `Question`, `Answer`, `Practice`, `Summary`, `Sources`.
- **Props:**
  - The props are typed so that the contract's required fields are required and its optional fields are optional.
  - Lists such as Items are arrays.
  - Each slide carries its deck `id`.
- **Text:**
  - Text is JSX.
  - Inline code becomes `<C>…</C>`.
  - Any character that JSX would read, such as `{`, `}`, `<`, `>` or `&`, is emitted as a string expression.
  - Rendering a slide gives exactly the deck's text.
- **Markdown inside a field** (my call, from the builder check). Decks already contain more than inline code, such as links in `sources` items. The converter renders a fixed set:
  - **Inline:** code, `[text](url)` links, bare URLs, `**bold**` and `*italic*`
  - **Structure:**
    - Paragraphs, split at a blank line.
    - Line breaks kept as written. A newline never becomes a space, because a space changes Thai text.
    - `1. ` and `- ` lists.

  Anything else is shown as literal text, and the converter warns about it.
- **"Verbatim" means:** the visible text of a rendered field equals the deck's field text with that markup removed, where a link becomes its text. The tests compare against an independent implementation of that rule.
- **Code:**
  - Code and output live in `part-NN.data.ts` as JSON-escaped strings, keyed by snippet id.
  - A `Code` slide derives its excerpt from `lines`, so the code exists once.
  - Gaps between shown ranges render as a `⋯` row.
- **Metadata:** `purpose`, `from` and `sources` are kept as props:
  - `sources` renders as the slide's links.
  - `purpose` and `from` are not shown. They are kept so a later edit still knows each slide's intent.

### 5.4 Look and feel

Chosen from the mockups:
- **Page:**
  - White background, dark ink (about `#2b2b2b`), generous whitespace, no decoration that carries no meaning.
  - On a desktop, a slide sits on a 16:9 stage.
  - The title is at the top left, the body below it, and the visual in the remaining space.
  - A small grey bar at the bottom centre reads `‹ 15 / 42 ›`.
  - A small grey line at the top names the Part and the section.
- **Fonts:** Mali for all text, in Thai and Latin. JetBrains Mono for code. Both are bundled from `@fontsource` packages.
- **Hand-drawn lines:**
  - Shapes, edges, card frames and illustrations are drawn with rough.js.
  - Each element's seed is derived from its id, so a node looks identical on every slide it appears on.
- **Colour:**
  - Colour comes from the stroke, with an optional light hachure fill.
  - `src/theme/roles.ts` maps each vocabulary role to a soft palette that suits the sketch style, such as `primary` to blue `#4a86c5` and `danger` to rose `#d9607a`. The vocabulary's hex values are only suggestions (my call).
  - One role is one colour across every Part. The user may edit the palette.
- **Diagrams:**
  - Every vocabulary shape is a sketch: `box`, `rounded-box`, `circle`, `cylinder`, `document`, `person`, `cloud`.
  - Groups are framed in a soft rounded rectangle with their label.
  - Badges are numbered circles, and notes are plain handwritten text.
  - Node positions come from the grid in the deck.
  - A vocabulary `icon` is drawn from a stroke icon set when the name is known. Otherwise no icon is drawn, and the label carries the meaning.
- **Animation:**
  - A diagram's `new` elements are drawn in stroke by stroke (about 0.7 s), and their labels fade in after them.
  - `highlight` elements get a stronger stroke, and `dim` elements fade to about 35 %. Everything else stays still.
  - Going back to an earlier slide shows its state with no animation.
  - Slides change with a short fade (200 ms or less) and never slide sideways.
  - An illustration draws itself in the first time its slide is shown.
  - `prefers-reduced-motion` turns every animation off.
- **Home:**
  - the course title, with a short line under it
  - one card per Part, with a hand-drawn frame, "Part N", the title, the slide count and the reading progress
  - a blue progress line once the Part has been started
  - Parts without a deck are not shown
- **Interface text:** button labels and similar text follow the deck's `language`. The template ships Thai and English, and other languages fall back to English.

### 5.5 Navigation, URLs, progress, phones

- **Hash routes:**
  - `#/` is the home page.
  - `#/part-01` resumes the Part at the furthest slide read, or starts it.
  - `#/part-01/1-015` opens one slide.
  - The Vite `base` is `./`, so `dist/` works at any path on any static host.
- **Moving between slides:** ← and →, Space, PageUp and PageDown, swiping on touch screens, and the ‹ › buttons.
- **Answer slides:** a slide with `revisit` links back to that slide.
- **Sources:** links open in a new tab.
- **Progress:**
  - The browser's `localStorage` keeps the last slide read and the furthest slide read, per Part.
  - The storage keys include the course slug.
  - Every read and write is wrapped in `try/catch`, so the site works when storage is blocked.
  - Nothing leaves the browser.
- **Desktop:** a slide fills a 16:9 stage.
  - Prose fields auto-fit (§5.9).
  - A code, output, setup, error or `compare` block taller than its space scrolls inside its own box, with a visible cue (my call). Code is never shrunk. The contract limits prose, not code, so a long excerpt is legitimate.
- **Phones:**
  - Below a breakpoint, a slide is a page that scrolls vertically, not a scaled-down 16:9 picture (my call).
  - Its content stacks at a readable size.
  - The ‹ › bar stays fixed at the bottom.
  - Slides change only with a horizontal swipe or the buttons. A vertical scroll never changes the slide.
  - Diagrams and illustrations scale to the width. Code blocks scroll sideways and never wrap.
- **Accessibility:**
  - illustrations: `role="img"` with the deck's `alt`
  - diagrams: a text description from their labels
  - focus is visible
  - contrast meets WCAG AA for text

### 5.6 Code, output and copying

- **Code blocks:**
  - Syntax highlighting runs offline, with no CDN, for the languages the deck's snippets use. An unknown language renders as plain text.
  - Line numbers are the snippet's real ones.
  - The `highlight` ranges are marked like a highlighter pen.
- **Copy buttons on a `code` slide:**
  - **Copy these lines:** the shown lines, joined in order
  - **Copy the full program:** the whole listing from `## Code listings`
  - Both confirm with a short "copied ✓". If the clipboard is unavailable, they say so.
- **Other blocks:** `setup` and `error` blocks get a single copy button. `output` blocks show the expected output in a terminal-like box with no copy button.
- **Unverified snippets:** a snippet whose status is not `verified` shows the slide's `Notice` next to the code.

### 5.7 Illustrations and screenshots

**Illustrations:**
- `src/illustrations/part-NN/<visual key>.tsx` (§5.1) default-exports a component built only from the template's `Sketch` primitives: shapes, paths, lines, arrows and short text. The components use a fixed viewBox and the role palette.
- `references/illustrator.md` is the brief:
  - Draw the deck's `description`, using its `prompt` for detail.
  - Compose the scene from simple shapes.
  - Avoid scenes that rely on faces, emotion or fine detail.
  - Use short labels at most.
  - Keep seeds fixed.
- An illustration the illustrator judges it cannot draw well is skipped, so the slide shows the deck's `fallback`. The report lists it with its `prompt`, so the user can add an image later.
- An image placed at `src/assets/images/part-NN/<visual key>.png` (or `.jpg` or `.webp`) takes precedence over the drawn component.

**Screenshots:**
- With a browser tool, the coordinator opens the `url` and follows `capture` when the page is public and needs no login, no account and no personal data. It saves the image to `src/assets/images/part-NN/<visual key>.png`.
- It never types credentials and never signs in.
- Anything else keeps its fallback and goes in the report.

### 5.8 Hand edits and template upgrades

`web/.react-slides.json` records:
- the template version
- the SHA-256 of every file the skill wrote, whether template files or generated ones

**Writing a file:**
- **Absent:** the skill writes it.
- **Present, with the hash the manifest records:** the skill overwrites it, because the user has not edited it.
- **Present, with a different hash:** the user edited it. The skill skips it and lists it in the report.
- `--force <path>` overwrites one skipped file once the user agrees. The report says what the new version would change.

**Ownership:**
- `src/course.ts` and the user's own files are never tracked or overwritten.
- `src/theme/roles.ts` is a template file, so an edit to the palette is kept like any other edit.
- `part-NN.tsx` and `part-NN.data.ts` are a pair. If either one is edited, both are skipped, so the code shown never drifts from the deck.

**Template upgrades:** when the skill's template has a newer version, unedited template files are replaced, and edited ones are listed so the user can merge by hand.

**Other Parts during an upgrade** (my call, from the builder check):
- **The component API is additive within a template major version:** a component may gain optional props, but props are never renamed, removed or made required. A minor upgrade therefore never breaks the Parts generated before it, and every Part gets the improved components at once.
- **One Part per run:** a run converts only the Part it was asked for.
- **Older generated files:**
  - The manifest records the generator version of each generated file.
  - When other Parts' unedited files come from an older generator, the report says so and offers `build_part.py <course_dir> --all`. That command regenerates every Part that has a deck, from its current deck, and only its unedited files.
- **A breaking template major version:**
  - It runs `--all` for the unedited files.
  - It lists the edited files that may no longer compile.
- **When `npm run build` fails:** the run stops and reports the failing file and the error. An edited file that no longer compiles is the user's to fix by hand, or to replace with `--force`.

### 5.9 The check page

`#/check/part-NN` renders every slide of a Part in its final build state, in two frames: 1280 × 720 and 390 × 844.

**What it reports:**
- **Prose overflow:**
  - At 1280 × 720, prose that does not fit its slide after auto-fit.
  - At 390 × 844, prose that overflows sideways. A long phone page is fine, since phone slides scroll.
  - Content blocks that scroll inside their box are listed as notes, not as overflow.
- diagram elements outside the canvas
- missing fonts (`document.fonts.check`)
- slides that show a fallback
- console errors

**How it reports:**
- a table, for a person
- `window.__reactSlidesCheck`, for the agent to read through its browser tool

**Auto-fit:**
- The template's layouts are sized for the contract's length limits.
- Auto-fit may shrink a slide's text to 85 % at most before the check page reports an overflow.

The route ships in the build. It is harmless, and it is not linked from the site.

### 5.10 Skill files

```
skills/teaching/react-slides/
├── SKILL.md                    ← the coordinator's procedure (§5.2) and the reporting hook
├── references/
│   ├── components.md           ← the component API per layout, for the agent and for hand edits
│   ├── illustrator.md          ← the illustrator brief, including its `Skill problem:` line
│   └── visual-check.md         ← running and reading the check page, and what may be fixed
├── scripts/                    ← stdlib Python
│   ├── frontmatter.py          ← copied verbatim, as in the other skills
│   ├── deck_reader.py          ← parses deck@1 and vocabulary@1 into plain data
│   ├── tsx_writer.py           ← emits the TSX and data files, and escapes text
│   ├── manifest.py             ← the rules of §5.8
│   └── build_part.py           ← CLI: scaffold, upgrade, convert, list visuals
├── template/                   ← the React app copied into web/, with its own tests
├── tests/                      ← pytest, with a fixture course that uses every layout
└── evals/acceptance.md
```

The problems file is `<course_dir>/web/_work/part-NN/skill-problems.md`.

## 6. Left to the builder

- The versions of React, Vite, TypeScript, rough.js, the syntax highlighter and the icon set, and the minimum Node version, within the licence and offline constraints.
- Exact palette values, spacing, font sizes and the phone breakpoint, within §5.4 and §5.5.
- The internal structure of `template/src/components/`.
- The details of the generated TSX (§5.3), as long as TypeScript enforces the required fields and the rendered text is verbatim.
- How the check page measures overflow.
- How the template's own tests run: for example `vitest` with `npm test`, plus a pytest test that builds the fixture course. The test that builds the fixture course needs `npm` and network access for `npm install`, so it is skipped when `npm` is missing.
- Whether `deck_reader.py` copies `slide-design`'s parsing code or reimplements it. Either way, the skill installs and runs without `slide-design` present.

## 7. Acceptance checks for the first build

**Automated:**
1. **Every layout converts:** a fixture deck containing every layout, every visual kind, a split code excerpt, an illustrative output and an unverified snippet converts to TSX that type-checks.
2. **Text is verbatim:** for every slide of the fixture, rendering it gives exactly the deck's field text under the rule in §5.3. The fixture includes Thai with tone marks, emoji, `{ } < > &`, backticks, quotes, links, bold text, a line break, a list inside a field, and an unsupported construct that is shown as literal text.
3. **Bad decks are refused:** a deck with a non-`deck@1` template, an unknown layout, a missing required field, a dangling diagram, element or snippet id, or an excerpt that differs from its snippet is refused, and every error is named.
4. **The manifest holds:**
   - An edited generated file is skipped and reported, and an unedited one is overwritten.
   - `--force` overwrites.
   - `course.ts` is never touched.
   - A template upgrade replaces only unedited files.
5. **Parts are independent:** converting Part 2 leaves Part 1's files unchanged and adds Part 2's card. `--all` regenerates only unedited files.
5a. **Visual keys:** after the deck is renumbered, every illustration and image stays on the slide whose content it shows. A changed description asks for a new drawing, and the old file is reported as unused, not deleted.
6. **Diagram states:**
   - Hidden elements are not rendered.
   - `new` elements are drawn in, `highlight` and `dim` elements are styled, and nothing animates under reduced motion.
   - An element's path data is identical on every slide it appears on.
7. **Copying:** "Copy these lines" gives exactly the shown lines, and "Copy the full program" gives the listing.
8. **Routes and progress:** hash routes open the right slide, and progress survives a reload. Blocked storage breaks nothing.
9. **The build is portable:** `npm run build` passes on the fixture course, and `dist/` works when served from a sub-path.

**Manual:**

10. **A real run:**
    1. Run the skill on a real `slide-design` deck.
    2. The user reads the Part on a laptop and a phone.
    3. They judge whether the look matches the mockups and whether the diagrams build up clearly.
    4. The check page reports no prose overflow.
11. **A real deployment:** the user deploys `dist/` to a static host and opens the link on a phone.
