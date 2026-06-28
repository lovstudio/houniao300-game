import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  BIRD_RESTAURANT_INTERIOR,
  type InteriorCircle,
  type InteriorRect,
  type VenueInteriorMap as VenueInteriorMapData,
} from '../../data/birdRestaurantInterior';
import { characters } from '../../data/characters';

type Props = {
  interior?: VenueInteriorMapData;
  // 内场里行走的角色（与外部地图同一套立绘）；缺省回退到第一个角色。
  characterName?: string;
  onOpenPhotoMemory?: () => void;
  onExit: () => void;
};

// 32x32folk.png 实际为 768x512，每帧 64px，即 12 列 × 8 行。
const SHEET_COLS = 12;
const SHEET_ROWS = 8;
// 角色行走速度（source 像素 / 秒）与帧动画节奏。
const WALK_SPEED_PX_PER_SEC = 280;
const WALK_FRAME_INTERVAL_SEC = 0.14;
// 角色立绘在 source 坐标里的占位（正方形），约等于外部地图里的世界尺寸。
const AVATAR_SOURCE_SIZE = 92;
// 角色中心不可越过的边距，避免走出墙体/棚顶。
const AVATAR_INSET = 28;

type Direction = 'down' | 'left' | 'right' | 'up';

type WalkState = {
  x: number;
  y: number;
  dir: Direction;
  frame: number;
  moving: boolean;
};

function frameKey(dir: Direction, frame: number): string {
  return frame === 0 ? dir : `${dir}${frame + 1}`;
}

// 点击/触摸地图 → 角色朝目标点平滑走动；direction 由运动向量推导，moving 时循环 3 帧。
function useInteriorWalk(interior: VenueInteriorMapData) {
  const start = interior.entrance.interiorSource;
  const [state, setState] = useState<WalkState>({
    x: start[0],
    y: start[1],
    dir: 'down',
    frame: 0,
    moving: false,
  });
  const ref = useRef<WalkState>(state);
  const targetRef = useRef<{ x: number; y: number } | null>(null);

  // 切换内场（不同场馆）时把角色复位到入口。
  useEffect(() => {
    const reset: WalkState = {
      x: interior.entrance.interiorSource[0],
      y: interior.entrance.interiorSource[1],
      dir: 'down',
      frame: 0,
      moving: false,
    };
    ref.current = reset;
    targetRef.current = null;
    setState(reset);
  }, [interior]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let frameAcc = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const cur = ref.current;
      let { x, y, dir, frame } = cur;
      let moving = false;
      const target = targetRef.current;
      if (target) {
        const dx = target.x - x;
        const dy = target.y - y;
        const dist = Math.hypot(dx, dy);
        const step = WALK_SPEED_PX_PER_SEC * dt;
        if (dist <= step || dist < 1) {
          x = target.x;
          y = target.y;
          targetRef.current = null;
        } else {
          x += (dx / dist) * step;
          y += (dy / dist) * step;
          moving = true;
          dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        }
      }
      if (moving) {
        frameAcc += dt;
        if (frameAcc >= WALK_FRAME_INTERVAL_SEC) {
          frameAcc = 0;
          frame = (frame + 1) % 3;
        }
      } else {
        frame = 0;
      }
      const next = { x, y, dir, frame, moving };
      ref.current = next;
      setState(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [interior]);

  const walkTo = (sx: number, sy: number) => {
    targetRef.current = {
      x: Math.min(interior.source.width - AVATAR_INSET, Math.max(AVATAR_INSET, sx)),
      y: Math.min(interior.source.height - AVATAR_INSET, Math.max(AVATAR_INSET, sy)),
    };
  };

  return { state, walkTo };
}

function InteriorAvatar({
  state,
  characterName,
  interior,
}: {
  state: WalkState;
  characterName?: string;
  interior: VenueInteriorMapData;
}) {
  const character =
    characters.find((c) => c.name === characterName) ?? characters[0];
  if (!character) return null;

  // 复用 Character.tsx 的 base 前缀替换，使立绘在 /ai-town 与根域名下都能加载。
  const basePrefix = import.meta.env.BASE_URL.replace(/\/$/, '');
  const textureUrl = character.textureUrl.replace('/ai-town', basePrefix);

  const cell = character.spritesheetData.frames[frameKey(state.dir, state.frame)]?.frame;
  const col = cell ? cell.x / 64 : 0;
  const row = cell ? cell.y / 64 : 0;

  return (
    <div
      className="pointer-events-none absolute z-10"
      style={{
        left: percent(state.x, interior.source.width),
        top: percent(state.y, interior.source.height),
        width: percent(AVATAR_SOURCE_SIZE, interior.source.width),
        height: percent(AVATAR_SOURCE_SIZE, interior.source.height),
        transform: 'translate(-50%, -68%)',
      }}
    >
      <span
        className="absolute left-1/2 top-[88%] h-[14%] w-[58%] -translate-x-1/2 rounded-[50%] bg-black/35 blur-[2px]"
      />
      <span
        className="absolute inset-0"
        style={{
          backgroundImage: `url("${textureUrl}")`,
          backgroundSize: `${SHEET_COLS * 100}% ${SHEET_ROWS * 100}%`,
          backgroundPosition: `${(col / (SHEET_COLS - 1)) * 100}% ${(row / (SHEET_ROWS - 1)) * 100}%`,
          backgroundRepeat: 'no-repeat',
          imageRendering: 'auto',
          filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.35))',
        }}
      />
    </div>
  );
}

const RECT_STYLES: Record<InteriorRect['kind'], { background: string; border: string }> = {
  aisle: { background: 'rgba(219, 197, 151, 0.16)', border: 'rgba(255,255,255,0.08)' },
  bridge: { background: '#2d2520', border: '#5b4536' },
  counter: { background: '#d4944b', border: '#f0c27a' },
  entry: { background: 'rgba(245, 193, 95, 0.28)', border: '#f5c15f' },
  light: { background: 'rgba(255, 222, 151, 0.2)', border: 'rgba(255,255,255,0.16)' },
  mound: {
    background: 'radial-gradient(circle at 50% 28%, #e7d2ad 0%, #caa06f 54%, #a76f42 100%)',
    border: '#d7ba8f',
  },
  path: { background: 'rgba(170, 108, 62, 0.34)', border: 'rgba(255, 236, 198, 0.35)' },
  sand: { background: 'linear-gradient(180deg, #b67445 0%, #c58f5d 48%, #a9673e 100%)', border: '#9c633e' },
  sea: { background: 'linear-gradient(180deg, #c9d3d7 0%, #8ba39d 100%)', border: 'rgba(255,255,255,0.18)' },
  seat: { background: '#312821', border: '#6d5947' },
  shadow: { background: 'rgba(30, 23, 18, 0.72)', border: 'rgba(0,0,0,0.35)' },
  sofa: { background: '#d8c9a8', border: '#b89b70' },
  speaker: { background: '#201f1d', border: '#4d4740' },
  stage: { background: '#46392f', border: '#786454' },
  stall: { background: '#b84a37', border: '#f0b274' },
  table: { background: '#ead6aa', border: '#8f6e45' },
  wall: { background: '#b39b72', border: '#d7c09b' },
};

const CIRCLE_STYLES: Record<InteriorCircle['kind'], { background: string; border: string }> = {
  light: { background: 'rgba(255, 220, 130, 0.28)', border: 'rgba(255, 242, 198, 0.6)' },
  seat: { background: '#332a24', border: '#76614e' },
  sofa: { background: '#d9c8a1', border: '#a88c67' },
  table: { background: '#f0dcb6', border: '#8d6d46' },
};

function percent(value: number, total: number) {
  return `${(value / total) * 100}%`;
}

function rectStyle(rect: InteriorRect, interior: VenueInteriorMapData): CSSProperties {
  const styles = RECT_STYLES[rect.kind];
  const radius =
    rect.kind === 'mound'
      ? '50%'
      : rect.radius
        ? `${Math.min(50, (rect.radius / Math.max(rect.width, rect.height)) * 100)}%`
        : undefined;
  return {
    background: styles.background,
    borderRadius: radius,
    borderColor: styles.border,
    height: percent(rect.height, interior.source.height),
    left: percent(rect.x, interior.source.width),
    top: percent(rect.y, interior.source.height),
    width: percent(rect.width, interior.source.width),
  };
}

function circleStyle(circle: InteriorCircle, interior: VenueInteriorMapData): CSSProperties {
  const styles = CIRCLE_STYLES[circle.kind];
  return {
    background: styles.background,
    borderColor: styles.border,
    height: percent(circle.radius * 2, interior.source.height),
    left: percent(circle.x - circle.radius, interior.source.width),
    top: percent(circle.y - circle.radius, interior.source.height),
    width: percent(circle.radius * 2, interior.source.width),
  };
}

function labelStyle(
  label: { x: number; y: number; align?: 'left' | 'center' | 'right' },
  interior: VenueInteriorMapData,
): CSSProperties {
  const transform =
    label.align === 'left'
      ? 'translate(0, -50%)'
      : label.align === 'right'
        ? 'translate(-100%, -50%)'
        : 'translate(-50%, -50%)';
  return {
    left: percent(label.x, interior.source.width),
    textAlign: label.align ?? 'center',
    top: percent(label.y, interior.source.height),
    transform,
  };
}

function ShapeLabel({ text }: { text: string }) {
  return (
    <span className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 truncate text-center text-[10px] font-bold leading-none text-[#fff3d6] drop-shadow">
      {text}
    </span>
  );
}

function RestaurantBackdrop() {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_82%,#9a7650_0%,#6f563a_55%,#3a2a20_100%)]" />
      <div className="absolute inset-x-0 top-0 h-[13%] bg-[#1d2022]" />
      <div className="absolute inset-x-0 top-[13%] h-[20%] bg-[#b39261]" />
      <div className="absolute left-[52%] top-[2%] h-[28%] w-[43%] border border-[#b9b9b9]/45 bg-[#d2d9dc]/24" />

      {Array.from({ length: 12 }, (_, i) => (
        <i
          key={`roof-v-${i}`}
          className="absolute top-0 h-[34%] w-px bg-[#d8d8d8]/35"
          style={{ left: `${4 + i * 8}%` }}
        />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <i
          key={`roof-h-${i}`}
          className="absolute left-0 h-px w-full bg-[#d8d8d8]/30"
          style={{ top: `${3 + i * 6}%` }}
        />
      ))}
      <i className="absolute left-[32%] top-[21%] h-[2%] w-[30%] rounded-full bg-[#fff2c4] blur-[2px]" />
      <i className="absolute left-[52%] top-[18%] h-[2%] w-[40%] rounded-full bg-[#ffb066] blur-[2px]" />
    </>
  );
}

function BridgeBackdrop() {
  return (
    <>
      <div className="absolute inset-0 bg-[#b9794b]" />
      <div className="absolute inset-x-0 top-0 h-[30%] bg-[#d3dee4]" />
      <div className="absolute inset-x-0 top-[29%] h-[11%] bg-[#869894]" />
      <div className="absolute inset-x-0 top-[39%] h-[8%] bg-[#cdb186]" />
      <div className="absolute inset-x-0 bottom-0 h-[38%] bg-[linear-gradient(180deg,#b57747_0%,#9f633c_100%)]" />
      <i className="absolute left-[34%] top-[31%] h-[2px] w-[32%] bg-[#dfe8e7]/70" />
      <i className="absolute left-[39%] top-[43%] h-[34%] w-[22%] rounded-[50%] bg-[#b86f42]/55 blur-sm" />
      {Array.from({ length: 10 }, (_, i) => (
        <i
          key={`sand-ridge-${i}`}
          className="absolute h-px bg-[#e4bc82]/24"
          style={{
            left: `${6 + i * 7}%`,
            top: `${64 + (i % 4) * 6}%`,
            transform: `rotate(${i % 2 === 0 ? -7 : 5}deg)`,
            width: `${22 + (i % 3) * 8}%`,
          }}
        />
      ))}
    </>
  );
}

function SceneBackdrop({ scene }: { scene: VenueInteriorMapData['scene'] }) {
  return scene === 'bridge' ? <BridgeBackdrop /> : <RestaurantBackdrop />;
}

export default function VenueInteriorMap({
  interior = BIRD_RESTAURANT_INTERIOR,
  characterName,
  onOpenPhotoMemory,
  onExit,
}: Props) {
  const scene = interior.scene ?? 'restaurant';
  const heading = scene === 'restaurant' ? `${interior.venue}内场` : interior.venue;
  const subtitle = interior.subtitle ?? '夜市棚 · 餐桌 · 摊位 · 演出角';

  const { state, walkTo } = useInteriorWalk(interior);
  const handleMapPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    walkTo(
      ((e.clientX - rect.left) / rect.width) * interior.source.width,
      ((e.clientY - rect.top) / rect.height) * interior.source.height,
    );
  };

  return (
    <section className="fixed inset-0 z-[70] flex flex-col bg-[#17110e] text-[#f7ead2]">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#5e4631] bg-[#231712] px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 className="truncate font-display text-2xl leading-none text-[#f7d28c] sm:text-4xl">
            {heading}
          </h2>
          <div className="mt-1 truncate text-xs font-semibold text-[#bfa98a] sm:text-sm">
            {subtitle}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onOpenPhotoMemory && (
            <button
              type="button"
              onClick={onOpenPhotoMemory}
              className="border border-[#c99650] bg-[#3a251b] px-3 py-2 text-sm font-bold text-[#ffe7bc] shadow-[3px_3px_0_#120b08] transition hover:bg-[#5a3425] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              照片记忆
            </button>
          )}
          <button
            type="button"
            onClick={onExit}
            className="border border-[#c99650] bg-[#3a251b] px-4 py-2 text-sm font-bold text-[#ffe7bc] shadow-[3px_3px_0_#120b08] transition hover:bg-[#5a3425] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            离开
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#241812] p-3 sm:p-5">
        <div
          onPointerDown={handleMapPointer}
          className="relative mx-auto cursor-pointer overflow-hidden border-2 border-[#6b5038] bg-[#6f563a] shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
          style={{
            aspectRatio: `${interior.source.width} / ${interior.source.height}`,
            maxHeight: '100%',
            width: `min(100%, calc((100vh - 110px) * ${
              interior.source.width / interior.source.height
            }))`,
          }}
        >
          <SceneBackdrop scene={scene} />

          {interior.rects.map((rect) => (
            <div
              key={rect.id}
              className={
                'absolute border ' +
                (rect.walkable
                  ? 'border-dashed opacity-90'
                  : 'shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_12px_rgba(0,0,0,0.18)]')
              }
              style={rectStyle(rect, interior)}
            >
              {rect.label && <ShapeLabel text={rect.label} />}
            </div>
          ))}

          {interior.circles.map((circle) => (
            <div
              key={circle.id}
              className="absolute rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_7px_12px_rgba(0,0,0,0.2)]"
              style={circleStyle(circle, interior)}
            />
          ))}

          {interior.labels.map((label) => (
            <div
              key={label.id}
              className="absolute max-w-[18%] rounded-sm border border-[#2a1b13]/50 bg-[#2a1b13]/80 px-1.5 py-1 text-[10px] font-black leading-tight text-[#ffe3a8] shadow-[2px_2px_0_rgba(0,0,0,0.35)] sm:text-xs"
              style={labelStyle(label, interior)}
            >
              {label.label}
            </div>
          ))}

          <div
            className="absolute h-[5.5%] w-[8%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#f5c15f] bg-[#f5c15f]/20 shadow-[0_0_24px_rgba(245,193,95,0.65)]"
            style={{
              left: percent(interior.entrance.interiorSource[0], interior.source.width),
              top: percent(interior.entrance.interiorSource[1], interior.source.height),
            }}
          />

          <InteriorAvatar state={state} characterName={characterName} interior={interior} />

          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[10px] font-semibold text-[#ffe7bc] sm:text-xs">
            点击地图任意处走动
          </div>
        </div>
      </div>
    </section>
  );
}
