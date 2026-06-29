import clsx from 'clsx';
import { MouseEventHandler, ReactNode } from 'react';
import { ChevronIcon } from './DeckIcons';

// One row inside the settings popover: [icon] label .......... [value chip | chevron]
// `active` lights the value chip in clay to signal an engaged/on state.
export default function SettingRow({
  icon,
  label,
  value,
  active = false,
  onClick,
  title,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  active?: boolean;
  onClick?: MouseEventHandler;
  title?: string;
}) {
  const content = (
    <>
      <span className="setting-ico">{icon}</span>
      <span className="setting-label">{label}</span>
      {value !== undefined ? (
        <span className={clsx('setting-val', active && 'setting-val-on')}>{value}</span>
      ) : (
        <span className="setting-chev">
          <ChevronIcon />
        </span>
      )}
    </>
  );

  return onClick ? (
    <button type="button" className="setting-row" onClick={onClick} title={title}>
      {content}
    </button>
  ) : (
    <div className="setting-row setting-row-static" title={title}>
      {content}
    </div>
  );
}
