import { useMemo, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import clsx from 'clsx';

// 匿名用户身份（鉴权接入后可替换为真实 user）。
function useAnonUser() {
  return useMemo(() => {
    let id = localStorage.getItem('hn_uid');
    if (!id) {
      id = 'u_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('hn_uid', id);
    }
    const name = localStorage.getItem('hn_uname') ?? '';
    return { id, name };
  }, []);
}

export default function Experience() {
  const anon = useAnonUser();
  const [userName, setUserName] = useState(anon.name);
  const [experienceId, setExperienceId] = useState<Id<'experiences'> | null>(null);

  if (!experienceId) {
    return (
      <EventPicker
        userName={userName}
        setUserName={setUserName}
        onStart={(id) => setExperienceId(id)}
        userId={anon.id}
      />
    );
  }
  return <ComicPlayer experienceId={experienceId} onExit={() => setExperienceId(null)} />;
}

// ---------- 活动选择 + 勋章墙 ----------
function EventPicker({
  userId,
  userName,
  setUserName,
  onStart,
}: {
  userId: string;
  userName: string;
  setUserName: (v: string) => void;
  onStart: (id: Id<'experiences'>) => void;
}) {
  const events = useQuery(api.experience.listEvents);
  const badges = useQuery(api.experience.listBadges);
  const seed = useMutation(api.experience.seedDemoEvent);
  const start = useAction(api.experience.startExperience);
  const [starting, setStarting] = useState<Id<'events'> | null>(null);

  const handleStart = async (eventId: Id<'events'>) => {
    const name = userName.trim() || '匿名候鸟';
    localStorage.setItem('hn_uname', name);
    setStarting(eventId);
    try {
      const id = await start({ eventId, userId, userName: name });
      onStart(id);
    } finally {
      setStarting(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-brown-900 px-6 py-8 text-brown-100">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display game-title mb-2 text-5xl">候鸟体验</h1>
        <p className="mb-6 text-brown-200">
          每个活动都是一段由 AI 即时生成的连环画旅程——你的每一次选择，都通向一张独一无二的画面。
        </p>

        <input
          className="mb-6 w-full max-w-sm rounded border-2 border-brown-700 bg-brown-800 px-3 py-2 text-brown-100 placeholder:text-brown-500"
          placeholder="给自己起个名字（用于勋章墙）"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
        />

        {events === undefined && <p className="text-brown-300">加载活动中…</p>}
        {events && events.length === 0 && (
          <div className="rounded border-2 border-dashed border-brown-700 p-6 text-center">
            <p className="mb-4 text-brown-300">还没有活动。</p>
            <button
              className="bg-clay-700 px-4 py-2 font-display text-white shadow-solid"
              onClick={() => void seed()}
            >
              创建示例活动
            </button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {events?.map((ev) => (
            <div key={ev._id} className="flex flex-col border-2 border-brown-700 bg-brown-800 p-4">
              <h2 className="font-display text-2xl text-brown-100">{ev.title}</h2>
              {ev.hostName && <p className="mb-1 text-sm text-brown-300">主理人：{ev.hostName}</p>}
              <p className="mb-4 flex-1 text-sm text-brown-200">{ev.theme}</p>
              <button
                className="bg-clay-700 px-4 py-2 font-display text-white shadow-solid disabled:opacity-50"
                disabled={starting !== null}
                onClick={() => void handleStart(ev._id)}
              >
                {starting === ev._id ? '正在生成首幕…' : '进入体验'}
              </button>
            </div>
          ))}
        </div>

        {badges && badges.length > 0 && (
          <div className="mt-10">
            <h2 className="font-display mb-3 text-3xl text-brown-100">勋章墙</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {badges.map((b) => (
                <div key={b._id} className="flex items-center gap-3 border-2 border-brown-700 bg-brown-800 p-3">
                  <Medallion title={b.title} />
                  <div className="min-w-0">
                    <p className="truncate font-display text-brown-100">{b.title}</p>
                    <p className="truncate text-xs text-brown-300">
                      {b.userName} · {b.eventTitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- 连环画播放器 ----------
function ComicPlayer({
  experienceId,
  onExit,
}: {
  experienceId: Id<'experiences'>;
  onExit: () => void;
}) {
  const data = useQuery(api.experience.getExperience, { experienceId });
  const answer = useAction(api.experience.answerPanel);
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (data === undefined) return <div className="h-full bg-brown-900 p-8 text-brown-200">加载中…</div>;
  if (data === null) return <div className="h-full bg-brown-900 p-8 text-brown-200">体验不存在。</div>;

  const { panels, event, badge, experience } = data;
  const latest = panels[panels.length - 1];
  const current = viewIndex !== null ? panels[viewIndex] : latest;
  const isViewingLatest = current?._id === latest?._id;
  // 仅当查看的是最新一格、非收尾、已生成图片、未完成体验时才可交互。
  const interactive =
    isViewingLatest && latest && !latest.isFinal && !!latest.imageUrl && experience.status === 'active';

  const submit = async (value: string) => {
    if (!value.trim() || submitting) return;
    setSubmitting(true);
    setCustom('');
    try {
      await answer({ experienceId, answer: value.trim() });
      setViewIndex(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid h-full grid-rows-[1fr_auto] bg-brown-900 lg:grid-cols-[1fr_18rem] lg:grid-rows-1">
      {/* 主舞台 */}
      <div className="flex min-h-0 flex-col overflow-y-auto p-4 lg:p-8">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="font-display text-2xl text-brown-100">{event?.title}</h1>
          <button className="text-sm text-brown-300 underline" onClick={onExit}>
            返回活动列表
          </button>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-2xl overflow-hidden border-4 border-brown-700 bg-brown-800">
          {current?.imageUrl ? (
            <img src={current.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-brown-300">
              <Spinner /> 正在绘制画面…
            </div>
          )}
        </div>

        {current && (
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg leading-relaxed text-brown-100">
            {current.narration}
          </p>
        )}

        {/* 完成 -> 勋章 */}
        {experience.status === 'completed' && badge && (
          <div className="mx-auto mt-6 flex max-w-2xl flex-col items-center gap-3 border-2 border-clay-500 bg-brown-800 p-6 text-center">
            <Medallion title={badge.title} large />
            <p className="font-display text-2xl text-brown-100">{badge.title}</p>
            <p className="text-brown-200">{badge.summary}</p>
          </div>
        )}

        {/* 交互区 */}
        {interactive && (
          <div className="mx-auto mt-6 w-full max-w-2xl">
            {latest.question && (
              <p className="mb-3 text-center font-display text-xl text-brown-100">{latest.question}</p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {latest.options.map((opt) => (
                <button
                  key={opt}
                  disabled={submitting}
                  onClick={() => void submit(opt)}
                  className="border-2 border-brown-700 bg-brown-800 px-4 py-3 text-left text-brown-100 hover:border-clay-500 disabled:opacity-50"
                >
                  {opt}
                </button>
              ))}
            </div>
            {latest.allowCustom && (
              <div className="mt-3 flex gap-2">
                <input
                  className="flex-1 rounded border-2 border-brown-700 bg-brown-800 px-3 py-2 text-brown-100 placeholder:text-brown-500"
                  placeholder="或者，写下你自己的选择…"
                  value={custom}
                  disabled={submitting}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void submit(custom)}
                />
                <button
                  className="bg-clay-700 px-4 font-display text-white shadow-solid disabled:opacity-50"
                  disabled={submitting || !custom.trim()}
                  onClick={() => void submit(custom)}
                >
                  确定
                </button>
              </div>
            )}
          </div>
        )}
        {submitting && (
          <p className="mt-4 flex items-center justify-center gap-2 text-brown-300">
            <Spinner /> 正在生成下一幕…
          </p>
        )}
      </div>

      {/* 侧栏连环画 */}
      <div className="flex min-h-0 flex-col overflow-x-auto border-t-4 border-brown-700 bg-brown-800 p-3 lg:flex-col lg:overflow-y-auto lg:border-l-4 lg:border-t-0">
        <p className="mb-2 font-display text-brown-200">连环画 · {panels.length} 幕</p>
        <div className="flex gap-2 lg:flex-col">
          {panels.map((p, i) => (
            <button
              key={p._id}
              onClick={() => setViewIndex(i)}
              className={clsx(
                'relative h-20 w-20 shrink-0 overflow-hidden border-2 lg:h-auto lg:w-full lg:aspect-square',
                (viewIndex === null ? i === panels.length - 1 : viewIndex === i)
                  ? 'border-clay-500'
                  : 'border-brown-700',
              )}
            >
              {p.imageUrl ? (
                <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-xs text-brown-400">
                  绘制中
                </span>
              )}
              <span className="absolute left-0 top-0 bg-brown-900/80 px-1 text-xs text-brown-100">
                {i + 1}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brown-500 border-t-clay-300" />
  );
}

// 纯 CSS 奖章（不引入图标依赖）。
function Medallion({ title, large }: { title: string; large?: boolean }) {
  const ch = title.trim().charAt(0) || '章';
  return (
    <span
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-brown-300 to-clay-700 font-display text-brown-900 shadow-solid',
        large ? 'h-20 w-20 text-3xl' : 'h-10 w-10 text-lg',
      )}
    >
      {ch}
    </span>
  );
}
