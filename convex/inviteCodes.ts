import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { isAdmin, type Role } from './roles';

// 可被邀请码授予的角色（游客无需码）。
const grantableRole = v.union(v.literal('artist'), v.literal('volunteer'), v.literal('admin'));

async function requireAdmin(ctx: { db: any }, userId: string) {
  const p = await ctx.db
    .query('profiles')
    .withIndex('userId', (q: any) => q.eq('userId', userId))
    .first();
  if (!isAdmin(p?.role as Role)) throw new ConvexError('仅管理员可管理邀请码');
  return p;
}

function genCode(role: 'artist' | 'volunteer' | 'admin') {
  const prefix = role === 'artist' ? 'ART' : role === 'volunteer' ? 'VOL' : 'ADM';
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// 管理员：列出全部邀请码（非管理员返回 null，前端据此隐藏入口）。
export const listCodes = query({
  args: { actorUserId: v.string() },
  handler: async (ctx, { actorUserId }) => {
    const p = await ctx.db
      .query('profiles')
      .withIndex('userId', (q) => q.eq('userId', actorUserId))
      .first();
    if (!isAdmin(p?.role as Role)) return null;
    return await ctx.db.query('inviteCodes').order('desc').collect();
  },
});

// 管理员：铸一枚新码。
export const createCode = mutation({
  args: {
    actorUserId: v.string(),
    role: grantableRole,
    label: v.optional(v.string()),
    maxUses: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.actorUserId);
    const code = genCode(args.role);
    await ctx.db.insert('inviteCodes', {
      code,
      role: args.role,
      label: args.label,
      maxUses: args.maxUses,
      uses: 0,
      active: true,
      createdBy: args.actorUserId,
      createdAt: Date.now(),
    });
    return code;
  },
});

// 管理员：启用/停用一枚码。
export const setCodeActive = mutation({
  args: { actorUserId: v.string(), codeId: v.id('inviteCodes'), active: v.boolean() },
  handler: async (ctx, { actorUserId, codeId, active }) => {
    await requireAdmin(ctx, actorUserId);
    await ctx.db.patch(codeId, { active });
    return true;
  },
});

// 注册时校验并消费一枚 DB 邀请码：匹配（启用、角色一致、未超次）则 uses+1 返回 true。
// 供 profile.saveProfile 调用，不对外暴露为 Convex 函数。
export async function consumeDbInviteCode(
  ctx: { db: any },
  role: Role,
  code?: string,
): Promise<boolean> {
  if (!code) return false;
  const row = await ctx.db
    .query('inviteCodes')
    .withIndex('code', (q: any) => q.eq('code', code.trim()))
    .first();
  if (!row || !row.active || row.role !== role) return false;
  if (row.maxUses !== undefined && row.uses >= row.maxUses) return false;
  await ctx.db.patch(row._id, { uses: row.uses + 1 });
  return true;
}
