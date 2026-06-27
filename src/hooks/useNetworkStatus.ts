import { useEffect, useState } from 'react';

// navigator.connection 是实验性 API，类型未进 lib.dom，这里按需声明。
type NetworkInformation = {
  downlink?: number; // 估算下行带宽 Mbps
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  rtt?: number; // 估算往返延迟 ms
  addEventListener?: (type: 'change', cb: () => void) => void;
  removeEventListener?: (type: 'change', cb: () => void) => void;
};

export type NetworkState = {
  online: boolean;
  effectiveType: NetworkInformation['effectiveType'] | null;
  downlink: number | null;
  rtt: number | null;
};

function getConnection(): NetworkInformation | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

function snapshot(): NetworkState {
  const conn = getConnection();
  return {
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    effectiveType: conn?.effectiveType ?? null,
    downlink: conn?.downlink ?? null,
    rtt: conn?.rtt ?? null,
  };
}

// 监听在线/离线 + 连接质量变化（带宽/延迟/网络类型）。
export function useNetworkStatus(): NetworkState {
  const [state, setState] = useState<NetworkState>(snapshot);

  useEffect(() => {
    const update = () => setState(snapshot());
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const conn = getConnection();
    conn?.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      conn?.removeEventListener?.('change', update);
    };
  }, []);

  return state;
}

// 把网络状态映射成 0~3 格信号强度。离线=0。
export function networkSignalBars(net: NetworkState): 0 | 1 | 2 | 3 {
  if (!net.online) return 0;
  // 优先用 effectiveType，没有就退回 rtt 估算，再不行默认满格。
  switch (net.effectiveType) {
    case 'slow-2g':
    case '2g':
      return 1;
    case '3g':
      return 2;
    case '4g':
      return 3;
    default:
      break;
  }
  if (net.rtt != null) {
    if (net.rtt > 600) return 1;
    if (net.rtt > 280) return 2;
    return 3;
  }
  return 3;
}
