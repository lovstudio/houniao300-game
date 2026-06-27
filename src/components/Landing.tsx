import { useEffect, useMemo, useRef, useState } from 'react';
import Onboarding from './Onboarding.tsx';

// 候鸟沙城 · 候鸟300 落地页 —— 首次抵达（profile===null）即此屏：
// 一座「从沙滩上长出来的城」，沙粒被风扬起、凝成「沙之书」，鼠标可拨开沙；
// 沙城只存在 300 小时，会消失、会迁徙——登记成为候鸟，即可进入。
// 沿用产品暖色夜墨沙金体系，致敬博尔赫斯《沙之书》的质地，但说的是候鸟300 自己的话。

// 「正在发生，却已经开始怀念的瞬间」—— 候鸟300 现场轮播
const MOMENTS = [
  '直播一小时，留下一面候鸟的旗帜',
  '花车与人群，走向海边的篝火',
  '纱之礼堂，为爱留下一纸证明',
  '一百五十小时，海边围坐烤羊',
  '《Token 在燃烧》，点亮整片夜晚',
  '白天一起运动，晚上一起看戏',
];

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
};

export default function Landing({ userId, onDone }: { userId: string; onDone: () => void }) {
  const reduce = useMemo(
    () =>
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [moment, setMoment] = useState(0);

  // 现场瞬间轮播
  useEffect(() => {
    const id = window.setInterval(() => setMoment((m) => (m + 1) % MOMENTS.length), 3400);
    return () => window.clearInterval(id);
  }, []);

  // 沙粒动画：扬沙 → 凝成「沙之书」→ 落定后可拨沙
  useEffect(() => {
    if (reduce) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let DPR = 1;
    let raf = 0;
    let start: number | null = null;
    let mode: 'forming' | 'settled' = 'forming';
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

      const fontSize = Math.min(W * 0.32, H * 0.24, 220);
      const titleCenterY = H * 0.21;
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
          col: `hsl(${36 + Math.random() * 12}, ${42 + Math.random() * 18}%, ${60 + Math.random() * 22}%)`,
          spark: Math.random() < 0.07,
          delay: 0,
        };
        g.tx = t.x;
        g.ty = t.y;
        g.delay = (t.x / W) * 520 + Math.random() * 260;
        return g;
      });

      if (!drift.length) {
        const n = Math.round((W * H) / 24000);
        for (let i = 0; i < n; i++) {
          drift.push({
            x: Math.random() * W,
            y: Math.random() * H,
            r: Math.random() * 1.1 + 0.3,
            vx: (Math.random() - 0.5) * 0.18,
            vy: -(Math.random() * 0.22 + 0.05),
            a: Math.random() * 0.3 + 0.05,
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
      ctx.clearRect(0, 0, W, H);

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
        if (t < p.delay) {
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
        if (t < p.delay) alpha = 0;
        else if (mode === 'forming') alpha = Math.min(1, (t - p.delay) / 700);

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
    const settleId = window.setTimeout(() => {
      mode = 'settled';
    }, 2600);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', onResize);
      window.clearTimeout(settleId);
    };
  }, [reduce]);

  const serif = '"Noto Serif SC", "Songti SC", serif';

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden bg-brown-900"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        // 海边落日 · 沙丘 · 暖光晕 —— 候鸟沙城从沙滩上长出来
        background:
          'radial-gradient(120% 80% at 50% 12%, rgba(228,166,114,0.22) 0%, rgba(184,111,80,0.08) 30%, transparent 60%),' +
          'radial-gradient(150% 120% at 50% 124%, rgba(184,111,80,0.30) 0%, transparent 56%),' +
          '#181425',
      }}
    >
      {/* 沙粒画布（视口固定，标题约 21% 屏高，可拨沙） */}
      {!reduce && <canvas ref={canvasRef} className="absolute inset-0" />}

      {/* 暗角 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 100% at 50% 50%, transparent 54%, rgba(0,0,0,0.5) 100%)',
        }}
      />

      {/* 顶部：候鸟300 · 正在发生 + 现场瞬间轮播 */}
      <div
        className="splash-fade pointer-events-none absolute inset-x-0 top-[max(14px,3vh)] z-10 px-6 text-center"
        style={{ animationDelay: '0.3s' }}
      >
        <div
          style={{
            fontFamily: serif,
            letterSpacing: '0.4em',
            fontSize: 'clamp(10px,1.4vw,13px)',
            color: '#caa979',
          }}
        >
          候鸟300 · 正在发生
        </div>
        <div
          key={moment}
          className="landing-moment mx-auto mt-1 max-w-[90vw] truncate"
          style={{
            fontFamily: serif,
            fontStyle: 'italic',
            fontSize: 'clamp(11px,1.5vw,14px)',
            color: '#8a7c66',
            letterSpacing: '0.04em',
          }}
        >
          {MOMENTS[moment]}
        </div>
      </div>

      {/* 内容滚动层 */}
      <div className="relative z-10 h-full overflow-y-auto">
        <div className="flex min-h-full flex-col items-center px-6 pb-12 pt-6 text-center">
          {/* 标题区：沙粒在 canvas 上绘制，此处留白；reduced-motion 用 DOM 标题兜底 */}
          <h1 className="sr-only">沙之书 · 候鸟沙城</h1>
          {reduce ? (
            <div
              className="game-title font-display mt-[12vh]"
              style={{ fontSize: 'clamp(56px,16vw,180px)', lineHeight: 1, letterSpacing: '0.08em' }}
            >
              沙之书
            </div>
          ) : (
            <div style={{ height: 'clamp(200px,32vh,300px)' }} />
          )}

          {/* 副标：品牌主从 —— 沙之书（诗名）/ 候鸟沙城 · 候鸟300（品牌） */}
          <div
            className="splash-fade font-display game-title"
            style={{ fontSize: 'clamp(18px,3vw,30px)', letterSpacing: '0.06em', animationDelay: '1.2s' }}
          >
            候鸟沙城
          </div>
          <div
            className="splash-fade mt-1"
            style={{
              fontFamily: serif,
              fontSize: 'clamp(11px,1.5vw,14px)',
              letterSpacing: '0.3em',
              color: '#caa979',
              animationDelay: '1.35s',
            }}
          >
            候鸟300 · 孤独图书馆向北 200 米
          </div>

          <div className="splash-rule" style={{ animationDelay: '1.5s' }} />

          {/* 箴言：候鸟300 自己的话 */}
          <p
            className="splash-fade max-w-[min(82vw,560px)]"
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
            一座城市，从沙滩上长出来。
            <br />
            沙城会消失，记忆却会迁徙到下一片土地。
          </p>

          {/* 登记表单 */}
          <div className="splash-fade mt-9 w-full max-w-md" style={{ animationDelay: '2.3s' }}>
            <Onboarding userId={userId} onDone={onDone} />
          </div>
        </div>
      </div>
    </div>
  );
}
