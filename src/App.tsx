import Game, { type ControlMode } from './components/Game.tsx';
import Experience from './components/Experience.tsx';
import EndingsWall from './components/EndingsWall.tsx';
import Landing from './components/Landing.tsx';
import {
  setActivityEnterHandler,
  activityFromSchedule,
  type ActivityDescriptor,
} from './lib/activityEnter.ts';
import { resolveInterior } from '../data/birdRestaurantInterior.ts';
import { SCHEDULE, VENUE_COORDS, VENUES } from '../data/schedule.ts';
import { getAnonUserId } from './lib/identity.ts';

import { ToastContainer } from 'react-toastify';
// import { UserButton } from '@clerk/clerk-react';
// import { Authenticated, Unauthenticated } from 'convex/react';
// import LoginButton from './components/buttons/LoginButton.tsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { toast } from 'react-toastify';
import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import ReactModal from 'react-modal';
import { MAX_HUMAN_PLAYERS } from '../convex/constants.ts';
import PhotoMemoryModal, {
  type PhotoMemoryLocationOption,
} from './components/PhotoMemoryModal.tsx';
import PhotoMemoryNotifications from './components/PhotoMemoryNotifications.tsx';
import { setPhotoMemoryOpener } from './lib/photoMemoryBus.ts';
import { setEnterInteriorHandler } from './lib/mapFocus.ts';
import { useServerGame } from './hooks/serverGame.ts';

const MAP_SOURCE_WIDTH = 1703;
const MAP_SOURCE_HEIGHT = 1279;

function nearestVenueForTile(
  x: number,
  y: number,
  mapWidth: number,
  mapHeight: number,
): string | undefined {
  let best: { venue: string; distance: number } | null = null;
  for (const [venue, source] of Object.entries(VENUE_COORDS)) {
    if (!source) continue;
    const venueX = (source[0] / MAP_SOURCE_WIDTH) * mapWidth;
    const venueY = (source[1] / MAP_SOURCE_HEIGHT) * mapHeight;
    const distance = Math.hypot(x - venueX, y - venueY);
    if (!best || distance < best.distance) best = { venue, distance };
  }
  return best?.venue;
}

export default function Home() {
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlMode, setControlMode] = useState<ControlMode>('player');
  const [cameraFollow, setCameraFollow] = useState(true);
  const [showCollisionOverlay, setShowCollisionOverlay] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  // 当前正在体验的活动（从节目单点进），null = 在小镇里。
  const [activeActivity, setActiveActivity] = useState<ActivityDescriptor | null>(null);
  // 当前进入的内场世界（独立 world）；null = 在外部小镇。
  const [interiorWorld, setInteriorWorld] = useState<{
    interiorId: string;
    worldId: Id<'worlds'>;
    engineId: Id<'engines'>;
  } | null>(null);
  const getOrCreateInteriorWorld = useMutation(api.interiors.getOrCreateInteriorWorld);
  const [photoMemoryOpen, setPhotoMemoryOpen] = useState(false);
  // 深层入口（如作品详情）请求打开照片记忆时携带的预选地点；顶栏等通用入口为 null。
  const [photoMemoryOverride, setPhotoMemoryOverride] = useState<PhotoMemoryLocationOption | null>(
    null,
  );

  // 通用入口（顶栏/内场/体验）：清掉作品预选，按当前全局上下文打开。
  const openPhotoMemoryGeneric = () => {
    setPhotoMemoryOverride(null);
    setPhotoMemoryOpen(true);
  };

  // 公测实时结局墙：?wall=1 进入，跳过身份门，纯公共投屏大屏视图。
  const isWall = useMemo(() => new URLSearchParams(window.location.search).get('wall') === '1', []);

  // 连环画永久链接：?comic=<experienceId> 落地，跳过身份门，直接打开该篇灯箱（公共只读）。
  const comicId = useMemo(() => new URLSearchParams(window.location.search).get('comic'), []);

  // 扫码深链意图：?exp=<activityKey>。在首帧（onboarding 之前）就把它从 URL 里取出并固化下来，
  // 这样即便新用户要先完成 onboarding（期间 URL 可能被清/被 WeChat 改写），意图也不会丢。
  const pendingExpRef = useRef<string | null>(
    new URLSearchParams(window.location.search).get('exp'),
  );

  // 全局玩家身份：未完成 onboarding 前，强制停在录入页。
  const userId = useMemo(getAnonUserId, []);
  const profile = useQuery(api.profile.getProfile, { userId });
  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const defaultWorldId = worldStatus?.worldId;
  const defaultEngineId = worldStatus?.engineId;

  // 激活世界：进入内场时切到该内场的独立 world，否则用默认（外部小镇）世界。
  const activeWorldId = interiorWorld?.worldId ?? defaultWorldId;
  const activeEngineId = interiorWorld?.engineId ?? defaultEngineId;
  const activeInteriorId = interiorWorld?.interiorId;
  const activeInterior = activeInteriorId ? resolveInterior(activeInteriorId) : undefined;

  const game = useServerGame(activeWorldId);
  const humanTokenIdentifier = useQuery(
    api.world.userStatus,
    activeWorldId ? { worldId: activeWorldId, userId } : 'skip',
  ) ?? null;

  // 进入内场：取/建该内场的独立世界（含自有地图与 AI 居民），然后把客户端切过去。
  const enterInterior = useCallback(
    async (interiorId: string) => {
      try {
        const res = await getOrCreateInteriorWorld({ interiorId });
        setInteriorWorld({ interiorId, worldId: res.worldId, engineId: res.engineId });
      } catch (e) {
        console.error(e);
        toast.error('进入内场失败，请重试');
      }
    },
    [getOrCreateInteriorWorld],
  );
  const exitInterior = useCallback(() => setInteriorWorld(null), []);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    onFullscreenChange();
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // 节目单里的活动详情点击「进入专属体验」时被调用。
  useEffect(() => {
    setActivityEnterHandler((activity) => setActiveActivity(activity));
    return () => setActivityEnterHandler(null);
  }, []);

  // 作品详情等深层入口请求打开照片记忆（可携带预选地点）。
  useEffect(() => {
    setPhotoMemoryOpener((option) => {
      setPhotoMemoryOverride(option);
      setPhotoMemoryOpen(true);
    });
    return () => setPhotoMemoryOpener(null);
  }, []);

  // 空间集「进入内景」按钮：与走近入口按空格走同一出口。
  useEffect(() => {
    setEnterInteriorHandler((interiorId) => void enterInterior(interiorId));
    return () => setEnterInteriorHandler(null);
  }, [enterInterior]);

  // 扫码深链：?exp=<activityKey> 落地后自动打开对应活动的连环画体验。
  // 等身份就绪（新用户会先停在 onboarding），完成后再自动进入。
  // 意图取自首帧固化的 pendingExpRef（不再依赖此刻的 URL），消费一次即清空，
  // 避免新用户跨 onboarding 时丢失意图、或关闭体验回小镇后被重复打开。
  useEffect(() => {
    if (!profile) return;
    const raw = pendingExpRef.current;
    if (!raw) return;
    pendingExpRef.current = null;
    const key = decodeURIComponent(raw);
    const item = SCHEDULE.find((s) => `${s.date}|${s.time}|${s.venue}|${s.title}` === key);
    // 清掉 URL 里的 exp，避免刷新/分享时再次触发。
    const u = new URL(window.location.href);
    if (u.searchParams.has('exp')) {
      u.searchParams.delete('exp');
      window.history.replaceState({}, '', u.toString());
    }
    if (item) setActiveActivity(activityFromSchedule(item));
  }, [profile]);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  };
  const toggleControlMode = () =>
    setControlMode((currentMode) => (currentMode === 'player' ? 'camera' : 'player'));
  const toggleCameraFollow = () =>
    setCameraFollow((currentFollow) => {
      const nextFollow = !currentFollow;
      if (nextFollow) {
        setControlMode('player');
      }
      return nextFollow;
    });

  const currentPlayerLocationOption = useMemo<PhotoMemoryLocationOption | null>(() => {
    if (!game || !humanTokenIdentifier) return null;
    const humanPlayer = [...game.world.players.values()].find(
      (p) => p.human === humanTokenIdentifier,
    );
    if (!humanPlayer) return null;
    const x = Math.round(humanPlayer.position.x);
    const y = Math.round(humanPlayer.position.y);
    const nearestVenue = nearestVenueForTile(
      humanPlayer.position.x,
      humanPlayer.position.y,
      game.worldMap.width,
      game.worldMap.height,
    );
    return {
      id: 'current-player-location',
      label: '我的当前位置',
      detail: nearestVenue ? `靠近 ${nearestVenue}` : `地图坐标 ${x}, ${y}`,
      venue: nearestVenue,
      contextLabel: nearestVenue
        ? `玩家当前位置，靠近${nearestVenue}，地图坐标 ${x}, ${y}`
        : `玩家当前位置，地图坐标 ${x}, ${y}`,
    };
  }, [game, humanTokenIdentifier]);

  const photoMemoryLocationOptions = useMemo<PhotoMemoryLocationOption[]>(() => {
    const options: PhotoMemoryLocationOption[] = [];
    // 深层入口（作品详情）的预选地点排在最前，作为默认选中项。
    if (photoMemoryOverride) options.push(photoMemoryOverride);
    if (currentPlayerLocationOption) options.push(currentPlayerLocationOption);
    if (activeActivity) {
      options.push({
        id: `activity:${activeActivity.activityKey}`,
        label: '当前活动',
        detail: activeActivity.title,
        contextLabel: activeActivity.title,
        activityKey: activeActivity.activityKey,
        activityTitle: activeActivity.title,
        venue: activeActivity.hostName,
      });
    }
    if (activeInterior) {
      options.push({
        id: `interior:${activeInterior.id}`,
        label: '当前内场',
        detail: activeInterior.venue,
        contextLabel: activeInterior.venue,
        venue: activeInterior.venue,
      });
    }
    if (options.length === 0) {
      options.push({
        id: 'world:sand-city',
        label: '候鸟沙城',
        contextLabel: '候鸟沙城',
      });
    }
    for (const venue of VENUES) {
      options.push({
        id: `venue:${venue}`,
        label: venue,
        contextLabel: venue,
        venue,
      });
    }
    const deduped = new Map<string, PhotoMemoryLocationOption>();
    for (const option of options) deduped.set(option.id, option);
    return [...deduped.values()];
  }, [activeActivity, activeInterior, currentPlayerLocationOption, photoMemoryOverride]);

  const photoMemoryContext = useMemo(() => {
    if (photoMemoryLocationOptions[0]) {
      return photoMemoryLocationOptions[0];
    }
    if (activeActivity) {
      return {
        contextLabel: activeActivity.title,
        activityKey: activeActivity.activityKey,
        activityTitle: activeActivity.title,
        venue: activeActivity.hostName,
      };
    }
    if (activeInterior) {
      return {
        contextLabel: activeInterior.venue,
        venue: activeInterior.venue,
      };
    }
    return { contextLabel: '候鸟沙城' };
  }, [activeActivity, activeInterior, photoMemoryLocationOptions]);

  // 连环画永久链接：直接打开该篇灯箱（复用结局墙，跳过身份门）。
  if (comicId) {
    return <EndingsWall initialComicId={comicId as Id<'experiences'>} />;
  }

  // 公测实时结局墙：公共大屏，不经身份门，直接渲染。
  if (isWall) {
    return <EndingsWall />;
  }

  // 身份门：加载中显示占位（暖砂风，与 Landing/Onboarding 一致），未录入则强制 onboarding。
  if (profile === undefined) {
    return (
      <main
        className="flex screen-h items-center justify-center"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 4%, #f8f4ec 0%, #efe9dc 52%, #e4dccb 100%)',
        }}
      >
        <div
          className="splash-fade"
          style={{
            fontFamily: '"Noto Serif SC","Songti SC",serif',
            fontSize: 'clamp(11px,1.4vw,13px)',
            letterSpacing: '0.42em',
            textIndent: '0.42em',
            color: '#7a7063',
          }}
        >
          正 在 抵 达 沙 城…
        </div>
      </main>
    );
  }
  if (profile === null) {
    return <Landing userId={userId} onDone={() => undefined} />;
  }

  return (
    <main className="flex screen-h flex-col overflow-hidden font-body game-background bg-brown-900">
      <ReactModal
        isOpen={helpModalOpen}
        onRequestClose={() => setHelpModalOpen(false)}
        style={modalStyles}
        contentLabel="帮助弹窗"
        ariaHideApp={false}
      >
        <div className="sand-letter rounded-[18px] px-8 py-7">
          <div className="sand-gilt" />
          <button className="sand-wax" onClick={() => setHelpModalOpen(false)} aria-label="关闭">
            ×
          </button>
          <div className="body">
            <h2 className="text-center text-3xl tracking-[3px]">沙之书 · 漫游须知</h2>
            <p className="mb-5 mt-1.5 text-center text-xs tracking-[0.3em] text-[#9c7e5e]">
              天 启 候 鸟 · 入 城 指 引
            </p>
            <p className="mb-3 leading-[1.95]">
              欢迎来到候鸟沙城。《沙之书》是一本没有第一页、也没有最后一页的书——你可以匿名<i>旁观</i>，也可以登录后<i>加入</i>这片沙城，与居民同行、交谈。
            </p>
            <p className="mb-3 leading-[1.95]">
              点击拖拽平移视角，滚轮缩放；点击任一居民查看其行迹与对话。登录后点「加入沙城」，你的身影便会落在地图某处，脚下泛起一圈光环。
            </p>
            <p className="mb-3 leading-[1.95]">
              想交谈，先点击对方再点「发起对话」，它会朝你走来；走近即开始，你可随时走开或关闭面板结束。对方也可能主动来邀，你会在消息面板看到接受按钮。
            </p>
            <div className="my-4 flex flex-wrap justify-center gap-2">
              {['WASD 移动', 'C 模式', 'V 跟随', '+ / − 缩放', '0 全图', 'F 全屏'].map((k) => (
                <span
                  key={k}
                  className="rounded-md border border-[#cdb488] bg-[#e8d6b0] px-2.5 py-0.5 font-num text-sm font-semibold text-[#2a1c14]"
                >
                  {k}
                </span>
              ))}
            </div>
            <p className="text-center text-xs leading-relaxed text-[#9c7e5e]">
              同一时间最多 {MAX_HUMAN_PLAYERS} 名真人玩家；闲置逾五分钟将自动离场。
            </p>
          </div>
        </div>
      </ReactModal>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Game
          userId={userId}
          worldId={activeWorldId}
          engineId={activeEngineId}
          interiorId={activeInteriorId}
          onExitInterior={exitInterior}
          controlMode={controlMode}
          cameraFollow={cameraFollow}
          isFullscreen={isFullscreen}
          showCollisionOverlay={showCollisionOverlay}
          calibrating={calibrating}
          onToggleControlMode={toggleControlMode}
          onToggleCameraFollow={toggleCameraFollow}
          onSetCameraFollow={setCameraFollow}
          onToggleFullscreen={() => void toggleFullscreen()}
          onToggleCollisionOverlay={() => setShowCollisionOverlay((visible) => !visible)}
          onToggleCalibrating={() => setCalibrating((on) => !on)}
          onOpenPhotoMemory={openPhotoMemoryGeneric}
          onHelp={() => setHelpModalOpen(true)}
          onEnterVenueInterior={(interiorId) => void enterInterior(interiorId)}
        />

        <PhotoMemoryNotifications userId={userId} />
        <ToastContainer position="bottom-right" autoClose={2000} closeOnClick theme="dark" />
      </div>

      {/* 活动专属体验：作为覆盖层叠在小镇之上，关闭即回到小镇（小镇状态不丢） */}
      {activeActivity && (
        <div
          className="fixed inset-0 z-[60] bg-brown-900"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <Experience
            key={activeActivity.activityKey}
            activity={activeActivity}
            onOpenPhotoMemory={openPhotoMemoryGeneric}
            onExit={() => setActiveActivity(null)}
          />
        </div>
      )}

      <PhotoMemoryModal
        open={photoMemoryOpen}
        onClose={() => setPhotoMemoryOpen(false)}
        userId={userId}
        userName={profile.name}
        context={photoMemoryContext}
        locationOptions={photoMemoryLocationOptions}
      />
    </main>
  );
}

const modalStyles = {
  overlay: {
    backgroundColor: 'rgba(20, 12, 6, 0.72)',
    zIndex: 12,
  },
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    width: 'min(560px, calc(100vw - 32px))',
    maxWidth: 'none',
    maxHeight: '85vh',
    overflow: 'visible',
    // 透明外壳：真正的纸面样式由内部 .sand-letter 提供
    border: 'none',
    borderRadius: '0',
    background: 'transparent',
    padding: 0,
  },
} as const;
