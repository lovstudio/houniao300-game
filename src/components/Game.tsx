import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import PixiGame from './PixiGame.tsx';
import Joystick from './Joystick.tsx';
import type { MapMarker } from './PixiStaticMap.tsx';
import { setPanelOpenHandler } from '../lib/panelBus.ts';
import { selectInstallationOnMap } from '../lib/mapFocus.ts';
import CalibrationPanel from './CalibrationPanel.tsx';
import type { VenueInteriorMap } from '../../data/birdRestaurantInterior.ts';
import type { Id } from '../../convex/_generated/dataModel';

import { useElementSize, useMediaQuery } from 'usehooks-ts';
import { Stage } from '@pixi/react';
import { ConvexProvider, useConvex, useQuery } from 'convex/react';
import SettingsMenu from './SettingsMenu';
import SidebarTabs from './SidebarTabs.tsx';
import BroadcastHud from './BroadcastHud.tsx';
import Composer, { type Character } from './Composer.tsx';
import { useAutoJoinWorld } from '../hooks/useAutoJoinWorld.ts';
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
  worldId,
  engineId,
  interior,
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
  onExitInterior,
}: {
  userId: string;
  // 当前激活世界：外部小镇=默认世界；进入内场时=该内场的独立世界。
  // 可能为 undefined（默认世界状态加载中）；下方守卫会拦截。
  worldId?: Id<'worlds'>;
  engineId?: Id<'engines'>;
  interior?: VenueInteriorMap;
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
  onExitInterior?: () => void;
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
  // 触屏设备：显示虚拟摇杆，并把「按空格」提示变为可点按钮（手机无空格键）。
  const isTouch = useMediaQuery('(pointer: coarse)');

  const triggerNearby = (prompt: NearbyPrompt) => {
    if (prompt.kind === 'venue') onEnterVenueInterior?.(prompt.interiorId);
    else selectInstallationOnMap(prompt.id);
  };

  // 选中某个角色时，在移动端自动弹出面板查看其详情。
  useEffect(() => {
    if (selectedElement) setPanelOpen(true);
  }, [selectedElement]);

  // 底部「节目单」（移动端）通过总线打开本抽屉。
  useEffect(() => {
    setPanelOpenHandler(() => setPanelOpen(true));
    return () => setPanelOpenHandler(null);
  }, []);

  const game = useServerGame(worldId);

  // Send a periodic heartbeat to the active world to keep it alive.
  useWorldHeartbeat(worldId);

  // 打开即自动入场（方案 A）——入场是世界规则，不再是一个按钮。
  useAutoJoinWorld(userId, worldId);

  // 作品（DB 唯一真相源）：地图标记与侧栏列表共用同一数据。
  const artworks = useQuery(api.artworks.list, worldId ? { worldId } : 'skip');
  const markers: MapMarker[] | undefined = useMemo(
    () => artworks?.map((a) => ({ id: a.slug, x: a.x, y: a.y, kind: a.kind })),
    [artworks],
  );

  const worldState = useQuery(api.world.worldState, worldId ? { worldId } : 'skip');
  const { historicalTime, timeManager } = useHistoricalTime(worldState?.engine);

  // 传话器的 @ 候选：场上所有 AI 居民。
  const characters: Character[] = useMemo(() => {
    if (!game) return [];
    return [...game.world.players.values()]
      .filter((p) => !p.human)
      .map((p) => ({ id: p.id as string, name: game.playerDescriptions.get(p.id)?.name ?? '居民' }));
  }, [game]);

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
          <BroadcastHud
            worldId={worldId}
            userId={userId}
            onSelectAgent={(id) => setSelectedElement({ kind: 'player', id })}
          />
          {calibrating && <CalibrationPanel />}
          {/* 内场模式：左上角显示场馆名 + 离开按钮，切回外部小镇 */}
          {interior && (
            <div className="pointer-events-none absolute left-3 top-3 z-40 flex items-center gap-2">
              <span className="rounded-full border border-[#c99650]/60 bg-brown-900/85 px-3 py-1.5 text-sm font-bold text-[#ffe7bc] shadow-lg">
                {interior.venue}内场
              </span>
              {onExitInterior && (
                <button
                  type="button"
                  onClick={onExitInterior}
                  className="pointer-events-auto rounded-full border border-[#c99650] bg-[#3a251b] px-3 py-1.5 text-sm font-bold text-[#ffe7bc] shadow-lg transition hover:bg-[#5a3425]"
                >
                  离开内场
                </button>
              )}
            </div>
          )}
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
                  interior={interior}
                  showCollisionOverlay={showCollisionOverlay}
                  historicalTime={historicalTime}
                  setSelectedElement={setSelectedElement}
                  setNearbyPrompt={setNearbyPrompt}
                  markers={markers}
                />
              </ConvexProvider>
            </Stage>
          </div>
          {/* 桌面端：走近空间/作品时的「按空格」提示（底部居中，抬高避让传话器） */}
          {nearbyPrompt && !isTouch && (
            <div className="pointer-events-none absolute inset-x-0 bottom-24 z-40 flex justify-center px-4">
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

          {/* 移动端控制层：左下摇杆移动 + 右下动作键交互（经典双拇指布局）。面板展开时隐藏。 */}
          {isTouch && !panelOpen && (
            <>
              {controlMode === 'player' && <Joystick />}
              {nearbyPrompt && (
                <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom,0px)+2.25rem)] right-[calc(env(safe-area-inset-right,0px)+1.5rem)] z-40 flex flex-col items-center gap-1.5">
                  <button
                    onClick={() => triggerNearby(nearbyPrompt)}
                    aria-label={`${nearbyPrompt.kind === 'venue' ? '进入' : '查看'}${nearbyPrompt.label}`}
                    className="pointer-events-auto relative grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full border-2 border-white/60 bg-[#cc785c] text-white shadow-xl transition-transform active:scale-90"
                  >
                    <span className="absolute inset-0 animate-ping rounded-full bg-[#cc785c]/40" />
                    {nearbyPrompt.kind === 'venue' ? (
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                      </svg>
                    ) : (
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                  <span className="max-w-[6rem] truncate rounded-full bg-brown-900/85 px-2.5 py-0.5 text-center text-xs text-brown-100 shadow">
                    {nearbyPrompt.kind === 'venue' ? '进入' : '查看'}·{nearbyPrompt.label}
                  </span>
                </div>
              )}
            </>
          )}
          {/* 主视图底部居中的传话器：语音/文字 + @ 居民，话语落入通知系统。移动端控制层展开时让位。 */}
          {!(isTouch && !panelOpen) && (
            <Composer worldId={worldId} userId={userId} characters={characters} />
          )}
          {/* 收起态把手：贴右缘的浮木卷轴拉手——和手卷同源的世界道具，向左拉即展开。 */}
          {!panelOpen && (
            <button
              className="sand-handle md:hidden"
              onClick={() => setPanelOpen(true)}
              title="展开沙城手卷（状态 / 空间 / 作品 / 活动 / 设置）"
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
                  userId={userId}
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
