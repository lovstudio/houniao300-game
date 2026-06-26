import { useRef, useState } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';

export type PosterPanel = { imageUrl: string | null; narration: string };

type PosterProps = {
  title: string;
  userName: string;
  venue?: string;
  activityKey: string;
  badgeTitle?: string;
  badgeSummary?: string;
  reflection?: string;
  panels: PosterPanel[];
  onClose: () => void;
};

// festival 视觉常量（沙雕暖色母题）。
const SAND = '#EAD4AA'; // 沙金
const CLAY = '#E4A672'; // 陶土橙
const BG = '#3F2832'; // 深褐底
const CELL = '#2A1B22'; // 画格底
const INK = '#181425'; // 近黑

// 扫码深链：落地后自动打开该活动的连环画体验。用 origin 以适配生产/预览域名。
function deepLink(activityKey: string): string {
  return `${window.location.origin}/?exp=${encodeURIComponent(activityKey)}`;
}

// activityKey = date|time|venue|title，取出节展日期时段。
function dateLine(activityKey: string): string {
  const [date, time] = activityKey.split('|');
  return date && time ? `6/${date} · ${time}` : '';
}

// 胶片齿孔条（DOM）：深色条上一排沙金穿孔。
function Sprockets() {
  return (
    <div
      style={{
        height: 12,
        background: INK,
        backgroundImage: `repeating-linear-gradient(to right, ${SAND} 0 9px, transparent 9px 21px)`,
        backgroundSize: 'auto 5px',
        backgroundPosition: 'center',
        backgroundRepeat: 'repeat-x',
      }}
    />
  );
}

export default function ComicPoster({
  title,
  userName,
  venue,
  activityKey,
  badgeTitle,
  badgeSummary,
  reflection,
  panels,
  onClose,
}: PosterProps) {
  const [downloading, setDownloading] = useState(false);
  // 隐藏的离屏 QRCodeCanvas：下载海报时直接 drawImage 它，二维码清晰且无异步加载。
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const link = deepLink(activityKey);
  const dl = dateLine(activityKey);

  const download = async () => {
    setDownloading(true);
    try {
      await composeAndDownload({ title, userName, venue, dl, badgeTitle, badgeSummary, reflection, panels, qrCanvas: qrCanvasRef.current });
    } catch (e) {
      console.error('长图导出失败', e);
      alert('长图导出失败，可直接截图保存（截图即海报）。');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/85">
      {/* 离屏高分二维码（仅供下载时 drawImage，不显示）。 */}
      <QRCodeCanvas
        ref={qrCanvasRef}
        value={link}
        size={256}
        fgColor={INK}
        bgColor={SAND}
        level="M"
        style={{ position: 'fixed', left: -9999, top: -9999, pointerEvents: 'none' }}
        aria-hidden
      />
      <div className="flex shrink-0 items-center justify-between gap-2 bg-brown-900 px-4 py-2">
        <span className="font-display text-brown-100">连环画海报</span>
        <div className="flex gap-2">
          <button
            onClick={() => void download()}
            disabled={downloading}
            className="rounded bg-clay-700 px-3 py-1.5 text-sm font-bold text-white hover:bg-clay-500 disabled:opacity-50"
          >
            {downloading ? '生成中…' : '下载海报'}
          </button>
          <button
            onClick={onClose}
            className="rounded border-2 border-brown-700 px-3 py-1.5 text-sm text-brown-100 hover:border-clay-500"
          >
            关闭
          </button>
        </div>
      </div>

      {/* DOM 预览：本身即为可截图分享的海报（截图即海报）。 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6" style={{ background: INK }}>
        <div
          className="mx-auto max-w-md overflow-hidden"
          style={{ background: BG, border: `3px solid ${SAND}`, borderRadius: 14 }}
        >
          {/* 头部 lockup */}
          <div className="px-5 pt-5 pb-4 text-center" style={{ borderBottom: `2px dashed ${CLAY}` }}>
            <div className="mb-2 flex items-center justify-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-bold tracking-widest"
                style={{ background: CLAY, color: INK }}
              >
                候鸟300
              </span>
              <span className="font-display text-lg tracking-[0.3em]" style={{ color: SAND }}>
                沙 城 连 环 画
              </span>
            </div>
            <p className="font-display text-2xl leading-tight" style={{ color: '#FFFFFF' }}>
              {title}
            </p>
            <p className="mt-1 text-xs" style={{ color: SAND }}>
              {[dl, venue].filter(Boolean).join('　·　')}
            </p>
          </div>

          {/* 连环画分镜（胶片格） */}
          <div className="px-3 py-3">
            {panels.map((p, i) => (
              <div key={i} className="mb-3 overflow-hidden" style={{ background: CELL, borderRadius: 8 }}>
                <Sprockets />
                {p.imageUrl && <img src={p.imageUrl} alt="" className="block w-full" crossOrigin="anonymous" />}
                <Sprockets />
                <p className="px-3 py-2.5 text-[13px] leading-relaxed" style={{ color: SAND }}>
                  <span style={{ color: CLAY }}>{String(i + 1).padStart(2, '0')}</span>　{p.narration}
                </p>
              </div>
            ))}
          </div>

          {/* 题词（视觉主角） */}
          {reflection && (
            <div className="mx-3 mb-3 px-5 py-5 text-center" style={{ background: '#241620', borderRadius: 10, border: `1px solid ${CLAY}` }}>
              <p className="font-display leading-relaxed" style={{ color: SAND, fontSize: 22 }}>
                「{reflection}」
              </p>
              <p className="mt-2 text-xs" style={{ color: CLAY }}>
                —— {userName}
              </p>
            </div>
          )}

          {/* 勋章 */}
          {badgeTitle && (
            <div className="px-5 py-3 text-center" style={{ background: BG }}>
              <p className="font-display text-lg" style={{ color: CLAY }}>
                勋章 · {badgeTitle}
              </p>
              {badgeSummary && (
                <p className="mt-1 text-xs" style={{ color: SAND }}>
                  {badgeSummary}
                </p>
              )}
            </div>
          )}

          {/* 底部二维码深链 */}
          <div
            className="flex items-center gap-4 px-5 py-4"
            style={{ background: INK, borderTop: `2px dashed ${CLAY}` }}
          >
            <div className="shrink-0 overflow-hidden" style={{ background: SAND, borderRadius: 8, padding: 6 }}>
              <QRCodeSVG value={link} size={76} fgColor={INK} bgColor={SAND} level="M" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm" style={{ color: SAND }}>
                扫码进入这场活动
              </p>
              <p className="mt-0.5 text-xs" style={{ color: CLAY }}>
                生成属于你的专属连环画
              </p>
              <p className="mt-1 text-[10px]" style={{ color: '#8B9BB4' }}>
                houniao300-game.vercel.app
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- canvas 合成（高保真下载版，镜像 DOM 设计） ----
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 画一排胶片穿孔。
function drawSprockets(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = INK;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = SAND;
  const holeW = 26;
  const gap = 22;
  const holeH = Math.min(8, h - 6);
  const oy = y + (h - holeH) / 2;
  for (let hx = x + gap; hx + holeW < x + w; hx += holeW + gap) {
    roundRect(ctx, hx, oy, holeW, holeH, 3);
    ctx.fill();
  }
}

async function composeAndDownload({
  title,
  userName,
  venue,
  dl,
  badgeTitle,
  badgeSummary,
  reflection,
  panels,
  qrCanvas,
}: {
  title: string;
  userName: string;
  venue?: string;
  dl: string;
  badgeTitle?: string;
  badgeSummary?: string;
  reflection?: string;
  panels: PosterPanel[];
  qrCanvas: HTMLCanvasElement | null;
}) {
  const W = 1080;
  const pad = 56;
  const inner = W - pad * 2;
  const sprocketH = 22;
  const headerH = 240;

  const imgs = await Promise.all(panels.map((p) => (p.imageUrl ? loadImage(p.imageUrl) : Promise.resolve(null))));

  const measure = document.createElement('canvas').getContext('2d')!;
  const narrFont = 30;
  const narrLineH = 46;
  const cellTextPad = 28;
  const blocks = panels.map((p, i) => {
    const img = imgs[i];
    const imgH = img ? Math.round((inner * img.height) / img.width) : 0;
    measure.font = `${narrFont}px sans-serif`;
    const lines = wrapText(measure, `${String(i + 1).padStart(2, '0')}  ${p.narration}`, inner - cellTextPad * 2);
    const textH = lines.length * narrLineH + cellTextPad * 2;
    return { img, imgH, lines, textH, cellH: sprocketH * 2 + imgH + textH };
  });

  // 题词块高度
  let reflectionH = 0;
  let reflLines: string[] = [];
  if (reflection) {
    measure.font = `40px sans-serif`;
    reflLines = wrapText(measure, `「${reflection}」`, inner - 80);
    reflectionH = 56 + reflLines.length * 58 + 60;
  }
  const badgeH = badgeTitle ? 150 : 0;
  const footerH = 200;
  const gap = 26;

  const bodyH = blocks.reduce((s, b) => s + b.cellH + gap, 0);
  const total = headerH + gap + bodyH + reflectionH + badgeH + footerH + pad;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = total;
  const ctx = canvas.getContext('2d')!;

  // 底
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, total);

  // 头部 lockup
  ctx.textAlign = 'center';
  // 候鸟300 徽标
  ctx.fillStyle = CLAY;
  roundRect(ctx, W / 2 - 230, 56, 150, 52, 26);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = `bold 28px sans-serif`;
  ctx.fillText('候鸟300', W / 2 - 155, 92);
  ctx.fillStyle = SAND;
  ctx.font = `40px sans-serif`;
  ctx.fillText('沙 城 连 环 画', W / 2 + 90, 96);
  // 活动名
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold 60px sans-serif`;
  ctx.fillText(title.length > 16 ? title.slice(0, 15) + '…' : title, W / 2, 180);
  // 日期 · 场地
  ctx.fillStyle = SAND;
  ctx.font = `28px sans-serif`;
  ctx.fillText([dl, venue].filter(Boolean).join('   ·   '), W / 2, 226);
  // 分隔虚线
  ctx.strokeStyle = CLAY;
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(pad, headerH);
  ctx.lineTo(W - pad, headerH);
  ctx.stroke();
  ctx.setLineDash([]);

  // 分镜
  let y = headerH + gap;
  ctx.textAlign = 'left';
  for (const b of blocks) {
    ctx.fillStyle = CELL;
    roundRect(ctx, pad, y, inner, b.cellH, 12);
    ctx.fill();
    drawSprockets(ctx, pad, y, inner, sprocketH);
    if (b.img) ctx.drawImage(b.img, pad, y + sprocketH, inner, b.imgH);
    drawSprockets(ctx, pad, y + sprocketH + b.imgH, inner, sprocketH);
    let ty = y + sprocketH * 2 + b.imgH + cellTextPad + narrFont;
    ctx.font = `${narrFont}px sans-serif`;
    ctx.fillStyle = SAND;
    for (const ln of b.lines) {
      ctx.fillText(ln, pad + cellTextPad, ty);
      ty += narrLineH;
    }
    y += b.cellH + gap;
  }

  // 题词（视觉主角）
  if (reflection) {
    ctx.fillStyle = '#241620';
    roundRect(ctx, pad, y, inner, reflectionH, 14);
    ctx.fill();
    ctx.strokeStyle = CLAY;
    ctx.lineWidth = 2;
    roundRect(ctx, pad, y, inner, reflectionH, 14);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = SAND;
    ctx.font = `40px sans-serif`;
    let ty = y + 80;
    for (const ln of reflLines) {
      ctx.fillText(ln, W / 2, ty);
      ty += 58;
    }
    ctx.fillStyle = CLAY;
    ctx.font = `26px sans-serif`;
    ctx.fillText(`—— ${userName}`, W / 2, ty + 6);
    y += reflectionH + gap;
  }

  // 勋章
  if (badgeTitle) {
    ctx.textAlign = 'center';
    ctx.fillStyle = CLAY;
    ctx.font = `bold 40px sans-serif`;
    ctx.fillText(`勋章 · ${badgeTitle}`, W / 2, y + 56);
    if (badgeSummary) {
      ctx.fillStyle = SAND;
      ctx.font = `26px sans-serif`;
      const lines = wrapText(ctx, badgeSummary, inner);
      let ty = y + 100;
      for (const ln of lines) {
        ctx.fillText(ln, W / 2, ty);
        ty += 38;
      }
    }
    y += badgeH;
  }

  // 底部二维码
  ctx.fillStyle = INK;
  ctx.fillRect(0, total - footerH, W, footerH);
  const qrSize = 130;
  const qy = total - footerH + (footerH - qrSize) / 2;
  ctx.fillStyle = SAND;
  roundRect(ctx, pad, qy, qrSize, qrSize, 10);
  ctx.fill();
  if (qrCanvas) ctx.drawImage(qrCanvas, pad + 8, qy + 8, qrSize - 16, qrSize - 16);
  ctx.textAlign = 'left';
  const tx = pad + qrSize + 36;
  ctx.fillStyle = SAND;
  ctx.font = `bold 36px sans-serif`;
  ctx.fillText('扫码进入这场活动', tx, qy + 44);
  ctx.fillStyle = CLAY;
  ctx.font = `28px sans-serif`;
  ctx.fillText('生成属于你的专属连环画', tx, qy + 88);
  ctx.fillStyle = '#8B9BB4';
  ctx.font = `22px sans-serif`;
  ctx.fillText('houniao300-game.vercel.app', tx, qy + 124);

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('toBlob 返回空');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `候鸟沙城-${title}-连环画.png`;
  a.click();
  URL.revokeObjectURL(url);
}
