import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { GameId } from '../../convex/aiTown/ids';

function authorHue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}
function timeAgo(t: number) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return '刚刚';
  if (s < 3600) return `${Math.floor(s / 60)}分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)}小时前`;
  return `${Math.floor(s / 86400)}天前`;
}

// 广播（全城 AI 发言）与通知（个人提醒）合并后的统一动态项。
type FeedItem =
  | { kind: 'broadcast'; id: string; t: number; author: string; authorName: string; text: string }
  | { kind: 'notify'; id: string; t: number; text: string; read: boolean };

// 主视觉右上角的「动态」浮层：广播 + 通知合一。
// 默认折叠显示最近 1-3 行，点击展开为可滚动面板。
export default function BroadcastHud({
  worldId,
  userId,
  onSelectAgent,
}: {
  worldId: Id<'worlds'>;
  userId: string;
  onSelectAgent: (id: GameId<'players'>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const msgs = useQuery(api.messages.listRecentMessages, { worldId, limit: 80 });
  const notes = useQuery(api.notifications.listMine, { userId });
  const unread = useQuery(api.notifications.unreadCount, { userId }) ?? 0;
  const markAllRead = useMutation(api.notifications.markAllRead);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 展开时把通知标记已读。
  useEffect(() => {
    if (expanded && unread > 0) void markAllRead({ userId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, unread]);

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    for (const m of msgs ?? [])
      items.push({ kind: 'broadcast', id: m.id, t: m.t, author: m.author, authorName: m.authorName, text: m.text });
    for (const n of notes ?? [])
      items.push({ kind: 'notify', id: n._id, t: n.createdAt, text: n.text, read: n.read });
    items.sort((a, b) => b.t - a.t);
    return items;
  }, [msgs, notes]);

  // 展开后滚到顶部（最新）。
  useEffect(() => {
    if (expanded && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [expanded]);

  const preview = feed.slice(0, 1);

  return (
    <div className="pointer-events-auto absolute right-2 top-2 z-30 w-60 select-none text-brown-200 sm:w-72">
      <div
        className="overflow-hidden rounded-md border border-brown-700 shadow-xl"
        style={{ background: 'rgba(28,20,18,0.96)' }}
      >
        {/* 折叠态：标题与最新一条合并为一行；展开态：仅标题 */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left transition-colors hover:bg-brown-700/40"
          title="广播 · 通知"
        >
          <BellIcon />
          {expanded ? (
            <span className="text-[11px] font-semibold leading-none tracking-wide">通知系统</span>
          ) : (
            <span className="min-w-0 flex-1">
              {preview.length ? (
                <PreviewLine it={preview[0]} />
              ) : (
                <span className="text-[11px] leading-snug text-brown-200/50">暂无动态</span>
              )}
            </span>
          )}
          {unread > 0 && (
            <span className="grid h-3.5 min-w-3.5 shrink-0 place-items-center rounded-full bg-clay-600 px-0.5 text-[9px] font-bold leading-none text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
          <ChevronIcon className={clsx('shrink-0', expanded && 'ml-auto')} expanded={expanded} />
        </button>

        {expanded && (
          <div
            ref={scrollRef}
            className="max-h-[60vh] min-h-0 overflow-y-auto border-t border-brown-700/50 px-2.5 py-2"
          >
            {feed.length ? (
              <div className="space-y-2">
                {feed.map((it) =>
                  it.kind === 'broadcast' ? (
                    <BroadcastRow key={'b' + it.id} it={it} onSelectAgent={onSelectAgent} />
                  ) : (
                    <NotifyRow key={'n' + it.id} it={it} />
                  ),
                )}
              </div>
            ) : (
              <p className="px-1 py-4 text-center text-[11px] leading-relaxed text-brown-200/50">
                还没有动态。AI 居民的公开发言，以及别人来看你作品的提醒，都会出现在这里。
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewLine({ it }: { it: FeedItem }) {
  if (it.kind === 'broadcast') {
    const hue = authorHue(it.author);
    return (
      <p className="truncate text-[11px] leading-snug text-brown-200/85">
        <span className="font-semibold" style={{ color: `hsl(${hue} 55% 68%)` }}>
          {it.authorName}
        </span>
        <span className="text-brown-200/50">：</span>
        {it.text}
      </p>
    );
  }
  return (
    <p className={clsx('truncate text-[11px] leading-snug', it.read ? 'text-brown-200/60' : 'text-clay-300')}>
      <span className="mr-1 text-clay-400">●</span>
      {it.text}
    </p>
  );
}

function BroadcastRow({
  it,
  onSelectAgent,
}: {
  it: Extract<FeedItem, { kind: 'broadcast' }>;
  onSelectAgent: (id: GameId<'players'>) => void;
}) {
  const hue = authorHue(it.author);
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onSelectAgent(it.author as GameId<'players'>)}
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white transition hover:ring-2 hover:ring-white/30"
        style={{ background: `hsl(${hue} 45% 42%)` }}
        title={`查看 ${it.authorName}`}
      >
        {it.authorName.slice(0, 1)}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <button
            onClick={() => onSelectAgent(it.author as GameId<'players'>)}
            className="truncate text-[12px] font-semibold hover:underline"
            style={{ color: `hsl(${hue} 55% 70%)` }}
          >
            {it.authorName}
          </button>
          <span className="shrink-0 text-[9px] text-brown-200/40">{timeAgo(it.t)}</span>
        </div>
        <p className="mt-0.5 break-words text-[12px] leading-snug text-brown-200/90">{it.text}</p>
      </div>
    </div>
  );
}

function NotifyRow({ it }: { it: Extract<FeedItem, { kind: 'notify' }> }) {
  return (
    <div
      className={clsx(
        'rounded border px-2 py-1.5',
        it.read ? 'border-brown-700/50 bg-brown-800/40' : 'border-clay-600/50 bg-clay-900/20',
      )}
    >
      <div className="flex items-baseline gap-1.5">
        <span className={clsx('shrink-0 text-[10px]', it.read ? 'text-brown-200/40' : 'text-clay-400')}>通知</span>
        <span className="shrink-0 text-[9px] text-brown-200/40">{timeAgo(it.t)}</span>
      </div>
      <p className="mt-0.5 break-words text-[12px] leading-snug text-brown-200/90">{it.text}</p>
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function ChevronIcon({ expanded, className }: { expanded: boolean; className?: string }) {
  return (
    <svg
      className={clsx('transition-transform', expanded && 'rotate-180', className)}
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
