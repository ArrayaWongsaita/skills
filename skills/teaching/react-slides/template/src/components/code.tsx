// Placeholder until the code components land: plain blocks with no copy buttons.
import type { Block, Listing, Range } from './types';

export function CodeBlock({ listing, lines }: { listing: Listing; lines: Range[]; highlight: Range[]; language: string }) {
  const rows = listing.code.split('\n');
  return <pre className="rs-codeblock">{lines.map(([first, last]) => rows.slice(first - 1, last).join('\n')).join('\n')}</pre>;
}

export function OutputBlock({ block }: { block: Block; language: string }) {
  return <pre className="rs-output">{block.text}</pre>;
}

export function BlockList({ blocks }: { blocks: Block[]; language: string }) {
  return (
    <>
      {blocks.map((block, index) => (
        <pre key={index} className="rs-block">
          {block.text}
        </pre>
      ))}
    </>
  );
}
