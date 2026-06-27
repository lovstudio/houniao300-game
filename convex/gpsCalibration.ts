import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

const anchor = v.object({
  lat: v.number(),
  lng: v.number(),
  sourceX: v.number(),
  sourceY: v.number(),
  label: v.optional(v.string()),
});

// 读取全场标定锚点（单例，取最新一条）。未标定返回 []。
export const getCalibration = query({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db.query('gpsCalibration').order('desc').first();
    return doc?.anchors ?? [];
  },
});

// 保存全场标定锚点（覆盖单例）。现场操作员标定工具调用。
export const saveCalibration = mutation({
  args: { anchors: v.array(anchor) },
  handler: async (ctx, { anchors }) => {
    const existing = await ctx.db.query('gpsCalibration').first();
    if (existing) {
      await ctx.db.patch(existing._id, { anchors, updatedAt: Date.now() });
    } else {
      await ctx.db.insert('gpsCalibration', { anchors, updatedAt: Date.now() });
    }
  },
});
