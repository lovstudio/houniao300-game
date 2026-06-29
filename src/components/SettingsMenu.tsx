import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import InviteCodesModal from './InviteCodesModal';
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
  LeaveIcon,
  LocateIcon,
  PersonIcon,
  PhotoIcon,
  ShrinkIcon,
  VersionIcon,
} from './buttons/DeckIcons';
import { SHOW_DEV_TOOLS } from '../lib/debugSettings.ts';
import SignalPanel from './SignalHud';

export default function SettingsMenu({
  userId,
  controlMode,
  cameraFollow,
  isFullscreen,
  showCollisionOverlay,
  calibrating,
  onToggleControlMode,
  onToggleCameraFollow,
  onToggleFullscreen,
  onToggleCollisionOverlay,
  onToggleCalibrating,
  onOpenPhotoMemory,
  onHelp,
  tone = 'deck',
}: {
  userId: string;
  controlMode: 'player' | 'camera';
  cameraFollow: boolean;
  isFullscreen: boolean;
  showCollisionOverlay: boolean;
  calibrating: boolean;
  onToggleControlMode: () => void;
  onToggleCameraFollow: () => void;
  onToggleFullscreen: () => void;
  onToggleCollisionOverlay: () => void;
  onToggleCalibrating: () => void;
  onOpenPhotoMemory: () => void;
  onHelp: () => void;
  tone?: 'deck' | 'ink';
}) {
  const [open, setOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const profile = useQuery(api.profile.getProfile, { userId });
  const isAdmin = profile?.role === 'admin';

  // 调试：抹除本地身份与记忆，刷新后生成新 uid → profile 为 null → 强制回到 onboarding 重新登记。
  const resetIdentity = () => {
    if (!window.confirm('确认重置？将抹除本地身份，回到首页重新登记。')) return;
    localStorage.clear();
    window.location.reload();
  };

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
      {tone === 'ink' ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-pressed={open}
          title="设置"
          className="sand-icon-btn"
        >
          <GearIcon />
        </button>
      ) : (
        <DeckButton onClick={() => setOpen((v) => !v)} active={open} title="设置" icon={<GearIcon />}>
          设置
        </DeckButton>
      )}

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

        <SignalPanel />

        <div className="settings-section">关于</div>
        <SettingRow icon={<VersionIcon />} label="版本号" value={`v${__APP_VERSION__}`} title="当前应用版本号" />

        {isAdmin && (
          <>
            <div className="settings-section">管理</div>
            <SettingRow
              icon={<PersonIcon />}
              label="邀请码分发"
              onClick={() => {
                setOpen(false);
                setInviteOpen(true);
              }}
              title="生成并分发 艺术家/志愿者/管理员 邀请码"
            />
          </>
        )}

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
            <SettingRow
              icon={<LocateIcon />}
              label="GPS 标定"
              value={calibrating ? '开' : '关'}
              active={calibrating}
              onClick={onToggleCalibrating}
              title="采集 GPS↔地图锚点：站到地标点采集 GPS，再点地图对应位置，≥3 组后保存。"
            />
            <SettingRow
              icon={<LeaveIcon />}
              label="重置身份"
              onClick={resetIdentity}
              title="抹除本地身份与记忆，回到首页重新登记。"
            />
          </>
        )}
      </div>

      {inviteOpen && <InviteCodesModal userId={userId} onClose={() => setInviteOpen(false)} />}
    </div>
  );
}
