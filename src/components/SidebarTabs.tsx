import { useEffect, useRef, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import PlayerDetails from './PlayerDetails';
import { GameId } from '../../convex/aiTown/ids';
import { ServerGame } from '../hooks/serverGame';
import { SelectElement } from './Player';
import {
  SCHEDULE,
  VENUES,
  VENUE_COORDS,
  CATEGORY_COLORS,
  DATES,
  type SchedItem,
} from '../../data/schedule';
import {
  focusMapVenue,
  focusMapTile,
  setInstallationSelectHandler,
  setVenueSelectHandler,
} from '../lib/mapFocus';
import {
  INSTALLATIONS,
  INSTALLATION_SOURCE,
  INSTALLATION_ZONES,
  type Installation,
  type InstallationZone,
} from '../../data/installations';
import { enterActivity, activityFromSchedule } from '../lib/activityEnter';
import { setPanelTabHandler } from '../lib/panelBus';
import { toast } from 'react-toastify';
import MaterialsPanel from './MaterialsPanel';

type Tab = 'state' | 'chat' | 'schedule' | 'works' | 'materials';

const TABS: { id: Tab; label: string }[] = [
  { id: 'state', label: '状态' },
  { id: 'chat', label: '广播' },
  { id: 'schedule', label: '节目单' },
  { id: 'works', label: '作品' },
  { id: 'materials', label: '物料' },
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
  onActivate,
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  game: ServerGame;
  playerId?: GameId<'players'>;
  setSelectedElement: SelectElement;
  onActivate?: () => void;
}) {
  const [tab, setTab] = useState<Tab>('state');
  // bumped each time a venue marker is clicked on the map, to drive the schedule tab
  const [venueFocus, setVenueFocus] = useState<{ venue: string; n: number } | null>(null);
  const [installationFocus, setInstallationFocus] = useState<{ id: string; n: number } | null>(
    null,
  );

  // jump to the state tab (which now hosts character details) on map selection
  useEffect(() => {
    if (playerId) {
      setTab('state');
      onActivate?.();
    }
  }, [playerId]);

  // 底部「节目单」（移动端）请求切到指定 tab。
  useEffect(() => {
    setPanelTabHandler((t) => setTab(t));
    return () => setPanelTabHandler(null);
  }, []);

  // a venue marker on the map was clicked: open the schedule tab on that venue
  useEffect(() => {
    setVenueSelectHandler((venue) => {
      setVenueFocus((prev) => ({ venue, n: (prev?.n ?? 0) + 1 }));
      setTab('schedule');
      onActivate?.();
    });
    return () => setVenueSelectHandler(null);
  }, []);

  // an installation marker on the map was clicked: open the works tab on that detail
  useEffect(() => {
    setInstallationSelectHandler((id) => {
      setInstallationFocus((prev) => ({ id, n: (prev?.n ?? 0) + 1 }));
      setTab('works');
      onActivate?.();
    });
    return () => setInstallationSelectHandler(null);
  }, []);

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
        {tab === 'state' && (
          <StateTab
            worldId={worldId}
            engineId={engineId}
            game={game}
            playerId={playerId}
            setSelectedElement={setSelectedElement}
          />
        )}
        {tab === 'chat' && (
          <GlobalChat
            worldId={worldId}
            onSelectAgent={(id) => setSelectedElement({ kind: 'player', id })}
          />
        )}
        {tab === 'schedule' && <ScheduleTab venueFocus={venueFocus} />}
        {tab === 'works' && <WorksTab installationFocus={installationFocus} />}
        {tab === 'materials' && <MaterialsPanel />}
      </div>
    </div>
  );
}

function ChatDot({ worldId }: { worldId: Id<'worlds'> }) {
  const msgs = useQuery(api.messages.listRecentMessages, { worldId, limit: 1 });
  const fresh = msgs?.[0] && Date.now() - msgs[0].t < 60_000;
  if (!fresh) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-[#e4b58c]" />
  );
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
    <div className="flex h-full flex-col">
      <p className="shrink-0 px-4 pb-2 pt-4 text-xs text-brown-300">
        全城广播 · 记录每位 AI 居民的公开发言（最近 {msgs.length} 条）
      </p>
      <div ref={ref} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 pb-4">
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
    </div>
  );
}

function focusVenueOnMap(venue: string) {
  const c = VENUE_COORDS[venue];
  if (c) focusMapVenue(c[0], c[1], venue);
  else
    toast.info(`「${venue}」是候鸟300外场剧场，沙城地图联动即将支持`, { toastId: `off-${venue}` });
}

function focusInstallationOnMap(installation: Installation) {
  focusMapVenue(installation.x, installation.y, installation.id);
}

function WorksTab({ installationFocus }: { installationFocus: { id: string; n: number } | null }) {
  const [zone, setZone] = useState<InstallationZone | 'all'>('all');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<Installation | null>(null);

  useEffect(() => {
    if (!installationFocus) return;
    const installation = INSTALLATIONS.find((item) => item.id === installationFocus.id);
    if (!installation) return;
    setDetail(installation);
    setZone(installation.zone);
    setQuery('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationFocus?.n]);

  if (detail) {
    return (
      <InstallationDetail
        installation={detail}
        onBack={() => setDetail(null)}
        onLocate={() => focusInstallationOnMap(detail)}
      />
    );
  }

  const normalizedQuery = query.trim().toLowerCase();
  const items = INSTALLATIONS.filter((item) => {
    const zoneMatch = zone === 'all' || item.zone === zone;
    if (!zoneMatch) return false;
    if (!normalizedQuery) return true;
    return `${item.id} ${item.artist} ${item.title} ${item.zone}`
      .toLowerCase()
      .includes(normalizedQuery);
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-brown-700/40 px-3 py-3">
        <div className="flex items-baseline gap-2">
          <h3 className="font-display text-xl leading-none text-brown-100">作品点位</h3>
          <span className="text-xs text-brown-400">{INSTALLATIONS.length} 件</span>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索编号、艺术家、作品名"
          className="mt-3 w-full rounded border border-brown-700/70 bg-brown-900/45 px-3 py-2 text-sm text-brown-100 placeholder:text-brown-400 focus:border-clay-500 focus:outline-none"
        />
      </div>

      <div className="shrink-0 overflow-x-auto px-3 py-2">
        <div className="flex gap-1.5">
          <button
            onClick={() => setZone('all')}
            className={
              'shrink-0 rounded px-2.5 py-1 text-xs font-semibold transition ' +
              (zone === 'all'
                ? 'bg-clay-700 text-white'
                : 'bg-brown-900/40 text-brown-300 hover:bg-brown-700/60')
            }
          >
            全部
          </button>
          {INSTALLATION_ZONES.map((name) => (
            <button
              key={name}
              onClick={() => setZone(name)}
              className={
                'shrink-0 rounded px-2.5 py-1 text-xs font-semibold transition ' +
                (zone === name
                  ? 'bg-clay-700 text-white'
                  : 'bg-brown-900/40 text-brown-300 hover:bg-brown-700/60')
              }
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {items.length ? (
          <div className="space-y-1.5">
            {items.map((item) => (
              <InstallationRow key={item.id} item={item} onClick={() => setDetail(item)} />
            ))}
          </div>
        ) : (
          <Centered>没有匹配的作品点位。</Centered>
        )}
      </div>
    </div>
  );
}

function InstallationRow({ item, onClick }: { item: Installation; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full gap-2.5 rounded border border-brown-700/40 bg-brown-900/18 px-2.5 py-2 text-left transition hover:border-clay-600/70 hover:bg-brown-700/38"
    >
      <span className="grid h-7 w-9 shrink-0 place-items-center rounded bg-[#1da76e] text-xs font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]">
        {item.id}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-brown-100 group-hover:underline">
          {item.title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-brown-300">{item.artist}</span>
        <span className="mt-1 inline-flex rounded bg-brown-700/55 px-1.5 py-0.5 text-[10px] text-brown-300">
          {item.zone}
        </span>
      </span>
    </button>
  );
}

function InstallationDetail({
  installation,
  onBack,
  onLocate,
}: {
  installation: Installation;
  onBack: () => void;
  onLocate: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <button
          onClick={onBack}
          className="shrink-0 rounded bg-brown-700/50 px-2 py-1 text-xs text-brown-200 hover:bg-brown-700"
        >
          ← 返回
        </button>
        <span className="ml-auto rounded bg-[#1da76e] px-2 py-0.5 text-xs font-black text-white">
          {installation.id}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <h3 className="font-display text-2xl leading-tight text-brown-100">{installation.title}</h3>
        <div className="mt-3 space-y-2 text-sm text-brown-200">
          <div className="flex gap-2">
            <span className="w-12 shrink-0 text-brown-400">艺术家</span>
            <span className="min-w-0 flex-1">{installation.artist}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-12 shrink-0 text-brown-400">区域</span>
            <span>{installation.zone}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-12 shrink-0 text-brown-400">来源</span>
            <span>{INSTALLATION_SOURCE}</span>
          </div>
        </div>
        {installation.note && (
          <p className="mt-4 rounded-lg bg-brown-700/35 p-3 text-sm leading-relaxed text-brown-200">
            {installation.note}
          </p>
        )}
        <button
          onClick={onLocate}
          className="mt-4 w-full rounded bg-clay-700 px-3 py-2.5 text-base font-bold text-white hover:bg-clay-500"
        >
          在地图上定位
        </button>
      </div>
    </div>
  );
}

function ScheduleTab({ venueFocus }: { venueFocus: { venue: string; n: number } | null }) {
  const [view, setView] = useState<'byDate' | 'byVenue'>('byDate');
  const [date, setDate] = useState(DATES.includes(TODAY_DAY) ? TODAY_DAY : DATES[0]);
  const [venue, setVenue] = useState<string | null>(null);
  const [detail, setDetail] = useState<SchedItem | null>(null);

  // map venue marker click -> jump straight to that venue's schedule
  useEffect(() => {
    if (!venueFocus) return;
    setView('byVenue');
    setVenue(venueFocus.venue);
    setDetail(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueFocus?.n]);

  // a single activity's detail card
  if (detail) {
    return (
      <ScheduleDetail
        item={detail}
        onBack={() => setDetail(null)}
        onVenue={(v) => {
          setView('byVenue');
          setVenue(v);
          setDetail(null);
        }}
      />
    );
  }

  // a single venue's full schedule
  if (view === 'byVenue' && venue) {
    const items = SCHEDULE.filter((s) => s.venue === venue).sort((a, b) =>
      a.date === b.date ? a.min - b.min : Number(a.date) - Number(b.date),
    );
    const onmap = !!VENUE_COORDS[venue];
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center gap-2 px-3 py-2">
          <button
            onClick={() => setVenue(null)}
            className="shrink-0 rounded bg-brown-700/50 px-2 py-1 text-xs text-brown-200 hover:bg-brown-700"
          >
            ← 场地
          </button>
          <span className="min-w-0 flex-1 truncate font-display text-lg text-brown-100">
            {venue}
          </span>
          {onmap && (
            <button
              onClick={() => focusVenueOnMap(venue)}
              className="shrink-0 rounded bg-clay-700 px-2 py-1 text-xs text-white hover:bg-clay-600"
            >
              地图定位
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {items.map((s, i) => (
            <ScheduleRow key={i} s={s} showDate onClick={() => setDetail(s)} />
          ))}
        </div>
      </div>
    );
  }

  // venue directory
  if (view === 'byVenue') {
    const counts: Record<string, number> = {};
    SCHEDULE.forEach((s) => (counts[s.venue] = (counts[s.venue] ?? 0) + 1));
    return (
      <div className="flex h-full min-h-0 flex-col">
        <ViewToggle view={view} setView={setView} />
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {VENUES.map((v) => {
            const onmap = !!VENUE_COORDS[v];
            return (
              <button
                key={v}
                onClick={() => setVenue(v)}
                className="flex w-full items-center gap-2 border-b border-brown-700/40 py-2 text-left"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: onmap ? '#c0654a' : '#9a8a72' }}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-brown-100">{v}</span>
                <span className="shrink-0 text-[11px] text-brown-400">{counts[v] ?? 0} 场</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // by date (default)
  const items = SCHEDULE.filter((s) => s.date === date).sort((a, b) => a.min - b.min);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ViewToggle view={view} setView={setView} />
      <div className="flex shrink-0 gap-1 overflow-x-auto px-3 pb-2">
        {DATES.map((d) => (
          <button
            key={d}
            onClick={() => setDate(d)}
            className={
              'shrink-0 rounded px-2.5 py-1 text-sm font-bold tabular-nums transition ' +
              (d === date
                ? 'bg-clay-700 text-white'
                : 'bg-brown-700/50 text-brown-200 hover:bg-brown-700')
            }
          >
            6/{d}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {items.map((s, i) => (
          <ScheduleRow key={i} s={s} onClick={() => setDetail(s)} />
        ))}
      </div>
    </div>
  );
}

function ViewToggle({
  view,
  setView,
}: {
  view: 'byDate' | 'byVenue';
  setView: (v: 'byDate' | 'byVenue') => void;
}) {
  const opts: { id: 'byDate' | 'byVenue'; label: string }[] = [
    { id: 'byDate', label: '按日期' },
    { id: 'byVenue', label: '按场地' },
  ];
  return (
    <div className="flex shrink-0 gap-1 px-3 pt-2">
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => setView(o.id)}
          className={
            'rounded px-2.5 py-1 text-xs font-semibold transition ' +
            (view === o.id
              ? 'bg-brown-700 text-white'
              : 'bg-brown-900/40 text-brown-300 hover:bg-brown-700/60')
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ScheduleRow({
  s,
  showDate,
  onClick,
}: {
  s: SchedItem;
  showDate?: boolean;
  onClick: () => void;
}) {
  const onmap = !!VENUE_COORDS[s.venue];
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-stretch gap-2.5 border-b border-brown-700/40 py-2 text-left"
    >
      <div className="w-12 shrink-0 pt-0.5 text-right">
        {showDate && <div className="text-[10px] text-brown-400">6/{s.date}</div>}
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
          <span
            className="ml-auto shrink-0 rounded px-1"
            style={{ background: CATEGORY_COLORS[s.cat] + '33' }}
          >
            {s.cat}
          </span>
        </div>
      </div>
    </button>
  );
}

function ScheduleDetail({
  item,
  onBack,
  onVenue,
}: {
  item: SchedItem;
  onBack: () => void;
  onVenue: (venue: string) => void;
}) {
  const onmap = !!VENUE_COORDS[item.venue];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <button
          onClick={onBack}
          className="shrink-0 rounded bg-brown-700/50 px-2 py-1 text-xs text-brown-200 hover:bg-brown-700"
        >
          ← 返回
        </button>
        <span
          className="ml-auto shrink-0 rounded px-2 py-0.5 text-xs font-bold"
          style={{ background: CATEGORY_COLORS[item.cat] + '33', color: CATEGORY_COLORS[item.cat] }}
        >
          {item.cat}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <h3 className="font-display text-2xl leading-tight text-brown-100">{item.title}</h3>
        <div className="mt-3 space-y-1.5 text-sm text-brown-200">
          <div className="flex gap-2">
            <span className="w-10 shrink-0 text-brown-400">时间</span>
            <span className="tabular-nums">
              6/{item.date} {item.time}
              {item.dur ? ` · ${item.dur} 分钟` : ''}
            </span>
          </div>
          <div className="group flex items-center gap-2">
            <span className="w-10 shrink-0 text-brown-400">场地</span>
            <button
              onClick={() => onVenue(item.venue)}
              className="min-w-0 text-left text-[#e4b58c] hover:underline"
            >
              {item.venue}
              {onmap ? '' : '（场外剧场）'}
            </button>
            {onmap && (
              <button
                onClick={() => focusVenueOnMap(item.venue)}
                title="在地图上定位"
                aria-label="在地图上定位"
                className="shrink-0 text-brown-400 opacity-40 transition hover:text-clay-300 group-hover:opacity-100"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10Z" />
                  <circle cx="12" cy="11" r="2" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <p className="mt-4 whitespace-pre-wrap rounded-lg bg-brown-700/40 p-3 text-sm leading-relaxed text-brown-100">
          {item.desc}
        </p>
        <button
          onClick={() => enterActivity(activityFromSchedule(item))}
          className="mt-4 w-full rounded bg-clay-700 px-3 py-2.5 text-base font-bold text-white hover:bg-clay-500"
        >
          进入这个活动的专属体验
        </button>
      </div>
    </div>
  );
}

function StateTab({
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
  const detailScrollRef = useRef<HTMLDivElement>(null);

  // A resident is selected (from this list or the map): show their details.
  if (playerId) {
    return (
      <div ref={detailScrollRef} className="h-full overflow-y-auto px-4 py-5 sm:px-6">
        <PlayerDetails
          worldId={worldId}
          engineId={engineId}
          game={game}
          playerId={playerId}
          setSelectedElement={setSelectedElement}
          scrollViewRef={detailScrollRef}
        />
      </div>
    );
  }

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
          <div
            key={s.k}
            className="rounded-lg border border-brown-700/50 bg-brown-700/30 px-3 py-2.5"
          >
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
                onClick={() => {
                  setSelectedElement({ kind: 'player', id: p.id });
                  focusMapTile(p.position.x, p.position.y);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-brown-700/40"
              >
                <span
                  className={
                    'h-2 w-2 shrink-0 rounded-full ' + (talking ? 'bg-[#c0654a]' : 'bg-brown-500')
                  }
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
