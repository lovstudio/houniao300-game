import { v } from 'convex/values';
import { query, action, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { generateImage } from './util/image';
import { uploadToQiniu } from './util/qiniu';

// 把上传的真实照片风格化成沙雕风：保留人物身份/五官/姿态，只换成该作品系列的沙雕材质与打光。
const STYLE_PROMPT =
  'Transform the person in this photo into a cinematic sand-sculpture figure carved from fine-grained sand: preserve the same face, identity, pose and expression, but render skin, hair and clothing as sculpted warm sand with fine grain texture, warm golden-hour light, soft depth of field, miniature sand-sculpture diorama mood';

// 上传 + 风格化 + 持久化。前端传入已缩放的原图字节（ArrayBuffer）。
export const stylizePhotoMemory = action({
  args: {
    activityKey: v.string(),
    userId: v.string(),
    userName: v.string(),
    photo: v.bytes(),
  },
  handler: async (ctx, { activityKey, userId, userName, photo }): Promise<{ url: string | null }> => {
    const reference = new Blob([photo], { type: 'image/png' });
    const blob = await generateImage(STYLE_PROMPT, reference);
    // 风格化图必存 Convex storage（后续喂体验取 blob 用）；同时尽量转存七牛做展示。
    const stylizedStorageId = await ctx.storage.store(blob);
    let stylizedUrl: string | undefined;
    try {
      stylizedUrl = await uploadToQiniu(blob, `memory-${userId}-${Date.now()}`);
    } catch (e) {
      console.error('七牛上传照片记忆失败，回退 Convex storage', e);
    }
    await ctx.runMutation(internal.photoMemory.insertMemory, {
      activityKey,
      userId,
      userName,
      stylizedStorageId,
      stylizedUrl,
    });
    return { url: stylizedUrl ?? (await ctx.storage.getUrl(stylizedStorageId)) };
  },
});

export const insertMemory = internalMutation({
  args: {
    activityKey: v.string(),
    userId: v.string(),
    userName: v.string(),
    stylizedStorageId: v.string(),
    stylizedUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    await ctx.db.insert('photoMemories', { ...args, createdAt: Date.now() }),
});

// 某件作品的公共照片记忆墙（最新在前）。
export const listMemories = query({
  args: { activityKey: v.string() },
  handler: async (ctx, { activityKey }) => {
    const rows = await ctx.db
      .query('photoMemories')
      .withIndex('activityKey', (q) => q.eq('activityKey', activityKey))
      .order('desc')
      .take(60);
    return await Promise.all(
      rows.map(async (m) => ({
        _id: m._id,
        userName: m.userName,
        createdAt: m.createdAt,
        url: m.stylizedUrl ?? (await ctx.storage.getUrl(m.stylizedStorageId)),
      })),
    );
  },
});

// 内部：取某用户在某作品的最新一张风格化记忆 storageId（喂体验当主角参考）。
export const latestMemoryStorageId = internalQuery({
  args: { activityKey: v.string(), userId: v.string() },
  handler: async (ctx, { activityKey, userId }): Promise<string | null> => {
    const m = await ctx.db
      .query('photoMemories')
      .withIndex('userId_activityKey', (q) => q.eq('userId', userId).eq('activityKey', activityKey))
      .order('desc')
      .first();
    return m?.stylizedStorageId ?? null;
  },
});
