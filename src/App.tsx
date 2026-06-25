import Game, { type ControlMode } from './components/Game.tsx';
import Timeline from './components/Timeline.tsx';
import Experience from './components/Experience.tsx';
import Onboarding from './components/Onboarding.tsx';
import { setActivityEnterHandler, type ActivityDescriptor } from './lib/activityEnter.ts';
import { getAnonUserId } from './lib/identity.ts';

import { ToastContainer } from 'react-toastify';
// import { UserButton } from '@clerk/clerk-react';
// import { Authenticated, Unauthenticated } from 'convex/react';
// import LoginButton from './components/buttons/LoginButton.tsx';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import ReactModal from 'react-modal';
import TopBar from './components/TopBar.tsx';
import { MAX_HUMAN_PLAYERS } from '../convex/constants.ts';

export default function Home() {
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlMode, setControlMode] = useState<ControlMode>('player');
  const [cameraFollow, setCameraFollow] = useState(true);
  // 当前正在体验的活动（从节目单点进），null = 在小镇里。
  const [activeActivity, setActiveActivity] = useState<ActivityDescriptor | null>(null);

  // 全局玩家身份：未完成 onboarding 前，强制停在录入页。
  const userId = useMemo(getAnonUserId, []);
  const profile = useQuery(api.profile.getProfile, { userId });

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

  // 身份门：加载中显示占位，未录入则强制 onboarding。
  if (profile === undefined) {
    return <main className="flex screen-h items-center justify-center bg-brown-900 text-brown-300">加载中…</main>;
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
            欢迎来到候鸟沙城。游戏同时支持匿名<i>旁观</i>和登录后的<i>互动</i>。
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
            在"角色"模式下，用 WASD 或方向键移动你的角色；在"镜头"模式下，同样的按键用来平移镜头。按 C
            切换模式，按 V 切换跟随角色，按 + 和 - 缩放，按 0 显示完整地图，按 F 切换全屏。
          </p>
          <p className="mt-4">
            想和智能体对话，先点击它，再点击"发起对话"，它就会朝你走来。等它走近，对话便会开始，你们就可以互相交谈。你随时可以关闭对话面板或走开来结束对话。对方也可能主动向你发起对话——这时你会在消息面板里看到一个接受按钮。
          </p>
          <p className="mt-4">
            候鸟沙城同一时间最多只支持 {MAX_HUMAN_PLAYERS} 名真人玩家。如果你闲置超过五分钟，将会被自动移出模拟世界。
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
        controlMode={controlMode}
        cameraFollow={cameraFollow}
        isFullscreen={isFullscreen}
        onToggleControlMode={toggleControlMode}
        onToggleCameraFollow={toggleCameraFollow}
        onToggleFullscreen={() => void toggleFullscreen()}
        onHelp={() => setHelpModalOpen(true)}
      />

      <div className="relative isolate min-h-0 flex-1 overflow-hidden shadow-2xl">
        <Game
          controlMode={controlMode}
          cameraFollow={cameraFollow}
          onToggleControlMode={toggleControlMode}
          onToggleCameraFollow={toggleCameraFollow}
          onSetCameraFollow={setCameraFollow}
        />
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
            onExit={() => setActiveActivity(null)}
          />
        </div>
      )}
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
