import { useRef, useState } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Avatar, AVATAR_PRESETS, DEFAULT_PRESET } from '../lib/avatars';
import { Gender } from '../lib/identity';
import clsx from 'clsx';
import SandText, { type SandTextHandle } from './SandText.tsx';

type AvatarChoice =
  | { kind: 'preset'; preset: string }
  | { kind: 'generated'; storageId: string; url: string };

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'other', label: '其他' },
];

type Role = 'visitor' | 'artist';
const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: 'visitor', label: '访客', hint: '逛展、与人和作品互动' },
  { value: 'artist', label: '艺术家', hint: '可申领既有作品、上传并摆放新作品' },
];

// 全局身份录入：landing 首次进入强制完成（名字、性别、头像）。
export default function Onboarding({ userId, onDone }: { userId: string; onDone: () => void }) {
  const save = useMutation(api.profile.saveProfile);
  const genAvatar = useAction(api.profile.generateAvatar);
  const genUploadUrl = useMutation(api.profile.generateUploadUrl);

  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [role, setRole] = useState<Role>('visitor');
  const [statement, setStatement] = useState('');
  const [avatar, setAvatar] = useState<AvatarChoice>({ kind: 'preset', preset: DEFAULT_PRESET });
  const [desc, setDesc] = useState('');
  const [photo, setPhoto] = useState<{ storageId: Id<'_storage'>; previewUrl: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const headingRef = useRef<SandTextHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canSave = !!name.trim() && !!gender && !saving;
  // 有照片或描述其一即可生成。
  const canGenerate = !!name.trim() && !!gender && (!!desc.trim() || !!photo) && !generating;

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    const uploadUrl = await genUploadUrl();
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    const { storageId } = (await res.json()) as { storageId: Id<'_storage'> };
    setPhoto({ storageId, previewUrl: URL.createObjectURL(file) });
  };

  const generate = async () => {
    if (!canGenerate || !gender) return;
    setGenerating(true);
    try {
      const { storageId, url } = await genAvatar({
        description: desc.trim(),
        name: name.trim(),
        gender,
        photoStorageId: photo?.storageId,
      });
      setAvatar({ kind: 'generated', storageId, url: url ?? '' });
    } finally {
      setGenerating(false);
    }
  };

  const finish = async () => {
    if (!canSave || !gender) return;
    headingRef.current?.scatter(); // 把名字写进沙里：标题散成沙作为提交反馈
    setSaving(true);
    try {
      await save({
        userId,
        name: name.trim(),
        gender,
        role,
        artistStatement: role === 'artist' && statement.trim() ? statement.trim() : undefined,
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
    'sand-underline w-full bg-transparent border-0 text-[15px] text-[#2c2620] outline-none placeholder:text-[#a89e8d]';

  return (
    <div className="mx-auto w-full max-w-[400px] text-left" style={{ fontFamily: serif, color: '#2c2620' }}>
      {/* 表头：沙粒「登记成为候鸟」，提交时散成沙 */}
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Avatar url={previewUrl} preset={previewPreset} size="lg" />
        <div className="flex flex-col items-center">
          <h2 className="sr-only">登记成为候鸟</h2>
          <SandText
            ref={headingRef}
            text="登记成为候鸟"
            tracking={0.16}
            fontScale={0.66}
            settleMs={1600}
            className="h-[34px] w-[248px]"
          />
          <p className="mt-2 text-[12px] tracking-[0.04em] text-[#7a7063]">
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

      {/* 身份 —— 访客 / 艺术家 */}
      <label className="mb-2 block text-[11px] tracking-[0.24em] text-[#7a7063]">身 份</label>
      <div className="mb-3 flex gap-3">
        {ROLES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRole(r.value)}
            className="flex-1 rounded border px-3 py-2 text-left transition-colors"
            style={{
              color: role === r.value ? '#2c2620' : '#a89e8d',
              borderColor: role === r.value ? '#b0563a' : '#d8cdb8',
              background: role === r.value ? '#f3ead8' : 'transparent',
            }}
          >
            <div className="text-[14px] tracking-[0.08em]">{r.label}</div>
            <div className="mt-0.5 text-[11px] leading-snug text-[#7a7063]">{r.hint}</div>
          </button>
        ))}
      </div>
      {role === 'artist' && (
        <textarea
          className={clsx(inputCls, 'mb-7 resize-none')}
          placeholder="一句话艺术家自述（可选）：创作主张、风格、想被怎样认识…"
          value={statement}
          maxLength={200}
          rows={2}
          onChange={(e) => setStatement(e.target.value)}
        />
      )}
      {role !== 'artist' && <div className="mb-7" />}

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
        <p className="mb-2 text-[12px] text-[#7a7063]">上传真人照片或描述样子，AI 为你生成专属头像</p>

        {/* 上传真人照片 */}
        <div className="mb-3 flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void pickPhoto(e.target.files?.[0])}
          />
          <button
            className="shrink-0 text-[13px] tracking-[0.1em] text-[#b0563a] transition-opacity hover:opacity-70 disabled:opacity-30"
            disabled={generating}
            onClick={() => fileRef.current?.click()}
          >
            {photo ? '换张照片' : '上传照片 ↑'}
          </button>
          {photo && (
            <>
              <img src={photo.previewUrl} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-[rgba(44,38,32,0.14)]" />
              <button
                className="text-[11px] text-[#a89e8d] transition-colors hover:text-[#b0563a]"
                disabled={generating}
                onClick={() => setPhoto(null)}
              >
                移除
              </button>
            </>
          )}
        </div>

        <div className="flex items-end gap-3">
          <input
            className={clsx(inputCls, 'flex-1 text-[14px]')}
            placeholder={photo ? '可补充：想要的风格细节…' : '如：戴草帽的旅人、橙羽信使…'}
            value={desc}
            disabled={generating}
            onChange={(e) => setDesc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void generate()}
          />
          <button
            className="shrink-0 pb-2 text-[13px] tracking-[0.1em] text-[#b0563a] transition-opacity hover:opacity-70 disabled:opacity-30"
            disabled={!canGenerate}
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
