import { useEffect, useRef, useState } from 'react';
import { useGeolocation } from '../hooks/useGeolocation';
import { useCalibration } from '../hooks/useCalibration';
import { setMapTapCaptureHandler, focusMapVenue } from '../lib/mapFocus';
import { gpsToSource, isCalibrated, makeCalibration, type GpsAnchor } from '../lib/gps';

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

  return (
    <div className="pointer-events-auto absolute left-2 top-14 z-40 w-72 max-w-[calc(100vw-1rem)] select-none rounded-lg border border-brown-700/70 bg-brown-900/92 p-3 text-brown-100 shadow-2xl backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-brown-300">GPS 标定</span>
        <span className="text-[11px] text-brown-200/60">
          {geo.status === 'active' && geo.reading ? `±${Math.round(geo.reading.accuracy)}m` : geo.status}
        </span>
      </div>

      {/* 采集流程 */}
      {pendingGps ? (
        <div className="mb-2 rounded-md bg-brown-700/40 px-2.5 py-2 text-[12px] leading-relaxed">
          已采集 GPS {pendingGps.lat.toFixed(5)}, {pendingGps.lng.toFixed(5)}
          <div className="mt-1 font-medium text-brown-300">现在点地图上对应的位置 →</div>
          <button
            className="mt-1 text-[11px] text-brown-200/60 underline"
            onClick={() => setPendingGps(null)}
          >
            取消
          </button>
        </div>
      ) : (
        <>
          <div className="mb-2 flex gap-1.5">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="锚点名（选填，如 工坊门口）"
              className="min-w-0 flex-1 rounded bg-brown-800 px-2 py-1.5 text-[12px] text-brown-100 placeholder:text-brown-200/40 focus:outline-none"
            />
            <button
              onClick={captureGps}
              disabled={!geo.reading}
              className="shrink-0 rounded bg-brown-500 px-2.5 py-1.5 text-[12px] font-medium text-brown-900 transition hover:bg-brown-300 disabled:opacity-40"
            >
              采集 GPS
            </button>
          </div>
          {!geo.reading && (
            <div className="mb-2 text-[11px] text-brown-300/80">
              {geo.status === 'denied'
                ? '定位权限被拒绝，请在浏览器允许定位后重开此开关。'
                : geo.status === 'unsupported'
                  ? '此设备/浏览器不支持定位。'
                  : '定位未就绪：等待 GPS 锁定后「采集 GPS」才可点。'}
            </div>
          )}
        </>
      )}

      {/* 锚点列表 */}
      <div className="mb-2 max-h-44 space-y-1 overflow-y-auto">
        {working.length === 0 && (
          <div className="py-2 text-center text-[11px] text-brown-200/40">还没有锚点</div>
        )}
        {working.map((a, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 rounded bg-brown-800/70 px-2 py-1 text-[11px] tabular-nums"
          >
            <span className="w-4 text-brown-200/50">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">
              {a.label ? `${a.label} · ` : ''}
              {a.lat.toFixed(4)},{a.lng.toFixed(4)} → {a.sourceX},{a.sourceY}
            </span>
            <button
              onClick={() => removeAnchor(i)}
              className="shrink-0 text-brown-200/50 transition hover:text-red-400"
              title="删除"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* 状态 + 操作 */}
      <div className="mb-2 flex items-center justify-between text-[11px]">
        <span className="text-brown-200/60">
          {working.length} 个锚点 · {working.length < 3 ? `还差 ${3 - working.length}` : '可解算'}
        </span>
        {rms != null && (
          <span className={rms <= 12 ? 'text-brown-300' : 'text-brown-300/60'}>
            残差 {rms.toFixed(1)}px
          </span>
        )}
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={preview}
          disabled={!ready || !geo.reading}
          className="flex-1 rounded border border-brown-600 px-2 py-1.5 text-[12px] transition hover:bg-brown-700/40 disabled:opacity-40"
        >
          预览定位
        </button>
        <button
          onClick={onSave}
          disabled={working.length === 0 || saved === 'saving'}
          className="flex-1 rounded bg-brown-500 px-2 py-1.5 text-[12px] font-medium text-brown-900 transition hover:bg-brown-300 disabled:opacity-40"
        >
          {saved === 'saving' ? '保存中…' : saved === 'done' ? '已保存 ✓' : saved === 'error' ? '失败' : '保存到服务器'}
        </button>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-brown-200/40">
        站到地标点采集 GPS，再点地图上对应位置；≥3 组互不共线的锚点即可解算。残差越小越准。
      </p>
    </div>
  );
}
