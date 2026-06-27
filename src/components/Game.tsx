import { useEffect, useState } from 'react';
import clsx from 'clsx';
import PixiGame from './PixiGame.tsx';
import { setPanelOpenHandler } from '../lib/panelBus.ts';

import { useElementSize } from 'usehooks-ts';
import { Stage } from '@pixi/react';
import { ConvexProvider, useConvex, useQuery } from 'convex/react';
import InteractButton from './buttons/InteractButton';
import SettingsMenu from './SettingsMenu';
import DeckButton from './buttons/DeckButton';
import { ChevronIcon } from './buttons/DeckIcons';
import SidebarTabs from './SidebarTabs.tsx';
import { api } from '../../convex/_generated/api';
import { useWorldHeartbeat } from '../hooks/useWorldHeartbeat.ts';
import { useHistoricalTime } from '../hooks/useHistoricalTime.ts';
import { DebugTimeManager } from './DebugTimeManager.tsx';
import { GameId } from '../../convex/aiTown/ids.ts';
import { useServerGame } from '../hooks/serverGame.ts';
import { SHOW_DEBUG_UI, SHOW_DEV_TOOLS } from '../lib/debugSettings.ts';

export type ControlMode = 'player' | 'camera';

export default function Game({
  userId,
  controlMode,
  cameraFollow,
  isFullscreen,
  showCollisionOverlay,
  onToggleControlMode,
  onToggleCameraFollow,
  onSetCameraFollow,
  onToggleFullscreen,
  onToggleCollisionOverlay,
  onOpenPhotoMemory,
  onHelp,
  onEnterVenueInterior,
}: {
  userId: string;
  controlMode: ControlMode;
  cameraFollow: boolean;
  isFullscreen: boolean;
  showCollisionOverlay: boolean;
  onToggleControlMode: () => void;
  onToggleCameraFollow: () => void;
  onSetCameraFollow: (enabled: boolean) => void;
  onToggleFullscreen: () => void;
  onToggleCollisionOverlay: () => void;
  onOpenPhotoMemory: () => void;
  onHelp: () => void;
  onEnterVenueInterior?: (interiorId: string) => void;
}) {
  const convex = useConvex();
  const [selectedElement, setSelectedElement] = useState<{
    kind: 'player';
    id: GameId<'players'>;
  }>();
  const [gameWrapperRef, { width, height }] = useElementSize();
  // 侧边栏统一为可折叠的浮层抽屉（覆盖在满屏地图上）。桌面端默认展开，移动端默认收起。
  const [panelOpen, setPanelOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1024,
  );

  // 选中某个角色时，在移动端自动弹出面板查看其详情。
  useEffect(() => {
    if (selectedElement) setPanelOpen(true);
  }, [selectedElement]);

  // 底部「节目单」（移动端）通过总线打开本抽屉。
  useEffect(() => {
    setPanelOpenHandler(() => setPanelOpen(true));
    return () => setPanelOpenHandler(null);
  }, []);

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
      <div className="fullscreen-game-frame game-frame relative h-full min-h-0 w-full overflow-hidden">
        {/* Game area：始终满屏，面板浮在其上 */}
        <div className="absolute inset-0 overflow-hidden bg-brown-900" ref={gameWrapperRef}>
          <div className="absolute inset-0">
            <Stage width={width} height={height} options={{ backgroundColor: 0x181425 }}>
              {/* Re-propagate context because contexts are not shared between renderers.
https://github.com/michalochman/react-pixi-fiber/issues/145#issuecomment-531549215 */}
              <ConvexProvider client={convex}>
                <PixiGame
                  userId={userId}
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
                  onEnterVenueInterior={onEnterVenueInterior}
                  showCollisionOverlay={showCollisionOverlay}
                  historicalTime={historicalTime}
                  setSelectedElement={setSelectedElement}
                />
              </ConvexProvider>
            </Stage>
          </div>
          {/* 游戏内悬浮控制台：加入世界 / 设置 / 照片记忆 / 帮助 / 面板 —— 所有交互都在游戏内部。
              放左上角，避免被右侧滑出的面板盖住。 */}
          <div
            className="absolute left-3 z-40 flex items-center gap-1"
            style={{ top: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
          >
            <InteractButton userId={userId} worldId={worldId} />
            <SettingsMenu
              controlMode={controlMode}
              cameraFollow={cameraFollow}
              isFullscreen={isFullscreen}
              showCollisionOverlay={showCollisionOverlay}
              onToggleControlMode={onToggleControlMode}
              onToggleCameraFollow={onToggleCameraFollow}
              onToggleFullscreen={onToggleFullscreen}
              onToggleCollisionOverlay={onToggleCollisionOverlay}
              onOpenPhotoMemory={onOpenPhotoMemory}
              onHelp={onHelp}
            />
            <DeckButton
              icon={<ChevronIcon />}
              active={panelOpen}
              onClick={() => setPanelOpen((v) => !v)}
              title="状态 / 广播 / 节目单 / 作品 面板"
            >
              面板
            </DeckButton>
          </div>

          {SHOW_DEV_TOOLS && showCollisionOverlay && (
            <div className="pointer-events-none absolute bottom-3 left-3 z-40 rounded-lg border border-white/20 bg-brown-900/85 px-3 py-2 text-[11px] leading-tight text-brown-100 shadow-xl">
              <div className="mb-1 font-semibold">碰撞染色</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1">
                  <i className="h-2.5 w-2.5 rounded-sm bg-[#ff4d3d]" />
                  有效阻挡
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 移动端抽屉遮罩（桌面端不遮挡地图，靠面板内的收起按钮关闭） */}
        {panelOpen && (
          <div
            className="fixed inset-0 z-[55] bg-black/50 lg:hidden"
            onClick={() => setPanelOpen(false)}
          />
        )}

        {/* 右侧可折叠面板：所有断点统一为浮层抽屉，覆盖在满屏地图之上 */}
        <div
          className={clsx(
            'flex min-h-0 flex-col overflow-hidden bg-brown-800/95 text-brown-100',
            'fixed inset-y-0 right-0 z-[60] w-[86%] max-w-sm lg:w-96 lg:max-w-none',
            'border-l-8 border-brown-900 shadow-2xl transition-transform duration-300',
            'pt-[env(safe-area-inset-top)] lg:pt-0',
            panelOpen ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          <button
            onClick={() => setPanelOpen(false)}
            className="flex shrink-0 items-center gap-1 border-b border-brown-700/50 px-3 py-2 text-sm text-brown-300 hover:text-brown-100"
          >
            收起面板
          </button>
          <SidebarTabs
            worldId={worldId}
            engineId={engineId}
            game={game}
            userId={userId}
            playerId={selectedElement?.id}
            setSelectedElement={setSelectedElement}
            onActivate={() => setPanelOpen(true)}
          />
        </div>
      </div>
    </>
  );
}
