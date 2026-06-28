import { useState } from 'react';
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function NetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5a10 10 0 0 1 14 0" />
      <path d="M8.5 16a5 5 0 0 1 7 0" />
      <circle cx="12" cy="19" r="0.6" fill="currentColor" />
    </svg>
  );
}

const GPS_LABEL: Record<GeoStatus, string> = {
  idle: '点击开启',
  unsupported: '不支持',
  locating: '定位中…',
  active: 'GPS',
  denied: '无权限',
  error: '定位失败',
};

// 定位/网络状态面板，嵌入设置菜单内（不再悬浮于屏幕角落）。
// 点击 GPS 行才会请求定位权限（避免一进页面就弹授权框）。
export default function SignalPanel() {
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const geo = useGeolocation(gpsEnabled);
  const net = useNetworkStatus();
  const { calibration } = useCalibration();

  const gpsBars = geo.status === 'active' ? gpsSignalBars(geo.reading?.accuracy) : 0;
  const gpsActive = geo.status === 'active';
  const netBars = networkSignalBars(net);
  const calibrated = isCalibrated(calibration);

  return (
    <>
      <div className="settings-section">定位</div>

      {/* GPS：点击开启定位 */}
      <button
        type="button"
        className="setting-row"
        onClick={() => !gpsEnabled && setGpsEnabled(true)}
        title="点击开启 GPS 定位"
      >
        <span className="setting-ico" style={{ color: gpsActive ? '#caa979' : undefined }}>
          <PinIcon />
        </span>
        <span className="setting-label">GPS</span>
        <span
          className="flex items-center gap-1.5"
          style={{ color: gpsActive ? '#caa979' : '#8a7558' }}
        >
          <SignalBars bars={gpsBars} muted={!gpsActive} />
          <span className="text-[12px] font-semibold tabular-nums">
            {gpsActive && geo.reading
              ? `±${Math.round(geo.reading.accuracy)}m`
              : GPS_LABEL[geo.status]}
          </span>
        </span>
      </button>

      {/* 网络 */}
      <div className="setting-row" style={{ cursor: 'default' }}>
        <span className="setting-ico" style={{ color: net.online ? '#caa979' : '#c8694c' }}>
          <NetIcon />
        </span>
        <span className="setting-label">网络</span>
        <span
          className="flex items-center gap-1.5"
          style={{ color: net.online ? '#caa979' : '#c8694c' }}
        >
          <SignalBars bars={netBars} muted={!net.online} />
          <span className="text-[12px] font-semibold uppercase tabular-nums">
            {net.online ? net.effectiveType ?? '在线' : '离线'}
            {net.online && net.rtt != null ? ` · ${net.rtt}ms` : ''}
          </span>
        </span>
      </div>

      {/* 地图标定 */}
      <div className="setting-row" style={{ cursor: 'default' }}>
        <span className="setting-label" style={{ paddingLeft: 26 }}>
          地图标定
        </span>
        <span className={calibrated ? 'setting-val setting-val-on' : 'setting-val'}>
          {calibrated ? '已标定' : '未标定'}
        </span>
      </div>

      {geo.error && (
        <div className="px-2.5 pb-1 text-[11px] text-[#c8694c]">{geo.error}</div>
      )}
      {!calibrated && gpsActive && (
        <div className="px-2.5 pb-1 text-[10px] leading-relaxed text-brown-200/50">
          已能读取真实定位，但尚未标定 GPS→地图，无法把你投射到地图上。
        </div>
      )}
    </>
  );
}
