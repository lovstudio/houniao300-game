import type { CSSProperties } from 'react';
import {
  BIRD_RESTAURANT_INTERIOR,
  type InteriorCircle,
  type InteriorRect,
  type VenueInteriorMap as VenueInteriorMapData,
} from '../../data/birdRestaurantInterior';

type Props = {
  interior?: VenueInteriorMapData;
  onExit: () => void;
};

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

export default function VenueInteriorMap({ interior = BIRD_RESTAURANT_INTERIOR, onExit }: Props) {
  const scene = interior.scene ?? 'restaurant';
  const heading = scene === 'restaurant' ? `${interior.venue}内场` : interior.venue;
  const subtitle = interior.subtitle ?? '夜市棚 · 餐桌 · 摊位 · 演出角';

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
        <button
          type="button"
          onClick={onExit}
          className="shrink-0 border border-[#c99650] bg-[#3a251b] px-4 py-2 text-sm font-bold text-[#ffe7bc] shadow-[3px_3px_0_#120b08] transition hover:bg-[#5a3425] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          离开
        </button>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#241812] p-3 sm:p-5">
        <div
          className="relative mx-auto overflow-hidden border-2 border-[#6b5038] bg-[#6f563a] shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
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
        </div>
      </div>
    </section>
  );
}
