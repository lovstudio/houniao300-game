import { useEffect, useRef, useState } from 'react';

export type GeoStatus =
  | 'idle' // 还没请求
  | 'unsupported' // 浏览器不支持
  | 'locating' // 已请求，等待首个定位
  | 'active' // 正在持续定位
  | 'denied' // 用户拒绝授权
  | 'error'; // 其它错误（超时/不可用）

export type GeoReading = {
  lat: number;
  lng: number;
  accuracy: number; // 水平精度，米（越小越好）
  heading: number | null; // 朝向，度（部分设备没有）
  speed: number | null; // 速度，m/s
  timestamp: number;
};

export type GeolocationState = {
  status: GeoStatus;
  reading: GeoReading | null;
  error: string | null;
};

// 持续读取真实 GPS 定位。enabled=false 时完全不请求权限（避免一进页面就弹授权框）。
export function useGeolocation(enabled: boolean): GeolocationState {
  const [state, setState] = useState<GeolocationState>({
    status: 'idle',
    reading: null,
    error: null,
  });
  // status 的最新值，给闭包用，避免把它塞进 effect 依赖里反复重订阅。
  const statusRef = useRef(state.status);
  statusRef.current = state.status;

  useEffect(() => {
    if (!enabled) {
      setState((s) => (s.status === 'idle' ? s : { status: 'idle', reading: null, error: null }));
      return;
    }
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setState({ status: 'unsupported', reading: null, error: '此设备不支持定位' });
      return;
    }

    setState((s) => ({ ...s, status: s.reading ? 'active' : 'locating', error: null }));

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          status: 'active',
          reading: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
            speed: Number.isFinite(pos.coords.speed as number) ? pos.coords.speed : null,
            timestamp: pos.timestamp,
          },
          error: null,
        });
      },
      (err) => {
        const denied = err.code === err.PERMISSION_DENIED;
        setState((s) => ({
          status: denied ? 'denied' : 'error',
          reading: s.reading,
          error: denied ? '定位权限被拒绝' : err.message || '定位失败',
        }));
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  return state;
}

// 把水平精度（米）映射成 0~3 格信号强度。
export function gpsSignalBars(accuracy: number | null | undefined): 0 | 1 | 2 | 3 {
  if (accuracy == null || !Number.isFinite(accuracy)) return 0;
  if (accuracy <= 10) return 3;
  if (accuracy <= 30) return 2;
  return 1;
}
