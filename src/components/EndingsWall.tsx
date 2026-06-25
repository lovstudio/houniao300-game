import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Avatar } from '../lib/avatars';

// 公测实时结局墙：投屏大屏，直播真实玩家的 AIGC 连环画结局。
// 通过 ?wall=1 进入，useQuery 订阅，新结局自动上墙。无路由依赖。

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

export default function EndingsWall() {
  const data = useQuery(api.experience.wallFeed);
  // 让相对时间随墙刷新（每 30s 重渲染一次）。
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="min-h-screen w-full overflow-y-auto bg-brown-900 text-brown-100 font-body">
      {/* 节庆抬头 */}
      <header className="sticky top-0 z-10 border-b-2 border-brown-700 bg-brown-900/95 px-8 py-5 backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl tracking-wide text-brown-200 md:text-5xl">
              候鸟300 · 沙城连环画 · 公测实时
            </h1>
            <p className="mt-1 text-sm text-brown-300 md:text-base">
              6/26 – 6/27 公测窗口 · 每一个结局都是此刻真实玩家在沙城写下的独一无二的转身
            </p>
          </div>
          <div className="flex items-end gap-2">
            <span
              className="font-display text-6xl leading-none text-clay-100 md:text-7xl"
              style={{ textShadow: '0 0 24px rgba(228,166,114,0.45)' }}
            >
              {data ? data.total : '–'}
            </span>
            <span className="mb-1 text-sm text-brown-300 md:text-base">场结局已诞生</span>
          </div>
        </div>

        {/* 命名结局分布条 */}
        {data && data.distribution.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm md:text-base">
            {data.distribution.map((d) => (
              <span key={d.title} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-clay-300" aria-hidden />
                <span className="font-display text-clay-100">{d.count}</span>
                <span className="text-brown-300">人「{d.title}」</span>
              </span>
            ))}
          </div>
        )}
      </header>

      {/* 加载态 */}
      {data === undefined && (
        <div className="flex h-[60vh] items-center justify-center text-brown-300">正在连接沙城…</div>
      )}

      {/* 空态 */}
      {data && data.items.length === 0 && (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <p className="font-display text-2xl text-brown-200">公测窗口刚刚开启</p>
          <p className="text-brown-300">第一个走完结局的候鸟，马上就会出现在这面墙上。</p>
        </div>
      )}

      {/* 结局流 */}
      {data && data.items.length > 0 && (
        <div className="grid grid-cols-1 gap-5 p-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map((it) => (
            <article
              key={it._id}
              className="flex flex-col overflow-hidden border-2 border-brown-700 bg-brown-800 shadow-xl"
            >
              <div className="relative aspect-square w-full bg-brown-900">
                {it.imageUrl ? (
                  <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-brown-700">
                    <span className="font-display text-5xl">候鸟300</span>
                  </div>
                )}
                <span className="absolute right-2 top-2 rounded bg-brown-900/80 px-2 py-0.5 text-xs text-brown-200">
                  {relativeTime(it.awardedAt)}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h2 className="font-display text-xl text-clay-100">{it.title}</h2>
                <p className="text-sm italic leading-relaxed text-brown-200">「{it.reflection || it.summary}」</p>
                <div className="mt-auto flex items-center gap-2 pt-2">
                  <Avatar url={it.avatarUrl} preset={it.avatarPreset ?? undefined} size="sm" />
                  <span className="truncate text-sm text-brown-300">{it.userName}</span>
                  {it.eventTitle && (
                    <span className="ml-auto truncate text-xs text-brown-400">{it.eventTitle}</span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
