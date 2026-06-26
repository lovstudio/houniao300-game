import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { QRCodeSVG } from 'qrcode.react';
import { ToastContainer, toast } from 'react-toastify';
import { api } from '../../convex/_generated/api';
import { Avatar } from '../lib/avatars';
import type { Id } from '../../convex/_generated/dataModel';
import { downloadComicPoster } from './ComicPoster';

// 公测实时结局墙：投屏大屏，直播真实玩家的 AIGC 连环画结局。
// 通过 ?wall=1 进入，useQuery 订阅，新结局自动上墙。无路由依赖。
// 卡片可点开 → 完整连环画灯箱；常驻「开始」CTA + 扫码二维码把围观者转化为玩家。

// 直播站点根地址（用于扫码加入与 CTA 跳转），与部署域名一致。
const SITE_ROOT = 'https://houniao300-game.vercel.app';

// 沙城暖色母题（与 ComicPoster 一致）。
const SAND = '#EAD4AA';
const INK = '#181425';

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

// 跳到 app 根（剥掉 ?wall），让新用户进入正常 onboarding→小镇→节目单 流程。
function goStart() {
  window.location.href = '/';
}

// ============================================================
// 完整连环画灯箱：只读展示一位玩家的全部分镜 + 结局 + 题词。
// ============================================================
function ComicLightbox({
  experienceId,
  onClose,
}: {
  experienceId: Id<'experiences'>;
  onClose: () => void;
}) {
  const comic = useQuery(api.experience.experienceComic, { experienceId });
  const [downloading, setDownloading] = useState(false);

  // 本篇连环画的永久链接：扫码 / 转发 / 复制都指向它，直接打开这条连环画灯箱。
  const permalink = `${window.location.origin}/?comic=${experienceId}`;

  // Esc 关闭。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const playSame = () => {
    if (comic?.activityKey) {
      window.location.href = `/?exp=${encodeURIComponent(comic.activityKey)}`;
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(permalink);
      toast.success('链接已复制');
    } catch {
      toast.error('复制失败，请手动长按链接');
    }
  };

  const downloadImage = async () => {
    if (!comic || !comic.activityKey) return;
    setDownloading(true);
    try {
      await downloadComicPoster({
        title: comic.eventTitle,
        userName: comic.userName,
        venue: comic.venue ?? undefined,
        activityKey: comic.activityKey,
        badgeTitle: comic.badgeTitle ?? undefined,
        badgeSummary: comic.badgeSummary ?? undefined,
        reflection: comic.reflection ?? undefined,
        panels: comic.panels.map((p) => ({ imageUrl: p.imageUrl, narration: p.narration })),
      });
    } catch (e) {
      console.error('长图导出失败', e);
      toast.error('长图导出失败，可直接截图保存');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/85 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden border-2 border-brown-700 bg-brown-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶栏 */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b-2 border-brown-700 bg-brown-900/95 px-4 py-3 backdrop-blur">
          <span className="font-display text-lg text-brown-100">完整连环画</span>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="rounded border-2 border-brown-700 px-3 py-1 text-sm text-brown-100 hover:border-clay-500"
          >
            关闭
          </button>
        </div>

        <div className="px-4 py-4">
          {/* 加载态 */}
          {comic === undefined && (
            <div className="flex h-48 items-center justify-center text-brown-300">正在翻开这段连环画…</div>
          )}

          {/* 空/失效态：链接失效或连环画不存在，给出友好提示 + 开始 CTA */}
          {comic === null && (
            <div className="flex h-56 flex-col items-center justify-center gap-3 text-center">
              <p className="font-display text-xl text-brown-200">没找到这条连环画</p>
              <p className="text-sm text-brown-300">它可能已被移除，或链接不正确。</p>
              <button
                onClick={goStart}
                className="mt-1 rounded bg-clay-700 px-5 py-2.5 font-display text-base text-white hover:bg-clay-500"
              >
                开始我的连环画 →
              </button>
            </div>
          )}

          {comic && (
            <>
              {/* 分镜（按序：图 + 旁白） */}
              <div className="flex flex-col gap-4">
                {comic.panels.map((p) => (
                  <div key={p.index} className="overflow-hidden border-2 border-brown-700 bg-brown-800">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="block w-full" />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center text-brown-700">
                        <span className="font-display text-4xl">候鸟300</span>
                      </div>
                    )}
                    <p className="px-3 py-2.5 text-sm leading-relaxed text-brown-100">
                      <span className="mr-1 font-display text-clay-300">{String(p.index + 1).padStart(2, '0')}</span>
                      {p.narration}
                    </p>
                  </div>
                ))}
                {comic.panels.length === 0 && (
                  <div className="py-8 text-center text-brown-300">这段连环画还没有画面。</div>
                )}
              </div>

              {/* 结局名 + 题词 */}
              {comic.badgeTitle && (
                <div className="mt-5 border-2 border-clay-700 bg-brown-800 px-5 py-5 text-center">
                  <p className="font-display text-xl text-clay-100">结局 · {comic.badgeTitle}</p>
                  {(comic.reflection || comic.badgeSummary) && (
                    <p className="mt-2 text-base italic leading-relaxed text-brown-200">
                      「{comic.reflection || comic.badgeSummary}」
                    </p>
                  )}
                </div>
              )}

              {/* 玩家 + 活动 */}
              <div className="mt-4 flex items-center gap-2">
                <Avatar url={comic.avatarUrl} preset={comic.avatarPreset ?? undefined} size="sm" />
                <span className="truncate text-sm text-brown-200">{comic.userName}</span>
                {comic.eventTitle && (
                  <span className="ml-auto truncate text-xs text-brown-400">{comic.eventTitle}</span>
                )}
              </div>

              {/* 一体化分享区：扫码看本篇 + 复制链接 + 下载长图 + 玩同款 */}
              <div className="mt-5 border-2 border-clay-700 bg-brown-900 px-5 py-5">
                {/* 扫码看本篇：二维码编码本篇永久链接，扫码即打开这条连环画 */}
                <div className="flex items-center gap-4">
                  <div className="shrink-0 rounded p-2" style={{ background: SAND }}>
                    <QRCodeSVG value={permalink} size={96} fgColor={INK} bgColor={SAND} level="M" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-base text-clay-100">扫码或转发，让朋友看到这条连环画</p>
                    <p className="mt-1 text-sm leading-relaxed text-brown-300">
                      手机扫一扫，或复制链接发给朋友，直接打开这一篇
                    </p>
                  </div>
                </div>

                {/* 分享本篇：复制链接 + 下载长图 */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => void copyLink()}
                    className="rounded border-2 border-clay-700 px-4 py-2.5 font-display text-base text-clay-100 hover:border-clay-500 hover:text-white"
                  >
                    复制链接
                  </button>
                  {comic.panels.length > 0 && (
                    <button
                      onClick={() => void downloadImage()}
                      disabled={downloading}
                      className="rounded border-2 border-clay-700 px-4 py-2.5 font-display text-base text-clay-100 hover:border-clay-500 hover:text-white disabled:opacity-50"
                    >
                      {downloading ? '生成中…' : '下载长图'}
                    </button>
                  )}
                </div>
              </div>

              {/* 玩同款活动深链：开启属于自己的全新一篇（区别于分享本篇） */}
              {comic.activityKey && (
                <button
                  onClick={playSame}
                  className="mt-3 w-full rounded bg-clay-700 px-4 py-2.5 font-display text-base text-white hover:bg-clay-500"
                >
                  玩同款活动 →
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

// ============================================================
// 扫码加入卡（固定角落）。
// ============================================================
function JoinQR() {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-20 hidden sm:block">
      <div className="pointer-events-auto flex items-center gap-3 border-2 border-brown-700 bg-brown-900/95 p-3 shadow-2xl backdrop-blur">
        <div className="shrink-0 overflow-hidden rounded" style={{ background: SAND, padding: 5 }}>
          <QRCodeSVG value={SITE_ROOT} size={84} fgColor={INK} bgColor={SAND} level="M" />
        </div>
        <div className="max-w-[9rem]">
          <p className="font-display text-sm text-clay-100">扫码加入</p>
          <p className="mt-0.5 text-xs leading-snug text-brown-300">写下你自己的结局</p>
        </div>
      </div>
    </div>
  );
}

export default function EndingsWall({ initialComicId }: { initialComicId?: Id<'experiences'> | null } = {}) {
  const data = useQuery(api.experience.wallFeed);
  // 让相对时间随墙刷新（每 30s 重渲染一次）。
  const [, force] = useState(0);
  // 永久链接 ?comic=<id> 落地时直接打开该篇灯箱。
  const [openId, setOpenId] = useState<Id<'experiences'> | null>(initialComicId ?? null);
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
          <div className="flex items-end gap-4">
            <div className="flex items-end gap-2">
              <span
                className="font-display text-6xl leading-none text-clay-100 md:text-7xl"
                style={{ textShadow: '0 0 24px rgba(228,166,114,0.45)' }}
              >
                {data ? data.total : '–'}
              </span>
              <span className="mb-1 text-sm text-brown-300 md:text-base">场结局已诞生</span>
            </div>
            <button
              onClick={goStart}
              className="mb-1 rounded bg-clay-700 px-4 py-2.5 font-display text-base text-white shadow-lg hover:bg-clay-500 md:text-lg"
            >
              开始我的连环画 →
            </button>
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
          <button
            onClick={goStart}
            className="mt-2 rounded bg-clay-700 px-5 py-2.5 font-display text-base text-white hover:bg-clay-500"
          >
            开始我的连环画 →
          </button>
        </div>
      )}

      {/* 结局流 */}
      {data && data.items.length > 0 && (
        <div className="grid grid-cols-1 gap-5 p-8 pb-32 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map((it) => (
            <button
              key={it._id}
              type="button"
              onClick={() => setOpenId(it.experienceId)}
              className="group flex flex-col overflow-hidden border-2 border-brown-700 bg-brown-800 text-left shadow-xl transition hover:border-clay-500 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-clay-500"
            >
              <div className="relative aspect-square w-full bg-brown-900">
                {it.imageUrl ? (
                  <img
                    src={it.imageUrl}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-brown-700">
                    <span className="font-display text-5xl">候鸟300</span>
                  </div>
                )}
                <span className="absolute right-2 top-2 rounded bg-brown-900/80 px-2 py-0.5 text-xs text-brown-200">
                  {relativeTime(it.awardedAt)}
                </span>
                <span className="absolute bottom-2 left-2 rounded bg-brown-900/80 px-2 py-0.5 text-xs text-clay-100 opacity-0 transition group-hover:opacity-100">
                  点开看完整连环画 →
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
            </button>
          ))}
        </div>
      )}

      {/* 固定角落：扫码加入 */}
      <JoinQR />

      {/* 灯箱 */}
      {openId && <ComicLightbox experienceId={openId} onClose={() => setOpenId(null)} />}

      {/* 分享反馈（复制链接等）：墙视图独立挂载，置于灯箱之上 */}
      <ToastContainer position="bottom-center" autoClose={2000} closeOnClick theme="dark" style={{ zIndex: 90 }} />
    </main>
  );
}
