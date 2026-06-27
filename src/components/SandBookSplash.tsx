import { useEffect, useMemo, useRef, useState } from 'react';

// 《沙之书》开屏 —— 致敬博尔赫斯笔下那本「没有第一页、也没有最后一页」的无限之书。
// 一捧会流动的沙被风扬起、凝聚成书名，再渗出一句箴言；翻开之后，沙散去，进入像素沙城。
// 仅首次访问播放（localStorage 记忆），公共投屏 / 深链（?wall / ?comic）不打扰。

const SEEN_KEY = 'sandbook.splash.seen.v1';

type Phase = 'show' | 'leaving' | 'done';

type Grain = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  r: number;
  col: string;
  spark: boolean;
  delay: number;
  life: number;
};

export default function SandBookSplash() {
  const reduce = useMemo(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  // 是否需要展示：已看过则跳过；公共投屏 / 深链页不打扰。
  const shouldShow = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('wall') === '1' || params.get('comic')) return false;
    try {
      return !window.localStorage.getItem(SEEN_KEY);
    } catch {
      return true;
    }
  }, []);

  const [phase, setPhase] = useState<Phase>('show');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef<'forming' | 'settled' | 'scatter'>('forming');

  // 永不重复的页码 —— 致敬「巨大且任意的页码」。
  const [folio, setFolio] = useState('—');

  const dismiss = () => {
    if (phase !== 'show') return;
    modeRef.current = 'scatter';
    setPhase('leaving');
    try {
      window.localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* 隐私模式忽略 */
    }
    window.setTimeout(() => setPhase('done'), 1300);
  };

  // 页码轮播
  useEffect(() => {
    if (!shouldShow || phase === 'done') return;
    const seen = new Set<number>();
    const roll = () => {
      let n: number;
      do {
        n = Math.floor(Math.random() * 99999) + 100;
      } while (seen.has(n));
      seen.add(n);
      setFolio(n.toLocaleString('en-US'));
    };
    roll();
    const id = window.setInterval(roll, 3400);
    return () => window.clearInterval(id);
  }, [shouldShow, phase]);

  // Esc 跳过
  useEffect(() => {
    if (!shouldShow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow, phase]);

  // 沙粒动画
  useEffect(() => {
    if (!shouldShow || reduce) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let DPR = 1;
    let raf = 0;
    let start: number | null = null;
    let titleCenterY = 0;
    let grains: Grain[] = [];
    const drift: { x: number; y: number; r: number; vx: number; vy: number; a: number }[] = [];
    const mouse = { x: -9999, y: -9999, active: false };

    const spawnFromWind = () => {
      const side = Math.random();
      let x: number;
      let y: number;
      if (side < 0.6) {
        x = Math.random() * W;
        y = H + Math.random() * H * 0.4;
      } else if (side < 0.8) {
        x = -W * 0.3 * Math.random();
        y = Math.random() * H;
      } else {
        x = W + W * 0.3 * Math.random();
        y = Math.random() * H;
      }
      return { x, y, vx: 0, vy: 0 };
    };

    const buildTargets = () => {
      const off = document.createElement('canvas');
      off.width = W;
      off.height = H;
      const octx = off.getContext('2d');
      if (!octx) return;

      const fontSize = Math.min(W * 0.25, H * 0.28, 250);
      titleCenterY = H * 0.34;
      octx.fillStyle = '#fff';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.font = `900 ${fontSize}px "Noto Serif SC","Songti SC",serif`;

      const txt = '沙之书';
      const tracking = fontSize * 0.1;
      const widths = [...txt].map((c) => octx.measureText(c).width + tracking);
      const total = widths.reduce((a, b) => a + b, 0) - tracking;
      let x = W / 2 - total / 2;
      [...txt].forEach((c, i) => {
        octx.fillText(c, x + widths[i] / 2 - tracking / 2, titleCenterY);
        x += widths[i];
      });

      const step = 4;
      const img = octx.getImageData(0, 0, W, H).data;
      const targets: { x: number; y: number }[] = [];
      for (let y = 0; y < H; y += step) {
        for (let xx = 0; xx < W; xx += step) {
          if (img[(y * W + xx) * 4 + 3] > 130) targets.push({ x: xx, y });
        }
      }

      const prev = grains;
      grains = targets.map((t, i) => {
        const g: Grain = prev[i] ?? {
          ...spawnFromWind(),
          tx: 0,
          ty: 0,
          r: Math.random() * 1.5 + 0.6,
          // 沙金三色，外加少量金沙
          col: `hsl(${36 + Math.random() * 12}, ${42 + Math.random() * 18}%, ${60 + Math.random() * 22}%)`,
          spark: Math.random() < 0.07,
          delay: 0,
          life: 1,
        };
        g.tx = t.x;
        g.ty = t.y;
        g.delay = (t.x / W) * 520 + Math.random() * 260;
        return g;
      });

      if (!drift.length) {
        const n = Math.round((W * H) / 26000);
        for (let i = 0; i < n; i++) {
          drift.push({
            x: Math.random() * W,
            y: Math.random() * H,
            r: Math.random() * 1.1 + 0.3,
            vx: (Math.random() - 0.5) * 0.18,
            vy: -(Math.random() * 0.22 + 0.05),
            a: Math.random() * 0.35 + 0.05,
          });
        }
      }
    };

    const resize = () => {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      buildTargets();
    };

    const tick = (ts: number) => {
      if (start === null) start = ts;
      const t = ts - start;
      const mode = modeRef.current;
      ctx.clearRect(0, 0, W, H);

      // 氛围飘沙
      ctx.fillStyle = '#b8a079';
      for (const d of drift) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.y < -10) {
          d.y = H + 10;
          d.x = Math.random() * W;
        }
        if (d.x < -10) d.x = W + 10;
        else if (d.x > W + 10) d.x = -10;
        ctx.globalAlpha = d.a;
        ctx.fillRect(d.x, d.y, d.r, d.r);
      }
      ctx.globalAlpha = 1;

      const spring = 0.02;
      const friction = 0.84;
      for (const p of grains) {
        if (mode !== 'scatter' && t < p.delay) {
          p.x += p.vx * 0.4;
          p.y += p.vy * 0.4;
        } else {
          const dx = p.tx - p.x;
          const dy = p.ty - p.y;
          p.vx += dx * spring;
          p.vy += dy * spring;

          if (mouse.active && mode === 'settled') {
            const mdx = p.x - mouse.x;
            const mdy = p.y - mouse.y;
            const d2 = mdx * mdx + mdy * mdy;
            if (d2 < 9000) {
              const dist = Math.sqrt(d2);
              const f = (1 - dist / 95) * 3.2;
              const inv = 1 / (dist + 0.001);
              p.vx += mdx * inv * f;
              p.vy += mdy * inv * f;
            }
          }
          p.vx *= friction;
          p.vy *= friction;
          if (mode === 'settled') {
            p.vx += (Math.random() - 0.5) * 0.1;
            p.vy += (Math.random() - 0.5) * 0.1;
          }
          p.x += p.vx;
          p.y += p.vy;
        }

        let alpha = 1;
        if (mode === 'forming' && t < p.delay) alpha = 0;
        else if (mode === 'forming') alpha = Math.min(1, (t - p.delay) / 700);
        else if (mode === 'scatter') {
          p.life -= 0.012;
          alpha = Math.max(0, p.life);
        }

        ctx.globalAlpha = alpha;
        if (p.spark) {
          ctx.fillStyle = '#fec742';
          ctx.shadowColor = '#c79a44';
          ctx.shadowBlur = 6;
        } else {
          ctx.fillStyle = p.col;
          ctx.shadowBlur = 0;
        }
        ctx.fillRect(p.x, p.y, p.r, p.r);
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };
    const onLeave = () => {
      mouse.active = false;
    };
    const onScatter = () => {
      for (const p of grains) {
        const ang = Math.atan2(p.y - titleCenterY, p.x - W / 2) + (Math.random() - 0.5);
        const force = Math.random() * 9 + 4;
        p.vx = Math.cos(ang) * force;
        p.vy = Math.sin(ang) * force - 1.5;
        p.life = 1;
      }
    };

    let rt = 0;
    const onResize = () => {
      window.clearTimeout(rt);
      rt = window.setTimeout(resize, 160);
    };

    resize();
    raf = requestAnimationFrame(tick);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerleave', onLeave);
    window.addEventListener('resize', onResize);
    // 标题落定后开放鼠标拨沙
    const settleId = window.setTimeout(() => {
      if (modeRef.current === 'forming') modeRef.current = 'settled';
    }, 2600);
    // 监听翻开：当 mode 切到 scatter 时炸开（用 MutationObserver 不合适，直接轮询一次）
    const watch = window.setInterval(() => {
      if (modeRef.current === 'scatter') {
        onScatter();
        window.clearInterval(watch);
      }
    }, 60);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', onResize);
      window.clearTimeout(settleId);
      window.clearInterval(watch);
    };
  }, [shouldShow, reduce]);

  if (!shouldShow || phase === 'done') return null;

  const serif = '"Noto Serif SC", "Songti SC", serif';

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[200] overflow-hidden bg-brown-900 transition-opacity duration-[1100ms] ease-out"
      style={{
        opacity: phase === 'leaving' ? 0 : 1,
        pointerEvents: phase === 'leaving' ? 'none' : 'auto',
        // 暖光晕 + 沙丘渐变 + 暗角，沿用 masthead 的灯下沙城语言
        background:
          'radial-gradient(120% 90% at 50% 34%, rgba(204,120,76,0.20) 0%, rgba(120,72,40,0.06) 34%, transparent 64%),' +
          'radial-gradient(140% 120% at 50% 122%, rgba(184,111,80,0.28) 0%, transparent 56%),' +
          '#181425',
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* 暗角 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(120% 100% at 50% 50%, transparent 52%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      {/* 顶部：永不重复的页码 */}
      <div
        className="splash-fade pointer-events-none absolute inset-x-0 top-[max(18px,4vh)] text-center"
        style={{
          fontFamily: serif,
          letterSpacing: '0.42em',
          fontSize: 'clamp(10px,1.4vw,13px)',
          color: '#8a7c66',
          animationDelay: '0.4s',
        }}
      >
        FOLIO <span style={{ color: '#caa979' }}>{folio}</span>
      </div>

      {/* 无障碍标题（沙粒在 canvas 上绘制，约 34% 屏高居中） */}
      <h1 className="sr-only">沙之书</h1>

      {/* reduced-motion / canvas 不可用时的兜底标题 */}
      {reduce && (
        <div
          className="game-title font-display absolute inset-x-0 top-[24%] text-center"
          style={{ fontSize: 'clamp(56px,16vw,180px)', lineHeight: 1, letterSpacing: '0.08em' }}
        >
          沙之书
        </div>
      )}

      {/* 文字层 —— 绝对定位在下半部，避免与 canvas 标题重叠 */}
      <div className="absolute inset-x-0 top-[54%] flex flex-col items-center px-6 text-center">
        <div
          className="splash-fade"
          style={{
            fontFamily: serif,
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: 'clamp(16px,2.6vw,28px)',
            color: '#fec742',
            letterSpacing: '0.06em',
            animationDelay: '1.2s',
          }}
        >
          El&nbsp;Libro&nbsp;de&nbsp;Arena
        </div>

        <div
          className="splash-rule"
          style={{ animationDelay: '1.5s' }}
        />

        <p
          className="splash-fade max-w-[min(80vw,560px)]"
          style={{
            fontFamily: serif,
            fontWeight: 300,
            fontSize: 'clamp(14px,1.9vw,18px)',
            lineHeight: 2,
            color: '#EAD4AA',
            letterSpacing: '0.04em',
            animationDelay: '1.9s',
          }}
        >
          没有哪一页是第一页，也没有哪一页是最后一页。
          <br />
          书与沙，都没有起点，也没有终点。
          <span
            className="mt-4 block"
            style={{ fontStyle: 'italic', fontSize: 'clamp(12px,1.5vw,15px)', color: '#8a7c66', letterSpacing: '0.12em' }}
          >
            — Jorge Luis Borges
          </span>
        </p>

        <button
          type="button"
          onClick={dismiss}
          className="splash-fade splash-enter mt-[clamp(34px,6vh,60px)]"
          style={{ animationDelay: '2.5s', fontFamily: serif }}
        >
          翻 开
        </button>
      </div>

      {/* 跳过 */}
      <button
        type="button"
        onClick={dismiss}
        className="splash-fade absolute right-4 top-[max(18px,4vh)] text-[12px] tracking-widest text-brown-300/70 transition-colors hover:text-brown-200"
        style={{ fontFamily: serif, animationDelay: '2.5s' }}
      >
        跳过
      </button>
    </div>
  );
}
