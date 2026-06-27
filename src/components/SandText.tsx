import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

// 可复用的「沙之书」式沙粒文字：扬沙 → 凝字 → 落定后鼠标可拨；可命令式 scatter() 散成沙。
// 画布填满父容器，字号由容器高度推导并按宽度收缩；reduced-motion 退化为静态文字。

export interface SandTextHandle {
  scatter: () => void;
}

type Props = {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  color?: string; // 主沙色
  spark?: string; // 火星色
  sparkRate?: number;
  fontScale?: number; // 字号 / 容器高度
  weight?: number;
  tracking?: number; // 字距 / 字号
  repel?: boolean;
  jitter?: number;
  settleMs?: number;
};

type Grain = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  r: number;
  c: string;
  spark: boolean;
  delay: number;
  life: number;
};

const SandText = forwardRef<SandTextHandle, Props>(function SandText(
  {
    text,
    className,
    style,
    color = '#2c2620',
    spark = '#b0563a',
    sparkRate = 0.05,
    fontScale = 0.74,
    weight = 900,
    tracking = 0.12,
    repel = true,
    jitter = 0.09,
    settleMs = 2200,
  },
  ref,
) {
  const reduce = useMemo(
    () =>
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef<'forming' | 'settled' | 'scatter'>('forming');
  const grainsRef = useRef<Grain[]>([]);
  const centerRef = useRef({ x: 0, y: 0 });
  const [fallbackPx, setFallbackPx] = useState(0);

  useImperativeHandle(ref, () => ({
    scatter() {
      if (modeRef.current === 'scatter') return;
      modeRef.current = 'scatter';
      const { x: cx, y: cy } = centerRef.current;
      for (const p of grainsRef.current) {
        const ang = Math.atan2(p.y - cy, p.x - cx) + (Math.random() - 0.5) * 0.8;
        const force = Math.random() * 7 + 3;
        p.vx = Math.cos(ang) * force;
        p.vy = Math.sin(ang) * force - 1.2;
        p.life = 1;
      }
    },
  }));

  useEffect(() => {
    if (reduce) {
      // 仅用于退化态字号
      const el = wrapRef.current;
      if (el) setFallbackPx(el.clientHeight * fontScale);
      return;
    }
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let DPR = 1;
    let raf = 0;
    let start: number | null = null;
    const mouse = { x: -9999, y: -9999, active: false };

    const spawnFromWind = () => {
      const side = Math.random();
      if (side < 0.6) return { x: Math.random() * W, y: H + Math.random() * H * 0.6 + 20 };
      if (side < 0.8) return { x: -W * 0.3 - 10, y: Math.random() * H };
      return { x: W + W * 0.3 + 10, y: Math.random() * H };
    };

    const build = () => {
      const off = document.createElement('canvas');
      off.width = Math.max(1, W);
      off.height = Math.max(1, H);
      const octx = off.getContext('2d');
      if (!octx) return;

      // 字号：容器高度 × scale，再按宽度收缩
      let fontSize = H * fontScale;
      const chars = [...text];
      const measure = (fs: number) => {
        octx.font = `${weight} ${fs}px "Noto Serif SC","Songti SC",serif`;
        const tr = fs * tracking;
        const ws = chars.map((c) => octx.measureText(c).width + tr);
        return { ws, total: ws.reduce((a, b) => a + b, 0) - tr, tr };
      };
      let m = measure(fontSize);
      const maxW = W * 0.94;
      if (m.total > maxW) {
        fontSize *= maxW / m.total;
        m = measure(fontSize);
      }
      setFallbackPx(fontSize);

      octx.fillStyle = '#fff';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.font = `${weight} ${fontSize}px "Noto Serif SC","Songti SC",serif`;
      const cy = H / 2;
      let x = W / 2 - m.total / 2;
      chars.forEach((c, i) => {
        octx.fillText(c, x + m.ws[i] / 2 - m.tr / 2, cy);
        x += m.ws[i];
      });
      centerRef.current = { x: W / 2, y: cy };

      const step = fontSize < 60 ? 3 : 4;
      const img = octx.getImageData(0, 0, W, H).data;
      const targets: { x: number; y: number }[] = [];
      for (let yy = 0; yy < H; yy += step) {
        for (let xx = 0; xx < W; xx += step) {
          if (img[(yy * W + xx) * 4 + 3] > 130) targets.push({ x: xx, y: yy });
        }
      }

      const prev = grainsRef.current;
      grainsRef.current = targets.map((t, i) => {
        const g: Grain =
          prev[i] ??
          ({
            ...spawnFromWind(),
            vx: 0,
            vy: 0,
            tx: 0,
            ty: 0,
            r: Math.random() * 1.3 + 0.7,
            c: `hsl(34, ${10 + Math.random() * 12}%, ${16 + Math.random() * 16}%)`,
            spark: Math.random() < sparkRate,
            delay: 0,
            life: 1,
          } as Grain);
        g.tx = t.x;
        g.ty = t.y;
        g.delay = (t.x / Math.max(1, W)) * 360 + Math.random() * 220;
        return g;
      });
    };

    const tick = (ts: number) => {
      if (start === null) start = ts;
      const t = ts - start;
      const mode = modeRef.current;
      ctx.clearRect(0, 0, W, H);

      const spring = 0.021;
      const friction = 0.84;
      for (const p of grainsRef.current) {
        if (mode !== 'scatter' && t < p.delay) {
          p.x += p.vx * 0.4;
          p.y += p.vy * 0.4;
        } else {
          const dx = p.tx - p.x;
          const dy = p.ty - p.y;
          p.vx += dx * spring;
          p.vy += dy * spring;
          if (repel && mouse.active && mode === 'settled') {
            const mdx = p.x - mouse.x;
            const mdy = p.y - mouse.y;
            const d2 = mdx * mdx + mdy * mdy;
            if (d2 < 6400) {
              const dist = Math.sqrt(d2) || 0.001;
              const f = (1 - dist / 80) * 2.8;
              p.vx += (mdx / dist) * f;
              p.vy += (mdy / dist) * f;
            }
          }
          p.vx *= friction;
          p.vy *= friction;
          if (mode === 'settled') {
            p.vx += (Math.random() - 0.5) * jitter;
            p.vy += (Math.random() - 0.5) * jitter;
          }
          p.x += p.vx;
          p.y += p.vy;
        }

        let alpha = 1;
        if (mode === 'forming' && t < p.delay) alpha = 0;
        else if (mode === 'forming') alpha = Math.min(1, (t - p.delay) / 600);
        else if (mode === 'scatter') {
          p.life -= 0.018;
          alpha = Math.max(0, p.life);
        }

        ctx.globalAlpha = alpha * 0.92;
        ctx.fillStyle = p.spark ? spark : p.c;
        ctx.fillRect(p.x, p.y, p.r, p.r);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };

    const ro = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect();
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.round(rect.width);
      H = Math.round(rect.height);
      if (W < 2 || H < 2) return;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      build();
    });
    ro.observe(wrap);

    const onMove = (e: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };
    const onLeave = () => {
      mouse.active = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(tick);
    const settleId = window.setTimeout(() => {
      if (modeRef.current === 'forming') modeRef.current = 'settled';
    }, settleMs);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      window.clearTimeout(settleId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, text]);

  return (
    <div ref={wrapRef} className={className} style={{ position: 'relative', ...style }}>
      {reduce ? (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            fontFamily: '"Noto Serif SC","Songti SC",serif',
            fontWeight: weight,
            fontSize: fallbackPx || undefined,
            letterSpacing: `${tracking}em`,
            color,
            lineHeight: 1,
          }}
        >
          {text}
        </div>
      ) : (
        <canvas ref={canvasRef} className="absolute inset-0" aria-hidden />
      )}
    </div>
  );
});

export default SandText;
