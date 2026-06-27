import DeckButton from './DeckButton';
import { JoinIcon } from './DeckIcons';
import { toast } from 'react-toastify';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { ConvexError } from 'convex/values';
import { Id } from '../../../convex/_generated/dataModel';
import { useEffect, useRef } from 'react';
import { waitForInput } from '../../hooks/sendInput';
import { useServerGame } from '../../hooks/serverGame';

// 沙之书 · 方案 A：打开即自动入场，无需点击；不提供「离开」。
// 身份按设备匿名 id（userId）区分，故天然支持多人各自独立化身。
// 若被服务端按空闲回收（HUMAN_IDLE_TOO_LONG），isPlaying 由 true→false，
// effect 重新触发会自动再次入场——所以事实上离不开这本书。
export default function InteractButton({
  userId,
  worldId,
}: {
  userId: string;
  worldId?: Id<'worlds'>;
}) {
  const game = useServerGame(worldId);
  const humanTokenIdentifier = useQuery(
    api.world.userStatus,
    worldId ? { worldId, userId } : 'skip',
  );
  const userPlayerId =
    game && [...game.world.players.values()].find((p) => p.human === humanTokenIdentifier)?.id;
  const join = useMutation(api.world.joinWorld);
  const isPlaying = !!userPlayerId;

  const convex = useConvex();
  const joiningRef = useRef(false);

  useEffect(() => {
    // 数据未就绪、已在世界中、或正在入场途中：都不重复发起。
    if (!worldId || game === undefined || humanTokenIdentifier === undefined) {
      return;
    }
    if (isPlaying || joiningRef.current) {
      return;
    }
    joiningRef.current = true;
    void (async () => {
      try {
        const inputId = await join({ worldId, userId });
        await waitForInput(convex, inputId);
        // 成功后 isPlaying 经订阅翻为 true，effect 重跑即提前返回，不会重复加入。
      } catch (e: any) {
        if (e instanceof ConvexError) {
          toast.error(e.data);
        } else {
          console.error(e);
        }
        // 失败不自动重试（依赖未变即不重跑），避免世界满员时反复打服务端。
      } finally {
        joiningRef.current = false;
      }
    })();
  }, [worldId, game, humanTokenIdentifier, isPlaying, join, userId, convex]);

  return (
    <DeckButton
      active={isPlaying}
      title={isPlaying ? '你已在模拟世界中' : '正在进入模拟世界…'}
      icon={<JoinIcon />}
    >
      {isPlaying ? '在世界中' : '进入中…'}
    </DeckButton>
  );
}
