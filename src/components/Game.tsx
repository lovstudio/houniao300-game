import { useEffect, useState } from 'react';
import clsx from 'clsx';
import PixiGame from './PixiGame.tsx';
import { setPanelOpenHandler } from '../lib/panelBus.ts';
import CalibrationPanel from './CalibrationPanel.tsx';

import { useElementSize } from 'usehooks-ts';
import { Stage } from '@pixi/react';
import { ConvexProvider, useConvex, useQuery } from 'convex/react';
import SettingsMenu from './SettingsMenu';
import SidebarTabs from './SidebarTabs.tsx';
import { useAutoJoinWorld } from '../hooks/useAutoJoinWorld.ts';
import SignalHud from './SignalHud.tsx';
import { api } from '../../convex/_generated/api';
import { useWorldHeartbeat } from '../hooks/useWorldHeartbeat.ts';
import { useHistoricalTime } from '../hooks/useHistoricalTime.ts';
import { DebugTimeManager } from './DebugTimeManager.tsx';
import { GameId } from '../../convex/aiTown/ids.ts';
import { useServerGame } from '../hooks/serverGame.ts';
import { SHOW_DEBUG_UI, SHOW_DEV_TOOLS } from '../lib/debugSettings.ts';

export type ControlMode = 'player' | 'camera';

// 玩家走近一个「空间」入口或一件「作品」时，提示其可按空格查看详情/进入。
export type NearbyPrompt =
  | { kind: 'venue'; interiorId: string; label: string }
  | { kind: 'installation'; id: string; label: string };

export default function Game({
  userId,
  controlMode,
  cameraFollow,
  isFullscreen,
  showCollisionOverlay,
  calibrating,
  onToggleControlMode,
  onToggleCameraFollow,
  onSetCameraFollow,
  onToggleFullscreen,
  onToggleCollisionOverlay,
  onToggleCalibrating,
  onOpenPhotoMemory,
  onHelp,
  onEnterVenueInterior,
}: {
  userId: string;
  controlMode: ControlMode;
  cameraFollow: boolean;
  isFullscreen: boolean;
  showCollisionOverlay: boolean;
  calibrating: boolean;
  onToggleControlMode: () => void;
  onToggleCameraFollow: () => void;
  onSetCameraFollow: (enabled: boolean) => void;
  onToggleFullscreen: () => void;
  onToggleCollisionOverlay: () => void;
  onToggleCalibrating: () => void;
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
  // 玩家走近空间入口或作品时的「按空格查看详情」提示。
  const [nearbyPrompt, setNearbyPrompt] = useState<NearbyPrompt | null>(null);

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

  // 打开即自动入场（方案 A）——入场是世界规则，不再是一个按钮。
  useAutoJoinWorld(userId, worldId);

  const worldState = useQuery(api.world.worldState, worldId ? { worldId } : 'skip');
  const { historicalTime, timeManager } = useHistoricalTime(worldState?.engine);

  if (!worldId || !engineId || !game) {
    return null;
  }
  return (
    <>
      {SHOW_DEBUG_UI && <DebugTimeManager timeManager={timeManager} width={200} height={100} />}
      <div className="fullscreen-game-frame game-frame relative h-full min-h-0 w-full overflow-hidden md:grid md:grid-rows-[1fr] md:grid-cols-[minmax(0,1fr)_minmax(19rem,24rem)]">
        {/* Game area：移动端满屏（面板浮在其上）；md+ 占栅格第一列，被面板压缩 */}
        <div
          className="absolute inset-0 overflow-hidden bg-brown-900 md:relative md:inset-auto md:min-h-0 md:min-w-0"
          ref={gameWrapperRef}
        >
          <SignalHud />
          {calibrating && <CalibrationPanel />}
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
                  setNearbyPrompt={setNearbyPrompt}
                />
              </ConvexProvider>
            </Stage>
          </div>
          {/* 走近空间/作品时的交互提示（不拦截指针） */}
          {nearbyPrompt && (
            <div className="pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center px-4">
              <div className="flex items-center gap-2 rounded-full border border-white/15 bg-brown-900/90 px-4 py-2 text-sm text-brown-100 shadow-xl">
                <kbd className="rounded border border-white/30 bg-brown-800 px-2 py-0.5 font-mono text-xs tracking-wider text-white">
                  空格
                </kbd>
                <span>
                  {nearbyPrompt.kind === 'venue' ? '进入' : '查看'}「{nearbyPrompt.label}」
                </span>
              </div>
            </div>
          )}
          {/* 收起态把手：贴右缘的浮木卷轴拉手——和手卷同源的世界道具，向左拉即展开。 */}
          {!panelOpen && (
            <button
              className="sand-handle md:hidden"
              onClick={() => setPanelOpen(true)}
              title="展开沙城手卷（状态 / 广播 / 节目单 / 作品 / 设置）"
              aria-label="展开沙城手卷"
            >
              <span className="seal">卷</span>
              <span className="glyph">手卷</span>
              <span className="chev">‹</span>
            </button>
          )}


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
            className="fixed inset-0 z-[55] bg-black/50 md:hidden"
            onClick={() => setPanelOpen(false)}
          />
        )}

        {/* 右侧可折叠手卷：浮木轴 + 毛笔卷头，统一为浮层抽屉覆盖在满屏地图之上 */}
        <div
          className={clsx(
            'sand-paper-bg flex min-h-0 overflow-hidden text-[#2a1c14]',
            'fixed inset-y-0 right-0 z-[60] w-[86%] max-w-sm',
            'md:static md:inset-auto md:z-auto md:w-full md:max-w-none',
            'shadow-2xl transition-transform duration-300 md:shadow-none md:transition-none',
            panelOpen ? 'translate-x-0' : 'translate-x-full',
            'md:translate-x-0',
          )}
        >
          {/* 浮木卷轴左缘 */}
          <div className="sand-roller" />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col pt-[env(safe-area-inset-top)] md:pt-0">
            {/* 毛笔卷头：卷名居中 + 副题；设置/收起为右上角墨色小图标 */}
            <div className="sand-masthead shrink-0">
              <span className="t">沙城手卷</span>
              <span className="sub">奉 候 鸟 而 来</span>
              <div className="corner">
                <SettingsMenu
                  tone="ink"
                  controlMode={controlMode}
                  cameraFollow={cameraFollow}
                  isFullscreen={isFullscreen}
                  showCollisionOverlay={showCollisionOverlay}
                  calibrating={calibrating}
                  onToggleControlMode={onToggleControlMode}
                  onToggleCameraFollow={onToggleCameraFollow}
                  onToggleFullscreen={onToggleFullscreen}
                  onToggleCollisionOverlay={onToggleCollisionOverlay}
                  onToggleCalibrating={onToggleCalibrating}
                  onOpenPhotoMemory={onOpenPhotoMemory}
                  onHelp={onHelp}
                />
                <button
                  onClick={() => setPanelOpen(false)}
                  className="sand-icon-btn md:hidden"
                  title="收起手卷"
                  aria-label="收起手卷"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
              </div>
            </div>
            <SidebarTabs
              worldId={worldId}
              engineId={engineId}
              game={game}
              userId={userId}
              playerId={selectedElement?.id}
              setSelectedElement={setSelectedElement}
              onActivate={() => setPanelOpen(true)}
            />
            {/* 卷尾题词（博尔赫斯） */}
            <div className="shrink-0 border-t border-[#cbb287] px-4 py-2 text-center font-num text-[12px] italic text-[#9c7e5e]">
              没有第一页，也没有最后一页
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
