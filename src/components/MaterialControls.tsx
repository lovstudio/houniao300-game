import { useRef, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

// 物料生成控件：嵌在「空间」/「作品」详情底部。
// 展示原始输入图、支持上传/替换，并调用 Scale（vision 管线）生成游戏资产（内景几何 / 作品图注）。
type Kind = 'venue' | 'work';

type MaterialDoc = {
  key: string;
  status: 'idle' | 'generating' | 'ready' | 'error';
  sourceUrl: string | null;
  sourceName?: string;
  capturedAt?: string;
  generated?: string;
  error?: string;
};

const STATUS_LABEL: Record<MaterialDoc['status'], { text: string; cls: string }> = {
  idle: { text: '待生成', cls: 'bg-[#dcc89f] text-[#5b4632]' },
  generating: { text: '生成中', cls: 'bg-clay-700 text-white animate-pulse' },
  ready: { text: '已生成', cls: 'bg-[#1da76e] text-white' },
  error: { text: '失败', cls: 'bg-[#b3433a] text-white' },
};

export default function MaterialControls({
  kind,
  refId,
  title,
  genLabel,
}: {
  kind: Kind;
  refId: string;
  title: string;
  /** 生成按钮文案，例如「用 Scale 生成内景」「生成游戏资产」 */
  genLabel: string;
}) {
  const key = `${kind}:${refId}`;
  const docs = useQuery(api.materials.list, { kind });
  const doc = docs?.find((d) => d.key === key) as MaterialDoc | undefined;

  const genUploadUrl = useMutation(api.materials.generateUploadUrl);
  const attachSource = useMutation(api.materials.attachSource);
  const regenerate = useAction(api.materials.regenerate);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'gen' | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [open, setOpen] = useState(false);

  const status = doc?.status ?? 'idle';
  const badge = STATUS_LABEL[status];
  const sourceUrl = doc?.sourceUrl ?? null;
  const loading = docs === undefined;

  async function onPick(file: File) {
    setBusy('upload');
    try {
      const postUrl = await genUploadUrl();
      const res = await fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`上传失败 ${res.status}`);
      const { storageId } = (await res.json()) as { storageId: string };
      await attachSource({
        key,
        kind,
        refId,
        title,
        storageId,
        sourceName: file.name,
        capturedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      });
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onRegenerate() {
    setBusy('gen');
    try {
      const r = await regenerate({ key });
      if (!r.ok && r.error) alert(r.error);
    } finally {
      setBusy(null);
    }
  }

  // 折叠态：与详情页其它操作一致，点击后才展开生成面板，避免一进来就铺满。
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 flex w-full items-center gap-2 rounded-lg border-2 border-[#cbb287] bg-[#f3e7cb] px-3 py-2.5 text-left text-sm font-bold text-[#5b4632] transition hover:border-clay-500 hover:bg-[#efe0c0]"
      >
        <SparkIcon />
        <span className="min-w-0 flex-1 truncate">{genLabel}</span>
        {!loading && status !== 'idle' && (
          <span className={'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ' + badge.cls}>
            {badge.text}
          </span>
        )}
        <ChevronIcon dir="down" />
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-[#dcc89f] bg-[#efe0c0] p-3">
      <div className="flex items-center gap-2">
        <span className="font-display text-base text-[#2a1c14]">原始输入图 · Scale 生成</span>
        <span className={'ml-auto rounded px-1.5 py-0.5 text-[10px] font-bold ' + badge.cls}>
          {loading ? '载入中' : badge.text}
        </span>
        <button
          onClick={() => setOpen(false)}
          aria-label="收起"
          className="shrink-0 rounded p-0.5 text-[#9c7e5e] transition hover:text-[#2a1c14]"
        >
          <ChevronIcon dir="up" />
        </button>
      </div>

      <div className="mt-2.5 flex gap-3">
        <div className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded border border-[#dcc89f] bg-[#e8d6b0]">
          {sourceUrl ? (
            <img src={sourceUrl} alt={title} className="h-full w-full object-cover" />
          ) : (
            <span className="px-1 text-center text-[10px] leading-tight text-[#9c7e5e]">
              未上传源图
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 text-xs text-[#6b5238]">
          {doc?.sourceName ? (
            <p className="truncate">源图：{doc.sourceName}</p>
          ) : (
            <p className="text-[#9c7e5e]">上传一张实拍/参考图，作为该单元生成游戏资产的输入。</p>
          )}
          {doc?.capturedAt && <p className="mt-0.5 text-[#9c7e5e]">{doc.capturedAt}</p>}
          {status === 'error' && doc?.error && (
            <p className="mt-1 line-clamp-3 text-[#b3433a]">{doc.error}</p>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          className="rounded-lg border-2 border-[#cbb287] bg-[#f3e7cb] px-3 py-1.5 text-xs font-semibold text-[#5b4632] transition hover:border-clay-500 disabled:opacity-50"
        >
          {busy === 'upload' ? '上传中…' : sourceUrl ? '替换源图' : '上传源图'}
        </button>
        <button
          onClick={onRegenerate}
          disabled={busy !== null || !sourceUrl}
          className="rounded-lg bg-clay-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-clay-500 disabled:opacity-40"
          title={sourceUrl ? '' : '先上传源图'}
        >
          {busy === 'gen' ? '生成中…' : genLabel}
        </button>
        {doc?.generated && (
          <button
            onClick={() => setShowJson((s) => !s)}
            className="ml-auto rounded px-2.5 py-1.5 text-xs text-[#6b5238] hover:text-[#2a1c14]"
          >
            {showJson ? '收起结果' : '查看结果'}
          </button>
        )}
      </div>

      {showJson && doc?.generated && (
        <pre className="mt-2 max-h-56 overflow-auto rounded bg-[#2a1c14] p-2 text-[11px] leading-snug text-[#e8d6b0]">
          {prettyJson(doc.generated)}
        </pre>
      )}
    </div>
  );
}

function prettyJson(s: string) {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

function SparkIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-clay-500"
      aria-hidden
    >
      <path d="M12 3l1.9 4.8L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.7Z" />
      <path d="M19 14v4M21 16h-4" />
    </svg>
  );
}

function ChevronIcon({ dir }: { dir: 'up' | 'down' }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      {dir === 'down' ? <path d="M6 9l6 6 6-6" /> : <path d="M6 15l6-6 6 6" />}
    </svg>
  );
}
