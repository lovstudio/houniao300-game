import { useEffect, useMemo, useRef, useState } from 'react';
import Onboarding from './Onboarding.tsx';

// 候鸟沙城 · 候鸟300 落地页 —— 孤独图书馆式文学极简：
// 暖雾纸底、炭墨衰线、大量留白；沙粒如纸上墨尘，被风扬起、凝成「沙之书」，鼠标可拨。
// 一座从沙滩上长出来、只存在 300 小时、会消失会迁徙的城——登记成为候鸟，即可进入。

const MOMENTS = [
  '直播一小时，留下一面候鸟的旗帜',
  '花车与人群，走向海边的篝火',
  '纱之礼堂，为爱留下一纸证明',
  '一百五十小时，海边围坐烤羊',
  '《Token 在燃烧》，点亮整片夜晚',
  '白天一起运动，晚上一起看戏',
];

// 文学极简色板（暖雾纸 / 炭墨 / 陶土）
const INK = '#2c2620';
const INK_SOFT = '#7a7063';
const TERRA = '#b0563a';

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

  useEffect(() => {
    const id = window.setInterval(() => setMoment((m) => (m + 1) % MOMENTS.length), 3600);
    return () => window.clearInterval(id);
  }, []);

  // 墨尘动画：扬起 → 凝成「沙之书」→ 落定后可拨
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

      const fontSize = Math.min(W * 0.3, H * 0.22, 210);
      const titleCenterY = H * 0.2;
      octx.fillStyle = '#fff';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.font = `900 ${fontSize}px "Noto Serif SC","Songti SC",serif`;

      const txt = '沙之书';
      const tracking = fontSize * 0.12;
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
          r: Math.random() * 1.4 + 0.7,
          // 纸上墨尘：炭墨深浅不一
          col: `hsl(34, ${10 + Math.random() * 12}%, ${16 + Math.random() * 16}%)`,
          spark: Math.random() < 0.05,
          delay: 0,
        };
        g.tx = t.x;
        g.ty = t.y;
        g.delay = (t.x / W) * 520 + Math.random() * 260;
        return g;
      });

      if (!drift.length) {
        const n = Math.round((W * H) / 30000);
        for (let i = 0; i < n; i++) {
          drift.push({
            x: Math.random() * W,
            y: Math.random() * H,
            r: Math.random() * 1.0 + 0.3,
            vx: (Math.random() - 0.5) * 0.16,
            vy: -(Math.random() * 0.2 + 0.04),
            a: Math.random() * 0.14 + 0.03,
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

      // 氛围浮尘（极淡）
      ctx.fillStyle = '#6b6052';
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
            p.vx += (Math.random() - 0.5) * 0.09;
            p.vy += (Math.random() - 0.5) * 0.09;
          }
          p.x += p.vx;
          p.y += p.vy;
        }

        let alpha = 1;
        if (t < p.delay) alpha = 0;
        else if (mode === 'forming') alpha = Math.min(1, (t - p.delay) / 700);

        ctx.globalAlpha = alpha * 0.92;
        ctx.fillStyle = p.spark ? TERRA : p.col;
        ctx.fillRect(p.x, p.y, p.r, p.r);
      }
      ctx.globalAlpha = 1;

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
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        color: INK,
        // 暖雾纸：上方微亮（海与天的光），向下沉为沙白
        background:
          'radial-gradient(120% 75% at 50% -8%, #f7f3ea 0%, #efe9dc 50%, #e6decd 100%)',
      }}
    >
      {/* 极淡纸纹颗粒 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.5,
          mixBlendMode: 'multiply',
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")",
        }}
      />

      {/* 墨尘画布（视口固定，标题约 20% 屏高，可拨） */}
      {!reduce && <canvas ref={canvasRef} className="absolute inset-0" />}

      {/* 内容滚动层 */}
      <div className="relative z-10 h-full overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-[560px] flex-col items-center px-8 pb-16 pt-7 text-center">
          {/* 顶部：候鸟300 · 正在发生 + 现场瞬间 */}
          <div className="splash-fade" style={{ animationDelay: '0.2s' }}>
            <div
              style={{
                fontFamily: serif,
                letterSpacing: '0.42em',
                fontSize: 'clamp(10px,1.3vw,12px)',
                color: INK_SOFT,
              }}
            >
              候鸟300 · 正在发生
            </div>
            <div
              key={moment}
              className="landing-moment mt-1.5"
              style={{
                fontFamily: serif,
                fontStyle: 'italic',
                fontSize: 'clamp(11px,1.4vw,13px)',
                color: INK_SOFT,
                opacity: 0.78,
                letterSpacing: '0.03em',
              }}
            >
              {MOMENTS[moment]}
            </div>
          </div>

          {/* 标题区：墨尘在 canvas 上绘制；reduced-motion 用 DOM 标题兜底 */}
          <h1 className="sr-only">沙之书 · 候鸟沙城</h1>
          {reduce ? (
            <div
              className="mt-[10vh]"
              style={{
                fontFamily: serif,
                fontWeight: 900,
                color: INK,
                fontSize: 'clamp(64px,17vw,190px)',
                lineHeight: 1,
                letterSpacing: '0.12em',
              }}
            >
              沙之书
            </div>
          ) : (
            <div style={{ height: 'clamp(196px,31vh,290px)' }} />
          )}

          {/* 品牌副线：候鸟沙城 · 候鸟300 / 选址 */}
          <div
            className="splash-fade"
            style={{
              fontFamily: serif,
              fontWeight: 500,
              fontSize: 'clamp(15px,2.2vw,20px)',
              letterSpacing: '0.34em',
              textIndent: '0.34em',
              color: INK,
              animationDelay: '1.2s',
            }}
          >
            候鸟沙城
          </div>
          <div
            className="splash-fade mt-2"
            style={{
              fontFamily: serif,
              fontSize: 'clamp(10px,1.3vw,12px)',
              letterSpacing: '0.28em',
              color: INK_SOFT,
              animationDelay: '1.35s',
            }}
          >
            候鸟300 · 孤独图书馆向北 200 米
          </div>

          <div
            className="splash-rule"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(44,38,32,0.28), transparent)',
              animationDelay: '1.5s',
            }}
          />

          {/* 箴言：候鸟300 自己的话 */}
          <p
            className="splash-fade max-w-[440px]"
            style={{
              fontFamily: serif,
              fontWeight: 300,
              fontSize: 'clamp(14px,1.8vw,17px)',
              lineHeight: 2.1,
              color: INK,
              opacity: 0.86,
              letterSpacing: '0.03em',
              animationDelay: '1.9s',
            }}
          >
            一座城市，从沙滩上长出来。
            <br />
            沙城会消失，记忆却会迁徙到下一片土地。
          </p>

          {/* 登记表单 */}
          <div className="splash-fade mt-12 w-full" style={{ animationDelay: '2.3s' }}>
            <Onboarding userId={userId} onDone={onDone} />
          </div>
        </div>
      </div>
    </div>
  );
}
