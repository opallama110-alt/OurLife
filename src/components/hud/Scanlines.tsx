import { ReactNode } from 'react';

export interface ScanlinesProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps children with a faint CRT scanline overlay rendered via the
 * `.scanlines::after` pseudo-element from index.css. The container is
 * positioned relative with `overflow: hidden` (provided by the class) so
 * the overlay clips cleanly to the wrapper's bounds.
 */
export default function Scanlines({ children, className = '' }: ScanlinesProps) {
  return <div className={`scanlines ${className}`.trim()}>{children}</div>;
}
