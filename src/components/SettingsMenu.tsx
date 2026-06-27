import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import FreezeButton from './FreezeButton';
import MusicButton from './buttons/MusicButton';
import SettingRow from './buttons/SettingRow';
import DeckButton from './buttons/DeckButton';
import {
  CameraIcon,
  CollisionIcon,
  ExpandIcon,
  FollowIcon,
  FreeMoveIcon,
  GearIcon,
  HelpIcon,
  PersonIcon,
  PhotoIcon,
  ShrinkIcon,
} from './buttons/DeckIcons';
import { SHOW_DEV_TOOLS } from '../lib/debugSettings.ts';

export default function SettingsMenu({
  controlMode,
  cameraFollow,
  isFullscreen,
  showCollisionOverlay,
  onToggleControlMode,
  onToggleCameraFollow,
  onToggleFullscreen,
  onToggleCollisionOverlay,
  onOpenPhotoMemory,
  onHelp,
}: {
  controlMode: 'player' | 'camera';
  cameraFollow: boolean;
  isFullscreen: boolean;
  showCollisionOverlay: boolean;
  onToggleControlMode: () => void;
  onToggleCameraFollow: () => void;
  onToggleFullscreen: () => void;
  onToggleCollisionOverlay: () => void;
  onOpenPhotoMemory: () => void;
  onHelp: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <DeckButton onClick={() => setOpen((v) => !v)} active={open} title="设置" icon={<GearIcon />}>
        设置
      </DeckButton>

      {/* panel stays mounted so MusicButton keeps its state + `m` shortcut */}
      <div className={clsx('settings-pop', open ? 'settings-pop-open' : 'settings-pop-closed')}>
        <div className="settings-section">世界</div>
        <SettingRow
          icon={<PhotoIcon />}
          label="照片记忆"
          onClick={() => {
            setOpen(false);
            onOpenPhotoMemory();
          }}
          title="上传照片并查看记忆相册"
        />
        <FreezeButton />
        <MusicButton />

        <div className="settings-section">控制</div>
        <SettingRow
          icon={controlMode === 'player' ? <PersonIcon /> : <CameraIcon />}
          label="操作模式"
          value={controlMode === 'player' ? '角色' : '镜头'}
          active={controlMode === 'camera'}
          onClick={onToggleControlMode}
          title="切换操作模式 (C)"
        />
        <SettingRow
          icon={cameraFollow ? <FollowIcon /> : <FreeMoveIcon />}
          label="相机跟随"
          value={cameraFollow ? '跟随' : '自由'}
          active={cameraFollow}
          onClick={onToggleCameraFollow}
          title="切换跟随角色 (V)"
        />

        <div className="settings-section">视图</div>
        <SettingRow
          icon={isFullscreen ? <ShrinkIcon /> : <ExpandIcon />}
          label="全屏"
          value={isFullscreen ? '开' : '关'}
          active={isFullscreen}
          onClick={onToggleFullscreen}
          title="切换全屏 (F)"
        />
        <SettingRow
          icon={<HelpIcon />}
          label="帮助"
          onClick={() => {
            setOpen(false);
            onHelp();
          }}
        />

        {SHOW_DEV_TOOLS && (
          <>
            <div className="settings-section">调试</div>
            <SettingRow
              icon={<CollisionIcon />}
              label="碰撞染色"
              value={showCollisionOverlay ? '开' : '关'}
              active={showCollisionOverlay}
              onClick={onToggleCollisionOverlay}
              title="显示当前路径规划实际不可走区域。"
            />
          </>
        )}
      </div>
    </div>
  );
}
