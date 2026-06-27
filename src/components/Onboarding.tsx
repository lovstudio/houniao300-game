import { useState } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Avatar, AVATAR_PRESETS, DEFAULT_PRESET } from '../lib/avatars';
import { Gender } from '../lib/identity';
import clsx from 'clsx';

type AvatarChoice =
  | { kind: 'preset'; preset: string }
  | { kind: 'generated'; storageId: string; url: string };

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'other', label: '其他' },
];

// 全局身份录入：landing 首次进入强制完成（名字、性别、头像）。
export default function Onboarding({ userId, onDone }: { userId: string; onDone: () => void }) {
  const save = useMutation(api.profile.saveProfile);
  const genAvatar = useAction(api.profile.generateAvatar);

  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [avatar, setAvatar] = useState<AvatarChoice>({ kind: 'preset', preset: DEFAULT_PRESET });
  const [desc, setDesc] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSave = !!name.trim() && !!gender && !saving;

  const generate = async () => {
    if (!desc.trim() || !name.trim() || !gender || generating) return;
    setGenerating(true);
    try {
      const { storageId, url } = await genAvatar({ description: desc.trim(), name: name.trim(), gender });
      setAvatar({ kind: 'generated', storageId, url: url ?? '' });
    } finally {
      setGenerating(false);
    }
  };

  const finish = async () => {
    if (!canSave || !gender) return;
    setSaving(true);
    try {
      await save({
        userId,
        name: name.trim(),
        gender,
        avatarPreset: avatar.kind === 'preset' ? avatar.preset : undefined,
        avatarStorageId: avatar.kind === 'generated' ? avatar.storageId : undefined,
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  const previewUrl = avatar.kind === 'generated' ? avatar.url : null;
  const previewPreset = avatar.kind === 'preset' ? avatar.preset : null;

  return (
    <div className="w-full max-w-md rounded-2xl border border-brown-700/60 bg-brown-900/80 p-6 text-brown-100 shadow-2xl backdrop-blur-md">
      <div className="mb-6 flex items-center gap-4">
        <Avatar url={previewUrl} preset={previewPreset} size="lg" />
        <div>
          <h1 className="font-display game-title text-3xl">登记成为候鸟</h1>
          <p className="text-sm text-brown-300">先创建你的身份，整座候鸟沙城通用。</p>
        </div>
      </div>

        {/* 名字 */}
        <label className="mb-1 block text-sm text-brown-300">名字</label>
        <input
          className="mb-4 w-full rounded border-2 border-brown-700 bg-brown-800 px-3 py-2 text-brown-100 placeholder:text-brown-500"
          placeholder="你在沙城里的名字"
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
        />

        {/* 性别 */}
        <label className="mb-1 block text-sm text-brown-300">性别</label>
        <div className="mb-4 flex gap-2">
          {GENDERS.map((g) => (
            <button
              key={g.value}
              onClick={() => setGender(g.value)}
              className={clsx(
                'flex-1 rounded border-2 px-3 py-2',
                gender === g.value
                  ? 'border-clay-500 bg-clay-700 text-white'
                  : 'border-brown-700 bg-brown-800 text-brown-200 hover:border-clay-500',
              )}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* 头像：预置 */}
        <label className="mb-1 block text-sm text-brown-300">头像</label>
        <div className="mb-3 flex flex-wrap gap-2">
          {AVATAR_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setAvatar({ kind: 'preset', preset: p.id })}
              className={clsx(
                'rounded-full',
                avatar.kind === 'preset' && avatar.preset === p.id ? 'ring-2 ring-clay-300' : '',
              )}
            >
              <Avatar preset={p.id} size="md" />
            </button>
          ))}
        </div>

        {/* 头像：自定义 -> AI 生成 */}
        <div className="mb-6 rounded border-2 border-dashed border-brown-700 p-3">
          <p className="mb-2 text-xs text-brown-400">或描述你想要的样子，AI 为你生成专属头像</p>
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded border-2 border-brown-700 bg-brown-800 px-3 py-2 text-sm text-brown-100 placeholder:text-brown-500"
              placeholder="如：戴草帽的旅人、橙羽信使…"
              value={desc}
              disabled={generating}
              onChange={(e) => setDesc(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void generate()}
            />
            <button
              className="shrink-0 rounded bg-clay-700 px-3 text-sm font-bold text-white hover:bg-clay-500 disabled:opacity-50"
              disabled={generating || !desc.trim() || !name.trim() || !gender}
              onClick={() => void generate()}
            >
              {generating ? '生成中…' : '生成'}
            </button>
          </div>
          {!name.trim() || !gender ? (
            <p className="mt-2 text-xs text-brown-500">填好名字和性别后即可生成</p>
          ) : null}
          {avatar.kind === 'generated' && (
            <div className="mt-3 flex items-center gap-2">
              <Avatar url={avatar.url} size="md" className="ring-2 ring-clay-300" />
              <span className="text-xs text-brown-300">已选用 AI 生成头像</span>
            </div>
          )}
        </div>

        <button
          className="w-full rounded bg-clay-700 px-3 py-2.5 text-base font-bold text-white hover:bg-clay-500 disabled:opacity-50"
          disabled={!canSave}
          onClick={() => void finish()}
        >
          {saving ? '保存中…' : '进入候鸟沙城'}
        </button>
    </div>
  );
}
