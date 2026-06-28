import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// 我的通知（按时间倒序）。
export const listMine = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query('artworkNotifications')
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
      .query('artworkNotifications')
      .withIndex('userId', (q) => q.eq('userId', userId).eq('read', false))
      .collect();
    return unread.length;
  },
});

export const markAllRead = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const unread = await ctx.db
      .query('artworkNotifications')
      .withIndex('userId', (q) => q.eq('userId', userId).eq('read', false))
      .collect();
    for (const n of unread) {
      await ctx.db.patch(n._id, { read: true });
    }
    return unread.length;
  },
});
