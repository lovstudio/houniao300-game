import Game, { type ControlMode } from './components/Game.tsx';

import { ToastContainer } from 'react-toastify';
import helpImg from '../assets/help.svg';
// import { UserButton } from '@clerk/clerk-react';
// import { Authenticated, Unauthenticated } from 'convex/react';
// import LoginButton from './components/buttons/LoginButton.tsx';
import { useEffect, useState } from 'react';
import ReactModal from 'react-modal';
import MusicButton from './components/buttons/MusicButton.tsx';
import Button from './components/buttons/Button.tsx';
import InteractButton from './components/buttons/InteractButton.tsx';
import FreezeButton from './components/FreezeButton.tsx';
import { MAX_HUMAN_PLAYERS } from '../convex/constants.ts';

export default function Home() {
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlMode, setControlMode] = useState<ControlMode>('player');
  const [cameraFollow, setCameraFollow] = useState(true);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    onFullscreenChange();
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
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

  return (
    <main className="relative h-screen overflow-hidden font-body game-background bg-brown-900">
      <ReactModal
        isOpen={helpModalOpen}
        onRequestClose={() => setHelpModalOpen(false)}
        style={modalStyles}
        contentLabel="Help modal"
        ariaHideApp={false}
      >
        <div className="font-body">
          <h1 className="text-center text-6xl font-bold font-display game-title">Help</h1>
          <p>
            Welcome to 候鸟沙城. The game supports both anonymous <i>spectators</i> and logged in{' '}
            <i>interactivity</i>.
          </p>
          <h2 className="text-4xl mt-4">Spectating</h2>
          <p>
            Click and drag to move around the town, and scroll in and out to zoom. You can click on
            an individual character to view its chat history.
          </p>
          <h2 className="text-4xl mt-4">Interactivity</h2>
          <p>
            If you log in, you can join the simulation and directly talk to different agents! After
            logging in, click the "Interact" button, and your character will appear somewhere on the
            map with a highlighted circle underneath you.
          </p>
          <p className="text-2xl mt-2">Controls:</p>
          <p className="mt-4">Click to navigate around.</p>
          <p className="mt-4">
            In Player mode, use WASD or the arrow keys to move your character. In Camera mode, the
            same keys pan the camera. Press C to switch modes, V to toggle player follow, + and - to
            zoom, 0 to show the full map, and F to toggle fullscreen.
          </p>
          <p className="mt-4">
            To talk to an agent, click on them and then click "Start conversation," which will ask
            them to start walking towards you. Once they're nearby, the conversation will start, and
            you can speak to each other. You can leave at any time by closing the conversation pane
            or moving away. They may propose a conversation to you - you'll see a button to accept
            in the messages panel.
          </p>
          <p className="mt-4">
            候鸟沙城 only supports {MAX_HUMAN_PLAYERS} humans at a time. If you're idle for five
            minutes, you'll be automatically removed from the simulation.
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

      <div className="relative isolate h-screen w-screen overflow-hidden shadow-2xl">
        <div className="game-hud pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-4">
          <div className="pointer-events-auto rounded border border-white/20 bg-brown-900/85 px-3 py-2 text-white shadow-solid backdrop-blur-sm">
            <h1 className="font-display text-3xl leading-none tracking-wide game-title sm:text-4xl">
              候鸟沙城
            </h1>
          </div>
          <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
            <FreezeButton />
            <MusicButton />
            <InteractButton />
            <button
              className="button text-white shadow-solid text-xl pointer-events-auto"
              title="Switch control mode (C)"
              onClick={toggleControlMode}
            >
              <div className="inline-block bg-clay-700">
                <span>{controlMode === 'player' ? 'Player' : 'Camera'}</span>
              </div>
            </button>
            <button
              className="button text-white shadow-solid text-xl pointer-events-auto"
              title="Toggle player follow (V)"
              onClick={toggleCameraFollow}
            >
              <div className="inline-block bg-clay-700">
                <span>{cameraFollow ? 'Follow' : 'Free'}</span>
              </div>
            </button>
            <button
              className="button text-white shadow-solid text-xl pointer-events-auto"
              title="Toggle fullscreen (F)"
              onClick={() => void toggleFullscreen()}
            >
              <div className="inline-block bg-clay-700">
                <span>{isFullscreen ? 'Window' : 'Full'}</span>
              </div>
            </button>
            <Button imgUrl={helpImg} onClick={() => setHelpModalOpen(true)}>
              Help
            </Button>
          </div>
        </div>

        <Game
          controlMode={controlMode}
          cameraFollow={cameraFollow}
          onToggleControlMode={toggleControlMode}
          onToggleCameraFollow={toggleCameraFollow}
          onSetCameraFollow={setCameraFollow}
        />
        <ToastContainer position="bottom-right" autoClose={2000} closeOnClick theme="dark" />
      </div>
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
