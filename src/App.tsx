import Game, { type ControlMode } from './components/Game.tsx';
import Timeline from './components/Timeline.tsx';
import Experience from './components/Experience.tsx';
import EndingsWall from './components/EndingsWall.tsx';
import Landing from './components/Landing.tsx';
import VenueInteriorMap from './components/VenueInteriorMap.tsx';
import {
  setActivityEnterHandler,
  activityFromSchedule,
  type ActivityDescriptor,
} from './lib/activityEnter.ts';
import {
  getVenueInterior,
  type VenueInteriorMap as VenueInteriorMapData,
} from '../data/birdRestaurantInterior.ts';
import { SCHEDULE, VENUE_COORDS, VENUES } from '../data/schedule.ts';
import { getAnonUserId } from './lib/identity.ts';

import { ToastContainer } from 'react-toastify';
// import { UserButton } from '@clerk/clerk-react';
// import { Authenticated, Unauthenticated } from 'convex/react';
// import LoginButton from './components/buttons/LoginButton.tsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import ReactModal from 'react-modal';
import TopBar from './components/TopBar.tsx';
import { MAX_HUMAN_PLAYERS } from '../convex/constants.ts';
import PhotoMemoryModal, {
  type PhotoMemoryLocationOption,
} from './components/PhotoMemoryModal.tsx';
import PhotoMemoryNotifications from './components/PhotoMemoryNotifications.tsx';
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
  // 当前正在体验的活动（从节目单点进），null = 在小镇里。
  const [activeActivity, setActiveActivity] = useState<ActivityDescriptor | null>(null);
  const [activeInterior, setActiveInterior] = useState<VenueInteriorMapData | null>(null);
  const [photoMemoryOpen, setPhotoMemoryOpen] = useState(false);

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
  const worldId = worldStatus?.worldId;
  const game = useServerGame(worldId);
  const humanTokenIdentifier = useQuery(
    api.world.userStatus,
    worldId ? { worldId, userId } : 'skip',
  ) ?? null;

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
    setControlMode((currentMode) => {
      const nextMode = currentMode === 'player' ? 'camera' : 'player';
      setCameraFollow(nextMode === 'player');
      return nextMode;
    });
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
  }, [activeActivity, activeInterior, currentPlayerLocationOption]);

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

  // 身份门：加载中显示占位，未录入则强制 onboarding。
  if (profile === undefined) {
    return (
      <main className="flex screen-h items-center justify-center bg-brown-900 text-brown-300">
        加载中…
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
        <div className="font-body">
          <h1 className="text-center text-6xl font-bold font-display game-title">帮助</h1>
          <p>
            欢迎来到《沙之书》。游戏同时支持匿名<i>旁观</i>和登录后的<i>互动</i>。
          </p>
          <h2 className="text-4xl mt-4">旁观</h2>
          <p>
            点击并拖拽即可在小镇里移动视角，滚动滚轮可以放大缩小。你可以点击单个角色，查看它的聊天记录。
          </p>
          <h2 className="text-4xl mt-4">互动</h2>
          <p>
            登录后，你就能加入这个模拟世界，直接和不同的智能体对话！登录后点击"加入"按钮，你的角色就会出现在地图的某个位置，脚下带有一圈高亮的光环。
          </p>
          <p className="text-2xl mt-2">操作：</p>
          <p className="mt-4">点击即可移动。</p>
          <p className="mt-4">
            在"角色"模式下，用 WASD 或方向键移动你的角色；在"镜头"模式下，同样的按键用来平移镜头。按
            C 切换模式，按 V 切换跟随角色，按 + 和 - 缩放，按 0 显示完整地图，按 F 切换全屏。
          </p>
          <p className="mt-4">
            想和智能体对话，先点击它，再点击"发起对话"，它就会朝你走来。等它走近，对话便会开始，你们就可以互相交谈。你随时可以关闭对话面板或走开来结束对话。对方也可能主动向你发起对话——这时你会在消息面板里看到一个接受按钮。
          </p>
          <p className="mt-4">
            《沙之书》同一时间最多只支持 {MAX_HUMAN_PLAYERS}{' '}
            名真人玩家。如果你闲置超过五分钟，将会被自动移出模拟世界。
          </p>
        </div>
      </ReactModal>
      {/*<div className="p-3 absolute top-0 right-0 z-10 text-2xl">
        <Authenticated>
          <UserButton afterSignOutUrl="/ai-town" />
        </Authenticated>

        <Unauthenticated>
          <LoginButton />
        </Unauthenticated>
      </div> */}

      {/* top navigation bar — festival masthead (solid, in normal flow) */}
      <TopBar
        userId={userId}
        worldId={worldStatus?.worldId}
        controlMode={controlMode}
        cameraFollow={cameraFollow}
        isFullscreen={isFullscreen}
        onToggleControlMode={toggleControlMode}
        onToggleCameraFollow={toggleCameraFollow}
        onToggleFullscreen={() => void toggleFullscreen()}
        onOpenPhotoMemory={() => setPhotoMemoryOpen(true)}
        onHelp={() => setHelpModalOpen(true)}
        showCollisionOverlay={showCollisionOverlay}
        onToggleCollisionOverlay={() => setShowCollisionOverlay((visible) => !visible)}
      />

      <div className="relative min-h-0 flex-1 overflow-hidden shadow-2xl">
        <Game
          userId={userId}
          controlMode={controlMode}
          cameraFollow={cameraFollow}
          onToggleControlMode={toggleControlMode}
          onToggleCameraFollow={toggleCameraFollow}
          onSetCameraFollow={setCameraFollow}
          onEnterVenueInterior={(interiorId) => {
            const interior = getVenueInterior(interiorId);
            if (interior) setActiveInterior(interior);
          }}
          showCollisionOverlay={showCollisionOverlay}
        />
        <PhotoMemoryNotifications userId={userId} />
        <ToastContainer position="bottom-right" autoClose={2000} closeOnClick theme="dark" />
      </div>
      <Timeline />

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
            onOpenPhotoMemory={() => setPhotoMemoryOpen(true)}
            onExit={() => setActiveActivity(null)}
          />
        </div>
      )}

      {activeInterior && (
        <VenueInteriorMap
          interior={activeInterior}
          onOpenPhotoMemory={() => setPhotoMemoryOpen(true)}
          onExit={() => setActiveInterior(null)}
        />
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
    backgroundColor: 'rgb(0, 0, 0, 75%)',
    zIndex: 12,
  },
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    width: 'min(760px, calc(100vw - 32px))',
    maxWidth: 'none',
    maxHeight: '85vh',
    overflowY: 'auto',

    border: '10px solid rgb(23, 20, 33)',
    borderRadius: '0',
    background: 'rgb(35, 38, 58)',
    color: 'white',
    fontFamily: '"Upheaval Pro", "sans-serif"',
  },
} as const;
