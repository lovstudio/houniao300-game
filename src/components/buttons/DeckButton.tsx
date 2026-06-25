import clsx from 'clsx';
import { MouseEventHandler, ReactNode } from 'react';

// A slim, warm control-deck button for the festival masthead.
// `active` lights it up in clay to signal an engaged/on state.
export default function DeckButton({
  icon,
  children,
  onClick,
  title,
  active = false,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick?: MouseEventHandler;
  title?: string;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'deck-btn',
        active ? 'deck-btn-on' : 'deck-btn-off',
        className,
      )}
    >
      {icon && <span className="deck-ico">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
