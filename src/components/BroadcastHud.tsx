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

// 广播（全城 AI 发言）与通知（个人提醒/传话/角色回应）合并后的统一动态项。
type FeedItem =
  | { kind: 'broadcast'; id: string; t: number; author: string; authorName: string; text: string }
  | {
      kind: 'notify';
      id: string;
      t: number;
      text: string;
      read: boolean;
      noteKind?: string; // 'user_said' | 'ai_reply' | 'artwork_*'
      actorName?: string;
      targetName?: string;
    };

type FeedFilter = 'all' | 'mine' | 'broadcast';
const FILTERS: { id: FeedFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'mine', label: '我的对话' },
  { id: 'broadcast', label: '广播' },
];

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
  const [filter, setFilter] = useState<FeedFilter>('all');
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
      items.push({
        kind: 'notify',
        id: n._id,
        t: n.createdAt,
        text: n.text,
        read: n.read,
        noteKind: n.kind,
        actorName: n.actorName,
        targetName: n.targetName,
      });
    items.sort((a, b) => a.t - b.t); // 正序：旧→新
    return items;
  }, [msgs, notes]);

  // 按筛选标签过滤：我的对话 = 通知流（传话/回应/系统通知）；广播 = 全城公开发言。
  const shown = useMemo(() => {
    if (filter === 'all') return feed;
    if (filter === 'broadcast') return feed.filter((it) => it.kind === 'broadcast');
    return feed.filter((it) => it.kind === 'notify');
  }, [feed, filter]);

  // 展开 / 切换筛选 / 新内容时滚到底部（最新）。
  useEffect(() => {
    if (expanded && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [expanded, filter, shown.length]);

  const preview = feed.slice(-1); // 折叠态显示最新一条

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
            <span className="grid h-3.5 min-w-3.5 shrink-0 place-items-center rounded-full bg-clay-600 px-1 text-[9px] font-bold leading-none text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
          <ChevronIcon className={clsx('shrink-0', expanded && 'ml-auto')} expanded={expanded} />
        </button>

        {expanded && (
          <>
            <div className="flex shrink-0 gap-1 border-t border-brown-700/50 px-2.5 py-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={clsx(
                    'rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
                    filter === f.id
                      ? 'bg-clay-600 text-white'
                      : 'text-brown-200/55 hover:bg-brown-700/40 hover:text-brown-200/80',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div
              ref={scrollRef}
              className="max-h-[56vh] min-h-0 overflow-y-auto border-t border-brown-700/40 px-2.5 py-2"
            >
              {shown.length ? (
                <div className="space-y-0.5">
                  {shown.map((it) => (
                    <FeedRow key={it.kind + it.id} it={it} onSelectAgent={onSelectAgent} />
                  ))}
                </div>
              ) : (
                <p className="px-1 py-4 text-center text-[11px] leading-relaxed text-brown-200/50">
                  {filter === 'broadcast'
                    ? '还没有居民公开发言。'
                    : filter === 'mine'
                      ? '还没有你的对话。向沙城传话，或 @ 一位居民开聊。'
                      : '还没有动态。'}
                </p>
              )}
            </div>
          </>
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
  if (it.noteKind === 'ai_reply') {
    return (
      <p className={clsx('truncate text-[11px] leading-snug', it.read ? 'text-brown-200/70' : 'text-amber-300')}>
        <span className="font-semibold">{it.actorName ?? '居民'}</span>
        <span className="opacity-60"> 回应：</span>
        {it.text}
      </p>
    );
  }
  if (it.noteKind === 'user_said') {
    return (
      <p className="truncate text-[11px] leading-snug text-brown-200/75">
        <span className="text-clay-300">你{it.targetName ? ` → @${it.targetName}` : ''}：</span>
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

// 单一卡片模板：广播/你的传话/角色回应/系统通知共用同一布局，仅靠头像色与标签区分。
function FeedRow({
  it,
  onSelectAgent,
}: {
  it: FeedItem;
  onSelectAgent: (id: GameId<'players'>) => void;
}) {
  let avatarText: string;
  let avatarBg: string;
  let name: string;
  let nameColor: string;
  let tag: string | undefined;
  let onAvatar: (() => void) | undefined;
  let unread = false;

  if (it.kind === 'broadcast') {
    const h = authorHue(it.author);
    avatarText = it.authorName.slice(0, 1);
    avatarBg = `hsl(${h} 45% 42%)`;
    name = it.authorName;
    nameColor = `hsl(${h} 55% 70%)`;
    onAvatar = () => onSelectAgent(it.author as GameId<'players'>);
  } else if (it.noteKind === 'ai_reply') {
    avatarText = (it.actorName ?? '居').slice(0, 1);
    avatarBg = 'hsl(35 58% 46%)';
    name = it.actorName ?? '居民';
    nameColor = '#f0c890';
    tag = '回应';
    unread = !it.read;
  } else if (it.noteKind === 'user_said') {
    avatarText = '你';
    avatarBg = 'var(--sand-clay)';
    name = '你';
    nameColor = '#e7b6a4';
    tag = it.targetName ? `@${it.targetName}` : undefined;
  } else {
    avatarText = '讯';
    avatarBg = '#6b5238';
    name = '通知';
    nameColor = '#cbb39a';
    unread = !it.read;
  }

  return (
    <div className={clsx('flex gap-2 rounded-md px-1.5 py-1.5', unread && 'bg-amber-400/[0.07]')}>
      <Avatar text={avatarText} bg={avatarBg} onClick={onAvatar} name={name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          {onAvatar ? (
            <button
              onClick={onAvatar}
              className="truncate text-[12px] font-semibold hover:underline"
              style={{ color: nameColor }}
            >
              {name}
            </button>
          ) : (
            <span className="truncate text-[12px] font-semibold" style={{ color: nameColor }}>
              {name}
            </span>
          )}
          {tag && (
            <span className="shrink-0 rounded bg-white/10 px-1 text-[9px] leading-[1.4] text-brown-200/70">
              {tag}
            </span>
          )}
          {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />}
          <span className="ml-auto shrink-0 text-[9px] text-brown-200/40">{timeAgo(it.t)}</span>
        </div>
        <p className="mt-0.5 line-clamp-6 break-words text-[12px] leading-snug text-brown-200/90">
          {it.text}
        </p>
      </div>
    </div>
  );
}

function Avatar({
  text,
  bg,
  onClick,
  name,
}: {
  text: string;
  bg: string;
  onClick?: () => void;
  name: string;
}) {
  const cls =
    'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white';
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={cls + ' transition hover:ring-2 hover:ring-white/30'}
        style={{ background: bg }}
        title={`查看 ${name}`}
      >
        {text}
      </button>
    );
  }
  return (
    <span className={cls} style={{ background: bg }}>
      {text}
    </span>
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
