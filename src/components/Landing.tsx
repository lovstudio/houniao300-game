import { useEffect, useState } from 'react';
import Onboarding from './Onboarding.tsx';
import SandText from './SandText.tsx';

// 候鸟沙城 · 候鸟300 落地页 —— 孤独图书馆式文学极简，双列布局：
// 左栏氛围（沙粒「沙之书」+ 品牌 + 箴言），右栏登记表单；中间细线分隔，移动端回落为上下堆叠。
// 一座从沙滩上长出来、只存在 300 小时、会消失会迁徙的城——登记成为候鸟，即可进入。

const MOMENTS = [
  '直播一小时，留下一面候鸟的旗帜',
  '花车与人群，走向海边的篝火',
  '纱之礼堂，为爱留下一纸证明',
  '一百五十小时，海边围坐烤羊',
  '《Token 在燃烧》，点亮整片夜晚',
  '白天一起运动，晚上一起看戏',
];

const INK = '#2c2620';
const INK_SOFT = '#7a7063';
const serif = '"Noto Serif SC","Songti SC",serif';

export default function Landing({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [moment, setMoment] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setMoment((m) => (m + 1) % MOMENTS.length), 3600);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        color: INK,
        background: 'radial-gradient(120% 75% at 50% -8%, #f7f3ea 0%, #efe9dc 50%, #e6decd 100%)',
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

      <div className="relative z-10 h-full overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-[1080px] flex-col items-stretch gap-y-2 px-8 py-10 lg:flex-row lg:items-center lg:gap-x-16 lg:py-0">
          {/* 左栏：氛围 */}
          <section className="flex flex-col items-center text-center lg:w-1/2 lg:items-start lg:py-16 lg:text-left">
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

            {/* 标题：沙粒「沙之书」 */}
            <h1 className="sr-only">沙之书 · 候鸟沙城</h1>
            <SandText
              text="沙之书"
              tracking={0.14}
              className="mx-auto my-4 h-[clamp(150px,24vh,250px)] w-full max-w-[460px] lg:mx-0"
            />

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
              className="splash-rule lg:mx-0"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(44,38,32,0.28), transparent)',
                animationDelay: '1.5s',
              }}
            />

            <p
              className="splash-fade max-w-[420px]"
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
          </section>

          {/* 右栏：登记表单（桌面端左侧细线分隔） */}
          <section
            className="splash-fade flex items-center justify-center lg:w-1/2 lg:border-l lg:py-16 lg:pl-16"
            style={{ borderColor: 'rgba(44,38,32,0.14)', animationDelay: '2.2s' }}
          >
            <Onboarding userId={userId} onDone={onDone} />
          </section>
        </div>
      </div>
    </div>
  );
}
