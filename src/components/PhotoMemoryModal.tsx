import { useEffect, useMemo, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { toast } from 'react-toastify';
import clsx from 'clsx';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

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
  const [sharePublic, setSharePublic] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastImageUrl, setLastImageUrl] = useState<string | null>(null);
  const [lastMemoryId, setLastMemoryId] = useState<Id<'photoMemories'> | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const generateUploadUrl = useMutation(api.photoMemories.generateUploadUrl);
  const generatePhotoMemory = useAction(api.photoMemories.generatePhotoMemory);
  const refinePhotoMemory = useAction(api.photoMemories.refinePhotoMemory);
  const setPhotoMemoryShared = useMutation(api.photoMemories.setPhotoMemoryShared);
  const mine = useQuery(api.photoMemories.listMyPhotoMemories, open ? { userId } : 'skip');
  const shared = useQuery(api.photoMemories.listSharedPhotoMemories, open ? {} : 'skip');

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
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!open) return null;

  const chooseFile = (next: File | undefined) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setLastImageUrl(null);
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
    setLastImageUrl(null);
    setLastMemoryId(null);
    setPrompt('');
    setTitle('');
  };

  const submit = async () => {
    if (!file || busy) return;
    setBusy(true);
    setLastImageUrl(null);
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
      const result = await generatePhotoMemory({
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
      });
      setLastImageUrl(result.imageUrl);
      setLastMemoryId(result.memoryId);
      toast.success(`已生成「${title.trim() || selectedContext?.activityTitle || '沙城照片'}」`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : '照片生成失败');
    } finally {
      setBusy(false);
    }
  };

  // 生成后按提示词在原图基础上重绘，覆盖同一条记忆。
  const refine = async () => {
    if (!lastMemoryId || !prompt.trim() || busy) return;
    setBusy(true);
    try {
      const result = await refinePhotoMemory({
        memoryId: lastMemoryId,
        userId,
        userPrompt: prompt.trim(),
      });
      setLastImageUrl(result.imageUrl);
      toast.success('已按提示词重绘');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : '重绘失败');
    } finally {
      setBusy(false);
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
                  {lastImageUrl ? (
                    <img src={lastImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : previewUrl ? (
                    <img src={previewUrl} alt="" className="h-full w-full object-cover opacity-90" />
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
                  <label className="mb-1 block text-sm text-brown-300">
                    提示词（可选）
                    {lastMemoryId && <span className="ml-1 text-brown-400">· 改完点重绘即可</span>}
                  </label>
                  <textarea
                    className="w-full resize-none rounded border-2 border-brown-700 bg-brown-900 px-3 py-2 text-sm text-brown-100 placeholder:text-brown-500"
                    rows={2}
                    maxLength={280}
                    value={prompt}
                    placeholder="想怎么风格化？比如：加上夕阳、戴草帽、更梦幻一些"
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
                {!lastMemoryId && (
                  <label className="flex cursor-pointer items-center gap-2 rounded border border-brown-700 bg-brown-900/60 p-3 text-sm text-brown-200 hover:border-clay-500">
                    <input
                      type="checkbox"
                      className="rounded border-brown-600 bg-brown-900 text-clay-600"
                      checked={sharePublic}
                      onChange={(e) => setSharePublic(e.target.checked)}
                    />
                    生成后共享给所有人可见
                  </label>
                )}

                {!lastMemoryId ? (
                  <button
                    type="button"
                    disabled={!file || busy}
                    onClick={() => void submit()}
                    className="w-full rounded bg-clay-700 px-4 py-3 font-display text-lg text-white hover:bg-clay-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? '正在生成…' : '生成沙之书照片'}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-brown-400">
                      已生成并存入「我的相册」。改提示词后可在原图基础上重绘，覆盖这张。
                    </p>
                    <button
                      type="button"
                      disabled={!prompt.trim() || busy}
                      onClick={() => void refine()}
                      className="w-full rounded bg-clay-700 px-4 py-3 font-display text-lg text-white hover:bg-clay-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? '正在重绘…' : '按提示词重绘'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={resetForNew}
                      className="w-full rounded border-2 border-brown-700 px-4 py-2.5 text-sm text-brown-100 hover:border-clay-500 disabled:opacity-50"
                    >
                      再做一张新的
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'mine' && (
            <MemoryGrid
              items={mine}
              loading={mine === undefined}
              empty="还没有照片记忆。"
              canToggle
              onToggle={toggleShared}
            />
          )}

          {tab === 'shared' && (
            <MemoryGrid
              items={shared}
              loading={shared === undefined}
              empty="还没有公开的照片记忆。"
            />
          )}
        </div>
      </div>
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
}: {
  items: PhotoMemoryItem[] | undefined;
  loading: boolean;
  empty: string;
  canToggle?: boolean;
  onToggle?: (item: PhotoMemoryItem) => Promise<void>;
}) {
  if (loading) return <div className="flex h-48 items-center justify-center text-brown-300">翻找相册中…</div>;
  if (!items || items.length === 0) {
    return <div className="flex h-48 items-center justify-center text-brown-400">{empty}</div>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <article key={item._id} className="overflow-hidden border-2 border-brown-700 bg-brown-800">
          <div className="aspect-square bg-brown-900">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-brown-400">图片读取中</div>
            )}
          </div>
          <div className="space-y-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-display text-lg text-brown-100">{item.title}</h3>
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
