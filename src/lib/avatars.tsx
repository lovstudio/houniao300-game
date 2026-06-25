import clsx from 'clsx';

// 预置头像：候鸟沙城风格的鸟形剪影 + 不同沙色底，纯内联 SVG（无依赖、无 emoji）。
export const AVATAR_PRESETS: { id: string; bg: string; bird: string }[] = [
  { id: 'p1', bg: '#E4A672', bird: '#3F2832' },
  { id: 'p2', bg: '#B86F50', bird: '#EAD4AA' },
  { id: 'p3', bg: '#5C8A6B', bird: '#EAD4AA' },
  { id: 'p4', bg: '#3E7CB1', bird: '#EAD4AA' },
  { id: 'p5', bg: '#C24E6B', bird: '#EAD4AA' },
  { id: 'p6', bg: '#C99A3A', bird: '#3F2832' },
];

export const DEFAULT_PRESET = 'p1';

function PresetBird({ id }: { id: string }) {
  const preset = AVATAR_PRESETS.find((p) => p.id === id) ?? AVATAR_PRESETS[0];
  return (
    <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden>
      <rect width="32" height="32" fill={preset.bg} />
      {/* 候鸟剪影 */}
      <path
        d="M5 19 Q11 10 16 17 Q21 10 27 19"
        stroke={preset.bird}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="16" cy="23" r="2.2" fill={preset.bird} />
    </svg>
  );
}

// 统一头像组件：有生成图 -> 显示图；否则按预置渲染。
export function Avatar({
  url,
  preset,
  size = 'md',
  className,
}: {
  url?: string | null;
  preset?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeCls = size === 'lg' ? 'h-20 w-20' : size === 'sm' ? 'h-9 w-9' : 'h-12 w-12';
  return (
    <span
      className={clsx(
        'inline-block shrink-0 overflow-hidden rounded-full border-2 border-brown-700 bg-brown-800',
        sizeCls,
        className,
      )}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <PresetBird id={preset ?? DEFAULT_PRESET} />
      )}
    </span>
  );
}
