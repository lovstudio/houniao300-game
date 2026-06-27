import { v } from 'convex/values';
import {
  ActionCtx,
  internalAction,
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

// 懒插入一条 pending 记忆并调度后台生成。前端拿到 memoryId 后订阅 getPhotoMemory 看进度，
// 不再 await 长 action（图像生成 20-60s，over-WS 等待易因重连丢失 → "action in flight 连接丢失"）。
export const createPhotoMemory = mutation({
  args: {
    userId: v.string(),
    userName: v.string(),
    title: v.string(),
    originalStorageId: v.string(),
    sharePublic: v.boolean(),
    context: contextValidator,
    userPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ memoryId: Id<'photoMemories'> }> => {
    const now = Date.now();
    const title = normalizeTitle(args.title, args.context?.activityTitle ?? args.context?.venue);
    const memoryId = await ctx.db.insert('photoMemories', {
      userId: args.userId,
      userName: compact(args.userName, 24) ?? '候鸟',
      title,
      sourceType: 'photo',
      originalStorageId: args.originalStorageId,
      activityKey: args.context?.activityKey,
      activityTitle: compact(args.context?.activityTitle, 120),
      venue: compact(args.context?.venue, 48),
      contextLabel: compact(args.context?.contextLabel, 80),
      userPrompt: compact(args.userPrompt, 280),
      status: 'pending',
      shared: args.sharePublic,
      sharedAt: args.sharePublic ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.photoMemories.runGeneration, { memoryId });
    return { memoryId };
  },
});

// 按访客新提示词在原图基础上重绘，覆盖同一条记忆（不新增行，保真不漂移）。同样异步化。
export const refinePhotoMemory = mutation({
  args: { memoryId: v.id('photoMemories'), userId: v.string(), userPrompt: v.string() },
  handler: async (ctx, { memoryId, userId, userPrompt }) => {
    const memory = await ctx.db.get(memoryId);
    if (!memory || memory.userId !== userId) throw new Error('照片记忆不存在或无权调整');
    await ctx.db.patch(memoryId, {
      userPrompt: compact(userPrompt, 280),
      status: 'pending',
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.photoMemories.runGeneration, { memoryId });
  },
});

export const getMemory = internalQuery({
  args: { memoryId: v.id('photoMemories') },
  handler: async (ctx, { memoryId }): Promise<Doc<'photoMemories'> | null> =>
    await ctx.db.get(memoryId),
});

export const setMemoryResult = internalMutation({
  args: {
    memoryId: v.id('photoMemories'),
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.string()),
  },
  handler: async (ctx, { memoryId, imageUrl, imageStorageId }) => {
    // imageUrl / imageStorageId 恰有一个有值（新图替换旧图），另一个置空避免取到旧定位。
    await ctx.db.patch(memoryId, { imageUrl, imageStorageId, status: 'ready', updatedAt: Date.now() });
  },
});

export const setMemoryFailed = internalMutation({
  args: { memoryId: v.id('photoMemories') },
  handler: async (ctx, { memoryId }) => {
    await ctx.db.patch(memoryId, { status: 'failed', updatedAt: Date.now() });
  },
});

// 后台生成：读原图 + 提示词 → 文生图 → 转存 → 回填。失败置 failed，前端可改提示词重试。
export const runGeneration = internalAction({
  args: { memoryId: v.id('photoMemories') },
  handler: async (ctx, { memoryId }) => {
    const memory = await ctx.runQuery(internal.photoMemories.getMemory, { memoryId });
    if (!memory) return;
    try {
      const source = await ctx.storage.get(memory.originalStorageId);
      if (!source) throw new Error('原图不可用');
      const prompt = buildPrompt({
        title: memory.title,
        activityTitle: compact(memory.activityTitle, 80),
        venue: compact(memory.venue, 48),
        contextLabel: compact(memory.contextLabel, 80),
        userPrompt: compact(memory.userPrompt, 280),
      });
      const generated = await generateImage(prompt, source);
      const { imageUrl, imageStorageId } = await storeGenerated(ctx, generated);
      await ctx.runMutation(internal.photoMemories.setMemoryResult, {
        memoryId,
        imageUrl,
        imageStorageId,
      });
    } catch (e) {
      console.error('照片记忆生成失败', e);
      await ctx.runMutation(internal.photoMemories.setMemoryFailed, { memoryId });
    }
  },
});

// 前端订阅单条记忆，实时看生成/重绘进度与结果。
export const getPhotoMemory = query({
  args: { memoryId: v.id('photoMemories') },
  handler: async (ctx, { memoryId }) => {
    const m = await ctx.db.get(memoryId);
    if (!m) return null;
    return {
      _id: m._id,
      // 旧行没有 status，但有图即视为 ready。
      status: m.status ?? (m.imageUrl || m.imageStorageId ? 'ready' : 'pending'),
      imageUrl: await resolveImageUrl(ctx, m),
      title: m.title,
      shared: m.shared,
    };
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
    // 取最新一张"已出图"的记忆（跳过 pending/failed），作为主角参考。
    const recent = await ctx.db
      .query('photoMemories')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .order('desc')
      .filter((q) => q.eq(q.field('activityKey'), activityKey))
      .take(10);
    const item = recent.find((m) => m.imageUrl || m.imageStorageId);
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
