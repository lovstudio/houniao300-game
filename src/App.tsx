import Game, { type ControlMode } from './components/Game.tsx';
import Experience from './components/Experience.tsx';
import EndingsWall from './components/EndingsWall.tsx';
import Onboarding from './components/Onboarding.tsx';
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
import { SCHEDULE } from '../data/schedule.ts';
import { getAnonUserId } from './lib/identity.ts';

import { ToastContainer } from 'react-toastify';
// import { UserButton } from '@clerk/clerk-react';
// import { Authenticated, Unauthenticated } from 'convex/react';
// import LoginButton from './components/buttons/LoginButton.tsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';

export default function Home() {
  const [controlMode, setControlMode] = useState<ControlMode>('player');
  const [cameraFollow, setCameraFollow] = useState(true);
  const [showCollisionOverlay, setShowCollisionOverlay] = useState(false);
  // 当前正在体验的活动（从节目单点进），null = 在小镇里。
  const [activeActivity, setActiveActivity] = useState<ActivityDescriptor | null>(null);
  const [activeInterior, setActiveInterior] = useState<VenueInteriorMapData | null>(null);

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
    return (
      <main
        className="screen-h bg-brown-900"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <Onboarding userId={userId} onDone={() => undefined} />
      </main>
    );
  }

  return (
    <main className="flex screen-h flex-col overflow-hidden font-body game-background bg-brown-900">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Game
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
            onExit={() => setActiveActivity(null)}
          />
        </div>
      )}

      {activeInterior && (
        <VenueInteriorMap interior={activeInterior} onExit={() => setActiveInterior(null)} />
      )}
    </main>
  );
}
