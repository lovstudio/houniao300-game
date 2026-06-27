import { useMemo, useRef, useState } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { VENUE_INTERIOR_MAPS } from '../../data/birdRestaurantInterior';
import { INSTALLATIONS } from '../../data/installations';

type Kind = 'venue' | 'work';

type CatalogItem = {
  key: string;
  kind: Kind;
  refId: string;
  title: string;
  subtitle: string;
  origImageName?: string;
  capturedAt?: string;
};

type MaterialDoc = {
  key: string;
  status: 'idle' | 'generating' | 'ready' | 'error';
  sourceUrl: string | null;
  sourceName?: string;
  capturedAt?: string;
  generated?: string;
  error?: string;
  updatedAt: number;
};

const VENUE_CATALOG: CatalogItem[] = VENUE_INTERIOR_MAPS.map((m) => ({
  key: `venue:${m.id}`,
  kind: 'venue',
  refId: m.id,
  title: m.venue,
  subtitle: m.subtitle ?? m.id,
  origImageName: m.source.imageName,
  capturedAt: m.source.capturedAt,
}));

const WORK_CATALOG: CatalogItem[] = INSTALLATIONS.map((i) => ({
  key: `work:${i.id}`,
  kind: 'work',
  refId: i.id,
  title: `${i.id} · ${i.title}`,
  subtitle: `${i.artist} · ${i.zone}`,
}));

const STATUS_LABEL: Record<MaterialDoc['status'], { text: string; cls: string }> = {
  idle: { text: '待生成', cls: 'bg-brown-700/60 text-brown-200' },
  generating: { text: '生成中', cls: 'bg-clay-700/70 text-white animate-pulse' },
  ready: { text: '已生成', cls: 'bg-[#1da76e] text-white' },
  error: { text: '失败', cls: 'bg-[#b3433a] text-white' },
};

export default function MaterialsAdmin() {
  const docs = useQuery(api.materials.list, {});
  const [section, setSection] = useState<Kind>('venue');
  const [query, setQuery] = useState('');

  const byKey = useMemo(() => {
    const m = new Map<string, MaterialDoc>();
    (docs ?? []).forEach((d) => m.set(d.key, d as MaterialDoc));
    return m;
  }, [docs]);

  const catalog = section === 'venue' ? VENUE_CATALOG : WORK_CATALOG;
  const q = query.trim().toLowerCase();
  const items = q
    ? catalog.filter((c) => `${c.title} ${c.subtitle} ${c.refId}`.toLowerCase().includes(q))
    : catalog;

  const withSource = catalog.filter((c) => byKey.get(c.key)?.sourceUrl).length;

  return (
    <div className="min-h-screen w-full bg-brown-900 text-brown-100">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <header className="mb-5">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-3xl text-[#e4b58c]">物料管理</h1>
            <span className="text-sm text-brown-400">照片 → 生成 · 溯源与重建</span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-brown-300">
            沙城的每个内场地图与作品点位，都由一张原始照片经我们的管线生成。这里集中管理每个单元的源图输入，
            支持上传/替换并重新跑生成。
          </p>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(['venue', 'work'] as Kind[]).map((k) => (
            <button
              key={k}
              onClick={() => setSection(k)}
              className={
                'rounded-md px-3 py-1.5 text-sm font-semibold transition ' +
                (section === k
                  ? 'bg-clay-700 text-white'
                  : 'bg-brown-800 text-brown-300 hover:bg-brown-700')
              }
            >
              {k === 'venue' ? `场所内场（${VENUE_CATALOG.length}）` : `作品点位（${WORK_CATALOG.length}）`}
            </button>
          ))}
          <span className="ml-auto text-xs text-brown-400">
            本类已上传源图 {section === 'venue'
              ? VENUE_CATALOG.filter((c) => byKey.get(c.key)?.sourceUrl).length
              : WORK_CATALOG.filter((c) => byKey.get(c.key)?.sourceUrl).length}
            /{catalog.length}（全站 {withSource}）
          </span>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索编号、名称、艺术家、区域"
          className="mb-4 w-full rounded border border-brown-700 bg-brown-800/60 px-3 py-2 text-sm placeholder:text-brown-500 focus:border-clay-500 focus:outline-none"
        />

        {docs === undefined ? (
          <div className="py-20 text-center text-sm text-brown-400">正在载入物料…</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <MaterialCard key={item.key} item={item} doc={byKey.get(item.key)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MaterialCard({ item, doc }: { item: CatalogItem; doc?: MaterialDoc }) {
  const genUploadUrl = useMutation(api.materials.generateUploadUrl);
  const attachSource = useMutation(api.materials.attachSource);
  const regenerate = useAction(api.materials.regenerate);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'gen' | null>(null);
  const [showJson, setShowJson] = useState(false);

  const status = doc?.status ?? 'idle';
  const badge = STATUS_LABEL[status];
  const sourceUrl = doc?.sourceUrl ?? null;

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
        key: item.key,
        kind: item.kind,
        refId: item.refId,
        title: item.title,
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
      const r = await regenerate({ key: item.key });
      if (!r.ok && r.error) alert(r.error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-brown-700/60 bg-brown-800/40 p-3">
      <div className="flex gap-3">
        <div className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded border border-brown-700/60 bg-brown-900/60">
          {sourceUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sourceUrl} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <span className="px-1 text-center text-[10px] leading-tight text-brown-500">
              {item.origImageName ? `原始：${item.origImageName}（未上传）` : '无源图'}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 truncate font-semibold text-brown-100" title={item.title}>
              {item.title}
            </h3>
            <span className={'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ' + badge.cls}>
              {badge.text}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-brown-300" title={item.subtitle}>
            {item.subtitle}
          </p>
          {doc?.sourceName && (
            <p className="mt-1 truncate text-[10px] text-brown-500">
              源图：{doc.sourceName}
              {doc.capturedAt ? ` · ${doc.capturedAt}` : ''}
            </p>
          )}
          {status === 'error' && doc?.error && (
            <p className="mt-1 line-clamp-2 text-[10px] text-[#e08b84]">{doc.error}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
          className="rounded bg-brown-700 px-2.5 py-1.5 text-xs font-semibold text-brown-100 hover:bg-brown-600 disabled:opacity-50"
        >
          {busy === 'upload' ? '上传中…' : sourceUrl ? '替换源图' : '上传源图'}
        </button>
        <button
          onClick={onRegenerate}
          disabled={busy !== null || !sourceUrl}
          className="rounded bg-clay-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-clay-600 disabled:opacity-40"
          title={sourceUrl ? '调用 AI 重新生成' : '先上传源图'}
        >
          {busy === 'gen' ? '生成中…' : '重新生成'}
        </button>
        {doc?.generated && (
          <button
            onClick={() => setShowJson((s) => !s)}
            className="ml-auto rounded bg-brown-900/60 px-2.5 py-1.5 text-xs text-brown-300 hover:text-brown-100"
          >
            {showJson ? '收起结果' : '查看结果'}
          </button>
        )}
      </div>

      {showJson && doc?.generated && (
        <pre className="max-h-64 overflow-auto rounded bg-brown-900/70 p-2 text-[11px] leading-snug text-brown-200">
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
