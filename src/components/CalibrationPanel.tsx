import { useEffect, useRef, useState } from 'react';
import { useGeolocation } from '../hooks/useGeolocation';
import { useCalibration } from '../hooks/useCalibration';
import { setMapTapCaptureHandler, focusMapVenue } from '../lib/mapFocus';
import { gpsToSource, isCalibrated, makeCalibration, type GpsAnchor } from '../lib/gps';
import { LocateIcon } from './buttons/DeckIcons';

// 四角定位刻线（测绘仪表的视觉签名）。
const CORNER_TICKS = ['left-1.5 top-1.5 border-l border-t', 'right-1.5 top-1.5 border-r border-t', 'left-1.5 bottom-1.5 border-l border-b', 'right-1.5 bottom-1.5 border-r border-b'];

// 标定残差（重投影 RMS，单位：航拍源像素）。越小越准。
function rmsError(anchors: GpsAnchor[]): number | null {
  const cal = makeCalibration(anchors);
  if (!isCalibrated(cal)) return null;
  let sum = 0;
  for (const a of anchors) {
    const p = gpsToSource(cal, a.lat, a.lng)!;
    sum += (p.x - a.sourceX) ** 2 + (p.y - a.sourceY) ** 2;
  }
  return Math.sqrt(sum / anchors.length);
}

// 现场 GPS 标定工具。仅 ?calibrate=1 时挂载（操作员专用）。
// 流程：站到目标点 →「采集 GPS」→ 在地图上点对应位置 → 形成一组锚点；重复 ≥3 组后保存。
export default function CalibrationPanel() {
  const geo = useGeolocation(true);
  const { anchors: remoteAnchors, loading, saveAnchors } = useCalibration();

  const [working, setWorking] = useState<GpsAnchor[]>([]);
  const [pendingGps, setPendingGps] = useState<{ lat: number; lng: number } | null>(null);
  const [label, setLabel] = useState('');
  const [saved, setSaved] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const seededRef = useRef(false);

  // 首次从服务器载入已有锚点（只做一次，避免覆盖正在编辑的内容）。
  useEffect(() => {
    if (!loading && !seededRef.current) {
      seededRef.current = true;
      if (remoteAnchors.length > 0) setWorking(remoteAnchors);
    }
  }, [loading, remoteAnchors]);

  // 等待地图点击：把点击的源坐标 + 刚采集的 GPS 合成一条锚点。
  useEffect(() => {
    if (!pendingGps) return;
    setMapTapCaptureHandler((sourceX, sourceY) => {
      setWorking((w) => [
        ...w,
        { ...pendingGps, sourceX: Math.round(sourceX), sourceY: Math.round(sourceY), label: label || undefined },
      ]);
      setPendingGps(null);
      setLabel('');
    });
    return () => setMapTapCaptureHandler(null);
  }, [pendingGps, label]);

  const captureGps = () => {
    if (!geo.reading) return;
    setPendingGps({ lat: geo.reading.lat, lng: geo.reading.lng });
  };

  const removeAnchor = (i: number) => setWorking((w) => w.filter((_, idx) => idx !== i));

  const preview = () => {
    const cal = makeCalibration(working);
    if (!geo.reading || !isCalibrated(cal)) return;
    const p = gpsToSource(cal, geo.reading.lat, geo.reading.lng);
    if (p) focusMapVenue(p.x, p.y, '我的位置');
  };

  const onSave = async () => {
    setSaved('saving');
    try {
      await saveAnchors(working);
      setSaved('done');
      setTimeout(() => setSaved('idle'), 2000);
    } catch {
      setSaved('error');
    }
  };

  const rms = rmsError(working);
  const ready = working.length >= 3 && rms != null;

  const acc = geo.status === 'active' ? geo.reading?.accuracy ?? null : null;
  const quality = acc == null ? 'idle' : acc <= 12 ? 'good' : acc <= 35 ? 'fair' : 'weak';
  const led = { good: '#86B36A', fair: '#E4A672', weak: '#C2542F', idle: '#5A6988' }[quality];
  const statusText =
    acc != null
      ? `±${Math.round(acc)} m`
      : geo.status === 'locating'
        ? '定位中'
        : geo.status === 'idle'
          ? '待启动'
          : geo.status === 'denied'
            ? '无权限'
            : geo.status === 'unsupported'
              ? '不支持'
              : '定位失败';

  return (
    <div
      className="pointer-events-auto absolute left-2 top-14 z-40 w-[19rem] max-w-[calc(100vw-1rem)] select-none overflow-hidden rounded-xl border border-brown-500/30 p-3.5 text-brown-100 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.85)] ring-1 ring-black/40"
      style={{ background: 'linear-gradient(157deg,#241b30 0%,#191222 52%,#1d1422 100%)' }}
    >
      {/* 顶部赤土色细脊 */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brown-700 via-brown-500 to-brown-300" />
      {/* 四角定位刻线 */}
      {CORNER_TICKS.map((c) => (
        <span key={c} className={`pointer-events-none absolute h-2.5 w-2.5 border-brown-300/45 ${c}`} />
      ))}

      {/* 仪表抬头 */}
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brown-500/15 text-brown-300 ring-1 ring-brown-500/30">
          <LocateIcon />
        </span>
        <div className="min-w-0 flex-1 leading-none">
          <div className="font-mono text-[9px] uppercase tracking-[0.32em] text-brown-300/70">Survey</div>
          <div className="mt-1 text-[15px] font-semibold tracking-wide text-brown-100">GPS 标定</div>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-black/35 px-2 py-1 ring-1 ring-white/5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: led, boxShadow: `0 0 7px ${led}` }}
          />
          <span className="font-mono text-[11px] tabular-nums text-brown-200">{statusText}</span>
        </span>
      </div>

      {/* 采集流程 */}
      {pendingGps ? (
        <div className="mb-3 rounded-lg border border-brown-300/30 bg-brown-300/10 px-3 py-2.5 text-[12px] leading-relaxed">
          <div className="font-mono text-[11px] tabular-nums text-brown-200/80">
            {pendingGps.lat.toFixed(5)}, {pendingGps.lng.toFixed(5)}
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="font-medium text-brown-300">现在点地图上对应的位置 →</span>
            <button
              className="shrink-0 text-[11px] text-brown-200/55 underline-offset-2 transition hover:text-brown-100 hover:underline"
              onClick={() => setPendingGps(null)}
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-2.5 flex gap-1.5">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="锚点名（选填，如 工坊门口）"
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2.5 py-2 text-[12px] text-brown-100 placeholder:text-brown-200/35 focus:border-brown-500/50 focus:outline-none"
            />
            <button
              onClick={captureGps}
              disabled={!geo.reading}
              className="shrink-0 rounded-md bg-brown-500 px-3 py-2 text-[12px] font-semibold text-brown-900 shadow-sm transition hover:bg-brown-300 disabled:cursor-not-allowed disabled:bg-brown-700/60 disabled:text-brown-200/40 disabled:shadow-none"
            >
              采集 GPS
            </button>
          </div>
          {!geo.reading && (
            <div className="mb-2.5 flex items-start gap-1.5 rounded-md bg-brown-300/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-brown-300">
              {geo.status === 'denied'
                ? '定位权限被拒绝，请在浏览器允许定位后重开此开关。'
                : geo.status === 'unsupported'
                  ? '此设备 / 浏览器不支持定位。'
                  : '定位未就绪：等待 GPS 锁定后，「采集 GPS」才可点。'}
            </div>
          )}
        </>
      )}

      {/* 锚点列表 */}
      <div className="mb-2.5 max-h-44 space-y-1 overflow-y-auto pr-0.5">
        {working.length === 0 ? (
          <div className="rounded-md border border-dashed border-white/10 py-2.5 text-center text-[11px] text-brown-200/45">
            还没有锚点
          </div>
        ) : (
          working.map((a, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-md border border-white/5 bg-black/25 px-2 py-1.5 text-[11px]"
            >
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-brown-500/25 font-mono text-[10px] text-brown-300">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono tabular-nums text-brown-200">
                {a.label ? <span className="font-sans text-brown-100">{a.label} </span> : ''}
                {a.lat.toFixed(4)},{a.lng.toFixed(4)}
                <span className="text-brown-300/60"> → </span>
                {a.sourceX},{a.sourceY}
              </span>
              <button
                onClick={() => removeAnchor(i)}
                className="shrink-0 text-brown-200/45 transition hover:text-red-400"
                title="删除"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* 解算状态 */}
      <div className="mb-2.5 flex items-center justify-between rounded-md bg-black/20 px-2.5 py-1.5 text-[11px]">
        <span className="text-brown-200/75">
          {working.length} 个锚点 ·{' '}
          {working.length < 3 ? (
            <span className="text-brown-300">还差 {3 - working.length}</span>
          ) : (
            <span className="text-brown-300">可解算</span>
          )}
        </span>
        {rms != null && (
          <span className="font-mono tabular-nums">
            <span className="text-brown-200/55">残差 </span>
            <span className={rms <= 12 ? 'text-[#86B36A]' : 'text-brown-300'}>{rms.toFixed(1)}px</span>
          </span>
        )}
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={preview}
          disabled={!ready || !geo.reading}
          className="flex-1 rounded-md border border-brown-500/45 px-2 py-2 text-[12px] font-medium text-brown-200 transition hover:border-brown-300 hover:bg-brown-500/15 hover:text-brown-100 disabled:cursor-not-allowed disabled:border-white/8 disabled:text-brown-200/30 disabled:hover:bg-transparent"
        >
          预览定位
        </button>
        <button
          onClick={onSave}
          disabled={working.length === 0 || saved === 'saving'}
          className="flex-1 rounded-md bg-brown-500 px-2 py-2 text-[12px] font-semibold text-brown-900 shadow-sm transition hover:bg-brown-300 disabled:cursor-not-allowed disabled:bg-brown-700/60 disabled:text-brown-200/40 disabled:shadow-none"
        >
          {saved === 'saving' ? '保存中…' : saved === 'done' ? '已保存 ✓' : saved === 'error' ? '失败，重试' : '保存到服务器'}
        </button>
      </div>

      <p className="mt-2.5 border-t border-white/8 pt-2 text-[10px] leading-relaxed text-brown-200/55">
        站到地标点采集 GPS，再点地图上对应位置；≥3 组互不共线的锚点即可解算，残差越小越准。
      </p>
    </div>
  );
}
