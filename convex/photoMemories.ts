import { v } from 'convex/values';
import {
  action,
  ActionCtx,
  internalMutation,
  internalQuery,
  mutation,
  query,
  QueryCtx,
} from './_generated/server';
import { internal } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import { generateImage } from './util/image';
import { uploadToQiniu } from './util/qiniu';

const contextValidator = v.optional(
  v.object({
    activityKey: v.optional(v.string()),
    activityTitle: v.optional(v.string()),
    venue: v.optional(v.string()),
    contextLabel: v.optional(v.string()),
  }),
);

function compact(value: string | undefined, max = 48): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function normalizeTitle(title: string, fallback: string | undefined): string {
  return compact(title, 32) ?? compact(fallback, 32) ?? '沙城照片';
}

function buildPrompt(args: {
  title: string;
  activityTitle?: string;
  venue?: string;
  contextLabel?: string;
  userPrompt?: string;
}) {
  const context = [
    args.activityTitle ? `festival activity: ${args.activityTitle}` : null,
    args.venue ? `venue: ${args.venue}` : null,
    args.contextLabel ? `current place: ${args.contextLabel}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return [
    `Transform the uploaded real-world photo into a "Book of Sand" memory image titled "${args.title}".`,
    'Preserve the main people, poses, facial direction, camera angle, and recognizable composition of the original photo.',
    'Rebuild the scene as a cinematic sand-sculpture diorama from the 沙之书 world: carved sand figures, granular texture, warm coastal dusk, sea wind, tent lights, miniature festival architecture, subtle magical realism.',
    context ? `Anchor the image to this context: ${context}.` : 'Anchor the image to 候鸟沙城, a temporary coastal festival city made of sand.',
    // 访客的可选创作指令：在沙之书母题内做调整，但不得违背"保留真人主体/构图"与"无文字"等硬约束。
    args.userPrompt
      ? `Honor this creative direction from the visitor while keeping the sand-sculpture style and the people recognizable: ${args.userPrompt}.`
      : null,
    'Use a refined storybook frame, tactile sand material, golden shadows, and no readable text, watermark, logo, UI, or caption.',
  ]
    .filter(Boolean)
    .join(' ');
}

async function resolveImageUrl(
  ctx: QueryCtx,
  item: { imageUrl?: string; imageStorageId?: string },
): Promise<string | null> {
  if (item.imageUrl) return item.imageUrl;
  if (item.imageStorageId) return await ctx.storage.getUrl(item.imageStorageId);
  return null;
}

async function resolvePhotoMemory(ctx: QueryCtx, item: Doc<'photoMemories'>) {
  return {
    ...item,
    imageUrl: await resolveImageUrl(ctx, item),
    originalUrl: await ctx.storage.getUrl(item.originalStorageId),
  };
}

// 把生成图优先转存七牛 CDN（imageUrl），失败回退 Convex storage（imageStorageId），绝不漏图。
async function storeGenerated(
  ctx: ActionCtx,
  blob: Blob,
): Promise<{ imageUrl?: string; imageStorageId?: string }> {
  try {
    const unique = `photo-memories/${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return { imageUrl: await uploadToQiniu(blob, unique) };
  } catch (e) {
    console.error('照片记忆七牛上传失败，回退 Convex storage', e);
    return { imageStorageId: await ctx.storage.store(blob) };
  }
}

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const insertPhotoMemory = internalMutation({
  args: {
    userId: v.string(),
    userName: v.string(),
    title: v.string(),
    sourceType: v.union(v.literal('photo'), v.literal('video')),
    originalStorageId: v.string(),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.string()),
    activityKey: v.optional(v.string()),
    activityTitle: v.optional(v.string()),
    venue: v.optional(v.string()),
    contextLabel: v.optional(v.string()),
    shared: v.boolean(),
    sharedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args): Promise<Id<'photoMemories'>> => {
    return await ctx.db.insert('photoMemories', args);
  },
});

export const generatePhotoMemory = action({
  args: {
    userId: v.string(),
    userName: v.string(),
    title: v.string(),
    originalStorageId: v.string(),
    sharePublic: v.boolean(),
    context: contextValidator,
    userPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ memoryId: Id<'photoMemories'>; imageUrl: string | null }> => {
    const source = await ctx.storage.get(args.originalStorageId);
    if (!source) throw new Error('原图上传失败，请重新选择照片');

    const title = normalizeTitle(args.title, args.context?.activityTitle ?? args.context?.venue);
    const prompt = buildPrompt({
      title,
      activityTitle: compact(args.context?.activityTitle, 80),
      venue: compact(args.context?.venue, 48),
      contextLabel: compact(args.context?.contextLabel, 80),
      userPrompt: compact(args.userPrompt, 280),
    });

    const generated = await generateImage(prompt, source);
    const { imageUrl, imageStorageId } = await storeGenerated(ctx, generated);

    const now = Date.now();
    const memoryId = await ctx.runMutation(internal.photoMemories.insertPhotoMemory, {
      userId: args.userId,
      userName: compact(args.userName, 24) ?? '候鸟',
      title,
      sourceType: 'photo',
      originalStorageId: args.originalStorageId,
      imageUrl,
      imageStorageId,
      activityKey: args.context?.activityKey,
      activityTitle: compact(args.context?.activityTitle, 120),
      venue: compact(args.context?.venue, 48),
      contextLabel: compact(args.context?.contextLabel, 80),
      shared: args.sharePublic,
      sharedAt: args.sharePublic ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });

    return {
      memoryId,
      imageUrl: imageUrl ?? (imageStorageId ? await ctx.storage.getUrl(imageStorageId) : null),
    };
  },
});

export const getOwnedMemory = internalQuery({
  args: { memoryId: v.id('photoMemories'), userId: v.string() },
  handler: async (ctx, { memoryId, userId }): Promise<Doc<'photoMemories'> | null> => {
    const m = await ctx.db.get(memoryId);
    if (!m || m.userId !== userId) return null;
    return m;
  },
});

export const patchPhotoMemoryImage = internalMutation({
  args: {
    memoryId: v.id('photoMemories'),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.string()),
  },
  handler: async (ctx, { memoryId, imageUrl, imageStorageId }) => {
    // imageUrl / imageStorageId 恰有一个有值（新图替换旧图），另一个置空避免取到旧定位。
    await ctx.db.patch(memoryId, { imageUrl, imageStorageId, updatedAt: Date.now() });
  },
});

// 生成后按访客提示词在原图基础上重绘，覆盖同一条记忆（不新增行），保真不漂移。
export const refinePhotoMemory = action({
  args: {
    memoryId: v.id('photoMemories'),
    userId: v.string(),
    userPrompt: v.string(),
  },
  handler: async (ctx, { memoryId, userId, userPrompt }): Promise<{ imageUrl: string | null }> => {
    const memory = await ctx.runQuery(internal.photoMemories.getOwnedMemory, { memoryId, userId });
    if (!memory) throw new Error('照片记忆不存在或无权调整');
    const source = await ctx.storage.get(memory.originalStorageId);
    if (!source) throw new Error('原图已不可用，无法继续调整');

    const prompt = buildPrompt({
      title: memory.title,
      activityTitle: compact(memory.activityTitle, 80),
      venue: compact(memory.venue, 48),
      contextLabel: compact(memory.contextLabel, 80),
      userPrompt: compact(userPrompt, 280),
    });
    const generated = await generateImage(prompt, source);
    const { imageUrl, imageStorageId } = await storeGenerated(ctx, generated);
    await ctx.runMutation(internal.photoMemories.patchPhotoMemoryImage, {
      memoryId,
      imageUrl,
      imageStorageId,
    });
    return { imageUrl: imageUrl ?? (imageStorageId ? await ctx.storage.getUrl(imageStorageId) : null) };
  },
});

export const listMyPhotoMemories = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const items = await ctx.db
      .query('photoMemories')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .order('desc')
      .take(80);
    return await Promise.all(items.map((item) => resolvePhotoMemory(ctx, item)));
  },
});

export const listSharedPhotoMemories = query({
  handler: async (ctx) => {
    const items = await ctx.db
      .query('photoMemories')
      .withIndex('shared', (q) => q.eq('shared', true))
      .order('desc')
      .take(80);
    return await Promise.all(items.map((item) => resolvePhotoMemory(ctx, item)));
  },
});

export const recentSharedPhotoMemories = query({
  handler: async (ctx) => {
    const items = await ctx.db
      .query('photoMemories')
      .withIndex('shared', (q) => q.eq('shared', true))
      .order('desc')
      .take(8);
    return items.map((item) => ({
      _id: item._id,
      userId: item.userId,
      userName: item.userName,
      title: item.title,
      createdAt: item.createdAt,
      activityTitle: item.activityTitle,
      venue: item.venue,
    }));
  },
});

// 内部：取某用户在某作品/活动下最新一张照片记忆的生成图定位，喂给该活动专属体验当主角参考。
export const latestMemoryForActivity = internalQuery({
  args: { activityKey: v.string(), userId: v.string() },
  handler: async (
    ctx,
    { activityKey, userId },
  ): Promise<{ imageStorageId: string | null; imageUrl: string | null } | null> => {
    const item = await ctx.db
      .query('photoMemories')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .order('desc')
      .filter((q) => q.eq(q.field('activityKey'), activityKey))
      .first();
    if (!item) return null;
    return { imageStorageId: item.imageStorageId ?? null, imageUrl: item.imageUrl ?? null };
  },
});

export const setPhotoMemoryShared = mutation({
  args: {
    memoryId: v.id('photoMemories'),
    userId: v.string(),
    shared: v.boolean(),
  },
  handler: async (ctx, { memoryId, userId, shared }) => {
    const memory = await ctx.db.get(memoryId);
    if (!memory) throw new Error('照片记忆不存在');
    if (memory.userId !== userId) throw new Error('只能修改自己的照片记忆');
    await ctx.db.patch(memoryId, {
      shared,
      sharedAt: shared ? (memory.sharedAt ?? Date.now()) : undefined,
      updatedAt: Date.now(),
    });
  },
});
