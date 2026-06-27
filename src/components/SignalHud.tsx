import { useState } from 'react';
import clsx from 'clsx';
import { useGeolocation, gpsSignalBars, type GeoStatus } from '../hooks/useGeolocation';
import { useNetworkStatus, networkSignalBars } from '../hooks/useNetworkStatus';
import { useCalibration } from '../hooks/useCalibration';
import { isCalibrated } from '../lib/gps';

// 三格信号条。bars=0 全灰（无信号）。
function SignalBars({ bars, muted }: { bars: 0 | 1 | 2 | 3; muted?: boolean }) {
  const heights = [5, 8, 11];
  return (
    <svg width="16" height="13" viewBox="0 0 16 13" fill="none" aria-hidden>
      {heights.map((h, i) => {
        const on = !muted && bars > i;
        return (
          <rect
            key={i}
            x={1 + i * 5}
            y={12 - h}
            width="3.4"
            height={h}
            rx="1"
            fill={on ? 'currentColor' : 'rgba(234,212,170,0.22)'}
          />
        );
      })}
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

const GPS_LABEL: Record<GeoStatus, string> = {
  idle: '点击定位',
  unsupported: '不支持',
  locating: '定位中…',
  active: 'GPS',
  denied: '无权限',
  error: '定位失败',
};

// 屏幕左上角的轻量状态条：实时 GPS 信号 + 网络信号。
// 点击 GPS 区域才会请求定位权限（避免一进页面就弹授权框）。
export default function SignalHud() {
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const geo = useGeolocation(gpsEnabled);
  const net = useNetworkStatus();
  const { calibration } = useCalibration();

  const gpsBars = geo.status === 'active' ? gpsSignalBars(geo.reading?.accuracy) : 0;
  const gpsActive = geo.status === 'active';
  const netBars = networkSignalBars(net);
  const calibrated = isCalibrated(calibration);

  return (
    <div className="pointer-events-auto absolute left-2 top-2 z-30 select-none text-brown-200">
      <div className="flex items-stretch gap-px overflow-hidden rounded-md border border-brown-700/70 bg-brown-900/80 backdrop-blur-sm shadow-lg">
        {/* GPS */}
        <button
          type="button"
          onClick={() => {
            if (!gpsEnabled) setGpsEnabled(true);
            else setExpanded((v) => !v);
          }}
          className={clsx(
            'flex items-center gap-1.5 px-2 py-1.5 transition-colors',
            gpsActive ? 'text-brown-300' : 'text-brown-200/70',
            'hover:bg-brown-700/40',
          )}
          title="GPS 定位"
        >
          <PinIcon />
          <SignalBars bars={gpsBars} muted={!gpsActive} />
          <span className="text-[11px] font-medium tabular-nums leading-none">
            {gpsActive && geo.reading
              ? `±${Math.round(geo.reading.accuracy)}m`
              : GPS_LABEL[geo.status]}
          </span>
        </button>

        <span className="w-px self-stretch bg-brown-700/60" />

        {/* 网络 */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={clsx(
            'flex items-center gap-1.5 px-2 py-1.5 transition-colors hover:bg-brown-700/40',
            net.online ? 'text-brown-300' : 'text-red-400',
          )}
          title="网络信号"
        >
          <SignalBars bars={netBars} muted={!net.online} />
          <span className="text-[11px] font-medium uppercase tabular-nums leading-none">
            {net.online ? net.effectiveType ?? '在线' : '离线'}
          </span>
        </button>
      </div>

      {/* 展开详情 */}
      {expanded && (
        <div className="mt-1 w-52 rounded-md border border-brown-700/70 bg-brown-900/90 px-2.5 py-2 text-[11px] leading-relaxed text-brown-200/90 shadow-lg backdrop-blur-sm">
          <div className="mb-1 flex justify-between">
            <span className="text-brown-200/60">GPS 状态</span>
            <span>{GPS_LABEL[geo.status]}</span>
          </div>
          {geo.reading && (
            <>
              <div className="flex justify-between">
                <span className="text-brown-200/60">经纬度</span>
                <span className="tabular-nums">
                  {geo.reading.lat.toFixed(5)}, {geo.reading.lng.toFixed(5)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brown-200/60">精度</span>
                <span className="tabular-nums">±{Math.round(geo.reading.accuracy)} m</span>
              </div>
            </>
          )}
          {geo.error && <div className="mt-1 text-red-400">{geo.error}</div>}
          <div className="my-1.5 h-px bg-brown-700/50" />
          <div className="flex justify-between">
            <span className="text-brown-200/60">网络</span>
            <span>
              {net.online ? '在线' : '离线'}
              {net.rtt != null ? ` · ${net.rtt}ms` : ''}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-brown-200/60">地图标定</span>
            <span className={calibrated ? 'text-brown-300' : 'text-brown-300/60'}>
              {calibrated ? '已标定' : '未标定'}
            </span>
          </div>
          {!calibrated && gpsActive && (
            <div className="mt-1 text-[10px] text-brown-200/50">
              已能读取真实定位，但尚未标定 GPS→地图，无法把你投射到地图上。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
