import { useEffect, useMemo, useRef } from 'react';

// 氛围飘沙：极淡的尘粒缓缓上扬，给标题屏营造电影感的纵深与「正在流动的沙」。
// 与 SandText 同源的沙语言；reduced-motion 下不渲染。

export default function SandDrift({
  className,
  color = '#6b6052',
  density = 22000,
}: {
  className?: string;
  color?: string;
  density?: number; // 每多少 px² 一粒
}) {
  const reduce = useMemo(
    () =>
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reduce) return;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let DPR = 1;
    let raf = 0;
    let t = 0;
    let motes: { x: number; y: number; r: number; vy: number; a: number; ph: number }[] = [];

    const seed = () => {
      const n = Math.round((W * H) / density);
      motes = Array.from({ length: n }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.2 + 0.3,
        vy: Math.random() * 0.22 + 0.05,
        a: Math.random() * 0.16 + 0.03,
        ph: Math.random() * Math.PI * 2,
      }));
    };

    const tick = () => {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = color;
      for (const m of motes) {
        m.y -= m.vy;
        const x = m.x + Math.sin(t * 0.4 + m.ph) * 8;
        if (m.y < -8) {
          m.y = H + 8;
          m.x = Math.random() * W;
        }
        ctx.globalAlpha = m.a;
        ctx.fillRect(x, m.y, m.r, m.r);
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
      seed();
    });
    ro.observe(wrap);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [reduce, color, density]);

  return (
    <div ref={wrapRef} className={className} aria-hidden>
      {!reduce && <canvas ref={canvasRef} className="absolute inset-0" />}
    </div>
  );
}
