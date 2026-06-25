import { useEffect, useState } from 'react';
import clsx from 'clsx';
import PixiGame from './PixiGame.tsx';

import { useElementSize } from 'usehooks-ts';
import { Stage } from '@pixi/react';
import { ConvexProvider, useConvex, useQuery } from 'convex/react';
import SidebarTabs from './SidebarTabs.tsx';
import { api } from '../../convex/_generated/api';
import { useWorldHeartbeat } from '../hooks/useWorldHeartbeat.ts';
import { useHistoricalTime } from '../hooks/useHistoricalTime.ts';
import { DebugTimeManager } from './DebugTimeManager.tsx';
import { GameId } from '../../convex/aiTown/ids.ts';
import { useServerGame } from '../hooks/serverGame.ts';

export const SHOW_DEBUG_UI = !!import.meta.env.VITE_SHOW_DEBUG_UI;
export type ControlMode = 'player' | 'camera';

export default function Game({
  controlMode,
  cameraFollow,
  onToggleControlMode,
  onToggleCameraFollow,
  onSetCameraFollow,
}: {
  controlMode: ControlMode;
  cameraFollow: boolean;
  onToggleControlMode: () => void;
  onToggleCameraFollow: () => void;
  onSetCameraFollow: (enabled: boolean) => void;
}) {
  const convex = useConvex();
  const [selectedElement, setSelectedElement] = useState<{
    kind: 'player';
    id: GameId<'players'>;
  }>();
  const [gameWrapperRef, { width, height }] = useElementSize();
  // 移动端：侧边栏改为可开合抽屉（空间不够，不能常驻底部）。
  const [panelOpen, setPanelOpen] = useState(false);

  // 选中某个角色时，在移动端自动弹出面板查看其详情。
  useEffect(() => {
    if (selectedElement) setPanelOpen(true);
  }, [selectedElement]);

  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;
  const engineId = worldStatus?.engineId;

  const game = useServerGame(worldId);

  // Send a periodic heartbeat to our world to keep it alive.
  useWorldHeartbeat();

  const worldState = useQuery(api.world.worldState, worldId ? { worldId } : 'skip');
  const { historicalTime, timeManager } = useHistoricalTime(worldState?.engine);

  if (!worldId || !engineId || !game) {
    return null;
  }
  return (
    <>
      {SHOW_DEBUG_UI && <DebugTimeManager timeManager={timeManager} width={200} height={100} />}
      <div className="fullscreen-game-frame game-frame grid h-full min-h-0 w-full lg:grid-rows-[1fr] lg:grid-cols-[minmax(0,1fr)_minmax(19rem,24rem)]">
        {/* Game area（移动端占满全屏） */}
        <div className="relative min-h-0 min-w-0 overflow-hidden bg-brown-900" ref={gameWrapperRef}>
          <div className="absolute inset-0">
            <div className="container">
              <Stage width={width} height={height} options={{ backgroundColor: 0x7ab5ff }}>
                {/* Re-propagate context because contexts are not shared between renderers.
https://github.com/michalochman/react-pixi-fiber/issues/145#issuecomment-531549215 */}
                <ConvexProvider client={convex}>
                  <PixiGame
                    game={game}
                    worldId={worldId}
                    engineId={engineId}
                    width={width}
                    height={height}
                    controlMode={controlMode}
                    cameraFollow={cameraFollow}
                    onToggleControlMode={onToggleControlMode}
                    onToggleCameraFollow={onToggleCameraFollow}
                    onSetCameraFollow={onSetCameraFollow}
                    historicalTime={historicalTime}
                    setSelectedElement={setSelectedElement}
                  />
                </ConvexProvider>
              </Stage>
            </div>
          </div>
          {/* 移动端浮动入口：打开节目单/状态/广播面板 */}
          {!panelOpen && (
            <button
              onClick={() => setPanelOpen(true)}
              style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
              className="absolute right-3 z-30 rounded-full bg-clay-700 px-4 py-3 font-display text-sm text-white shadow-solid lg:hidden"
            >
              节目单 · 面板
            </button>
          )}
        </div>

        {/* 移动端抽屉遮罩 */}
        {panelOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setPanelOpen(false)}
          />
        )}

        {/* 右侧面板：移动端为右侧滑入抽屉，桌面端为栅格常驻第二列 */}
        <div
          className={clsx(
            'flex min-h-0 flex-col overflow-hidden bg-brown-800/95 text-brown-100',
            'fixed inset-y-0 right-0 z-50 w-[86%] max-w-sm border-l-8 border-brown-900 shadow-2xl transition-transform duration-300',
            'pt-[env(safe-area-inset-top)] lg:pt-0',
            panelOpen ? 'translate-x-0' : 'translate-x-full',
            'lg:static lg:z-auto lg:w-96 lg:max-w-none lg:translate-x-0 lg:border-l-8 lg:shadow-none',
          )}
        >
          <button
            onClick={() => setPanelOpen(false)}
            className="flex shrink-0 items-center border-b border-brown-700/50 px-3 py-2 text-sm text-brown-300 lg:hidden"
          >
            收起面板
          </button>
          <SidebarTabs
            worldId={worldId}
            engineId={engineId}
            game={game}
            playerId={selectedElement?.id}
            setSelectedElement={setSelectedElement}
            onActivate={() => setPanelOpen(true)}
          />
        </div>
      </div>
    </>
  );
}
