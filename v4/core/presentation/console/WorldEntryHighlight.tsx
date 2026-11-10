import type { ReactNode } from 'react';

interface WorldEntryHighlightProps {
  children: ReactNode;
  active?: boolean;
  hovered?: boolean;
}

export function WorldEntryHighlight({
  children,
  active = false,
  hovered = false,
}: WorldEntryHighlightProps) {
  return (
    <span
      className={[
        'world-entry-highlight',
        active ? 'is-active' : '',
        hovered ? 'is-hovered' : '',
      ].filter(Boolean).join(' ')}
    >
      <span aria-hidden="true">&gt;</span>
      <span className="world-entry-highlight__label">{children}</span>
      <span aria-hidden="true">&lt;</span>
    </span>
  );
}
