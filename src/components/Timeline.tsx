import { useMemo, useRef, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useServerGame } from '../hooks/serverGame';
import { MAX_HUMAN_PLAYERS } from '../../convex/constants';
import {
  SCHEDULE,
  VENUES,
  DATES,
  CATEGORY_COLORS,
  VENUE_COORDS,
  type Category,
  type SchedItem,
} from '../../data/schedule';
import { focusMapVenue } from '../lib/mapFocus';
import { openPanel } from '../lib/panelBus';

// Bottom status bar + a dialog-triggered festival programme grid.
// The slim bar shows festival day · now-playing · online players · clock;
// clicking 节目单 opens the venue×time Gantt in a modal (the full grid also
// lives in the right sidebar's 节目单 tab).

const START_MIN = 9 * 60; // 09:00
const END_MIN = 24 * 60; // 24:00
const PX_PER_MIN = 2.4;
const LANE_H = 34;
const LABEL_W = 116;
const AXIS_W = (END_MIN - START_MIN) * PX_PER_MIN;

const CATS: Category[] = ['戏剧', '舞蹈', '音乐', '魔术', '脱口秀', '工作坊', '放映', '科技'];

// today (festival runs across DATES); pick today's day if it is part of the schedule
const TODAY_DAY = (() => {
  const n = new Date();
  return n.getMonth() === 5 ? String(n.getDate()) : '';
})();

function fmtVenue(v: string) {
  if (v.length > 7) return v.slice(0, 6) + '…';
  return v;
}

export default function Timeline() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const liveDay = DATES.includes(TODAY_DAY) ? TODAY_DAY : DATES[0];
  const [date, setDate] = useState(liveDay);
  const [active, setActive] = useState<Category | null>(null);
  const [hover, setHover] = useState<{ item: SchedItem; x: number; y: number } | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // online human players, for the status bar
  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const game = useServerGame(worldStatus?.worldId);
  const humans = game ? [...game.world.players.values()].filter((p) => p.human).length : null;

  // Click a venue/event: pan the map camera to it, or flag off-map venues.
  const focusVenue = (venue: string) => {
    const c = VENUE_COORDS[venue];
    if (c) {
      setFocused(venue);
      window.setTimeout(() => setFocused((f) => (f === venue ? null : f)), 2600);
      focusMapVenue(c[0], c[1], venue);
    } else {
      toast.info(`「${venue}」是候鸟300外场剧场，沙城地图联动即将支持`, { toastId: `off-${venue}` });
    }
  };

  const dayItems = useMemo(() => SCHEDULE.filter((s) => s.date === date), [date]);
  const lanes = useMemo(() => VENUES.filter((v) => dayItems.some((s) => s.venue === v)), [dayItems]);

  // live clock + playhead
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    const t = setInterval(() => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    }, 30_000);
    return () => clearInterval(t);
  }, []);
  const isToday = date === TODAY_DAY;
  const showPlayhead = isToday && nowMin >= START_MIN && nowMin <= END_MIN;
  const clock = `${String(Math.floor(nowMin / 60)).padStart(2, '0')}:${String(nowMin % 60).padStart(2, '0')}`;
  const festDay = DATES.indexOf(liveDay) + 1;

  // now-playing on the live festival day
  const nowItem = useMemo(() => {
    const todays = SCHEDULE.filter((s) => s.date === liveDay).sort((a, b) => a.min - b.min);
    return todays.find((s) => s.min <= nowMin && nowMin < s.min + (s.dur || 60)) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMin, liveDay]);

  // auto-scroll the grid to the playhead (or 16:00) when the dialog opens / day changes
  useEffect(() => {
    if (!dialogOpen || !scrollRef.current) return;
    const focusMin = showPlayhead ? nowMin : 16 * 60;
    scrollRef.current.scrollLeft = Math.max(0, (focusMin - START_MIN) * PX_PER_MIN - 280);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, date]);

  // close dialog on Escape
  useEffect(() => {
    if (!dialogOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDialogOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialogOpen]);

  return (
    <>
      {/* ── bottom status bar ───────────────────────────── */}
      <div className="timeline-root pointer-events-auto z-30 shrink-0 select-none">
        <div className="status-bar flex items-center">
          <span className="status-seg hidden shrink-0 items-center sm:flex" style={{ fontFamily: "'Noto Serif SC', serif" }}>
            <b className="text-[#e4b58c]">候鸟300</b>
            <span className="mx-1 text-[#7a5c44]">·</span>
            第{festDay}日
          </span>

          <span className="status-seg div-l-sm flex min-w-0 flex-1 items-center">
            {nowItem ? (
              <span className="flex min-w-0 items-center gap-1.5 truncate">
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#c0654a]" />
                <span className="shrink-0 text-[#9c7e5e]">正在上演</span>
                <b className="truncate text-[#f6ecd9]">{nowItem.title}</b>
                <span className="hidden shrink-0 text-[#9c7e5e] md:inline">@{nowItem.venue}</span>
              </span>
            ) : (
              <span className="truncate text-[#9c7e5e]">本时段暂无演出</span>
            )}
          </span>

          <span className="status-seg div-l flex shrink-0 items-center">
            <span className="text-[#9c7e5e]">在线</span>
            <b className="ml-1 tabular-nums text-[#e4b58c]">{humans ?? '–'}</b>
            <span className="text-[#7a5c44]">/{MAX_HUMAN_PLAYERS}</span>
          </span>

          <span className="status-seg div-l hidden shrink-0 items-center tabular-nums text-[#f6ecd9] sm:flex">{clock}</span>

          <button
            className="status-prog shrink-0"
            onClick={() => {
              // 移动端没有常驻侧栏：打开抽屉的节目单 tab（可进活动）；桌面端开甘特弹窗。
              if (window.innerWidth < 1024) openPanel('schedule');
              else setDialogOpen(true);
            }}
            title="打开节目单（潮汐节目单）"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="4.5" width="18" height="16" rx="2" />
              <path d="M3 9h18M8 2.5v4M16 2.5v4" strokeLinecap="round" />
            </svg>
            节目单
          </button>
        </div>
      </div>

      {/* ── programme dialog ────────────────────────────── */}
      {dialogOpen && (
        <div
          className="sched-backdrop pointer-events-auto fixed inset-0 z-50 grid place-items-center p-3 sm:p-6"
          onMouseDown={() => setDialogOpen(false)}
        >
          <div
            className="sched-dialog flex w-[min(1040px,96vw)] flex-col overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* dialog header */}
            <div className="flex flex-wrap items-center gap-3 border-b-2 border-[#2a1c14] px-4 py-2.5">
              <span
                className="whitespace-nowrap text-base font-black tracking-wide text-[#2a1c14]"
                style={{ fontFamily: "'Noto Serif SC', serif" }}
              >
                候鸟300<span className="mx-1 text-[#c0654a]">·</span>潮汐节目单
              </span>
              <div className="flex items-center gap-1 overflow-x-auto">
                {DATES.map((d) => {
                  const on = d === date;
                  return (
                    <button
                      key={d}
                      onClick={() => setDate(d)}
                      className={
                        'relative shrink-0 rounded-[3px] px-2 py-0.5 text-[12px] font-bold tabular-nums transition ' +
                        (on
                          ? 'bg-[#2a1c14] text-[#f6ecd9] shadow-[2px_2px_0_#c0654a]'
                          : 'bg-[#dac7a6] text-[#5b4632] hover:bg-[#d0b994]')
                      }
                    >
                      6/{d}
                      {d === TODAY_DAY && (
                        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#c0654a] ring-2 ring-[#efe2cb]" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="ml-auto hidden flex-wrap items-center gap-x-2.5 gap-y-0.5 lg:flex">
                {CATS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setActive((a) => (a === c ? null : c))}
                    className={'flex items-center gap-1 text-[11px] transition ' + (active && active !== c ? 'opacity-35' : '')}
                  >
                    <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: CATEGORY_COLORS[c] }} />
                    {c}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setDialogOpen(false)}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-sm bg-[#2a1c14] text-[#f6ecd9] transition hover:bg-[#c0654a]"
                title="关闭 (Esc)"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {/* grid body */}
            <div className="relative">
              <div ref={scrollRef} className="overflow-auto" style={{ height: 'min(58vh, 420px)' }}>
                <div className="relative" style={{ width: LABEL_W + AXIS_W }}>
                  {/* time ruler */}
                  <div
                    className="sticky top-0 z-20 flex h-6 border-b border-[#cdb892] bg-[#e7d8bd]"
                    style={{ paddingLeft: LABEL_W }}
                  >
                    {Array.from({ length: (END_MIN - START_MIN) / 60 + 1 }, (_, i) => {
                      const h = 9 + i;
                      return (
                        <div
                          key={h}
                          className="absolute top-0 flex h-6 items-center text-[10px] font-bold tabular-nums text-[#8a7256]"
                          style={{ left: LABEL_W + i * 60 * PX_PER_MIN }}
                        >
                          <span className="-translate-x-1/2 border-l border-[#cdb892] pl-1">{String(h % 24).padStart(2, '0')}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* lanes */}
                  {lanes.map((v, li) => {
                    const onmap = !!VENUE_COORDS[v];
                    const isFocused = focused === v;
                    return (
                      <div
                        key={v}
                        className="relative border-b border-[#e2d2b3]"
                        style={{
                          height: LANE_H,
                          background: isFocused
                            ? 'rgba(192,101,74,0.13)'
                            : li % 2
                            ? 'rgba(255,255,255,0.18)'
                            : 'transparent',
                        }}
                      >
                        {/* venue label (sticky left) — click to focus the map */}
                        <button
                          onClick={() => focusVenue(v)}
                          className={
                            'group sticky left-0 z-10 flex h-full w-full items-center gap-1 pr-1 text-left text-[12px] font-semibold transition ' +
                            (onmap ? 'cursor-pointer hover:bg-[#e7d4b2]' : 'cursor-help') +
                            (isFocused ? ' bg-[#e7d4b2]' : ' bg-[#efe2cb]')
                          }
                          style={{ width: LABEL_W, fontFamily: "'Noto Serif SC', serif" }}
                          title={onmap ? `定位到「${v}」` : '外场剧场 · 联动即将支持'}
                        >
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: onmap ? '#c0654a' : '#b3a489' }}
                          />
                          <span className="truncate group-hover:underline">{fmtVenue(v)}</span>
                          {onmap ? (
                            <svg width="11" height="11" viewBox="0 0 24 24" className="ml-auto shrink-0 opacity-0 transition group-hover:opacity-70">
                              <path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" fill="none" stroke="#c0654a" strokeWidth="2.4" />
                              <circle cx="12" cy="10" r="2.4" fill="#c0654a" />
                            </svg>
                          ) : (
                            <span className="ml-auto shrink-0 rounded-[2px] bg-[#cdb79a] px-1 text-[8px] font-bold text-[#5b4632]">外场</span>
                          )}
                        </button>
                        {/* event blocks */}
                        {dayItems
                          .filter((s) => s.venue === v)
                          .map((s, i) => {
                            const left = LABEL_W + (s.min - START_MIN) * PX_PER_MIN;
                            const w = Math.max(22, (s.dur || 30) * PX_PER_MIN);
                            const dim = active && active !== s.cat;
                            return (
                              <button
                                key={i}
                                className="absolute top-1 flex h-[26px] items-center overflow-hidden rounded-[3px] px-1 text-left text-[11px] font-medium text-white transition"
                                style={{
                                  left,
                                  width: w,
                                  background: CATEGORY_COLORS[s.cat],
                                  opacity: dim ? 0.22 : 1,
                                  boxShadow: '1px 1px 0 rgba(0,0,0,0.25)',
                                }}
                                onMouseEnter={(e) => setHover({ item: s, x: e.clientX, y: e.clientY })}
                                onMouseMove={(e) => setHover({ item: s, x: e.clientX, y: e.clientY })}
                                onMouseLeave={() => setHover(null)}
                                onClick={() => focusVenue(s.venue)}
                              >
                                <span className="truncate drop-shadow-[0_1px_0_rgba(0,0,0,0.4)]">{s.title}</span>
                              </button>
                            );
                          })}
                      </div>
                    );
                  })}

                  {/* now playhead */}
                  {showPlayhead && (
                    <div
                      className="pointer-events-none absolute top-6 z-30"
                      style={{ left: LABEL_W + (nowMin - START_MIN) * PX_PER_MIN, bottom: 0 }}
                    >
                      <div className="relative h-full w-[2px] bg-[#c0654a]">
                        <span className="absolute -left-[4px] -top-[1px] h-2.5 w-2.5 rounded-full bg-[#c0654a] ring-2 ring-[#efe2cb]" />
                        <span className="absolute -left-3 top-3 rotate-90 whitespace-nowrap text-[9px] font-bold tracking-widest text-[#c0654a]">
                          NOW
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* hover tooltip */}
      {hover && (
        <div
          className="pointer-events-none fixed z-[60] max-w-xs rounded-md border border-[#2a1c14]/15 bg-[#2a1c14] px-3 py-2 text-[#f6ecd9] shadow-xl"
          style={{
            left: Math.min(hover.x + 14, window.innerWidth - 280),
            top: hover.y - 12,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="mb-0.5 flex items-center gap-2 text-[11px] tabular-nums text-[#e4b58c]">
            <span className="rounded-[2px] px-1" style={{ background: CATEGORY_COLORS[hover.item.cat] }}>
              {hover.item.cat}
            </span>
            <b>{hover.item.time}</b>
            {hover.item.dur ? <span>· {hover.item.dur}min</span> : null}
            <span className="text-[#b39c80]">@{hover.item.venue}</span>
          </div>
          <div className="text-[13px] leading-snug" style={{ fontFamily: "'Noto Serif SC', serif" }}>
            {hover.item.desc}
          </div>
        </div>
      )}
    </>
  );
}
