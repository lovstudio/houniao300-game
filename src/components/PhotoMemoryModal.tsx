import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { toast } from 'react-toastify';
import clsx from 'clsx';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

// Convex 部署的 Dashboard 日志链接（best-effort，从 client 的 Convex URL 推导出 slug）。
const CONVEX_LOG_URL = (() => {
  try {
    const u = new URL(import.meta.env.VITE_CONVEX_URL as string);
    const slug = u.hostname.split('.')[0];
    return `https://dashboard.convex.dev/d/${slug}/logs`;
  } catch {
    return 'https://dashboard.convex.dev';
  }
})();

type ConvTurn = {
  _id: Id<'photoMemoryTurns'>;
  index: number;
  userPrompt: string | null;
  useSystemStyle: boolean;
  status: 'pending' | 'ready' | 'failed';
  imageUrl: string | null;
  trace: string | null;
  createdAt: number;
};

export type PhotoMemoryContext = {
  contextLabel: string;
  activityKey?: string;
  activityTitle?: string;
  venue?: string;
};

export type PhotoMemoryLocationOption = PhotoMemoryContext & {
  id: string;
  label: string;
  detail?: string;
};

type PhotoMemoryItem = {
  _id: Id<'photoMemories'>;
  userId: string;
  userName: string;
  title: string;
  imageUrl: string | null;
  images: string[]; // 这条记忆的每一张生成图（所有就绪轮），按 index 顺序
  originalUrl: string | null;
  shared: boolean;
  createdAt: number;
  activityTitle?: string;
  venue?: string;
  contextLabel?: string;
};

type Tab = 'upload' | 'mine' | 'shared';

function formatDate(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function imageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('无法读取这张照片，请换一张常见图片格式'));
    img.src = url;
  });
}

async function fileToPngBlob(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('目前请上传照片文件');
  const url = URL.createObjectURL(file);
  try {
    const img = await imageFromUrl(url);
    const maxSide = 1536;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('浏览器无法处理这张照片');
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('照片转换失败，请重新选择'));
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PhotoMemoryModal({
  open,
  onClose,
  userId,
  userName,
  context,
  locationOptions,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  context: PhotoMemoryContext;
  locationOptions?: PhotoMemoryLocationOption[];
}) {
  const [tab, setTab] = useState<Tab>('upload');
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [useSystemStyle, setUseSystemStyle] = useState(true); // 默认套用沙之书风格
  const [sharePublic, setSharePublic] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false); // 上传+建记录的短暂请求
  const [lastMemoryId, setLastMemoryId] = useState<Id<'photoMemories'> | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null); // 点击查看大图

  const generateUploadUrl = useMutation(api.photoMemories.generateUploadUrl);
  const createPhotoMemory = useMutation(api.photoMemories.createPhotoMemory);
  const askPhotoMemory = useMutation(api.photoMemories.askPhotoMemory);
  const setPhotoMemoryShared = useMutation(api.photoMemories.setPhotoMemoryShared);
  const mine = useQuery(api.photoMemories.listMyPhotoMemories, open ? { userId } : 'skip');
  const shared = useQuery(api.photoMemories.listSharedPhotoMemories, open ? {} : 'skip');
  // 订阅当前这条记忆的"追问对话"，看后台逐轮生成进度（避免 over-WS 等待长 action）。
  const live = useQuery(
    api.photoMemories.getPhotoConversation,
    lastMemoryId ? { memoryId: lastMemoryId } : 'skip',
  );

  const turns: ConvTurn[] = live?.turns ?? [];
  const latestTurn = turns[turns.length - 1];
  const latestReady = [...turns].reverse().find((t) => t.status === 'ready');
  // 派生状态：是否正在出图、最新结果图、是否失败。
  const generating =
    !!lastMemoryId && (submitting || live === undefined || latestTurn?.status === 'pending');
  const generatedUrl = latestReady?.imageUrl ?? null;
  const failed = latestTurn?.status === 'failed';

  // Debug：每轮 turn 出结果时，前端 console 打印可追踪信息 + Convex 日志链接。
  const loggedTurns = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const t of turns) {
      if (t.status === 'pending' || loggedTurns.current.has(t._id)) continue;
      loggedTurns.current.add(t._id);
      let parsed: unknown = t.trace;
      try {
        parsed = t.trace ? JSON.parse(t.trace) : null;
      } catch {
        /* keep raw */
      }
      // eslint-disable-next-line no-console
      console.log(
        `%c[照片记忆][trace] turn#${t.index} ${t.status}`,
        'color:#c0654a;font-weight:bold',
        {
          memoryId: lastMemoryId,
          prompt: t.userPrompt,
          useSystemStyle: t.useSystemStyle,
          ...(typeof parsed === 'object' && parsed ? parsed : { trace: parsed }),
          平台日志: CONVEX_LOG_URL,
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns.map((t) => `${t._id}:${t.status}`).join(',')]);

  const normalizedLocationOptions = useMemo<PhotoMemoryLocationOption[]>(() => {
    const fallback: PhotoMemoryLocationOption = {
      id: 'fallback-location',
      label: context.contextLabel || context.venue || context.activityTitle || '候鸟沙城',
      detail: [context.venue, context.activityTitle].filter(Boolean).join(' · ') || undefined,
      ...context,
    };
    const deduped = new Map<string, PhotoMemoryLocationOption>();
    for (const option of locationOptions && locationOptions.length > 0 ? locationOptions : [fallback]) {
      deduped.set(option.id, option);
    }
    if (deduped.size === 0) deduped.set(fallback.id, fallback);
    return [...deduped.values()];
  }, [context, locationOptions]);

  const selectedContext =
    normalizedLocationOptions.find((option) => option.id === selectedLocationId) ??
    normalizedLocationOptions[0];

  const contextLine = useMemo(() => {
    const bits = [
      selectedContext?.venue,
      selectedContext?.activityTitle ?? selectedContext?.contextLabel,
    ].filter(Boolean);
    return bits.length > 0 ? bits.join(' · ') : '候鸟沙城';
  }, [selectedContext]);

  useEffect(() => {
    if (!open) return;
    setSelectedLocationId((current) => {
      if (current && normalizedLocationOptions.some((option) => option.id === current)) {
        return current;
      }
      return normalizedLocationOptions[0]?.id ?? null;
    });
  }, [normalizedLocationOptions, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // 看大图时，Esc 先关大图，不关整个弹窗。
      if (viewerUrl) setViewerUrl(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open, viewerUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!open) return null;

  const chooseFile = (next: File | undefined) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setLastMemoryId(null);
    setFile(next ?? null);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
    if (next && !title.trim()) setTitle(next.name.replace(/\.[^.]+$/, '').slice(0, 24));
  };

  // 生成后重置，准备做下一张（已生成的那张已存进「我的相册」）。
  const resetForNew = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setLastMemoryId(null);
    setPrompt('');
    setTitle('');
  };

  // 上传原图 + 建一条 pending 记忆并触发后台生成；进度靠 live 订阅，不在此 await 长任务。
  const submit = async () => {
    if (!file || submitting || generating) return;
    setSubmitting(true);
    try {
      const png = await fileToPngBlob(file);
      const uploadUrl = await generateUploadUrl();
      const upload = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: png,
      });
      if (!upload.ok) throw new Error(`照片上传失败 ${upload.status}`);
      const { storageId } = (await upload.json()) as { storageId?: string };
      if (!storageId) throw new Error('照片上传后没有返回 storageId');
      const result = await createPhotoMemory({
        userId,
        userName,
        title,
        originalStorageId: storageId,
        sharePublic,
        context: {
          activityKey: selectedContext?.activityKey,
          activityTitle: selectedContext?.activityTitle,
          venue: selectedContext?.venue,
          contextLabel: selectedContext?.contextLabel,
        },
        userPrompt: prompt.trim() || undefined,
        useSystemStyle,
      });
      setLastMemoryId(result.memoryId);
      setPrompt(''); // 首轮提示词已提交，清空输入框，等着继续追问
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : '照片提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 追问：在同一条记忆上追加一轮，始终以原图为参考、累积文字上下文（不覆盖历史）。
  const ask = async () => {
    if (!lastMemoryId || !prompt.trim() || generating) return;
    const text = prompt.trim();
    setPrompt('');
    try {
      await askPhotoMemory({ memoryId: lastMemoryId, userId, userPrompt: text, useSystemStyle });
    } catch (e) {
      console.error(e);
      setPrompt(text); // 失败把输入还给用户
      toast.error(e instanceof Error ? e.message : '追问失败');
    }
  };

  const toggleShared = async (item: PhotoMemoryItem) => {
    try {
      await setPhotoMemoryShared({ memoryId: item._id, userId, shared: !item.shared });
      toast.success(!item.shared ? '已共享到公共相册' : '已设为仅自己可见');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '共享设置失败');
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/80 px-3 py-5 text-brown-100 backdrop-blur-sm sm:px-6">
      <div className="w-full max-w-5xl overflow-hidden border-2 border-brown-700 bg-brown-900 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b-2 border-brown-700 bg-brown-900/95 px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-display text-2xl leading-none text-brown-100 sm:text-3xl">照片记忆</h2>
            <p className="mt-1 truncate text-xs text-brown-300">{contextLine}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border-2 border-brown-700 px-3 py-1.5 text-sm text-brown-100 hover:border-clay-500"
          >
            关闭
          </button>
        </div>

        <div className="flex gap-2 border-b-2 border-brown-700 bg-brown-800 px-3 py-2">
          <TabButton active={tab === 'upload'} onClick={() => setTab('upload')}>生成</TabButton>
          <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>我的相册</TabButton>
          <TabButton active={tab === 'shared'} onClick={() => setTab('shared')}>公共相册</TabButton>
        </div>

        <div className="max-h-[calc(100vh-170px)] overflow-y-auto p-4 sm:p-5">
          {tab === 'upload' && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="overflow-hidden border-2 border-brown-700 bg-brown-800">
                <div className="aspect-square bg-brown-900">
                  {generatedUrl ? (
                    <button
                      type="button"
                      onClick={() => setViewerUrl(generatedUrl)}
                      className="block h-full w-full"
                      title="点击查看大图"
                    >
                      <img src={generatedUrl} alt="" className="h-full w-full object-cover" />
                    </button>
                  ) : previewUrl ? (
                    <div className="relative h-full w-full">
                      <img
                        src={previewUrl}
                        alt=""
                        className="h-full w-full object-cover opacity-90"
                      />
                      {generating && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 text-brown-100">
                          <span className="h-6 w-6 animate-spin rounded-full border-2 border-brown-500 border-t-clay-300" />
                          <span className="text-sm">正在生成…</span>
                        </div>
                      )}
                      {failed && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/55 px-6 text-center text-sm text-brown-100">
                          生成失败，可改提示词后重试
                        </div>
                      )}
                    </div>
                  ) : (
                    <label className="flex h-full cursor-pointer flex-col items-center justify-center gap-3 px-6 text-center text-brown-300 hover:bg-brown-800/70">
                      <span className="font-display text-2xl text-brown-100">选择真实照片</span>
                      <span className="text-sm">上传后会自动生成沙之书风格照片</span>
                      <input
                        className="hidden"
                        type="file"
                        accept="image/*"
                        onChange={(e) => chooseFile(e.target.files?.[0])}
                      />
                    </label>
                  )}
                </div>
                {previewUrl && (
                  <label className="block cursor-pointer border-t-2 border-brown-700 px-3 py-2 text-center text-sm text-brown-200 hover:bg-brown-700/40">
                    重新选择照片
                    <input
                      className="hidden"
                      type="file"
                      accept="image/*"
                      onChange={(e) => chooseFile(e.target.files?.[0])}
                    />
                  </label>
                )}
              </div>

              {!lastMemoryId ? (
                // 生成前：表单
                <div className="space-y-4 border-2 border-brown-700 bg-brown-800 p-4">
                  <div>
                    <label className="mb-1 block text-sm text-brown-300">记忆名</label>
                    <input
                      className="w-full rounded border-2 border-brown-700 bg-brown-900 px-3 py-2 text-brown-100 placeholder:text-brown-500"
                      maxLength={32}
                      value={title}
                      placeholder="比如：篝火前的一刻"
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-brown-300">提示词（可选）</label>
                    <textarea
                      className="w-full resize-none rounded border-2 border-brown-700 bg-brown-900 px-3 py-2 text-sm text-brown-100 placeholder:text-brown-500"
                      rows={2}
                      maxLength={280}
                      value={prompt}
                      placeholder="想怎么呈现？比如：加上夕阳、戴草帽、更梦幻一些"
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-brown-300">位置</label>
                    <select
                      className="w-full rounded border-2 border-brown-700 bg-brown-900 px-3 py-2 text-brown-100"
                      value={selectedContext?.id ?? ''}
                      onChange={(e) => setSelectedLocationId(e.target.value)}
                    >
                      {normalizedLocationOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                          {option.detail ? ` · ${option.detail}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 truncate text-xs text-brown-400">{contextLine}</p>
                  </div>
                  <label className="flex cursor-pointer items-start gap-2 rounded border border-brown-700 bg-brown-900/60 p-3 text-sm text-brown-200 hover:border-clay-500">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-brown-600 bg-brown-900 text-clay-600"
                      checked={useSystemStyle}
                      onChange={(e) => setUseSystemStyle(e.target.checked)}
                    />
                    <span>
                      套用「沙之书」系统风格
                      <span className="mt-0.5 block text-xs text-brown-400">
                        取消则只保留人物身份，场景与风格完全由你的提示词决定（更自由）。
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded border border-brown-700 bg-brown-900/60 p-3 text-sm text-brown-200 hover:border-clay-500">
                    <input
                      type="checkbox"
                      className="rounded border-brown-600 bg-brown-900 text-clay-600"
                      checked={sharePublic}
                      onChange={(e) => setSharePublic(e.target.checked)}
                    />
                    生成后共享给所有人可见
                  </label>
                  <button
                    type="button"
                    disabled={!file || submitting}
                    onClick={() => void submit()}
                    className="w-full rounded bg-clay-700 px-4 py-3 font-display text-lg text-white hover:bg-clay-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? '正在提交…' : '生成'}
                  </button>
                </div>
              ) : (
                // 生成后：追问对话（chat sidebar）
                <div className="flex max-h-[70vh] flex-col border-2 border-brown-700 bg-brown-800">
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-brown-700 px-3 py-2">
                    <span className="font-display text-brown-100">追问 · 让画面继续演化</span>
                    <button
                      type="button"
                      disabled={generating}
                      onClick={resetForNew}
                      className="shrink-0 rounded border-2 border-brown-700 px-2.5 py-1 text-xs text-brown-100 hover:border-clay-500 disabled:opacity-50"
                    >
                      再做一张新的
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                    {turns.map((t) => (
                      <ChatTurn key={t._id} turn={t} onView={setViewerUrl} />
                    ))}
                  </div>

                  <div className="shrink-0 space-y-2 border-t-2 border-brown-700 p-3">
                    <textarea
                      className="w-full resize-none rounded border-2 border-brown-700 bg-brown-900 px-3 py-2 text-sm text-brown-100 placeholder:text-brown-500"
                      rows={2}
                      maxLength={280}
                      value={prompt}
                      placeholder="继续追问，让画面演化…（始终基于你的原始照片）"
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void ask();
                      }}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-brown-300">
                        <input
                          type="checkbox"
                          className="rounded border-brown-600 bg-brown-900 text-clay-600"
                          checked={useSystemStyle}
                          onChange={(e) => setUseSystemStyle(e.target.checked)}
                        />
                        沙之书风格
                      </label>
                      <button
                        type="button"
                        disabled={!prompt.trim() || generating}
                        onClick={() => void ask()}
                        className="rounded bg-clay-700 px-4 py-2 text-sm font-bold text-white hover:bg-clay-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {generating ? '生成中…' : '追问'}
                      </button>
                    </div>
                    <a
                      href={CONVEX_LOG_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-right text-[11px] text-brown-400 underline hover:text-clay-300"
                    >
                      查看平台日志（Convex Logs）
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'mine' && (
            <MemoryGrid
              items={mine}
              loading={mine === undefined}
              empty="还没有照片记忆。"
              canToggle
              onToggle={toggleShared}
              onView={setViewerUrl}
            />
          )}

          {tab === 'shared' && (
            <MemoryGrid
              items={shared}
              loading={shared === undefined}
              empty="还没有公开的照片记忆。"
              onView={setViewerUrl}
            />
          )}
        </div>
      </div>

      {/* 点击查看大图：完整展示（object-contain，不裁切），点背景/✕/Esc 关闭 */}
      {viewerUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setViewerUrl(null)}
        >
          <img
            src={viewerUrl}
            alt=""
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setViewerUrl(null)}
            className="absolute right-4 top-4 rounded border-2 border-white/40 bg-black/40 px-3 py-1.5 text-sm text-white hover:border-white"
          >
            关闭
          </button>
        </div>
      )}
    </div>
  );
}

function parseTrace(s: string | null): Record<string, unknown> | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// 追问对话里的一条：提示词 + 生成图（可点查看）+ 一行 debug trace 摘要。
function ChatTurn({ turn, onView }: { turn: ConvTurn; onView: (url: string) => void }) {
  const tr = parseTrace(turn.trace);
  const num = (v: unknown) => (typeof v === 'number' ? Math.round(v) : null);
  return (
    <div className="rounded-lg border border-brown-700/60 bg-brown-900/40 p-2">
      <div className="mb-1.5 flex items-center gap-2 text-xs text-brown-300">
        <span className="shrink-0 rounded bg-brown-700/60 px-1.5 py-0.5 text-[10px]">
          #{turn.index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate">
          {turn.userPrompt || (turn.index === 0 ? '首轮生成' : '继续演化')}
        </span>
        {!turn.useSystemStyle && (
          <span className="shrink-0 rounded bg-brown-700 px-1 text-[10px] text-brown-300">自由风格</span>
        )}
      </div>
      <div className="aspect-square overflow-hidden rounded bg-brown-900">
        {turn.status === 'ready' && turn.imageUrl ? (
          <button
            type="button"
            onClick={() => onView(turn.imageUrl as string)}
            className="block h-full w-full"
            title="点击查看大图"
          >
            <img src={turn.imageUrl} alt="" className="h-full w-full object-cover" />
          </button>
        ) : turn.status === 'failed' ? (
          <div className="flex h-full items-center justify-center text-xs text-brown-400">
            生成失败
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-brown-400">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-brown-600 border-t-clay-300" />
            正在生成…
          </div>
        )}
      </div>
      {tr && num(tr.apiMs) !== null && (
        <p className="mt-1 truncate text-[10px] text-brown-500">
          {String(tr.model ?? '')} · API {num(tr.apiMs)}ms
          {num(tr.retries) ? ` · 重试${num(tr.retries)}` : ''}
          {num(tr.totalMs) !== null ? ` · 总${num(tr.totalMs)}ms` : ''}
        </p>
      )}
      {tr && typeof tr.error === 'string' && (
        <p className="mt-1 truncate text-[10px] text-red-400">{tr.error}</p>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded px-3 py-1.5 text-sm font-bold',
        active ? 'bg-clay-700 text-white' : 'text-brown-300 hover:bg-brown-700/60 hover:text-brown-100',
      )}
    >
      {children}
    </button>
  );
}

function MemoryGrid({
  items,
  loading,
  empty,
  canToggle = false,
  onToggle,
  onView,
}: {
  items: PhotoMemoryItem[] | undefined;
  loading: boolean;
  empty: string;
  canToggle?: boolean;
  onToggle?: (item: PhotoMemoryItem) => Promise<void>;
  onView?: (url: string) => void;
}) {
  if (loading) return <div className="flex h-48 items-center justify-center text-brown-300">翻找相册中…</div>;
  if (!items || items.length === 0) {
    return <div className="flex h-48 items-center justify-center text-brown-400">{empty}</div>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <article key={item._id} className="overflow-hidden border-2 border-brown-700 bg-brown-800">
          <div className="bg-brown-900 p-1.5">
            {item.images.length ? (
              <div
                className={clsx(
                  'grid gap-1',
                  item.images.length === 1 ? 'grid-cols-1' : 'grid-cols-3',
                )}
              >
                {item.images.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onView?.(url)}
                    className="group relative block aspect-square overflow-hidden rounded"
                    title="点击查看大图"
                  >
                    <img
                      src={url}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:opacity-90"
                    />
                    {item.images.length > 1 && (
                      <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/55 px-1 text-[10px] text-white">
                        {i + 1}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center text-brown-400">
                图片读取中
              </div>
            )}
          </div>
          <div className="space-y-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-display text-lg text-brown-100">
                  {item.title}
                  {item.images.length > 1 && (
                    <span className="ml-1.5 align-middle text-xs text-brown-400">
                      {item.images.length} 版
                    </span>
                  )}
                </h3>
                <p className="truncate text-xs text-brown-300">
                  {item.userName} · {formatDate(item.createdAt)}
                </p>
              </div>
              <span className={clsx('shrink-0 rounded px-2 py-0.5 text-[11px]', item.shared ? 'bg-clay-700 text-white' : 'bg-brown-900 text-brown-300')}>
                {item.shared ? '公开' : '私密'}
              </span>
            </div>
            {(item.activityTitle || item.venue || item.contextLabel) && (
              <p className="truncate text-xs text-brown-400">
                {[item.venue, item.activityTitle ?? item.contextLabel].filter(Boolean).join(' · ')}
              </p>
            )}
            {canToggle && onToggle && (
              <button
                type="button"
                onClick={() => void onToggle(item)}
                className="w-full rounded border border-brown-700 px-3 py-1.5 text-sm text-brown-100 hover:border-clay-500"
              >
                {item.shared ? '设为仅自己可见' : '共享给所有人'}
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
