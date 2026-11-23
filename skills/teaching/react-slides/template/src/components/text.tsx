// The inline and block text components that generated slides use for Markdown inside a field.
import type { ReactNode } from 'react';

type Children = { children?: ReactNode };

export const C = ({ children }: Children) => <code className="rs-code-inline">{children}</code>;
export const A = ({ href, children }: Children & { href: string }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);
export const B = ({ children }: Children) => <strong>{children}</strong>;
export const I = ({ children }: Children) => <em>{children}</em>;
export const P = ({ children }: Children) => <p>{children}</p>;
export const Ol = ({ children }: Children) => <ol>{children}</ol>;
export const Ul = ({ children }: Children) => <ul>{children}</ul>;
export const Li = ({ children }: Children) => <li>{children}</li>;
