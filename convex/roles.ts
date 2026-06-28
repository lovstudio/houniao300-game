import { v } from 'convex/values';

// 四大角色。游客（只看/互动）/ 艺术家（申领+创建自己作品）/ 志愿者（可代他人创建、协助引导）/ 管理员（全权）。
export type Role = 'visitor' | 'artist' | 'volunteer' | 'admin';

export const roleValidator = v.union(
  v.literal('visitor'),
  v.literal('artist'),
  v.literal('volunteer'),
  v.literal('admin'),
);

// ---- 能力边界（典型分工）----
export const canCreateArtwork = (role?: Role) =>
  role === 'artist' || role === 'volunteer' || role === 'admin';
export const canClaimArtwork = (role?: Role) => role === 'artist' || role === 'admin';
export const isAdmin = (role?: Role) => role === 'admin';

// ---- 邀请码 → 角色。游客无需邀请码；其余三种需匹配。----
// 默认值仅供开发；生产用 `npx convex env set INVITE_CODE_ARTIST <码>` 等覆盖。
const CODE_FOR_ROLE: Record<Exclude<Role, 'visitor'>, string> = {
  artist: process.env.INVITE_CODE_ARTIST ?? 'HN-ARTIST',
  volunteer: process.env.INVITE_CODE_VOLUNTEER ?? 'HN-VOLUNTEER',
  admin: process.env.INVITE_CODE_ADMIN ?? 'HN-ADMIN',
};

export function inviteCodeValidFor(role: Role, code?: string): boolean {
  if (role === 'visitor') return true;
  return !!code && code.trim() === CODE_FOR_ROLE[role];
}
