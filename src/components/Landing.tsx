import { useCallback, useEffect, useRef, useState } from 'react';
import Onboarding from './Onboarding.tsx';
import SandText, { type SandTextHandle } from './SandText.tsx';
import SandDrift from './SandDrift.tsx';

// 候鸟沙城 · 候鸟300 落地页 —— 两段式：
// ① 标题屏（极简 · 瑰伟，3A 大作感）：暖光雾中透出、全屏飘沙、巨大的沙粒「沙之书」+ 呼吸式「开始」。
// ② 点击开始 → 标题散成沙、淡出 → 双列登记浮现（左栏氛围，右栏表单），引导登记成为候鸟。

const MOMENTS = [
  '直播一小时，留下一面候鸟的旗帜',
  '花车与人群，走向海边的篝火',
  '纱之礼堂，为爱留下一纸证明',
  '一百五十小时，海边围坐烤羊',
  '《Token 在燃烧》，点亮整片夜晚',
  '白天一起运动，晚上一起看戏',
];

// 标题屏题词：拆两句逐行缓现缓隐（不标注出处）
const LYRIC = ['一代人终将老去', '但总有人正年轻'];

const INK = '#2c2620';
const INK_SOFT = '#7a7063';
const serif = '"Noto Serif SC","Songti SC",serif';

export default function Landing({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [phase, setPhase] = useState<'title' | 'enter'>('title');
  const [leaving, setLeaving] = useState(false);
  const [moment, setMoment] = useState(0);
  const [lyric, setLyric] = useState(0);
  const titleRef = useRef<SandTextHandle>(null);
  const lyricRef = useRef<SandTextHandle>(null);

  useEffect(() => {
    const id = window.setInterval(() => setMoment((m) => (m + 1) % MOMENTS.length), 3600);
    return () => window.clearInterval(id);
  }, []);

  // 题词逐行缓现缓隐：停留后散去，再凝下一句，循环（仅标题屏）
  useEffect(() => {
    if (phase !== 'title') return;
    const id = window.setInterval(() => {
      lyricRef.current?.scatter();
      window.setTimeout(() => setLyric((p) => (p + 1) % LYRIC.length), 650);
    }, 4200);
    return () => window.clearInterval(id);
  }, [phase]);

  const start = useCallback(() => {
    setLeaving((l) => {
      if (l) return l;
      titleRef.current?.scatter();
      window.setTimeout(() => setPhase('enter'), 720);
      return true;
    });
  }, []);

  useEffect(() => {
    if (phase !== 'title') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, start]);

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        color: INK,
        background: 'radial-gradient(120% 80% at 50% 4%, #f8f4ec 0%, #efe9dc 52%, #e4dccb 100%)',
      }}
    >
      {/* 氛围飘沙 */}
      <SandDrift className="pointer-events-none absolute inset-0" />

      {/* 暖光晕（呼吸） */}
      <div
        className="landing-bloom pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(58% 42% at 50% 26%, rgba(255,238,208,0.6) 0%, rgba(255,238,208,0) 70%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* 纸纹颗粒 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.45,
          mixBlendMode: 'multiply',
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")",
        }}
      />

      {/* 暖色暗角（电影感纵深） */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 100% at 50% 44%, transparent 50%, rgba(48,30,16,0.26) 100%)',
        }}
      />

      {phase === 'title' ? (
        /* ── ① 标题屏 ── */
        <div
          className="absolute inset-0 flex flex-col items-center px-8 text-center transition-opacity duration-700 ease-out"
          style={{ opacity: leaving ? 0 : 1, paddingTop: 'clamp(11vh,15vh,19vh)' }}
        >
          <h1 className="sr-only">沙之书 · 候鸟沙城</h1>
          <SandText
            ref={titleRef}
            text="沙之书"
            tracking={0.16}
            settleMs={2600}
            className="h-[clamp(160px,34vh,380px)] w-[min(92vw,760px)]"
          />

          {/* CTA：单行「开启旅程」，活版墨字 + 朱砂下划线，居视觉中心 */}
          <div
            className="splash-fade mt-[clamp(26px,6vh,56px)]"
            style={{ animationDelay: '2.6s' }}
          >
            <button
              type="button"
              onClick={start}
              className="landing-enter w-fit"
              style={{
                fontFamily: serif,
                fontWeight: 500,
                fontSize: 'clamp(16px,2vw,19px)',
                letterSpacing: '0.5em',
                textIndent: '0.5em',
                color: INK,
              }}
            >
              开 启 旅 程
            </button>
          </div>

          {/* 题词 footer：底部居中，朱砂点呼应上方 CTA，沙中逐行缓现缓隐 */}
          <div
            className="splash-fade absolute inset-x-0 bottom-[max(9vh,52px)] flex flex-col items-center"
            style={{ animationDelay: '2.4s' }}
          >
            <span
              className="mb-3 block h-[5px] w-[5px] rounded-full"
              style={{ background: '#b0563a', opacity: 0.7 }}
            />
            <SandText
              ref={lyricRef}
              text={LYRIC[lyric]}
              weight={600}
              fontScale={0.82}
              tracking={0.18}
              settleMs={1100}
              color="#574f43"
              className="h-[40px] w-[320px]"
            />
          </div>
        </div>
      ) : (
        /* ── ② 双列登记 ── */
        <div className="landing-rise relative z-10 h-full overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-[1080px] flex-col items-stretch gap-y-2 px-8 py-10 lg:flex-row lg:items-center lg:gap-x-16 lg:py-0">
            {/* 左栏：氛围 */}
            <section className="flex flex-col items-center text-center lg:w-1/2 lg:items-start lg:py-16 lg:text-left">
              <div>
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

              <SandText
                text="沙之书"
                tracking={0.14}
                className="mx-auto my-4 h-[clamp(140px,22vh,230px)] w-full max-w-[460px] lg:mx-0"
              />

              <div
                style={{
                  fontFamily: serif,
                  fontWeight: 500,
                  fontSize: 'clamp(15px,2.2vw,20px)',
                  letterSpacing: '0.34em',
                  textIndent: '0.34em',
                  color: INK,
                }}
              >
                候鸟沙城
              </div>
              <div
                className="mt-2"
                style={{
                  fontFamily: serif,
                  fontSize: 'clamp(10px,1.3vw,12px)',
                  letterSpacing: '0.28em',
                  color: INK_SOFT,
                }}
              >
                候鸟300 · 孤独图书馆向北 200 米
              </div>

              <div
                className="splash-rule lg:mx-0"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(44,38,32,0.28), transparent)',
                  animation: 'none',
                  width: 'min(46vw,300px)',
                  opacity: 0.7,
                }}
              />

              <p
                className="max-w-[420px]"
                style={{
                  fontFamily: serif,
                  fontWeight: 300,
                  fontSize: 'clamp(14px,1.8vw,17px)',
                  lineHeight: 2.1,
                  color: INK,
                  opacity: 0.86,
                  letterSpacing: '0.03em',
                }}
              >
                一座城市，从沙滩上长出来。
                <br />
                沙城会消失，记忆却会迁徙到下一片土地。
              </p>
            </section>

            {/* 右栏：登记表单 */}
            <section
              className="flex items-center justify-center lg:w-1/2 lg:border-l lg:py-16 lg:pl-16"
              style={{ borderColor: 'rgba(44,38,32,0.14)' }}
            >
              <Onboarding userId={userId} onDone={onDone} />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
