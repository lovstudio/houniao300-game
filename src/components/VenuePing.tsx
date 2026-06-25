import { Graphics, useTick } from '@pixi/react';
import { Graphics as PixiGraphics } from 'pixi.js';
import { useState } from 'react';

const DURATION = 2400;
const COLOR = 0xc0654a; // 陶土色 — matches the festival accent

// A short-lived pulsing ring drawn on the map to mark the venue the timeline focused.
export function VenuePing(props: { x: number; y: number; t: number; tileDim: number }) {
  const { x, y, t, tileDim } = props;
  const [, force] = useState(0);
  useTick(() => force((n) => (n + 1) % 1_000_000));

  const draw = (g: PixiGraphics) => {
    g.clear();
    const elapsed = Date.now() - t;
    if (elapsed > DURATION) return;

    // three staggered expanding rings
    for (let i = 0; i < 3; i++) {
      const p = elapsed / DURATION - i * 0.18;
      if (p < 0 || p > 1) continue;
      const r = tileDim * (0.4 + p * 2.6);
      g.lineStyle(Math.max(0.5, 3.2 * (1 - p)), COLOR, 1 - p);
      g.drawCircle(x, y, r);
    }
    // pulsing centre marker
    const pulse = 0.5 + 0.5 * Math.sin(elapsed / 110);
    g.lineStyle(0);
    g.beginFill(COLOR, 0.9);
    g.drawCircle(x, y, tileDim * 0.18 + pulse * tileDim * 0.06);
    g.endFill();
    g.lineStyle(1.4, 0xfff5e6, 0.9);
    g.drawCircle(x, y, tileDim * 0.18 + pulse * tileDim * 0.06);
  };

  return <Graphics draw={draw} />;
}
