import { useMemo, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { ActivityDescriptor, activityFromSchedule, enterActivity } from '../lib/activityEnter';
import { getAnonUserId } from '../lib/identity';
import { Avatar } from '../lib/avatars';
import { SCHEDULE } from '../../data/schedule';
import ComicPoster from './ComicPoster';
import clsx from 'clsx';

// 进入某个活动的专属游戏。游戏隶属于该活动且独立。
export default function Experience({
  activity,
  onExit,
}: {
  activity: ActivityDescriptor;
  onExit: () => void;
}) {
  const userId = useMemo(getAnonUserId, []);
  const profile = useQuery(api.profile.getProfile, { userId });
  const [experienceId, setExperienceId] = useState<Id<'experiences'> | null>(null);

  if (!experienceId) {
    return (
      <ActivityIntro
        activity={activity}
        userId={userId}
        userName={profile?.name ?? '候鸟'}
        avatarUrl={profile?.avatarUrl ?? null}
        avatarPreset={profile?.avatarPreset ?? null}
        onStart={setExperienceId}
        onExit={onExit}
      />
    );
  }
  return (
    <ComicPlayer
      experienceId={experienceId}
      activity={activity}
      onExit={onExit}
      onReplay={() => setExperienceId(null)}
    />
  );
}

// ---------- 活动介绍 + 开始 + 本活动勋章墙 ----------
function ActivityIntro({
  activity,
  userId,
  userName,
  avatarUrl,
  avatarPreset,
  onStart,
  onExit,
}: {
  activity: ActivityDescriptor;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  avatarPreset: string | null;
  onStart: (id: Id<'experiences'>) => void;
  onExit: () => void;
}) {
  const badges = useQuery(api.experience.activityBadges, { activityKey: activity.activityKey });
  const start = useAction(api.experience.startActivityExperience);
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      const id = await start({ activity, userId, userName });
      onStart(id);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-brown-900 px-6 py-8 text-brown-100">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar url={avatarUrl} preset={avatarPreset} size="sm" />
            <span className="text-sm text-brown-200">{userName}</span>
          </div>
          <button className="text-sm text-brown-300 underline" onClick={onExit}>
            返回小镇
          </button>
        </div>

        <h1 className="font-display game-title mb-2 text-4xl">{activity.title}</h1>
        <p className="mb-1 text-brown-200">{activity.theme}</p>
        {activity.hostName && <p className="mb-4 text-sm text-brown-300">场地 · {activity.hostName}</p>}
        <p className="mb-6 whitespace-pre-wrap rounded-lg bg-brown-800 p-3 text-sm leading-relaxed text-brown-200">
          {activity.background}
        </p>

        <button
          className="rounded bg-clay-700 px-5 py-2.5 font-display text-white hover:bg-clay-500 disabled:opacity-50"
          disabled={starting}
          onClick={() => void handleStart()}
        >
          {starting ? '正在生成首幕…' : '开始体验'}
        </button>

        {badges && badges.length > 0 && (
          <div className="mt-10">
            <h2 className="font-display mb-3 text-2xl text-brown-100">
              本活动勋章墙 · {badges.length} 人完成
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {badges.map((b) => (
                <div key={b._id} className="flex items-center gap-3 border-2 border-brown-700 bg-brown-800 p-3">
                  <Avatar url={b.avatarUrl} preset={b.avatarPreset} size="md" />
                  <div className="min-w-0">
                    <p className="truncate font-display text-brown-100">{b.title}</p>
                    <p className="truncate text-xs text-brown-300">{b.userName}</p>
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
  activity,
  onExit,
  onReplay,
}: {
  experienceId: Id<'experiences'>;
  activity: ActivityDescriptor;
  onExit: () => void;
  onReplay: () => void;
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
            返回小镇
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

        {/* 完成 -> 勋章 + 收尾交互 */}
        {experience.status === 'completed' && badge && (
          <EndScreen
            experienceId={experienceId}
            activity={activity}
            badge={badge}
            panels={panels}
            onReplay={onReplay}
            onExit={onExit}
          />
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

// ---------- 末幕收尾：勋章 + 题词 + 长图 + 别人的结局 + 推荐 ----------
function EndScreen({
  experienceId,
  activity,
  badge,
  panels,
  onReplay,
  onExit,
}: {
  experienceId: Id<'experiences'>;
  activity: ActivityDescriptor;
  badge: { title: string; summary: string; reflection?: string; userName: string };
  panels: { _id: string; imageUrl: string | null; narration: string }[];
  onReplay: () => void;
  onExit: () => void;
}) {
  const saveReflection = useMutation(api.experience.saveReflection);
  const others = useQuery(api.experience.activityBadges, { activityKey: activity.activityKey });
  const [reflection, setReflection] = useState(badge.reflection ?? '');
  const [saved, setSaved] = useState(false);
  const [showPoster, setShowPoster] = useState(false);
  const [showOthers, setShowOthers] = useState(false);

  // 推荐下一个活动：先同场地，再同分类，去重去自身，最多 3 个。
  const recs = useMemo(() => {
    const seen = new Set<string>([activity.title]);
    const out: (typeof SCHEDULE)[number][] = [];
    const pick = (pred: (s: (typeof SCHEDULE)[number]) => boolean) => {
      for (const s of SCHEDULE) {
        if (out.length >= 3) break;
        if (seen.has(s.title) || !pred(s)) continue;
        seen.add(s.title);
        out.push(s);
      }
    };
    pick((s) => s.venue === activity.hostName);
    pick((s) => s.cat === activity.category);
    return out;
  }, [activity]);

  const onSaveReflection = async () => {
    await saveReflection({ experienceId, text: reflection.trim() });
    setSaved(true);
  };

  return (
    <div className="mx-auto mt-6 w-full max-w-2xl space-y-4">
      {/* 勋章 */}
      <div className="flex flex-col items-center gap-3 border-2 border-clay-500 bg-brown-800 p-6 text-center">
        <Medallion title={badge.title} large />
        <p className="font-display text-2xl text-brown-100">{badge.title}</p>
        <p className="text-brown-200">{badge.summary}</p>
        <p className="text-sm text-brown-400">
          点击<span className="lg:hidden">下方</span>
          <span className="hidden lg:inline">右侧</span>任意一幕可回看你的连环画。
        </p>
      </div>

      {/* 题词 */}
      <div className="border-2 border-brown-700 bg-brown-800 p-4">
        <p className="mb-2 font-display text-brown-100">留下一句题词</p>
        <textarea
          className="w-full resize-none rounded border-2 border-brown-700 bg-brown-900 px-3 py-2 text-sm text-brown-100 placeholder:text-brown-500"
          rows={2}
          maxLength={60}
          placeholder="为这段旅程写一句话，会留在勋章墙上…"
          value={reflection}
          onChange={(e) => {
            setReflection(e.target.value);
            setSaved(false);
          }}
        />
        <button
          onClick={() => void onSaveReflection()}
          disabled={!reflection.trim()}
          className="mt-2 rounded bg-clay-700 px-4 py-1.5 text-sm font-bold text-white hover:bg-clay-500 disabled:opacity-50"
        >
          {saved ? '已保存' : '保存题词'}
        </button>
      </div>

      {/* 主行动 */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setShowPoster(true)}
          className="rounded bg-clay-700 px-4 py-2.5 font-display text-white hover:bg-clay-500"
        >
          生成连环画长图
        </button>
        <button
          onClick={() => setShowOthers((v) => !v)}
          className="rounded border-2 border-brown-700 px-4 py-2.5 font-display text-brown-100 hover:border-clay-500"
        >
          看别人的结局{others ? `（${others.length}）` : ''}
        </button>
        <button
          onClick={onReplay}
          className="rounded border-2 border-brown-700 px-4 py-2.5 font-display text-brown-100 hover:border-clay-500"
        >
          再玩一次（全新结局）
        </button>
        <button
          onClick={onExit}
          className="rounded border-2 border-brown-700 px-4 py-2.5 font-display text-brown-100 hover:border-clay-500"
        >
          返回小镇
        </button>
      </div>

      {/* 别人的结局 */}
      {showOthers && others && (
        <div className="space-y-2">
          {others.length === 0 && (
            <p className="text-sm text-brown-400">还没有别人完成这个活动，你是第一个。</p>
          )}
          {others.map((b) => (
            <div key={b._id} className="flex gap-3 border-2 border-brown-700 bg-brown-800 p-3">
              {b.endingImageUrl && (
                <img src={b.endingImageUrl} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Avatar url={b.avatarUrl} preset={b.avatarPreset} size="sm" />
                  <span className="truncate text-sm text-brown-200">{b.userName}</span>
                  <span className="shrink-0 font-display text-sm text-clay-100">· {b.title}</span>
                </div>
                {b.reflection && (
                  <p className="mt-1 truncate text-xs italic text-brown-300">「{b.reflection}」</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 推荐下一个活动 */}
      {recs.length > 0 && (
        <div className="border-2 border-brown-700 bg-brown-800 p-4">
          <p className="mb-2 font-display text-brown-100">接着探索</p>
          <div className="space-y-2">
            {recs.map((s, i) => (
              <button
                key={i}
                onClick={() => enterActivity(activityFromSchedule(s))}
                className="block w-full rounded border border-brown-700 px-3 py-2 text-left text-sm text-brown-100 hover:border-clay-500"
              >
                <span className="text-brown-300">
                  {s.cat} · {s.venue}
                </span>
                <br />
                {s.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {showPoster && (
        <ComicPoster
          title={activity.title}
          userName={badge.userName}
          badgeTitle={badge.title}
          badgeSummary={badge.summary}
          panels={panels.map((p) => ({ imageUrl: p.imageUrl, narration: p.narration }))}
          onClose={() => setShowPoster(false)}
        />
      )}
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
