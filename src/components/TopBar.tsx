import InteractButton from './buttons/InteractButton';
import SettingsMenu from './SettingsMenu';
import type { Id } from '../../convex/_generated/dataModel';

// 候鸟驿站招牌 — the festival masthead: a migratory-bird seal, the gold game title, and the control deck.

function FlockSeal() {
  return (
    <span className="masthead-seal masthead-bird grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full sm:h-[52px] sm:w-[52px]">
      {/* mirror the browser-tab favicon: sunset over dunes with a migratory bird */}
      <svg width="44" height="44" viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect width="32" height="32" fill="#181425" />
        {/* 落日 */}
        <circle cx="23" cy="9" r="4" fill="#E4A672" />
        {/* 沙丘 */}
        <path d="M0 25 Q8 20 16 24 Q24 28 32 23 V32 H0 Z" fill="#B86F50" />
        <path d="M0 28 Q9 25 17 28 Q25 31 32 28 V32 H0 Z" fill="#EAD4AA" />
        {/* 候鸟 */}
        <path d="M4 17 Q10 9 16 16 Q22 9 28 17" stroke="#EAD4AA" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </span>
  );
}

export default function TopBar({
  userId,
  worldId,
  controlMode,
  cameraFollow,
  isFullscreen,
  showCollisionOverlay,
  onToggleControlMode,
  onToggleCameraFollow,
  onToggleFullscreen,
  onToggleCollisionOverlay,
  onHelp,
}: {
  userId: string;
  worldId?: Id<'worlds'>;
  controlMode: 'player' | 'camera';
  cameraFollow: boolean;
  isFullscreen: boolean;
  showCollisionOverlay: boolean;
  onToggleControlMode: () => void;
  onToggleCameraFollow: () => void;
  onToggleFullscreen: () => void;
  onToggleCollisionOverlay: () => void;
  onHelp: () => void;
}) {
  return (
    <header className="masthead z-30 shrink-0">
      <div className="flex items-center justify-between gap-x-4 px-3 py-2 sm:px-5">
        {/* brand block */}
        <div className="masthead-in flex min-w-0 items-center gap-2.5">
          <FlockSeal />
          <div className="flex min-w-0 flex-col leading-none">
            <div className="flex items-center gap-2">
              <h1 className="game-title whitespace-nowrap font-display text-2xl leading-tight tracking-wide sm:text-[2.6rem]">
                沙之书
              </h1>
              <span className="hidden shrink-0 self-center rounded-full bg-brown-700/60 px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-wide tabular-nums text-[#caa979] sm:inline">
                v{__APP_VERSION__}
              </span>
            </div>
            {/* 博尔赫斯式标语：一本没有第一页、也没有最后一页的书 */}
            <span
              className="mt-0.5 hidden whitespace-nowrap text-[11px] italic tracking-[0.18em] text-brown-300/80 sm:inline"
              style={{ fontFamily: '"Noto Serif SC", serif' }}
            >
              没有第一页，也没有最后一页
            </span>
          </div>
        </div>

        {/* control deck — primary action + settings menu */}
        <div className="masthead-in deck-group relative z-50 ml-auto flex items-center gap-1" style={{ animationDelay: '0.08s' }}>
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
            onHelp={onHelp}
          />
        </div>
      </div>

      {/* festival tent valance */}
      <div className="masthead-valance" />
    </header>
  );
}
