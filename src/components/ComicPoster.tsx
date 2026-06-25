import { useState } from 'react';

export type PosterPanel = { imageUrl: string | null; narration: string };

// 连环画长图：DOM 竖排预览（可截图/分享）+ canvas 合成下载 PNG。
export default function ComicPoster({
  title,
  userName,
  badgeTitle,
  badgeSummary,
  panels,
  onClose,
}: {
  title: string;
  userName: string;
  badgeTitle?: string;
  badgeSummary?: string;
  panels: PosterPanel[];
  onClose: () => void;
}) {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      await composeAndDownload({ title, userName, badgeTitle, badgeSummary, panels });
    } catch (e) {
      console.error('长图导出失败', e);
      alert('长图导出失败，可直接截图保存。');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/80">
      <div className="flex shrink-0 items-center justify-between gap-2 bg-brown-900 px-4 py-2">
        <span className="font-display text-brown-100">连环画长图</span>
        <div className="flex gap-2">
          <button
            onClick={() => void download()}
            disabled={downloading}
            className="rounded bg-clay-700 px-3 py-1.5 text-sm font-bold text-white hover:bg-clay-500 disabled:opacity-50"
          >
            {downloading ? '生成中…' : '下载长图'}
          </button>
          <button
            onClick={onClose}
            className="rounded border-2 border-brown-700 px-3 py-1.5 text-sm text-brown-100 hover:border-clay-500"
          >
            关闭
          </button>
        </div>
      </div>
      {/* DOM 预览：可直接截图分享 */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-brown-900 px-4 py-6">
        <div className="mx-auto max-w-md overflow-hidden rounded-lg border-4 border-brown-700 bg-brown-800">
          <div className="bg-clay-700 px-4 py-3 text-center">
            <p className="font-display text-xl text-white">{title}</p>
            <p className="text-xs text-brown-100">{userName} 的候鸟沙城连环画</p>
          </div>
          {panels.map((p, i) => (
            <div key={i}>
              {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full" crossOrigin="anonymous" />}
              <p className="px-4 py-3 text-sm leading-relaxed text-brown-100">{p.narration}</p>
            </div>
          ))}
          {badgeTitle && (
            <div className="border-t-2 border-clay-500 bg-brown-800 px-4 py-4 text-center">
              <p className="font-display text-lg text-clay-100">勋章 · {badgeTitle}</p>
              {badgeSummary && <p className="mt-1 text-xs text-brown-200">{badgeSummary}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- canvas 合成 ----
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    if (ch === '\n') {
      lines.push(line);
      line = '';
      continue;
    }
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function composeAndDownload({
  title,
  userName,
  badgeTitle,
  badgeSummary,
  panels,
}: {
  title: string;
  userName: string;
  badgeTitle?: string;
  badgeSummary?: string;
  panels: PosterPanel[];
}) {
  const W = 1080;
  const pad = 48;
  const fontSize = 30;
  const lineH = 46;
  const headerH = 150;
  const footerH = badgeTitle ? 200 : 0;

  const imgs = await Promise.all(panels.map((p) => (p.imageUrl ? loadImage(p.imageUrl) : Promise.resolve(null))));

  // 先量算总高度
  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `${fontSize}px sans-serif`;
  const blocks = panels.map((p, i) => {
    const img = imgs[i];
    const imgH = img ? Math.round(((W - pad * 2) * img.height) / img.width) : 0;
    const lines = wrapText(measure, p.narration, W - pad * 2);
    return { img, imgH, lines, textH: lines.length * lineH + pad };
  });
  const total = headerH + blocks.reduce((s, b) => s + b.imgH + b.textH, 0) + footerH + pad;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = total;
  const ctx = canvas.getContext('2d')!;

  // 背景
  ctx.fillStyle = '#3F2832';
  ctx.fillRect(0, 0, W, total);

  // 头部
  ctx.fillStyle = '#3A4466';
  ctx.fillRect(0, 0, W, headerH);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = `bold ${fontSize + 16}px sans-serif`;
  ctx.fillText(title, W / 2, 70);
  ctx.font = `${fontSize - 6}px sans-serif`;
  ctx.fillStyle = '#EAD4AA';
  ctx.fillText(`${userName} 的候鸟沙城连环画`, W / 2, 116);

  // 正文
  let y = headerH;
  ctx.textAlign = 'left';
  for (const b of blocks) {
    if (b.img) {
      ctx.drawImage(b.img, pad, y, W - pad * 2, b.imgH);
      y += b.imgH;
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `${fontSize}px sans-serif`;
    let ty = y + pad / 2 + fontSize;
    for (const ln of b.lines) {
      ctx.fillText(ln, pad, ty);
      ty += lineH;
    }
    y += b.textH;
  }

  // 勋章
  if (badgeTitle) {
    ctx.fillStyle = '#5A6988';
    ctx.fillRect(0, y, W, footerH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${fontSize + 6}px sans-serif`;
    ctx.fillText(`勋章 · ${badgeTitle}`, W / 2, y + 80);
    if (badgeSummary) {
      ctx.font = `${fontSize - 8}px sans-serif`;
      ctx.fillStyle = '#EAD4AA';
      const lines = wrapText(ctx, badgeSummary, W - pad * 2);
      let ty = y + 130;
      for (const ln of lines) {
        ctx.fillText(ln, W / 2, ty);
        ty += lineH - 8;
      }
    }
  }

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('toBlob 返回空');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `候鸟沙城-${title}-连环画.png`;
  a.click();
  URL.revokeObjectURL(url);
}
