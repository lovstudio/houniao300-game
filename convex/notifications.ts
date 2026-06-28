import { v } from 'convex/values';
import { internal } from './_generated/api';
import { mutation, query } from './_generated/server';

// 我的通知（按时间倒序）。
export const listMine = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query('notifications')
      .withIndex('recent', (q) => q.eq('userId', userId))
      .order('desc')
      .take(50);
  },
});

// 未读数（铃铛红点）。
export const unreadCount = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const unread = await ctx.db
      .query('notifications')
      .withIndex('userId', (q) => q.eq('userId', userId).eq('read', false))
      .collect();
    return unread.length;
  },
});

// 向沙城传话：玩家说的话落入自己的通知时间流（后续可接 AI 让被 @ 的角色回应）。
export const say = mutation({
  args: {
    userId: v.string(),
    worldId: v.id('worlds'),
    text: v.string(),
    targetName: v.optional(v.string()),
  },
  handler: async (ctx, { userId, worldId, text, targetName }) => {
    const clean = text.trim().slice(0, 500);
    if (!clean) throw new Error('说点什么吧');
    await ctx.db.insert('notifications', {
      userId,
      worldId,
      kind: 'user_said',
      targetName,
      text: clean,
      read: true, // 自己说的话无需提醒自己
      createdAt: Date.now(),
    });
    // @ 了某个角色 → 异步触发该角色基于上下文回应（非 AI 角色会被静默忽略）。
    if (targetName) {
      await ctx.scheduler.runAfter(0, internal.aiReply.replyAsCharacter, {
        worldId,
        userId,
        targetName,
      });
    }
  },
});

export const markAllRead = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const unread = await ctx.db
      .query('notifications')
      .withIndex('userId', (q) => q.eq('userId', userId).eq('read', false))
      .collect();
    for (const n of unread) {
      await ctx.db.patch(n._id, { read: true });
    }
    return unread.length;
  },
});
