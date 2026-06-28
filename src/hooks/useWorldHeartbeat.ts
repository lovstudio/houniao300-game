import { useMutation } from 'convex/react';
import { useEffect } from 'react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { WORLD_HEARTBEAT_INTERVAL } from '../../convex/constants';

// 给指定 world 定期发送心跳保活；切到内场世界时传入其 worldId。
// 内场闲置被 cron 休眠后，心跳触发 heartbeatWorld 自动唤醒（见 convex/world.ts）。
// 服务端已对 lastViewed 做节流，这里无需再判时间窗。
export function useWorldHeartbeat(worldId?: Id<'worlds'>) {
  const heartbeat = useMutation(api.world.heartbeatWorld);
  useEffect(() => {
    if (!worldId) return;
    const sendHeartBeat = () => void heartbeat({ worldId });
    sendHeartBeat();
    const id = setInterval(sendHeartBeat, WORLD_HEARTBEAT_INTERVAL);
    return () => clearInterval(id);
  }, [worldId, heartbeat]);
}
