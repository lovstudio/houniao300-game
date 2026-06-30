import { useMemo, useRef, useState } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Avatar, DEFAULT_PRESET } from '../lib/avatars';
import { Gender } from '../lib/identity';
import clsx from 'clsx';
import SandText, { type SandTextHandle } from './SandText.tsx';

type AvatarChoice =
  | { kind: 'preset'; preset: string }
  | { kind: 'uploaded'; storageId: string; url: string }
  | { kind: 'generated'; storageId: string; url: string };

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'other', label: '其他' },
];

type Role = 'visitor' | 'artist' | 'volunteer' | 'admin';
const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: 'visitor', label: '游客', hint: '逛展、与人和作品互动' },
  { value: 'artist', label: '艺术家', hint: '申领既有作品、上传并摆放新作品' },
  { value: 'volunteer', label: '志愿者', hint: '代他人创建/摆放作品、协助引导' },
  { value: 'admin', label: '管理员', hint: '全权：编辑/删除任意作品、改派角色' },
];
const GRANTABLE_ROLES: Role[] = ['artist', 'volunteer', 'admin'];

function roleLabel(role: Role) {
  return ROLES.find((r) => r.value === role)?.label ?? '游客';
}

function readInviteFromUrl(): { role: Role; code: string } | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const rawRole = params.get('role') as Role | null;
  const code = (params.get('invite') ?? params.get('code') ?? '').trim();
  if (!code || !rawRole || !GRANTABLE_ROLES.includes(rawRole)) return null;
  return { role: rawRole, code };
}

function clearInviteParamsFromUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const hadInviteParams = ['invite', 'code', 'role'].some((key) => url.searchParams.has(key));
  if (!hadInviteParams) return;
  url.searchParams.delete('invite');
  url.searchParams.delete('code');
  url.searchParams.delete('role');
  window.history.replaceState({}, '', url.toString());
}

// 全局身份录入：landing 首次进入强制完成（名字、性别、头像）。
export default function Onboarding({ userId, onDone }: { userId: string; onDone: () => void }) {
  const save = useMutation(api.profile.saveProfile);
  const genAvatar = useAction(api.profile.generateAvatar);
  const genUploadUrl = useMutation(api.profile.generateUploadUrl);
  const inviteFromUrl = useMemo(readInviteFromUrl, []);

  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [role, setRole] = useState<Role>(inviteFromUrl?.role ?? 'visitor');
  const [statement, setStatement] = useState('');
  const [inviteCode, setInviteCode] = useState(inviteFromUrl?.code ?? '');
  const [roleError, setRoleError] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<AvatarChoice>({ kind: 'preset', preset: DEFAULT_PRESET });
  const [photo, setPhoto] = useState<{ storageId: Id<'_storage'>; previewUrl: string } | null>(
    null,
  );
  const [generated, setGenerated] = useState<{ storageId: string; url: string } | null>(null);
  const [genStyle, setGenStyle] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const headingRef = useRef<SandTextHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canSave = !!name.trim() && !!gender && !saving;
  // 沙之书风格基于上传的真人照片风格化，需先有照片 + 名字/性别。
  const canGenerate = !!name.trim() && !!gender && !!photo && !generating;

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploadUrl = await genUploadUrl();
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      const { storageId } = (await res.json()) as { storageId: Id<'_storage'> };
      const previewUrl = URL.createObjectURL(file);
      setPhoto({ storageId, previewUrl });
      // 上传成功即默认用真人原图作头像；清掉上一次的生成结果与勾选。
      setAvatar({ kind: 'uploaded', storageId, url: previewUrl });
      setGenerated(null);
      setGenStyle(false);
    } finally {
      setUploading(false);
    }
  };

  const generate = async () => {
    if (!canGenerate || !gender || !photo) return;
    setGenerating(true);
    try {
      const { storageId, url } = await genAvatar({
        description: '',
        name: name.trim(),
        gender,
        photoStorageId: photo.storageId,
      });
      const result = { storageId, url: url ?? '' };
      setGenerated(result);
      setAvatar({ kind: 'generated', ...result }); // 生成后默认选用沙之书风格，用户可切回原图
    } finally {
      setGenerating(false);
    }
  };

  const finish = async () => {
    if (!canSave || !gender) return;
    setRoleError(null);
    // 非游客角色需邀请码（最终由服务端校验，这里先做空值拦截）。
    if (role !== 'visitor' && !inviteCode.trim()) {
      setRoleError('该身份需要邀请码');
      return;
    }
    headingRef.current?.scatter(); // 把名字写进沙里：标题散成沙作为提交反馈
    setSaving(true);
    try {
      await save({
        userId,
        name: name.trim(),
        gender,
        role,
        artistStatement: role === 'artist' && statement.trim() ? statement.trim() : undefined,
        inviteCode: role !== 'visitor' ? inviteCode.trim() : undefined,
        avatarPreset: avatar.kind === 'preset' ? avatar.preset : undefined,
        avatarStorageId: avatar.kind === 'preset' ? undefined : avatar.storageId,
      });
      clearInviteParamsFromUrl();
      onDone();
    } catch (e: any) {
      // 邀请码错误等：停在登记页并提示，不进入沙城。
      setRoleError(e?.data ?? e?.message ?? '登记失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const previewUrl = avatar.kind === 'preset' ? null : avatar.url;
  const previewPreset = avatar.kind === 'preset' ? avatar.preset : null;

  const serif = '"Noto Serif SC","Songti SC",serif';
  const inputCls =
    'sand-underline w-full bg-transparent border-0 text-[15px] text-[#2c2620] outline-none placeholder:text-[#a89e8d]';

  return (
    <div
      className="mx-auto w-full max-w-[400px] text-left"
      style={{ fontFamily: serif, color: '#2c2620' }}
    >
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

      {/* 身份 —— 游客 / 艺术家 / 志愿者 / 管理员 */}
      <label className="mb-2 block text-[11px] tracking-[0.24em] text-[#7a7063]">身 份</label>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {ROLES.map((r) => (
          <button
            key={r.value}
            onClick={() => {
              setRole(r.value);
              setRoleError(null);
            }}
            className="rounded border px-3 py-2 text-left transition-colors"
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
      {role !== 'visitor' && (
        <input
          className={clsx(inputCls, 'mb-2')}
          placeholder={`${roleLabel(role)}邀请码`}
          value={inviteCode}
          onChange={(e) => {
            setInviteCode(e.target.value);
            setRoleError(null);
          }}
        />
      )}
      {inviteFromUrl && role === inviteFromUrl.role && inviteCode.trim() === inviteFromUrl.code && (
        <p className="mb-2 text-[12px] text-[#7a7063]">
          已从邀请链接填好「{roleLabel(inviteFromUrl.role)}」邀请码。
        </p>
      )}
      {role === 'artist' && (
        <textarea
          className={clsx(inputCls, 'mb-2 resize-none')}
          placeholder="一句话艺术家自述（可选）：创作主张、风格、想被怎样认识…"
          value={statement}
          maxLength={200}
          rows={2}
          onChange={(e) => setStatement(e.target.value)}
        />
      )}
      {roleError && <p className="mb-2 text-[12px] text-[#b0563a]">{roleError}</p>}
      <div className="mb-7" />

      {/* 头像：默认上传真人照片，可选生成沙之书风格 */}
      <label className="mb-3 block text-[11px] tracking-[0.24em] text-[#7a7063]">头 像</label>
      <div className="mb-9">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void pickPhoto(e.target.files?.[0])}
        />

        {!photo ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed border-[#d8cdb8] py-7 transition-colors hover:border-[#b0563a] hover:bg-[#f3ead8]/50 disabled:opacity-40"
          >
            <span className="text-[13px] tracking-[0.12em] text-[#7a7063]">
              {uploading ? '上传中…' : '上传你的照片'}
            </span>
            <span className="text-[11px] text-[#a89e8d]">作为你在沙城里的头像</span>
          </button>
        ) : (
          <div>
            <div className="flex items-start gap-6">
              {/* 真人原图 */}
              <button
                type="button"
                onClick={() =>
                  setAvatar({ kind: 'uploaded', storageId: photo.storageId, url: photo.previewUrl })
                }
                className="flex flex-col items-center gap-1.5"
              >
                <Avatar
                  url={photo.previewUrl}
                  size="lg"
                  className={clsx(
                    'transition-all',
                    avatar.kind === 'uploaded'
                      ? 'ring-2 ring-[#b0563a]'
                      : 'opacity-60 hover:opacity-90',
                  )}
                />
                <span className="text-[11px] text-[#7a7063]">原图</span>
              </button>

              {/* 沙之书风格：生成中占位 / 生成结果可选用 */}
              {generating ? (
                <div className="flex flex-col items-center gap-1.5">
                  <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-[#d8cdb8] text-[11px] text-[#a89e8d]">
                    生成中…
                  </span>
                  <span className="text-[11px] text-[#7a7063]">沙之书风格</span>
                </div>
              ) : generated ? (
                <button
                  type="button"
                  onClick={() =>
                    setAvatar({
                      kind: 'generated',
                      storageId: generated.storageId,
                      url: generated.url,
                    })
                  }
                  className="flex flex-col items-center gap-1.5"
                >
                  <Avatar
                    url={generated.url}
                    size="lg"
                    className={clsx(
                      'transition-all',
                      avatar.kind === 'generated'
                        ? 'ring-2 ring-[#b0563a]'
                        : 'opacity-60 hover:opacity-90',
                    )}
                  />
                  <span className="text-[11px] text-[#7a7063]">沙之书风格</span>
                </button>
              ) : null}
            </div>

            {/* 操作行 */}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || generating}
                className="text-[#7a7063] transition-colors hover:text-[#b0563a] disabled:opacity-30"
              >
                换张照片
              </button>

              {!generated && !generating && (
                <label
                  className={clsx(
                    'flex items-center gap-1.5',
                    canGenerate ? 'cursor-pointer text-[#b0563a]' : 'text-[#a89e8d]',
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-[#b0563a]"
                    checked={genStyle}
                    disabled={!canGenerate}
                    onChange={(e) => {
                      setGenStyle(e.target.checked);
                      if (e.target.checked) void generate();
                    }}
                  />
                  生成沙之书风格头像
                </label>
              )}

              {generated && !generating && (
                <button
                  type="button"
                  onClick={() => void generate()}
                  className="text-[#b0563a] transition-opacity hover:opacity-70"
                >
                  重试
                </button>
              )}

              {generating && <span className="text-[#a89e8d]">沙之书风格生成中…</span>}
            </div>

            {(!name.trim() || !gender) && (
              <p className="mt-2 text-[11px] text-[#a89e8d]">填好名字和性别后可生成沙之书风格</p>
            )}
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
