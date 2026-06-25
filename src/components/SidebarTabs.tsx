import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import PlayerDetails from './PlayerDetails';
import { GameId } from '../../convex/aiTown/ids';
import { ServerGame } from '../hooks/serverGame';
import { SelectElement } from './Player';
import { SCHEDULE, VENUE_COORDS, CATEGORY_COLORS, DATES, type SchedItem } from '../../data/schedule';
import { focusMapVenue } from '../lib/mapFocus';
import { toast } from 'react-toastify';

type Tab = 'agent' | 'chat' | 'schedule' | 'state';

const TABS: { id: Tab; label: string }[] = [
  { id: 'agent', label: '角色' },
  { id: 'chat', label: '全局对话' },
  { id: 'schedule', label: '节目单' },
  { id: 'state', label: '状态' },
];

const TODAY_DAY = (() => {
  const n = new Date();
  return n.getMonth() === 5 ? String(n.getDate()) : '';
})();

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

export default function SidebarTabs({
  worldId,
  engineId,
  game,
  playerId,
  setSelectedElement,
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  game: ServerGame;
  playerId?: GameId<'players'>;
  setSelectedElement: SelectElement;
}) {
  const [tab, setTab] = useState<Tab>('agent');
  const agentScrollRef = useRef<HTMLDivElement>(null);

  // jump to the agent tab whenever a character is selected on the map
  useEffect(() => {
    if (playerId) setTab('agent');
  }, [playerId]);

  return (
    <div className="flex min-h-0 w-full flex-col">
      {/* tab bar */}
      <div className="flex shrink-0 gap-1 border-b-4 border-brown-900 bg-brown-800/95 px-2 pt-2">
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                'relative -mb-1 rounded-t-md px-3 py-1.5 font-display text-lg leading-none tracking-wide transition ' +
                (on
                  ? 'bg-clay-700 text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.18)]'
                  : 'bg-brown-900/40 text-brown-200 hover:bg-brown-700/60')
              }
            >
              {t.label}
              {t.id === 'chat' && <ChatDot worldId={worldId} />}
            </button>
          );
        })}
      </div>

      {/* tab content */}
      <div className="min-h-0 flex-1">
        {tab === 'agent' && (
          <div ref={agentScrollRef} className="h-full overflow-y-auto px-4 py-5 sm:px-6">
            <PlayerDetails
              worldId={worldId}
              engineId={engineId}
              game={game}
              playerId={playerId}
              setSelectedElement={setSelectedElement}
              scrollViewRef={agentScrollRef}
            />
          </div>
        )}
        {tab === 'chat' && (
          <GlobalChat
            worldId={worldId}
            onSelectAgent={(id) => setSelectedElement({ kind: 'player', id })}
          />
        )}
        {tab === 'schedule' && <ScheduleTab />}
        {tab === 'state' && <StateTab game={game} />}
      </div>
    </div>
  );
}

function ChatDot({ worldId }: { worldId: Id<'worlds'> }) {
  const msgs = useQuery(api.messages.listRecentMessages, { worldId, limit: 1 });
  const fresh = msgs?.[0] && Date.now() - msgs[0].t < 60_000;
  if (!fresh) return null;
  return <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-[#e4b58c]" />;
}

function GlobalChat({
  worldId,
  onSelectAgent,
}: {
  worldId: Id<'worlds'>;
  onSelectAgent: (id: GameId<'players'>) => void;
}) {
  const msgs = useQuery(api.messages.listRecentMessages, { worldId, limit: 80 });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs?.length]);

  if (!msgs) return <Centered>正在接入对话流…</Centered>;
  if (!msgs.length)
    return <Centered>沙城刚刚醒来，居民们还没开口。稍候片刻，或上前搭话。</Centered>;

  return (
    <div ref={ref} className="h-full space-y-2.5 overflow-y-auto px-4 py-4">
      <p className="sticky top-0 -mx-4 -mt-4 mb-1 bg-brown-800/95 px-4 pb-1 pt-3 text-xs text-brown-300 backdrop-blur">
        全城广播 · 记录每位 AI 居民的公开发言（最近 {msgs.length} 条）
      </p>
      {msgs.map((m) => {
        const hue = authorHue(m.author);
        return (
          <div key={m.id} className="flex gap-2.5">
            <button
              onClick={() => onSelectAgent(m.author as GameId<'players'>)}
              className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white transition hover:ring-2 hover:ring-white/40"
              style={{ background: `hsl(${hue} 45% 42%)` }}
              title={`查看 ${m.authorName}`}
            >
              {m.authorName.slice(0, 1)}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <button
                  onClick={() => onSelectAgent(m.author as GameId<'players'>)}
                  className="truncate text-sm font-semibold text-brown-100 hover:underline"
                  style={{ color: `hsl(${hue} 55% 72%)` }}
                >
                  {m.authorName}
                </button>
                <span className="shrink-0 text-[10px] text-brown-400">{timeAgo(m.t)}</span>
              </div>
              <div className="mt-0.5 break-words rounded-lg rounded-tl-sm bg-brown-700/55 px-2.5 py-1.5 text-sm leading-snug text-brown-100">
                {m.text}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScheduleTab() {
  const [date, setDate] = useState(DATES.includes(TODAY_DAY) ? TODAY_DAY : DATES[0]);
  const items = useMemo(
    () => SCHEDULE.filter((s) => s.date === date).sort((a, b) => a.min - b.min),
    [date],
  );
  const onItem = (s: SchedItem) => {
    const c = VENUE_COORDS[s.venue];
    if (c) focusMapVenue(c[0], c[1], s.venue);
    else toast.info(`「${s.venue}」是候鸟300外场剧场，沙城地图联动即将支持`, { toastId: `off-${s.venue}` });
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 gap-1 overflow-x-auto px-3 py-2">
        {DATES.map((d) => (
          <button
            key={d}
            onClick={() => setDate(d)}
            className={
              'shrink-0 rounded px-2.5 py-1 text-sm font-bold tabular-nums transition ' +
              (d === date ? 'bg-clay-700 text-white' : 'bg-brown-700/50 text-brown-200 hover:bg-brown-700')
            }
          >
            6/{d}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {items.map((s, i) => {
          const onmap = !!VENUE_COORDS[s.venue];
          return (
            <button
              key={i}
              onClick={() => onItem(s)}
              className="group flex w-full items-stretch gap-2.5 border-b border-brown-700/40 py-2 text-left"
            >
              <div className="w-12 shrink-0 pt-0.5 text-right">
                <div className="text-sm font-bold tabular-nums text-brown-100">{s.time}</div>
                {s.dur ? <div className="text-[10px] text-brown-400">{s.dur}min</div> : null}
              </div>
              <div className="w-1 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[s.cat] }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-brown-100 group-hover:underline">
                  {s.title}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-brown-300">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: onmap ? '#c0654a' : '#9a8a72' }}
                  />
                  <span className="truncate">{s.venue}</span>
                  <span className="ml-auto shrink-0 rounded px-1" style={{ background: CATEGORY_COLORS[s.cat] + '33' }}>
                    {s.cat}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StateTab({ game }: { game: ServerGame }) {
  const players = [...game.world.players.values()];
  const agents = [...game.world.agents.values()];
  const conversations = [...game.world.conversations.values()];
  const humans = players.filter((p) => p.human).length;
  const inConvo = new Set<string>();
  conversations.forEach((c) => c.participants.forEach((_v, k) => inConvo.add(k as string)));

  const stats = [
    { k: 'AI 居民', v: agents.length },
    { k: '真人玩家', v: humans },
    { k: '进行中对话', v: conversations.length },
    { k: '正在交谈', v: inConvo.size },
  ];

  const nameOf = (pid: string) => game.playerDescriptions.get(pid as never)?.name ?? '居民';

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <div className="grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.k} className="rounded-lg border border-brown-700/50 bg-brown-700/30 px-3 py-2.5">
            <div className="font-display text-3xl leading-none text-[#e4b58c]">{s.v}</div>
            <div className="mt-1 text-xs text-brown-300">{s.k}</div>
          </div>
        ))}
      </div>

      <h3 className="mb-1 mt-5 text-xs font-semibold uppercase tracking-wider text-brown-300">
        居民动态
      </h3>
      <div className="space-y-1">
        {players
          .filter((p) => !p.human)
          .map((p) => {
            const talking = inConvo.has(p.id as string);
            return (
              <button
                key={p.id}
                onClick={() => undefined}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-brown-700/40"
              >
                <span
                  className={'h-2 w-2 shrink-0 rounded-full ' + (talking ? 'bg-[#c0654a]' : 'bg-brown-500')}
                />
                <span className="truncate text-sm text-brown-100">{nameOf(p.id as string)}</span>
                <span className="ml-auto shrink-0 text-[11px] text-brown-400">
                  {talking ? '交谈中' : '漫步'}
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center px-8 text-center text-sm leading-relaxed text-brown-300">
      {children}
    </div>
  );
}
