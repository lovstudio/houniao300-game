import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { toast } from 'react-toastify';

type GrantRole = 'artist' | 'volunteer' | 'admin';
const ROLE_LABEL: Record<GrantRole, string> = {
  artist: '艺术家',
  volunteer: '志愿者',
  admin: '管理员',
};

const ROLE_PERK: Record<GrantRole, string> = {
  artist: '可申领你的既有作品、上传并在地图上摆放新作品；有人观看你的作品时会收到通知',
  volunteer: '可协助引导观众，并代艺术家创建、摆放作品',
  admin: '拥有全部权限：编辑/删除任意作品、改派角色、分发邀请码',
};

// 正式站点域名（固定，不取 window.location，避免管理员在预览/本地时发错链接）。
const SITE_URL = 'https://houniao300-game.lovstudio.ai/';

// 复制时给目标用户一段能看懂的完整邀请文案：是什么、去哪、怎么填、有什么用。
function inviteMessage(code: string, role: GrantRole): string {
  const label = ROLE_LABEL[role];
  return [
    `【候鸟沙城 · ${label}邀请】`,
    `邀请你以「${label}」身份加入候鸟沙城。`,
    ``,
    `邀请码：${code}`,
    ``,
    `如何使用：`,
    `1) 打开 ${SITE_URL}`,
    `2) 在登记页选择「${label}」身份`,
    `3) 填入上面的邀请码，完成登记`,
    ``,
    `这个身份能做什么：${ROLE_PERK[role]}。`,
  ].join('\n');
}

// 管理员邀请码分发面板：铸码、计次、启停、复制。仅管理员可见（入口在设置里）。
export default function InviteCodesModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const codes = useQuery(api.inviteCodes.listCodes, { actorUserId: userId });
  const create = useMutation(api.inviteCodes.createCode);
  const setActive = useMutation(api.inviteCodes.setCodeActive);

  const [role, setRole] = useState<GrantRole>('artist');
  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [busy, setBusy] = useState(false);

  const mint = async () => {
    setBusy(true);
    try {
      const code = await create({
        actorUserId: userId,
        role,
        label: label.trim() || undefined,
        maxUses: maxUses.trim() ? Math.max(1, Number(maxUses)) : undefined,
      });
      setLabel('');
      setMaxUses('');
      await navigator.clipboard?.writeText(inviteMessage(code, role)).catch(() => {});
      toast.success(`已生成 ${code}，完整邀请文案已复制`);
    } catch (e: any) {
      toast.error(e?.data ?? e?.message ?? '生成失败');
    } finally {
      setBusy(false);
    }
  };

  // 复制完整邀请文案（含用法说明），而非光秃秃的码。
  const copy = (code: string, role: GrantRole) => {
    navigator.clipboard?.writeText(inviteMessage(code, role)).then(
      () => toast.success('完整邀请文案已复制'),
      () => toast.error('复制失败'),
    );
  };

  const inputCls =
    'w-full rounded border border-[#c2a878] bg-[#f6ecd3] px-3 py-2 text-sm text-[#2a1c14] placeholder:text-[#a8906c] focus:border-clay-500 focus:outline-none';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="sand-paper-bg flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-[#cbb287] text-[#2a1c14] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#cbb287] px-4 py-3">
          <h2 className="font-display text-xl">邀请码分发</h2>
          <button onClick={onClose} className="rounded bg-[#dcc89f] px-2 py-1 text-xs text-[#5b4632] hover:bg-[#d3bd8c]">
            关闭
          </button>
        </div>

        {/* 铸码 */}
        <div className="shrink-0 space-y-2 border-b border-[#cbb287] px-4 py-3">
          <div className="flex gap-2">
            {(Object.keys(ROLE_LABEL) as GrantRole[]).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={
                  'flex-1 rounded border px-2 py-1.5 text-sm transition ' +
                  (role === r
                    ? 'border-clay-600 bg-[#f3ead8] font-bold text-[#2a1c14]'
                    : 'border-[#d8cdb8] text-[#6b5238] hover:border-clay-500')
                }
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={inputCls}
            placeholder="备注（可选）：发给谁 / 用途"
          />
          <div className="flex gap-2">
            <input
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              className={inputCls}
              placeholder="可用次数（留空=不限）"
            />
            <button
              onClick={() => void mint()}
              disabled={busy}
              className="shrink-0 rounded bg-clay-700 px-4 text-sm font-bold text-white hover:bg-clay-500 disabled:opacity-50"
            >
              生成
            </button>
          </div>
        </div>

        {/* 列表 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {codes === undefined ? (
            <p className="py-6 text-center text-sm text-[#9c7e5e]">载入中…</p>
          ) : codes === null ? (
            <p className="py-6 text-center text-sm text-[#9c7e5e]">仅管理员可查看</p>
          ) : codes.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#9c7e5e]">还没有邀请码，先生成一枚。</p>
          ) : (
            <div className="space-y-1.5">
              {codes.map((c) => (
                <div
                  key={c._id}
                  className={
                    'rounded border px-3 py-2 ' +
                    (c.active ? 'border-[#cbb287] bg-[#efe1c2]' : 'border-[#d8cdb8] bg-[#e8ddc8] opacity-60')
                  }
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copy(c.code, c.role)}
                      title="复制完整邀请文案"
                      className="font-mono text-sm font-bold text-[#2a1c14] hover:underline"
                    >
                      {c.code}
                    </button>
                    <span className="rounded bg-clay-700/15 px-1.5 py-0.5 text-[10px] text-clay-700">
                      {ROLE_LABEL[c.role]}
                    </span>
                    <span className="ml-auto text-[11px] text-[#6b5238]">
                      {c.uses}
                      {c.maxUses !== undefined ? `/${c.maxUses}` : ''} 次
                    </span>
                    <button
                      onClick={() =>
                        void setActive({ actorUserId: userId, codeId: c._id, active: !c.active })
                      }
                      className="rounded bg-[#dcc89f] px-2 py-0.5 text-[11px] text-[#5b4632] hover:bg-[#d3bd8c]"
                    >
                      {c.active ? '停用' : '启用'}
                    </button>
                  </div>
                  {c.label && <div className="mt-1 text-[11px] text-[#6b5238]">{c.label}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
