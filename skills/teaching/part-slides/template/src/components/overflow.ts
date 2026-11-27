// How much of a code or output box is out of sight. Pure, so the rule is tested without a browser.

/** One row of a code or output box, in px relative to the box's visible area. `line` is null for a `⋯` gap marker or an output line. */
export type RowGeometry = { line: number | null; bottom: number; right: number; chars: number; highlighted: boolean };
/**
 * `scrollWidth` and `longestLine` (in characters) stand in for the rows when a box has none: an output, or a block with one `<code>`.
 * `textLeft` is where the code text starts, after the padding and the line numbers.
 */
export type BoxGeometry = {
  width: number; height: number; scrollHeight: number; scrollWidth: number; longestLine: number; lineHeight: number; charWidth: number; textLeft: number;
  rows: RowGeometry[];
};
export type BoxOverflow = { hiddenRows: number; hiddenHighlight: number[]; wideLines: { line: number | null; chars: number }[]; fits: number };

/** One pixel of slack, since layout sizes round. */
const SLACK = 1;
/** A box that scrolls fades out below this share of its height (the mask in theme/base.css): a row that ends in the fade cannot be read. */
export const FADE_FROM = 0.85;

export function boxOverflow(box: BoxGeometry): BoxOverflow {
  const scrolls = box.scrollHeight > box.height + SLACK;
  const clear = scrolls ? box.height * FADE_FROM : box.height;
  const hidden = box.rows.filter((row) => row.bottom > clear + SLACK);
  const hiddenRows = box.rows.length > 0 ? hidden.length : scrolls ? Math.max(1, Math.ceil((box.scrollHeight - clear - SLACK) / box.lineHeight)) : 0;
  return {
    hiddenRows,
    hiddenHighlight: hidden.filter((row) => row.highlighted && row.line !== null).map((row) => row.line as number),
    wideLines:
      box.rows.length > 0
        ? box.rows.filter((row) => row.right > box.width + SLACK).map((row) => ({ line: row.line, chars: row.chars }))
        : box.scrollWidth > box.width + SLACK ? [{ line: null, chars: box.longestLine }] : [],
    fits: box.charWidth > 0 ? Math.floor((box.width - box.textLeft) / box.charWidth) : 0,
  };
}
