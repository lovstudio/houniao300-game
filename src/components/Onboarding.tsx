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

  const serif = '"Noto Serif SC","Songti SC",serif';
  const inputCls =
    'w-full bg-transparent border-0 border-b border-[rgba(44,38,32,0.22)] py-2 text-[15px] text-[#2c2620] outline-none transition-colors placeholder:text-[#a89e8d] focus:border-[#b0563a]';

  return (
    <div className="mx-auto w-full max-w-[400px] text-left" style={{ fontFamily: serif, color: '#2c2620' }}>
      {/* 表头 */}
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Avatar url={previewUrl} preset={previewPreset} size="lg" />
        <div>
          <h2 className="text-[19px] font-medium tracking-[0.16em]" style={{ textIndent: '0.16em' }}>
            登记成为候鸟
          </h2>
          <p className="mt-1 text-[12px] tracking-[0.04em] text-[#7a7063]">
            先创建你的身份，整座候鸟沙城通用
          </p>
        </div>
      </div>

      {/* 名字 */}
      <label className="mb-2 block text-[11px] tracking-[0.24em] text-[#7a7063]">名 字</label>
      <input
        className={clsx(inputCls, 'mb-7')}
        placeholder="你在沙城里的名字"
        value={name}
        maxLength={20}
        onChange={(e) => setName(e.target.value)}
      />

      {/* 性别 —— 文字态切换 */}
      <label className="mb-2 block text-[11px] tracking-[0.24em] text-[#7a7063]">性 别</label>
      <div className="mb-7 flex gap-8">
        {GENDERS.map((g) => (
          <button
            key={g.value}
            onClick={() => setGender(g.value)}
            className="border-b pb-1 text-[15px] tracking-[0.1em] transition-colors"
            style={{
              color: gender === g.value ? '#2c2620' : '#a89e8d',
              borderColor: gender === g.value ? '#b0563a' : 'transparent',
            }}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* 头像：预置 */}
      <label className="mb-2 block text-[11px] tracking-[0.24em] text-[#7a7063]">头 像</label>
      <div className="mb-4 flex flex-wrap gap-2.5">
        {AVATAR_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setAvatar({ kind: 'preset', preset: p.id })}
            className={clsx(
              'rounded-full transition-all',
              avatar.kind === 'preset' && avatar.preset === p.id
                ? 'ring-2 ring-[#b0563a]'
                : 'opacity-70 ring-1 ring-[rgba(44,38,32,0.14)] hover:opacity-100',
            )}
          >
            <Avatar preset={p.id} size="md" />
          </button>
        ))}
      </div>

      {/* 头像：自定义 -> AI 生成 */}
      <div className="mb-9 border-t border-[rgba(44,38,32,0.12)] pt-4">
        <p className="mb-2 text-[12px] text-[#7a7063]">或描述你想要的样子，AI 为你生成专属头像</p>
        <div className="flex items-end gap-3">
          <input
            className={clsx(inputCls, 'flex-1 text-[14px]')}
            placeholder="如：戴草帽的旅人、橙羽信使…"
            value={desc}
            disabled={generating}
            onChange={(e) => setDesc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void generate()}
          />
          <button
            className="shrink-0 pb-2 text-[13px] tracking-[0.1em] text-[#b0563a] transition-opacity hover:opacity-70 disabled:opacity-30"
            disabled={generating || !desc.trim() || !name.trim() || !gender}
            onClick={() => void generate()}
          >
            {generating ? '生成中…' : '生成 →'}
          </button>
        </div>
        {!name.trim() || !gender ? (
          <p className="mt-2 text-[11px] text-[#a89e8d]">填好名字和性别后即可生成</p>
        ) : null}
        {avatar.kind === 'generated' && (
          <div className="mt-3 flex items-center gap-2">
            <Avatar url={avatar.url} size="md" className="ring-2 ring-[#b0563a]" />
            <span className="text-[12px] text-[#7a7063]">已选用 AI 生成头像</span>
          </div>
        )}
      </div>

      <button
        className="w-full border border-[#2c2620] py-3 text-[14px] tracking-[0.34em] text-[#2c2620] transition-colors hover:border-[#2c2620] hover:bg-[#2c2620] hover:text-[#f3efe6] disabled:cursor-not-allowed disabled:opacity-30"
        style={{ textIndent: '0.34em' }}
        disabled={!canSave}
        onClick={() => void finish()}
      >
        {saving ? '保存中…' : '进入候鸟沙城 →'}
      </button>
    </div>
  );
}
